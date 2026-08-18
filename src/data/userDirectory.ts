export type UserDirectoryEntry = {
  id: string
  name: string
  handle: string
  avatar: string
  reviews: number
  isPrivate: boolean
}

export const USER_DIRECTORY: UserDirectoryEntry[] = [
  { id: 'jimboii', name: 'Jimmy Boy', handle: 'jimboii', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop', reviews: 14, isPrivate: false },
  { id: 'elena_r', name: 'Elena Rostova', handle: 'elena_r', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop', reviews: 34, isPrivate: false },
  { id: 'marcus_v', name: 'Marcus Vance', handle: 'marcus_v', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop', reviews: 18, isPrivate: false },
  { id: 'aria_s', name: 'Aria Sterling', handle: 'aria_s', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop', reviews: 12, isPrivate: true },
  { id: 'sophiac', name: 'Sophia Chen', handle: 'sophiac', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop', reviews: 27, isPrivate: false },
]
