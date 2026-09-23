import type { ProfileCollection } from '../features/collections/profileCollections'
import type { UserProfileState } from '../types/userProfile'
import {
  createPostComment,
  createPostReply,
  deleteCloudNotifications,
  deletePostComment,
  deletePostReply,
  saveFollowRelationship,
  saveFollowRequest,
  savePostCommenting,
  saveUserCloudState,
  saveUserCollections,
  saveUserProfile,
  setCloudNotificationsRead,
  setCloudSavedEntry,
  submitContentReport,
  togglePostCommentLike,
  togglePostLike,
  togglePostReplyLike,
  uploadUserImage,
  type CloudComment,
  type CloudCommentReply,
  type ContentReport,
  type UserCloudState,
} from './cloudData'

const OFFLINE_ACTIONS_KEY = 'the-commonplace.offline-actions.v1'
export const OFFLINE_QUEUE_EVENT = 'the-commonplace:offline-queue-change'

type OfflineActionPayload =
  | { type: 'cloud-state'; patch: Partial<UserCloudState> }
  | { type: 'saved-entry'; entryId: string; saved: boolean }
  | { type: 'post-like'; postId: string; liked: boolean; actor: { name?: string; handle?: string }; entryTitle: string }
  | { type: 'post-comment'; postId: string; comment: CloudComment; entryTitle?: string }
  | { type: 'post-reply'; postId: string; commentId: string; reply: CloudCommentReply }
  | { type: 'comment-like'; postId: string; commentId: string; liked: boolean }
  | { type: 'reply-like'; postId: string; commentId: string; replyId: string; liked: boolean }
  | { type: 'delete-comment'; postId: string; commentId: string }
  | { type: 'delete-reply'; postId: string; commentId: string; replyId: string }
  | { type: 'follow'; targetHandle: string; following: boolean; actor: { name?: string; handle?: string } }
  | { type: 'follow-request'; targetHandle: string; requested: boolean }
  | { type: 'post-commenting'; postId: string; commentsDisabled: boolean }
  | { type: 'collections'; kind: 'created' | 'saved'; collections: ProfileCollection[] }
  | { type: 'notifications-read'; notificationIds: string[] }
  | { type: 'notifications-delete'; notificationIds: string[] }
  | { type: 'profile'; profile: UserProfileState }
  | { type: 'report'; report: ContentReport }

export type OfflineActionInput = OfflineActionPayload & {
  userId: string
  dedupeKey?: string
}

export type StoredOfflineAction = OfflineActionInput & {
  id: string
  createdAt: string
}

export type OfflineSubmitResult = {
  queued: boolean
}

export type OfflineFlushResult = {
  completed: number
  remaining: number
  failed: number
}

function makeActionId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function readActions(): StoredOfflineAction[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const value = JSON.parse(localStorage.getItem(OFFLINE_ACTIONS_KEY) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function writeActions(actions: StoredOfflineAction[]) {
  if (typeof localStorage === 'undefined') return
  if (actions.length === 0) localStorage.removeItem(OFFLINE_ACTIONS_KEY)
  else localStorage.setItem(OFFLINE_ACTIONS_KEY, JSON.stringify(actions))
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_EVENT))
}

export function isNetworkError(error: unknown) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  const message = (error as { message?: string; code?: string } | null)?.message || ''
  const code = (error as { code?: string } | null)?.code || ''
  return /network|offline|failed to fetch|unavailable|deadline-exceeded/i.test(`${code} ${message}`)
}

export function getPendingOfflineActionCount(userId?: string | null) {
  const actions = readActions()
  return userId ? actions.filter((action) => action.userId === userId).length : actions.length
}

export function queueOfflineAction(input: OfflineActionInput) {
  const action: StoredOfflineAction = {
    ...input,
    id: makeActionId(),
    createdAt: new Date().toISOString(),
  }
  const actions = readActions()
  const next = input.dedupeKey
    ? [...actions.filter((item) => item.userId !== input.userId || item.dedupeKey !== input.dedupeKey), action]
    : [...actions, action]
  writeActions(next)
  return action
}

async function executeOfflineAction(action: StoredOfflineAction) {
  switch (action.type) {
    case 'cloud-state':
      return saveUserCloudState(action.userId, action.patch)
    case 'saved-entry': {
      await setCloudSavedEntry(action.userId, action.entryId, action.saved)
      try {
        const key = `the-commonplace.pending-saves.${action.userId}`
        const pending = JSON.parse(localStorage.getItem(key) || '{}') as Record<string, unknown>
        if (pending[action.entryId] === action.saved) {
          delete pending[action.entryId]
          if (Object.keys(pending).length === 0) localStorage.removeItem(key)
          else localStorage.setItem(key, JSON.stringify(pending))
        }
      } catch {
        // The durable action itself is complete even if legacy cleanup fails.
      }
      return
    }
    case 'post-like':
      return togglePostLike(action.postId, action.userId, action.liked, action.actor, action.entryTitle)
    case 'post-comment':
      return createPostComment(action.postId, action.userId, action.comment, action.entryTitle)
    case 'post-reply':
      return createPostReply(action.postId, action.commentId, action.userId, action.reply)
    case 'comment-like':
      return togglePostCommentLike(action.postId, action.commentId, action.userId, action.liked)
    case 'reply-like':
      return togglePostReplyLike(action.postId, action.commentId, action.replyId, action.userId, action.liked)
    case 'delete-comment':
      return deletePostComment(action.postId, action.commentId, action.userId)
    case 'delete-reply':
      return deletePostReply(action.postId, action.commentId, action.replyId, action.userId)
    case 'follow':
      return saveFollowRelationship(action.userId, action.targetHandle, action.following, action.actor)
    case 'follow-request':
      return saveFollowRequest(action.userId, action.targetHandle, action.requested)
    case 'post-commenting':
      return savePostCommenting(action.userId, action.postId, action.commentsDisabled)
    case 'collections':
      await saveUserCollections(action.userId, action.kind, action.collections)
      return
    case 'notifications-read':
      return setCloudNotificationsRead(action.userId, action.notificationIds)
    case 'notifications-delete':
      return deleteCloudNotifications(action.userId, action.notificationIds)
    case 'profile': {
      const [avatarUrl, coverUrl] = await Promise.all([
        uploadUserImage(action.userId, 'avatar', action.profile.avatarUrl),
        uploadUserImage(action.userId, 'cover', action.profile.coverUrl),
      ])
      await saveUserProfile(action.userId, { ...action.profile, avatarUrl, coverUrl })
      return
    }
    case 'report':
      await submitContentReport(action.userId, action.report)
  }
}

export async function submitOfflineAction(input: OfflineActionInput): Promise<OfflineSubmitResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    queueOfflineAction(input)
    return { queued: true }
  }
  const action: StoredOfflineAction = {
    ...input,
    id: makeActionId(),
    createdAt: new Date().toISOString(),
  }
  try {
    await executeOfflineAction(action)
    return { queued: false }
  } catch (error) {
    if (!isNetworkError(error)) throw error
    queueOfflineAction(input)
    return { queued: true }
  }
}

let activeFlush: Promise<OfflineFlushResult> | null = null

export function flushOfflineActions(userId: string): Promise<OfflineFlushResult> {
  if (activeFlush) return activeFlush
  activeFlush = (async () => {
    let completed = 0
    let failed = 0
    const queued = readActions()
    const otherAccounts = queued.filter((action) => action.userId !== userId)
    const accountActions = queued.filter((action) => action.userId === userId)
    const remaining: StoredOfflineAction[] = []

    for (let index = 0; index < accountActions.length; index += 1) {
      const action = accountActions[index]
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        remaining.push(...accountActions.slice(index))
        break
      }
      try {
        await executeOfflineAction(action)
        completed += 1
      } catch (error) {
        remaining.push(action)
        if (isNetworkError(error)) {
          remaining.push(...accountActions.slice(index + 1))
          break
        }
        failed += 1
        console.error(`Unable to replay offline action ${action.type}.`, error)
      }
    }

    writeActions([...otherAccounts, ...remaining])
    return { completed, remaining: remaining.length, failed }
  })().finally(() => {
    activeFlush = null
  })
  return activeFlush
}
