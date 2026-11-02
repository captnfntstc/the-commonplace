import React, { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  AlertTriangle,
  User,
  Search,
  X,
  BookOpen,
  Star,
  Edit3,
  Layers,
  Bookmark,
  FolderPlus,
  Lock,
  UserCheck,
  UserPlus,
  Users,
  Calendar,
  FolderHeart,
  Plus,
  Trash2,
  Check,
  MoreHorizontal,
  Share2,
  Eye,
  EyeOff,
  Sparkles,
  ImagePlus,
  Flag,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  Compass,
  Upload,
} from 'lucide-react'
import { getGradientCoverStyle, generateCollectionGradientSvg, GRADIENT_NAMES } from '../utils/collectionCovers'
import { Card } from '../components/CommonplaceCard/Card'
import { entryTypes, type Entry as CardEntry, type EntryType } from '../features/entries/model'
import { searchMetadata, type MetadataResult } from '../metadata'
import { useMasonryLayout } from '../hooks/useMasonryLayout'
import { useAccessibleDialog } from '../hooks/useAccessibleDialog'
import { handleTabListKeyDown } from '../utils/keyboard'
import { routeSegment } from '../features/entities/routing'
import {
  CollectionDetailHeroSkeleton,
  CollectionShelfSkeleton,
} from '../components/Collections/ProfileCollectionSkeletons'
import { CardSkeletonGrid } from '../components/CommonplaceCard/CardSkeleton'
import { AlternativeCollectionDetail } from '../components/Collections/AlternativeCollectionDetail'
import type { UserProfileState } from '../types/userProfile'
import { getEntryTypeIcon } from '../utils/mediaIcons'
import {
  collectionsCreatedByProfile,
  createProfileCollection,
  duplicateProfileCollectionItem,
  entriesForProfileCollection,
  loadProfileCollections,
  loadSavedProfileCollections,
  profileCollectionItemIdentity,
  profileCollectionItemFromMetadata,
  saveProfileCollections,
  saveSavedProfileCollections,
  uniqueProfileCollectionItems,
  type ProfileCollection,
  type ProfileCollectionItem,
} from '../features/collections/profileCollections'
import { getCollectionSuggestions } from '../features/collections/collectionSuggestions'
import { AvatarCropperDialog, CoverCropperDialog } from '../components/Settings/AvatarUploader'
import { showToast } from '../utils/toast'
import { ReportDialog } from '../components/Reports/ReportDialog'
import {
  loadOrMigrateUserCollections,
  saveUserCollections,
  subscribeProfileFollowLists,
  submitContentReport,
  type PublicAccountIdentity,
  type PostEngagement,
} from '../services/cloudData'
import { hasDistinctProfileDisplayName } from '../features/profiles/accountProfile'
// ─── Catalog mode ────────────────────────────────────────────────────────────
type CatalogMode = 'reviewed' | 'shelf' | 'collections' | 'saved-collections'
type CollectionCatalogMode = Extract<CatalogMode, 'collections' | 'saved-collections'>
type CollectionComposerMode = 'create' | 'edit' | 'add'

function memberSinceShortLabel(createdAt?: string) {
  if (!createdAt) return ''
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    year: 'numeric',
  }).format(date)
}

interface UserProfilePageProps {
  onBack: () => void
  onHome?: () => void
  showLocalNavigation?: boolean
  entries: CardEntry[]
  popularDemandEntries?: CardEntry[]
  savedCatalogEntries?: CardEntry[]
  savedEntryIds?: string[]
  catalogSavedEntryIds?: string[]
  publicCollections?: ProfileCollection[]
  publicSavedCollections?: ProfileCollection[]
  likedEntryIds?: string[]
  postEngagements?: Record<string, PostEngagement>
  disabledCommentEntryIds?: string[]
  onSelectEntry?: (entry: CardEntry) => void
  onOpenMediaProfile?: (entry: CardEntry) => void
  onOpenEntryCreator?: (entry: CardEntry, creatorName: string) => void
  onOpenEntryAlbum?: (entry: CardEntry) => void
  onToggleLike?: (id: string) => void
  onToggleSave?: (id: string) => void
  onToggleCommentsDisabled?: (id: string) => void
  userProfile: UserProfileState
  onUpdateProfile?: (updated: UserProfileState) => void | Promise<void>
  onDeleteEntry?: (id: string) => void
  onEditEntry?: (entry: CardEntry) => void
  onAddEntry?: () => void
  addEntryDisabled?: boolean
  categoryFilter: string
  onCategoryFilterChange: (id: string) => void
  isOwnProfile?: boolean
  onSelectUserProfile?: (handle: string) => void
  followedUserHandles?: string[]
  onToggleFollowUser?: (handle: string) => void
  currentUserProfile?: UserProfileState
  cloudUserId?: string | null
  followRequestedHandles?: string[]
  onToggleFollowRequest?: (handle: string) => void
  initialCollectionId?: string | null
  onOpenCollectionPage?: (collectionId: string) => void
  onCloseCollectionPage?: () => void
  privateContentLocked?: boolean
}

export const UserProfilePage: React.FC<UserProfilePageProps> = ({
  onBack,
  onHome,
  showLocalNavigation = true,
  entries,
  savedCatalogEntries = entries,
  savedEntryIds = [],
  catalogSavedEntryIds = savedEntryIds,
  publicCollections,
  publicSavedCollections = [],
  likedEntryIds = [],
  postEngagements = {},
  disabledCommentEntryIds = [],
  onSelectEntry,
  onOpenMediaProfile,
  onOpenEntryCreator,
  onOpenEntryAlbum,
  onToggleLike,
  onToggleSave,
  onToggleCommentsDisabled,
  userProfile,
  onUpdateProfile,
  onDeleteEntry,
  onEditEntry,
  onAddEntry,
  addEntryDisabled = false,
  categoryFilter,
  onCategoryFilterChange,
  isOwnProfile = true,
  onSelectUserProfile,
  followedUserHandles = [],
  onToggleFollowUser,
  currentUserProfile,
  cloudUserId = null,
  followRequestedHandles = [],
  onToggleFollowRequest,
  initialCollectionId = null,
  onOpenCollectionPage,
  onCloseCollectionPage,
  privateContentLocked,
}) => {
  // ── External profile follow & private state ──────────────────────────────
  const isFollowingUser = followedUserHandles.includes(userProfile.handle)
  const isFollowRequested = followRequestedHandles.includes(userProfile.handle)
  const isPrivateProfile = Boolean(userProfile.isPrivate)
  const isLockedPrivate = privateContentLocked
    ?? (!isOwnProfile && isPrivateProfile && !isFollowingUser)
  const canViewSavedActivity = isOwnProfile || userProfile.showSavedActivity === true
  const inlineAvatarInputRef = useRef<HTMLInputElement>(null)
  const inlineCoverInputRef = useRef<HTMLInputElement>(null)
  const [inlineAvatarCropImage, setInlineAvatarCropImage] = useState('')
  const [inlineCoverCropImage, setInlineCoverCropImage] = useState('')
  const [inlineMediaError, setInlineMediaError] = useState('')
  const setProfileMediaToast = (msg: string | null) => {
    if (msg) showToast(msg)
  }
  const [profileReportOpen, setProfileReportOpen] = useState(false)

  const handleInlineAvatarFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setInlineMediaError('')
    if (file.size > 2 * 1024 * 1024) {
      setInlineMediaError('Profile pictures must be smaller than 2MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = (loadEvent) => {
      if (typeof loadEvent.target?.result === 'string') {
        setInlineAvatarCropImage(loadEvent.target.result)
      }
    }
    reader.onerror = () => setInlineMediaError('That profile picture could not be opened.')
    reader.readAsDataURL(file)
  }

  const handleInlineCoverFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setInlineMediaError('')
    if (file.size > 5 * 1024 * 1024) {
      setInlineMediaError('Cover photos must be smaller than 5MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = (loadEvent) => {
      if (typeof loadEvent.target?.result === 'string') {
        setInlineCoverCropImage(loadEvent.target.result)
      }
    }
    reader.onerror = () => setInlineMediaError('That cover photo could not be opened.')
    reader.readAsDataURL(file)
  }

  // ── Catalog mode ────────────────────────────────────────────────────────────
  const [catalogModeState, setCatalogMode] = useState<CatalogMode>('reviewed')
  const [collectionReturnMode, setCollectionReturnMode] = useState<CollectionCatalogMode>('collections')

  // ── Reviewed catalog state ──────────────────────────────────────────────────
  const [profileSearchQuery] = useState('')
  const profileCategoryFilter = categoryFilter
  const setProfileCategoryFilter = onCategoryFilterChange
  const [expandedCardId, setExpandedCardId] = useState<string>('')
  const [isFilterSwitching, setIsFilterSwitching] = useState(false)

  // ── Shelf state (independent from reviewed) ─────────────────────────────────
  const [shelfSearchQuery] = useState('')
  const [shelfCategoryFilter, setShelfCategoryFilter] = useState('all')
  const [shelfExpandedCardId, setShelfExpandedCardId] = useState<string>('')
  const [isShelfSwitching, setIsShelfSwitching] = useState(false)

  // Custom smart collections, scoped to the current profile.
  const profileDisplayName = userProfile.showFullName
    ? `${userProfile.firstName} ${userProfile.lastName}`.trim()
    : userProfile.firstName
  const currentUserHandle = (currentUserProfile?.handle || userProfile.handle).replace(/^@/, '')
  const [profileCollections, setProfileCollections] = useState<ProfileCollection[]>(() =>
    collectionsCreatedByProfile(loadProfileCollections(userProfile.handle), userProfile.handle),
  )
  const [viewerSavedProfileCollections, setViewerSavedProfileCollections] = useState<ProfileCollection[]>(() =>
    loadSavedProfileCollections(currentUserHandle),
  )
  const [localSelectedCollectionId, setSelectedCollectionId] = useState<string | null>(initialCollectionId)
  const [collectionComposerOpen, setCollectionComposerOpen] = useState(false)
  const [collectionComposerMode, setCollectionComposerMode] = useState<CollectionComposerMode>('create')
  const [collectionEditingId, setCollectionEditingId] = useState<string | null>(null)
  const [collectionName, setCollectionName] = useState('')
  const [collectionDescription, setCollectionDescription] = useState('')
  const [collectionCoverMode, setCollectionCoverMode] = useState<'auto' | 'custom' | 'gradient'>('auto')
  const [collectionGradientVariant, setCollectionGradientVariant] = useState<1 | 2 | 3 | 4>(1)
  const [collectionCustomCover, setCollectionCustomCover] = useState('')
  const collectionPhotoInputRef = useRef<HTMLInputElement>(null)
  const [collectionDiscardConfirmOpen, setCollectionDiscardConfirmOpen] = useState(false)
  const [collectionInlineDiscardConfirmOpen, setCollectionInlineDiscardConfirmOpen] = useState(false)
  const collectionInlineInitialRef = useRef<{
    name: string
    description: string
    coverMode: 'auto' | 'custom' | 'gradient'
    gradientVariant: 1 | 2 | 3 | 4
    customCover: string
  } | null>(null)
  const collectionInitialSnapshotRef = useRef<{
    name: string
    description: string
    coverMode: 'auto' | 'custom' | 'gradient'
    gradientVariant: 1 | 2 | 3 | 4
    customCover: string
    itemIds: string[]
  } | null>(null)
  const [collectionItemSearch, setCollectionItemSearch] = useState('')
  const [collectionItemTypeFilter, setCollectionItemTypeFilter] = useState<'all' | EntryType>('all')
  const [collectionSelectedItems, setCollectionSelectedItems] = useState<ProfileCollectionItem[]>([])
  const [collectionRemoteResults, setCollectionRemoteResults] = useState<MetadataResult[]>([])
  const [collectionItemSearchStatus, setCollectionItemSearchStatus] = useState<'idle' | 'searching' | 'ready' | 'error'>('idle')
  const [collectionRemovalTarget, setCollectionRemovalTarget] = useState<ProfileCollectionItem | null>(null)
  const [collectionDuplicateTarget, setCollectionDuplicateTarget] = useState<ProfileCollectionItem | null>(null)
  const [collectionInlineEditing, setCollectionInlineEditing] = useState(false)
  const [collectionInlineRemovalTarget, setCollectionInlineRemovalTarget] = useState<CardEntry | null>(null)
  const [collectionDeleteTarget, setCollectionDeleteTarget] = useState<ProfileCollection | null>(null)
  const [collectionCardMenuId, setCollectionCardMenuId] = useState<string | null>(null)
  const [collectionCardMenuCopiedId, setCollectionCardMenuCopiedId] = useState<string | null>(null)
  const collectionCardMenuRef = useRef<HTMLDivElement>(null)
  const [profileContentLoading, setProfileContentLoading] = useState(true)
  const profileLoadingTimerRef = useRef<number | null>(null)
  const visitedTabsRef = useRef<Set<CatalogMode>>(new Set(['reviewed']))
  const pendingCatalogScrollTopRef = useRef<number | null>(null)
  const [suppressCatalogMotion, setSuppressCatalogMotion] = useState(true)

  useLayoutEffect(() => {
    const scrollTop = pendingCatalogScrollTopRef.current
    if (scrollTop === null) return
    pendingCatalogScrollTopRef.current = null
    window.scrollTo({ top: scrollTop, behavior: 'auto' })
  })

  useEffect(() => {
    if (!cloudUserId || !isOwnProfile) return
    const localCollections = loadProfileCollections(userProfile.handle)
    let cancelled = false
    void loadOrMigrateUserCollections(cloudUserId, 'created', localCollections)
      .then((collections) => {
        if (!cancelled) {
          const ownedCollections = collectionsCreatedByProfile(collections, userProfile.handle)
          setProfileCollections(ownedCollections)
          saveProfileCollections(userProfile.handle, ownedCollections)
        }
      })
      .catch((error) => console.error('Unable to load collections from Supabase.', error))
    return () => {
      cancelled = true
    }
  }, [cloudUserId, isOwnProfile, userProfile.handle])

  useEffect(() => {
    if (!cloudUserId) return
    const localCollections = loadSavedProfileCollections(currentUserHandle)
    let cancelled = false
    void loadOrMigrateUserCollections(cloudUserId, 'saved', localCollections)
      .then((collections) => {
        if (!cancelled) {
          setViewerSavedProfileCollections(collections)
          saveSavedProfileCollections(currentUserHandle, collections)
        }
      })
      .catch((error) => console.error('Unable to load saved collections from Supabase.', error))
    return () => {
      cancelled = true
    }
  }, [cloudUserId, currentUserHandle])

  const persistCreatedCollections = (nextCollections: ProfileCollection[]) => {
    saveProfileCollections(userProfile.handle, nextCollections)
    if (!cloudUserId || !isOwnProfile) return
    void saveUserCollections(cloudUserId, 'created', nextCollections)
      .then((collections) => {
        setProfileCollections(collections)
        saveProfileCollections(userProfile.handle, collections)
      })
      .catch((error) => console.error('Unable to sync collections to Supabase.', error))
  }

  const persistSavedCollections = (nextCollections: ProfileCollection[]) => {
    saveSavedProfileCollections(currentUserHandle, nextCollections)
    if (!cloudUserId) return
    void saveUserCollections(cloudUserId, 'saved', nextCollections)
      .then((collections) => {
        setViewerSavedProfileCollections(collections)
        saveSavedProfileCollections(currentUserHandle, collections)
      })
      .catch((error) => console.error('Unable to sync saved collections to Supabase.', error))
  }

  // ── Bookmark press animation ────────────────────────────────────────────────

  const isCollectionComposerDirty = () => {
    const initial = collectionInitialSnapshotRef.current
    if (!initial) return false
    if (collectionComposerMode === 'add') {
      return collectionSelectedItems.length > 0
    }
    if (collectionName.trim() !== initial.name.trim()) return true
    if (collectionDescription.trim() !== initial.description.trim()) return true
    if (collectionCoverMode !== initial.coverMode) return true
    if (collectionCoverMode === 'gradient' && collectionGradientVariant !== initial.gradientVariant) return true
    if (collectionCoverMode === 'custom' && collectionCustomCover !== initial.customCover) return true
    const currentItemIds = collectionSelectedItems.map((item) => item.id).sort()
    if (currentItemIds.length !== initial.itemIds.length) return true
    for (let i = 0; i < currentItemIds.length; i++) {
      if (currentItemIds[i] !== initial.itemIds[i]) return true
    }
    return false
  }

  const handleRequestCloseCollectionComposer = () => {
    if (isCollectionComposerDirty()) {
      setCollectionDiscardConfirmOpen(true)
    } else {
      setCollectionComposerOpen(false)
    }
  }

  // ── Follow modal ────────────────────────────────────────────────────────────
  const [activeFollowModal, setActiveFollowModal] = useState<'followers' | 'following' | null>(null)
  const [followSearch, setFollowSearch] = useState('')
  const closeFollowModal = () => {
    setActiveFollowModal(null)
    setFollowSearch('')
  }
  const collectionEditDialogRef = useAccessibleDialog<HTMLElement>({
    open: collectionComposerOpen && collectionComposerMode === 'edit',
    onClose: handleRequestCloseCollectionComposer,
    closeOnEscape: !collectionRemovalTarget && !collectionDiscardConfirmOpen,
  })
  const collectionAddDialogRef = useAccessibleDialog<HTMLElement>({
    open: collectionComposerOpen && collectionComposerMode === 'add',
    onClose: handleRequestCloseCollectionComposer,
    closeOnEscape: !collectionDuplicateTarget && !collectionDiscardConfirmOpen,
  })
  const collectionCreateDialogRef = useAccessibleDialog<HTMLDivElement>({
    open: collectionComposerOpen && collectionComposerMode === 'create',
    onClose: handleRequestCloseCollectionComposer,
    closeOnEscape: !collectionDiscardConfirmOpen,
  })
  const collectionDiscardDialogRef = useAccessibleDialog<HTMLDivElement>({
    open: collectionDiscardConfirmOpen,
    onClose: () => setCollectionDiscardConfirmOpen(false),
  })
  const collectionInlineDiscardDialogRef = useAccessibleDialog<HTMLDivElement>({
    open: collectionInlineDiscardConfirmOpen,
    onClose: () => setCollectionInlineDiscardConfirmOpen(false),
  })
  const collectionDeleteDialogRef = useAccessibleDialog<HTMLDivElement>({
    open: Boolean(collectionDeleteTarget),
    onClose: () => setCollectionDeleteTarget(null),
  })
  const inlineRemovalDialogRef = useAccessibleDialog<HTMLDivElement>({
    open: Boolean(collectionInlineRemovalTarget),
    onClose: () => setCollectionInlineRemovalTarget(null),
  })
  const collectionRemovalDialogRef = useAccessibleDialog<HTMLDivElement>({
    open: Boolean(collectionRemovalTarget),
    onClose: () => setCollectionRemovalTarget(null),
  })
  const duplicateCollectionDialogRef = useAccessibleDialog<HTMLDivElement>({
    open: Boolean(collectionDuplicateTarget),
    onClose: () => setCollectionDuplicateTarget(null),
  })
  const followDialogRef = useAccessibleDialog<HTMLDivElement>({
    open: Boolean(activeFollowModal),
    onClose: closeFollowModal,
  })

  // ── Inline Profile Editing State ───────────────────────────────────────────
  const [isInlineProfileEditing, setIsInlineProfileEditing] = useState(false)
  const [editFirstName, setEditFirstName] = useState(userProfile.firstName || '')
  const [editLastName, setEditLastName] = useState(userProfile.lastName || '')
  const [editBio, setEditBio] = useState(userProfile.bio || '')
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [editProfileError, setEditProfileError] = useState<string | null>(null)
  const isInlineProfileEditActive = isInlineProfileEditing

  const persistProfileChanges = async () => {
    if (!onUpdateProfile) return false
    setIsSavingProfile(true)
    setEditProfileError(null)
    try {
      const trimmedFirst = editFirstName.trim() || userProfile.firstName || 'Reader'
      const trimmedLast = editLastName.trim()
      await onUpdateProfile({
        ...userProfile,
        firstName: trimmedFirst,
        lastName: trimmedLast,
        showFullName: Boolean(trimmedLast) || userProfile.showFullName,
        bio: editBio.trim(),
      })
      setProfileMediaToast('Profile updated successfully.')
      return true
    } catch (err) {
      console.error('Unable to update profile info', err)
      setEditProfileError('Could not save profile changes. Please try again.')
      return false
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleStartInlineProfileEdit = () => {
    setEditFirstName(userProfile.firstName || '')
    setEditLastName(userProfile.lastName || '')
    setEditBio(userProfile.bio || '')
    setEditProfileError(null)
    setIsInlineProfileEditing(true)
  }

  const handleCancelInlineProfileEdit = () => {
    setIsInlineProfileEditing(false)
    setEditProfileError(null)
    setEditFirstName(userProfile.firstName || '')
    setEditLastName(userProfile.lastName || '')
    setEditBio(userProfile.bio || '')
  }

  const handleSaveInlineProfile = async () => {
    const saved = await persistProfileChanges()
    if (saved) setIsInlineProfileEditing(false)
  }
  const [profileFollowLists, setProfileFollowLists] = useState<{
    followers: PublicAccountIdentity[]
    following: PublicAccountIdentity[]
  }>({ followers: [], following: [] })

  useEffect(() => {
    if (!cloudUserId) return undefined
    return subscribeProfileFollowLists(userProfile.handle, setProfileFollowLists)
  }, [cloudUserId, userProfile.handle])

  const profileGridRef = useRef<HTMLElement>(null)
  const selectedCollectionId = onOpenCollectionPage ? initialCollectionId : localSelectedCollectionId
  const catalogMode: CatalogMode = selectedCollectionId
    ? collectionReturnMode
    : catalogModeState
  const isCollectionMode = catalogMode === 'collections' || catalogMode === 'saved-collections'
  const isCollectionDetail = isCollectionMode && Boolean(selectedCollectionId)
  const isCollectionList = isCollectionMode && !selectedCollectionId
  const isSavedCollectionsMode = catalogMode === 'saved-collections'

  // ── Dynamic Followers & Following lists ─────────────────────────────────────
  const dynamicFollowersList = useMemo(() => profileFollowLists.followers.map((identity) => ({
    id: identity.uid,
    name: identity.name,
    handle: identity.handle,
    avatar: identity.avatarUrl,
    reviews: 0,
    isPrivate: identity.isPrivate,
    isDeactivated: identity.isDeactivated,
  })), [profileFollowLists.followers])

  const dynamicFollowingList = useMemo(() => profileFollowLists.following.map((identity) => ({
        id: identity.uid,
        name: identity.name,
        handle: identity.handle,
        avatar: identity.avatarUrl,
        reviews: 0,
        isPrivate: identity.isPrivate,
        isDeactivated: identity.isDeactivated,
      })), [profileFollowLists.following])

  const activeFollowList = activeFollowModal === 'followers' ? dynamicFollowersList : dynamicFollowingList

  const filteredFollowList = useMemo(() => {
    if (!followSearch.trim()) return activeFollowList
    const q = followSearch.toLowerCase()
    return activeFollowList.filter(
      (p) => p.name.toLowerCase().includes(q) || p.handle.toLowerCase().includes(q)
    )
  }, [activeFollowList, followSearch])

  const canViewFollowLists = Boolean(userProfile.showFollowLists) || isOwnProfile
  const showFollowSearch = canViewFollowLists && activeFollowList.length > 0

  // ── Counts (switches dynamically based on catalogMode) ───────────────────────
  const displayedProfileCollections = collectionsCreatedByProfile(
    isOwnProfile ? profileCollections : (publicCollections ?? []),
    userProfile.handle,
  ).filter((collection) => isOwnProfile || !collection.isHidden)
  const displayedSavedProfileCollections = isOwnProfile ? viewerSavedProfileCollections : publicSavedCollections
  const visibleCollections = isSavedCollectionsMode ? displayedSavedProfileCollections : displayedProfileCollections

  const selectedCollection = useMemo(
    () => [...displayedProfileCollections, ...displayedSavedProfileCollections]
      .find((collection) => collection.id === selectedCollectionId) ?? null,
    [displayedProfileCollections, displayedSavedProfileCollections, selectedCollectionId],
  )

  const selectedCollectionCreatorHandle = selectedCollection?.creatorHandle?.replace(/^@/, '')
    || userProfile.handle.replace(/^@/, '')
  const selectedCollectionCreatorName = selectedCollection?.creatorName || profileDisplayName
  const selectedCollectionIsOwnedByCurrentUser = selectedCollectionCreatorHandle === currentUserHandle
  const selectedCollectionIsFromSavedView = Boolean(selectedCollection && displayedSavedProfileCollections.some(
    (collection) => collection.id === selectedCollection.id,
  ))
  const selectedCollectionIsSaved = Boolean(selectedCollection && viewerSavedProfileCollections.some(
    (collection) => collection.id === selectedCollection.id
      && (collection.creatorHandle || '') === (selectedCollection.creatorHandle || ''),
  ))

  const selectedCollectionEntries = useMemo(
    () => entriesForProfileCollection(
      selectedCollectionIsFromSavedView ? savedCatalogEntries : entries,
      selectedCollection,
    ),
    [entries, savedCatalogEntries, selectedCollection, selectedCollectionIsFromSavedView],
  )

  const activeDataset = useMemo(() => {
    if (catalogMode === 'shelf') return savedCatalogEntries.filter((e) => catalogSavedEntryIds.includes(e.id))
    if (isCollectionMode && selectedCollection) return selectedCollectionEntries
    return entries
  }, [catalogMode, entries, savedCatalogEntries, catalogSavedEntryIds, isCollectionMode, selectedCollection, selectedCollectionEntries])

  const booksCount = activeDataset.filter((e) => e.type === 'book').length
  const albumsCount = activeDataset.filter((e) => e.type === 'album').length
  const filmsCount = activeDataset.filter((e) => e.type === 'film').length
  const songsCount = activeDataset.filter((e) => e.type === 'song').length
  const gamesCount = activeDataset.filter((e) => e.type === 'game').length
  const showsCount = activeDataset.filter((e) => e.type === 'tv').length
  useEffect(() => {
    profileLoadingTimerRef.current = window.setTimeout(() => setProfileContentLoading(false), 360)
    return () => {
      if (profileLoadingTimerRef.current !== null) window.clearTimeout(profileLoadingTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!collectionCardMenuId) return
    const handleClickOutside = (event: MouseEvent) => {
      if (collectionCardMenuRef.current && !collectionCardMenuRef.current.contains(event.target as Node)) {
        setCollectionCardMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [collectionCardMenuId])

  const startProfileContentLoading = (duration = 280) => {
    if (profileLoadingTimerRef.current !== null) window.clearTimeout(profileLoadingTimerRef.current)
    setSuppressCatalogMotion(true)
    setProfileContentLoading(true)
    profileLoadingTimerRef.current = window.setTimeout(() => setProfileContentLoading(false), duration)
  }

  const avgRating =
    entries.length > 0
      ? (entries.reduce((acc, curr) => acc + curr.rating, 0) / entries.length).toFixed(1)
      : '0.0'

  const catalogsCount = entries.length
  const collectionsCount = profileCollections.length
  const savedCatalogCount = useMemo(
    () => savedCatalogEntries.filter((e) => catalogSavedEntryIds.includes(e.id)).length,
    [savedCatalogEntries, catalogSavedEntryIds],
  )
  const savedCollectionsCount = viewerSavedProfileCollections.length

  // ── Category change handlers ────────────────────────────────────────────────
  const handleCategoryChange = (id: string) => {
    if (id === activeFilter) return
    pendingCatalogScrollTopRef.current = window.scrollY
    if (catalogMode === 'reviewed') {
      setIsFilterSwitching(true)
      setProfileCategoryFilter(id)
    } else if (catalogMode === 'shelf') {
      setIsShelfSwitching(true)
      setShelfCategoryFilter(id)
    } else {
      setCatalogMode('reviewed')
      setIsFilterSwitching(true)
      setProfileCategoryFilter(id)
    }
  }

  // ── Search change handlers ──────────────────────────────────────────────────
  const activeSearchQuery = catalogMode === 'reviewed'
    ? profileSearchQuery
    : catalogMode === 'shelf'
      ? shelfSearchQuery
      : ''

  // ── Filtered datasets (default sorted by newest first) ───────────────────
  const filteredProfileEntries = useMemo(() => {
    let result = entries
    if (profileCategoryFilter !== 'all') {
      result = result.filter((e) => e.type === profileCategoryFilter)
    }
    if (profileSearchQuery.trim()) {
      const q = profileSearchQuery.toLowerCase()
      result = result.filter(
        (entry) =>
          entry.title.toLowerCase().includes(q) ||
          entry.creator.toLowerCase().includes(q) ||
          entry.provider.toLowerCase().includes(q) ||
          (entry.genre && entry.genre.toLowerCase().includes(q)) ||
          entry.favoritePassage.toLowerCase().includes(q) ||
          entry.reflection.toLowerCase().includes(q),
      )
    }
    return [...result].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [entries, profileSearchQuery, profileCategoryFilter])

  const filteredShelfEntries = useMemo(() => {
    let result = savedCatalogEntries.filter((e) => catalogSavedEntryIds.includes(e.id))
    if (shelfCategoryFilter !== 'all') {
      result = result.filter((e) => e.type === shelfCategoryFilter)
    }
    if (shelfSearchQuery.trim()) {
      const q = shelfSearchQuery.toLowerCase()
      result = result.filter(
        (entry) =>
          entry.title.toLowerCase().includes(q) ||
          entry.creator.toLowerCase().includes(q) ||
          entry.provider.toLowerCase().includes(q) ||
          (entry.genre && entry.genre.toLowerCase().includes(q)) ||
          entry.favoritePassage.toLowerCase().includes(q) ||
          entry.reflection.toLowerCase().includes(q),
      )
    }
    return [...result].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [savedCatalogEntries, catalogSavedEntryIds, shelfSearchQuery, shelfCategoryFilter])

  const collectionComposerItems = useMemo(() => {
    const query = collectionItemSearch.trim().toLowerCase()
    if (!query) {
      return getCollectionSuggestions(collectionSelectedItems, collectionItemTypeFilter)
    }

    const remoteItems = collectionRemoteResults
      .map(profileCollectionItemFromMetadata)
      .filter((item) => collectionItemTypeFilter === 'all' || item.type === collectionItemTypeFilter)
    const seen = new Set<string>()
    return remoteItems.filter((item) => {
      const identity = profileCollectionItemIdentity(item)
      if (seen.has(identity)) return false
      seen.add(identity)
      return true
    })
  }, [collectionItemSearch, collectionItemTypeFilter, collectionSelectedItems, collectionRemoteResults])

  const collectionDiscoverItems = useMemo(() => {
    if (collectionComposerMode !== 'add') return []
    const seen = new Set<string>()
    return collectionRemoteResults
      .map(profileCollectionItemFromMetadata)
      .filter((item) => collectionItemTypeFilter === 'all' || item.type === collectionItemTypeFilter)
      .filter((item) => {
        const identity = profileCollectionItemIdentity(item)
        if (seen.has(identity)) return false
        seen.add(identity)
        return true
      })
  }, [collectionComposerMode, collectionItemTypeFilter, collectionRemoteResults])

  const collectionAddItems = useMemo(() => {
    const query = collectionItemSearch.trim().toLowerCase()
    if (!query) {
      return getCollectionSuggestions(selectedCollection?.items || [], collectionItemTypeFilter)
    }
    return collectionDiscoverItems
  }, [collectionItemSearch, selectedCollection?.items, collectionItemTypeFilter, collectionDiscoverItems])

  useEffect(() => {
    const query = collectionItemSearch.trim()
    if (!collectionComposerOpen || query.length < 2) return

    const abortController = new AbortController()
    const timer = window.setTimeout(() => {
      setCollectionItemSearchStatus('searching')
      Promise.allSettled(
        (collectionItemTypeFilter === 'all'
          ? entryTypes.map(({ id }) => id)
          : [collectionItemTypeFilter]
        ).map((type) => searchMetadata(type, query, abortController.signal)),
      ).then((results) => {
        if (abortController.signal.aborted) return
        const fulfilled = results.filter(
          (result): result is PromiseFulfilledResult<MetadataResult[]> => result.status === 'fulfilled',
        )
        setCollectionRemoteResults(fulfilled.flatMap((result) => result.value).slice(0, 48))
        setCollectionItemSearchStatus(fulfilled.length > 0 ? 'ready' : 'error')
      })
    }, 300)

    return () => {
      abortController.abort()
      window.clearTimeout(timer)
    }
  }, [collectionComposerOpen, collectionItemSearch, collectionItemTypeFilter])

  // Active dataset for rendering
  const activeEntries = catalogMode === 'reviewed'
    ? filteredProfileEntries
    : catalogMode === 'shelf'
      ? filteredShelfEntries
      : []
  const activeExpandedCardId = catalogMode === 'reviewed'
    ? expandedCardId
    : catalogMode === 'shelf'
      ? shelfExpandedCardId
      : ''
  const activeIsFilterSwitching = catalogMode === 'reviewed'
    ? isFilterSwitching
    : catalogMode === 'shelf'
      ? isShelfSwitching
      : false
  const activeFilter = catalogMode === 'reviewed'
    ? profileCategoryFilter
    : catalogMode === 'shelf'
      ? shelfCategoryFilter
      : 'all'

  // ── Masonry layout ─────────────────────────────────────────────────────────
  const activeMasonryLayout = useMasonryLayout(
    profileGridRef,
    activeEntries.length,
    activeExpandedCardId,
    `${catalogMode}-${activeFilter}-${activeSearchQuery}-${activeEntries.map((entry) => entry.id).join('|')}`,
    1280,
  )
  // Keep the measured grid hidden until its coordinates are committed. Motion
  // is enabled two frames after reveal so cards never animate outward from 0,0.
  useEffect(() => {
    if (!activeMasonryLayout || profileContentLoading) return

    let firstFrame = 0
    let secondFrame = 0
    firstFrame = window.requestAnimationFrame(() => {
      setIsFilterSwitching(false)
      setIsShelfSwitching(false)
      secondFrame = window.requestAnimationFrame(() => setSuppressCatalogMotion(false))
    })

    return () => {
      window.cancelAnimationFrame(firstFrame)
      window.cancelAnimationFrame(secondFrame)
    }
  }, [activeMasonryLayout, activeFilter, activeSearchQuery, catalogMode, profileContentLoading])

  const showCatalogSkeleton = (catalogMode === 'reviewed' || catalogMode === 'shelf')
    && profileContentLoading

  // ── Bookmark toggle ─────────────────────────────────────────────────────────
  const handleCatalogModeChange = (mode: CatalogMode) => {
    if (catalogMode === mode) return
    pendingCatalogScrollTopRef.current = window.scrollY
    if (!visitedTabsRef.current.has(mode)) {
      visitedTabsRef.current.add(mode)
      startProfileContentLoading(280)
    }
    setCatalogMode(mode)
    if (mode === 'collections' || mode === 'saved-collections') setCollectionReturnMode(mode)
    setExpandedCardId('')
    setShelfExpandedCardId('')
    setIsFilterSwitching(false)
    setIsShelfSwitching(false)
    setSelectedCollectionId(null)
  }

  const openCollectionComposer = (collection?: ProfileCollection, mode: CollectionComposerMode = collection ? 'add' : 'create') => {
    setCollectionComposerMode(mode)
    setCollectionEditingId(collection?.id ?? null)
    setCollectionName(collection?.name ?? '')
    setCollectionDescription(collection?.description ?? '')
    const restoredMode = collection?.coverMode ?? (collection?.customCoverUrl ? (collection.customCoverUrl.startsWith('data:image/svg') ? 'gradient' : 'custom') : 'auto')
    const initialMode = restoredMode as 'auto' | 'custom' | 'gradient'
    setCollectionCoverMode(initialMode)
    const variantMatch = collection?.coverStyle?.match(/gradient-(\d)/)
    const initialVariant = variantMatch ? (Number(variantMatch[1]) as 1 | 2 | 3 | 4) : 1
    setCollectionGradientVariant(initialVariant)
    const initialCover = collection?.customCoverUrl ?? ''
    setCollectionCustomCover(initialCover)
    setCollectionItemSearch('')
    setCollectionItemTypeFilter('all')
    const initialItems = mode === 'add' ? [] : (collection?.items ?? [])
    setCollectionSelectedItems(initialItems)
    setCollectionRemoteResults([])
    setCollectionItemSearchStatus('idle')
    setCollectionRemovalTarget(null)
    setCollectionDuplicateTarget(null)
    setCollectionDiscardConfirmOpen(false)
    collectionInitialSnapshotRef.current = {
      name: collection?.name ?? '',
      description: collection?.description ?? '',
      coverMode: initialMode,
      gradientVariant: initialVariant,
      customCover: initialCover,
      itemIds: initialItems.map((item) => item.id).sort(),
    }
    setCollectionComposerOpen(true)
  }

  const handleCollectionItemSearchChange = (value: string) => {
    setCollectionItemSearch(value)
    setCollectionRemoteResults([])
    setCollectionItemSearchStatus('idle')
  }

  const handleCollectionItemTypeChange = (type: 'all' | EntryType) => {
    setCollectionItemTypeFilter(type)
    setCollectionRemoteResults([])
    setCollectionItemSearchStatus('idle')
  }

  const toggleCollectionItem = (item: ProfileCollectionItem) => {
    const identity = profileCollectionItemIdentity(item)
    const isSelected = collectionSelectedItems.some(
      (selectedItem) => profileCollectionItemIdentity(selectedItem) === identity,
    )
    if (isSelected) {
      setCollectionSelectedItems((current) => current.filter(
        (selectedItem) => profileCollectionItemIdentity(selectedItem) !== identity,
      ))
      return
    }
    const isAlreadyInCollection = collectionComposerMode === 'add' && selectedCollection?.items?.some(
      (existingItem) => profileCollectionItemIdentity(existingItem) === identity,
    )
    if (isAlreadyInCollection) {
      setCollectionDuplicateTarget(item)
      return
    }
    setCollectionSelectedItems((current) => [...current, item])
  }

  const confirmAddDuplicateCollectionItem = () => {
    if (!collectionDuplicateTarget) return
    setCollectionSelectedItems((current) => [
      ...current,
      duplicateProfileCollectionItem(collectionDuplicateTarget),
    ])
    setCollectionDuplicateTarget(null)
  }

  const handleCollectionCoverUpload = (file?: File) => {
    if (collectionPhotoInputRef.current) {
      collectionPhotoInputRef.current.value = ''
    }
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setProfileMediaToast('Please select a valid image file.')
      return
    }
    try {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result !== 'string') {
          setProfileMediaToast('An error has occurred.')
          return
        }
        setCollectionCustomCover(reader.result)
        setCollectionCoverMode('custom')
      }
      reader.onerror = () => {
        setProfileMediaToast('An error has occurred.')
      }
      reader.readAsDataURL(file)
    } catch {
      setProfileMediaToast('An error has occurred.')
    }
  }

  const COVER_STYLE_KEYS = ['photo', 'auto', 'g1', 'g2', 'g3', 'g4'] as const

  const getCurrentStyleKey = () => {
    if (collectionCoverMode === 'custom') return 'photo'
    if (collectionCoverMode === 'auto') return 'auto'
    return `g${collectionGradientVariant}` as const
  }

  const applyCoverStyleKey = (key: typeof COVER_STYLE_KEYS[number]) => {
    if (key === 'photo') {
      setCollectionCoverMode('custom')
    } else if (key === 'auto') {
      setCollectionCoverMode('auto')
    } else if (key === 'g1') {
      setCollectionCoverMode('gradient')
      setCollectionGradientVariant(1)
    } else if (key === 'g2') {
      setCollectionCoverMode('gradient')
      setCollectionGradientVariant(2)
    } else if (key === 'g3') {
      setCollectionCoverMode('gradient')
      setCollectionGradientVariant(3)
    } else if (key === 'g4') {
      setCollectionCoverMode('gradient')
      setCollectionGradientVariant(4)
    }
  }

  const handlePrevCoverStyle = () => {
    const cur = getCurrentStyleKey()
    const idx = COVER_STYLE_KEYS.indexOf(cur)
    const prevIdx = (idx - 1 + COVER_STYLE_KEYS.length) % COVER_STYLE_KEYS.length
    applyCoverStyleKey(COVER_STYLE_KEYS[prevIdx])
  }

  const handleNextCoverStyle = () => {
    const cur = getCurrentStyleKey()
    const idx = COVER_STYLE_KEYS.indexOf(cur)
    const nextIdx = (idx + 1) % COVER_STYLE_KEYS.length
    applyCoverStyleKey(COVER_STYLE_KEYS[nextIdx])
  }

  const handleSaveCollection = () => {
    try {
      if (!collectionName.trim()) {
        setProfileMediaToast('Please enter a collection name.')
        return
      }
      if (collectionCoverMode === 'custom' && !collectionCustomCover) {
        setProfileMediaToast('No pictures added')
        return
      }
      const editedCollection = collectionEditingId
        ? profileCollections.find((collection) => collection.id === collectionEditingId)
        : undefined
      const savedItems = collectionComposerMode === 'add'
        ? [...collectionSelectedItems, ...(editedCollection?.items ?? [])]
        : uniqueProfileCollectionItems(collectionSelectedItems)
      const selectedTypes = [...new Set(savedItems.map((item) => item.type))]
      const collectionDetails = {
        creatorName: editedCollection?.creatorName || profileDisplayName,
        creatorHandle: editedCollection?.creatorHandle || userProfile.handle.replace(/^@/, ''),
        description: collectionDescription.trim(),
        entryIds: savedItems.flatMap((item) => item.entryId ? [item.entryId] : []),
        items: savedItems,
        coverMode: collectionCoverMode,
        coverStyle: collectionCoverMode === 'gradient' ? `gradient-${collectionGradientVariant}` : undefined,
        customCoverUrl: collectionCoverMode === 'custom'
          ? collectionCustomCover
          : collectionCoverMode === 'gradient'
            ? generateCollectionGradientSvg(collectionName.trim() || 'Untitled Collection', collectionGradientVariant, savedItems)
            : '',
      }
      const nextCollections = collectionEditingId
        ? profileCollections.map((collection) => collection.id === collectionEditingId
          ? { ...collection, name: collectionName.trim(), types: selectedTypes, ...collectionDetails }
          : collection)
        : [createProfileCollection(collectionName, selectedTypes, collectionDetails), ...profileCollections]
      setProfileCollections(nextCollections)
      persistCreatedCollections(nextCollections)
      collectionInitialSnapshotRef.current = null
      setCollectionComposerOpen(false)
      setProfileMediaToast(collectionEditingId ? 'Collection updated.' : 'Collection created.')
    } catch {
      setProfileMediaToast('An error has occurred.')
    }
  }

  const confirmRemoveCollectionItem = () => {
    if (!collectionRemovalTarget) return
    setCollectionSelectedItems((current) => current.filter((item) => item.id !== collectionRemovalTarget.id))
    setCollectionRemovalTarget(null)
  }

  const startInlineCollectionEdit = () => {
    if (!selectedCollection) return
    const initialName = selectedCollection.name
    const initialDesc = selectedCollection.description ?? ''
    const mode = selectedCollection.coverMode
      || (selectedCollection.customCoverUrl ? 'custom' : selectedCollection.coverStyle?.startsWith('gradient-') ? 'gradient' : 'auto')
    const initialCover = selectedCollection.customCoverUrl ?? ''
    const rawVariant = selectedCollection.coverStyle?.startsWith('gradient-')
      ? Number(selectedCollection.coverStyle.replace('gradient-', ''))
      : 1
    const initialVariant = (rawVariant >= 1 && rawVariant <= 4 ? rawVariant : 1) as 1 | 2 | 3 | 4

    setCollectionName(initialName)
    setCollectionDescription(initialDesc)
    setCollectionCoverMode(mode)
    setCollectionCustomCover(initialCover)
    setCollectionGradientVariant(initialVariant)
    setCollectionInlineRemovalTarget(null)

    collectionInlineInitialRef.current = {
      name: initialName,
      description: initialDesc,
      coverMode: mode,
      gradientVariant: initialVariant,
      customCover: initialCover,
    }

    setCollectionInlineEditing(true)
  }

  const hasInlineCollectionChanges = () => {
    if (!collectionInlineInitialRef.current) return false
    const initial = collectionInlineInitialRef.current
    return (
      collectionName !== initial.name ||
      collectionDescription !== initial.description ||
      collectionCoverMode !== initial.coverMode ||
      collectionCustomCover !== initial.customCover ||
      collectionGradientVariant !== initial.gradientVariant
    )
  }

  const cancelInlineCollectionEdit = () => {
    if (hasInlineCollectionChanges()) {
      setCollectionInlineDiscardConfirmOpen(true)
    } else {
      setCollectionInlineEditing(false)
      setCollectionInlineRemovalTarget(null)
    }
  }

  const handleConfirmInlineDiscard = () => {
    setCollectionInlineDiscardConfirmOpen(false)
    if (collectionInlineInitialRef.current) {
      setCollectionName(collectionInlineInitialRef.current.name)
      setCollectionDescription(collectionInlineInitialRef.current.description)
      setCollectionCoverMode(collectionInlineInitialRef.current.coverMode)
      setCollectionCustomCover(collectionInlineInitialRef.current.customCover)
      setCollectionGradientVariant(collectionInlineInitialRef.current.gradientVariant)
    }
    setCollectionInlineEditing(false)
    setCollectionInlineRemovalTarget(null)
  }

  const saveInlineCollectionEdit = (reorderedItemIds?: string[]) => {
    try {
      if (!selectedCollection) return
      if (!collectionName.trim()) {
        setProfileMediaToast('Please enter a collection name.')
        return
      }
      if (collectionCoverMode === 'custom' && !collectionCustomCover) {
        setProfileMediaToast('No pictures added')
        return
      }
      let updatedItems = selectedCollection.items || []
      if (reorderedItemIds && reorderedItemIds.length > 0) {
        const itemMap = new Map(updatedItems.map((item) => [item.id, item]))
        const entryIdMap = new Map(updatedItems.filter((i) => i.entryId).map((item) => [item.entryId!, item]))
        const reordered: ProfileCollectionItem[] = []
        const usedIds = new Set<string>()
        for (const id of reorderedItemIds) {
          const item =
            itemMap.get(id) ||
            entryIdMap.get(id) ||
            updatedItems.find((i) => i.id === `entry:${id}` || `entry:${i.id}` === id)
          if (item && !usedIds.has(item.id)) {
            reordered.push(item)
            usedIds.add(item.id)
          }
        }
        for (const item of updatedItems) {
          if (!usedIds.has(item.id)) {
            reordered.push(item)
          }
        }
        updatedItems = reordered
      }
      let updatedEntryIds = selectedCollection.entryIds
      if (reorderedItemIds && reorderedItemIds.length > 0 && updatedEntryIds) {
        const reorderedIds: string[] = []
        const usedEntryIds = new Set<string>()
        for (const id of reorderedItemIds) {
          if (updatedEntryIds.includes(id) && !usedEntryIds.has(id)) {
            reorderedIds.push(id)
            usedEntryIds.add(id)
          }
        }
        for (const id of updatedEntryIds) {
          if (!usedEntryIds.has(id)) {
            reorderedIds.push(id)
          }
        }
        updatedEntryIds = reorderedIds
      }
      const nextCollections = profileCollections.map((collection) => collection.id === selectedCollection.id
        ? {
            ...collection,
            items: updatedItems,
            entryIds: updatedEntryIds,
            name: collectionName.trim(),
            description: collectionDescription.trim(),
            coverMode: collectionCoverMode,
            coverStyle: collectionCoverMode === 'gradient' ? `gradient-${collectionGradientVariant}` : undefined,
            customCoverUrl: collectionCoverMode === 'custom'
              ? collectionCustomCover
              : collectionCoverMode === 'gradient'
                ? generateCollectionGradientSvg(collectionName.trim() || 'Untitled Collection', collectionGradientVariant, updatedItems)
                : '',
          }
        : collection)
      setProfileCollections(nextCollections)
      persistCreatedCollections(nextCollections)
      setCollectionInlineEditing(false)
      setProfileMediaToast('Collection updated.')
    } catch {
      setProfileMediaToast('An error has occurred.')
    }
  }

  const setCollectionVisibility = (collection: ProfileCollection, isHidden: boolean) => {
    const nextCollections = profileCollections.map((item) =>
      item.id === collection.id ? { ...item, isHidden } : item
    )
    setProfileCollections(nextCollections)
    persistCreatedCollections(nextCollections)
  }

  const handleToggleHideCollection = () => {
    if (!selectedCollection) return
    try {
      setCollectionVisibility(selectedCollection, !selectedCollection.isHidden)
      setProfileMediaToast(selectedCollection.isHidden ? 'Collection is now visible on profile.' : 'Collection hidden from profile.')
    } catch {
      setProfileMediaToast('An error has occurred.')
    }
  }

  const handleShareCollectionCard = async (collection: ProfileCollection) => {
    const url = `${window.location.origin}/users/${routeSegment(userProfile.handle)}/collections/${routeSegment(collection.id)}`
    try {
      await navigator.clipboard.writeText(url)
      setCollectionCardMenuCopiedId(collection.id)
      window.setTimeout(() => {
        setCollectionCardMenuCopiedId((current) => current === collection.id ? null : current)
      }, 1800)
    } catch (error) {
      console.error('Unable to copy collection link.', error)
    }
  }

  const handleToggleCollectionVisibilityFromCard = (collection: ProfileCollection) => {
    setCollectionVisibility(collection, !collection.isHidden)
    setCollectionCardMenuId(null)
  }

  const confirmInlineCollectionRemoval = () => {
    if (!selectedCollection || !collectionInlineRemovalTarget) return
    try {
      const targetId = collectionInlineRemovalTarget.id
      const remainingItems = selectedCollection.items?.filter(
        (item) => item.id !== targetId && item.entryId !== targetId,
      )
      const remainingEntryIds = selectedCollection.entryIds?.filter((id) => id !== targetId)
      const updatedCollection: ProfileCollection = {
        ...selectedCollection,
        items: remainingItems,
        entryIds: remainingEntryIds,
        types: remainingItems
          ? [...new Set(remainingItems.map((item) => item.type))]
          : selectedCollection.types,
      }
      const nextCollections = profileCollections.map((collection) =>
        collection.id === selectedCollection.id ? updatedCollection : collection,
      )
      setProfileCollections(nextCollections)
      persistCreatedCollections(nextCollections)
      setCollectionInlineRemovalTarget(null)
      setProfileMediaToast('Item removed from collection.')
    } catch {
      setProfileMediaToast('An error has occurred.')
    }
  }

  const handleDeleteCollection = (collection: ProfileCollection) => {
    setCollectionDeleteTarget(collection)
  }

  const confirmDeleteCollection = () => {
    if (!collectionDeleteTarget) return
    try {
      const collection = collectionDeleteTarget
      const nextCollections = profileCollections.filter((item) => item.id !== collection.id)
      setProfileCollections(nextCollections)
      persistCreatedCollections(nextCollections)
      setCollectionDeleteTarget(null)
      if (selectedCollectionId === collection.id) {
        setSelectedCollectionId(null)
        setCatalogMode('collections')
        setCollectionReturnMode('collections')
        onCloseCollectionPage?.()
      }
      setProfileMediaToast('Collection deleted.')
    } catch {
      setProfileMediaToast('An error has occurred.')
    }
  }

  const toggleSaveCollection = (collection: ProfileCollection) => {
    const creatorHandle = collection.creatorHandle?.replace(/^@/, '') || userProfile.handle.replace(/^@/, '')
    const identityMatches = (item: ProfileCollection) =>
      item.id === collection.id
      && (item.creatorHandle?.replace(/^@/, '') || creatorHandle) === creatorHandle
    const alreadySaved = viewerSavedProfileCollections.some(identityMatches)
    const nextCollections = alreadySaved
      ? viewerSavedProfileCollections.filter((item) => !identityMatches(item))
      : [{
          ...collection,
          creatorName: collection.creatorName || profileDisplayName,
          creatorHandle,
        }, ...viewerSavedProfileCollections]
    setViewerSavedProfileCollections(nextCollections)
    persistSavedCollections(nextCollections)
  }

  const handleOpenCollection = (collection: ProfileCollection) => {
    startProfileContentLoading(280)
    const returnMode: CollectionCatalogMode = isSavedCollectionsMode ? 'saved-collections' : 'collections'
    setCollectionReturnMode(returnMode)
    setCatalogMode(returnMode)
    setSelectedCollectionId(collection.id)
    setCollectionInlineEditing(false)
    onOpenCollectionPage?.(collection.id)
  }

  const handleBackToCollections = () => {
    const returnMode: CollectionCatalogMode = selectedCollectionIsFromSavedView ? 'saved-collections' : 'collections'
    setCollectionReturnMode(returnMode)
    setCatalogMode(returnMode)
    setSelectedCollectionId(null)
    setCollectionInlineEditing(false)
    onCloseCollectionPage?.()
  }

  // ── Stats ───────────────────────────────────────────────────────────────────
  const stats = [
    { id: 'all', label: 'All', count: activeDataset.length, Icon: Layers },
    { id: 'album', label: 'Albums', count: albumsCount, Icon: getEntryTypeIcon('album') },
    { id: 'book', label: 'Books', count: booksCount, Icon: getEntryTypeIcon('book') },
    { id: 'film', label: 'Films', count: filmsCount, Icon: getEntryTypeIcon('film') },
    { id: 'game', label: 'Games', count: gamesCount, Icon: getEntryTypeIcon('game') },
    { id: 'song', label: 'Songs', Icon: getEntryTypeIcon('song'), count: songsCount },
    { id: 'tv', label: 'Shows', count: showsCount, Icon: getEntryTypeIcon('tv') },
  ]

  const displayName = profileDisplayName
  const handleFormatted = `@${userProfile.handle.replace(/^@/, '')}`
  const showDisplayName = hasDistinctProfileDisplayName(displayName, userProfile.handle)
  const memberSinceValue = memberSinceShortLabel(userProfile.createdAt)

  if (!isOwnProfile && userProfile.accountStatus === 'deactivated') {
    return (
      <motion.div
        className="page-wrapper profile-page-wrapper"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
      >
        {showLocalNavigation && (
          <button
            type="button"
            className="profile-back-circle"
            onClick={onBack}
            title="Back"
            aria-label="Back"
          >
            <ArrowLeft aria-hidden="true" />
          </button>
        )}
        <div className="profile-unavailable-state" role="status">
          <div className="profile-unavailable-icon"><AlertTriangle aria-hidden="true" /></div>
          <span>{displayName}</span>
          <h1>There is a problem loading this account</h1>
          <p>This account is unavailable right now. Its profile and activity are hidden.</p>
          <button type="button" className="secondary-action-btn" onClick={onBack}>
            <ArrowLeft aria-hidden="true" />
            Go back
          </button>
        </div>
      </motion.div>
    )
  }
  // ── Type icon helper ────────────────────────────────────────────────────────
  const getTypeMeta = (type: string) => {
    switch (type) {
      case 'album': return { Icon: getEntryTypeIcon('album'), label: 'Albums' }
      case 'book': return { Icon: getEntryTypeIcon('book'), label: 'Books' }
      case 'film': return { Icon: getEntryTypeIcon('film'), label: 'Films' }
      case 'game': return { Icon: getEntryTypeIcon('game'), label: 'Games' }
      case 'song': return { Icon: getEntryTypeIcon('song'), label: 'Songs' }
      case 'tv': return { Icon: getEntryTypeIcon('tv'), label: 'Shows' }
      default: return { Icon: BookOpen, label: 'Books' }
    }
  }

  const renderCollectionCoverArtwork = ({
    name,
    coverMode,
    coverStyle,
    customCoverUrl,
    items,
  }: {
    name: string
    coverMode?: 'auto' | 'custom' | 'gradient'
    coverStyle?: string
    customCoverUrl?: string
    items: Array<{ id?: string; type: EntryType; coverUrl?: string; coverTone?: string }>
  }) => {
    const isGradient = coverMode === 'gradient'
      || Boolean(coverStyle?.startsWith('gradient-'))
      || Boolean(customCoverUrl?.startsWith('data:image/svg+xml'))

    if (isGradient) {
      const rawVariant = coverStyle?.startsWith('gradient-')
        ? Number(coverStyle.replace('gradient-', ''))
        : 1
      const variant = (rawVariant >= 1 && rawVariant <= 4 ? rawVariant : 1) as 1 | 2 | 3 | 4
      const isDark = variant === 1 || variant === 2
      return (
        <div
          className={`collection-apple-cover variant-${variant} ${items.length === 0 ? 'no-items' : ''}`}
          style={getGradientCoverStyle(variant, items)}
        >
          <span
            className="collection-apple-cover-title"
            style={{
              color: items.length === 0
                ? 'rgba(237, 229, 216, 0.45)'
                : (isDark ? '#ffffff' : '#0e0d0b'),
              textShadow: (items.length > 0 && isDark)
                ? '0 2px 10px rgba(0, 0, 0, 0.55)'
                : 'none',
            }}
          >
            {name.trim() || 'Untitled Collection'}
          </span>
        </div>
      )
    }

    const isCustom = (coverMode === 'custom' || (!coverMode && customCoverUrl && !customCoverUrl.startsWith('data:image/svg+xml'))) && Boolean(customCoverUrl)
    if (isCustom && customCoverUrl) {
      return <img className="collection-preview-custom-cover" src={customCoverUrl} alt="" loading="lazy" decoding="async" />
    }

    return (
      <div className="collection-preview-collage-grid">
        {Array.from({ length: 4 }, (_, index) => {
          const entry = items[index]
          return (
            <span key={entry?.id ?? `empty-cover-slot-${index}`} className={!entry ? 'empty' : ''}>
              {entry && (entry.coverUrl
                ? <img src={entry.coverUrl} alt="" loading="lazy" decoding="async" />
                : React.createElement(getTypeMeta(entry.type).Icon))}
            </span>
          )
        })}
      </div>
    )
  }

  return (
    <motion.div
      className={`page-wrapper profile-page-wrapper ${selectedCollection ? 'is-collection-page' : ''} ${!selectedCollection ? 'is-minimal-profile' : ''} ${!selectedCollection && isInlineProfileEditing ? 'is-inline-profile-editing' : ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      {/* Top Floating Circle Back Button */}
      {showLocalNavigation && <button
        type="button"
        className="profile-back-circle"
        onClick={onBack}
        title="Back to Feed"
        aria-label="Back to Feed"
      >
        <ArrowLeft aria-hidden="true" />
      </button>}

      <div className="profile-page-container">
        {!selectedCollection && (
          <>
        {/* Banner Hero */}
        <div
          className={`profile-page-banner ${isOwnProfile && onUpdateProfile ? 'is-inline-editable' : ''} ${userProfile.coverUrl ? 'has-custom-cover' : 'is-default-cover'}`}
          style={{
            backgroundImage: userProfile.coverUrl
              ? `url('${userProfile.coverUrl}')`
              : undefined,
          }}
        >
          {isOwnProfile && onUpdateProfile && isInlineProfileEditing && (
            <>
              <input
                ref={inlineCoverInputRef}
                type="file"
                accept="image/*"
                className="profile-inline-media-input"
                onChange={handleInlineCoverFile}
              />
              <input
                ref={inlineAvatarInputRef}
                type="file"
                accept="image/*"
                className="profile-inline-media-input"
                onChange={handleInlineAvatarFile}
              />
              <button
                type="button"
                className="profile-inline-cover-edit"
                onClick={() => inlineCoverInputRef.current?.click()}
                aria-label="Change cover photo"
                title="Change cover photo"
              >
                <ImagePlus aria-hidden="true" />
                <span>Cover photo</span>
              </button>
            </>
          )}

          <div className="profile-page-avatar">
            {userProfile.avatarUrl ? (
              <img src={userProfile.avatarUrl} alt={displayName} className="profile-avatar-img" referrerPolicy="no-referrer" />
            ) : (
              <User aria-hidden="true" />
            )}
            {isOwnProfile && onUpdateProfile && isInlineProfileEditing && (
              <button
                type="button"
                className="profile-inline-avatar-edit"
                onClick={() => inlineAvatarInputRef.current?.click()}
                aria-label="Change profile picture"
                title="Change profile picture"
              >
                <Edit3 aria-hidden="true" />
                <span>Change</span>
              </button>
            )}
          </div>

          {inlineMediaError && (
            <span className="profile-inline-media-error" role="alert">{inlineMediaError}</span>
          )}

          {!isOwnProfile && (
            <button
              type="button"
              className="profile-report-btn"
              onClick={() => setProfileReportOpen(true)}
              title="Report profile"
            >
              <Flag aria-hidden="true" />
              <span>Report</span>
            </button>
          )}

          {!isOwnProfile && (isLockedPrivate ? (
            <button
              type="button"
              className={`edit-profile-btn ${isFollowingUser || isFollowRequested ? 'is-following' : ''}`}
              onClick={() => isFollowingUser
                ? onToggleFollowUser?.(userProfile.handle)
                : onToggleFollowRequest?.(userProfile.handle)}
              style={{
                background: isFollowingUser || isFollowRequested ? 'rgba(255,255,255,0.08)' : 'var(--accent)',
                color: isFollowingUser || isFollowRequested ? 'var(--text-strong)' : '#0e0b06',
                borderColor: isFollowingUser || isFollowRequested ? 'rgba(255,255,255,0.15)' : 'var(--accent)',
              }}
            >
              {isFollowingUser || isFollowRequested ? <UserCheck size={14} /> : <UserPlus size={14} />}
              <span>{isFollowingUser ? 'Following' : isFollowRequested ? 'Requested' : 'Request to Follow'}</span>
            </button>
          ) : (
            <button
              type="button"
              className={`edit-profile-btn ${isFollowingUser ? 'is-following' : ''}`}
              onClick={() => onToggleFollowUser?.(userProfile.handle)}
              style={{
                background: isFollowingUser ? 'rgba(255,255,255,0.08)' : 'var(--accent)',
                color: isFollowingUser ? 'var(--text-strong)' : '#0e0b06',
                borderColor: isFollowingUser ? 'rgba(255,255,255,0.15)' : 'var(--accent)',
              }}
            >
              {isFollowingUser ? <UserCheck size={14} /> : <UserPlus size={14} />}
              <span>{isFollowingUser ? 'Following' : 'Follow'}</span>
            </button>
          ))}

        </div>

        {inlineAvatarCropImage && onUpdateProfile && (
          <AvatarCropperDialog
            imageUrl={inlineAvatarCropImage}
            onCancel={() => setInlineAvatarCropImage('')}
            onApply={async (url) => {
              try {
                await onUpdateProfile({ ...userProfile, avatarUrl: url })
                setInlineAvatarCropImage('')
                setProfileMediaToast('Profile picture updated successfully.')
              } catch (error) {
                console.error('Unable to update profile picture.', error)
                setInlineMediaError('Profile picture could not be saved. Please try again.')
              }
            }}
          />
        )}

        {inlineCoverCropImage && onUpdateProfile && (
          <CoverCropperDialog
            imageUrl={inlineCoverCropImage}
            onCancel={() => setInlineCoverCropImage('')}
            onApply={async (url) => {
              try {
                await onUpdateProfile({ ...userProfile, coverUrl: url })
                setInlineCoverCropImage('')
                setProfileMediaToast('Cover photo updated successfully.')
              } catch (error) {
                console.error('Unable to update cover photo.', error)
                setInlineMediaError('Cover photo could not be saved. Please try again.')
              }
            }}
          />
        )}

        {/* Identity Details */}
        <div className="profile-page-header">
          <div className="profile-header-main-row">
            <div className="profile-page-names">
              {isInlineProfileEditActive ? (
                <div className="profile-inline-name-row">
                  <input
                    type="text"
                    className="profile-inline-name-input"
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    placeholder="First name"
                    aria-label="First name"
                    disabled={isSavingProfile}
                    autoFocus
                  />
                  <input
                    type="text"
                    className="profile-inline-name-input"
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    placeholder="Last name"
                    aria-label="Last name"
                    disabled={isSavingProfile}
                  />
                </div>
              ) : showDisplayName ? (
                <h1 className="profile-page-name">{displayName}</h1>
              ) : (
                <h1 className="profile-page-name">{handleFormatted}</h1>
              )}
              {isInlineProfileEditActive ? (
                <>
                  <span className="profile-inline-handle-hint">{handleFormatted}</span>
                  <p className="profile-inline-username-note">
                    You can change your username in the settings.
                  </p>
                </>
              ) : showDisplayName && (
                <div className="profile-handle-row">
                  <span className="profile-page-handle">{handleFormatted}</span>
                </div>
              )}
            </div>

            {isOwnProfile && onUpdateProfile && !isInlineProfileEditActive && (
              <button
                type="button"
                className="profile-edit-name-desc-btn"
                onClick={handleStartInlineProfileEdit}
                title="Edit profile name and description"
              >
                <Edit3 size={13} aria-hidden="true" />
                <span>Edit name & bio</span>
              </button>
            )}
          </div>

          {isInlineProfileEditActive ? (
            <div className="profile-inline-bio-group">
              <label className="profile-inline-label" htmlFor="profile-inline-bio">Bio / Description</label>
              <textarea
                id="profile-inline-bio"
                className="profile-inline-bio-input"
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                maxLength={300}
                rows={4}
                placeholder="Tell your story, your tastes in literature, cinema, music, or reflections..."
                disabled={isSavingProfile}
              />
              <div className="profile-inline-bio-meta">
                {editProfileError ? (
                  <span className="profile-inline-error" role="alert">{editProfileError}</span>
                ) : <span />}
                <span className="profile-inline-char-count">{editBio.length}/300</span>
              </div>
              <div className="profile-inline-edit-actions">
                <button
                  type="button"
                  className="profile-inline-save-btn"
                  onClick={handleSaveInlineProfile}
                  disabled={isSavingProfile || !editFirstName.trim()}
                >
                  <Check size={14} aria-hidden="true" />
                  <span>{isSavingProfile ? 'Saving...' : 'Done Editing'}</span>
                </button>
                <button
                  type="button"
                  className="profile-inline-cancel-btn"
                  onClick={handleCancelInlineProfileEdit}
                  disabled={isSavingProfile}
                >
                  <span>Discard</span>
                </button>
              </div>
            </div>
          ) : userProfile.bio ? (
            <p className="profile-page-bio">{userProfile.bio}</p>
          ) : isOwnProfile && onUpdateProfile ? (
            <button
              type="button"
              className="profile-empty-bio-prompt"
              onClick={handleStartInlineProfileEdit}
            >
              <Plus size={13} aria-hidden="true" />
              <span>Add a bio to your profile...</span>
            </button>
          ) : null}

          {/* Redesigned Metrics & Social Placement */}
          <div className="profile-metrics-row">
            <div className="profile-curator-score" title="Curator Average Rating">
              <span className="score-val">{avgRating}</span>
              <div className="stat-label-wrap">
                <Star size={12} className="star-gold" fill="#f5c518" color="#f5c518" aria-hidden="true" />
                <span className="score-lbl">Avg Rating</span>
              </div>
            </div>

            <span className="profile-metrics-separator" aria-hidden="true">·</span>

            <div className="profile-social-counters">
              <button
                type="button"
                className="profile-social-stat-btn"
                onClick={() => { setActiveFollowModal('followers'); setFollowSearch('') }}
                aria-label={`${dynamicFollowersList.length} Followers`}
              >
                <strong className="stat-count">{dynamicFollowersList.length}</strong>
                <div className="stat-label-wrap">
                  <Users size={12} className="stat-sub-icon" aria-hidden="true" />
                  <span className="stat-label">Followers</span>
                </div>
              </button>

              <span className="profile-metrics-separator" aria-hidden="true">·</span>

              <button
                type="button"
                className="profile-social-stat-btn"
                onClick={() => { setActiveFollowModal('following'); setFollowSearch('') }}
                aria-label={`${dynamicFollowingList.length} Following`}
              >
                <strong className="stat-count">{dynamicFollowingList.length}</strong>
                <div className="stat-label-wrap">
                  <UserCheck size={12} className="stat-sub-icon" aria-hidden="true" />
                  <span className="stat-label">Following</span>
                </div>
              </button>
            </div>

            {memberSinceValue && (
              <div className="profile-minimal-joined-stat">
                <span className="profile-minimal-stat-value">{memberSinceValue}</span>
                <div className="stat-label-wrap">
                  <Calendar size={12} className="stat-sub-icon" aria-hidden="true" />
                  <span className="profile-minimal-stat-label">Member since</span>
                </div>
              </div>
            )}
          </div>
        </div>

          </>
        )}

        {/* ── Catalog Section (locked if private & not following) ─────────────── */}
        {isLockedPrivate ? (
          <div className="profile-private-locked">
            <div className="private-locked-icon">
              <Lock size={32} />
            </div>
            <h3 className="private-locked-title">This Profile is Private</h3>
            <p className="private-locked-subtitle">
              Private catalogs become visible only when you and @{userProfile.handle.replace(/^@/, '')} follow each other.
            </p>
            <button
              type="button"
              className="edit-profile-btn"
              style={{
                position: 'static',
                background: isFollowingUser || isFollowRequested ? 'rgba(255,255,255,0.08)' : 'var(--accent)',
                color: isFollowingUser || isFollowRequested ? 'var(--text-strong)' : '#0e0b06',
                borderColor: isFollowingUser || isFollowRequested ? 'rgba(255,255,255,0.15)' : 'var(--accent)',
                padding: '10px 24px',
                fontSize: '13px',
              }}
              onClick={() => isFollowingUser
                ? onToggleFollowUser?.(userProfile.handle)
                : onToggleFollowRequest?.(userProfile.handle)}
            >
              {isFollowingUser || isFollowRequested ? (
                <>
                  <UserCheck size={14} />
                  <span>{isFollowingUser ? 'Following' : 'Requested'}</span>
                </>
              ) : (
                <>
                  <UserPlus size={14} />
                  <span>Request to Follow</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <section className="profile-catalog-section">
            {!isCollectionDetail && (
              <div className="profile-catalog-tabs-wrapper">
                <div className="profile-catalog-tabs" role="tablist" aria-label="Profile catalog view" onKeyDown={handleTabListKeyDown}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={catalogMode === 'reviewed'}
                    tabIndex={catalogMode === 'reviewed' ? 0 : -1}
                    className={`profile-catalog-tab ${catalogMode === 'reviewed' ? 'active' : ''}`}
                    onClick={() => handleCatalogModeChange('reviewed')}
                  >
                    <BookOpen size={14} aria-hidden="true" />
                    <span>Catalogs</span>
                    <span className="profile-tab-count" aria-hidden="true">{catalogsCount}</span>
                    {catalogMode === 'reviewed' && (
                      <motion.span
                        className="profile-catalog-tab-active-indicator"
                        layoutId={`profile-catalog-tab-${userProfile.handle}`}
                        transition={{
                          type: 'spring',
                          stiffness: 480,
                          damping: 34,
                          mass: 0.6,
                        }}
                      />
                    )}
                  </button>

                  <button
                    type="button"
                    role="tab"
                    aria-selected={catalogMode === 'collections'}
                    tabIndex={catalogMode === 'collections' ? 0 : -1}
                    className={`profile-catalog-tab ${catalogMode === 'collections' ? 'active' : ''}`}
                    onClick={() => handleCatalogModeChange('collections')}
                  >
                    <FolderHeart size={14} aria-hidden="true" />
                    <span>Collections</span>
                    <span className="profile-tab-count" aria-hidden="true">{collectionsCount}</span>
                    {catalogMode === 'collections' && (
                      <motion.span
                        className="profile-catalog-tab-active-indicator"
                        layoutId={`profile-catalog-tab-${userProfile.handle}`}
                        transition={{
                          type: 'spring',
                          stiffness: 480,
                          damping: 34,
                          mass: 0.6,
                        }}
                      />
                    )}
                  </button>

                  {canViewSavedActivity && (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={catalogMode === 'shelf'}
                      tabIndex={catalogMode === 'shelf' ? 0 : -1}
                      className={`profile-catalog-tab ${catalogMode === 'shelf' ? 'active' : ''}`}
                      onClick={() => handleCatalogModeChange('shelf')}
                    >
                      <Bookmark size={14} aria-hidden="true" />
                      <span>Saved Catalog</span>
                      {isOwnProfile && userProfile.showSavedActivity !== true && (
                        <span
                          className="profile-catalog-tab-lock"
                          aria-label="Saved catalog is private"
                          title="Only you can see your saved catalog"
                        >
                          <Lock size={12} aria-hidden="true" />
                        </span>
                      )}
                      <span className="profile-tab-count" aria-hidden="true">{savedCatalogCount}</span>
                      {catalogMode === 'shelf' && (
                        <motion.span
                          className="profile-catalog-tab-active-indicator"
                          layoutId={`profile-catalog-tab-${userProfile.handle}`}
                          transition={{
                            type: 'spring',
                            stiffness: 480,
                            damping: 34,
                            mass: 0.6,
                          }}
                        />
                      )}
                    </button>
                  )}

                  {canViewSavedActivity && (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={catalogMode === 'saved-collections'}
                      tabIndex={catalogMode === 'saved-collections' ? 0 : -1}
                      className={`profile-catalog-tab ${catalogMode === 'saved-collections' ? 'active' : ''}`}
                      onClick={() => handleCatalogModeChange('saved-collections')}
                    >
                      <FolderPlus size={14} aria-hidden="true" />
                      <span>Saved Collections</span>
                      {isOwnProfile && userProfile.showSavedActivity !== true && (
                        <span
                          className="profile-catalog-tab-lock"
                          aria-label="Saved collections are private"
                          title="Only you can see your saved collections"
                        >
                          <Lock size={12} aria-hidden="true" />
                        </span>
                      )}
                      <span className="profile-tab-count" aria-hidden="true">{savedCollectionsCount}</span>
                      {catalogMode === 'saved-collections' && (
                        <motion.span
                          className="profile-catalog-tab-active-indicator"
                          layoutId={`profile-catalog-tab-${userProfile.handle}`}
                          transition={{
                            type: 'spring',
                            stiffness: 480,
                            damping: 34,
                            mass: 0.6,
                          }}
                        />
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}

            {selectedCollection ? (
              <AlternativeCollectionDetail
                collection={selectedCollection}
                items={selectedCollectionEntries}
                creatorHandle={selectedCollectionCreatorHandle}
                creatorName={selectedCollectionCreatorName}
                currentUserHandle={currentUserHandle}
                isOwnedByCurrentUser={selectedCollectionIsOwnedByCurrentUser}
                isSaved={selectedCollectionIsSaved}
                isEditingInline={collectionInlineEditing}
                collectionName={collectionName}
                setCollectionName={setCollectionName}
                collectionDescription={collectionDescription}
                setCollectionDescription={setCollectionDescription}
                onSaveInlineEdit={saveInlineCollectionEdit}
                onCancelInlineEdit={cancelInlineCollectionEdit}
                onBack={handleBackToCollections}
                onOpenMedia={onOpenMediaProfile}
                onSelectEntry={onSelectEntry}
                onOpenCreator={onOpenEntryCreator}
                onOpenUserProfile={onSelectUserProfile}
                onAddMedia={() => openCollectionComposer(selectedCollection, 'add')}
                onStartInlineEdit={startInlineCollectionEdit}
                onDeleteCollection={() => handleDeleteCollection(selectedCollection)}
                onToggleSave={() => toggleSaveCollection(selectedCollection)}
                followersCount={dynamicFollowersList.length}
                followingCount={dynamicFollowingList.length}
                isFollowingUser={isFollowingUser}
                onToggleFollow={() => isFollowingUser
                  ? onToggleFollowUser?.(userProfile.handle)
                  : onToggleFollowRequest?.(userProfile.handle)}
                onRemoveItem={(entry) => setCollectionInlineRemovalTarget(entry)}
                collectionCoverMode={collectionCoverMode}
                setCollectionCoverMode={setCollectionCoverMode}
                collectionCustomCover={collectionCustomCover}
                setCollectionCustomCover={setCollectionCustomCover}
                collectionGradientVariant={collectionGradientVariant}
                setCollectionGradientVariant={setCollectionGradientVariant}
                onCoverUpload={handleCollectionCoverUpload}
                onToggleHideFromProfile={handleToggleHideCollection}
                onToast={(msg) => setProfileMediaToast(msg)}
                renderCoverArtwork={() => renderCollectionCoverArtwork({
                  name: collectionInlineEditing ? collectionName : selectedCollection.name,
                  coverMode: collectionInlineEditing ? collectionCoverMode : selectedCollection.coverMode,
                  coverStyle: collectionInlineEditing
                    ? (collectionCoverMode === 'gradient' ? `gradient-${collectionGradientVariant}` : undefined)
                    : selectedCollection.coverStyle,
                  customCoverUrl: collectionInlineEditing ? collectionCustomCover : selectedCollection.customCoverUrl,
                  items: selectedCollectionEntries,
                })}
              />
            ) : (
              <>
                <div className={`profile-catalog-header ${isCollectionDetail ? 'has-collection-detail' : ''}`}>

              {/* Render only the active title so outgoing and incoming catalog states never share the header. */}
                {catalogMode === 'reviewed' ? (
                  <div
                    key="header-reviewed"
                    className="catalog-header-title-group"
                  >
                    <h2 className="profile-catalog-title">
                      Created Catalog
                    </h2>
                  </div>
                ) : catalogMode === 'shelf' ? (
                  <div
                    key="header-shelf"
                    className="catalog-header-title-group"
                  >
                    <h2 className="profile-catalog-title">
                      Saved Catalog
                    </h2>
                    <span className="catalog-privacy-note">
                      {isOwnProfile ? 'Saved entries are only visible to you unless you share them in Privacy settings' : `Saved activity shared by ${displayName}`}
                    </span>
                  </div>
                ) : (
                  <div
                    key="header-collections"
                    className="catalog-header-title-group"
                  >
                    {isCollectionDetail ? (
                      <CollectionDetailHeroSkeleton />
                    ) : (
                      <>
                        <h2 className="profile-catalog-title">
                          {isSavedCollectionsMode ? 'Saved Collections' : 'Created Collections'}
                        </h2>
                        <span className="catalog-privacy-note">
                          {isSavedCollectionsMode
                            ? isOwnProfile
                              ? 'Collections you saved from other profiles'
                              : `Saved collections shared by ${displayName}`
                            : 'Group one or several media types into a personal collection'}
                        </span>
                      </>
                    )}
                  </div>
                )}

              <div className="profile-catalog-actions">
                {isOwnProfile && catalogMode === 'collections' && (
                  <button type="button" className="profile-collection-create-btn" onClick={() => openCollectionComposer()}>
                    <Plus aria-hidden="true" />
                    <span>New Collection</span>
                  </button>
                )}
              </div>
            </div>

            {/* ── Card Grid — smooth masonry calculation & opacity fade ────────── */}
            {(catalogMode === 'reviewed' || catalogMode === 'shelf') && (
              <div className="profile-stats-grid profile-reviewed-filters" aria-label={`Filter ${catalogMode === 'shelf' ? 'saved' : 'created'} catalog by media type`}>
                {stats.map(({ id, label, count, Icon }) => {
                  const isActive = activeFilter === id
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`stat-card stat-btn ${isActive ? 'active' : ''}`}
                      onClick={() => handleCategoryChange(id)}
                    >
                      {isActive && (
                        <motion.span
                          className="profile-filter-pill"
                          layoutId={`profile-media-filter-${userProfile.handle}-${catalogMode}`}
                          transition={{
                            type: 'spring',
                            stiffness: 480,
                            damping: 34,
                            mass: 0.6,
                          }}
                          aria-hidden="true"
                        />
                      )}
                      <div className="stat-icon-wrapper">
                        <Icon aria-hidden="true" />
                      </div>
                      <span className="stat-value">{count}</span>
                      <span className="stat-label">{label}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {isCollectionList && (
              <section className="profile-collections-shelf" aria-label={isSavedCollectionsMode ? 'Saved collections' : 'Created collections'}>
                {profileContentLoading ? (
                  <CollectionShelfSkeleton />
                ) : (
                <div key={`collection-shelf-${catalogMode}`} className="profile-collections-row">
                  {visibleCollections.map((collection) => {
                    const collectionEntries = entriesForProfileCollection(
                      isSavedCollectionsMode ? savedCatalogEntries : entries,
                      collection,
                    )
                    const collectionCreator = collection.creatorName || displayName
                    const collectionOwnerHandle = collection.creatorHandle?.replace(/^@/, '') || userProfile.handle.replace(/^@/, '')
                    const isCollectionOwner = collectionOwnerHandle === currentUserHandle
                    const isCollectionSaved = viewerSavedProfileCollections.some((savedCollection) =>
                      savedCollection.id === collection.id
                      && (savedCollection.creatorHandle?.replace(/^@/, '') || collectionOwnerHandle) === collectionOwnerHandle,
                    )
                    return (
                      <article key={collection.id} className="profile-collection-card">
                        <button
                          type="button"
                          className="profile-collection-card-main"
                          onClick={() => handleOpenCollection(collection)}
                        >
                          <span className="profile-collection-preview" aria-hidden="true">
                            {renderCollectionCoverArtwork({
                              name: collection.name,
                              coverMode: collection.coverMode,
                              coverStyle: collection.coverStyle,
                              customCoverUrl: collection.customCoverUrl,
                              items: collectionEntries,
                            })}
                          </span>
                          <span className="profile-collection-card-copy">
                            <strong title={collection.name}>{collection.name}</strong>
                            <span className="profile-collection-meta-line">
                              <span>By {collectionCreator}</span>
                              <span className="profile-collection-meta-dot">·</span>
                              <small>{collectionEntries.length} {collectionEntries.length === 1 ? 'item' : 'items'}</small>
                            </span>
                          </span>
                        </button>
                        {isCollectionOwner && catalogMode === 'collections' ? (
                          <div
                            className={`profile-collection-menu-wrap ${collectionCardMenuId === collection.id ? 'is-open' : ''}`}
                            ref={collectionCardMenuId === collection.id ? collectionCardMenuRef : undefined}
                          >
                            <button
                              type="button"
                              className="profile-collection-menu-btn"
                              onClick={() => {
                                setCollectionCardMenuId((current) => current === collection.id ? null : collection.id)
                                setCollectionCardMenuCopiedId(null)
                              }}
                              aria-label={`More options for ${collection.name}`}
                              aria-haspopup="menu"
                              aria-expanded={collectionCardMenuId === collection.id}
                              title="More options"
                            >
                              <MoreHorizontal aria-hidden="true" />
                            </button>

                            {collectionCardMenuId === collection.id && (
                              <div className="profile-collection-menu" role="menu">
                                <button
                                  type="button"
                                  className="profile-collection-menu-item"
                                  onClick={() => void handleShareCollectionCard(collection)}
                                  role="menuitem"
                                >
                                  {collectionCardMenuCopiedId === collection.id ? (
                                    <>
                                      <Check aria-hidden="true" />
                                      <span>Link Copied!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Share2 aria-hidden="true" />
                                      <span>Share Collection</span>
                                    </>
                                  )}
                                </button>

                                <button
                                  type="button"
                                  className="profile-collection-menu-item"
                                  onClick={() => handleToggleCollectionVisibilityFromCard(collection)}
                                  role="menuitem"
                                >
                                  {collection.isHidden ? (
                                    <>
                                      <Eye aria-hidden="true" />
                                      <span>Show on Profile</span>
                                    </>
                                  ) : (
                                    <>
                                      <EyeOff aria-hidden="true" />
                                      <span>Hide from Profile</span>
                                    </>
                                  )}
                                </button>

                                <button
                                  type="button"
                                  className="profile-collection-menu-item danger"
                                  onClick={() => {
                                    setCollectionCardMenuId(null)
                                    handleDeleteCollection(collection)
                                  }}
                                  role="menuitem"
                                >
                                  <Trash2 aria-hidden="true" />
                                  <span>Delete Collection</span>
                                </button>
                              </div>
                            )}
                          </div>
                        ) : !isCollectionOwner ? (
                          <button
                            type="button"
                            className={`profile-collection-save-btn ${isCollectionSaved ? 'is-saved' : ''}`}
                            onClick={() => toggleSaveCollection(collection)}
                            aria-label={isCollectionSaved ? `Remove ${collection.name} from saved` : `Save ${collection.name}`}
                            title={isCollectionSaved ? 'Remove from saved' : 'Save collection'}
                          >
                            <Bookmark fill={isCollectionSaved ? 'currentColor' : 'none'} aria-hidden="true" />
                          </button>
                        ) : null}
                      </article>
                    )
                  })}

                  {visibleCollections.length === 0 && (
                    <div className="profile-collections-empty" role="status">
                      <span className="profile-collections-empty-icon" aria-hidden="true">
                        {isSavedCollectionsMode ? <Bookmark size={18} /> : <FolderHeart size={18} />}
                      </span>
                      <span className="profile-collections-empty-copy">
                        <strong>{isSavedCollectionsMode ? 'No saved collections' : 'Nothing gathered yet'}</strong>
                        <span>
                          {isSavedCollectionsMode
                            ? 'Save a collection from another profile to find it here.'
                            : 'Start a collection of things worth returning to.'}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
                )}
              </section>
            )}

            <div
              key={catalogMode}
              className="profile-catalog-content"
              aria-busy={showCatalogSkeleton || activeIsFilterSwitching}
            >
              {showCatalogSkeleton && (
                <CardSkeletonGrid
                  count={8}
                  label={`Loading ${catalogMode === 'shelf' ? 'saved' : 'created'} catalog entries`}
                />
              )}

              {/* Empty states */}
              {!profileContentLoading && activeEntries.length === 0 && catalogMode === 'reviewed' && (
                <div className="profile-empty">
                  <BookOpen aria-hidden="true" />
                  <h3>No matching reviews found</h3>
                  <p>
                    {profileSearchQuery
                      ? `No reviews match "${profileSearchQuery}" in ${displayName}'s profile.`
                      : 'No entries cataloged in this category.'}
                  </p>
                </div>
              )}

              {!profileContentLoading && activeEntries.length === 0 && catalogMode === 'shelf' && (
                <div className="profile-empty shelf-empty">
                  <BookOpen size={32} opacity={0.5} aria-hidden="true" />
                  <h3>No saved entries yet</h3>
                  <p>
                    {shelfSearchQuery || shelfCategoryFilter !== 'all'
                      ? 'No saved entries match your current filter.'
                      : 'Save books, albums, films, games, or notes to return to them later.'}
                  </p>
                  {!shelfSearchQuery && shelfCategoryFilter === 'all' && (
                    <button
                      type="button"
                      className="shelf-empty-cta"
                      onClick={() => {
                        if (onHome) {
                          onHome()
                        } else {
                          window.location.href = '/'
                        }
                      }}
                    >
                      Explore Catalogs
                    </button>
                  )}
                </div>
              )}

              {/* Cards masonry grid */}
              {(catalogMode === 'reviewed' || catalogMode === 'shelf') && activeEntries.length > 0 && (
                <section
                  key={`${catalogMode}-cards`}
                  className="card-grid profile-masonry-grid"
                  ref={profileGridRef as React.RefObject<HTMLElement>}
                  aria-hidden={showCatalogSkeleton}
                  style={{
                    position: showCatalogSkeleton ? 'absolute' : 'relative',
                    inset: showCatalogSkeleton ? 0 : undefined,
                    height: activeMasonryLayout ? activeMasonryLayout.height : 'auto',
                    minHeight: 320,
                    visibility: showCatalogSkeleton ? 'hidden' : 'visible',
                    opacity: showCatalogSkeleton ? 0 : 1,
                    pointerEvents: showCatalogSkeleton ? 'none' : undefined,
                    transition: 'opacity 180ms ease',
                  }}
                >
                  {activeEntries.map((entry) => {
                    const pos = activeMasonryLayout?.positions.get(entry.id)
                    const { Icon, label } = getTypeMeta(entry.type)
                    const engagement = postEngagements[entry.id]

                    return (
                      <div
                        key={entry.id}
                        data-id={entry.id}
                        className="masonry-item"
                        style={pos ? {
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: pos.width,
                          transform: `translate3d(${pos.left}px, ${pos.top}px, 0)`,
                          transition: suppressCatalogMotion
                            ? 'none'
                            : 'transform 260ms cubic-bezier(0.16, 1, 0.3, 1)',
                        } : { width: '100%', marginBottom: 14 }}
                      >
                        <Card
                          entry={entry}
                          expanded={activeExpandedCardId === entry.id}
                          onDelete={isOwnProfile && catalogMode === 'reviewed' ? () => onDeleteEntry?.(entry.id) : undefined}
                          onEdit={isOwnProfile && catalogMode === 'reviewed' ? () => onEditEntry?.(entry) : undefined}
                          onToggle={() => {
                            if (catalogMode === 'reviewed') {
                              setExpandedCardId(expandedCardId === entry.id ? '' : entry.id)
                            } else if (catalogMode === 'shelf') {
                              setShelfExpandedCardId(shelfExpandedCardId === entry.id ? '' : entry.id)
                            }
                          }}
                          onExpandOverlay={() => onSelectEntry?.(entry)}
                          onOpenProfile={() => {}}
                          onOpenMedia={() => onOpenMediaProfile?.(entry)}
                          onOpenCreator={entry.type === 'game' ? undefined : (creatorName) => onOpenEntryCreator?.(entry, creatorName)}
                          onOpenAlbum={entry.type === 'song' ? () => onOpenEntryAlbum?.(entry) : undefined}
                          typeIcon={Icon}
                          typeLabel={label}
                          isLiked={engagement?.isLiked ?? likedEntryIds.includes(entry.id)}
                          isSaved={savedEntryIds.includes(entry.id)}
                          likeCount={engagement?.likeCount || 0}
                          commentCount={engagement?.commentCount || 0}
                          onToggleLike={() => onToggleLike?.(entry.id)}
                          onToggleSave={() => onToggleSave?.(entry.id)}
                          commentsDisabled={disabledCommentEntryIds.includes(entry.id)}
                          onToggleCommentsDisabled={isOwnProfile && catalogMode === 'reviewed'
                            ? () => onToggleCommentsDisabled?.(entry.id)
                            : undefined}
                        />
                      </div>
                    )
                  })}
                </section>
              )}
            </div>
          </>
        )}
          </section>
        )}
      </div>

      <AnimatePresence>
        {collectionDeleteTarget && (
          <div className="collection-inline-remove-backdrop" onClick={() => setCollectionDeleteTarget(null)}>
            <motion.div
              ref={collectionDeleteDialogRef}
              className="collection-remove-confirm collection-delete-confirm"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="collection-delete-title"
              tabIndex={-1}
              initial={{ opacity: 0, scale: 0.94, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 8 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="collection-remove-confirm-icon-wrap" aria-hidden="true">
                <Trash2 size={24} />
              </div>
              <h3 id="collection-delete-title">Delete this collection?</h3>
              <p>
                <strong>{collectionDeleteTarget.name}</strong> will be permanently deleted. The catalog entries themselves will remain.
              </p>
              <div>
                <button type="button" onClick={() => setCollectionDeleteTarget(null)}>Cancel</button>
                <button type="button" className="danger" onClick={confirmDeleteCollection}>Delete</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {collectionInlineRemovalTarget && selectedCollection && (
          <div className="collection-inline-remove-backdrop" onClick={() => setCollectionInlineRemovalTarget(null)}>
            <motion.div
              ref={inlineRemovalDialogRef}
              className="collection-remove-confirm"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="collection-inline-remove-title"
              tabIndex={-1}
              initial={{ opacity: 0, scale: 0.94, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 8 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="collection-remove-confirm-icon-wrap" aria-hidden="true">
                <Trash2 size={22} />
              </div>
              <h3 id="collection-inline-remove-title">Remove this media?</h3>
              <p><strong>{collectionInlineRemovalTarget.title}</strong> will be removed from {selectedCollection.name} only.</p>
              <div>
                <button type="button" onClick={() => setCollectionInlineRemovalTarget(null)}>Keep it</button>
                <button type="button" className="danger" onClick={confirmInlineCollectionRemoval}>Remove</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {collectionComposerOpen && collectionComposerMode === 'edit' && selectedCollection && (
          <div className="collection-composer-backdrop" onClick={handleRequestCloseCollectionComposer}>
            <motion.section
              ref={collectionEditDialogRef}
              className="collection-quick-dialog collection-edit-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="collection-edit-title"
              tabIndex={-1}
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              onClick={(event) => event.stopPropagation()}
            >
              <header className="collection-quick-header">
                <div>
                  <span>Edit collection</span>
                  <h2 id="collection-edit-title">Collection details</h2>
                  <p>Update its identity, cover, and the media already inside.</p>
                </div>
                <button type="button" onClick={handleRequestCloseCollectionComposer} aria-label="Close editor">
                  <X aria-hidden="true" />
                </button>
              </header>

              <div className="collection-edit-identity">
                <div className="collection-edit-cover-column">
                  <label className="collection-edit-cover" title="Upload a custom collection cover">
                    {collectionCoverMode === 'custom' && collectionCustomCover ? (
                      <img className="collection-preview-custom-cover" src={collectionCustomCover} alt="Collection cover preview" />
                    ) : (
                      Array.from({ length: 4 }, (_, index) => {
                        const item = collectionSelectedItems[index]
                        return (
                          <span key={item?.id ?? `empty-edit-${index}`} className={!item ? 'empty' : ''}>
                            {item && (item.coverUrl
                              ? <img src={item.coverUrl} alt="" loading="lazy" decoding="async" />
                              : React.createElement(getTypeMeta(item.type).Icon))}
                          </span>
                        )
                      })
                    )}
                    <span className="collection-edit-cover-action"><ImagePlus aria-hidden="true" /> Change cover</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => handleCollectionCoverUpload(event.target.files?.[0])}
                    />
                  </label>
                  {collectionCoverMode === 'custom' && (
                    <button type="button" className="collection-use-collage" onClick={() => setCollectionCoverMode('auto')}>
                      Use auto collage
                    </button>
                  )}
                </div>

                <div className="collection-edit-fields">
                  <label className="collection-name-field">
                    <span>Collection name</span>
                    <span className="collection-input-wrap">
                      <input
                        type="text"
                        value={collectionName}
                        onChange={(event) => setCollectionName(event.target.value)}
                        maxLength={50}
                        autoFocus
                      />
                      <small>{collectionName.length}/50</small>
                    </span>
                  </label>
                  <label className="collection-name-field collection-description-field">
                    <span>Description <em>(optional)</em></span>
                    <span className="collection-input-wrap">
                      <textarea
                        value={collectionDescription}
                        onChange={(event) => setCollectionDescription(event.target.value)}
                        placeholder="A short note about this collection..."
                        maxLength={200}
                      />
                      <small>{collectionDescription.length}/200</small>
                    </span>
                  </label>
                </div>
              </div>

              <div className="collection-edit-media">
                <div className="collection-edit-media-heading">
                  <div>
                    <strong>Added media</strong>
                    <span>Remove anything that no longer belongs here.</span>
                  </div>
                  <small>{collectionSelectedItems.length} items</small>
                </div>
                <div className="collection-edit-media-grid">
                  {collectionSelectedItems.map((item) => {
                    const { Icon } = getTypeMeta(item.type)
                    return (
                      <div className="collection-edit-media-item" key={item.id}>
                        <span>{item.coverUrl ? <img src={item.coverUrl} alt="" loading="lazy" decoding="async" /> : <Icon aria-hidden="true" />}</span>
                        <div>
                          <strong>{item.title}</strong>
                          <small>{item.creator}</small>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCollectionRemovalTarget(item)}
                          aria-label={`Remove ${item.title}`}
                        >
                          <X aria-hidden="true" />
                        </button>
                      </div>
                    )
                  })}
                  {collectionSelectedItems.length === 0 && <p>No media left in this collection.</p>}
                </div>
              </div>

              <footer className="collection-quick-actions">
                <button type="button" className="collection-composer-cancel" onClick={handleRequestCloseCollectionComposer}>Cancel</button>
                <button
                  type="button"
                  className="collection-composer-submit"
                  onClick={handleSaveCollection}
                >
                  Save changes
                </button>
              </footer>

              <AnimatePresence>
                {collectionRemovalTarget && (
                  <div className="collection-remove-confirm-backdrop" onClick={() => setCollectionRemovalTarget(null)}>
                    <motion.div
                      ref={collectionRemovalDialogRef}
                      className="collection-remove-confirm"
                      role="alertdialog"
                      aria-modal="true"
                      aria-labelledby="collection-remove-title"
                      tabIndex={-1}
                      initial={{ opacity: 0, scale: 0.94 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.94 }}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="collection-remove-confirm-icon-wrap" aria-hidden="true">
                        <Trash2 size={22} />
                      </div>
                      <h3 id="collection-remove-title">Remove this media?</h3>
                      <p><strong>{collectionRemovalTarget.title}</strong> will be removed from this collection only.</p>
                      <div>
                        <button type="button" onClick={() => setCollectionRemovalTarget(null)}>Keep it</button>
                        <button type="button" className="danger" onClick={confirmRemoveCollectionItem}>Remove</button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </motion.section>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {collectionComposerOpen && collectionComposerMode === 'add' && selectedCollection && (
          <div className="collection-composer-backdrop" onClick={handleRequestCloseCollectionComposer}>
            <motion.section
              ref={collectionAddDialogRef}
              className="collection-quick-dialog collection-add-dialog collection-add-modal-redesign"
              role="dialog"
              aria-modal="true"
              aria-labelledby="collection-add-title"
              tabIndex={-1}
              initial={{ opacity: 0, scale: 0.95, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 14 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={(event) => event.stopPropagation()}
            >
              {/* Header */}
              <header className="collection-add-modal-header">
                <div className="collection-add-modal-header-info">
                  <div className="collection-add-modal-badge-row">
                    <span className="collection-add-modal-eyebrow">Add to {selectedCollection.name}</span>
                    <span className="collection-add-modal-target-pill">
                      <Layers size={11} aria-hidden="true" />
                      <span className="collection-add-modal-target-count">
                        {selectedCollection.items?.length || 0} {selectedCollection.items?.length === 1 ? 'item' : 'items'}
                      </span>
                    </span>
                  </div>
                  <h2 id="collection-add-title" className="collection-add-modal-title">
                    Select Media to Add
                  </h2>
                </div>
                <button
                  type="button"
                  className="collection-add-modal-close-btn"
                  onClick={handleRequestCloseCollectionComposer}
                  aria-label="Close media picker"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </header>

              {/* Toolbar: Unified Search Input and Type Filter Pills */}
              <div className="collection-add-toolbar">
                <div className="collection-add-toolbar-top">
                  {/* Search bar */}
                  <label className="collection-add-search-input-wrap">
                    <Search size={15} aria-hidden="true" />
                    <input
                      type="search"
                      value={collectionItemSearch}
                      onChange={(event) => handleCollectionItemSearchChange(event.target.value)}
                      placeholder="Search books, movies, albums, songs, shows, and games..."
                      aria-label="Search media"
                      autoFocus
                    />
                    {collectionItemSearch && (
                      <button
                        type="button"
                        className="collection-add-search-clear"
                        onClick={() => handleCollectionItemSearchChange('')}
                        aria-label="Clear item search"
                      >
                        <X size={13} aria-hidden="true" />
                      </button>
                    )}
                  </label>
                </div>

                {/* Media Type Filter Pills */}
                <div className="collection-add-type-filters" role="group" aria-label="Filter items by media type">
                  <button
                    type="button"
                    className={`collection-add-type-pill ${collectionItemTypeFilter === 'all' ? 'active' : ''}`}
                    onClick={() => handleCollectionItemTypeChange('all')}
                  >
                    <Layers size={12} aria-hidden="true" />
                    <span>All</span>
                  </button>
                  {entryTypes.map(({ id, label, Icon }) => (
                    <button
                      type="button"
                      key={id}
                      className={`collection-add-type-pill ${collectionItemTypeFilter === id ? 'active' : ''}`}
                      onClick={() => handleCollectionItemTypeChange(id)}
                    >
                      <Icon size={12} aria-hidden="true" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Main Content Area */}
              <div className={`collection-add-body ${!collectionItemSearch.trim() ? 'no-scroll is-suggestions' : ''}`}>
                {collectionItemSearchStatus === 'searching' && (
                  <div className="collection-add-loading-state" role="status">
                    <div className="collection-add-spinner" aria-hidden="true" />
                    <span>Searching books, films, games, music, and podcasts...</span>
                  </div>
                )}

                {!collectionItemSearch.trim() && collectionAddItems.length > 0 && (
                  <div className="collection-suggestions-label">
                    <Sparkles size={12} aria-hidden="true" />
                    <span>
                      {selectedCollection.items && selectedCollection.items.length > 0
                        ? `Suggested for ${selectedCollection.name}`
                        : 'Trending suggestions'}
                    </span>
                  </div>
                )}

                {collectionAddItems.length > 0 ? (
                  <div
                    className="collection-add-grid"
                    role="list"
                    aria-label={!collectionItemSearch.trim() ? 'Suggested media' : 'Media results'}
                  >
                    {collectionAddItems.map((item) => {
                      const identity = profileCollectionItemIdentity(item)
                      const isSelected = collectionSelectedItems.some(
                        (selectedItem) => profileCollectionItemIdentity(selectedItem) === identity,
                      )
                      const isAlreadyInCollection = selectedCollection.items?.some(
                        (existingItem) => profileCollectionItemIdentity(existingItem) === identity,
                      )
                      const { Icon, label } = getTypeMeta(item.type)
                      const isSquareArtwork = item.type === 'album' || item.type === 'song'

                      return (
                        <div
                          key={item.id}
                          className={`collection-add-card ${isSelected ? 'is-selected' : ''} ${isAlreadyInCollection ? 'is-in-collection' : ''}`}
                          role="listitem"
                          onClick={() => toggleCollectionItem(item)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              toggleCollectionItem(item)
                            }
                          }}
                          tabIndex={0}
                          aria-pressed={isSelected}
                        >
                          <div className={`collection-add-card-art type-${item.type} ${isSquareArtwork ? 'is-square' : 'is-poster'}`}>
                            {item.coverUrl ? (
                              <img src={item.coverUrl} alt="" loading="lazy" decoding="async" />
                            ) : (
                              <div className="collection-add-card-fallback-art">
                                <Icon size={22} aria-hidden="true" />
                              </div>
                            )}
                            <span className="collection-add-card-type-chip">
                              <Icon size={9} aria-hidden="true" />
                              <span>{label.replace(/s$/, '')}</span>
                            </span>
                          </div>

                          <div className="collection-add-card-content">
                            <div className="collection-add-card-header">
                              <h4 className="collection-add-card-title" title={item.title}>
                                {item.title}
                              </h4>
                              <p className="collection-add-card-creator">
                                {item.creator}
                                {item.year ? ` · ${item.year}` : ''}
                              </p>
                            </div>

                            <div className="collection-add-card-footer">
                              {isAlreadyInCollection ? (
                                <span className="collection-add-status-pill in-collection">
                                  <Check size={11} aria-hidden="true" />
                                  <span>In collection</span>
                                </span>
                              ) : isSelected ? (
                                <span className="collection-add-status-pill selected">
                                  <Check size={11} aria-hidden="true" />
                                  <span>Selected</span>
                                </span>
                              ) : (
                                <span className="collection-add-status-pill add-action">
                                  <Plus size={11} aria-hidden="true" />
                                  <span>Add</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  collectionItemSearchStatus !== 'searching' && (
                    <div className="collection-add-empty-container">
                      {collectionItemSearch.trim().length > 0 ? (
                        <div className="collection-add-empty-box">
                          <Search size={26} aria-hidden="true" />
                          <h3>No results found</h3>
                          <p>No media found for "{collectionItemSearch}". Try a different search term or change the category filter.</p>
                        </div>
                      ) : (
                        <div className="collection-add-empty-box">
                          <Compass size={26} aria-hidden="true" />
                          <h3>Find media to add</h3>
                          <p>Type a title, creator, or keyword above to search books, films, albums, games, and podcasts.</p>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>

              {/* Selected Staging Tray Dock */}
              {collectionSelectedItems.length > 0 && (
                <div className="collection-add-staging-bar">
                  <div className="collection-add-staging-header">
                    <span className="collection-add-staging-label">
                      Ready to add ({collectionSelectedItems.length})
                    </span>
                    <button
                      type="button"
                      className="collection-add-staging-clear-btn"
                      onClick={() => setCollectionSelectedItems([])}
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="collection-add-staging-chips-row">
                    {collectionSelectedItems.map((item) => {
                      const { Icon } = getTypeMeta(item.type)
                      return (
                        <div key={item.id} className="collection-add-staging-chip">
                          <span className="collection-add-staging-chip-art">
                            {item.coverUrl ? (
                              <img src={item.coverUrl} alt="" />
                            ) : (
                              <Icon size={11} aria-hidden="true" />
                            )}
                          </span>
                          <span className="collection-add-staging-chip-title" title={item.title}>
                            {item.title}
                          </span>
                          <button
                            type="button"
                            className="collection-add-staging-chip-remove"
                            onClick={(event) => {
                              event.stopPropagation()
                              setCollectionSelectedItems((current) => current.filter((i) => i.id !== item.id))
                            }}
                            aria-label={`Remove ${item.title}`}
                          >
                            <X size={11} aria-hidden="true" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Footer Actions */}
              <footer className="collection-add-modal-footer">
                <span className="collection-add-footer-status">
                  {collectionSelectedItems.length > 0 ? (
                    <>
                      Adding <strong>{collectionSelectedItems.length}</strong> {collectionSelectedItems.length === 1 ? 'item' : 'items'} to {selectedCollection.name}
                    </>
                  ) : (
                    <>Select media above to add to this collection</>
                  )}
                </span>
                <div className="collection-add-footer-buttons">
                  <button
                    type="button"
                    className="collection-add-cancel-btn"
                    onClick={handleRequestCloseCollectionComposer}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="collection-add-submit-btn"
                    disabled={collectionSelectedItems.length === 0}
                    onClick={handleSaveCollection}
                  >
                    <Plus size={14} aria-hidden="true" />
                    <span>
                      Add {collectionSelectedItems.length ? `${collectionSelectedItems.length} ` : ''}
                      {collectionSelectedItems.length === 1 ? 'item' : 'items'}
                    </span>
                  </button>
                </div>
              </footer>

              {/* Duplicate confirmation dialog */}
              <AnimatePresence>
                {collectionDuplicateTarget && (
                  <div className="collection-remove-confirm-backdrop" onClick={() => setCollectionDuplicateTarget(null)}>
                    <motion.div
                      ref={duplicateCollectionDialogRef}
                      className="collection-remove-confirm collection-duplicate-confirm"
                      role="alertdialog"
                      aria-modal="true"
                      aria-labelledby="collection-add-duplicate-title"
                      tabIndex={-1}
                      initial={{ opacity: 0, scale: 0.94, y: 8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.94, y: 8 }}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <AlertTriangle aria-hidden="true" />
                      <h3 id="collection-add-duplicate-title">Already in this collection</h3>
                      <p>
                        <strong>{collectionDuplicateTarget.title}</strong> is already in <strong>{selectedCollection.name}</strong>.
                        Would you like to add another copy anyway?
                      </p>
                      <div>
                        <button type="button" onClick={() => setCollectionDuplicateTarget(null)}>No, keep one</button>
                        <button type="button" className="confirm" onClick={confirmAddDuplicateCollectionItem}>Add anyway</button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </motion.section>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {collectionComposerOpen && collectionComposerMode === 'create' && (
          <div className="collection-composer-backdrop" onClick={handleRequestCloseCollectionComposer}>
            <motion.div
              ref={collectionCreateDialogRef}
              className="collection-composer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="collection-composer-title"
              tabIndex={-1}
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="collection-composer-close"
                onClick={handleRequestCloseCollectionComposer}
                aria-label="Close collection creator"
              >
                <X aria-hidden="true" />
              </button>

              <aside className="collection-composer-preview">
                <div className="collection-showcase-stage">
                  <div className="collection-preview-cover-stage">
                    <button
                      type="button"
                      className="collection-cover-nav-btn prev"
                      onClick={handlePrevCoverStyle}
                      aria-label="Previous cover style"
                      title="Previous style"
                    >
                      <ChevronLeft aria-hidden="true" size={18} />
                    </button>

                    <div className="collection-preview-cover">
                      <AnimatePresence initial={false} mode="sync">
                        <motion.div
                          key={
                            collectionCoverMode === 'custom'
                              ? `custom-${collectionCustomCover ? 'img' : 'empty'}`
                              : collectionCoverMode === 'gradient'
                                ? `grad-${collectionGradientVariant}`
                                : 'auto'
                          }
                          className="collection-preview-cover-layer"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                        >
                          {collectionCoverMode === 'custom' && !collectionCustomCover ? (
                            <button
                              type="button"
                              className="collection-preview-custom-empty-upload"
                              title="Click to upload cover photo"
                              onClick={() => collectionPhotoInputRef.current?.click()}
                            >
                              <Upload aria-hidden="true" size={24} />
                              <span>Click to upload cover</span>
                            </button>
                          ) : collectionCoverMode === 'custom' && collectionCustomCover ? (
                            <div className="collection-preview-custom-cover-wrap">
                              <img
                                className="collection-preview-custom-cover"
                                src={collectionCustomCover}
                                alt="Collection custom cover"
                              />
                              <div
                                className="collection-custom-cover-hover-overlay"
                                onClick={() => collectionPhotoInputRef.current?.click()}
                                title="Change cover photo"
                              >
                                <Upload size={22} aria-hidden="true" />
                                <span>Change photo</span>
                              </div>
                            </div>
                          ) : (
                            renderCollectionCoverArtwork({
                              name: collectionName,
                              coverMode: collectionCoverMode,
                              coverStyle: collectionCoverMode === 'gradient' ? `gradient-${collectionGradientVariant}` : undefined,
                              customCoverUrl: collectionCustomCover,
                              items: collectionSelectedItems,
                            })
                          )}
                        </motion.div>
                      </AnimatePresence>
                    </div>

                    <button
                      type="button"
                      className="collection-cover-nav-btn next"
                      onClick={handleNextCoverStyle}
                      aria-label="Next cover style"
                      title="Next style"
                    >
                      <ChevronRight aria-hidden="true" size={18} />
                    </button>
                  </div>

                  <div className="collection-cover-controls">
                    <div className="collection-cover-dots" role="tablist" aria-label="Cover appearance styles">
                      {(() => {
                        const hasUploadedPhoto = Boolean(collectionCustomCover) && !collectionCustomCover.startsWith('data:image/svg+xml')
                        return (
                          <button
                            type="button"
                            className={`collection-cover-dot photo-dot ${collectionCoverMode === 'custom' ? 'active' : ''} ${hasUploadedPhoto ? 'has-uploaded' : 'is-empty-placeholder'}`}
                            onClick={() => {
                              if (collectionCoverMode === 'custom' || !hasUploadedPhoto) {
                                collectionPhotoInputRef.current?.click()
                              } else {
                                setCollectionCoverMode('custom')
                              }
                            }}
                            title={hasUploadedPhoto ? 'Click to upload photo' : 'Click to add photo'}
                            aria-label={hasUploadedPhoto ? 'Click to upload photo' : 'Click to add photo'}
                          >
                            {hasUploadedPhoto ? (
                              <span className="photo-dot-thumb-wrap">
                                <img src={collectionCustomCover} alt="" className="photo-dot-thumb" draggable={false} />
                                <span className="photo-dot-hover-icon" aria-hidden="true">
                                  <Upload size={10} />
                                </span>
                              </span>
                            ) : (
                              <Upload aria-hidden="true" size={13} />
                            )}
                          </button>
                        )
                      })()}

                      <button
                        type="button"
                        className={`collection-cover-dot collage-dot ${collectionCoverMode === 'auto' ? 'active' : ''}`}
                        onClick={() => setCollectionCoverMode('auto')}
                        title="Auto collage"
                        aria-label="Auto collage"
                      >
                        <LayoutGrid aria-hidden="true" size={13} />
                      </button>

                      {([1, 2, 3, 4] as const).map((variant) => (
                        <button
                          key={variant}
                          type="button"
                          className={`collection-cover-dot ${collectionCoverMode === 'gradient' && collectionGradientVariant === variant ? 'active' : ''}`}
                          onClick={() => {
                            setCollectionCoverMode('gradient')
                            setCollectionGradientVariant(variant)
                          }}
                          title={`Apple Music · ${GRADIENT_NAMES[variant]}`}
                          aria-label={`Apple Music · ${GRADIENT_NAMES[variant]}`}
                        >
                          <span className="dot-pip" />
                        </button>
                      ))}
                    </div>

                    <input
                      ref={collectionPhotoInputRef}
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      style={{ display: 'none' }}
                      onChange={(event) => handleCollectionCoverUpload(event.target.files?.[0])}
                    />
                  </div>

                  <div className="collection-showcase-note">
                    <Sparkles aria-hidden="true" size={13} />
                    <span>You can change this anytime.</span>
                  </div>
                </div>
              </aside>

              <section className="collection-composer-form">
                <div className="collection-composer-header">
                  <div>
                    <h2 id="collection-composer-title">{collectionEditingId ? 'Edit Collection' : 'New Collection'}</h2>
                  </div>
                </div>

                <div className="collection-composer-fields">
                  <div className="collection-composer-identity">
                    <label className="collection-field-group">
                      <div className="collection-field-header">
                        <span>Collection name</span>
                        <small>{collectionName.length}/50</small>
                      </div>
                      <div className="collection-input-wrap">
                        <input
                          type="text"
                          value={collectionName}
                          onChange={(event) => setCollectionName(event.target.value)}
                          placeholder="Untitled Collection"
                          maxLength={50}
                          autoFocus
                        />
                      </div>
                    </label>

                    <label className="collection-field-group">
                      <div className="collection-field-header">
                        <span>Description <em>(optional)</em></span>
                        <small>{collectionDescription.length}/200</small>
                      </div>
                      <div className="collection-input-wrap">
                        <textarea
                          value={collectionDescription}
                          onChange={(event) => setCollectionDescription(event.target.value)}
                          placeholder="A short note about this collection…"
                          maxLength={200}
                          rows={3}
                        />
                      </div>
                    </label>
                  </div>

                  <div className="collection-composer-curation">
                    <div className="collection-curation-header">
                      <div className="collection-curation-title">
                        <span>{!collectionItemSearch.trim() ? (collectionSelectedItems.length > 0 ? 'Suggested media' : 'Trending media') : 'Search results'}</span>
                        <em>(optional)</em>
                      </div>
                      <span className="collection-curation-count">
                        {collectionSelectedItems.length} {collectionSelectedItems.length === 1 ? 'item' : 'items'}
                      </span>
                    </div>

                    <div className="collection-curation-toolbar">
                      <label className="collection-item-search">
                        <Search aria-hidden="true" />
                        <input
                          type="search"
                          value={collectionItemSearch}
                          onChange={(event) => handleCollectionItemSearchChange(event.target.value)}
                          placeholder="Search books, movies, albums, songs, shows, and games..."
                          aria-label="Search all media"
                        />
                        {collectionItemSearch && (
                          <button
                            type="button"
                            onClick={() => handleCollectionItemSearchChange('')}
                            aria-label="Clear item search"
                          >
                            <X aria-hidden="true" />
                          </button>
                        )}
                      </label>

                      <div className="collection-item-filters" role="group" aria-label="Filter items by media type">
                        <button
                          type="button"
                          className={collectionItemTypeFilter === 'all' ? 'active' : ''}
                          onClick={() => handleCollectionItemTypeChange('all')}
                        >
                          <Layers aria-hidden="true" />
                          <span>All</span>
                        </button>
                        {entryTypes.map(({ id, label, Icon }) => (
                          <button
                            type="button"
                            key={id}
                            className={collectionItemTypeFilter === id ? 'active' : ''}
                            onClick={() => handleCollectionItemTypeChange(id)}
                          >
                            <Icon aria-hidden="true" />
                            <span>{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div
                      className={`collection-item-picker ${!collectionItemSearch.trim() ? 'no-scroll is-suggestions' : ''} ${collectionComposerItems.length === 0 ? 'is-empty' : ''}`}
                      role="list"
                      aria-label={!collectionItemSearch.trim() ? 'Suggested media' : 'Search results'}
                    >
                      {collectionComposerItems.map((item) => {
                        const itemIdentity = profileCollectionItemIdentity(item)
                        const isSelected = collectionSelectedItems.some(
                          (selectedItem) => profileCollectionItemIdentity(selectedItem) === itemIdentity,
                        )
                        const { Icon, label } = getTypeMeta(item.type)
                        return (
                          <button
                            type="button"
                            className={`collection-item-option ${isSelected ? 'selected' : ''}`}
                            key={item.id}
                            role="listitem"
                            aria-pressed={isSelected}
                            onClick={() => toggleCollectionItem(item)}
                          >
                            <span className="collection-item-art">
                              {item.coverUrl ? <img src={item.coverUrl} alt="" loading="lazy" decoding="async" /> : <Icon aria-hidden="true" />}
                            </span>
                            <span className="collection-item-copy">
                              <strong>{item.title}</strong>
                              <small>{item.creator}{item.year ? ` · ${item.year}` : ''}</small>
                            </span>
                            <span className="collection-item-type"><Icon aria-hidden="true" /> {label.replace(/s$/, '')}</span>
                            <span className="collection-item-toggle" aria-hidden="true">
                              {isSelected ? <Check /> : <Plus />}
                            </span>
                          </button>
                        )
                      })}
                      {collectionItemSearchStatus === 'searching' && (
                        <div className="collection-item-loading" role="status">
                          <span aria-hidden="true" /> Searching across all media...
                        </div>
                      )}
                      {collectionComposerItems.length === 0 && collectionItemSearchStatus !== 'searching' && (
                        <div className="collection-item-empty">
                          <Search aria-hidden="true" />
                          <span>{!collectionItemSearch.trim()
                            ? (collectionSelectedItems.length === 0
                                ? 'Search books, movies, albums, songs, shows, and games above to add items.'
                                : 'No items match the selected media filter.')
                            : collectionItemSearch.trim().length < 2
                              ? 'Search for any movie, book, song, show, album, or game.'
                              : collectionItemSearchStatus === 'error'
                                ? 'Media search is unavailable right now.'
                                : 'No media found.'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="collection-composer-actions">
                  <div className="collection-composer-status">
                    <span>
                      {collectionSelectedItems.length === 0
                        ? 'Can start empty or add items now'
                        : `${collectionSelectedItems.length} item${collectionSelectedItems.length === 1 ? '' : 's'} ready for your shelf`}
                    </span>
                  </div>
                  <div className="collection-composer-buttons">
                    <button
                      type="button"
                      className="collection-composer-cancel"
                      onClick={handleRequestCloseCollectionComposer}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="collection-composer-submit"
                      onClick={handleSaveCollection}
                    >
                      {collectionEditingId ? 'Save Changes' : 'Create Collection'}
                    </button>
                  </div>
                </div>
              </section>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {collectionDiscardConfirmOpen && (
          <div className="collection-inline-remove-backdrop" onClick={() => setCollectionDiscardConfirmOpen(false)}>
            <motion.div
              ref={collectionDiscardDialogRef}
              className="collection-remove-confirm"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="collection-discard-title"
              tabIndex={-1}
              initial={{ opacity: 0, scale: 0.94, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 8 }}
              onClick={(event) => event.stopPropagation()}
            >
              <AlertTriangle aria-hidden="true" />
              <h3 id="collection-discard-title">Discard unsaved changes?</h3>
              <p>You have unsaved changes that will be lost if you leave now.</p>
              <div>
                <button type="button" onClick={() => setCollectionDiscardConfirmOpen(false)}>Keep editing</button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    setCollectionDiscardConfirmOpen(false)
                    setCollectionComposerOpen(false)
                  }}
                >
                  Discard
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {collectionInlineDiscardConfirmOpen && (
          <div className="collection-inline-remove-backdrop" onClick={() => setCollectionInlineDiscardConfirmOpen(false)}>
            <motion.div
              ref={collectionInlineDiscardDialogRef}
              className="collection-remove-confirm"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="collection-inline-discard-title"
              tabIndex={-1}
              initial={{ opacity: 0, scale: 0.94, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 8 }}
              onClick={(event) => event.stopPropagation()}
            >
              <AlertTriangle aria-hidden="true" />
              <h3 id="collection-inline-discard-title">Discard unsaved changes?</h3>
              <p>You have unsaved changes that will be lost if you leave now.</p>
              <div>
                <button type="button" onClick={() => setCollectionInlineDiscardConfirmOpen(false)}>Keep editing</button>
                <button
                  type="button"
                  className="danger"
                  onClick={handleConfirmInlineDiscard}
                >
                  Discard
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* ── Followers / Following Modal ── */}
      <AnimatePresence>
        {activeFollowModal && (
          <div className="modal-backdrop" onClick={closeFollowModal}>
            <motion.div
              ref={followDialogRef}
              className="follow-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="follow-modal-title"
              tabIndex={-1}
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <header className="follow-modal-header">
                <div className="follow-modal-heading">
                  <h2 id="follow-modal-title" className="follow-modal-title">Connections</h2>
                  <p className="follow-modal-subtitle">@{userProfile.handle.replace(/^@/, '')}</p>
                </div>
                <button
                  type="button"
                  className="follow-modal-close"
                  onClick={closeFollowModal}
                  aria-label="Close connections"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </header>

              <div
                className="follow-modal-tabs"
                role="tablist"
                aria-label="Profile connections"
                onKeyDown={handleTabListKeyDown}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeFollowModal === 'followers'}
                  tabIndex={activeFollowModal === 'followers' ? 0 : -1}
                  className={`follow-modal-tab ${activeFollowModal === 'followers' ? 'active' : ''}`}
                  onClick={() => { setActiveFollowModal('followers'); setFollowSearch('') }}
                >
                  <span>Followers</span>
                  <span className="follow-tab-count">{dynamicFollowersList.length}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeFollowModal === 'following'}
                  tabIndex={activeFollowModal === 'following' ? 0 : -1}
                  className={`follow-modal-tab ${activeFollowModal === 'following' ? 'active' : ''}`}
                  onClick={() => { setActiveFollowModal('following'); setFollowSearch('') }}
                >
                  <span>Following</span>
                  <span className="follow-tab-count">{dynamicFollowingList.length}</span>
                </button>
              </div>

              {showFollowSearch && (
                <div className="follow-modal-search">
                  <Search size={15} aria-hidden="true" />
                  <input
                    type="text"
                    placeholder={`Search ${activeFollowModal}…`}
                    value={followSearch}
                    onChange={(e) => setFollowSearch(e.target.value)}
                    className="follow-search-input"
                    aria-label={`Search ${activeFollowModal}`}
                  />
                  {followSearch && (
                    <button
                      type="button"
                      onClick={() => setFollowSearch('')}
                      className="follow-search-clear"
                      aria-label="Clear search"
                    >
                      <X size={12} aria-hidden="true" />
                    </button>
                  )}
                </div>
              )}

              <div className="follow-modal-body">
                {!canViewFollowLists ? (
                  <div className="follow-empty-state">
                    <span className="follow-empty-icon">
                      <Lock size={22} aria-hidden="true" />
                    </span>
                    <h3>Connections are private</h3>
                    <p>
                      @{userProfile.handle.replace(/^@/, '')} has chosen not to share their
                      followers or following list.
                    </p>
                  </div>
                ) : filteredFollowList.length === 0 ? (
                  followSearch.trim() ? (
                    <div className="follow-empty-state">
                      <span className="follow-empty-icon">
                        <Search size={22} aria-hidden="true" />
                      </span>
                      <h3>No matches found</h3>
                      <p>
                        Nothing matched “{followSearch.trim()}”. Try a different name or handle.
                      </p>
                      <button
                        type="button"
                        className="follow-empty-action"
                        onClick={() => setFollowSearch('')}
                      >
                        Clear search
                      </button>
                    </div>
                  ) : (
                    <div className="follow-empty-state">
                      <span className="follow-empty-icon">
                        {activeFollowModal === 'followers'
                          ? <Users size={22} aria-hidden="true" />
                          : <UserPlus size={22} aria-hidden="true" />}
                      </span>
                      <h3>
                        {activeFollowModal === 'followers'
                          ? 'No followers yet'
                          : 'Not following anyone yet'}
                      </h3>
                      <p>
                        {activeFollowModal === 'followers'
                          ? (isOwnProfile
                            ? 'When people follow you, they’ll appear here.'
                            : 'When people follow this reader, they’ll appear here.')
                          : (isOwnProfile
                            ? 'Accounts you follow will appear here.'
                            : 'Accounts this reader follows will appear here.')}
                      </p>
                    </div>
                  )
                ) : (
                  <div className="follow-modal-list" role="list">
                    {filteredFollowList.map((person) => {
                      const cleanHandle = person.handle.replace(/^@/, '')
                      const cleanName = (person.name || '').trim()
                      const hasDistinctName = Boolean(
                        cleanName &&
                        cleanName.toLowerCase() !== `@${cleanHandle.toLowerCase()}` &&
                        cleanName.toLowerCase() !== cleanHandle.toLowerCase()
                      )
                      const isPersonFollowing = followedUserHandles.includes(person.handle)
                      const isPersonRequested = followRequestedHandles.includes(person.handle)
                      const isCurrentUser = person.handle === (currentUserProfile?.handle || 'jimboii')
                      const displayHandle = cleanName || `@${cleanHandle}`

                      return (
                        <div key={person.id} className="follow-person-row" role="listitem">
                          <button
                            type="button"
                            className="follow-person-profile"
                            onClick={() => {
                              if (!onSelectUserProfile) return
                              onSelectUserProfile(person.handle)
                              closeFollowModal()
                            }}
                            disabled={!onSelectUserProfile}
                          >
                            <span className="follow-person-avatar-wrapper">
                              {person.avatar ? (
                                <img
                                  src={person.avatar}
                                  alt=""
                                  className="follow-person-avatar-img"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <User aria-hidden="true" />
                              )}
                            </span>
                            <span className="follow-person-info">
                              {hasDistinctName ? (
                                <>
                                  <span className="follow-person-name">
                                    <span>{cleanName}</span>
                                    {person.isPrivate && <Lock size={11} aria-hidden="true" />}
                                  </span>
                                  <span className="follow-person-meta">@{cleanHandle}</span>
                                </>
                              ) : (
                                <span className="follow-person-name">
                                  <span>@{cleanHandle}</span>
                                  {person.isPrivate && <Lock size={11} aria-hidden="true" />}
                                </span>
                              )}
                            </span>
                          </button>

                          <div className="follow-person-actions">
                            {isCurrentUser ? (
                              <span className="follow-you-badge">You</span>
                            ) : person.isDeactivated ? (
                              <span className="follow-you-badge">Unavailable</span>
                            ) : isPersonFollowing ? (
                              <button
                                type="button"
                                className="follow-person-btn follow-btn-primary is-following"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onToggleFollowUser?.(person.handle)
                                }}
                                title="Click to unfollow"
                                aria-label={`Unfollow ${displayHandle}`}
                              >
                                <UserCheck size={13} aria-hidden="true" />
                                <span>Following</span>
                              </button>
                            ) : isPersonRequested ? (
                              <button
                                type="button"
                                className="follow-person-btn follow-btn-secondary"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onToggleFollowRequest?.(person.handle)
                                }}
                                title="Click to cancel request"
                                aria-label={`Cancel follow request to ${displayHandle}`}
                              >
                                <UserCheck size={13} aria-hidden="true" />
                                <span>Requested</span>
                              </button>
                            ) : person.isPrivate ? (
                              <button
                                type="button"
                                className="follow-person-btn follow-btn-primary"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onToggleFollowRequest?.(person.handle)
                                }}
                                aria-label={`Request to follow ${displayHandle}`}
                              >
                                <UserPlus size={13} aria-hidden="true" />
                                <span>Request</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="follow-person-btn follow-btn-primary"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onToggleFollowUser?.(person.handle)
                                }}
                                aria-label={`Follow ${displayHandle}`}
                              >
                                <UserPlus size={13} aria-hidden="true" />
                                <span>Follow</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <footer className="follow-modal-footer">
                <span aria-live="polite">
                  {!canViewFollowLists
                    ? `Hidden by @${userProfile.handle.replace(/^@/, '')}`
                    : followSearch.trim()
                      ? `${filteredFollowList.length} of ${activeFollowList.length} shown`
                      : activeFollowModal === 'followers'
                        ? `${activeFollowList.length} ${activeFollowList.length === 1 ? 'follower' : 'followers'}`
                        : `${activeFollowList.length} ${activeFollowList.length === 1 ? 'account' : 'accounts'}`}
                </span>
                <span className="follow-modal-footer-hint" aria-hidden="true">
                  <kbd>Esc</kbd> to close
                </span>
              </footer>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <ReportDialog
        open={profileReportOpen}
        targetType="profile"
        targetLabel={`@${userProfile.handle.replace(/^@/, '')}`}
        onClose={() => setProfileReportOpen(false)}
        onSubmit={async (reason, details) => {
          if (!cloudUserId) throw new Error('Sign in to report this profile.')
          await submitContentReport(cloudUserId, {
            targetType: 'profile',
            targetId: userProfile.handle,
            targetHandle: userProfile.handle,
            reason,
            details,
          })
          setProfileReportOpen(false)
          setProfileMediaToast('Report submitted. Thank you for helping keep The Commonplace safe.')
        }}
      />
      <AnimatePresence>
        {isOwnProfile && catalogMode === 'reviewed' && !isCollectionDetail && onAddEntry && (
          <motion.div
            className="fab-stack"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
          >
            <button
              className="fab"
              type="button"
              aria-label="Add new entry"
              title="Add new entry"
              disabled={addEntryDisabled}
              onClick={onAddEntry}
            >
              <Plus aria-hidden="true" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
