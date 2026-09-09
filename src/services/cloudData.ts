import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  writeBatch,
  type DocumentReference,
  type Unsubscribe,
  where,
} from 'firebase/firestore'
import { reconcileEntrySnapshots, type Entry } from '../features/entries/model'
import {
  collectionsCreatedByProfile,
  type ProfileCollection,
} from '../features/collections/profileCollections'
import type { AppNotification } from '../types/notification'
import type { UserProfileState } from '../types/userProfile'
import { removeLegacySeedEntryIds } from '../utils/legacySeedCleanup'
import { db, isFirebaseConfigured } from './firebase'

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

const FIRESTORE_MEDIA_PREFIX = 'firestore-media:'
const MAX_MEDIA_DATA_URL_LENGTH = 700_000
const mediaCache = new Map<string, Promise<string>>()
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
  return Boolean(isFirebaseConfigured && userId)
}

function cleanHandle(handle: string) {
  return handle.replace(/^@/, '').trim().toLowerCase()
}

function dateValueToMillis(value: unknown) {
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') {
    return value.toMillis()
  }
  const timestamp = typeof value === 'string' || typeof value === 'number' ? new Date(value).getTime() : Number.NaN
  return Number.isFinite(timestamp) ? timestamp : null
}

export function isAccountCurrentlyDeactivated(data: Record<string, unknown>, now = Date.now()) {
  if (data.accountStatus !== 'deactivated') return false
  const reactivatesAt = dateValueToMillis(data.reactivatesAt)
  return reactivatesAt === null || reactivatesAt > now
}

async function loadAccountIdentity(userId?: string) {
  if (!userId) return { handle: '', deactivated: false }
  const cached = accountIdentityCache.get(userId)
  if (cached) return cached
  const request = getDoc(doc(db, 'users', userId))
    .then((snapshot) => {
      if (!snapshot.exists()) return { handle: '', deactivated: false }
      const data = snapshot.data()
      return {
        handle: cleanHandle(String(data.handle || '')),
        deactivated: isAccountCurrentlyDeactivated(data),
      }
    })
    .catch(() => ({ handle: '', deactivated: false }))
  accountIdentityCache.set(userId, request)
  return request
}

function firestoreDateToIso(value: unknown) {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'toDate' in value) {
    const date = (value as { toDate: () => Date }).toDate()
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
  }
  return undefined
}

function mediaDocumentId(kind: CloudImageKind, fileKey: string) {
  const safeKey = fileKey.replace(/[^a-z0-9_-]/gi, '_').slice(0, 180) || 'image'
  return `${kind}--${safeKey}`
}

function mediaReference(documentId: string) {
  return `${FIRESTORE_MEDIA_PREFIX}${documentId}`
}

function mediaIdFromReference(value: string) {
  return value.startsWith(FIRESTORE_MEDIA_PREFIX)
    ? value.slice(FIRESTORE_MEDIA_PREFIX.length)
    : null
}

function mediaCacheKey(userId: string, documentId: string) {
  return `${userId}/${documentId}`
}

async function resolveUserImage(userId: string, value: string) {
  const documentId = mediaIdFromReference(value)
  if (!documentId) return value
  const cacheKey = mediaCacheKey(userId, documentId)
  let pending = mediaCache.get(cacheKey)
  if (!pending) {
    pending = getDoc(doc(db, 'users', userId, 'media', documentId))
      .then((snapshot) => snapshot.exists() ? String(snapshot.data().dataUrl || '') : '')
      .catch(() => '')
    mediaCache.set(cacheKey, pending)
  }
  return pending
}

function imageDimensions(kind: CloudImageKind) {
  if (kind === 'avatar') return { maxWidth: 512, maxHeight: 512 }
  if (kind === 'cover') return { maxWidth: 1400, maxHeight: 500 }
  return { maxWidth: 1000, maxHeight: 1200 }
}

async function compressImageForFirestore(imageUrl: string, kind: CloudImageKind) {
  if (!imageUrl.startsWith('data:')) return imageUrl
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    if (imageUrl.length <= MAX_MEDIA_DATA_URL_LENGTH) return imageUrl
    throw new Error('This image is too large for the Firestore image limit.')
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

function withoutUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => withoutUndefined(item)).filter((item) => item !== undefined) as T
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, withoutUndefined(item)]),
    ) as T
  }
  return value
}

async function replaceDocuments(
  existingRefs: DocumentReference[],
  records: Array<{ ref: DocumentReference; data: Record<string, unknown> }>,
) {
  const nextPaths = new Set(records.map((record) => record.ref.path))
  const operations: Array<
    | { type: 'delete'; ref: DocumentReference }
    | { type: 'set'; ref: DocumentReference; data: Record<string, unknown> }
  > = [
    ...existingRefs
      .filter((existingRef) => !nextPaths.has(existingRef.path))
      .map((existingRef) => ({ type: 'delete' as const, ref: existingRef })),
    ...records.map((record) => ({ type: 'set' as const, ...record })),
  ]

  for (let index = 0; index < operations.length; index += 400) {
    const batch = writeBatch(db)
    operations.slice(index, index + 400).forEach((operation) => {
      if (operation.type === 'delete') batch.delete(operation.ref)
      else batch.set(operation.ref, withoutUndefined(operation.data))
    })
    await batch.commit()
  }
}

export async function saveUserProfile(
  userId: string,
  profile: UserProfileState,
  options: { markMigrated?: boolean } = {},
) {
  if (!canUseCloudData(userId)) return profile

  const userRef = doc(db, 'users', userId)
  const nextHandle = cleanHandle(profile.handle)
  const {
    email,
    birthday,
    createdAt: _createdAt,
    accountStatus: _accountStatus,
    ...publicProfile
  } = profile
  void _createdAt
  void _accountStatus

  await runTransaction(db, async (transaction) => {
    const nextHandleRef = doc(db, 'handles', nextHandle)
    const [existing, nextHandleSnapshot] = await Promise.all([
      transaction.get(userRef),
      transaction.get(nextHandleRef),
    ])
    const previousHandle = existing.exists() ? cleanHandle(String(existing.data().handle || '')) : ''
    const existingHandleOwner = nextHandleSnapshot.exists() ? String(nextHandleSnapshot.data().uid || '') : ''
    if (existingHandleOwner && existingHandleOwner !== userId) {
      throw new Error('That username is already in use.')
    }

    transaction.set(userRef, withoutUndefined({
      ...publicProfile,
      handle: nextHandle,
      ...(!existing.exists() || !existing.data().createdAt ? { createdAt: serverTimestamp() } : {}),
      migrationVersion: options.markMigrated === false ? 0 : CLOUD_MIGRATION_VERSION,
      updatedAt: new Date().toISOString(),
    }), { merge: true })
    transaction.set(doc(db, 'users', userId, 'private', 'settings'), withoutUndefined({
      email,
      birthday,
      lastUsernameChangeDate: profile.lastUsernameChangeDate,
      updatedAt: new Date().toISOString(),
    }), { merge: true })
    transaction.set(nextHandleRef, {
      uid: userId,
      handle: nextHandle,
      ...(!nextHandleSnapshot.exists() || !nextHandleSnapshot.data().createdAt
        ? { createdAt: serverTimestamp() }
        : {}),
      updatedAt: new Date().toISOString(),
    })
    if (previousHandle && previousHandle !== nextHandle) {
      transaction.delete(doc(db, 'handles', previousHandle))
    }
  })

  const [avatarUrl, coverUrl] = await Promise.all([
    resolveUserImage(userId, profile.avatarUrl),
    resolveUserImage(userId, profile.coverUrl),
  ])
  return { ...profile, handle: nextHandle, avatarUrl, coverUrl }
}

export async function reactivateUserAccount(userId: string) {
  if (!canUseCloudData(userId)) return
  await setDoc(doc(db, 'users', userId), {
    accountStatus: 'active',
    reactivatedAt: serverTimestamp(),
    updatedAt: new Date().toISOString(),
  }, { merge: true })
  accountIdentityCache.delete(userId)
}

export async function loadUserProfile(userId: string): Promise<UserProfileState | null> {
  if (!canUseCloudData(userId)) return null
  const [publicSnapshot, privateSnapshot] = await Promise.all([
    getDoc(doc(db, 'users', userId)),
    getDoc(doc(db, 'users', userId, 'private', 'settings')),
  ])
  if (!publicSnapshot.exists()) return null

  const publicData = publicSnapshot.data()
  const privateData = privateSnapshot.exists() ? privateSnapshot.data() : {}
  const [avatarUrl, coverUrl] = await Promise.all([
    resolveUserImage(userId, String(publicData.avatarUrl || '')),
    resolveUserImage(userId, String(publicData.coverUrl || '')),
  ])
  return {
    firstName: String(publicData.firstName || ''),
    lastName: String(publicData.lastName || ''),
    showFullName: publicData.showFullName !== false,
    handle: String(publicData.handle || ''),
    email: String(privateData.email || ''),
    bio: String(publicData.bio || ''),
    avatarUrl,
    coverUrl,
    createdAt: firestoreDateToIso(publicData.createdAt),
    birthday: privateData.birthday ? String(privateData.birthday) : undefined,
    lastUsernameChangeDate: privateData.lastUsernameChangeDate
      ? String(privateData.lastUsernameChangeDate)
      : undefined,
    showFollowLists: publicData.showFollowLists !== false,
    allowComments: publicData.allowComments !== false,
    isPrivate: Boolean(publicData.isPrivate),
    showSavedActivity: Boolean(publicData.showSavedActivity),
  }
}

async function writeUserEntries(
  userId: string,
  entries: Entry[],
  disabledCommentEntryIds: string[] = [],
) {
  if (!canUseCloudData(userId)) return
  const entriesRef = collection(db, 'users', userId, 'entries')
  const existing = await getDocs(entriesRef)
  const existingPostSnapshots = await Promise.all(
    existing.docs.map((entry) => getDoc(doc(db, 'posts', entry.id))),
  )
  const existingPostRefs = existingPostSnapshots.filter((item) => item.exists()).map((item) => item.ref)
  await replaceDocuments(
    [...existing.docs.map((entry) => entry.ref), ...existingPostRefs],
    entries.flatMap((entry) => {
      const storedEntry = {
        ...entry,
        authorAvatarUrl: entry.authorAvatarUrl?.startsWith('data:')
          ? mediaReference(mediaDocumentId('avatar', 'profile'))
          : entry.authorAvatarUrl,
      }
      return [{
        ref: doc(entriesRef, entry.id),
        data: withoutUndefined({ ...storedEntry, ownerId: userId }),
      },
      {
        ref: doc(db, 'posts', entry.id),
        data: {
          ownerId: userId,
          authorHandle: cleanHandle(entry.authorHandle || ''),
          entryTitle: entry.title,
          commentsDisabled: disabledCommentEntryIds.includes(entry.id),
          updatedAt: entry.updatedAt || entry.createdAt,
        },
      }]
    }),
  )
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

export async function loadUserEntries(userId: string): Promise<Entry[]> {
  if (!canUseCloudData(userId)) return []
  const snapshot = await getDocs(collection(db, 'users', userId, 'entries'))
  const entries = await Promise.all(snapshot.docs.map(async (entry) => {
    const data = entry.data() as Entry
    return {
      ...data,
      authorAvatarUrl: data.authorAvatarUrl
        ? await resolveUserImage(userId, data.authorAvatarUrl)
        : data.authorAvatarUrl,
    }
  }))
  return entries
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}

export async function loadPostEntry(postId: string): Promise<Entry | null> {
  if (!isFirebaseConfigured || !postId) return null
  const postSnapshot = await getDoc(doc(db, 'posts', postId))
  if (!postSnapshot.exists()) return null

  const ownerId = String(postSnapshot.data().ownerId || '')
  if (!ownerId) return null
  const [entrySnapshot, profileSnapshot] = await Promise.all([
    getDoc(doc(db, 'users', ownerId, 'entries', postId)),
    getDoc(doc(db, 'users', ownerId)),
  ])
  if (!entrySnapshot.exists()) return null

  const entry = entrySnapshot.data() as Entry
  const profile = profileSnapshot.exists() ? profileSnapshot.data() : undefined
  const authorHandle = cleanHandle(String(profile?.handle || entry.authorHandle || ''))
  const authorName = profile
    ? profile.showFullName === false
      ? String(profile.firstName || '')
      : `${String(profile.firstName || '')} ${String(profile.lastName || '')}`.trim()
    : entry.authorName
  const avatarReference = String(profile?.avatarUrl || entry.authorAvatarUrl || '')

  return {
    ...entry,
    ownerId,
    authorHandle,
    authorName: authorName || entry.authorName || (authorHandle ? `@${authorHandle}` : undefined),
    authorAvatarUrl: avatarReference
      ? await resolveUserImage(ownerId, avatarReference)
      : avatarReference,
  }
}

export async function saveUserCloudState(userId: string, patch: Partial<UserCloudState>) {
  if (!canUseCloudData(userId)) return
  const updatedAt = new Date().toISOString()
  const writes: Promise<void>[] = [
    setDoc(
      doc(db, 'users', userId, 'private', 'app-state'),
      withoutUndefined({ ...patch, updatedAt }),
      { merge: true },
    ),
  ]
  if (patch.savedEntryIds) {
    writes.push(setDoc(doc(db, 'users', userId, 'activity', 'saved'), {
      ownerId: userId,
      entryIds: patch.savedEntryIds,
      updatedAt,
    }))
  }
  await Promise.all(writes)
}

export async function setCloudSavedEntry(userId: string, entryId: string, saved: boolean) {
  if (!canUseCloudData(userId)) return
  const updatedAt = new Date().toISOString()
  const savedEntryTransform = saved ? arrayUnion(entryId) : arrayRemove(entryId)
  await Promise.all([
    setDoc(doc(db, 'users', userId, 'private', 'app-state'), {
      savedEntryIds: savedEntryTransform,
      updatedAt,
    }, { merge: true }),
    setDoc(doc(db, 'users', userId, 'activity', 'saved'), {
      ownerId: userId,
      entryIds: savedEntryTransform,
      updatedAt,
    }, { merge: true }),
  ])
}

export function resolveSavedEntryIds(
  appState: Record<string, unknown>,
  savedActivity: Record<string, unknown>,
) {
  const appStateIds = Array.isArray(appState.savedEntryIds) ? appState.savedEntryIds : null
  const activityIds = Array.isArray(savedActivity.entryIds) ? savedActivity.entryIds : null
  const activityIsNewest = String(savedActivity.updatedAt || '') >= String(appState.updatedAt || '')
  const selected = activityIds && (!appStateIds || activityIsNewest) ? activityIds : appStateIds
  return Array.isArray(selected)
    ? removeLegacySeedEntryIds(selected.filter((value): value is string => typeof value === 'string'))
    : []
}

export async function loadUserCloudState(userId: string): Promise<UserCloudState> {
  if (!canUseCloudData(userId)) return DEFAULT_CLOUD_STATE
  const [snapshot, savedActivitySnapshot] = await Promise.all([
    getDoc(doc(db, 'users', userId, 'private', 'app-state')),
    getDoc(doc(db, 'users', userId, 'activity', 'saved')),
  ])
  if (!snapshot.exists() && !savedActivitySnapshot.exists()) return DEFAULT_CLOUD_STATE
  const data = snapshot.exists() ? snapshot.data() : {}
  const savedActivity = savedActivitySnapshot.exists() ? savedActivitySnapshot.data() : {}
  return {
    likedEntryIds: Array.isArray(data.likedEntryIds) ? data.likedEntryIds : [],
    savedEntryIds: resolveSavedEntryIds(data, savedActivity),
    disabledCommentEntryIds: Array.isArray(data.disabledCommentEntryIds) ? data.disabledCommentEntryIds : [],
    followedUserHandles: Array.isArray(data.followedUserHandles) ? data.followedUserHandles : [],
    followRequestedHandles: Array.isArray(data.followRequestedHandles) ? data.followRequestedHandles : [],
    notifications: Array.isArray(data.notifications) ? data.notifications : [],
  }
}

export async function loadOrMigrateUserData(
  userId: string,
  localSnapshot: UserCloudSnapshot,
): Promise<UserCloudSnapshot> {
  if (!canUseCloudData(userId)) return localSnapshot
  const userSnapshot = await getDoc(doc(db, 'users', userId))

  if (userSnapshot.exists() && !userSnapshot.data().createdAt) {
    await setDoc(doc(db, 'users', userId), { createdAt: serverTimestamp() }, { merge: true })
  }

  if (!userSnapshot.exists() || Number(userSnapshot.data().migrationVersion || 0) < CLOUD_MIGRATION_VERSION) {
    const existingSnapshot = userSnapshot.exists()
      ? await Promise.all([
          loadUserProfile(userId),
          loadUserEntries(userId),
          loadUserCloudState(userId),
        ]).then(([profile, entries, state]) => profile ? { profile, entries, state } : null)
      : null
    const migrationSource = existingSnapshot
      ? mergeMigrationSnapshots(existingSnapshot, localSnapshot)
      : localSnapshot
    const [avatarUrl, coverUrl] = await Promise.all([
      uploadUserImage(userId, 'avatar', migrationSource.profile.avatarUrl),
      uploadUserImage(userId, 'cover', migrationSource.profile.coverUrl),
    ])
    const migratedProfile = { ...migrationSource.profile, avatarUrl, coverUrl }
    const [savedProfile] = await Promise.all([
      saveUserProfile(userId, migratedProfile, { markMigrated: false }),
      saveUserEntries(userId, migrationSource.entries, migrationSource.state.disabledCommentEntryIds),
      saveUserCloudState(userId, migrationSource.state),
    ])
    await setDoc(doc(db, 'users', userId), {
      migrationVersion: CLOUD_MIGRATION_VERSION,
      migratedAt: new Date().toISOString(),
    }, { merge: true })
    return { ...migrationSource, profile: savedProfile }
  }

  const [profile, entries, state] = await Promise.all([
    loadUserProfile(userId),
    loadUserEntries(userId),
    loadUserCloudState(userId),
  ])
  return {
    profile: profile || localSnapshot.profile,
    entries,
    state,
  }
}

export async function uploadUserImage(
  userId: string,
  kind: CloudImageKind,
  imageUrl: string,
  fileKey = 'profile',
) {
  if (!canUseCloudData(userId)) return imageUrl
  const documentId = mediaDocumentId(kind, fileKey)
  const mediaRef = doc(db, 'users', userId, 'media', documentId)
  const cacheKey = mediaCacheKey(userId, documentId)
  const existing = await getDoc(mediaRef)

  if (!imageUrl.startsWith('data:')) {
    if (existing.exists()) await deleteDoc(mediaRef)
    mediaCache.delete(cacheKey)
    return imageUrl
  }

  if (existing.exists() && String(existing.data().dataUrl || '') === imageUrl) {
    mediaCache.set(cacheKey, Promise.resolve(imageUrl))
    return mediaReference(documentId)
  }

  const dataUrl = await compressImageForFirestore(imageUrl, kind)
  await setDoc(mediaRef, {
    ownerId: userId,
    kind,
    dataUrl,
    characterCount: dataUrl.length,
    updatedAt: new Date().toISOString(),
  })
  mediaCache.set(cacheKey, Promise.resolve(dataUrl))
  return mediaReference(documentId)
}

function collectionName(kind: CloudCollectionKind) {
  return kind === 'created' ? 'collections' : 'saved-collections'
}

async function resolveCollectionImages(userId: string, collections: ProfileCollection[]) {
  return Promise.all(collections.map(async (item) => ({
    ...item,
    customCoverUrl: item.customCoverUrl
      ? await resolveUserImage(userId, item.customCoverUrl)
      : item.customCoverUrl,
  })))
}

export async function saveUserCollections(
  userId: string,
  kind: CloudCollectionKind,
  collections: ProfileCollection[],
) {
  if (!canUseCloudData(userId)) return collections
  const collectionsRef = collection(db, 'users', userId, collectionName(kind))
  const existing = await getDocs(collectionsRef)
  const normalizedCollections = await Promise.all(collections.map(async (item) => {
    const customCoverUrl = item.customCoverUrl?.startsWith('data:')
      ? await uploadUserImage(userId, 'collection-cover', item.customCoverUrl, `${kind}-${item.id}`)
      : item.customCoverUrl
    return { ...item, customCoverUrl }
  }))

  await replaceDocuments(
    existing.docs.map((item) => item.ref),
    normalizedCollections.map((item) => ({
      ref: doc(collectionsRef, item.id),
      data: withoutUndefined({ ...item, ownerId: userId, updatedAt: new Date().toISOString() }),
    })),
  )

  const usedMediaIds = new Set(normalizedCollections.flatMap((item) => {
    const mediaId = mediaIdFromReference(item.customCoverUrl || '')
    return mediaId ? [mediaId] : []
  }))
  const unusedMediaIds = new Set(existing.docs.flatMap((item) => {
    const mediaId = mediaIdFromReference(String(item.data().customCoverUrl || ''))
    return mediaId && !usedMediaIds.has(mediaId) ? [mediaId] : []
  }))
  await Promise.all([...unusedMediaIds].map(async (mediaId) => {
    const mediaRef = doc(db, 'users', userId, 'media', mediaId)
    const mediaSnapshot = await getDoc(mediaRef)
    if (mediaSnapshot.exists()) await deleteDoc(mediaRef)
    mediaCache.delete(mediaCacheKey(userId, mediaId))
  }))
  return resolveCollectionImages(userId, normalizedCollections)
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
  const snapshot = await getDocs(collection(db, 'users', userId, collectionName(kind)))
  return resolveCollectionImages(userId, snapshot.docs.map((item) => item.data() as ProfileCollection))
}

export async function resolveUserIdByHandle(handle: string) {
  if (!isFirebaseConfigured) return null
  const snapshot = await getDoc(doc(db, 'handles', cleanHandle(handle)))
  return snapshot.exists() ? String(snapshot.data().uid || '') || null : null
}

async function loadPublicAccountIdentityById(
  userId: string,
  fallbackHandle = '',
): Promise<PublicAccountIdentity | null> {
  const userSnapshot = await getDoc(doc(db, 'users', userId))
  if (!userSnapshot.exists()) return null
  const data = userSnapshot.data()
  const resolvedHandle = cleanHandle(String(data.handle || fallbackHandle))
  if (!resolvedHandle) return null
  const isDeactivated = isAccountCurrentlyDeactivated(data)
  const name = data.showFullName === false
    ? String(data.firstName || '')
    : `${String(data.firstName || '')} ${String(data.lastName || '')}`.trim()
  return {
    uid: userId,
    handle: resolvedHandle,
    name: isDeactivated ? DEACTIVATED_ACCOUNT_NAME : name || `@${resolvedHandle}`,
    avatarUrl: isDeactivated ? '' : await resolveUserImage(userId, String(data.avatarUrl || '')),
    isPrivate: isDeactivated || Boolean(data.isPrivate),
    isDeactivated,
  }
}

export async function loadPublicAccountIdentityByHandle(handle: string): Promise<PublicAccountIdentity | null> {
  if (!isFirebaseConfigured) return null
  const userId = await resolveUserIdByHandle(handle)
  return userId ? loadPublicAccountIdentityById(userId, handle) : null
}

export type ProfileFollowLists = {
  followers: PublicAccountIdentity[]
  following: PublicAccountIdentity[]
}

export function subscribeProfileFollowLists(
  profileHandle: string,
  onChange: (lists: ProfileFollowLists) => void,
): Unsubscribe {
  if (!isFirebaseConfigured) {
    onChange({ followers: [], following: [] })
    return () => undefined
  }

  let active = true
  let subscriptions: Unsubscribe[] = []
  let followersLoaded = false
  let followingLoaded = false
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
    if (!followersLoaded || !followingLoaded) return
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
    const followsRef = collection(db, 'follows')
    subscriptions = [
      onSnapshot(query(followsRef, where('followingId', '==', profileId)), (snapshot) => {
        followerIds = snapshot.docs.map((item) => String(item.data().followerId || '')).filter(Boolean)
        followersLoaded = true
        emit()
      }, (error) => console.error('Unable to watch profile followers.', error)),
      onSnapshot(query(followsRef, where('followerId', '==', profileId)), (snapshot) => {
        followingIds = snapshot.docs.map((item) => String(item.data().followingId || '')).filter(Boolean)
        followingLoaded = true
        emit()
      }, (error) => console.error('Unable to watch profile following.', error)),
    ]
  }).catch((error) => {
    console.error('Unable to find the profile for follow lists.', error)
    if (active) onChange({ followers: [], following: [] })
  })

  return () => {
    active = false
    subscriptions.forEach((unsubscribe) => unsubscribe())
  }
}

export async function hasMutualFollow(viewerId: string, targetId: string) {
  if (!canUseCloudData(viewerId) || !targetId) return false
  const [outgoing, incoming] = await Promise.all([
    getDoc(doc(db, 'follows', `${viewerId}_${targetId}`)),
    getDoc(doc(db, 'follows', `${targetId}_${viewerId}`)),
  ])
  return outgoing.exists() && incoming.exists()
}

export async function loadPublicUserByHandle(handle: string, viewerId?: string | null): Promise<PublicUserData | null> {
  if (!isFirebaseConfigured) return null
  const userId = await resolveUserIdByHandle(handle)
  if (!userId) return null
  const userSnapshot = await getDoc(doc(db, 'users', userId))
  if (!userSnapshot.exists()) return null

  const data = userSnapshot.data()
  if (isAccountCurrentlyDeactivated(data)) {
    return {
      profile: {
        firstName: DEACTIVATED_ACCOUNT_NAME,
        lastName: '',
        showFullName: false,
        handle: cleanHandle(String(data.handle || handle)),
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
  const [avatarUrl, coverUrl] = await Promise.all([
    resolveUserImage(userId, String(data.avatarUrl || '')),
    resolveUserImage(userId, String(data.coverUrl || '')),
  ])
  let createdAt = firestoreDateToIso(data.createdAt)
  if (!createdAt) {
    const handleSnapshot = await getDoc(doc(db, 'handles', cleanHandle(String(data.handle || handle)))).catch(() => null)
    createdAt = handleSnapshot?.exists() ? firestoreDateToIso(handleSnapshot.data().createdAt) : undefined
  }
  const profile: UserProfileState = {
    firstName: String(data.firstName || ''),
    lastName: String(data.lastName || ''),
    showFullName: data.showFullName !== false,
    handle: String(data.handle || cleanHandle(handle)),
    email: '',
    bio: String(data.bio || ''),
    avatarUrl,
    coverUrl,
    createdAt,
    showFollowLists: data.showFollowLists !== false,
    allowComments: data.allowComments !== false,
    isPrivate: Boolean(data.isPrivate),
    showSavedActivity: Boolean(data.showSavedActivity),
  }

  const isContentLocked = Boolean(profile.isPrivate && (
    !viewerId || (viewerId !== userId && !await hasMutualFollow(viewerId, userId))
  ))
  if (isContentLocked) {
    return {
      profile,
      entries: [],
      collections: [],
      savedEntryIds: [],
      savedCollections: [],
      isContentLocked: true,
    }
  }

  const [loadedEntries, collections] = await Promise.all([
    loadUserEntries(userId).catch(() => []),
    loadUserCollections(userId, 'created').catch(() => []),
  ])
  const ownedCollections = collectionsCreatedByProfile(collections, profile.handle)
  const entries = loadedEntries.map((entry) => ({
    ...entry,
    authorHandle: profile.handle,
    authorAvatarUrl: profile.avatarUrl,
  }))
  if (!profile.showSavedActivity) {
    return { profile, entries, collections: ownedCollections, savedEntryIds: [], savedCollections: [] }
  }

  const [savedActivity, savedCollections] = await Promise.all([
    getDoc(doc(db, 'users', userId, 'activity', 'saved')).catch(() => null),
    loadUserCollections(userId, 'saved').catch(() => []),
  ])
  return {
    profile,
    entries,
    collections: ownedCollections,
    savedEntryIds: savedActivity?.exists() && Array.isArray(savedActivity.data().entryIds)
      ? savedActivity.data().entryIds
      : [],
    savedCollections,
  }
}

export async function searchPublicUsers(searchText: string, limit = 12): Promise<PublicUserSummary[]> {
  if (!isFirebaseConfigured) return []
  const normalized = searchText.replace(/^@/, '').trim().toLowerCase()
  if (!normalized) return []
  const snapshot = await getDocs(collection(db, 'users'))
  const matches = snapshot.docs
    .map((userDocument) => ({ uid: userDocument.id, data: userDocument.data() }))
    .filter(({ data }) => !isAccountCurrentlyDeactivated(data))
    .filter(({ data }) => {
      const handle = cleanHandle(String(data.handle || ''))
      const fullName = `${String(data.firstName || '')} ${String(data.lastName || '')}`.trim().toLowerCase()
      return handle.includes(normalized) || fullName.includes(normalized)
    })
    .slice(0, limit)

  return Promise.all(matches.map(async ({ uid, data }) => {
    const handle = cleanHandle(String(data.handle || ''))
    const fullName = data.showFullName === false
      ? String(data.firstName || '')
      : `${String(data.firstName || '')} ${String(data.lastName || '')}`.trim()
    return {
      uid,
      handle,
      name: fullName || `@${handle}`,
      avatarUrl: await resolveUserImage(uid, String(data.avatarUrl || '')),
      isPrivate: Boolean(data.isPrivate),
    }
  }))
}

export async function loadPublicFeedEntries(excludedUserId?: string | null): Promise<Entry[]> {
  if (!isFirebaseConfigured) return []
  const snapshot = await getDocs(collection(db, 'users'))
  const publicUsers = snapshot.docs.filter((userDocument) => (
    userDocument.id !== excludedUserId
      && userDocument.data().isPrivate !== true
      && !isAccountCurrentlyDeactivated(userDocument.data())
      && Boolean(cleanHandle(String(userDocument.data().handle || '')))
  ))
  const entriesByUser = await Promise.all(publicUsers.map(async (userDocument) => {
    const data = userDocument.data()
    const handle = cleanHandle(String(data.handle || ''))
    const authorName = data.showFullName === false
      ? String(data.firstName || '')
      : `${String(data.firstName || '')} ${String(data.lastName || '')}`.trim()
    const avatarUrl = await resolveUserImage(userDocument.id, String(data.avatarUrl || ''))
    const entries = await loadUserEntries(userDocument.id).catch(() => [])
    return entries.map((entry) => ({
      ...entry,
      authorHandle: handle,
      authorName: authorName || `@${handle}`,
      authorAvatarUrl: avatarUrl,
    }))
  }))
  return entriesByUser.flat()
}

export async function saveFollowRelationship(
  followerId: string,
  targetHandle: string,
  following: boolean,
  actor: { name?: string; handle?: string } = {},
) {
  if (!canUseCloudData(followerId)) return
  const targetId = await resolveUserIdByHandle(targetHandle)
  if (!targetId) return
  const followRef = doc(db, 'follows', `${followerId}_${targetId}`)
  const notificationRef = doc(db, 'users', targetId, 'notifications', `follow_${followerId}`)
  if (!following) {
    await deleteDoc(followRef)
    if (targetId !== followerId) {
      try {
        await deleteDoc(notificationRef)
      } catch (error) {
        console.error('The follow was removed, but its notification could not be removed.', error)
      }
    }
    return
  }
  const createdAt = new Date().toISOString()
  await setDoc(followRef, {
    followerId,
    followingId: targetId,
    targetHandle: cleanHandle(targetHandle),
    createdAt,
  })
  if (targetId !== followerId) {
    try {
      await setDoc(notificationRef, withoutUndefined({
        recipientId: targetId,
        actorId: followerId,
        type: 'follow',
        interactionId: followerId,
        read: false,
        createdAt,
        actorName: actor.name,
        actorHandle: cleanHandle(actor.handle || ''),
      }))
    } catch (error) {
      console.error('The follow was saved, but its notification could not be created.', error)
    }
  }
}

export async function loadMutualFollowers(userId: string): Promise<PublicUserSummary[]> {
  if (!canUseCloudData(userId)) return []
  const followsRef = collection(db, 'follows')
  const [outgoing, incoming] = await Promise.all([
    getDocs(query(followsRef, where('followerId', '==', userId))),
    getDocs(query(followsRef, where('followingId', '==', userId))),
  ])
  const followerIds = new Set(incoming.docs.map((item) => String(item.data().followerId || '')))
  const mutualIds = Array.from(new Set(outgoing.docs
    .map((item) => String(item.data().followingId || ''))
    .filter((followingId) => followingId && followerIds.has(followingId))))

  const users = await Promise.all(mutualIds.map(async (mutualId) => {
    const snapshot = await getDoc(doc(db, 'users', mutualId))
    if (!snapshot.exists() || isAccountCurrentlyDeactivated(snapshot.data())) return null
    const data = snapshot.data()
    const handle = cleanHandle(String(data.handle || ''))
    if (!handle) return null
    const name = data.showFullName === false
      ? String(data.firstName || '')
      : `${String(data.firstName || '')} ${String(data.lastName || '')}`.trim()
    return {
      uid: mutualId,
      handle,
      name: name || `@${handle}`,
      avatarUrl: await resolveUserImage(mutualId, String(data.avatarUrl || '')),
      isPrivate: Boolean(data.isPrivate),
    } satisfies PublicUserSummary
  }))

  return users
    .filter((user): user is PublicUserSummary => Boolean(user))
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
  const followsRef = collection(db, 'follows')
  let outgoing = new Set<string>()
  let incoming = new Set<string>()
  let outgoingLoaded = false
  let incomingLoaded = false
  const emit = () => {
    if (outgoingLoaded && incomingLoaded) onChange([...outgoing].filter((id) => incoming.has(id)))
  }
  const unsubscribeOutgoing = onSnapshot(
    query(followsRef, where('followerId', '==', userId)),
    (snapshot) => {
      outgoing = new Set(snapshot.docs.map((item) => String(item.data().followingId || '')).filter(Boolean))
      outgoingLoaded = true
      emit()
    },
    (error) => console.error('Unable to watch outgoing follows.', error),
  )
  const unsubscribeIncoming = onSnapshot(
    query(followsRef, where('followingId', '==', userId)),
    (snapshot) => {
      incoming = new Set(snapshot.docs.map((item) => String(item.data().followerId || '')).filter(Boolean))
      incomingLoaded = true
      emit()
    },
    (error) => console.error('Unable to watch incoming follows.', error),
  )
  return () => {
    unsubscribeOutgoing()
    unsubscribeIncoming()
  }
}

export async function savePostCommenting(userId: string, postId: string, commentsDisabled: boolean) {
  if (!canUseCloudData(userId)) return
  await setDoc(doc(db, 'posts', postId), {
    ownerId: userId,
    commentsDisabled,
    updatedAt: new Date().toISOString(),
  }, { merge: true })
}

export function subscribePostEngagements(
  postIds: string[],
  viewerId: string | null | undefined,
  onChange: (engagements: Record<string, PostEngagement>) => void,
): Unsubscribe {
  const uniquePostIds = Array.from(new Set(postIds.filter(Boolean)))
  if (!isFirebaseConfigured || uniquePostIds.length === 0) {
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
  const unsubscribers = uniquePostIds.flatMap((postId) => [
    onSnapshot(collection(db, 'posts', postId, 'likes'), (snapshot) => {
      engagements[postId] = {
        ...engagements[postId],
        likeCount: snapshot.size,
        isLiked: Boolean(viewerId && snapshot.docs.some((item) => item.id === viewerId)),
      }
      emit()
    }, (error) => console.error(`Unable to watch likes for post ${postId}.`, error)),
    onSnapshot(collection(db, 'posts', postId, 'comments'), (snapshot) => {
      engagements[postId] = { ...engagements[postId], commentCount: snapshot.size }
      emit()
    }, (error) => console.error(`Unable to watch comments for post ${postId}.`, error)),
  ])

  return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
}

export async function togglePostLike(
  postId: string,
  userId: string,
  liked: boolean,
  actor: { name?: string; handle?: string },
  entryTitle: string,
) {
  if (!canUseCloudData(userId)) return
  const postSnapshot = await getDoc(doc(db, 'posts', postId))
  if (!postSnapshot.exists()) return

  const ownerId = String(postSnapshot.data().ownerId || '')
  const likeRef = doc(db, 'posts', postId, 'likes', userId)
  const notificationRef = ownerId
    ? doc(db, 'users', ownerId, 'notifications', `like_${postId}_${userId}`)
    : null
  if (liked) {
    await setDoc(likeRef, { userId, createdAt: new Date().toISOString() })
    if (notificationRef && ownerId !== userId) {
      try {
        await setDoc(notificationRef, withoutUndefined({
          recipientId: ownerId,
          actorId: userId,
          type: 'like',
          postId,
          interactionId: userId,
          read: false,
          createdAt: new Date().toISOString(),
          actorName: actor.name,
          actorHandle: cleanHandle(actor.handle || ''),
          entryTitle,
        }))
      } catch (error) {
        console.error('The like was saved, but its notification could not be created.', error)
      }
    }
  } else {
    await deleteDoc(likeRef)
    if (notificationRef && ownerId !== userId) {
      try {
        await deleteDoc(notificationRef)
      } catch (error) {
        console.error('The like was removed, but its notification could not be removed.', error)
      }
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
  return onSnapshot(collection(db, 'users', userId, 'notifications'), (snapshot) => {
    const notifications = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }) as AppNotification)
      .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
    onChange(notifications)
  }, (error) => console.error('Unable to watch notifications.', error))
}

export async function setCloudNotificationsRead(userId: string, notificationIds: string[]) {
  if (!canUseCloudData(userId) || notificationIds.length === 0) return
  const batch = writeBatch(db)
  notificationIds.forEach((id) => batch.set(
    doc(db, 'users', userId, 'notifications', id),
    { read: true },
    { merge: true },
  ))
  await batch.commit()
}

export async function deleteCloudNotifications(userId: string, notificationIds: string[]) {
  if (!canUseCloudData(userId) || notificationIds.length === 0) return
  const batch = writeBatch(db)
  notificationIds.forEach((id) => batch.delete(doc(db, 'users', userId, 'notifications', id)))
  await batch.commit()
}

export async function saveFollowRequest(requesterId: string, targetHandle: string, requested: boolean) {
  if (!canUseCloudData(requesterId)) return
  const targetId = await resolveUserIdByHandle(targetHandle)
  if (!targetId) return
  const requestRef = doc(db, 'follow-requests', `${requesterId}_${targetId}`)
  if (!requested) {
    await deleteDoc(requestRef)
    return
  }
  await setDoc(requestRef, {
    requesterId,
    targetId,
    targetHandle: cleanHandle(targetHandle),
    status: 'pending',
    createdAt: new Date().toISOString(),
  })
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

  const reportRef = doc(collection(db, 'reports'))
  await setDoc(reportRef, withoutUndefined({
    reporterId,
    targetType: report.targetType,
    targetId,
    targetHandle,
    postId: report.postId?.trim(),
    parentCommentId: report.parentCommentId?.trim(),
    reason,
    details,
    status: 'pending',
    createdAt: serverTimestamp(),
  }))
  return reportRef.id
}

export async function loadPostComments(postId: string, viewerId?: string | null): Promise<CloudComment[]> {
  if (!isFirebaseConfigured) return []
  const snapshot = await getDocs(collection(db, 'posts', postId, 'comments'))
  const comments = await Promise.all(snapshot.docs.map(async (item) => {
    const [likesSnapshot, repliesSnapshot] = await Promise.all([
      getDocs(collection(item.ref, 'likes')),
      getDocs(collection(item.ref, 'replies')),
    ])
    const replies = await Promise.all(repliesSnapshot.docs.map(async (replyItem) => {
      const replyData = replyItem.data() as CloudCommentReply
      const [replyLikes, replyIdentity] = await Promise.all([
        getDocs(collection(replyItem.ref, 'likes')),
        loadAccountIdentity(replyData.authorId),
      ])
      return {
        ...replyData,
        id: replyItem.id,
        authorHandle: replyIdentity.handle || replyData.authorHandle,
        ...(replyIdentity.deactivated ? {
          author: DEACTIVATED_ACCOUNT_NAME,
          initials: 'QR',
        } : {}),
        likesCount: replyLikes.size,
        isLiked: Boolean(viewerId && replyLikes.docs.some((like) => like.id === viewerId)),
      }
    }))
    const commentData = item.data() as CloudComment
    const commentIdentity = await loadAccountIdentity(commentData.authorId)
    return {
      ...commentData,
      id: item.id,
      authorHandle: commentIdentity.handle || commentData.authorHandle,
      ...(commentIdentity.deactivated ? {
        author: DEACTIVATED_ACCOUNT_NAME,
        initials: 'QR',
      } : {}),
      likesCount: likesSnapshot.size,
      isLiked: Boolean(viewerId && likesSnapshot.docs.some((like) => like.id === viewerId)),
      replies: replies.sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt))),
    }
  }))
  return comments.sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)))
}

export async function createPostComment(
  postId: string,
  userId: string,
  comment: CloudComment,
  entryTitle?: string,
) {
  if (!canUseCloudData(userId)) return
  const { replies: _replies, likesCount: _likesCount, isLiked: _isLiked, ...data } = comment
  void _replies
  void _likesCount
  void _isLiked
  const postSnapshot = await getDoc(doc(db, 'posts', postId))
  if (!postSnapshot.exists()) return
  const ownerId = String(postSnapshot.data().ownerId || '')
  await setDoc(doc(db, 'posts', postId, 'comments', comment.id), withoutUndefined({
    ...data,
    authorId: userId,
    createdAt: new Date().toISOString(),
  }))
  if (ownerId && ownerId !== userId) {
    try {
      await setDoc(doc(db, 'users', ownerId, 'notifications', `comment_${postId}_${comment.id}`), withoutUndefined({
        recipientId: ownerId,
        actorId: userId,
        type: 'comment',
        postId,
        interactionId: comment.id,
        read: false,
        createdAt: new Date().toISOString(),
        actorName: comment.author,
        actorHandle: cleanHandle(comment.authorHandle || ''),
        entryTitle: entryTitle || String(postSnapshot.data().entryTitle || 'Untitled entry'),
        commentSnippet: comment.text.slice(0, 160),
      }))
    } catch (error) {
      console.error('The comment was saved, but its notification could not be created.', error)
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
  const { likesCount: _likesCount, isLiked: _isLiked, ...data } = reply
  void _likesCount
  void _isLiked
  const [postSnapshot, commentSnapshot] = await Promise.all([
    getDoc(doc(db, 'posts', postId)),
    getDoc(doc(db, 'posts', postId, 'comments', commentId)),
  ])
  if (!postSnapshot.exists() || !commentSnapshot.exists()) return

  const commentData = commentSnapshot.data() as CloudComment
  const recipientId = reply.replyToUserId || commentData.authorId || ''
  const replyToInteractionId = reply.replyToInteractionId || commentId
  await setDoc(doc(db, 'posts', postId, 'comments', commentId, 'replies', reply.id), withoutUndefined({
    ...data,
    authorId: userId,
    replyToUserId: recipientId,
    replyToInteractionId,
    createdAt: new Date().toISOString(),
  }))

  if (recipientId && recipientId !== userId) {
    try {
      await setDoc(doc(db, 'users', recipientId, 'notifications', `reply_${postId}_${commentId}_${reply.id}`), withoutUndefined({
        recipientId,
        actorId: userId,
        type: 'reply',
        postId,
        interactionId: reply.id,
        parentInteractionId: commentId,
        replyToInteractionId,
        read: false,
        createdAt: new Date().toISOString(),
        actorName: reply.author,
        actorHandle: cleanHandle(reply.authorHandle || ''),
        entryTitle: String(postSnapshot.data().entryTitle || 'Untitled entry'),
        commentSnippet: reply.text.slice(0, 160),
      }))
    } catch (error) {
      console.error('The reply was saved, but its notification could not be created.', error)
    }
  }
}

export async function togglePostCommentLike(
  postId: string,
  commentId: string,
  userId: string,
  liked: boolean,
) {
  if (!canUseCloudData(userId)) return
  const likeRef = doc(db, 'posts', postId, 'comments', commentId, 'likes', userId)
  if (liked) await setDoc(likeRef, { userId, createdAt: new Date().toISOString() })
  else await deleteDoc(likeRef)
}

export async function togglePostReplyLike(
  postId: string,
  commentId: string,
  replyId: string,
  userId: string,
  liked: boolean,
) {
  if (!canUseCloudData(userId)) return
  const likeRef = doc(db, 'posts', postId, 'comments', commentId, 'replies', replyId, 'likes', userId)
  if (liked) await setDoc(likeRef, { userId, createdAt: new Date().toISOString() })
  else await deleteDoc(likeRef)
}

export async function deletePostReply(postId: string, commentId: string, replyId: string, userId: string) {
  if (!canUseCloudData(userId)) return
  const replyRef = doc(db, 'posts', postId, 'comments', commentId, 'replies', replyId)
  const likes = await getDocs(collection(replyRef, 'likes'))
  await replaceDocuments(likes.docs.map((item) => item.ref), [])
  await deleteDoc(replyRef)
}

export async function deletePostComment(postId: string, commentId: string, userId: string) {
  if (!canUseCloudData(userId)) return
  const commentRef = doc(db, 'posts', postId, 'comments', commentId)
  const likes = await getDocs(collection(commentRef, 'likes'))
  await replaceDocuments(likes.docs.map((item) => item.ref), [])
  await deleteDoc(commentRef)
}
