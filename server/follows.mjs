import { bearerToken, getSupabaseAdmin, readJsonBody } from './supabase-admin.mjs'

function cleanHandle(value) {
  return String(value || '').replace(/^@/, '').trim().toLowerCase()
}

function httpError(message, statusCode) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

function cleanImageUrl(url) {
  if (!url || typeof url !== 'string') return ''
  const trimmed = url.trim()
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:') || trimmed.startsWith('/')) {
    return trimmed
  }
  return ''
}

function mapSupabaseRowToEntry(row) {
  const meta = row.metadata || {}
  const profile = row.profiles || {}
  const authorName =
    profile.name ||
    (profile.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : '') ||
    (profile.handle ? `@${profile.handle}` : '')

  return {
    ...meta,
    id: String(row.id),
    type: row.type,
    title: row.title,
    creator: row.creator || '',
    year: row.year || '',
    genre: row.genre || meta.genre || '',
    summary: row.summary || '',
    coverUrl: cleanImageUrl(row.cover_url) || cleanImageUrl(meta.coverUrl) || '',
    coverTone: row.cover_tone || undefined,
    artworkUrl: cleanImageUrl(row.artwork_url) || '',
    rating: row.rating ? Number(row.rating) : 0,
    quote: row.quote || '',
    favoritePassage: row.favorite_passage || '',
    passageAlign: row.passage_align || 'left',
    reflection: row.reflection || '',
    reflectionAlign: row.reflection_align || 'left',
    lyrics: row.lyrics || '',
    provider: row.provider || '',
    providerId: row.provider_id || '',
    enableDropCap: row.enable_drop_cap ?? meta.enableDropCap,
    preferWikipediaArtwork: row.prefer_wikipedia_artwork ?? meta.preferWikipediaArtwork,
    explicit: row.explicit ?? meta.explicit,
    createdAt: row.created_at || meta.createdAt || new Date().toISOString(),
    updatedAt: row.updated_at || meta.updatedAt || new Date().toISOString(),
    authorHandle: profile.handle || meta.authorHandle || '',
    authorName: authorName || meta.authorName || '',
    authorAvatarUrl: cleanImageUrl(profile.avatar_url) || cleanImageUrl(meta.authorAvatarUrl) || '',
  }
}

function mapSupabaseCollectionRow(row) {
  let meta = {}
  const descMatch = String(row.description || '').match(/\n?<!--tc-meta:([\s\S]*?)-->$/)
  if (descMatch) {
    try {
      meta = JSON.parse(descMatch[1])
    } catch {}
  }
  const cleanDescription = String(row.description || '').replace(/\n?<!--tc-meta:[\s\S]*?-->$/, '')
  return {
    id: row.id,
    name: row.title || 'Untitled',
    types: row.types || meta.types || [],
    description: cleanDescription,
    customCoverUrl: row.cover_url || '',
    entryIds: row.item_ids || [],
    items: row.items || meta.items || [],
    creatorName: meta.creatorName || undefined,
    creatorHandle: meta.creatorHandle || undefined,
    coverMode: meta.coverMode || undefined,
    coverStyle: meta.coverStyle || undefined,
    spotlightItemId: meta.spotlightItemId || undefined,
    isHidden: row.visibility === 'private',
  }
}

async function authenticateRequestUser(request, env) {
  const token = bearerToken(request)
  if (!token) throw httpError('Authentication required.', 401)
  const admin = getSupabaseAdmin(env)
  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user) throw httpError('Invalid or expired authentication session.', 401)
  return { user, admin }
}

export async function handleFollowRequestsApiRequest(request, env = process.env) {
  const pathname = new URL(request.url || '/', 'http://localhost').pathname

  if (request.method === 'POST' && pathname === '/api/follow-requests/accept') {
    const { user: targetUser, admin } = await authenticateRequestUser(request, env)
    const body = await readJsonBody(request)
    const requesterHandle = cleanHandle(body.requesterHandle)
    if (!requesterHandle) throw httpError('Missing requester handle.', 400)

    // Resolve requester profile
    const { data: requesterProfile } = await admin
      .from('profiles')
      .select('id, handle')
      .ilike('handle', requesterHandle)
      .maybeSingle()
    if (!requesterProfile?.id) throw httpError('Requester profile not found.', 404)
    const requesterId = requesterProfile.id

    // Resolve target profile (the authenticated user)
    const { data: targetProfile } = await admin
      .from('profiles')
      .select('id, handle')
      .eq('id', targetUser.id)
      .maybeSingle()
    const targetHandle = cleanHandle(body.targetHandle || targetProfile?.handle || '')

    // Delete pending follow request
    await admin
      .from('follow_requests')
      .delete()
      .eq('requester_id', requesterId)
      .eq('target_id', targetUser.id)

    // Insert into follows table via admin
    await admin.from('follows').upsert({
      follower_id: requesterId,
      following_id: targetUser.id,
      target_handle: targetHandle,
    })

    // Clean up follow request notification for target
    try {
      await admin
        .from('notifications')
        .delete()
        .eq('recipient_id', targetUser.id)
        .eq('actor_id', requesterId)
        .eq('type', 'follow_request')
    } catch {
      // ignore
    }

    // Insert follow_accept notification for requester
    try {
      const { error: notifErr } = await admin.from('notifications').insert({
        id: `follow_accept_${targetUser.id}_${Date.now()}`,
        recipient_id: requesterId,
        actor_id: targetUser.id,
        type: 'follow_accept',
        interaction_id: targetUser.id,
        read: false,
        created_at: new Date().toISOString(),
      })
      if (notifErr && (notifErr.code === '23514' || notifErr.message?.includes('violates check constraint'))) {
        await admin.from('notifications').insert({
          id: `follow_accept_${targetUser.id}_${Date.now()}`,
          recipient_id: requesterId,
          actor_id: targetUser.id,
          type: 'follow',
          interaction_id: `follow_accept:${targetUser.id}`,
          read: false,
          created_at: new Date().toISOString(),
        })
      }
    } catch {
      // ignore
    }

    // Update requester user_cloud_state
    try {
      const { data: requesterState } = await admin
        .from('user_cloud_state')
        .select('*')
        .eq('user_id', requesterId)
        .maybeSingle()
      if (requesterState) {
        const rawFollowed = Array.isArray(requesterState.followed_user_handles) ? requesterState.followed_user_handles.map(cleanHandle) : []
        const rawRequested = Array.isArray(requesterState.follow_requested_handles) ? requesterState.follow_requested_handles.map(cleanHandle) : []
        const nextFollowed = Array.from(new Set([...rawFollowed, targetHandle]))
        const nextRequested = rawRequested.filter((h) => h !== targetHandle)
        await admin
          .from('user_cloud_state')
          .update({
            followed_user_handles: nextFollowed,
            follow_requested_handles: nextRequested,
          })
          .eq('user_id', requesterId)
      }
    } catch (err) {
      console.error('Error updating requester state on follow accept:', err)
    }

    return { success: true, requesterId, requesterHandle: cleanHandle(requesterProfile.handle) }
  }

  if (request.method === 'POST' && pathname === '/api/follow-requests/decline') {
    const { user: targetUser, admin } = await authenticateRequestUser(request, env)
    const body = await readJsonBody(request)
    const requesterHandle = cleanHandle(body.requesterHandle)
    if (!requesterHandle) throw httpError('Missing requester handle.', 400)

    const { data: requesterProfile } = await admin
      .from('profiles')
      .select('id, handle')
      .ilike('handle', requesterHandle)
      .maybeSingle()
    if (!requesterProfile?.id) throw httpError('Requester profile not found.', 404)
    const requesterId = requesterProfile.id

    // Delete pending request
    await admin
      .from('follow_requests')
      .delete()
      .eq('requester_id', requesterId)
      .eq('target_id', targetUser.id)

    // Clean up follow request notification
    try {
      await admin
        .from('notifications')
        .delete()
        .eq('recipient_id', targetUser.id)
        .eq('actor_id', requesterId)
        .eq('type', 'follow_request')
    } catch {
      // ignore
    }

    // Update requester state: remove target handle from followRequestedHandles
    try {
      const { data: targetProfile } = await admin
        .from('profiles')
        .select('handle')
        .eq('id', targetUser.id)
        .maybeSingle()
      const targetHandle = cleanHandle(targetProfile?.handle || '')
      if (targetHandle) {
        const { data: requesterState } = await admin
          .from('user_cloud_state')
          .select('*')
          .eq('user_id', requesterId)
          .maybeSingle()
        if (requesterState) {
          const rawRequested = Array.isArray(requesterState.follow_requested_handles) ? requesterState.follow_requested_handles.map(cleanHandle) : []
          await admin
            .from('user_cloud_state')
            .update({
              follow_requested_handles: rawRequested.filter((h) => h !== targetHandle),
            })
            .eq('user_id', requesterId)
        }
      }
    } catch (err) {
      console.error('Error updating requester state on follow decline:', err)
    }

    return { success: true }
  }

  if (request.method === 'POST' && pathname === '/api/follow-requests/request') {
    const { user: requesterUser, admin } = await authenticateRequestUser(request, env)
    const body = await readJsonBody(request)
    const targetHandle = cleanHandle(body.targetHandle)
    const requested = Boolean(body.requested)
    if (!targetHandle) throw httpError('Missing target handle.', 400)

    const { data: targetProfile } = await admin
      .from('profiles')
      .select('id, handle')
      .ilike('handle', targetHandle)
      .maybeSingle()
    if (!targetProfile?.id) throw httpError('Target profile not found.', 404)
    const targetId = targetProfile.id

    if (!requested) {
      // Cancel request
      await admin
        .from('follow_requests')
        .delete()
        .eq('requester_id', requesterUser.id)
        .eq('target_id', targetId)

      // Delete notification
      try {
        await admin
          .from('notifications')
          .delete()
          .eq('recipient_id', targetId)
          .eq('actor_id', requesterUser.id)
          .eq('type', 'follow_request')
      } catch {
        // ignore
      }

      // Update requester state
      try {
        const { data: requesterState } = await admin
          .from('user_cloud_state')
          .select('*')
          .eq('user_id', requesterUser.id)
          .maybeSingle()
        if (requesterState) {
          const rawRequested = Array.isArray(requesterState.follow_requested_handles) ? requesterState.follow_requested_handles.map(cleanHandle) : []
          await admin
            .from('user_cloud_state')
            .update({
              follow_requested_handles: rawRequested.filter((h) => h !== targetHandle),
            })
            .eq('user_id', requesterUser.id)
        }
      } catch {
        // ignore
      }

      return { success: true, requested: false }
    } else {
      // Create request
      await admin.from('follow_requests').upsert({
        requester_id: requesterUser.id,
        target_id: targetId,
        status: 'pending',
      })

      // Clean up previous notification from this actor to target
      try {
        await admin
          .from('notifications')
          .delete()
          .eq('recipient_id', targetId)
          .eq('actor_id', requesterUser.id)
          .eq('type', 'follow_request')
      } catch {
        // ignore
      }

      // Always insert a fresh notification with unique timestamped ID and read: false
      if (targetId !== requesterUser.id) {
        try {
          const { error: notifErr } = await admin.from('notifications').insert({
            id: `follow_req_${requesterUser.id}_${Date.now()}`,
            recipient_id: targetId,
            actor_id: requesterUser.id,
            type: 'follow_request',
            interaction_id: requesterUser.id,
            read: false,
            created_at: new Date().toISOString(),
          })
          if (notifErr && (notifErr.code === '23514' || notifErr.message?.includes('violates check constraint'))) {
            await admin.from('notifications').insert({
              id: `follow_req_${requesterUser.id}_${Date.now()}`,
              recipient_id: targetId,
              actor_id: requesterUser.id,
              type: 'follow',
              interaction_id: `follow_request:${requesterUser.id}`,
              read: false,
              created_at: new Date().toISOString(),
            })
          }
        } catch {
          // ignore
        }
      }

      // Update requester state
      try {
        const { data: requesterState } = await admin
          .from('user_cloud_state')
          .select('*')
          .eq('user_id', requesterUser.id)
          .maybeSingle()
        if (requesterState) {
          const rawRequested = Array.isArray(requesterState.follow_requested_handles) ? requesterState.follow_requested_handles.map(cleanHandle) : []
          await admin
            .from('user_cloud_state')
            .update({
              follow_requested_handles: Array.from(new Set([...rawRequested, targetHandle])),
            })
            .eq('user_id', requesterUser.id)
        }
      } catch {
        // ignore
      }

      return { success: true, requested: true }
    }
  }

  if (request.method === 'GET' && pathname === '/api/profiles/content') {
    const url = new URL(request.url || '/', 'http://localhost')
    const queryUserId = url.searchParams.get('userId') || ''
    const queryHandle = cleanHandle(url.searchParams.get('handle') || '')
    if (!queryUserId && !queryHandle) {
      throw httpError('Missing userId or handle parameter.', 400)
    }

    const admin = getSupabaseAdmin(env)

    // Optional authentication of viewer
    const token = bearerToken(request)
    let viewerId = null
    if (token) {
      try {
        const { data: { user } } = await admin.auth.getUser(token)
        if (user?.id) viewerId = user.id
      } catch {
        // unauthenticated viewer
      }
    }

    // Resolve target profile
    let targetProfile = null
    if (queryUserId) {
      const { data } = await admin
        .from('profiles')
        .select('*')
        .eq('id', queryUserId)
        .maybeSingle()
      targetProfile = data
    } else if (queryHandle) {
      const { data } = await admin
        .from('profiles')
        .select('*')
        .ilike('handle', queryHandle)
        .maybeSingle()
      targetProfile = data
    }

    if (!targetProfile || targetProfile.account_status === 'deactivated') {
      throw httpError('Profile not found.', 404)
    }

    const targetUserId = targetProfile.id
    const isOwn = Boolean(viewerId && viewerId === targetUserId)
    const isPrivate = Boolean(targetProfile.is_private)
    let isFollower = false

    if (viewerId && isPrivate && !isOwn) {
      const { data: followRow } = await admin
        .from('follows')
        .select('following_id')
        .eq('follower_id', viewerId)
        .eq('following_id', targetUserId)
        .maybeSingle()
      isFollower = Boolean(followRow)
    }

    const canReadContent = isOwn || !isPrivate || isFollower

    if (!canReadContent) {
      return {
        isContentLocked: true,
        entries: [],
        collections: [],
      }
    }

    // Fetch entries and collections with service role admin
    const [{ data: entries }, { data: collections }] = await Promise.all([
      admin
        .from('entries')
        .select('*, profiles:owner_id (*)')
        .eq('owner_id', targetUserId)
        .order('created_at', { ascending: false }),
      admin
        .from('collections')
        .select('*')
        .eq('owner_id', targetUserId)
        .eq('kind', 'created')
        .order('created_at', { ascending: false }),
    ])

    return {
      isContentLocked: false,
      entries: (entries || []).map(mapSupabaseRowToEntry),
      collections: (collections || []).map(mapSupabaseCollectionRow),
    }
  }

  if (request.method === 'GET' && pathname === '/api/profiles/entry') {
    const url = new URL(request.url || '/', 'http://localhost')
    const entryId = url.searchParams.get('id') || ''
    if (!entryId) throw httpError('Missing entry id parameter.', 400)

    const admin = getSupabaseAdmin(env)
    const token = bearerToken(request)
    let viewerId = null
    if (token) {
      try {
        const { data: { user } } = await admin.auth.getUser(token)
        if (user?.id) viewerId = user.id
      } catch {
        // unauthenticated
      }
    }

    const { data: entryRow } = await admin
      .from('entries')
      .select('*, profiles:owner_id (*)')
      .eq('id', entryId)
      .maybeSingle()

    if (!entryRow) throw httpError('Entry not found.', 404)

    const ownerProfile = entryRow.profiles || {}
    const isOwn = Boolean(viewerId && viewerId === entryRow.owner_id)
    const isPrivate = Boolean(ownerProfile.is_private)
    let isFollower = false

    if (viewerId && isPrivate && !isOwn) {
      const { data: followRow } = await admin
        .from('follows')
        .select('following_id')
        .eq('follower_id', viewerId)
        .eq('following_id', entryRow.owner_id)
        .maybeSingle()
      isFollower = Boolean(followRow)
    }

    const canRead = isOwn || !isPrivate || isFollower
    if (!canRead) throw httpError('Content is private.', 403)

    return {
      entry: mapSupabaseRowToEntry(entryRow),
    }
  }

  return null
}
