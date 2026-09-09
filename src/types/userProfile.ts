export type UserProfileState = {
  firstName: string
  lastName: string
  showFullName: boolean
  handle: string
  email: string
  bio: string
  avatarUrl: string
  coverUrl: string
  createdAt?: string
  birthday?: string
  lastUsernameChangeDate?: string
  showFollowLists?: boolean
  allowComments?: boolean
  isPrivate?: boolean
  showSavedActivity?: boolean
  accountStatus?: 'active' | 'deactivated'
}
