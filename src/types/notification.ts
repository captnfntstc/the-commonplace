export type NotificationType =
  | 'like'
  | 'like_milestone'
  | 'comment'
  | 'reply'
  | 'follow'
  | 'follow_request'
  | 'friend_recommendation'
  | 'people_you_may_know'
  | 'birthday'

export interface AppNotification {
  id: string
  type: NotificationType
  read: boolean
  createdAt: string
  actorId?: string
  postId?: string
  interactionId?: string
  parentInteractionId?: string
  actorName?: string
  actorHandle?: string
  actorAvatarUrl?: string
  entryTitle?: string
  milestoneCount?: number
  commentSnippet?: string
}
