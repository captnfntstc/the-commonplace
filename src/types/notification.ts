export type NotificationType =
  | 'like'
  | 'like_milestone'
  | 'comment'
  | 'follow_request'
  | 'friend_recommendation'
  | 'people_you_may_know'

export interface AppNotification {
  id: string
  type: NotificationType
  read: boolean
  createdAt: string
  actorName?: string
  actorHandle?: string
  actorAvatarUrl?: string
  entryTitle?: string
  milestoneCount?: number
  commentSnippet?: string
}
