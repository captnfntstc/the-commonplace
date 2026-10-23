import React from 'react'
import type { ProfileCollection as Collection } from '../../features/collections/profileCollections'
import type { Entry } from '../../features/entries/model'
import { useDevSettings } from '../DeveloperTools/devSettings'
import { HollisCollectionLayout } from './HollisCollectionLayout'
import { UniversalCollectionLayout } from './UniversalCollectionLayout'

export interface AlternativeCollectionDetailProps {
  collection: Collection
  items: Entry[]
  creatorHandle: string
  creatorName: string
  currentUserHandle: string
  isOwnedByCurrentUser: boolean
  isSaved: boolean
  isTcpAdminUser: boolean
  isEditingInline: boolean
  collectionName: string
  setCollectionName: (name: string) => void
  collectionDescription: string
  setCollectionDescription: (desc: string) => void
  onSaveInlineEdit: () => void
  onCancelInlineEdit: () => void
  onBack: () => void
  onOpenMedia?: (entry: Entry) => void
  onSelectEntry?: (entry: Entry) => void
  onOpenCreator?: (entry: Entry, creator: string) => void
  onOpenAlbum?: (entry: Entry) => void
  onOpenUserProfile?: (handle: string) => void
  onAddMedia?: () => void
  onStartInlineEdit?: () => void
  onDeleteCollection?: () => void
  onToggleSave?: () => void
  onRemoveItem?: (entry: Entry) => void
  renderCoverArtwork: () => React.ReactNode
  followersCount?: number
  followingCount?: number
  isFollowingUser?: boolean
  onToggleFollow?: () => void
  collectionCoverMode?: 'auto' | 'custom' | 'gradient'
  setCollectionCoverMode?: (mode: 'auto' | 'custom' | 'gradient') => void
  collectionCustomCover?: string
  setCollectionCustomCover?: (url: string) => void
  collectionGradientVariant?: 1 | 2 | 3 | 4
  setCollectionGradientVariant?: (variant: 1 | 2 | 3 | 4) => void
  onCoverUpload?: (file?: File) => void
  onToggleHideFromProfile?: () => void
}

export const AlternativeCollectionDetail: React.FC<AlternativeCollectionDetailProps> = (props) => {
  const { settings } = useDevSettings()

  if (settings.collectionLayout === 'universal') {
    return <UniversalCollectionLayout {...props} />
  }

  return <HollisCollectionLayout {...props} />
}

export default AlternativeCollectionDetail
