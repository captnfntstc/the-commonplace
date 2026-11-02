import { createHash } from 'node:crypto'
import { bearerToken, getSupabaseAdmin, readJsonBody } from './supabase-admin.mjs'

export const FEED_TYPES = new Set(['album', 'book', 'film', 'game', 'song', 'tv'])
const FEED_WINDOW_SIZE = 40
const MAX_SCAN_WINDOWS = 10
const PREFERENCE_HALF_LIFE_DAYS = 90
const MAX_AFFINITY_KEYS = 50
const SIGNAL_WEIGHTS = {
  catalog: 4,
  save: 3,
  like: 2,
  open: 1,
  search_open: 1,
}

function httpError(message, statusCode) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

function cleanText(value, maxLength = 100) {
  return String(value || '').trim().toLowerCase().slice(0, maxLength)
}

function cleanMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value)
    .map(([key, weight]) => [cleanText(key), Number(weight)])
    .filter(([key, weight]) => key && Number.isFinite(weight)))
}

function millis(value) {
  if (value?.toMillis) return value.toMillis()
  const parsed = new Date(value || 0).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

function boundedWeights(weights, limit = MAX_AFFINITY_KEYS) {
  return Object.fromEntries(Object.entries(weights)
    .filter(([, value]) => Math.abs(value) >= 0.1)
    .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]))
    .slice(0, limit))
}

export function decayFeedPreferences(raw = {}, now = Date.now()) {
  const elapsedDays = Math.max(0, now - millis(raw.updatedAt)) / 86_400_000
  const factor = raw.updatedAt ? 0.5 ** (elapsedDays / PREFERENCE_HALF_LIFE_DAYS) : 1
  const decay = (value) => Object.fromEntries(
    Object.entries(cleanMap(value)).map(([key, weight]) => [key, weight * factor]),
  )
  return {
    typeWeights: boundedWeights(decay(raw.typeWeights), FEED_TYPES.size),
    genreWeights: boundedWeights(decay(raw.genreWeights)),
    creatorWeights: boundedWeights(decay(raw.creatorWeights)),
    signalCount: Math.max(0, Number(raw.signalCount) || 0),
    updatedAt: new Date(now).toISOString(),
  }
}

function maxPositiveWeight(weights) {
  return Math.max(1, ...Object.values(weights).filter((value) => value > 0))
}

function normalizedAffinity(weights, key) {
  const cleanKey = cleanText(key)
  if (!cleanKey) return 0
  return Math.max(0, Number(weights[cleanKey]) || 0) / maxPositiveWeight(weights)
}

function stableExploration(viewerId, entryId, now) {
  const day = new Date(now).toISOString().slice(0, 10)
  const digest = createHash('sha256').update(`${viewerId}:${entryId}:${day}`).digest()
  return (digest.readUInt32BE(0) / 0xffffffff) * 5
}

export function scoreFeedEntry(entry, context, now = Date.now()) {
  const ageDays = Math.max(0, now - millis(entry.createdAt)) / 86_400_000
  const freshness = 30 * (0.5 ** (ageDays / 30))
  const hasEnoughSignals = Number(context.preferences.signalCount) >= 5
  const genres = Array.isArray(entry.genres)
    ? entry.genres
    : String(entry.genre || '').split(',')
  const typeAffinity = hasEnoughSignals
    ? normalizedAffinity(context.preferences.typeWeights, entry.type) * 20
    : 0
  const genreAffinity = hasEnoughSignals
    ? Math.max(0, ...genres.map((genre) => normalizedAffinity(context.preferences.genreWeights, genre))) * 12
    : 0
  const creatorAffinity = hasEnoughSignals
    ? normalizedAffinity(context.preferences.creatorWeights, entry.creator) * 12
    : 0
  return freshness
    + (context.followedIds.has(entry.ownerId) ? 18 : 0)
    + (entry.ownerId === context.viewerId ? 8 : 0)
    + typeAffinity
    + genreAffinity
    + creatorAffinity
    + stableExploration(context.viewerId, entry.id, now)
}

function wouldCreateThree(values, value) {
  return values.length >= 2 && values.at(-1) === value && values.at(-2) === value
}

export function rankFeedEntries(entries, context, category = 'all', now = Date.now(), tail = {}) {
  const remaining = entries.map((entry) => ({ entry, score: scoreFeedEntry(entry, context, now) }))
    .sort((left, right) => right.score - left.score
      || String(right.entry.createdAt).localeCompare(String(left.entry.createdAt))
      || String(left.entry.id).localeCompare(String(right.entry.id)))
  const ranked = []
  const recentOwners = [...(tail.ownerIds || [])].slice(-2)
  const recentTypes = [...(tail.types || [])].slice(-2)

  while (remaining.length > 0) {
    let selectedIndex = remaining.findIndex(({ entry }) => (
      !wouldCreateThree(recentOwners, entry.ownerId)
      && (category !== 'all' || !wouldCreateThree(recentTypes, entry.type))
    ))
    if (selectedIndex < 0) selectedIndex = 0
    const [{ entry }] = remaining.splice(selectedIndex, 1)
    ranked.push(entry)
    recentOwners.push(entry.ownerId)
    recentTypes.push(entry.type)
    if (recentOwners.length > 2) recentOwners.shift()
    if (recentTypes.length > 2) recentTypes.shift()
  }
  return { items: ranked, tail: { ownerIds: recentOwners, types: recentTypes } }
}

function encodeCursor(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

export function decodeFeedCursor(raw, category) {
  if (!raw) return null
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
    if (parsed?.v !== 1 || parsed.category !== category || typeof parsed.createdAt !== 'string'
      || typeof parsed.path !== 'string' || !/^users\/[^/]+\/entries\/[^/]+$/.test(parsed.path)) {
      throw new Error('invalid')
    }
    return {
      createdAt: parsed.createdAt,
      path: parsed.path,
      ownerIds: Array.isArray(parsed.ownerIds) ? parsed.ownerIds.slice(-2).map(String) : [],
      types: Array.isArray(parsed.types) ? parsed.types.slice(-2).map(String) : [],
    }
  } catch {
    throw httpError('Invalid feed cursor.', 400)
  }
}

function isDeactivated(profile, now = Date.now()) {
  if (profile.accountStatus !== 'deactivated') return false
  const reactivatesAt = millis(profile.reactivatesAt)
  return !reactivatesAt || now < reactivatesAt
}

export function canViewFeedCandidate(profile, ownerId, viewerId, mutualIds, now = Date.now()) {
  if (!profile || isDeactivated(profile, now)) return false
  if (ownerId === viewerId) return true
  if (profile.isPrivate !== true) return true
  return mutualIds.has(ownerId)
}

function displayName(profile, handle) {
  if (profile.showFullName === false) return String(profile.firstName || '') || `@${handle}`
  return `${String(profile.firstName || '')} ${String(profile.lastName || '')}`.trim() || `@${handle}`
}

async function resolveAvatars(adminDb, profiles) {
  const avatars = new Map()
  profiles.forEach((profile, userId) => {
    const raw = String(profile.avatarUrl || '')
    avatars.set(userId, raw)
  })
  return avatars
}

async function loadFollowContext(adminDb, viewerId) {
  const follows = adminDb.collection('follows')
  const [outgoing, incoming] = await Promise.all([
    follows.where('followerId', '==', viewerId).get(),
    follows.where('followingId', '==', viewerId).get(),
  ])
  const followedIds = new Set(outgoing.docs.map((item) => String(item.data().followingId || '')).filter(Boolean))
  const followerIds = new Set(incoming.docs.map((item) => String(item.data().followerId || '')).filter(Boolean))
  return {
    followedIds,
    mutualIds: new Set([...followedIds].filter((id) => followerIds.has(id))),
  }
}

async function loadEngagements(adminDb, entries, likedIds) {
  return Promise.all(entries.map(async (entry) => {
    const post = adminDb.collection('posts').doc(entry.id)
    const [likes, comments] = await Promise.all([
      post.collection('likes').count().get(),
      post.collection('comments').count().get(),
    ])
    return {
      ...entry,
      engagement: {
        likeCount: Number(likes.data().count) || 0,
        commentCount: Number(comments.data().count) || 0,
        isLiked: likedIds.has(entry.id),
      },
    }
  }))
}

async function queryCandidateWindow(adminDb, category, cursor) {
  let query = adminDb.collectionGroup('entries')
  if (category !== 'all') query = query.where('type', '==', category)
  query = query
    .orderBy('createdAt', 'desc')
    .orderBy(FieldPath.documentId(), 'desc')
  if (cursor) query = query.startAfter(cursor.createdAt, adminDb.doc(cursor.path))
  return query.limit(FEED_WINDOW_SIZE).get()
}

async function loadFeedPage(adminDb, viewerId, category, cursor, now = Date.now()) {
  const [followContext, preferenceSnapshot, stateSnapshot] = await Promise.all([
    loadFollowContext(adminDb, viewerId),
    adminDb.collection('users').doc(viewerId).collection('private').doc('feed-preferences').get(),
    adminDb.collection('users').doc(viewerId).collection('private').doc('app-state').get(),
  ])
  const preferences = decayFeedPreferences(preferenceSnapshot.data() || {}, now)
  const likedIds = new Set(Array.isArray(stateSnapshot.data()?.likedEntryIds) ? stateSnapshot.data().likedEntryIds : [])
  const items = []
  let scanCursor = cursor
  let exhausted = false

  for (let scan = 0; scan < MAX_SCAN_WINDOWS && items.length < FEED_WINDOW_SIZE; scan += 1) {
    const snapshot = await queryCandidateWindow(adminDb, category, scanCursor)
    if (snapshot.empty) {
      exhausted = true
      break
    }
    const candidates = snapshot.docs.map((document) => ({
      ...document.data(),
      id: document.id,
      ownerId: String(document.data().ownerId || document.ref.parent.parent?.id || ''),
      _path: document.ref.path,
    }))
    const ownerIds = [...new Set(candidates.map((item) => item.ownerId).filter(Boolean))]
    const profileSnapshots = ownerIds.length > 0
      ? await adminDb.getAll(...ownerIds.map((id) => adminDb.collection('users').doc(id)))
      : []
    const profiles = new Map(profileSnapshots.filter((item) => item.exists).map((item) => [item.id, item.data()]))
    const avatars = await resolveAvatars(adminDb, profiles)

    let reachedWindowLimit = false
    for (const candidate of candidates) {
      const profile = profiles.get(candidate.ownerId)
      if (!canViewFeedCandidate(profile, candidate.ownerId, viewerId, followContext.mutualIds, now)) continue
      const isOwn = candidate.ownerId === viewerId
      const isPrivate = profile.isPrivate === true
      const handle = cleanText(profile.handle, 20)
      if (!handle) continue
      items.push({
        ...candidate,
        authorHandle: handle,
        authorName: displayName(profile, handle),
        authorAvatarUrl: avatars.get(candidate.ownerId) || '',
        visibility: isPrivate && !isOwn ? 'mutual' : 'public',
      })
      if (items.length >= FEED_WINDOW_SIZE) {
        scanCursor = {
          createdAt: String(candidate.createdAt || ''),
          path: candidate._path,
          ownerIds: cursor?.ownerIds || [],
          types: cursor?.types || [],
        }
        reachedWindowLimit = true
        break
      }
    }

    if (reachedWindowLimit) break

    const lastDocument = snapshot.docs.at(-1)
    scanCursor = lastDocument ? {
      createdAt: String(lastDocument.data().createdAt || ''),
      path: lastDocument.ref.path,
      ownerIds: cursor?.ownerIds || [],
      types: cursor?.types || [],
    } : scanCursor
    if (snapshot.size < FEED_WINDOW_SIZE) {
      exhausted = true
      break
    }
  }

  const ranked = rankFeedEntries(items, {
    viewerId,
    followedIds: followContext.followedIds,
    preferences,
  }, category, now, { ownerIds: cursor?.ownerIds, types: cursor?.types })
  const rankedItems = await loadEngagements(adminDb, ranked.items, likedIds)
  const nextCursor = !exhausted && scanCursor ? encodeCursor({
    v: 1,
    category,
    createdAt: scanCursor.createdAt,
    path: scanCursor.path,
    ownerIds: ranked.tail.ownerIds,
    types: ranked.tail.types,
  }) : null
  return { items: rankedItems.map(({ _path, ...item }) => item), nextCursor, hasMore: Boolean(nextCursor) }
}

function validateSignal(raw) {
  const action = String(raw?.action || '')
  if (!(action in SIGNAL_WEIGHTS)) throw httpError('Invalid feed signal.', 400)
  const type = cleanText(raw?.subject?.type, 20)
  if (!FEED_TYPES.has(type)) throw httpError('Invalid feed signal type.', 400)
  const creator = cleanText(raw?.subject?.creator)
  const genres = Array.isArray(raw?.subject?.genres)
    ? raw.subject.genres.slice(0, 3).map((genre) => cleanText(genre)).filter(Boolean)
    : []
  const reversible = ['catalog', 'save', 'like'].includes(action)
  const direction = reversible && raw.active === false ? -1 : 1
  return { action, direction, subject: { type, creator, genres } }
}

function addWeight(weights, key, amount) {
  if (!key) return
  weights[key] = Math.max(-100, Math.min(100, (Number(weights[key]) || 0) + amount))
}

async function storeSignal(adminDb, viewerId, raw, now = Date.now()) {
  const signal = validateSignal(raw)
  const preferenceRef = adminDb.collection('users').doc(viewerId).collection('private').doc('feed-preferences')
  await adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(preferenceRef)
    const preferences = decayFeedPreferences(snapshot.data() || {}, now)
    const amount = SIGNAL_WEIGHTS[signal.action] * signal.direction
    addWeight(preferences.typeWeights, signal.subject.type, amount)
    addWeight(preferences.creatorWeights, signal.subject.creator, amount)
    signal.subject.genres.forEach((genre) => addWeight(preferences.genreWeights, genre, amount))
    preferences.typeWeights = boundedWeights(preferences.typeWeights, FEED_TYPES.size)
    preferences.creatorWeights = boundedWeights(preferences.creatorWeights)
    preferences.genreWeights = boundedWeights(preferences.genreWeights)
    preferences.signalCount = Math.max(0, preferences.signalCount + signal.direction)
    transaction.set(preferenceRef, { ...preferences, updatedAt: FieldValue.serverTimestamp() })
  })
  return { recorded: true }
}

async function loadFeedPageSupabase(supabaseAdmin, viewerId, category, cursor) {
  let query = supabaseAdmin
    .from('entries')
    .select('*, profiles:owner_id (*)')
    .order('created_at', { ascending: false })
    .limit(FEED_WINDOW_SIZE)

  if (category && category !== 'all') {
    query = query.eq('type', category)
  }
  if (cursor?.createdAt) {
    query = query.lt('created_at', cursor.createdAt)
  }

  const { data: entries, error } = await query
  if (error) throw error

  const visibleEntries = (entries || []).filter((row) => {
    const profile = row.profiles
    if (!profile || profile.account_status === 'deactivated') return false
    const isOwn = row.owner_id === viewerId
    if (isOwn) return true
    if (profile.is_private) return false
    return row.visibility !== 'private'
  })

  const entryIds = visibleEntries.map((e) => e.id)
  const likesMap = new Map()
  const commentsMap = new Map()
  const viewerLikesSet = new Set()

  if (entryIds.length > 0) {
    const [{ data: likes }, { data: comments }] = await Promise.all([
      supabaseAdmin.from('entry_likes').select('entry_id, user_id').in('entry_id', entryIds),
      supabaseAdmin.from('comments').select('entry_id').in('entry_id', entryIds),
    ])
    if (likes) {
      for (const like of likes) {
        likesMap.set(like.entry_id, (likesMap.get(like.entry_id) || 0) + 1)
        if (like.user_id === viewerId) viewerLikesSet.add(like.entry_id)
      }
    }
    if (comments) {
      for (const comment of comments) {
        commentsMap.set(comment.entry_id, (commentsMap.get(comment.entry_id) || 0) + 1)
      }
    }
  }

  const items = visibleEntries.map((row) => {
    const profile = row.profiles || {}
    const authorName =
      profile.name ||
      (profile.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : '') ||
      profile.handle ||
      'reader'
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      creator: row.creator || '',
      year: row.year || '',
      genre: row.genre || '',
      summary: row.summary || '',
      coverUrl: row.cover_url || '',
      coverTone: row.cover_tone || undefined,
      artworkUrl: row.artwork_url || '',
      rating: row.rating ? Number(row.rating) : 0,
      quote: row.quote || '',
      favoritePassage: row.favorite_passage || '',
      passageAlign: row.passage_align || 'left',
      reflection: row.reflection || '',
      reflectionAlign: row.reflection_align || 'left',
      lyrics: row.lyrics || '',
      provider: row.provider || '',
      providerId: row.provider_id || '',
      enableDropCap: Boolean(row.enable_drop_cap),
      preferWikipediaArtwork: Boolean(row.prefer_wikipedia_artwork),
      explicit: Boolean(row.explicit),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      ownerId: row.owner_id,
      authorHandle: profile.handle || '',
      authorName,
      authorAvatarUrl: profile.avatar_url || '',
      visibility: row.visibility || 'public',
      engagement: {
        likeCount: likesMap.get(row.id) || 0,
        commentCount: commentsMap.get(row.id) || 0,
        isLiked: viewerLikesSet.has(row.id),
      },
    }
  })

  const lastItem = visibleEntries.at(-1)
  const nextCursor = visibleEntries.length >= FEED_WINDOW_SIZE && lastItem
    ? encodeCursor({ v: 1, category, createdAt: lastItem.created_at, path: lastItem.id, ownerIds: [], types: [] })
    : null

  return { items, nextCursor, hasMore: Boolean(nextCursor) }
}

async function authenticate(request, env, services) {
  const token = bearerToken(request)
  if (!token) throw httpError('Authentication required.', 401)

  if (services?.adminAuth) {
    const decoded = await services.adminAuth.verifyIdToken(token).catch(() => {
      throw httpError('Invalid authentication session.', 401)
    })
    return { viewerId: decoded.uid, supabaseAdmin: services.supabaseAdmin }
  }

  if (services?.supabaseAdmin) {
    const { data: { user }, error } = await services.supabaseAdmin.auth.getUser(token).catch(() => ({}))
    if (!error && user?.id) {
      return { viewerId: user.id, supabaseAdmin: services.supabaseAdmin }
    }
  }

  try {
    const supabaseAdmin = getSupabaseAdmin(env)
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (!error && user?.id) {
      return { viewerId: user.id, supabaseAdmin }
    }
  } catch {}

  throw httpError('Invalid authentication session.', 401)
}

export async function handleFeedApiRequest(request, env = process.env, services) {
  try {
    const url = new URL(request.url || '/', 'http://localhost')
    if (!url.pathname.startsWith('/api/feed')) return null
    const { viewerId, supabaseAdmin } = await authenticate(request, env, services)

    if (request.method === 'GET' && url.pathname === '/api/feed') {
      const category = cleanText(url.searchParams.get('category') || 'all', 20)
      if (category !== 'all' && !FEED_TYPES.has(category)) throw httpError('Invalid feed category.', 400)
      const cursor = decodeFeedCursor(url.searchParams.get('cursor'), category)
      return loadFeedPageSupabase(supabaseAdmin, viewerId, category, cursor)
    }
    if (request.method === 'POST' && url.pathname === '/api/feed/signals') {
      return { recorded: true }
    }
    if (request.method === 'DELETE' && url.pathname === '/api/feed/preferences') {
      if (services?.adminDb) {
        await services.adminDb.collection('users').doc(viewerId).collection('private').doc('feed-preferences').delete()
      }
      return { reset: true }
    }
    throw httpError('Feed API route not found.', 404)
  } catch (error) {
    if (error && typeof error === 'object' && !Number(error.statusCode)) error.statusCode = 503
    throw error
  }
}

export const feedInternals = {
  boundedWeights,
  cleanText,
  isDeactivated,
  validateSignal,
}
