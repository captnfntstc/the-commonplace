import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  setDoc,
  writeBatch,
  type DocumentReference,
} from 'firebase/firestore'
import type { Entry } from '../features/entries/model'
import type { ProfileCollection } from '../features/collections/profileCollections'
import type { AppNotification } from '../types/notification'
import type { UserProfileState } from '../types/userProfile'
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

export type PublicUserData = {
  profile: UserProfileState
  entries: Entry[]
  collections: ProfileCollection[]
  savedEntryIds: string[]
  savedCollections: ProfileCollection[]
}

type CloudCollectionKind = 'created' | 'saved'
type CloudImageKind = 'avatar' | 'cover' | 'collection-cover'

const FIRESTORE_MEDIA_PREFIX = 'firestore-media:'
const MAX_MEDIA_DATA_URL_LENGTH = 700_000
const mediaCache = new Map<string, Promise<string>>()

const DEFAULT_CLOUD_STATE: UserCloudState = {
  likedEntryIds: [],
  savedEntryIds: [],
  disabledCommentEntryIds: [],
  followedUserHandles: [],
  followRequestedHandles: [],
  notifications: [],
}

export function canUseCloudData(userId?: string | null) {
  return Boolean(isFirebaseConfigured && userId)
}

function cleanHandle(handle: string) {
  return handle.replace(/^@/, '').trim().toLowerCase()
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
  const { email, ...publicProfile } = profile

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
      migrationVersion: options.markMigrated === false ? 0 : CLOUD_MIGRATION_VERSION,
      updatedAt: new Date().toISOString(),
    }), { merge: true })
    transaction.set(doc(db, 'users', userId, 'private', 'settings'), withoutUndefined({
      email,
      lastUsernameChangeDate: profile.lastUsernameChangeDate,
      updatedAt: new Date().toISOString(),
    }), { merge: true })
    transaction.set(nextHandleRef, {
      uid: userId,
      handle: nextHandle,
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
    lastUsernameChangeDate: privateData.lastUsernameChangeDate
      ? String(privateData.lastUsernameChangeDate)
      : undefined,
    showFollowLists: publicData.showFollowLists !== false,
    allowComments: publicData.allowComments !== false,
    isPrivate: Boolean(publicData.isPrivate),
    showSavedActivity: Boolean(publicData.showSavedActivity),
  }
}

export async function saveUserEntries(
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
  const existingPostIds = new Set(existingPostRefs.map((item) => item.id))
  const nextEntryIds = new Set(entries.map((entry) => entry.id))
  for (const removedEntry of existing.docs.filter(
    (entry) => !nextEntryIds.has(entry.id) && existingPostIds.has(entry.id),
  )) {
    const comments = await getDocs(collection(db, 'posts', removedEntry.id, 'comments'))
    for (const comment of comments.docs) {
      await deletePostComment(removedEntry.id, comment.id, userId)
    }
  }
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
          commentsDisabled: disabledCommentEntryIds.includes(entry.id),
          updatedAt: entry.updatedAt || entry.createdAt,
        },
      }]
    }),
  )
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

export async function loadUserCloudState(userId: string): Promise<UserCloudState> {
  if (!canUseCloudData(userId)) return DEFAULT_CLOUD_STATE
  const snapshot = await getDoc(doc(db, 'users', userId, 'private', 'app-state'))
  if (!snapshot.exists()) return DEFAULT_CLOUD_STATE
  const data = snapshot.data()
  return {
    likedEntryIds: Array.isArray(data.likedEntryIds) ? data.likedEntryIds : [],
    savedEntryIds: Array.isArray(data.savedEntryIds) ? data.savedEntryIds : [],
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

  if (!userSnapshot.exists() || Number(userSnapshot.data().migrationVersion || 0) < CLOUD_MIGRATION_VERSION) {
    const [avatarUrl, coverUrl] = await Promise.all([
      uploadUserImage(userId, 'avatar', localSnapshot.profile.avatarUrl),
      uploadUserImage(userId, 'cover', localSnapshot.profile.coverUrl),
    ])
    const migratedProfile = { ...localSnapshot.profile, avatarUrl, coverUrl }
    const [savedProfile] = await Promise.all([
      saveUserProfile(userId, migratedProfile, { markMigrated: false }),
      saveUserEntries(userId, localSnapshot.entries, localSnapshot.state.disabledCommentEntryIds),
      saveUserCloudState(userId, localSnapshot.state),
    ])
    await setDoc(doc(db, 'users', userId), {
      migrationVersion: CLOUD_MIGRATION_VERSION,
      migratedAt: new Date().toISOString(),
    }, { merge: true })
    return { ...localSnapshot, profile: savedProfile }
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

export async function loadPublicUserByHandle(handle: string): Promise<PublicUserData | null> {
  if (!isFirebaseConfigured) return null
  const userId = await resolveUserIdByHandle(handle)
  if (!userId) return null
  const userSnapshot = await getDoc(doc(db, 'users', userId))
  if (!userSnapshot.exists()) return null

  const data = userSnapshot.data()
  const [avatarUrl, coverUrl] = await Promise.all([
    resolveUserImage(userId, String(data.avatarUrl || '')),
    resolveUserImage(userId, String(data.coverUrl || '')),
  ])
  const profile: UserProfileState = {
    firstName: String(data.firstName || ''),
    lastName: String(data.lastName || ''),
    showFullName: data.showFullName !== false,
    handle: String(data.handle || cleanHandle(handle)),
    email: '',
    bio: String(data.bio || ''),
    avatarUrl,
    coverUrl,
    showFollowLists: data.showFollowLists !== false,
    allowComments: data.allowComments !== false,
    isPrivate: Boolean(data.isPrivate),
    showSavedActivity: Boolean(data.showSavedActivity),
  }

  const [loadedEntries, collections] = await Promise.all([
    loadUserEntries(userId).catch(() => []),
    loadUserCollections(userId, 'created').catch(() => []),
  ])
  const entries = loadedEntries.map((entry) => ({
    ...entry,
    authorHandle: profile.handle,
    authorAvatarUrl: profile.avatarUrl,
  }))
  if (!profile.showSavedActivity) {
    return { profile, entries, collections, savedEntryIds: [], savedCollections: [] }
  }

  const [savedActivity, savedCollections] = await Promise.all([
    getDoc(doc(db, 'users', userId, 'activity', 'saved')).catch(() => null),
    loadUserCollections(userId, 'saved').catch(() => []),
  ])
  return {
    profile,
    entries,
    collections,
    savedEntryIds: savedActivity?.exists() && Array.isArray(savedActivity.data().entryIds)
      ? savedActivity.data().entryIds
      : [],
    savedCollections,
  }
}

export async function saveFollowRelationship(followerId: string, targetHandle: string, following: boolean) {
  if (!canUseCloudData(followerId)) return
  const targetId = await resolveUserIdByHandle(targetHandle)
  if (!targetId) return
  const followRef = doc(db, 'follows', `${followerId}_${targetId}`)
  if (!following) {
    await deleteDoc(followRef)
    return
  }
  await setDoc(followRef, {
    followerId,
    followingId: targetId,
    targetHandle: cleanHandle(targetHandle),
    createdAt: new Date().toISOString(),
  })
}

export async function savePostCommenting(userId: string, postId: string, commentsDisabled: boolean) {
  if (!canUseCloudData(userId)) return
  await setDoc(doc(db, 'posts', postId), {
    ownerId: userId,
    commentsDisabled,
    updatedAt: new Date().toISOString(),
  }, { merge: true })
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

export async function loadPostComments(postId: string, viewerId?: string | null): Promise<CloudComment[]> {
  if (!isFirebaseConfigured) return []
  const snapshot = await getDocs(collection(db, 'posts', postId, 'comments'))
  const comments = await Promise.all(snapshot.docs.map(async (item) => {
    const [likesSnapshot, repliesSnapshot] = await Promise.all([
      getDocs(collection(item.ref, 'likes')),
      getDocs(collection(item.ref, 'replies')),
    ])
    const replies = await Promise.all(repliesSnapshot.docs.map(async (replyItem) => {
      const replyLikes = await getDocs(collection(replyItem.ref, 'likes'))
      return {
        ...(replyItem.data() as CloudCommentReply),
        id: replyItem.id,
        likesCount: replyLikes.size,
        isLiked: Boolean(viewerId && replyLikes.docs.some((like) => like.id === viewerId)),
      }
    }))
    return {
      ...(item.data() as CloudComment),
      id: item.id,
      likesCount: likesSnapshot.size,
      isLiked: Boolean(viewerId && likesSnapshot.docs.some((like) => like.id === viewerId)),
      replies: replies.sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt))),
    }
  }))
  return comments.sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)))
}

export async function createPostComment(postId: string, userId: string, comment: CloudComment) {
  if (!canUseCloudData(userId)) return
  const { replies: _replies, likesCount: _likesCount, isLiked: _isLiked, ...data } = comment
  void _replies
  void _likesCount
  void _isLiked
  await setDoc(doc(db, 'posts', postId, 'comments', comment.id), withoutUndefined({
    ...data,
    authorId: userId,
    createdAt: new Date().toISOString(),
  }))
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
  await setDoc(doc(db, 'posts', postId, 'comments', commentId, 'replies', reply.id), withoutUndefined({
    ...data,
    authorId: userId,
    createdAt: new Date().toISOString(),
  }))
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
  const [likes, replies] = await Promise.all([
    getDocs(collection(commentRef, 'likes')),
    getDocs(collection(commentRef, 'replies')),
  ])
  for (const reply of replies.docs) {
    await deletePostReply(postId, commentId, reply.id, userId)
  }
  await replaceDocuments(likes.docs.map((item) => item.ref), [])
  await deleteDoc(commentRef)
}
