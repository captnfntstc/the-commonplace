import { reconcileEntrySnapshots, type Entry } from '../features/entries/model'
import {
  collectionsCreatedByProfile,
  type ProfileCollection,
} from '../features/collections/profileCollections'
import type { AppNotification } from '../types/notification'
import type { UserProfileState } from '../types/userProfile'
import { removeLegacySeedEntryIds } from '../utils/legacySeedCleanup'
import { supabase, isSupabaseConfigured } from './supabase'

export type Unsubscribe = () => void

function cleanImageUrl(value?: string | null): string {
  if (!value || typeof value !== 'string') return ''
  if (value.startsWith('firestore-media:')) return ''
  return value
}

function mapSupabaseEntryToClientEntry(row: Record<string, any>): Entry {
  const meta = (row.metadata as Record<string, any>) || {}
  const profile = (row.profiles as Record<string, any>) || {}
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
  } as Entry
}

export const CLOUD_MIGRATION_VERSION = 3

export type UserCloudState = {
  likedEntryIds: string[]
  savedEntryIds: string[]
  disabledCommentEntryIds: string[]
  followedUserHandles: string[]
  followRequestedHandles: string[]
  notifications: AppNotification[]
}

export type UserCloudSnapshot = {
  profile: UserProfileState
  entries: Entry[]
  state: UserCloudState
}

export type CloudCommentReply = {
  id: string
  authorId?: string
  authorHandle?: string
  replyToUserId?: string
  replyToHandle?: string
  replyToName?: string
  replyToInteractionId?: string
  author: string
  initials: string
  text: string
  createdAt: string
  likesCount?: number
  isLiked?: boolean
}

export type CloudComment = CloudCommentReply & {
  replies: CloudCommentReply[]
}

export type PostEngagement = {
  likeCount: number
  commentCount: number
  isLiked: boolean
}

export type PublicUserData = {
  profile: UserProfileState
  entries: Entry[]
  collections: ProfileCollection[]
  savedEntryIds: string[]
  savedCollections: ProfileCollection[]
  isContentLocked?: boolean
}

export type PublicUserSummary = {
  uid: string
  handle: string
  name: string
  avatarUrl: string
  isPrivate: boolean
}

export type PublicAccountIdentity = PublicUserSummary & {
  isDeactivated: boolean
}

export type ContentReport = {
  targetType: 'profile' | 'post' | 'comment' | 'reply'
  targetId: string
  targetHandle?: string
  postId?: string
  parentCommentId?: string
  reason: string
  details?: string
}

type CloudCollectionKind = 'created' | 'saved'
type CloudImageKind = 'avatar' | 'cover' | 'collection-cover'

const MAX_MEDIA_DATA_URL_LENGTH = 700_000
const accountIdentityCache = new Map<string, Promise<{ handle: string; deactivated: boolean }>>()
const pendingUserEntryWrites = new Map<string, Promise<void>>()

export const DEACTIVATED_ACCOUNT_NAME = 'Quiet Reader'

const DEFAULT_CLOUD_STATE: UserCloudState = {
  likedEntryIds: [],
  savedEntryIds: [],
  disabledCommentEntryIds: [],
  followedUserHandles: [],
  followRequestedHandles: [],
  notifications: [],
}

function uniqueStrings(...groups: string[][]) {
  return Array.from(new Set(groups.flat()))
}

export function mergeMigrationSnapshots(
  cloudSnapshot: UserCloudSnapshot,
  localSnapshot: UserCloudSnapshot,
): UserCloudSnapshot {
  const notifications = new Map(
    cloudSnapshot.state.notifications.map((notification) => [notification.id, notification]),
  )
  localSnapshot.state.notifications.forEach((notification) => {
    if (!notifications.has(notification.id)) notifications.set(notification.id, notification)
  })

  return {
    profile: cloudSnapshot.profile,
    entries: reconcileEntrySnapshots(cloudSnapshot.entries, localSnapshot.entries),
    state: {
      likedEntryIds: uniqueStrings(
        cloudSnapshot.state.likedEntryIds,
        localSnapshot.state.likedEntryIds,
      ),
      savedEntryIds: uniqueStrings(
        cloudSnapshot.state.savedEntryIds,
        localSnapshot.state.savedEntryIds,
      ),
      disabledCommentEntryIds: uniqueStrings(
        cloudSnapshot.state.disabledCommentEntryIds,
        localSnapshot.state.disabledCommentEntryIds,
      ),
      followedUserHandles: uniqueStrings(
        cloudSnapshot.state.followedUserHandles,
        localSnapshot.state.followedUserHandles,
      ),
      followRequestedHandles: uniqueStrings(
        cloudSnapshot.state.followRequestedHandles,
        localSnapshot.state.followRequestedHandles,
      ),
      notifications: Array.from(notifications.values()),
    },
  }
}

export function canUseCloudData(userId?: string | null) {
  return Boolean(isSupabaseConfigured && userId)
}

export function cleanHandle(value: string) {
  return value.replace(/^@/, '').trim().toLowerCase()
}

function dateValueToMillis(value: unknown) {
  if (value && typeof value === 'object' && 'toMillis' in value && typeof (value as any).toMillis === 'function') {
    return (value as any).toMillis()
  }
  const timestamp = typeof value === 'string' || typeof value === 'number' ? new Date(value).getTime() : Number.NaN
  return Number.isFinite(timestamp) ? timestamp : null
}

export function isAccountCurrentlyDeactivated(data: Record<string, unknown>, now = Date.now()) {
  if (data.account_status === 'deactivated' || data.accountStatus === 'deactivated') {
    const reactivatesAt = dateValueToMillis(data.reactivates_at || data.reactivatesAt)
    return reactivatesAt === null || reactivatesAt > now
  }
  return false
}

export async function loadAccountIdentity(userId?: string | null): Promise<{ handle: string; deactivated: boolean }> {
  if (!userId) return { handle: '', deactivated: false }
  const cached = accountIdentityCache.get(userId)
  if (cached) return cached

  if (isSupabaseConfigured) {
    const loadFromSupabase = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('handle, account_status')
          .eq('id', userId)
          .maybeSingle()
        if (error || !data) return { handle: '', deactivated: false }
        return {
          handle: cleanHandle(String(data.handle || '')),
          deactivated: isAccountCurrentlyDeactivated(data as Record<string, unknown>),
        }
      } catch {
        return { handle: '', deactivated: false }
      }
    }
    const request = loadFromSupabase()
    accountIdentityCache.set(userId, request)
    return request
  }

  return { handle: '', deactivated: false }
}

export async function resolveUserImage(_userId: string, value: string) {
  return value || ''
}

function imageDimensions(kind: CloudImageKind) {
  if (kind === 'avatar') return { maxWidth: 512, maxHeight: 512 }
  if (kind === 'cover') return { maxWidth: 1400, maxHeight: 500 }
  return { maxWidth: 1000, maxHeight: 1200 }
}

async function compressImage(imageUrl: string, kind: CloudImageKind) {
  if (!imageUrl.startsWith('data:')) return imageUrl
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    if (imageUrl.length <= MAX_MEDIA_DATA_URL_LENGTH) return imageUrl
    throw new Error('This image is too large.')
  }

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const nextImage = new Image()
    nextImage.onload = () => resolve(nextImage)
    nextImage.onerror = () => reject(new Error('The selected image could not be compressed.'))
    nextImage.src = imageUrl
  })
  const limits = imageDimensions(kind)
  let scale = Math.min(1, limits.maxWidth / image.naturalWidth, limits.maxHeight / image.naturalHeight)
  let quality = 0.82
  let compressed = imageUrl

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('This browser cannot prepare the selected image.')
    context.fillStyle = '#17120d'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    compressed = canvas.toDataURL('image/jpeg', quality)
    if (compressed.length <= MAX_MEDIA_DATA_URL_LENGTH) return compressed
    if (quality > 0.5) quality -= 0.08
    else scale *= 0.82
  }

  if (compressed.length > MAX_MEDIA_DATA_URL_LENGTH) {
    throw new Error('This image is still too large after compression. Please choose a smaller file.')
  }
  return compressed
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false
  const proto = Object.getPrototypeOf(value)
  return proto === null || proto === Object.prototype
}

export function withoutUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => withoutUndefined(item)).filter((item) => item !== undefined) as T
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, withoutUndefined(item)]),
    ) as T
  }
  return value
}

export async function saveUserProfile(
  userId: string,
  profile: UserProfileState,
  _options: { markMigrated?: boolean } = {},
) {
  if (!canUseCloudData(userId)) return profile

  const nextHandle = cleanHandle(profile.handle)
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      handle: nextHandle,
      first_name: profile.firstName || '',
      last_name: profile.lastName || '',
      name: `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || nextHandle,
      bio: profile.bio || '',
      avatar_url: profile.avatarUrl || '',
      cover_url: profile.coverUrl || '',
      birthdate: profile.birthday || null,
      is_private: Boolean(profile.isPrivate),
      show_full_name: profile.showFullName !== false,
      allow_comments: profile.allowComments !== false,
      updated_at: new Date().toISOString(),
    })
    if (error) console.error('Error saving user profile in Supabase:', error)
    return { ...profile, handle: nextHandle }
  }

  return { ...profile, handle: nextHandle }
}

export async function reactivateUserAccount(userId: string) {
  if (!canUseCloudData(userId)) return
  if (isSupabaseConfigured) {
    void supabase.from('profiles').update({
      account_status: 'active',
      reactivates_at: null,
      updated_at: new Date().toISOString(),
    }).eq('id', userId)
  }
  accountIdentityCache.delete(userId)
}

export async function loadUserProfile(userId: string, fallbackEmail?: string): Promise<UserProfileState | null> {
  if (!canUseCloudData(userId)) return null

  if (isSupabaseConfigured) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (profile) {
      const { data: sessionData } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }))
      const sessionUser = sessionData?.session?.user
      const email = (sessionUser?.id === userId ? sessionUser.email : fallbackEmail) || fallbackEmail || ''
      return {
        firstName: String(profile.first_name || ''),
        lastName: String(profile.last_name || ''),
        showFullName: profile.show_full_name !== false,
        handle: String(profile.handle || ''),
        email,
        bio: String(profile.bio || ''),
        avatarUrl: cleanImageUrl(profile.avatar_url),
        coverUrl: cleanImageUrl(profile.cover_url),
        createdAt: profile.created_at || new Date().toISOString(),
        birthday: profile.birthdate ? String(profile.birthdate) : undefined,
        lastUsernameChangeDate: undefined,
        showFollowLists: true,
        allowComments: profile.allow_comments !== false,
        isPrivate: Boolean(profile.is_private),
        showSavedActivity: false,
      }
    }
  }

  return null
}

async function writeUserEntries(
  userId: string,
  entries: Entry[],
  disabledCommentEntryIds: string[] = [],
) {
  if (!canUseCloudData(userId)) return

  if (isSupabaseConfigured) {
    const rows = entries.map((entry) => ({
      id: entry.id,
      owner_id: userId,
      type: entry.type,
      title: entry.title,
      creator: entry.creator || '',
      year: entry.year || '',
      genre: entry.genre || '',
      summary: entry.summary || '',
      cover_url: entry.coverUrl || '',
      cover_tone: entry.coverTone || null,
      artwork_url: (entry as any).artworkUrl || entry.coverUrl || '',
      rating: entry.rating || 0,
      quote: (entry as any).quote || '',
      favorite_passage: entry.favoritePassage || '',
      passage_align: entry.passageAlign || 'left',
      reflection: entry.reflection || '',
      reflection_align: entry.reflectionAlign || 'left',
      lyrics: entry.lyrics || '',
      provider: entry.provider || '',
      provider_id: entry.providerId || '',
      enable_drop_cap: Boolean(entry.enableDropCap),
      prefer_wikipedia_artwork: Boolean(entry.preferWikipediaArtwork),
      explicit: Boolean(entry.explicit),
      notable_lines: (entry as any).notableLines || [],
      tags: (entry as any).tags || [],
      visibility: entry.visibility || 'public',
      comments_disabled: disabledCommentEntryIds.includes(entry.id),
      metadata: withoutUndefined({ ...entry }),
      created_at: entry.createdAt,
      updated_at: entry.updatedAt || new Date().toISOString(),
    }))
    if (rows.length > 0) {
      await supabase.from('entries').upsert(rows)
      const currentIds = entries.map((e) => e.id)
      await supabase.from('entries').delete().eq('owner_id', userId).not('id', 'in', `(${currentIds.join(',')})`)
    } else {
      await supabase.from('entries').delete().eq('owner_id', userId)
    }
  }
}

export function saveUserEntries(
  userId: string,
  entries: Entry[],
  disabledCommentEntryIds: string[] = [],
) {
  if (!canUseCloudData(userId)) return Promise.resolve()
  const previous = pendingUserEntryWrites.get(userId) || Promise.resolve()
  const current = previous
    .catch(() => undefined)
    .then(() => writeUserEntries(userId, entries, disabledCommentEntryIds))
  pendingUserEntryWrites.set(userId, current)
  void current.then(
    () => {
      if (pendingUserEntryWrites.get(userId) === current) pendingUserEntryWrites.delete(userId)
    },
    () => {
      if (pendingUserEntryWrites.get(userId) === current) pendingUserEntryWrites.delete(userId)
    },
  )
  return current
}

export async function loadProfileContentViaApi(userIdOrHandle: string): Promise<{
  isContentLocked: boolean
  entries: Entry[]
  collections: ProfileCollection[]
} | null> {
  const token = await getSessionAccessToken()
  const isId = /^[0-9a-f-]{36}$/i.test(userIdOrHandle)
  const param = isId ? `userId=${encodeURIComponent(userIdOrHandle)}` : `handle=${encodeURIComponent(cleanHandle(userIdOrHandle))}`
  try {
    const res = await fetch(`/api/profiles/content?${param}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
    if (res.ok) {
      const data = await res.json()
      return {
        isContentLocked: Boolean(data.isContentLocked),
        entries: Array.isArray(data.entries) ? data.entries : [],
        collections: Array.isArray(data.collections) ? data.collections : [],
      }
    }
  } catch {
    // fallback
  }
  return null
}

export async function loadUserEntries(userId: string): Promise<Entry[]> {
  if (!canUseCloudData(userId)) return []

  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('entries')
      .select('*, profiles:owner_id (*)')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false })
    if (!error && data && data.length > 0) {
      return data.map((row) => mapSupabaseEntryToClientEntry(row))
    }
  }

  // Fallback to server endpoint if direct client query returned 0 rows (handles private profiles where viewer is a follower)
  const serverContent = await loadProfileContentViaApi(userId).catch(() => null)
  if (serverContent && serverContent.entries.length > 0) {
    return serverContent.entries
  }

  return []
}

export async function loadPostEntry(postId: string): Promise<Entry | null> {
  if (isSupabaseConfigured && postId) {
    const { data, error } = await supabase
      .from('entries')
      .select('*, profiles:owner_id (*)')
      .eq('id', postId)
      .maybeSingle()
    if (!error && data) {
      return mapSupabaseEntryToClientEntry(data)
    }
  }

  const token = await getSessionAccessToken()
  if (token && postId) {
    try {
      const res = await fetch(`/api/profiles/entry?id=${encodeURIComponent(postId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const payload = await res.json()
        if (payload?.entry) return payload.entry
      }
    } catch {
      // ignore
    }
  }

  return null
}

export async function saveUserCloudState(userId: string, patch: Partial<UserCloudState>) {
  if (!canUseCloudData(userId)) return
  const updatedAt = new Date().toISOString()
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('user_cloud_state').upsert({
      user_id: userId,
      ...(patch.likedEntryIds ? { liked_entry_ids: patch.likedEntryIds } : {}),
      ...(patch.savedEntryIds ? { saved_entries: patch.savedEntryIds } : {}),
      ...(patch.disabledCommentEntryIds ? { disabled_comment_entry_ids: patch.disabledCommentEntryIds } : {}),
      ...(patch.followedUserHandles ? { followed_user_handles: patch.followedUserHandles } : {}),
      ...(patch.followRequestedHandles ? { follow_requested_handles: patch.followRequestedHandles } : {}),
      updated_at: updatedAt,
    })
    if (error) console.error('Error saving user cloud state in Supabase:', error)
  }
}

export async function setCloudSavedEntry(userId: string, entryId: string, saved: boolean) {
  if (!canUseCloudData(userId)) return
  const state = await loadUserCloudState(userId)
  const set = new Set(state.savedEntryIds)
  if (saved) set.add(entryId)
  else set.delete(entryId)
  await saveUserCloudState(userId, { savedEntryIds: Array.from(set) })
}

export function resolveSavedEntryIds(
  appState: Record<string, unknown>,
  savedActivity: Record<string, unknown>,
) {
  const activityUpdated = dateValueToMillis(savedActivity.updatedAt) || 0
  const stateUpdated = dateValueToMillis(appState.updatedAt) || 0
  if (activityUpdated > stateUpdated && Array.isArray(savedActivity.entryIds)) {
    return removeLegacySeedEntryIds(savedActivity.entryIds as string[])
  }
  if (Array.isArray(appState.savedEntryIds)) {
    return removeLegacySeedEntryIds(appState.savedEntryIds as string[])
  }
  return removeLegacySeedEntryIds(Array.from(new Set([
    ...(Array.isArray(savedActivity.entryIds) ? (savedActivity.entryIds as string[]) : []),
    ...(Array.isArray(appState.savedEntryIds) ? (appState.savedEntryIds as string[]) : []),
  ])))
}

export async function loadUserCloudState(userId: string): Promise<UserCloudState> {
  if (!canUseCloudData(userId)) return DEFAULT_CLOUD_STATE

  if (isSupabaseConfigured) {
    const [{ data, error }, followsRes, requestsRes] = await Promise.all([
      supabase.from('user_cloud_state').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('follows').select('following_id, target_handle').eq('follower_id', userId),
      supabase.from('follow_requests').select('target_id').eq('requester_id', userId).eq('status', 'pending'),
    ])

    const followingIds = (followsRes.data || []).map((r: any) => String(r.following_id || '')).filter(Boolean)
    const requestTargetIds = (requestsRes.data || []).map((r: any) => String(r.target_id || '')).filter(Boolean)

    const idsToResolve = Array.from(new Set([...followingIds, ...requestTargetIds]))
    const profileMap = new Map<string, string>()
    if (idsToResolve.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, handle')
        .in('id', idsToResolve)
      if (profiles) {
        profiles.forEach((p: any) => {
          if (p.id && p.handle) profileMap.set(p.id, cleanHandle(p.handle))
        })
      }
    }

    const authoritativeFollowing = Array.from(new Set([
      ...(followsRes.data || []).map((r: any) => cleanHandle(r.target_handle || '')).filter(Boolean),
      ...followingIds.map((id) => profileMap.get(id) || '').filter(Boolean),
    ]))
    const authoritativeRequested = requestTargetIds.map((id) => profileMap.get(id) || '').filter(Boolean)

    if (!error && data) {
      const rawFollowed = Array.isArray(data.followed_user_handles) ? data.followed_user_handles.map(cleanHandle) : []
      const mergedFollowed = Array.from(new Set([...rawFollowed, ...authoritativeFollowing]))
      const finalRequested = authoritativeRequested.filter((h) => !mergedFollowed.includes(h))

      return {
        likedEntryIds: Array.isArray(data.liked_entry_ids) ? data.liked_entry_ids : [],
        savedEntryIds: Array.isArray(data.saved_entries) ? (data.saved_entries as string[]) : [],
        disabledCommentEntryIds: Array.isArray(data.disabled_comment_entry_ids) ? data.disabled_comment_entry_ids : [],
        followedUserHandles: mergedFollowed,
        followRequestedHandles: finalRequested,
        notifications: [],
      }
    }

    return {
      likedEntryIds: [],
      savedEntryIds: [],
      disabledCommentEntryIds: [],
      followedUserHandles: authoritativeFollowing,
      followRequestedHandles: authoritativeRequested.filter((h) => !authoritativeFollowing.includes(h)),
      notifications: [],
    }
  }

  return DEFAULT_CLOUD_STATE
}

export async function loadOrMigrateUserData(
  userId: string,
  localSnapshot: UserCloudSnapshot,
): Promise<UserCloudSnapshot> {
  if (!canUseCloudData(userId)) return localSnapshot

  if (isSupabaseConfigured) {
    const [profile, entries, state] = await Promise.all([
      loadUserProfile(userId, localSnapshot.profile.email),
      loadUserEntries(userId),
      loadUserCloudState(userId),
    ])
    if (profile) {
      const mergedAvatar = profile.avatarUrl || cleanImageUrl(localSnapshot.profile.avatarUrl) || ''
      const mergedCover = profile.coverUrl || cleanImageUrl(localSnapshot.profile.coverUrl) || ''
      if ((mergedAvatar && !profile.avatarUrl) || (mergedCover && !profile.coverUrl)) {
        void saveUserProfile(userId, { ...profile, avatarUrl: mergedAvatar, coverUrl: mergedCover })
      }
      return {
        profile: {
          ...profile,
          email: profile.email || localSnapshot.profile.email,
          avatarUrl: mergedAvatar,
          coverUrl: mergedCover,
        },
        entries,
        state,
      }
    }
    const [savedProfile] = await Promise.all([
      saveUserProfile(userId, localSnapshot.profile, { markMigrated: false }),
      saveUserEntries(userId, localSnapshot.entries, localSnapshot.state.disabledCommentEntryIds),
      saveUserCloudState(userId, localSnapshot.state),
    ])
    return {
      ...localSnapshot,
      profile: savedProfile,
    }
  }

  return localSnapshot
}

export async function uploadUserImage(
  userId: string,
  kind: CloudImageKind,
  imageUrl: string,
  _fileKey = 'profile',
) {
  if (!canUseCloudData(userId) || !imageUrl) return imageUrl

  if (isSupabaseConfigured) {
    if (!imageUrl.startsWith('data:')) {
      return imageUrl
    }
    try {
      const dataUrl = await compressImage(imageUrl, kind)
      return dataUrl
    } catch {
      return imageUrl
    }
  }

  return imageUrl
}

export async function saveUserCollections(
  userId: string,
  kind: CloudCollectionKind,
  collections: ProfileCollection[],
) {
  if (!canUseCloudData(userId)) return collections

  const normalizedCollections = await Promise.all(collections.map(async (item) => {
    const customCoverUrl = item.customCoverUrl?.startsWith('data:')
      ? await uploadUserImage(userId, 'collection-cover', item.customCoverUrl, `${kind}-${item.id}`)
      : item.customCoverUrl
    return { ...item, customCoverUrl }
  }))

  const rows = normalizedCollections.map((item) => {
    const metaPayload = {
      items: item.items || [],
      types: item.types || [],
      creatorName: item.creatorName,
      creatorHandle: item.creatorHandle,
      coverMode: item.coverMode,
      coverStyle: item.coverStyle,
      spotlightItemId: item.spotlightItemId,
    }
    const cleanDesc = (item.description || '').replace(/\n?<!--tc-meta:[\s\S]*?-->$/, '')
    const packedDesc = `${cleanDesc}\n<!--tc-meta:${JSON.stringify(metaPayload)}-->`
    return {
      id: item.id,
      owner_id: userId,
      kind,
      title: item.name,
      description: packedDesc,
      cover_url: item.customCoverUrl || '',
      visibility: item.isHidden ? 'private' : 'public',
      item_ids: [
        ...new Set([
          ...(item.entryIds || []),
          ...(item.items?.map((it) => it.entryId || it.id).filter(Boolean) || []),
        ]),
      ],
      updated_at: new Date().toISOString(),
    }
  })

  if (rows.length > 0) {
    await supabase.from('collections').upsert(rows)
    const currentIds = collections.map((c) => c.id)
    await supabase.from('collections').delete().eq('owner_id', userId).eq('kind', kind).not('id', 'in', `(${currentIds.join(',')})`)
  } else {
    await supabase.from('collections').delete().eq('owner_id', userId).eq('kind', kind)
  }

  return normalizedCollections
}

export async function loadOrMigrateUserCollections(
  userId: string,
  kind: CloudCollectionKind,
  localCollections: ProfileCollection[],
) {
  if (!canUseCloudData(userId)) return localCollections
  const remoteCollections = await loadUserCollections(userId, kind)
  if (remoteCollections.length === 0 && localCollections.length > 0) {
    return saveUserCollections(userId, kind, localCollections)
  }
  return remoteCollections
}

export async function loadUserCollections(userId: string, kind: CloudCollectionKind) {
  if (!canUseCloudData(userId)) return []

  const { data, error } = await supabase
    .from('collections')
    .select('*')
    .eq('owner_id', userId)
    .eq('kind', kind)

  if (!error && data) {
    const mapped: ProfileCollection[] = data.map((row: any) => {
      let meta: any = {}
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
    })
    return mapped
  }
  return []
}

export async function resolveUserIdByHandle(handle: string) {
  if (isSupabaseConfigured) {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .ilike('handle', cleanHandle(handle))
      .maybeSingle()
    if (data?.id) return data.id
  }
  return null
}

async function loadPublicAccountIdentityById(
  userId: string,
  fallbackHandle = '',
): Promise<PublicAccountIdentity | null> {
  if (isSupabaseConfigured) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (data) {
      const isDeactivated = data.account_status === 'deactivated'
      const name = data.show_full_name === false
        ? String(data.first_name || '')
        : `${String(data.first_name || '')} ${String(data.last_name || '')}`.trim()
      return {
        uid: userId,
        handle: cleanHandle(data.handle || fallbackHandle),
        name: isDeactivated ? DEACTIVATED_ACCOUNT_NAME : name || `@${cleanHandle(data.handle || fallbackHandle)}`,
        avatarUrl: isDeactivated ? '' : (data.avatar_url || ''),
        isPrivate: isDeactivated || Boolean(data.is_private),
        isDeactivated,
      }
    }
  }
  return null
}

export async function loadPublicAccountIdentityByHandle(handle: string): Promise<PublicAccountIdentity | null> {
  const userId = await resolveUserIdByHandle(handle)
  return userId ? loadPublicAccountIdentityById(userId, handle) : null
}

export type ProfileFollowLists = {
  followers: PublicAccountIdentity[]
  following: PublicAccountIdentity[]
}

export const FOLLOWS_CHANGED_EVENT = 'the-commonplace:follows-changed'

export function notifyFollowsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(FOLLOWS_CHANGED_EVENT))
  }
}

export function subscribeProfileFollowLists(
  profileHandle: string,
  onChange: (lists: ProfileFollowLists) => void,
): Unsubscribe {
  let active = true
  let subscriptions: Unsubscribe[] = []
  let followerIds: string[] = []
  let followingIds: string[] = []
  let emission = 0

  const resolveIdentities = async (ids: string[]) => {
    const identities = await Promise.all(ids.map((id) => loadPublicAccountIdentityById(id).catch(() => null)))
    return identities
      .filter((identity): identity is PublicAccountIdentity => Boolean(identity))
      .sort((left, right) => left.name.localeCompare(right.name))
  }

  const emit = () => {
    const currentEmission = ++emission
    void Promise.all([
      resolveIdentities(followerIds),
      resolveIdentities(followingIds),
    ]).then(([followers, following]) => {
      if (active && currentEmission === emission) onChange({ followers, following })
    }).catch((error) => console.error('Unable to load profile follow lists.', error))
  }

  void resolveUserIdByHandle(profileHandle).then((profileId) => {
    if (!active) return
    if (!profileId) {
      onChange({ followers: [], following: [] })
      return
    }

    if (isSupabaseConfigured) {
      const loadLists = async () => {
        try {
          const [followersRes, followingRes] = await Promise.all([
            supabase.from('follows').select('follower_id').eq('following_id', profileId),
            supabase.from('follows').select('following_id').eq('follower_id', profileId),
          ])
          if (!active) return
          followerIds = (followersRes.data || []).map((r: any) => String(r.follower_id || '')).filter(Boolean)
          followingIds = (followingRes.data || []).map((r: any) => String(r.following_id || '')).filter(Boolean)
          emit()
        } catch (err) {
          console.error('Unable to load follow lists from Supabase.', err)
        }
      }
      void loadLists()
      const channel = supabase.channel(`profile-follows:${profileId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'follows' }, () => {
          void loadLists()
        })
        .subscribe()
      subscriptions.push(() => void supabase.removeChannel(channel))

      if (typeof window !== 'undefined') {
        const handleFollowsChanged = () => {
          if (active) void loadLists()
        }
        window.addEventListener(FOLLOWS_CHANGED_EVENT, handleFollowsChanged)
        subscriptions.push(() => window.removeEventListener(FOLLOWS_CHANGED_EVENT, handleFollowsChanged))

        const intervalId = window.setInterval(() => {
          if (active) void loadLists()
        }, 30000)
        subscriptions.push(() => window.clearInterval(intervalId))

        const handleFocus = () => {
          if (active && typeof document !== 'undefined' && document.visibilityState === 'visible') {
            void loadLists()
          }
        }
        window.addEventListener('visibilitychange', handleFocus)
        window.addEventListener('focus', handleFocus)
        subscriptions.push(() => {
          window.removeEventListener('visibilitychange', handleFocus)
          window.removeEventListener('focus', handleFocus)
        })
      }
    }
  }).catch((error) => {
    console.error('Unable to find the profile for follow lists.', error)
    if (active) onChange({ followers: [], following: [] })
  })

  return () => {
    active = false
    subscriptions.forEach((unsubscribe) => unsubscribe())
  }
}

export async function isViewerFollowing(viewerId: string, targetId: string): Promise<boolean> {
  if (!canUseCloudData(viewerId) || !targetId) return false
  if (isSupabaseConfigured) {
    const { data } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', viewerId)
      .eq('following_id', targetId)
      .maybeSingle()
    return Boolean(data)
  }
  return false
}

export async function hasMutualFollow(viewerId: string, targetId: string) {
  if (!canUseCloudData(viewerId) || !targetId) return false
  if (isSupabaseConfigured) {
    const [outgoing, incoming] = await Promise.all([
      supabase.from('follows').select('following_id').eq('follower_id', viewerId).eq('following_id', targetId).maybeSingle(),
      supabase.from('follows').select('follower_id').eq('follower_id', targetId).eq('following_id', viewerId).maybeSingle(),
    ])
    return Boolean(outgoing.data && incoming.data)
  }
  return false
}

export async function loadPublicUserByHandle(handle: string, viewerId?: string | null): Promise<PublicUserData | null> {
  const userId = await resolveUserIdByHandle(handle)
  if (!userId) return null

  if (isSupabaseConfigured) {
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (!profileRow) return null

    const isDeactivated = profileRow.account_status === 'deactivated'
    const cleanResolvedHandle = cleanHandle(String(profileRow.handle || handle))

    if (isDeactivated) {
      return {
        profile: {
          firstName: DEACTIVATED_ACCOUNT_NAME,
          lastName: '',
          showFullName: false,
          handle: cleanResolvedHandle,
          email: '',
          bio: '',
          avatarUrl: '',
          coverUrl: '',
          showFollowLists: false,
          allowComments: false,
          isPrivate: true,
          showSavedActivity: false,
          accountStatus: 'deactivated',
        },
        entries: [],
        collections: [],
        savedEntryIds: [],
        savedCollections: [],
      }
    }

    const isViewer = Boolean(viewerId && viewerId === userId)
    const isPrivate = Boolean(profileRow.is_private)
    const isFollower = isViewer || (viewerId ? await isViewerFollowing(viewerId, userId) : false)
    const isContentLocked = isPrivate && !isFollower

    const publicProfile: UserProfileState = {
      firstName: String(profileRow.first_name || ''),
      lastName: String(profileRow.last_name || ''),
      showFullName: profileRow.show_full_name !== false,
      handle: cleanResolvedHandle,
      email: '',
      bio: String(profileRow.bio || ''),
      avatarUrl: String(profileRow.avatar_url || ''),
      coverUrl: String(profileRow.cover_url || ''),
      createdAt: profileRow.created_at || new Date().toISOString(),
      birthday: profileRow.birthdate ? String(profileRow.birthdate) : undefined,
      showFollowLists: true,
      allowComments: profileRow.allow_comments !== false,
      isPrivate,
      showSavedActivity: false,
    }

    if (isContentLocked) {
      return {
        profile: publicProfile,
        entries: [],
        collections: [],
        savedEntryIds: [],
        savedCollections: [],
        isContentLocked: true,
      }
    }

    let [loadedEntries, collections] = await Promise.all([
      loadUserEntries(userId),
      loadUserCollections(userId, 'created').catch(() => []),
    ])

    if (loadedEntries.length === 0 && (isFollower || !isPrivate)) {
      const serverContent = await loadProfileContentViaApi(userId).catch(() => null)
      if (serverContent && serverContent.entries.length > 0) {
        loadedEntries = serverContent.entries
      }
      if (serverContent && serverContent.collections.length > 0) {
        collections = serverContent.collections
      }
    }
    const ownedCollections = collectionsCreatedByProfile(collections, publicProfile.handle)
    const entries = loadedEntries.map((entry) => ({
      ...entry,
      authorHandle: publicProfile.handle,
      authorName: publicProfile.showFullName === false
        ? publicProfile.firstName
        : `${publicProfile.firstName} ${publicProfile.lastName}`.trim() || `@${publicProfile.handle}`,
      authorAvatarUrl: publicProfile.avatarUrl,
    }))

    return {
      profile: publicProfile,
      entries,
      collections: ownedCollections,
      savedEntryIds: [],
      savedCollections: [],
    }
  }

  return null
}

export async function searchPublicUsers(searchText: string, limit = 12): Promise<PublicUserSummary[]> {
  const normalized = searchText.trim().toLowerCase().replace(/^@/, '')
  if (!normalized) return []

  if (isSupabaseConfigured) {
    const { data } = await supabase
      .from('profiles')
      .select('id, handle, name, first_name, last_name, avatar_url, is_private, account_status')
      .or(`handle.ilike.%${normalized}%,name.ilike.%${normalized}%,first_name.ilike.%${normalized}%,last_name.ilike.%${normalized}%`)
      .neq('account_status', 'deactivated')
      .limit(limit)

    if (!data) return []

    return data.map((row: any) => ({
      uid: row.id,
      handle: row.handle,
      name: row.name || `${row.first_name || ''} ${row.last_name || ''}`.trim() || `@${row.handle}`,
      avatarUrl: row.avatar_url || '',
      isPrivate: Boolean(row.is_private),
    }))
  }

  return []
}

export async function loadPublicFeedEntries(excludedUserId?: string | null): Promise<Entry[]> {
  if (isSupabaseConfigured) {
    let queryBuilder = supabase
      .from('entries')
      .select('*, profiles:owner_id (*)')
    if (excludedUserId) {
      queryBuilder = queryBuilder.neq('owner_id', excludedUserId)
    }
    const { data, error } = await queryBuilder
    if (!error && data && data.length > 0) {
      const publicEntries = data.filter((row: any) => {
        const p = row.profiles
        return (
          p &&
          p.is_private !== true &&
          p.account_status !== 'deactivated' &&
          Boolean(cleanHandle(String(p.handle || '')))
        )
      })
      const entries = publicEntries.map((row: any) => mapSupabaseEntryToClientEntry(row))
      return entries
    }
  }
  return []
}

export async function saveFollowRelationship(
  followerId: string,
  targetHandle: string,
  following: boolean,
  _actor?: { name?: string; handle?: string },
) {
  if (!canUseCloudData(followerId)) return
  const targetId = await resolveUserIdByHandle(targetHandle)
  if (!targetId) return

  if (isSupabaseConfigured) {
    if (following) {
      await supabase.from('follows').upsert({
        follower_id: followerId,
        following_id: targetId,
        target_handle: cleanHandle(targetHandle),
      })
      if (targetId !== followerId) {
        try {
          await supabase.from('notifications').insert({
            id: `follow_${followerId}`,
            recipient_id: targetId,
            actor_id: followerId,
            type: 'follow',
            interaction_id: followerId,
            read: false,
          })
        } catch {
          // ignore notification insert failure
        }
      }
    } else {
      await supabase.from('follows').delete().match({
        follower_id: followerId,
        following_id: targetId,
      })
      if (targetId !== followerId) {
        try {
          await supabase.from('notifications').delete().eq('id', `follow_${followerId}`)
        } catch {
          // ignore notification delete failure
        }
      }
    }
  }
  notifyFollowsChanged()
}

export async function loadMutualFollowers(userId: string): Promise<PublicUserSummary[]> {
  if (!canUseCloudData(userId)) return []
  const [outgoingRes, incomingRes] = await Promise.all([
    supabase.from('follows').select('following_id').eq('follower_id', userId),
    supabase.from('follows').select('follower_id').eq('following_id', userId),
  ])
  const outgoing = new Set((outgoingRes.data || []).map((r: any) => String(r.following_id || '')).filter(Boolean))
  const mutualIds = (incomingRes.data || [])
    .map((r: any) => String(r.follower_id || ''))
    .filter((id) => outgoing.has(id))
  if (mutualIds.length === 0) return []

  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .in('id', mutualIds)

  return (profiles || [])
    .filter((p: any) => p.account_status !== 'deactivated')
    .map((p: any) => ({
      uid: p.id,
      handle: cleanHandle(p.handle || ''),
      name: p.show_full_name === false
        ? String(p.first_name || '')
        : `${String(p.first_name || '')} ${String(p.last_name || '')}`.trim() || `@${cleanHandle(p.handle || '')}`,
      avatarUrl: p.avatar_url || '',
      isPrivate: Boolean(p.is_private),
    }))
    .sort((left, right) => left.name.localeCompare(right.name))
}

export function subscribeMutualFollowIds(
  userId: string,
  onChange: (mutualIds: string[]) => void,
): Unsubscribe {
  if (!canUseCloudData(userId)) {
    onChange([])
    return () => undefined
  }

  if (isSupabaseConfigured) {
    let cancelled = false
    const loadMutuals = async () => {
      try {
        const outgoingRes = await supabase.from('follows').select('following_id').eq('follower_id', userId)
        if (cancelled) return
        const outgoing = (outgoingRes.data || []).map((r: any) => String(r.following_id || '')).filter(Boolean)
        onChange(outgoing)
      } catch (err) {
        console.error('Unable to load follows from Supabase.', err)
      }
    }
    void loadMutuals()
    const channel = supabase.channel(`mutuals:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'follows' }, () => {
        void loadMutuals()
      })
      .subscribe()
    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }

  return () => undefined
}

export async function savePostCommenting(userId: string, postId: string, commentsDisabled: boolean) {
  if (!canUseCloudData(userId)) return
  await supabase
    .from('entries')
    .update({ comments_disabled: commentsDisabled, updated_at: new Date().toISOString() })
    .eq('id', postId)
    .eq('owner_id', userId)
}

export function subscribePostEngagements(
  postIds: string[],
  viewerId: string | null | undefined,
  onChange: (engagements: Record<string, PostEngagement>) => void,
): Unsubscribe {
  const uniquePostIds = Array.from(new Set(postIds.filter(Boolean)))
  if (!isSupabaseConfigured || uniquePostIds.length === 0) {
    onChange({})
    return () => undefined
  }

  const engagements = Object.fromEntries(uniquePostIds.map((postId) => [postId, {
    likeCount: 0,
    commentCount: 0,
    isLiked: false,
  }])) as Record<string, PostEngagement>
  const emit = () => onChange(Object.fromEntries(
    Object.entries(engagements).map(([postId, value]) => [postId, { ...value }]),
  ))

  emit()
  let cancelled = false
  const refresh = async () => {
    try {
      const [likesRes, commentsRes] = await Promise.all([
        supabase.from('entry_likes').select('entry_id, user_id').in('entry_id', uniquePostIds),
        supabase.from('comments').select('entry_id').in('entry_id', uniquePostIds),
      ])
      if (cancelled) return
      const likesByPost = new Map<string, Set<string>>()
      const commentsByPost = new Map<string, number>()
      uniquePostIds.forEach((id) => {
        likesByPost.set(id, new Set())
        commentsByPost.set(id, 0)
      })
      ;(likesRes.data || []).forEach((row: any) => {
        likesByPost.get(row.entry_id)?.add(row.user_id)
      })
      ;(commentsRes.data || []).forEach((row: any) => {
        commentsByPost.set(row.entry_id, (commentsByPost.get(row.entry_id) || 0) + 1)
      })
      uniquePostIds.forEach((id) => {
        const postLikes = likesByPost.get(id) || new Set()
        engagements[id] = {
          likeCount: postLikes.size,
          commentCount: commentsByPost.get(id) || 0,
          isLiked: Boolean(viewerId && postLikes.has(viewerId)),
        }
      })
      emit()
    } catch {}
  }

  void refresh()

  const channel = supabase.channel(`engagements-${Date.now()}-${Math.random()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'entry_likes' }, () => { void refresh() })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => { void refresh() })
    .subscribe()

  return () => {
    cancelled = true
    void supabase.removeChannel(channel)
  }
}

export async function togglePostLike(
  postId: string,
  userId: string,
  liked: boolean,
  _actor: { name?: string; handle?: string },
  _entryTitle: string,
) {
  if (!canUseCloudData(userId)) return
  if (liked) {
    await supabase.from('entry_likes').upsert({
      entry_id: postId,
      user_id: userId,
      created_at: new Date().toISOString(),
    })
    const { data: entry } = await supabase.from('entries').select('owner_id').eq('id', postId).maybeSingle()
    const ownerId = entry?.owner_id
    if (ownerId && ownerId !== userId) {
      try {
        await supabase.from('notifications').insert({
          id: `like_${postId}_${userId}`,
          recipient_id: ownerId,
          actor_id: userId,
          type: 'like',
          entry_id: postId,
          interaction_id: userId,
          read: false,
        })
      } catch {
        // ignore notification failure
      }
    }
  } else {
    await supabase.from('entry_likes').delete().eq('entry_id', postId).eq('user_id', userId)
    try {
      await supabase.from('notifications').delete().eq('id', `like_${postId}_${userId}`)
    } catch {
      // ignore notification failure
    }
  }
}

export function subscribeUserNotifications(
  userId: string,
  onChange: (notifications: AppNotification[]) => void,
): Unsubscribe {
  if (!canUseCloudData(userId)) {
    onChange([])
    return () => undefined
  }

  if (isSupabaseConfigured) {
    let cancelled = false
    const loadNotifications = async () => {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('recipient_id', userId)
          .order('created_at', { ascending: false })
        if (cancelled) return
        if (!error && data) {
          const actorIds = Array.from(new Set(data.map((row: any) => row.actor_id).filter(Boolean)))
          const entryIds = Array.from(new Set(data.map((row: any) => row.entry_id).filter(Boolean)))
          const commentIds = Array.from(new Set(data.map((row: any) => row.comment_id).filter(Boolean)))

          const [profilesRes, entriesRes, commentsRes] = await Promise.all([
            actorIds.length > 0
              ? supabase.from('profiles').select('id, handle, name, first_name, last_name, avatar_url, show_full_name').in('id', actorIds)
              : Promise.resolve({ data: [] }),
            entryIds.length > 0
              ? supabase.from('entries').select('id, title').in('id', entryIds)
              : Promise.resolve({ data: [] }),
            commentIds.length > 0
              ? supabase.from('entry_comments').select('id, content').in('id', commentIds)
              : Promise.resolve({ data: [] }),
          ])
          if (cancelled) return

          const profileMap = new Map<string, { name: string; handle: string; avatarUrl: string }>()
          if (profilesRes.data) {
            profilesRes.data.forEach((p: any) => {
              const handle = cleanHandle(p.handle || '')
              const name = p.show_full_name === false
                ? (String(p.first_name || '').trim() || handle)
                : (String(p.name || '').trim() || `${String(p.first_name || '')} ${String(p.last_name || '')}`.trim() || handle)
              profileMap.set(p.id, {
                name: name || `@${handle}` || 'Someone',
                handle,
                avatarUrl: p.avatar_url || '',
              })
            })
          }

          const entryMap = new Map<string, string>()
          if (entriesRes.data) {
            entriesRes.data.forEach((e: any) => {
              if (e.id && e.title) entryMap.set(e.id, e.title)
            })
          }

          const commentMap = new Map<string, string>()
          if (commentsRes.data) {
            commentsRes.data.forEach((c: any) => {
              if (c.id && c.content) commentMap.set(c.id, c.content)
            })
          }

          const notifications: AppNotification[] = data.map((row: any) => {
            const actor = row.actor_id ? profileMap.get(row.actor_id) : undefined
            const effectiveType =
              row.type === 'follow' && String(row.interaction_id || '').startsWith('follow_request:')
                ? 'follow_request'
                : row.type === 'follow' && String(row.interaction_id || '').startsWith('follow_accept:')
                  ? 'follow_accept'
                  : row.type
            return {
              id: row.id,
              type: effectiveType,
              read: Boolean(row.read),
              createdAt: row.created_at,
              actorId: row.actor_id,
              actorName: actor?.name || row.actor_name || undefined,
              actorHandle: actor?.handle || (row.actor_handle ? cleanHandle(row.actor_handle) : undefined),
              actorAvatarUrl: actor?.avatarUrl || row.actor_avatar_url || undefined,
              postId: row.entry_id,
              entryTitle: (row.entry_id ? entryMap.get(row.entry_id) : undefined) || row.entry_title || undefined,
              commentSnippet: (row.comment_id ? commentMap.get(row.comment_id) : undefined) || row.comment_snippet || undefined,
              interactionId: row.interaction_id,
            }
          })
          onChange(notifications)
        }
      } catch (err) {
        console.error('Unable to load notifications from Supabase.', err)
      }
    }
    void loadNotifications()
    const channel = supabase.channel(`notifications:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userId}` }, () => {
        void loadNotifications()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'follow_requests', filter: `target_id=eq.${userId}` }, () => {
        void loadNotifications()
      })
      .subscribe()

    let removeListeners = () => {}
    if (typeof window !== 'undefined') {
      const handleFollowsChanged = () => {
        if (!cancelled) void loadNotifications()
      }
      window.addEventListener(FOLLOWS_CHANGED_EVENT, handleFollowsChanged)
      const intervalId = window.setInterval(() => {
        if (!cancelled) void loadNotifications()
      }, 12000)
      const handleFocus = () => {
        if (!cancelled && typeof document !== 'undefined' && document.visibilityState === 'visible') {
          void loadNotifications()
        }
      }
      window.addEventListener('visibilitychange', handleFocus)
      window.addEventListener('focus', handleFocus)

      removeListeners = () => {
        window.removeEventListener(FOLLOWS_CHANGED_EVENT, handleFollowsChanged)
        window.clearInterval(intervalId)
        window.removeEventListener('visibilitychange', handleFocus)
        window.removeEventListener('focus', handleFocus)
      }
    }

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
      removeListeners()
    }
  }

  return () => undefined
}

export async function setCloudNotificationsRead(userId: string, notificationIds: string[]) {
  if (!canUseCloudData(userId) || notificationIds.length === 0) return
  if (isSupabaseConfigured) {
    await supabase
      .from('notifications')
      .update({ read: true })
      .in('id', notificationIds)
      .eq('recipient_id', userId)
  }
}

export async function deleteCloudNotifications(userId: string, notificationIds: string[]) {
  if (!canUseCloudData(userId) || notificationIds.length === 0) return
  if (isSupabaseConfigured) {
    await supabase
      .from('notifications')
      .delete()
      .in('id', notificationIds)
      .eq('recipient_id', userId)
  }
}

async function getSessionAccessToken(): Promise<string | null> {
  if (!isSupabaseConfigured) return null
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || null
  } catch {
    return null
  }
}

export async function saveFollowRequest(requesterId: string, targetHandle: string, requested: boolean) {
  if (!canUseCloudData(requesterId)) return
  const token = await getSessionAccessToken()
  if (token) {
    try {
      const res = await fetch('/api/follow-requests/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetHandle, requested }),
      })
      if (res.ok) {
        notifyFollowsChanged()
        return
      }
    } catch {
      // fallback to direct supabase
    }
  }

  const targetId = await resolveUserIdByHandle(targetHandle)
  if (!targetId) return
  if (!requested) {
    await supabase.from('follow_requests').delete().eq('requester_id', requesterId).eq('target_id', targetId)
    if (targetId !== requesterId) {
      try {
        await supabase
          .from('notifications')
          .delete()
          .eq('recipient_id', targetId)
          .eq('actor_id', requesterId)
          .eq('type', 'follow_request')
      } catch {
        // ignore notification delete failure
      }
    }
  } else {
    await supabase.from('follow_requests').upsert({
      requester_id: requesterId,
      target_id: targetId,
      status: 'pending',
    })
    if (targetId !== requesterId) {
      try {
        await supabase
          .from('notifications')
          .delete()
          .eq('recipient_id', targetId)
          .eq('actor_id', requesterId)
          .eq('type', 'follow_request')
        const { error: notifErr } = await supabase.from('notifications').insert({
          id: `follow_req_${requesterId}_${Date.now()}`,
          recipient_id: targetId,
          actor_id: requesterId,
          type: 'follow_request',
          interaction_id: requesterId,
          read: false,
          created_at: new Date().toISOString(),
        })
        if (notifErr && (notifErr.code === '23514' || notifErr.message?.includes('violates check constraint'))) {
          await supabase.from('notifications').insert({
            id: `follow_req_${requesterId}_${Date.now()}`,
            recipient_id: targetId,
            actor_id: requesterId,
            type: 'follow',
            interaction_id: `follow_request:${requesterId}`,
            read: false,
            created_at: new Date().toISOString(),
          })
        }
      } catch {
        // ignore notification insert failure
      }
    }
  }
  notifyFollowsChanged()
}

export async function acceptFollowRequest(targetUserId: string, targetHandle: string, requesterHandle: string) {
  if (!canUseCloudData(targetUserId)) return
  const token = await getSessionAccessToken()
  if (token) {
    try {
      const res = await fetch('/api/follow-requests/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ requesterHandle, targetHandle }),
      })
      if (res.ok) {
        notifyFollowsChanged()
        return
      }
    } catch {
      // fallback to direct supabase
    }
  }

  const requesterId = await resolveUserIdByHandle(requesterHandle)
  if (!requesterId) return
  if (isSupabaseConfigured) {
    await supabase
      .from('follow_requests')
      .delete()
      .eq('requester_id', requesterId)
      .eq('target_id', targetUserId)

    await supabase.from('follows').upsert({
      follower_id: requesterId,
      following_id: targetUserId,
      target_handle: cleanHandle(targetHandle),
    })

    try {
      await supabase
        .from('notifications')
        .delete()
        .eq('recipient_id', targetUserId)
        .eq('actor_id', requesterId)
        .eq('type', 'follow_request')
    } catch {
      // ignore
    }

    try {
      const { error: notifErr } = await supabase.from('notifications').insert({
        id: `follow_accept_${targetUserId}_${Date.now()}`,
        recipient_id: requesterId,
        actor_id: targetUserId,
        type: 'follow_accept',
        interaction_id: targetUserId,
        read: false,
        created_at: new Date().toISOString(),
      })
      if (notifErr && (notifErr.code === '23514' || notifErr.message?.includes('violates check constraint'))) {
        await supabase.from('notifications').insert({
          id: `follow_accept_${targetUserId}_${Date.now()}`,
          recipient_id: requesterId,
          actor_id: targetUserId,
          type: 'follow',
          interaction_id: `follow_accept:${targetUserId}`,
          read: false,
          created_at: new Date().toISOString(),
        })
      }
    } catch {
      // ignore
    }

    try {
      const state = await loadUserCloudState(requesterId)
      const cleanTarget = cleanHandle(targetHandle)
      const nextRequested = state.followRequestedHandles.filter((h) => cleanHandle(h) !== cleanTarget)
      const nextFollowed = Array.from(new Set([...state.followedUserHandles, cleanTarget]))
      await saveUserCloudState(requesterId, {
        followRequestedHandles: nextRequested,
        followedUserHandles: nextFollowed,
      })
    } catch (err) {
      console.error('Error updating requester user_cloud_state in Supabase:', err)
    }
  }
  notifyFollowsChanged()
}

export async function declineFollowRequest(targetUserId: string, requesterHandle: string) {
  if (!canUseCloudData(targetUserId)) return
  const token = await getSessionAccessToken()
  if (token) {
    try {
      const res = await fetch('/api/follow-requests/decline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ requesterHandle }),
      })
      if (res.ok) {
        notifyFollowsChanged()
        return
      }
    } catch {
      // fallback
    }
  }

  const requesterId = await resolveUserIdByHandle(requesterHandle)
  if (!requesterId) return
  if (isSupabaseConfigured) {
    await supabase
      .from('follow_requests')
      .delete()
      .eq('requester_id', requesterId)
      .eq('target_id', targetUserId)

    try {
      await supabase
        .from('notifications')
        .delete()
        .eq('recipient_id', targetUserId)
        .eq('actor_id', requesterId)
        .eq('type', 'follow_request')
    } catch {
      // ignore
    }

    try {
      const { data: targetProfile } = await supabase
        .from('profiles')
        .select('handle')
        .eq('id', targetUserId)
        .maybeSingle()
      const targetHandle = targetProfile?.handle ? cleanHandle(targetProfile.handle) : ''
      if (targetHandle) {
        const state = await loadUserCloudState(requesterId)
        const nextRequested = state.followRequestedHandles.filter((h) => cleanHandle(h) !== targetHandle)
        await saveUserCloudState(requesterId, {
          followRequestedHandles: nextRequested,
        })
      }
    } catch (err) {
      console.error('Error updating requester user_cloud_state in Supabase on decline:', err)
    }
  }
  notifyFollowsChanged()
}

export async function loadIncomingFollowRequestHandles(targetUserId: string): Promise<string[]> {
  if (!canUseCloudData(targetUserId)) return []
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('follow_requests')
      .select('requester_id')
      .eq('target_id', targetUserId)
      .eq('status', 'pending')
    if (!error && data && data.length > 0) {
      const requesterIds = data.map((r: any) => r.requester_id).filter(Boolean)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('handle')
        .in('id', requesterIds)
      if (profiles) {
        return profiles.map((p: any) => cleanHandle(p.handle || '')).filter(Boolean)
      }
    }
  }
  return []
}

export function subscribeUserFollowRelationships(
  userId: string,
  onChange: (data: { followingHandles: string[]; followerHandles: string[]; requestedHandles: string[] }) => void,
): Unsubscribe {
  if (!canUseCloudData(userId)) {
    onChange({ followingHandles: [], followerHandles: [], requestedHandles: [] })
    return () => undefined
  }

  if (isSupabaseConfigured) {
    let cancelled = false
    const reload = async () => {
      try {
        const [followingRes, followersRes, requestsRes] = await Promise.all([
          supabase.from('follows').select('following_id, target_handle').eq('follower_id', userId),
          supabase.from('follows').select('follower_id').eq('following_id', userId),
          supabase.from('follow_requests').select('target_id').eq('requester_id', userId).eq('status', 'pending'),
        ])
        if (cancelled) return

        const followingIds = (followingRes.data || []).map((r: any) => String(r.following_id || '')).filter(Boolean)
        const followerIds = (followersRes.data || []).map((r: any) => String(r.follower_id || '')).filter(Boolean)
        const requestTargetIds = (requestsRes.data || []).map((r: any) => String(r.target_id || '')).filter(Boolean)

        const idsToResolve = Array.from(new Set([...followingIds, ...followerIds, ...requestTargetIds]))
        const profileMap = new Map<string, string>()
        if (idsToResolve.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, handle')
            .in('id', idsToResolve)
          if (profiles) {
            profiles.forEach((p: any) => {
              if (p.id && p.handle) profileMap.set(p.id, cleanHandle(p.handle))
            })
          }
        }

        const followingHandles = Array.from(new Set([
          ...(followingRes.data || []).map((r: any) => cleanHandle(r.target_handle || '')).filter(Boolean),
          ...followingIds.map((id) => profileMap.get(id) || '').filter(Boolean),
        ]))

        const followerHandles = followerIds
          .map((id) => profileMap.get(id) || '')
          .filter(Boolean)

        const requestedHandles = requestTargetIds
          .map((id) => profileMap.get(id) || '')
          .filter(Boolean)

        onChange({
          followingHandles: Array.from(new Set(followingHandles)),
          followerHandles: Array.from(new Set(followerHandles)),
          requestedHandles: Array.from(new Set(requestedHandles)),
        })
      } catch (err) {
        console.error('Error loading follow relationships:', err)
      }
    }

    void reload()

    const channel = supabase.channel(`user-follow-rel:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'follows' }, () => {
        void reload()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'follow_requests' }, () => {
        void reload()
      })
      .subscribe()

    let removeListeners = () => {}
    if (typeof window !== 'undefined') {
      const handleFollowsChanged = () => {
        if (!cancelled) void reload()
      }
      window.addEventListener(FOLLOWS_CHANGED_EVENT, handleFollowsChanged)
      const intervalId = window.setInterval(() => {
        if (!cancelled) void reload()
      }, 30000)
      const handleFocus = () => {
        if (!cancelled && typeof document !== 'undefined' && document.visibilityState === 'visible') {
          void reload()
        }
      }
      window.addEventListener('visibilitychange', handleFocus)
      window.addEventListener('focus', handleFocus)

      removeListeners = () => {
        window.removeEventListener(FOLLOWS_CHANGED_EVENT, handleFollowsChanged)
        window.clearInterval(intervalId)
        window.removeEventListener('visibilitychange', handleFocus)
        window.removeEventListener('focus', handleFocus)
      }
    }

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
      removeListeners()
    }
  }

  return () => undefined
}

export async function submitContentReport(reporterId: string, report: ContentReport) {
  if (!canUseCloudData(reporterId)) throw new Error('Sign in to submit a report.')
  const targetHandle = cleanHandle(report.targetHandle || '')
  const targetId = report.targetType === 'profile'
    ? await resolveUserIdByHandle(targetHandle)
    : report.targetId.trim()
  if (!targetId) throw new Error('This content is no longer available.')
  if ((report.targetType === 'comment' || report.targetType === 'reply') && !report.postId?.trim()) {
    throw new Error('The reported discussion could not be identified.')
  }
  if (report.targetType === 'reply' && !report.parentCommentId?.trim()) {
    throw new Error('The reported reply could not be identified.')
  }
  if (report.targetType === 'profile' && targetId === reporterId) {
    throw new Error('You cannot report your own profile.')
  }
  const reason = report.reason.trim()
  const details = report.details?.trim() || ''
  if (!reason) throw new Error('Choose a reason for your report.')
  if (details.length > 1000) throw new Error('Report details must be 1,000 characters or fewer.')

  const reportId = `report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const { error } = await supabase.from('reports').insert({
    id: reportId,
    reporter_id: reporterId,
    target_type: report.targetType,
    target_id: targetId,
    target_handle: targetHandle,
    post_id: report.postId?.trim() || null,
    parent_comment_id: report.parentCommentId?.trim() || null,
    reason,
    details,
    status: 'pending',
  })
  if (error) throw error
  return reportId
}

export async function loadPostComments(postId: string, viewerId?: string | null): Promise<CloudComment[]> {
  if (!postId) return []
  const [commentsRes, repliesRes] = await Promise.all([
    supabase
      .from('comments')
      .select('*, profiles!author_id(id, handle, name, first_name, last_name, avatar_url, account_status, show_full_name)')
      .eq('entry_id', postId)
      .order('created_at', { ascending: true }),
    supabase
      .from('comment_replies')
      .select('*, profiles!author_id(id, handle, name, first_name, last_name, avatar_url, account_status, show_full_name)')
      .eq('entry_id', postId)
      .order('created_at', { ascending: true }),
  ])

  const commentsData = commentsRes.data || []
  const repliesData = repliesRes.data || []

  const commentIds = commentsData.map((c: any) => c.id)
  const replyIds = repliesData.map((r: any) => r.id)

  const [commentLikesRes, replyLikesRes] = await Promise.all([
    commentIds.length > 0
      ? supabase.from('comment_likes').select('comment_id, user_id').in('comment_id', commentIds)
      : Promise.resolve({ data: [] }),
    replyIds.length > 0
      ? supabase.from('reply_likes').select('reply_id, user_id').in('reply_id', replyIds)
      : Promise.resolve({ data: [] }),
  ])

  const commentLikesMap = new Map<string, Set<string>>()
  ;(commentLikesRes.data || []).forEach((row: any) => {
    if (!commentLikesMap.has(row.comment_id)) commentLikesMap.set(row.comment_id, new Set())
    commentLikesMap.get(row.comment_id)?.add(row.user_id)
  })

  const replyLikesMap = new Map<string, Set<string>>()
  ;(replyLikesRes.data || []).forEach((row: any) => {
    if (!replyLikesMap.has(row.reply_id)) replyLikesMap.set(row.reply_id, new Set())
    replyLikesMap.get(row.reply_id)?.add(row.user_id)
  })

  const repliesByCommentId = new Map<string, CloudCommentReply[]>()
  repliesData.forEach((row: any) => {
    const authorProfile = row.profiles
    const isDeactivated = authorProfile?.account_status === 'deactivated'
    const name = authorProfile?.show_full_name === false
      ? String(authorProfile?.first_name || '')
      : `${String(authorProfile?.first_name || '')} ${String(authorProfile?.last_name || '')}`.trim() || authorProfile?.name || 'Reader'
    const replyLikes = replyLikesMap.get(row.id) || new Set()
    const reply: CloudCommentReply = {
      id: row.id,
      authorId: row.author_id,
      authorHandle: cleanHandle(authorProfile?.handle || ''),
      author: isDeactivated ? DEACTIVATED_ACCOUNT_NAME : name,
      initials: isDeactivated ? 'QR' : name.slice(0, 2).toUpperCase(),
      text: row.text,
      createdAt: row.created_at,
      replyToUserId: row.reply_to_user_id || undefined,
      likesCount: replyLikes.size,
      isLiked: Boolean(viewerId && replyLikes.has(viewerId)),
    }
    if (!repliesByCommentId.has(row.comment_id)) repliesByCommentId.set(row.comment_id, [])
    repliesByCommentId.get(row.comment_id)?.push(reply)
  })

  return commentsData.map((row: any): CloudComment => {
    const authorProfile = row.profiles
    const isDeactivated = authorProfile?.account_status === 'deactivated'
    const name = authorProfile?.show_full_name === false
      ? String(authorProfile?.first_name || '')
      : `${String(authorProfile?.first_name || '')} ${String(authorProfile?.last_name || '')}`.trim() || authorProfile?.name || 'Reader'
    const commentLikes = commentLikesMap.get(row.id) || new Set()
    return {
      id: row.id,
      authorId: row.author_id,
      authorHandle: cleanHandle(authorProfile?.handle || ''),
      author: isDeactivated ? DEACTIVATED_ACCOUNT_NAME : name,
      initials: isDeactivated ? 'QR' : name.slice(0, 2).toUpperCase(),
      text: row.text,
      createdAt: row.created_at,
      likesCount: commentLikes.size,
      isLiked: Boolean(viewerId && commentLikes.has(viewerId)),
      replies: repliesByCommentId.get(row.id) || [],
    }
  })
}

export async function createPostComment(
  postId: string,
  userId: string,
  comment: CloudComment,
  _entryTitle?: string,
) {
  if (!canUseCloudData(userId)) return
  await supabase.from('comments').insert({
    id: comment.id,
    entry_id: postId,
    author_id: userId,
    text: comment.text,
    created_at: comment.createdAt || new Date().toISOString(),
    updated_at: comment.createdAt || new Date().toISOString(),
  })

  const { data: entry } = await supabase.from('entries').select('owner_id').eq('id', postId).maybeSingle()
  const ownerId = entry?.owner_id
  if (ownerId && ownerId !== userId) {
    try {
      await supabase.from('notifications').insert({
        id: `comment_${postId}_${comment.id}`,
        recipient_id: ownerId,
        actor_id: userId,
        type: 'comment',
        entry_id: postId,
        comment_id: comment.id,
        interaction_id: comment.id,
        read: false,
      })
    } catch {
      // ignore notification failure
    }
  }
}

export async function createPostReply(
  postId: string,
  commentId: string,
  userId: string,
  reply: CloudCommentReply,
) {
  if (!canUseCloudData(userId)) return
  const recipientId = reply.replyToUserId || null
  await supabase.from('comment_replies').insert({
    id: reply.id,
    comment_id: commentId,
    entry_id: postId,
    author_id: userId,
    reply_to_user_id: recipientId,
    text: reply.text,
    created_at: reply.createdAt || new Date().toISOString(),
    updated_at: reply.createdAt || new Date().toISOString(),
  })

  if (recipientId && recipientId !== userId) {
    try {
      await supabase.from('notifications').insert({
        id: `reply_${postId}_${commentId}_${reply.id}`,
        recipient_id: recipientId,
        actor_id: userId,
        type: 'reply',
        entry_id: postId,
        comment_id: commentId,
        interaction_id: reply.id,
        read: false,
      })
    } catch {
      // ignore notification failure
    }
  }
}

export async function togglePostCommentLike(
  _postId: string,
  commentId: string,
  userId: string,
  liked: boolean,
) {
  if (!canUseCloudData(userId)) return
  if (liked) {
    await supabase.from('comment_likes').upsert({ comment_id: commentId, user_id: userId })
  } else {
    await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', userId)
  }
}

export async function togglePostReplyLike(
  _postId: string,
  _commentId: string,
  replyId: string,
  userId: string,
  liked: boolean,
) {
  if (!canUseCloudData(userId)) return
  if (liked) {
    await supabase.from('reply_likes').upsert({ reply_id: replyId, user_id: userId })
  } else {
    await supabase.from('reply_likes').delete().eq('reply_id', replyId).eq('user_id', userId)
  }
}

export async function deletePostReply(_postId: string, _commentId: string, replyId: string, userId: string) {
  if (!canUseCloudData(userId)) return
  await supabase.from('comment_replies').delete().eq('id', replyId)
}

export async function deletePostComment(_postId: string, commentId: string, userId: string) {
  if (!canUseCloudData(userId)) return
  await supabase.from('comments').delete().eq('id', commentId)
}
