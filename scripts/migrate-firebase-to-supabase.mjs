import fs from 'fs'
import crypto from 'crypto'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import { createClient } from '@supabase/supabase-js'

const envContent = fs.readFileSync('.env.local', 'utf-8')

function parseEnv(key) {
  const lines = envContent.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith(`${key}=`)) {
      let val = trimmed.slice(key.length + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      return val.replace(/\\n/g, '\n').trim()
    }
  }
  return ''
}

const clientEmail = parseEnv('FIREBASE_ADMIN_CLIENT_EMAIL')
const privateKey = parseEnv('FIREBASE_ADMIN_PRIVATE_KEY')
const projectId = parseEnv('VITE_FIREBASE_PROJECT_ID') || 'the-commonplace-f8eeb'

const supabaseUrl = parseEnv('VITE_SUPABASE_URL')
// Prefer service_role key to bypass RLS and create auth users; fall back to anon key
const supabaseKey = parseEnv('SUPABASE_SERVICE_ROLE_KEY') || parseEnv('VITE_SUPABASE_ANON_KEY')

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const fbApp = initializeApp({
  credential: cert({
    projectId,
    clientEmail,
    privateKey,
  }),
})

const fbDb = getFirestore(fbApp)
const fbAuth = getAuth(fbApp)

// Deterministically map any Firebase UID string to an RFC-compliant UUIDv4-like string
function firebaseUidToUuid(uid) {
  const hash = crypto.createHash('md5').update(`the-commonplace:${uid}`).digest('hex')
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '4' + hash.substring(13, 16),
    '8' + hash.substring(17, 20),
    hash.substring(20, 32),
  ].join('-')
}

async function runMigration() {
  console.log('=== THE COMMONPLACE: FIREBASE -> SUPABASE MIGRATION ===\n')

  // 1. Fetch Firebase data
  const [authUsersResult, usersSnap, followsSnap, reqSnap] = await Promise.all([
    fbAuth.listUsers(100),
    fbDb.collection('users').get(),
    fbDb.collection('follows').get(),
    fbDb.collection('follow-requests').get(),
  ])

  console.log(`Found ${authUsersResult.users.length} Auth Users, ${usersSnap.size} Profiles in Firebase.\n`)

  const uidToUuidMap = new Map()
  const uidToProfileMap = new Map()

  // Collect Firestore profile data
  usersSnap.docs.forEach((doc) => {
    uidToProfileMap.set(doc.id, doc.data())
  })

  // 2. Migrate Users & Profiles
  console.log('--- Migrating Users & Profiles ---')
  for (const fbUser of authUsersResult.users) {
    const uuid = firebaseUidToUuid(fbUser.uid)
    uidToUuidMap.set(fbUser.uid, uuid)

    const profileData = uidToProfileMap.get(fbUser.uid) || {}
    const handle = profileData.handle || fbUser.displayName?.toLowerCase().replace(/[^a-z0-9_]/g, '') || `user_${fbUser.uid.slice(0, 6)}`
    const fullName = `${profileData.firstName || ''} ${profileData.lastName || ''}`.trim() || fbUser.displayName || handle

    console.log(`Migrating user: ${fbUser.email} (Firebase UID: ${fbUser.uid} -> Supabase UUID: ${uuid})`)

    // Attempt to create auth user in Supabase (requires service_role)
    const { error: authError } = await supabase.auth.admin.createUser({
      id: uuid,
      email: fbUser.email,
      email_confirm: true,
      user_metadata: {
        handle,
        name: fullName,
        first_name: profileData.firstName || '',
        last_name: profileData.lastName || '',
      },
    }).catch(() => ({ error: { message: 'Service role key needed for admin user creation' } }))

    if (authError && !authError.message?.includes('already been registered')) {
      console.warn(`  Auth notice: ${authError.message}`)
    }

    // Upsert Profile
    const profileRow = {
      id: uuid,
      handle: handle.toLowerCase(),
      name: fullName,
      first_name: profileData.firstName || '',
      last_name: profileData.lastName || '',
      bio: profileData.bio || '',
      avatar_url: profileData.avatarUrl || fbUser.photoURL || '',
      cover_url: profileData.coverUrl || '',
      is_private: Boolean(profileData.isPrivate),
      show_full_name: profileData.showFullName !== false,
      allow_comments: profileData.allowComments !== false,
      account_status: profileData.accountStatus === 'deactivated' ? 'deactivated' : 'active',
      created_at: fbUser.metadata.creationTime ? new Date(fbUser.metadata.creationTime).toISOString() : new Date().toISOString(),
    }

    const { error: profileError } = await supabase.from('profiles').upsert(profileRow)
    if (profileError) {
      console.error(`  Error upserting profile for ${handle}:`, profileError.message)
    } else {
      console.log(`  ✓ Profile synced: @${handle}`)
    }

    // Upsert User Cloud State (saved entries, private app state)
    const privateStateSnap = await fbDb.collection('users').doc(fbUser.uid).collection('private').doc('app-state').get()
    const savedActivitySnap = await fbDb.collection('users').doc(fbUser.uid).collection('activity').doc('saved').get()

    const privateState = privateStateSnap.exists ? privateStateSnap.data() : {}
    const savedActivity = savedActivitySnap.exists ? savedActivitySnap.data() : {}

    const cloudStateRow = {
      user_id: uuid,
      liked_entry_ids: privateState.likedEntryIds || [],
      saved_entries: savedActivity.savedEntries || [],
      followed_user_handles: privateState.followedUserHandles || [],
      follow_requested_handles: privateState.followRequestedHandles || [],
      disabled_comment_entry_ids: privateState.disabledCommentEntryIds || [],
    }

    try {
      await supabase.from('user_cloud_state').upsert(cloudStateRow)
    } catch (e) {}
  }

  // 3. Migrate Entries
  console.log('\n--- Migrating Entries ---')
  let entriesCount = 0

  for (const userDoc of usersSnap.docs) {
    const fbUid = userDoc.id
    const ownerUuid = uidToUuidMap.get(fbUid)
    if (!ownerUuid) continue

    const entriesSnap = await fbDb.collection('users').doc(fbUid).collection('entries').get()

    for (const entryDoc of entriesSnap.docs) {
      const e = entryDoc.data()
      const entryId = entryDoc.id

      const entryRow = {
        id: entryId,
        owner_id: ownerUuid,
        type: e.type || 'thought',
        title: e.title || e.entryTitle || 'Untitled',
        creator: e.creator || '',
        year: String(e.year || ''),
        genre: e.genre || '',
        summary: e.summary || '',
        cover_url: e.coverUrl || '',
        cover_tone: e.coverTone || '',
        artwork_url: e.artworkUrl || e.coverUrl || '',
        rating: typeof e.rating === 'number' ? e.rating : 0,
        quote: e.favoritePassage || e.quote || '',
        favorite_passage: e.favoritePassage || '',
        passage_align: e.passageAlign || 'left',
        reflection: e.reflection || '',
        reflection_align: e.reflectionAlign || 'left',
        lyrics: e.lyrics || '',
        provider: e.provider || '',
        provider_id: String(e.providerId || ''),
        enable_drop_cap: Boolean(e.enableDropCap),
        prefer_wikipedia_artwork: Boolean(e.preferWikipediaArtwork),
        explicit: Boolean(e.explicit),
        notable_lines: e.notableLines || [],
        tags: e.tags || [],
        visibility: e.visibility || 'public',
        comments_disabled: Boolean(e.commentsDisabled),
        metadata: {
          genre: e.genre,
          provider: e.provider,
          rating: e.rating,
        },
        created_at: e.createdAt || new Date().toISOString(),
        updated_at: e.updatedAt || e.createdAt || new Date().toISOString(),
      }

      const { error: entryError } = await supabase.from('entries').upsert(entryRow)
      if (entryError) {
        console.error(`  Error upserting entry ${entryId} ("${entryRow.title}"):`, entryError.message)
      } else {
        entriesCount++
        console.log(`  ✓ Entry synced: "${entryRow.title}" (${entryRow.type}) by @${userDoc.data().handle}`)
      }
    }
  }

  // 4. Migrate Follows
  console.log('\n--- Migrating Follows ---')
  let followsCount = 0

  for (const followDoc of followsSnap.docs) {
    const f = followDoc.data()
    const followerUuid = uidToUuidMap.get(f.followerId)
    const followingUuid = uidToUuidMap.get(f.followingId)

    if (followerUuid && followingUuid) {
      const followRow = {
        follower_id: followerUuid,
        following_id: followingUuid,
        target_handle: f.targetHandle || '',
        created_at: f.createdAt || new Date().toISOString(),
      }

      const { error: followError } = await supabase.from('follows').upsert(followRow)
      if (followError) {
        console.error(`  Error upserting follow ${followDoc.id}:`, followError.message)
      } else {
        followsCount++
        console.log(`  ✓ Follow synced: ${f.followerId} -> @${f.targetHandle}`)
      }
    }
  }

  // 5. Migrate Follow Requests
  console.log('\n--- Migrating Follow Requests ---')
  for (const reqDoc of reqSnap.docs) {
    const r = reqDoc.data()
    const requesterUuid = uidToUuidMap.get(r.requesterId)
    const targetUuid = uidToUuidMap.get(r.targetId)

    if (requesterUuid && targetUuid) {
      const reqRow = {
        requester_id: requesterUuid,
        target_id: targetUuid,
        status: r.status || 'pending',
        created_at: r.createdAt || new Date().toISOString(),
      }

      try {
        await supabase.from('follow_requests').upsert(reqRow, { onConflict: 'requester_id,target_id' })
        console.log(`  ✓ Follow request synced: ${r.requesterId} -> ${r.targetId}`)
      } catch (e) {}
    }
  }

  console.log('\n=== MIGRATION COMPLETE ===')
  console.log(`Migrated ${authUsersResult.users.length} Users, ${entriesCount} Entries, ${followsCount} Follows to Supabase.`)
}

runMigration().catch(console.error)
