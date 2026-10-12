/* eslint-disable react-hooks/set-state-in-effect, react-hooks/refs -- Route synchronization and the legacy entity cache intentionally bridge external browser state. */
import { AnimatePresence, motion } from 'framer-motion'
import {
  User,
  Trash2,
  BookOpen,
  ChevronUp,
  Plus,
  Settings,
  Activity,
  CircleCheck,
  CircleHelp,
  LogOut,
  CircleUserRound,
  Home,
  MailCheck,
  Menu,
  TriangleAlert,
  WifiOff,
  X,
} from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import '../App.css'
import {
  type MetadataResult,
  searchMetadata,
  entityImageCacheMap,
  albumEntityMap,
  scoreGameTitleMatch,
} from '../metadata'
import { useCardExpansion } from '../hooks/useCardExpansion'
import { Card } from '../components/CommonplaceCard/Card'
import { EntryReadingPage } from '../components/CommonplaceCard/CardOverlayModal'
import { CardSkeletonGrid } from '../components/CommonplaceCard/CardSkeleton'
import { PageLoadingSkeleton } from '../components/PageLoadingSkeleton'
import { LogoutConfirmModal } from '../components/auth/LogoutConfirmModal'
import { LoginPage } from '../pages/LoginPage'
import { RegisterPage } from '../pages/RegisterPage'
import { useAuth } from '../context/AuthContext'
import { useMasonryLayout } from '../hooks/useMasonryLayout'
import { useAccessibleDialog } from '../hooks/useAccessibleDialog'
import { NotificationBell } from '../components/Notifications/NotificationPanel'
import { MOCK_ENTITY_PROFILES } from '../data/entityProfiles'
import { UNIVERSAL_MEDIA_ENTITIES } from '../data/universalMediaEntities'
import type { MediaEntityType, UniversalMediaEntity } from '../types/mediaEntity'
import { resolveArtworkUrl } from '../utils/artwork'
import { CollectionPickerModal } from '../components/Collections/CollectionPickerModal'
import {
  cacheIdentityAlias,
  cacheProfileEntity,
  getCachedProfileEntity,
  migrateUnsafeIdentityCaches,
} from '../services/profileCache'
import { identityToUniversalEntity, searchIdentities } from '../services/identity'
import type { UserProfileState } from '../types/userProfile'
import {
  PENDING_SIGNUP_PROFILE_KEY,
  pendingSignupProfileForUser,
  profileBelongsToAuthUser,
  profileFromAuthUser,
  hasDistinctProfileDisplayName,
  shouldResetLegacyDemoProfile,
  type AuthProfileSource,
} from '../features/profiles/accountProfile'
import type { MetadataChip } from '../types/mediaEntity'
import {
  loadProfileCollections,
  loadSavedProfileCollections,
  saveProfileCollections,
  saveSavedProfileCollections,
  type ProfileCollectionItem,
} from '../features/collections/profileCollections'
import type { AppNotification } from '../types/notification'
import { birthdayNotificationId } from '../features/auth/ageEligibility'
import {
  applyPendingSavedEntryChanges,
  updatePendingSavedEntryChanges,
  type PendingSavedEntryChanges,
} from '../features/saves/persistence'
import {
  deleteEntryDraft,
  loadEntryDrafts,
  saveEntryDraft,
} from '../features/entries/draftStorage'
import {
  dedupeSearchEntities,
  getSearchEntityScore,
  isYearOnlyMetadataMatch,
  metadataResultToSearchEntity,
  normalizeSearchText,
  providerScopedMusicIdentityFromMetadataResult,
  searchEntityMatchesQuery,
  universalEntityToSearchEntity,
  type HeaderSearchEntity,
} from '../features/search/entitySearch'
import { HeaderSearch } from '../features/search/HeaderSearch'
import type { SearchCategory } from '../components/Search/PrimarySearch'
import {
  decodeRouteSegment,
  entityTypeByRouteSegment,
  getEntityRoutePath,
  inferEntityTypeFromId,
  metadataResultToUniversalEntity,
  routeSegment,
} from '../features/entities/routing'
import {
  createAlbumEntityFromSongEntry,
  createCreatorEntityFromEntry,
} from '../features/entities/entryProfiles'
import {
  clearPendingEntrySync,
  emptyDraft,
  entrySnapshotsMatch,
  entryTypes,
  getDefaultCoverTone,
  getTypeMeta,
  hasAccountEntryStorage,
  loadEntries,
  loadPendingEntrySync,
  makeEntryId,
  markEntriesPendingSync,
  reconcileEntrySnapshots,
  saveEntriesToStorage,
  type Entry,
  type EntryDraft,
  type EntryType,
} from '../features/entries/model'
import {
  canUseCloudData,
  loadPostEntry,
  loadPublicFeedEntries,
  loadPublicAccountIdentityByHandle,
  loadPublicUserByHandle,
  loadOrMigrateUserCollections,
  loadOrMigrateUserData,
  saveUserCollections,
  saveUserCloudState,
  saveUserEntries,
  saveUserProfile,
  subscribePostEngagements,
  subscribeUserNotifications,
  type PostEngagement,
  type PublicUserData,
  type UserCloudSnapshot,
} from '../services/cloudData'
import {
  feedSignalSubject,
  personalizedHomeFeedEnabled,
  recordFeedSignal,
  resetFeedPreferences,
  shouldRecordEntryOpen,
} from '../services/feed'
import { usePersonalizedFeed } from '../features/feed/usePersonalizedFeed'
import {
  isLegacySeedCollection,
  isLegacySeedEntry,
  isLegacySeedHandle,
  purgeLegacySeedStorage,
  removeLegacySeedEntryIds,
  removeLegacySeedHandles,
} from '../utils/legacySeedCleanup'
import {
  flushOfflineActions,
  getPendingOfflineActionCount,
  OFFLINE_QUEUE_EVENT,
  submitOfflineAction,
} from '../services/offlineSync'

const UserProfilePage = lazy(() => import('../pages/UserProfilePage').then((module) => ({ default: module.UserProfilePage })))
const SettingsPage = lazy(() => import('../pages/SettingsPage').then((module) => ({ default: module.SettingsPage })))
const ActivityPage = lazy(() => import('../pages/ActivityPage').then((module) => ({ default: module.ActivityPage })))
const HelpSupportPage = lazy(() => import('../pages/HelpSupportPage').then((module) => ({ default: module.HelpSupportPage })))
const EmailVerificationPage = lazy(() => import('../pages/EmailVerificationPage').then((module) => ({ default: module.EmailVerificationPage })))
const ResetPasswordPage = lazy(() => import('../pages/ResetPasswordPage').then((module) => ({ default: module.ResetPasswordPage })))
const NotFoundPage = lazy(() => import('../pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })))
const UniversalMediaProfilePage = lazy(() => import('../pages/UniversalMediaProfilePage').then((module) => ({ default: module.UniversalMediaProfilePage })))
const loadEntryComposerModule = () => import('../features/entries/composer/EntryComposer')
const EntryComposer = lazy(() => loadEntryComposerModule().then((module) => ({ default: module.EntryComposer })))

function ComposerLoadingFallback() {
  return (
    <div className="modal-backdrop composer-loading-backdrop" role="status" aria-label="Loading entry composer">
      <div className="composer-loading-card" aria-hidden="true">
        <span className="skeleton-box is-title" />
        <span className="skeleton-box is-line" />
        <span className="skeleton-box is-line is-short" />
      </div>
    </div>
  )
}

const SEARCH_INITIAL_RESULT_LIMIT = 6
const SEARCH_RESULTS_PER_PAGE = 6
const SEARCH_MAX_RESULT_LIMIT = 40
const SEARCH_ENTRY_TYPE_BY_FILTER: Partial<Record<SearchCategory, EntryType>> = {
  albums: 'album',
  books: 'book',
  films: 'film',
  games: 'game',
  songs: 'song',
  shows: 'tv',
}
const FEED_ENTRY_TYPE_BY_ENTITY: Partial<Record<MediaEntityType, EntryType>> = {
  album: 'album',
  book: 'book',
  movie: 'film',
  game: 'game',
  song: 'song',
  tv: 'tv',
}

type ActiveView = 'feed' | 'profile' | 'activity' | 'settings' | 'help' | 'entity' | 'reading' | 'login' | 'register' | 'not-found'

function initialViewFromPath(pathname: string): ActiveView {
  const section = pathname.split('/').filter(Boolean)[0]?.toLowerCase() || ''
  if (!section) return 'feed'
  if (section === 'entries') return 'reading'
  if (section === 'users' || section === 'profile') return 'profile'
  if (section === 'activity' || section === 'settings' || section === 'help' || section === 'login' || section === 'register') {
    return section
  }
  if (entityTypeByRouteSegment[section]) return 'entity'
  return 'not-found'
}

function entrySyncErrorMessage(error: unknown) {
  const message = (error as Error)?.message?.replace(/^Firebase:\s*/i, '').trim()
  return `Something went wrong. Error: ${message || 'Unable to publish the post.'}`
}

function isConnectionError(error: unknown) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  return /network|offline|failed to fetch|unavailable/i.test((error as Error)?.message || '')
}

const PROFILE_STORAGE_KEY = 'the-commonplace.user-profile.v1'
const pendingSavedEntryWrites = new Map<string, Promise<void>>()

function loadStoredEntryIds(key: string) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(parsed) ? removeLegacySeedEntryIds(parsed) : []
  } catch {
    return []
  }
}

function pendingSavedEntriesStorageKey(userId: string) {
  return `the-commonplace.pending-saves.${userId}`
}

function loadPendingSavedEntryChanges(userId: string): PendingSavedEntryChanges {
  try {
    const parsed = JSON.parse(localStorage.getItem(pendingSavedEntriesStorageKey(userId)) || '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const changes: PendingSavedEntryChanges = {}
    Object.entries(parsed as Record<string, unknown>).forEach(([entryId, saved]) => {
      if (typeof saved === 'boolean') changes[entryId] = saved
    })
    return changes
  } catch {
    return {}
  }
}

function storePendingSavedEntryChanges(userId: string, changes: PendingSavedEntryChanges) {
  const storageKey = pendingSavedEntriesStorageKey(userId)
  if (Object.keys(changes).length === 0) localStorage.removeItem(storageKey)
  else localStorage.setItem(storageKey, JSON.stringify(changes))
}

function clearPendingSavedEntryChange(userId: string, entryId: string, saved: boolean) {
  const current = loadPendingSavedEntryChanges(userId)
  if (current[entryId] !== saved) return
  delete current[entryId]
  storePendingSavedEntryChanges(userId, current)
}

function queueCloudSavedEntryChange(userId: string, entryId: string, saved: boolean) {
  const queueKey = `${userId}:${entryId}`
  const previous = pendingSavedEntryWrites.get(queueKey) || Promise.resolve()
  const current = previous
    .catch(() => undefined)
    .then(() => submitOfflineAction({
      type: 'saved-entry',
      userId,
      entryId,
      saved,
      dedupeKey: `saved-entry:${entryId}`,
    }))
    .then((result) => {
      if (!result.queued) clearPendingSavedEntryChange(userId, entryId, saved)
    })
    .catch((error) => {
      console.error('Unable to sync saved entry to Firebase; it will retry next time.', error)
    })
  pendingSavedEntryWrites.set(queueKey, current)
  void current.finally(() => {
    if (pendingSavedEntryWrites.get(queueKey) === current) pendingSavedEntryWrites.delete(queueKey)
  })
  return current
}

function loadStoredHandles(key: string) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(parsed) ? removeLegacySeedHandles(parsed) : []
  } catch {
    return []
  }
}

function emptyPublicProfile(handle: string): PublicUserData {
  return {
    profile: {
      firstName: handle,
      lastName: '',
      showFullName: false,
      handle,
      email: '',
      bio: '',
      avatarUrl: '',
      coverUrl: '',
      showFollowLists: false,
      allowComments: false,
      showSavedActivity: false,
    },
    entries: [],
    collections: [],
    savedEntryIds: [],
    savedCollections: [],
  }
}

const EMPTY_USER_PROFILE: UserProfileState = {
  firstName: 'Reader',
  lastName: '',
  showFullName: false,
  handle: 'reader',
  email: '',
  bio: '',
  avatarUrl: '',
  coverUrl: '',
  showFollowLists: true,
  allowComments: true,
  showSavedActivity: false,
}

function loadLocalUserProfile(user?: AuthProfileSource | null) {
  try {
    const stored = localStorage.getItem(PROFILE_STORAGE_KEY)
    const profile = stored
      ? { ...EMPTY_USER_PROFILE, ...JSON.parse(stored) } as UserProfileState
      : EMPTY_USER_PROFILE
    if (!user) return profile
    return profileBelongsToAuthUser(profile, user) ? profile : accountProfileForUser(user)
  } catch {
    return user ? accountProfileForUser(user) : EMPTY_USER_PROFILE
  }
}

function canReuseLocalAccountData(user: AuthProfileSource) {
  try {
    const stored = localStorage.getItem(PROFILE_STORAGE_KEY)
    if (!stored) return false
    const profile = { ...EMPTY_USER_PROFILE, ...JSON.parse(stored) } as UserProfileState
    return profileBelongsToAuthUser(profile, user)
  } catch {
    return false
  }
}

function emptyCloudState() {
  return {
    likedEntryIds: [],
    savedEntryIds: [],
    disabledCommentEntryIds: [],
    followedUserHandles: [],
    followRequestedHandles: [],
    notifications: [],
  }
}

function accountProfileForUser(user: AuthProfileSource) {
  const pending = pendingSignupProfileForUser(user, localStorage.getItem(PENDING_SIGNUP_PROFILE_KEY))
  return profileFromAuthUser(user, pending?.displayName, pending?.handle, pending?.birthday)
}

function collectionItemFromEntity(
  entity: UniversalMediaEntity,
  artworkUrl: string,
  metadataChips: MetadataChip[],
): ProfileCollectionItem | null {
  const typeMap: Partial<Record<MediaEntityType, EntryType>> = {
    album: 'album',
    song: 'song',
    book: 'book',
    movie: 'film',
    tv: 'tv',
    game: 'game',
  }
  const type = typeMap[entity.type]
  if (!type) return null
  const creator = metadataChips.find((chip) =>
    ['artist', 'author', 'director', 'creator', 'studio', 'developer'].includes(chip.label.toLowerCase()),
  )?.value || entity.categoryLabel
  const year = metadataChips.find((chip) => /year|release date/i.test(chip.label))?.value
  const genre = metadataChips.find((chip) => /genre/i.test(chip.label))?.value
  const providerId = entity.providerId || entity.id
  return {
    id: `media:${type}:${providerId}`,
    type,
    title: entity.name,
    creator,
    provider: 'entity-profile',
    providerId,
    coverUrl: artworkUrl,
    year,
    genre,
  }
}

export default function AppController() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadEntryComposerModule()
    }, 2500)
    return () => window.clearTimeout(timer)
  }, [])
  const [entries, setEntries] = useState<Entry[]>(loadEntries)
  const entriesRef = useRef(entries)
  const entriesRevisionRef = useRef(0)
  const [publicFeedEntries, setPublicFeedEntries] = useState<Entry[]>([])
  const [postEngagements, setPostEngagements] = useState<Record<string, PostEngagement>>({})
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<EntryType | 'all'>('all')
  const { expandedCardId, setExpandedCardId, toggleCardExpanded } = useCardExpansion()

  const {
    logout,
    currentUser,
    loading: authLoading,
    resendVerificationEmail,
    verificationEmailCooldownSeconds,
    verificationEmailSent,
  } = useAuth()
  const currentUserId = currentUser?.uid
  const currentUserDisplayName = currentUser?.displayName
  const currentUserEmail = currentUser?.email
  const currentUserPhotoUrl = currentUser?.photoURL
  const currentUserCreationTime = currentUser?.metadata?.creationTime
  const authProfile = useMemo<AuthProfileSource | null>(() => currentUserId ? {
    uid: currentUserId,
    displayName: currentUserDisplayName,
    email: currentUserEmail,
    photoURL: currentUserPhotoUrl,
    metadata: { creationTime: currentUserCreationTime },
  } : null, [
    currentUserCreationTime,
    currentUserDisplayName,
    currentUserEmail,
    currentUserId,
    currentUserPhotoUrl,
  ])
  const cloudUserId = authProfile?.uid || null
  const [homeDataStatus, setHomeDataStatus] = useState<'loading' | 'ready'>(() =>
    authLoading || Boolean(cloudUserId) ? 'loading' : 'ready',
  )
  const personalizedFeed = usePersonalizedFeed(
    currentUser,
    typeFilter,
    homeDataStatus === 'ready',
  )
  const [activeView, setActiveView] = useState<ActiveView>(() => initialViewFromPath(location.pathname))
  const [selectedProfileHandle, setSelectedProfileHandle] = useState<string | null>(null)
  const [selectedProfileCollectionId, setSelectedProfileCollectionId] = useState<string | null>(null)
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null)
  const [selectedEntityType, setSelectedEntityType] = useState<MediaEntityType | null>(null)
  const [searchTab, setSearchTab] = useState<'media' | 'users'>('media')
  const [searchMediaFilter, setSearchMediaFilter] = useState<SearchCategory | 'all'>('all')
  const [headerMediaResults, setHeaderMediaResults] = useState<MetadataResult[]>([])
  const [headerIdentityResults, setHeaderIdentityResults] = useState<UniversalMediaEntity[]>([])
  const [headerMetadataSearchLoading, setHeaderMetadataSearchLoading] = useState(false)
  const [headerIdentitySearchLoading, setHeaderIdentitySearchLoading] = useState(false)
  const headerMediaSearchLoading = headerMetadataSearchLoading || headerIdentitySearchLoading
  const headerAlbumResults = headerMediaResults
  const headerAlbumSearchLoading = headerMediaSearchLoading
  void headerAlbumResults
  void headerAlbumSearchLoading
  const [profileCategoryFilter, setProfileCategoryFilter] = useState<string>('all')
  const searchEntityCacheRef = useRef(new Map<string, UniversalMediaEntity>())
  // Provider-scoped source ID -> verified canonical ID. Names are never aliases.
  const humanCanonicalMapRef = useRef(new Map<string, string>())
  // Set of legacy portrait entity types that should all collapse to 'human'.
  const LEGACY_HUMAN_TYPES = new Set<MediaEntityType>(['artist', 'actor', 'director', 'creator', 'author'])

  const getPathForEntity = (entityId: string, entityType?: MediaEntityType) => {
    const resolvedType =
      entityType ||
      UNIVERSAL_MEDIA_ENTITIES[entityId]?.type ||
      searchEntityCacheRef.current.get(entityId)?.type ||
      (MOCK_ENTITY_PROFILES[entityId]?.type as MediaEntityType | undefined) ||
      inferEntityTypeFromId(entityId)

    return getEntityRoutePath(entityId, resolvedType)
  }

  const handleOpenEntity = (entityId: string, entityType?: MediaEntityType) => {
    const resolvedType =
      entityType ||
      UNIVERSAL_MEDIA_ENTITIES[entityId]?.type ||
      searchEntityCacheRef.current.get(entityId)?.type ||
      (MOCK_ENTITY_PROFILES[entityId]?.type as MediaEntityType | undefined) ||
      inferEntityTypeFromId(entityId)

    setSelectedEntityId(entityId)
    setSelectedEntityType(resolvedType)
    setActiveView('entity')
    setSearchOpen(false)
    navigate(getEntityRoutePath(entityId, resolvedType))
  }

  const handleOpenCollectionMedia = (entry: Entry) => {
    const entityTypeByEntryType: Record<EntryType, MediaEntityType> = {
      album: 'album',
      book: 'book',
      film: 'movie',
      game: 'game',
      song: 'song',
      tv: 'tv',
    }
    const categoryLabelByEntryType: Record<EntryType, string> = {
      album: 'Album',
      book: 'Book',
      film: 'Film',
      game: 'Game',
      song: 'Song',
      tv: 'Show',
    }
    const creatorLabelByEntryType: Record<EntryType, string> = {
      album: 'Artist',
      book: 'Author',
      film: 'Director',
      game: 'Studio',
      song: 'Artist',
      tv: 'Creator',
    }
    const entityType = entityTypeByEntryType[entry.type]
    const entityId = `collection:${entry.type}:${entry.providerId || entry.id}`
    const entity: UniversalMediaEntity = {
      id: entityId,
      name: entry.title,
      type: entityType,
      categoryLabel: categoryLabelByEntryType[entry.type],
      providerId: entry.providerId,
      artworkUrl: resolveArtworkUrl(entry.coverUrl || '', entry.title, entry.type),
      description: entry.summary || `Catalog profile for ${entry.title}${entry.creator ? ` by ${entry.creator}` : ''}.`,
      metadataChips: [
        { label: creatorLabelByEntryType[entry.type], value: entry.creator || 'Unknown' },
        { label: 'Category', value: categoryLabelByEntryType[entry.type] },
        ...(entry.genre ? [{ label: 'Genre', value: entry.genre }] : []),
        ...(entry.year ? [{ label: 'Release Year', value: entry.year }] : []),
      ],
      communityRating: {
        average: entry.rating,
        count: entry.rating > 0 ? 1 : 0,
        distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      },
    }

    searchEntityCacheRef.current.set(entityId, entity)
    setPersistedEntityCache((current) => ({ ...current, [entityId]: entity }))
    void cacheProfileEntity(entity)
    handleOpenEntity(entityId, entityType)
  }

  const openCachedEntity = (entity: UniversalMediaEntity) => {
    searchEntityCacheRef.current.set(entity.id, entity)
    setPersistedEntityCache((current) => ({ ...current, [entity.id]: entity }))
    void cacheProfileEntity(entity)
    handleOpenEntity(entity.id, entity.type)
  }

  const handleOpenSearchEntity = (entity: HeaderSearchEntity) => {
    const universalEntity = entity.universalEntity || (
      entity.metadataResult ? metadataResultToUniversalEntity({
        id: entity.id,
        metadataResult: entity.metadataResult,
      }) : null
    )

    if (universalEntity) {
      searchEntityCacheRef.current.set(entity.id, universalEntity)
      setPersistedEntityCache((current) => ({ ...current, [entity.id]: universalEntity }))
      void cacheProfileEntity(universalEntity)
    }
    const feedType = FEED_ENTRY_TYPE_BY_ENTITY[(universalEntity?.type || entity.type) as MediaEntityType]
    if (currentUser && feedType && personalizedHomeFeedEnabled) {
      void recordFeedSignal(currentUser, 'search_open', {
        type: feedType,
        creator: entity.creatorValue,
      }).catch((error) => console.error('Unable to update Home recommendations.', error))
    }
    handleOpenEntity(entity.id, universalEntity?.type || entity.type as MediaEntityType)
  }

  const handleNavigateEntityBreadcrumb = (
    entityId: string,
    entityType?: MediaEntityType,
    resolvedEntity?: UniversalMediaEntity,
  ) => {
    if (resolvedEntity) {
      searchEntityCacheRef.current.set(entityId, resolvedEntity)
      setPersistedEntityCache((current) => ({ ...current, [entityId]: resolvedEntity }))
      void cacheProfileEntity(resolvedEntity)
    }

    const incomingType = resolvedEntity?.type ?? entityType
    if (incomingType && LEGACY_HUMAN_TYPES.has(incomingType)) {
      const canonicalId = humanCanonicalMapRef.current.get(entityId)
      if (canonicalId && canonicalId !== entityId) {
        const cachedEntity = searchEntityCacheRef.current.get(canonicalId)
        if (!cachedEntity && resolvedEntity) {
          const promoted: UniversalMediaEntity = { ...resolvedEntity, id: canonicalId, type: 'human' }
          searchEntityCacheRef.current.set(canonicalId, promoted)
          setPersistedEntityCache((current) => ({ ...current, [canonicalId]: promoted }))
        }
        setSelectedEntityId(canonicalId)
        setSelectedEntityType('human')
        setActiveView('entity')
        navigate(getEntityRoutePath(canonicalId, 'human'))
        return
      }
    }

    const resolvedType =
      resolvedEntity?.type ??
      entityType ??
      searchEntityCacheRef.current.get(entityId)?.type ??
      UNIVERSAL_MEDIA_ENTITIES[entityId]?.type ??
      (MOCK_ENTITY_PROFILES[entityId]?.type as MediaEntityType | undefined) ??
      inferEntityTypeFromId(entityId)

    setSelectedEntityId(entityId)
    setSelectedEntityType(resolvedType)
    setActiveView('entity')
    navigate(getPathForEntity(entityId, resolvedType))
  }

  const handleCanonicalMediaResolved = (
    sourceId: string,
    canonicalId: string,
    canonicalEntity: UniversalMediaEntity,
  ) => {
    // Cache under both IDs — future navigations from either path land on the same profile.
    searchEntityCacheRef.current.set(canonicalId, canonicalEntity)
    searchEntityCacheRef.current.set(sourceId, canonicalEntity)
    setPersistedEntityCache((current) => ({
      ...current,
      [canonicalId]: canonicalEntity,
      [sourceId]: canonicalEntity,
    }))
    void cacheProfileEntity(canonicalEntity)
    const isProviderScopedIdentity = /^(?:human|music-group):(tmdb|musicbrainz|openlibrary|itunes):/i.test(sourceId)
      || /^itunes:artist:\d+$/i.test(sourceId)
      || /^musicbrainz:artist:[0-9a-f-]{36}$/i.test(sourceId)
    if (canonicalEntity.type === 'human' || canonicalEntity.type === 'music_group') {
      humanCanonicalMapRef.current.set(sourceId, canonicalId)
    }
    if ((canonicalEntity.type === 'human' || canonicalEntity.type === 'music_group') && isProviderScopedIdentity) {
      void cacheIdentityAlias(sourceId, canonicalId)
    }
    setSelectedEntityId(canonicalId)
    setSelectedEntityType(canonicalEntity.type)
    navigate(getEntityRoutePath(canonicalId, canonicalEntity.type), { replace: true })
  }

  const handleHome = () => {
    setSelectedEntityId(null)
    setSelectedEntityType(null)
    setSelectedProfileHandle(null)
    setActiveView('feed')
    navigate('/')
  }

  const handlePageBack = () => {
    const historyIndex = window.history.state?.idx
    if (typeof historyIndex === 'number' && historyIndex > 0) {
      navigate(-1)
      return
    }
    if (window.history.length > 1) {
      navigate(-1)
      return
    }

    handleHome()
  }

  const handleOpenSettings = () => {
    setSelectedEntityId(null)
    setSelectedEntityType(null)
    setSelectedProfileHandle(null)
    setActiveView('settings')
    setProfileMenuOpen(false)
    navigate('/settings')
  }

  const handleOpenActivity = () => {
    setSelectedEntityId(null)
    setSelectedEntityType(null)
    setSelectedProfileHandle(null)
    setActiveView('activity')
    setProfileMenuOpen(false)
    navigate('/activity')
  }

  const handleOpenHelp = () => {
    setSelectedEntityId(null)
    setSelectedEntityType(null)
    setSelectedProfileHandle(null)
    setActiveView('help')
    setProfileMenuOpen(false)
    navigate('/help')
  }

  const [userProfile, setUserProfile] = useState<UserProfileState>(() => loadLocalUserProfile(currentUser))
  const [cloudExternalProfile, setCloudExternalProfile] = useState<{
    handle: string
    data: PublicUserData
  } | null>(null)

  useEffect(() => {
    if (!currentUser?.uid) return
    if (profileBelongsToAuthUser(userProfile, currentUser)) return
    const accountProfile = accountProfileForUser(currentUser)
    setUserProfile(accountProfile)
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(accountProfile))
  }, [currentUser, currentUser?.displayName, currentUser?.email, currentUser?.photoURL, userProfile])

  useEffect(() => {
    const handle = selectedProfileHandle
    if (!handle || handle === userProfile.handle) {
      setCloudExternalProfile(null)
      return
    }
    let cancelled = false
    void loadPublicUserByHandle(handle, cloudUserId)
      .then((data) => {
        if (!cancelled) setCloudExternalProfile(data ? { handle, data } : null)
      })
      .catch((error) => {
        if (!cancelled) setCloudExternalProfile(null)
        console.error('Unable to load the public Firebase profile.', error)
      })
    return () => {
      cancelled = true
    }
  }, [cloudUserId, selectedProfileHandle, userProfile.handle])

  const persistUserProfile = async (updated: UserProfileState) => {
    setUserProfile(updated)
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updated))
    if (!cloudUserId || !canUseCloudData(cloudUserId)) return
    await submitOfflineAction({
      type: 'profile',
      userId: cloudUserId,
      profile: updated,
      dedupeKey: 'profile',
    })
  }

  const userProfileName = userProfile.showFullName
    ? `${userProfile.firstName} ${userProfile.lastName}`.trim()
    : userProfile.firstName
  const showUserProfileName = hasDistinctProfileDisplayName(userProfileName, userProfile.handle)

  const handleOpenUserProfile = (handle?: string) => {
    const cleanHandle = (handle || userProfile.handle).replace(/^@/, '')
    setSelectedProfileHandle(cleanHandle === userProfile.handle ? null : cleanHandle)
    setSelectedProfileCollectionId(null)
    setActiveView('profile')
    setSearchOpen(false)
    navigate(`/users/${routeSegment(cleanHandle)}`)
  }

  // Social Interaction States (Likes, Saves, Comments Disabled per entry)
  const [likedEntryIds, setLikedEntryIds] = useState<string[]>(() => {
    return loadStoredEntryIds('the-commonplace.likes')
  })
  const [savedEntryIds, setSavedEntryIds] = useState<string[]>(() => {
    return loadStoredEntryIds('the-commonplace.saves')
  })
  const [disabledCommentEntryIds, setDisabledCommentEntryIds] = useState<string[]>(() => {
    return loadStoredEntryIds('the-commonplace.disabled-comments')
  })

  const toggleLikeEntry = (id: string) => {
    const target = [...entries, ...personalizedFeed.items, ...publicFeedEntries].find((entry) => entry.id === id)
    const previousEngagement = postEngagements[id]
    const wasLiked = previousEngagement?.isLiked ?? likedEntryIds.includes(id)
    const nextLiked = !wasLiked
    const nextLikedEntryIds = nextLiked
      ? Array.from(new Set([...likedEntryIds, id]))
      : likedEntryIds.filter((item) => item !== id)

    setPostEngagements((previous) => ({
      ...previous,
      [id]: {
        likeCount: Math.max(0, (previous[id]?.likeCount || 0) + (nextLiked ? 1 : -1)),
        commentCount: previous[id]?.commentCount || 0,
        isLiked: nextLiked,
      },
    }))
    setLikedEntryIds(nextLikedEntryIds)
    localStorage.setItem('the-commonplace.likes', JSON.stringify(nextLikedEntryIds))
    persistCloudState({ likedEntryIds: nextLikedEntryIds })
    if (target) sendFeedSignal('like', target, nextLiked)

    if (cloudUserId) {
      void submitOfflineAction({
        type: 'post-like',
        userId: cloudUserId,
        postId: id,
        liked: nextLiked,
        actor: { name: userProfileName, handle: userProfile.handle },
        entryTitle: target?.title || 'Untitled entry',
        dedupeKey: `post-like:${id}`,
      }).catch((error) => {
        console.error('Unable to sync post like to Firebase.', error)
        setPostEngagements((previous) => ({
          ...previous,
          [id]: previousEngagement || { likeCount: 0, commentCount: 0, isLiked: wasLiked },
        }))
        setLikedEntryIds(likedEntryIds)
        localStorage.setItem('the-commonplace.likes', JSON.stringify(likedEntryIds))
      })
    }
  }

  const toggleSaveEntry = (id: string) => {
    const target = [...entries, ...personalizedFeed.items, ...publicFeedEntries].find((entry) => entry.id === id)
    setSavedEntryIds((prev) => {
      const nextSaved = !prev.includes(id)
      const next = nextSaved ? [...prev, id] : prev.filter((item) => item !== id)
      localStorage.setItem('the-commonplace.saves', JSON.stringify(next))
      if (cloudUserId) {
        const pending = updatePendingSavedEntryChanges(loadPendingSavedEntryChanges(cloudUserId), id, nextSaved)
        storePendingSavedEntryChanges(cloudUserId, pending)
        void queueCloudSavedEntryChange(cloudUserId, id, nextSaved)
      }
      if (target) sendFeedSignal('save', target, nextSaved)
      return next
    })
  }

  const toggleCommentsDisabled = (id: string) => {
    setDisabledCommentEntryIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
      localStorage.setItem('the-commonplace.disabled-comments', JSON.stringify(next))
      persistCloudState({ disabledCommentEntryIds: next })
      if (cloudUserId) {
          void submitOfflineAction({
            type: 'post-commenting',
            userId: cloudUserId,
            postId: id,
            commentsDisabled: next.includes(id),
            dedupeKey: `post-commenting:${id}`,
          }).catch((error) => {
          console.error('Unable to sync comment settings to Firebase.', error)
        })
      }
      return next
    })
  }

  const [composerOpen, setComposerOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null)
  const [composerInitialDraft, setComposerInitialDraft] = useState<EntryDraft | null>(null)
  const [composerInitialLyrics, setComposerInitialLyrics] = useState<string>('')
  const draftStorageOwnerId = cloudUserId || 'local'
  const [savedEntryDrafts, setSavedEntryDrafts] = useState(() => loadEntryDrafts(draftStorageOwnerId))
  const [activeComposerDraftId, setActiveComposerDraftId] = useState<string | null>(null)
  const [verificationPromptOpen, setVerificationPromptOpen] = useState(false)
  const [verificationBannerDismissed, setVerificationBannerDismissed] = useState(false)
  const [bannerSendingEmail, setBannerSendingEmail] = useState(false)
  const [bannerEmailNotice, setBannerEmailNotice] = useState('')
  const verificationCooldownLabel = `${Math.floor(verificationEmailCooldownSeconds / 60)}:${String(verificationEmailCooldownSeconds % 60).padStart(2, '0')}`

  useEffect(() => {
    setSavedEntryDrafts(loadEntryDrafts(draftStorageOwnerId))
    setActiveComposerDraftId(null)
  }, [draftStorageOwnerId])

  const handleBannerVerifyNow = async () => {
    if (verificationEmailCooldownSeconds > 0 || bannerSendingEmail) return
    try {
      setBannerSendingEmail(true)
      setBannerEmailNotice('')
      await resendVerificationEmail()
      setBannerEmailNotice(`Sent to ${currentUser?.email ?? 'your email'}.`)
    } catch (error: unknown) {
      setBannerEmailNotice(
        (error as Error)?.message?.replace(/^Firebase:\s*/, '') || 'Could not send verification email.',
      )
    } finally {
      setBannerSendingEmail(false)
    }
  }
  const [overlayEntry, setOverlayEntry] = useState<Entry | null>(null)
  const [selectedReadingEntryId, setSelectedReadingEntryId] = useState<string | null>(() => {
    const [section, rawId] = location.pathname.split('/').filter(Boolean).map(decodeRouteSegment)
    return section === 'entries' && rawId ? rawId : null
  })
  const [readingEntryStatus, setReadingEntryStatus] = useState<'idle' | 'loading' | 'ready' | 'not-found'>(() =>
    location.pathname.split('/').filter(Boolean)[0]?.toLowerCase() === 'entries' ? 'loading' : 'idle',
  )
  const [overlayNotificationFocus, setOverlayNotificationFocus] = useState<{
    postId: string
    commentId?: string
    replyId?: string
    requestId: string
  } | null>(null)
  const notificationOpenRequestRef = useRef('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const mobileMenuDialogRef = useAccessibleDialog<HTMLElement>({
    open: mobileMenuOpen,
    onClose: () => setMobileMenuOpen(false),
  })
  const [appFeedback, setAppFeedback] = useState<{ kind: 'success' | 'error' | 'offline'; message: string } | null>(null)
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine)
  const [showScrollToTop, setShowScrollToTop] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [logoutLoading, setLogoutLoading] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const [collectionTarget, setCollectionTarget] = useState<ProfileCollectionItem | null>(null)
  const gridRef = useRef<HTMLElement>(null)
  const feedSentinelRef = useRef<HTMLDivElement>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const [searchLimit, setSearchLimit] = useState(SEARCH_INITIAL_RESULT_LIMIT)
  const [persistedEntityCache, setPersistedEntityCache] = useState<Record<string, UniversalMediaEntity>>({})

  const sendFeedSignal = (
    action: Parameters<typeof recordFeedSignal>[1],
    entry: Pick<Entry, 'type' | 'creator' | 'genre'>,
    active?: boolean,
  ) => {
    if (!currentUser || !personalizedHomeFeedEnabled) return
    void recordFeedSignal(currentUser, action, feedSignalSubject(entry), active)
      .catch((error) => console.error('Unable to update Home recommendations.', error))
  }

  const openEntryOverlay = (entry: Entry) => {
    notificationOpenRequestRef.current = ''
    setOverlayNotificationFocus(null)
    setOverlayEntry(entry)
    setSelectedReadingEntryId(entry.id)
    setReadingEntryStatus('ready')
    setActiveView('reading')
    navigate(`/entries/${routeSegment(entry.id)}`)
    if (currentUser?.uid && shouldRecordEntryOpen(currentUser.uid, entry.id)) {
      sendFeedSignal('open', entry)
    }
  }

  const closeEntryOverlay = () => {
    notificationOpenRequestRef.current = ''
    setOverlayNotificationFocus(null)
    handlePageBack()
  }

  useEffect(() => {
    void migrateUnsafeIdentityCaches()
    purgeLegacySeedStorage()
  }, [])

  useEffect(() => {
    const updateScrollToTopVisibility = () => setShowScrollToTop(window.scrollY > 0)
    updateScrollToTopVisibility()
    window.addEventListener('scroll', updateScrollToTopVisibility, { passive: true })
    return () => window.removeEventListener('scroll', updateScrollToTopVisibility)
  }, [])

  useEffect(() => {
    if (!profileMenuOpen) return
    const closeProfileMenuOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', closeProfileMenuOutside)
    return () => document.removeEventListener('mousedown', closeProfileMenuOutside)
  }, [profileMenuOpen])

  useEffect(() => {
    setProfileMenuOpen(false)
    setNotificationsOpen(false)
    setSearchOpen(false)
    setMobileMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!appFeedback) return
    const timeout = window.setTimeout(() => setAppFeedback(null), 3500)
    return () => window.clearTimeout(timeout)
  }, [appFeedback])

  useEffect(() => {
    const showOfflineNotice = () => {
      setIsOnline(false)
      setAppFeedback({
        kind: 'offline',
        message: 'No internet connection. Changes will be saved once the internet returns.',
      })
    }
    const syncAfterReconnect = async (announce: boolean) => {
      setIsOnline(true)
      if (!cloudUserId) {
        if (announce) setAppFeedback({ kind: 'success', message: 'Internet connection restored.' })
        return
      }
      const pendingCount = getPendingOfflineActionCount(cloudUserId)
      const pendingSaves = loadPendingSavedEntryChanges(cloudUserId)
      const totalPending = pendingCount + Object.keys(pendingSaves).length
      if (announce) {
        setAppFeedback({
          kind: 'success',
          message: totalPending > 0 ? 'Back online. Saving your changes…' : 'Internet connection restored.',
        })
      }
      Object.entries(pendingSaves).forEach(([entryId, saved]) => {
        void queueCloudSavedEntryChange(cloudUserId, entryId, saved)
      })
      const result = await flushOfflineActions(cloudUserId)
      if (result.completed > 0 && result.remaining === 0) {
        setAppFeedback({ kind: 'success', message: 'You’re back online. All queued changes were saved.' })
      } else if (result.remaining > 0 && announce) {
        setAppFeedback({
          kind: 'offline',
          message: 'Connection is unstable. Your changes are still saved and will retry automatically.',
        })
      }
    }

    const handleOnline = () => { void syncAfterReconnect(true) }
    const handleQueuedChange = () => {
      if (!navigator.onLine) showOfflineNotice()
    }
    window.addEventListener('offline', showOfflineNotice)
    window.addEventListener('online', handleOnline)
    window.addEventListener(OFFLINE_QUEUE_EVENT, handleQueuedChange)
    if (!navigator.onLine) showOfflineNotice()
    else if (cloudUserId && getPendingOfflineActionCount(cloudUserId) > 0) void syncAfterReconnect(false)
    return () => {
      window.removeEventListener('offline', showOfflineNotice)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener(OFFLINE_QUEUE_EVENT, handleQueuedChange)
    }
  }, [cloudUserId])

  useEffect(() => {
    if (!selectedEntityId || UNIVERSAL_MEDIA_ENTITIES[selectedEntityId] || searchEntityCacheRef.current.has(selectedEntityId)) {
      return
    }

    let cancelled = false
    getCachedProfileEntity(selectedEntityId).then((cachedEntity) => {
      if (cancelled || !cachedEntity) return
      searchEntityCacheRef.current.set(cachedEntity.id, cachedEntity)
      searchEntityCacheRef.current.set(selectedEntityId, cachedEntity)
      setPersistedEntityCache((current) => ({ ...current, [cachedEntity.id]: cachedEntity, [selectedEntityId]: cachedEntity }))
      if (
        cachedEntity.id !== selectedEntityId
        && (cachedEntity.type === 'human' || cachedEntity.type === 'music_group')
      ) {
        setSelectedEntityId(cachedEntity.id)
        setSelectedEntityType(cachedEntity.type)
        navigate(getEntityRoutePath(cachedEntity.id, cachedEntity.type), { replace: true })
      }
    }).catch(() => {})

    return () => {
      cancelled = true
    }
  }, [navigate, selectedEntityId])

  useEffect(() => {
    const segments = location.pathname
      .split('/')
      .filter(Boolean)
      .map(decodeRouteSegment)

    const [section, rawId, nestedSection, nestedId] = segments

    if (section === 'verify-email' || (section === 'v' && rawId) || (section === 'reset-password' && rawId)) return
    if (authLoading) return
    const isAuthRoute = section === 'login' || section === 'register'
    if (!currentUser) {
      if (section === 'register') {
        setActiveView('register')
      } else if (!section || section === 'login') {
        setActiveView('login')
        if (section !== 'login') navigate('/login', { replace: true })
      } else if (
        section === 'profile'
        || section === 'settings'
        || section === 'activity'
        || section === 'help'
        || section === 'entries'
        || section === 'users'
        || Boolean(entityTypeByRouteSegment[section])
      ) {
        setActiveView('login')
        navigate('/login', { replace: true })
      } else {
        setActiveView('not-found')
      }
      setSelectedProfileHandle(null)
      setSelectedEntityId(null)
      setSelectedEntityType(null)
      return
    }
    if (isAuthRoute) {
      navigate('/', { replace: true })
      return
    }

    if (section !== 'entries') {
      setSelectedReadingEntryId(null)
      setReadingEntryStatus('idle')
      setOverlayEntry(null)
    }

    if (!section) {
      setActiveView('feed')
      setSelectedProfileHandle(null)
      setSelectedEntityId(null)
      setSelectedEntityType(null)
      return
    }

    if (section === 'profile') {
      navigate(`/users/${routeSegment(userProfile.handle)}`, { replace: true })
      return
    }

    if (section === 'login') {
      setActiveView('login')
      setSelectedProfileHandle(null)
      setSelectedEntityId(null)
      setSelectedEntityType(null)
      return
    }

    if (section === 'register') {
      setActiveView('register')
      setSelectedProfileHandle(null)
      setSelectedEntityId(null)
      setSelectedEntityType(null)
      return
    }

    if (section === 'settings') {
      setActiveView('settings')
      setSelectedProfileHandle(null)
      setSelectedEntityId(null)
      setSelectedEntityType(null)
      return
    }

    if (section === 'entries' && rawId) {
      setActiveView('reading')
      setSelectedReadingEntryId(rawId)
      if (overlayEntry?.id !== rawId) {
        setOverlayEntry(null)
        setReadingEntryStatus('loading')
      }
      setSelectedProfileHandle(null)
      setSelectedEntityId(null)
      setSelectedEntityType(null)
      return
    }

    if (section === 'activity' || section === 'help') {
      setActiveView(section)
      setSelectedProfileHandle(null)
      setSelectedEntityId(null)
      setSelectedEntityType(null)
      return
    }

    if (section === 'users' && rawId) {
      const cleanHandle = rawId.replace(/^@/, '')
      setActiveView('profile')
      setSelectedProfileHandle(cleanHandle === userProfile.handle ? null : cleanHandle)
      setSelectedProfileCollectionId(nestedSection === 'collections' && nestedId ? nestedId : null)
      setSelectedEntityId(null)
      setSelectedEntityType(null)
      return
    }

    const routeEntityType = entityTypeByRouteSegment[section]
    if (routeEntityType && rawId) {
      setActiveView('entity')
      setSelectedProfileHandle(null)
      setSelectedEntityId(rawId)
      setSelectedEntityType(routeEntityType)
      return
    }

    setActiveView('not-found')
    setSelectedProfileHandle(null)
    setSelectedEntityId(null)
    setSelectedEntityType(null)
  // Entry data changes must not replay routing for the previous URL. The URL is
  // the navigation source of truth; including overlayEntry here caused a brief
  // return to Home before React Router committed the new reading-page path.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, currentUser, location.pathname, navigate, userProfile.handle])

  useEffect(() => {
    setSearchLimit(SEARCH_INITIAL_RESULT_LIMIT)
  }, [query, searchOpen, searchTab])

  // Seed known artwork URLs without issuing catalog-wide network requests.
  useEffect(() => {
    Object.values(UNIVERSAL_MEDIA_ENTITIES).forEach((entity) => {
      if (entity.artworkUrl) {
        const safeArtworkUrl = resolveArtworkUrl(entity.artworkUrl, entity.name, entity.categoryLabel)
        entityImageCacheMap.set(entity.id, safeArtworkUrl)
        if (['artist', 'author', 'director', 'creator', 'actor'].includes(entity.type)) {
          entityImageCacheMap.set(`${entity.type}:${entity.id}`, safeArtworkUrl)
        }
      }
      if (entity.secondaryCollection?.items) {
        entity.secondaryCollection.items.forEach((item) => {
          if (item.artworkUrl) {
            const safeArtworkUrl = resolveArtworkUrl(item.artworkUrl, item.title, item.subtitle)
            entityImageCacheMap.set(item.id, safeArtworkUrl)
          }
        })
      }
      if (entity.relatedEntities?.items) {
        entity.relatedEntities.items.forEach((item) => {
          if (item.artworkUrl) {
            const safeArtworkUrl = resolveArtworkUrl(item.artworkUrl, item.title, item.subtitle)
            entityImageCacheMap.set(item.id, safeArtworkUrl)
            if (['artist', 'author', 'director', 'creator', 'actor'].includes(item.type || '')) {
              entityImageCacheMap.set(`${item.type}:${item.id}`, safeArtworkUrl)
            }
          }
        })
      }
    })

    Object.values(MOCK_ENTITY_PROFILES).forEach((profile) => {
      if (profile.coverUrl) {
        entityImageCacheMap.set(profile.id, resolveArtworkUrl(profile.coverUrl, profile.title, profile.type))
      }
    })
  }, [])

  const shouldSearchIdentities = searchMediaFilter === 'all' || searchMediaFilter === 'people'

  useEffect(() => {
    const normalizedQuery = query.trim()
    if (!searchOpen || searchTab !== 'media' || normalizedQuery.length < 2 || !shouldSearchIdentities) {
      setHeaderIdentityResults([])
      setHeaderIdentitySearchLoading(false)
      return
    }

    const abortController = new AbortController()
    setHeaderIdentitySearchLoading(true)
    setHeaderIdentityResults([])
    const timer = window.setTimeout(() => {
      searchIdentities(normalizedQuery, abortController.signal, 10)
        .then((result) => {
          if (!abortController.signal.aborted) {
            setHeaderIdentityResults(result.candidates.map(identityToUniversalEntity))
          }
        })
        .catch((err) => {
          if ((err as Error)?.name === 'AbortError') return
        })
        .finally(() => {
          if (!abortController.signal.aborted) setHeaderIdentitySearchLoading(false)
        })
    }, 160)

    return () => {
      abortController.abort()
      window.clearTimeout(timer)
    }
  }, [query, searchOpen, searchTab, shouldSearchIdentities])

  useEffect(() => {
    const normalizedQuery = query.trim()
    const selectedType = searchMediaFilter === 'all' || searchMediaFilter === 'people'
      ? undefined
      : SEARCH_ENTRY_TYPE_BY_FILTER[searchMediaFilter]
    const typesToSearch = selectedType
      ? [selectedType]
      : searchMediaFilter === 'people'
        ? []
        : entryTypes.map((entryType) => entryType.id)

    if (!searchOpen || searchTab !== 'media' || normalizedQuery.length < 2) {
      setHeaderMediaResults([])
      setHeaderMetadataSearchLoading(false)
      return
    }
    if (typesToSearch.length === 0) {
      // Keep any provider-derived people already returned by the All search while
      // its dedicated identity request continues. The People filter hides the
      // unrelated catalog rows, so clearing here only causes an avoidable flash.
      setHeaderMetadataSearchLoading(false)
      return
    }

    const abortController = new AbortController()
    setHeaderMetadataSearchLoading(true)
    setHeaderMediaResults([])
    const timer = window.setTimeout(() => {
      let pendingSearches = typesToSearch.length
      const markSearchComplete = () => {
        pendingSearches -= 1
        if (pendingSearches === 0 && !abortController.signal.aborted) {
          setHeaderMetadataSearchLoading(false)
        }
      }

      typesToSearch.forEach((type) => {
        searchMetadata(type, normalizedQuery, abortController.signal, { priority: 'high' })
          .then((results) => {
            if (!abortController.signal.aborted) {
              setHeaderMediaResults((current) => [...current, ...results])
            }
          })
          .catch((err) => {
            if ((err as Error)?.name === 'AbortError') return
          })
          .finally(markSearchComplete)
      })
    }, 220)

    return () => {
      abortController.abort()
      window.clearTimeout(timer)
    }
  }, [query, searchMediaFilter, searchOpen, searchTab])

  const mediaSearchResults = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query)
    if (!normalizedQuery) return []

    const isYearQuery = /^\d{4}$/.test(normalizedQuery)
    const steamArtworkFallbackActive = headerMediaResults.some((result) =>
      result.type === 'game' && (
        Boolean(result.preferWikipediaArtwork) || /rawg|steam/i.test(result.gameMetadata?.metadataSource || '')
      ),
    )

    const localProfileResults = Object.values(UNIVERSAL_MEDIA_ENTITIES)
      .filter((entity) => {
        const searchEntity = universalEntityToSearchEntity(entity, 0)
        const titleNorm = normalizeSearchText(entity.name)
        const creatorChips = entity.metadataChips
          .filter((c) => /artist|author|director|creator|developer|studio/i.test(c.label))
          .map((c) => c.value)
          .join(' ')
        const creatorNorm = normalizeSearchText(creatorChips)

        if (isYearQuery) {
          const titleMatches = titleNorm.includes(normalizedQuery)
          const creatorMatches = creatorNorm.includes(normalizedQuery)
          if (!titleMatches && !creatorMatches) return false
        }

        return searchEntityMatchesQuery(searchEntity, normalizedQuery)
      })
      .map((entity, index) => {
        const searchEntity = universalEntityToSearchEntity(entity, index)
        if (entity.type !== 'game') return searchEntity

        const gameSearchEntity = steamArtworkFallbackActive
          ? { ...searchEntity, preferWikipediaArtwork: true }
          : searchEntity
        if (gameSearchEntity.artworkUrl) return gameSearchEntity

        const gameMetadataMatch = headerMediaResults
          .filter((result) => result.type === 'game')
          .map((result) => ({ result, score: scoreGameTitleMatch(result.title, entity.name) }))
          .sort((a, b) => b.score - a.score)
          .find((item) => item.score > 1000)?.result
        return gameMetadataMatch?.coverUrl
          ? { ...gameSearchEntity, artworkUrl: resolveArtworkUrl(gameMetadataMatch.coverUrl, entity.name, entity.type) }
          : gameSearchEntity
      })

    const typeRankCounters: Record<string, number> = {}
    const metadataResults = headerMediaResults
      .filter((result) => !isYearOnlyMetadataMatch(result, normalizedQuery))
      .map((result) => {
        typeRankCounters[result.type] = (typeRankCounters[result.type] || 0) + 1
        return metadataResultToSearchEntity(result, typeRankCounters[result.type] - 1)
      })
      .filter((entity) => searchEntityMatchesQuery(entity, normalizedQuery))

    const identityResults = headerIdentityResults
      .map((identity, index) => universalEntityToSearchEntity(identity, index))
      .filter((identity) => searchEntityMatchesQuery(identity, normalizedQuery))

    const providerScopedMusicPeople = dedupeSearchEntities(
      headerMediaResults
        .map(providerScopedMusicIdentityFromMetadataResult)
        .filter((entity): entity is UniversalMediaEntity => Boolean(entity))
        .map((entity, index) => universalEntityToSearchEntity(entity, index)),
    ).filter((identity) => searchEntityMatchesQuery(identity, normalizedQuery))

    const combined = dedupeSearchEntities([
      ...identityResults,
      ...providerScopedMusicPeople,
      ...localProfileResults,
      ...metadataResults,
    ])

    return combined.sort((a, b) => {
      const scoreA = getSearchEntityScore(a, normalizedQuery)
      const scoreB = getSearchEntityScore(b, normalizedQuery)
      return scoreB - scoreA
    })
  }, [headerIdentityResults, headerMediaResults, query])

  const [followedUserHandles, setFollowedUserHandles] = useState<string[]>(() => {
    return loadStoredHandles('the-commonplace.following-users')
  })

  const toggleFollowUser = (handle: string) => {
    const clean = handle.replace(/^@/, '')
    setFollowedUserHandles((prev) => {
      const next = prev.includes(clean) ? prev.filter((h) => h !== clean) : [...prev, clean]
      localStorage.setItem('the-commonplace.following-users', JSON.stringify(next))
      persistCloudState({ followedUserHandles: next })
      if (cloudUserId) {
        void submitOfflineAction({
          type: 'follow',
          userId: cloudUserId,
          targetHandle: clean,
          following: next.includes(clean),
          actor: { name: userProfileName, handle: userProfile.handle },
          dedupeKey: `follow:${clean}`,
        })
          .then(() => undefined)
          .catch((error) => {
            console.error('Unable to sync follow relationship to Firebase.', error)
            setAppFeedback({ kind: 'error', message: 'The follow change could not be saved. Please try again.' })
          })
      }
      return next
    })
  }

  const [followRequestedHandles, setFollowRequestedHandles] = useState<string[]>(() => {
    return loadStoredHandles('the-commonplace.follow-requests')
  })

  const toggleFollowRequest = (handle: string) => {
    const clean = handle.replace(/^@/, '')
    setFollowRequestedHandles((prev) => {
      const next = prev.includes(clean) ? prev.filter((h) => h !== clean) : [...prev, clean]
      localStorage.setItem('the-commonplace.follow-requests', JSON.stringify(next))
      persistCloudState({ followRequestedHandles: next })
      if (cloudUserId) {
        void submitOfflineAction({
          type: 'follow-request',
          userId: cloudUserId,
          targetHandle: clean,
          requested: next.includes(clean),
          dedupeKey: `follow-request:${clean}`,
        }).catch((error) => {
          console.error('Unable to sync follow request to Firebase.', error)
        })
      }
      return next
    })
  }

  // ── Notifications ────────────────────────────────────────────────────────────
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem('the-commonplace.notifications') || '[]')
      return Array.isArray(parsed)
        ? parsed.filter((notification) => !isLegacySeedHandle(notification?.actorHandle))
        : []
    } catch {
      return []
    }
  })

  const cloudHydratedUserRef = useRef<string | null>(null)
  const localMigrationSnapshotRef = useRef<UserCloudSnapshot>({
    profile: userProfile,
    entries,
    state: {
      likedEntryIds,
      savedEntryIds,
      disabledCommentEntryIds,
      followedUserHandles,
      followRequestedHandles,
      notifications,
    },
  })

  useEffect(() => {
    if (authLoading) {
      setHomeDataStatus('loading')
      return
    }

    if (!cloudUserId || !authProfile) {
      setPublicFeedEntries([])
      setHomeDataStatus('ready')
      return
    }
    if (cloudHydratedUserRef.current === cloudUserId) {
      setHomeDataStatus('ready')
      return
    }
    setHomeDataStatus('loading')
    cloudHydratedUserRef.current = cloudUserId
    const hydrationEntriesRevision = entriesRevisionRef.current
    let cancelled = false

    const pendingRegistration = pendingSignupProfileForUser(
      authProfile,
      localStorage.getItem(PENDING_SIGNUP_PROFILE_KEY),
    )
    const storedMigrationSnapshot = localMigrationSnapshotRef.current
    const reuseLocalData = canReuseLocalAccountData(authProfile)
    const accountHasLocalEntries = hasAccountEntryStorage(cloudUserId)
    const canRecoverLocalEntries = accountHasLocalEntries || reuseLocalData
    const accountLocalEntries = accountHasLocalEntries
      ? loadEntries(cloudUserId)
      : reuseLocalData
        ? storedMigrationSnapshot.entries
        : []
    const migrationSnapshot = reuseLocalData
      ? {
          ...storedMigrationSnapshot,
          profile: pendingRegistration
              ? profileFromAuthUser(
                authProfile,
                pendingRegistration.displayName,
                pendingRegistration.handle,
                pendingRegistration.birthday,
              )
            : loadLocalUserProfile(authProfile),
          entries: accountLocalEntries,
        }
      : {
          profile: accountProfileForUser(authProfile),
          entries: accountLocalEntries,
          state: emptyCloudState(),
        }

    void loadOrMigrateUserData(cloudUserId, migrationSnapshot)
      .then(async (loadedSnapshot) => {
        let snapshot = loadedSnapshot
        const resetLegacyAccount = shouldResetLegacyDemoProfile(snapshot.profile, authProfile)
        if (resetLegacyAccount) {
          const cleanExistingHandle = snapshot.profile.handle.replace(/^@/, '').trim().toLowerCase()
          const repairedAccountProfile = accountProfileForUser(authProfile)
          const repairedProfile = await saveUserProfile(cloudUserId, {
            ...repairedAccountProfile,
            handle: /^[a-z0-9_]{3,20}$/.test(cleanExistingHandle) && cleanExistingHandle !== 'jimboii'
              ? cleanExistingHandle
              : repairedAccountProfile.handle,
            createdAt: snapshot.profile.createdAt,
          })
          snapshot = { profile: repairedProfile, entries: [], state: emptyCloudState() }
        }
        if (!snapshot.profile.createdAt) {
          const createdAt = authProfile.metadata?.creationTime || new Date().toISOString()
          const repairedProfile = await saveUserProfile(cloudUserId, {
            ...snapshot.profile,
            createdAt,
          })
          snapshot = { ...snapshot, profile: repairedProfile }
        }
        if (pendingRegistration && snapshot.profile.handle !== pendingRegistration.handle) {
          const registeredProfile = profileFromAuthUser(
            authProfile,
            pendingRegistration.displayName,
            pendingRegistration.handle,
            pendingRegistration.birthday,
          )
          const repairedProfile = await saveUserProfile(cloudUserId, {
            ...snapshot.profile,
            firstName: registeredProfile.firstName,
            lastName: registeredProfile.lastName,
            showFullName: registeredProfile.showFullName,
            handle: pendingRegistration.handle,
            email: registeredProfile.email,
            birthday: snapshot.profile.birthday || registeredProfile.birthday,
          })
          snapshot = { ...snapshot, profile: repairedProfile }
        }
        const [createdCollections, savedCollections] = resetLegacyAccount
          ? [[], []]
          : await Promise.all([
              loadOrMigrateUserCollections(
                cloudUserId,
                'created',
                reuseLocalData ? loadProfileCollections(snapshot.profile.handle) : [],
              ),
              loadOrMigrateUserCollections(
                cloudUserId,
                'saved',
                reuseLocalData ? loadSavedProfileCollections(snapshot.profile.handle) : [],
              ),
            ])
        const loadedPublicEntries = personalizedHomeFeedEnabled
          ? []
          : await loadPublicFeedEntries(cloudUserId).catch(() => [])
        if (cancelled) return
        const cleanCloudEntries = snapshot.entries.filter((entry) => !isLegacySeedEntry(entry))
        const pendingEntrySync = loadPendingEntrySync(cloudUserId)
        const entriesChangedDuringHydration = entriesRevisionRef.current !== hydrationEntriesRevision
        const localEntries = (entriesChangedDuringHydration
          ? entriesRef.current
          : migrationSnapshot.entries
        ).filter((entry) => !isLegacySeedEntry(entry))
        const cleanEntries = pendingEntrySync || entriesChangedDuringHydration
          ? localEntries
          : canRecoverLocalEntries
            ? reconcileEntrySnapshots(cleanCloudEntries, localEntries)
            : cleanCloudEntries
        const cleanCreatedCollections = createdCollections.filter((collection) => !isLegacySeedCollection(collection))
        const cleanSavedCollections = savedCollections.filter((collection) => !isLegacySeedCollection(collection))
        const visibleNotifications = await Promise.all(snapshot.state.notifications
          .filter((notification) => !isLegacySeedHandle(notification.actorHandle))
          .map(async (notification) => {
            if (!notification.actorHandle) return notification
            const identity = await loadPublicAccountIdentityByHandle(notification.actorHandle).catch(() => null)
            if (!identity?.isDeactivated) return notification
            return {
              ...notification,
              actorName: identity.name,
              actorAvatarUrl: '',
            }
          }))
        if (cancelled) return
        const greetingId = birthdayNotificationId(snapshot.profile.birthday || '')
        const notificationsWithBirthday = greetingId && !visibleNotifications.some(({ id }) => id === greetingId)
          ? [{
              id: greetingId,
              type: 'birthday' as const,
              read: false,
              createdAt: new Date().toISOString(),
            }, ...visibleNotifications]
          : visibleNotifications
        const pendingSavedChanges = loadPendingSavedEntryChanges(cloudUserId)
        const recoveredSavedEntryIds = applyPendingSavedEntryChanges(
          removeLegacySeedEntryIds(snapshot.state.savedEntryIds),
          pendingSavedChanges,
        )
        const cleanState = {
          ...snapshot.state,
          likedEntryIds: removeLegacySeedEntryIds(snapshot.state.likedEntryIds),
          savedEntryIds: recoveredSavedEntryIds,
          disabledCommentEntryIds: removeLegacySeedEntryIds(
            pendingEntrySync?.disabledCommentEntryIds || snapshot.state.disabledCommentEntryIds,
          ),
          followedUserHandles: removeLegacySeedHandles(snapshot.state.followedUserHandles),
          followRequestedHandles: removeLegacySeedHandles(snapshot.state.followRequestedHandles),
          notifications: notificationsWithBirthday,
        }

        Object.entries(pendingSavedChanges).forEach(([entryId, saved]) => {
          void queueCloudSavedEntryChange(cloudUserId, entryId, saved)
        })

        saveProfileCollections(snapshot.profile.handle, cleanCreatedCollections)
        saveSavedProfileCollections(snapshot.profile.handle, cleanSavedCollections)
        setUserProfile(snapshot.profile)
        entriesRef.current = cleanEntries
        setEntries(cleanEntries)
        setPublicFeedEntries(loadedPublicEntries)
        setLikedEntryIds(cleanState.likedEntryIds)
        setSavedEntryIds(cleanState.savedEntryIds)
        setDisabledCommentEntryIds(cleanState.disabledCommentEntryIds)
        setFollowedUserHandles(cleanState.followedUserHandles)
        setFollowRequestedHandles(cleanState.followRequestedHandles)
        setNotifications(cleanState.notifications)

        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(snapshot.profile))
        localStorage.removeItem(PENDING_SIGNUP_PROFILE_KEY)
        saveEntriesToStorage(cleanEntries, cloudUserId)
        localStorage.setItem('the-commonplace.likes', JSON.stringify(cleanState.likedEntryIds))
        localStorage.setItem('the-commonplace.saves', JSON.stringify(cleanState.savedEntryIds))
        localStorage.setItem('the-commonplace.disabled-comments', JSON.stringify(cleanState.disabledCommentEntryIds))
        localStorage.setItem('the-commonplace.following-users', JSON.stringify(cleanState.followedUserHandles))
        localStorage.setItem('the-commonplace.follow-requests', JSON.stringify(cleanState.followRequestedHandles))
        localStorage.setItem('the-commonplace.notifications', JSON.stringify(cleanState.notifications))

        const entriesNeedSync = Boolean(pendingEntrySync)
          || !entrySnapshotsMatch(cleanEntries, snapshot.entries)
        if (entriesNeedSync) {
          const pending = pendingEntrySync || markEntriesPendingSync(cloudUserId, cleanState.disabledCommentEntryIds)
          void saveUserEntries(cloudUserId, cleanEntries, cleanState.disabledCommentEntryIds)
            .then(() => {
              const completedLatestSync = clearPendingEntrySync(cloudUserId, pending.token)
              if (completedLatestSync && pending.pendingPostIds.length > 0) {
                setAppFeedback({ kind: 'success', message: 'Posted successfully.' })
              }
            })
            .catch((error) => console.error('Unable to recover local posts in Firebase; they will retry next time.', error))
        }

        const cleanupNeeded = resetLegacyAccount
          || cleanCreatedCollections.length !== createdCollections.length
          || cleanSavedCollections.length !== savedCollections.length
          || JSON.stringify(cleanState) !== JSON.stringify(snapshot.state)
        if (cleanupNeeded) {
          const cloudStateCleanup = { ...cleanState }
          if (Object.keys(pendingSavedChanges).length > 0) {
            Reflect.deleteProperty(cloudStateCleanup, 'savedEntryIds')
          }
          void Promise.all([
            saveUserCloudState(cloudUserId, cloudStateCleanup),
            saveUserCollections(cloudUserId, 'created', cleanCreatedCollections),
            saveUserCollections(cloudUserId, 'saved', cleanSavedCollections),
          ]).catch((error) => console.error('Unable to remove legacy demo data from Firebase.', error))
        }
      })
      .catch((error) => {
        console.error('Unable to hydrate Firebase data; continuing with local data.', error)
        cloudHydratedUserRef.current = null
      })
      .finally(() => {
        if (!cancelled) setHomeDataStatus('ready')
      })

    return () => {
      cancelled = true
      if (cloudHydratedUserRef.current === cloudUserId) {
        cloudHydratedUserRef.current = null
      }
    }
  }, [authLoading, authProfile, cloudUserId])

  const persistCloudState = (patch: Parameters<typeof saveUserCloudState>[1]) => {
    if (!cloudUserId) return
    void submitOfflineAction({
      type: 'cloud-state',
      userId: cloudUserId,
      patch,
      dedupeKey: `cloud-state:${Object.keys(patch).sort().join(',')}`,
    }).catch((error) => {
      console.error('Unable to sync account state to Firebase.', error)
    })
  }

  const markAllNotificationsRead = () => {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }))
      localStorage.setItem('the-commonplace.notifications', JSON.stringify(next))
      persistCloudState({ notifications: next })
      if (cloudUserId) {
        const cloudIds = prev.filter((notification) => notification.type !== 'birthday').map(({ id }) => id)
        void submitOfflineAction({
          type: 'notifications-read',
          userId: cloudUserId,
          notificationIds: cloudIds,
          dedupeKey: `notifications-read:${cloudIds.sort().join(',')}`,
        })
          .catch((error) => console.error('Unable to mark cloud notifications as read.', error))
      }
      return next
    })
  }

  const dismissNotification = (ids: string | string[]) => {
    const notificationIds = Array.isArray(ids) ? ids : [ids]
    setNotifications((prev) => {
      const idSet = new Set(notificationIds)
      const next = prev.filter((notification) => !idSet.has(notification.id))
      localStorage.setItem('the-commonplace.notifications', JSON.stringify(next))
      persistCloudState({ notifications: next })
      const cloudIds = prev
        .filter((notification) => idSet.has(notification.id) && notification.type !== 'birthday')
        .map(({ id }) => id)
      if (cloudUserId && cloudIds.length > 0) {
        void submitOfflineAction({
          type: 'notifications-delete',
          userId: cloudUserId,
          notificationIds: cloudIds,
          dedupeKey: `notifications-delete:${cloudIds.sort().join(',')}`,
        })
          .catch((error) => console.error('Unable to dismiss cloud notification.', error))
      }
      return next
    })
  }

  const clearAllNotifications = () => {
    const cloudIds = notifications
      .filter((notification) => notification.type !== 'birthday')
      .map(({ id }) => id)
    setNotifications([])
    localStorage.removeItem('the-commonplace.notifications')
    persistCloudState({ notifications: [] })
    if (cloudUserId) {
      void submitOfflineAction({
        type: 'notifications-delete',
        userId: cloudUserId,
        notificationIds: cloudIds,
        dedupeKey: `notifications-delete:${cloudIds.sort().join(',')}`,
      })
        .catch((error) => console.error('Unable to clear cloud notifications.', error))
    }
  }

  const ownProfileEntries = useMemo(() => entries.map((e) => ({
      ...e,
      ownerId: cloudUserId || e.ownerId,
      authorHandle: userProfile.handle,
      authorName: userProfileName,
      authorAvatarUrl: userProfile.avatarUrl,
    })), [cloudUserId, entries, userProfile.handle, userProfile.avatarUrl, userProfileName])

  const allHomepageEntries = useMemo(() => {
    if (!personalizedFeed.enabled) {
      return [...ownProfileEntries, ...publicFeedEntries]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
    const ownEntriesById = new Map(ownProfileEntries.map((entry) => [entry.id, entry]))
    const currentRemoteEntries = personalizedFeed.items
      .filter((entry) => entry.ownerId !== cloudUserId || ownEntriesById.has(entry.id))
      .map((entry) => entry.ownerId === cloudUserId
        ? { ...entry, ...ownEntriesById.get(entry.id), visibility: entry.visibility }
        : entry)
    const remoteIds = new Set(currentRemoteEntries.map((entry) => entry.id))
    const missingOwnEntries = ownProfileEntries.filter((entry) => (
      !remoteIds.has(entry.id) && (typeFilter === 'all' || entry.type === typeFilter)
    ))

    // Masonry assigns columns from array order, so newest-first guarantees that
    // every newly created card occupies the leftmost slot before older cards.
    return [...currentRemoteEntries, ...missingOwnEntries]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  }, [cloudUserId, ownProfileEntries, personalizedFeed.enabled, personalizedFeed.items, publicFeedEntries, typeFilter])

  useEffect(() => {
    if (activeView !== 'reading' || !selectedReadingEntryId) return
    if (overlayEntry?.id === selectedReadingEntryId) {
      setReadingEntryStatus('ready')
      return
    }

    const availableEntry = allHomepageEntries.find(({ id }) => id === selectedReadingEntryId)
      || cloudExternalProfile?.data.entries.find(({ id }) => id === selectedReadingEntryId)
    if (availableEntry) {
      setOverlayEntry(availableEntry)
      setReadingEntryStatus('ready')
      return
    }

    let cancelled = false
    setReadingEntryStatus('loading')
    void loadPostEntry(selectedReadingEntryId)
      .then((entry) => {
        if (cancelled) return
        setOverlayEntry(entry)
        setReadingEntryStatus(entry ? 'ready' : 'not-found')
      })
      .catch((error) => {
        if (cancelled) return
        console.error('Unable to load this reading page.', error)
        setReadingEntryStatus('not-found')
      })

    return () => {
      cancelled = true
    }
  }, [activeView, allHomepageEntries, cloudExternalProfile, overlayEntry?.id, selectedReadingEntryId])

  const handleOpenEntryCreator = (entry: Entry, creatorName: string) => {
    const creatorEntity = createCreatorEntityFromEntry(entry, creatorName, allHomepageEntries)
    if (creatorEntity) openCachedEntity(creatorEntity)
  }

  const handleOpenEntryAlbum = (entry: Entry) => {
    const albumEntity = createAlbumEntityFromSongEntry(entry)
    if (albumEntity) openCachedEntity(albumEntity)
  }

  const homepagePostIds = useMemo(
    () => allHomepageEntries.map((entry) => entry.id).sort().join('|'),
    [allHomepageEntries],
  )

  useEffect(() => subscribePostEngagements(
    homepagePostIds ? homepagePostIds.split('|') : [],
    cloudUserId,
    setPostEngagements,
  ), [cloudUserId, homepagePostIds])

  const handleOpenNotification = (notification: AppNotification) => {
    if (notification.type === 'follow' && notification.actorHandle) {
      notificationOpenRequestRef.current = notification.id
      setOverlayEntry(null)
      setOverlayNotificationFocus(null)
      handleOpenUserProfile(notification.actorHandle)
      return
    }

    const postId = notification.postId
    if (!postId) return

    const commentId = notification.type === 'reply'
      ? notification.parentInteractionId
      : notification.type === 'comment'
        ? notification.interactionId
        : undefined
    const replyId = notification.type === 'reply' ? notification.interactionId : undefined
    notificationOpenRequestRef.current = notification.id
    setOverlayNotificationFocus({
      postId,
      commentId,
      replyId,
      requestId: notification.id,
    })
    setSelectedEntityId(null)
    setSelectedEntityType(null)
    setSelectedProfileHandle(null)
    setSelectedReadingEntryId(postId)
    setActiveView('reading')
    navigate(`/entries/${routeSegment(postId)}`)

    const availableEntry = allHomepageEntries.find(({ id }) => id === postId)
      || cloudExternalProfile?.data.entries.find(({ id }) => id === postId)
    if (availableEntry) {
      setOverlayEntry(availableEntry)
      setReadingEntryStatus('ready')
      return
    }

    setOverlayEntry(null)
    setReadingEntryStatus('loading')
  }

  useEffect(() => {
    if (!cloudUserId || homeDataStatus !== 'ready') return
    return subscribeUserNotifications(cloudUserId, (remoteNotifications) => {
      setNotifications((previous) => {
        const localOnlyNotifications = previous.filter((notification) => notification.type === 'birthday')
        const next = [...localOnlyNotifications, ...remoteNotifications]
        localStorage.setItem('the-commonplace.notifications', JSON.stringify(next))
        return next
      })
    })
  }, [cloudUserId, homeDataStatus])

  const filteredEntries = useMemo(() => {
    if (typeFilter !== 'all') {
      return allHomepageEntries.filter((entry) => entry.type === typeFilter)
    }
    return allHomepageEntries
  }, [allHomepageEntries, typeFilter])
  const ownedEntryIds = useMemo(() => new Set(entries.map((entry) => entry.id)), [entries])
  const disabledCommentEntryIdSet = useMemo(
    () => new Set(disabledCommentEntryIds),
    [disabledCommentEntryIds],
  )
  const mutualFollowIdSet = useMemo(
    () => new Set(personalizedFeed.mutualFollowIds),
    [personalizedFeed.mutualFollowIds],
  )

  const masonryLayout = useMasonryLayout(
    gridRef,
    filteredEntries.length,
    expandedCardId,
    `${activeView}:${authLoading ? 'loading' : 'ready'}:${typeFilter}:${filteredEntries.map((entry) => entry.id).join('|')}`,
  )
  const positionedCardIdsRef = useRef(new Set<string>())
  const [isInitialRender, setIsInitialRender] = useState(true)
  const [isFilterSwitching, setIsFilterSwitching] = useState(false)
  const showHomeSkeleton = homeDataStatus === 'loading'
    || personalizedFeed.loading
    || isFilterSwitching
    || (filteredEntries.length > 0 && !masonryLayout)

  const handleTypeFilterChange = (nextFilter: EntryType | 'all') => {
    if (nextFilter === typeFilter) return
    setIsFilterSwitching(true)
    setTypeFilter(nextFilter)
  }

  const handleQueryChange = (val: string) => {
    setQuery(val)
  }

  const personalizedFeedEnabled = personalizedFeed.enabled
  const personalizedFeedHasMore = personalizedFeed.hasMore
  const loadMorePersonalizedFeed = personalizedFeed.loadMore

  useEffect(() => {
    const sentinel = feedSentinelRef.current
    if (!personalizedFeedEnabled || !sentinel || !personalizedFeedHasMore) return
    const observer = new IntersectionObserver((observations) => {
      if (observations[0]?.isIntersecting) loadMorePersonalizedFeed()
    }, { rootMargin: '600px 0px' })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMorePersonalizedFeed, personalizedFeedEnabled, personalizedFeedHasMore])

  useEffect(() => {
    positionedCardIdsRef.current = new Set(masonryLayout?.positions.keys() ?? [])
  }, [masonryLayout])

  useEffect(() => {
    if (filteredEntries.length === 0) {
      setIsInitialRender(false)
      setIsFilterSwitching(false)
      return
    }
    if (masonryLayout) {
      const timer = setTimeout(() => {
        setIsInitialRender(false)
        setIsFilterSwitching(false)
      }, 120)
      return () => clearTimeout(timer)
    }
  }, [filteredEntries.length, masonryLayout, typeFilter])

  const saveEntries = (
    nextEntries: Entry[],
    nextDisabledCommentEntryIds = disabledCommentEntryIds,
    publishedEntryId?: string,
  ) => {
    entriesRef.current = nextEntries
    entriesRevisionRef.current += 1
    setEntries(nextEntries)
    saveEntriesToStorage(nextEntries, cloudUserId)
    if (cloudUserId) {
      const nextEntryIds = new Set(nextEntries.map(({ id }) => id))
      const previousPendingPostIds = (loadPendingEntrySync(cloudUserId)?.pendingPostIds || [])
        .filter((id) => nextEntryIds.has(id))
      const pendingPostIds = publishedEntryId
        ? [...previousPendingPostIds, publishedEntryId]
        : previousPendingPostIds
      const pending = markEntriesPendingSync(cloudUserId, nextDisabledCommentEntryIds, pendingPostIds)
      if (!navigator.onLine) {
        if (publishedEntryId) {
          setAppFeedback({
            kind: 'offline',
            message: 'No internet connection. Your post will be published when the connection is restored.',
          })
        }
        return
      }
      if (publishedEntryId) {
        window.scrollTo({ top: 0, behavior: 'smooth' })
        setAppFeedback({ kind: 'success', message: 'Posted successfully.' })
      }
      void saveUserEntries(cloudUserId, nextEntries, nextDisabledCommentEntryIds)
        .then(() => {
          clearPendingEntrySync(cloudUserId, pending.token)
        })
        .catch((error) => {
          console.error('Unable to sync posts to Firebase; they will retry next time.', error)
          if (publishedEntryId) {
            setAppFeedback(isConnectionError(error)
              ? {
                  kind: 'offline',
                  message: 'No internet connection. Your post will be published when the connection is restored.',
                }
              : { kind: 'error', message: entrySyncErrorMessage(error) })
          }
        })
    } else if (publishedEntryId) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      setAppFeedback({ kind: 'success', message: 'Posted successfully.' })
    }
  }

  useEffect(() => {
    if (!cloudUserId) return
    const publishHeldPosts = () => {
      const pending = loadPendingEntrySync(cloudUserId)
      if (!pending) return
      void saveUserEntries(cloudUserId, entriesRef.current, pending.disabledCommentEntryIds)
        .then(() => {
          const completedLatestSync = clearPendingEntrySync(cloudUserId, pending.token)
          if (completedLatestSync && pending.pendingPostIds.length > 0) {
            window.scrollTo({ top: 0, behavior: 'smooth' })
            setAppFeedback({ kind: 'success', message: 'Posted successfully.' })
          }
        })
        .catch((error) => {
          console.error('Unable to publish held posts after reconnecting.', error)
          if (pending.pendingPostIds.length > 0 && !isConnectionError(error)) {
            setAppFeedback({ kind: 'error', message: entrySyncErrorMessage(error) })
          }
        })
    }
    window.addEventListener('online', publishHeldPosts)
    return () => window.removeEventListener('online', publishHeldPosts)
  }, [cloudUserId])

  const handleLogout = async () => {
    setLogoutError('')
    setProfileMenuOpen(false)
    setNotificationsOpen(false)
    setSearchOpen(false)
    setLogoutConfirmOpen(true)
  }

  const confirmLogout = async () => {
    try {
      setLogoutLoading(true)
      setLogoutError('')
      await logout()
      setLogoutConfirmOpen(false)
      setProfileMenuOpen(false)
      navigate('/login')
    } catch (error) {
      setLogoutError((error as Error)?.message?.replace(/^Firebase:\s*/, '') || 'Unable to sign out. Please try again.')
    } finally {
      setLogoutLoading(false)
    }
  }

  const renderNotificationsGroup = () => (
    <NotificationBell
      open={notificationsOpen}
      notifications={notifications}
      onMarkAllRead={markAllNotificationsRead}
      onClearAll={clearAllNotifications}
      onDismiss={dismissNotification}
      onOpenNotification={handleOpenNotification}
      onOpenChange={(open) => {
        setNotificationsOpen(open)
        if (open) {
          setProfileMenuOpen(false)
          setSearchOpen(false)
          setMobileMenuOpen(false)
        }
      }}
    />
  )

  const handleOpenUserFromSearch = (handle: string) => {
    const cleanHandle = handle.replace(/^@/, '')
    setSelectedProfileHandle(cleanHandle === userProfile.handle ? null : cleanHandle)
    setActiveView('profile')
    setSearchOpen(false)
    navigate(`/users/${routeSegment(cleanHandle)}`)
  }

  const renderSearchBox = () => (
    <HeaderSearch
      key={currentUser?.uid || 'guest-search'}
      open={searchOpen}
      query={query}
      mode={searchTab}
      mediaResults={mediaSearchResults}
      mediaLoading={headerMediaSearchLoading}
      resultLimit={searchLimit}
      onOpenChange={(open) => {
        setSearchOpen(open)
        if (open) {
          setNotificationsOpen(false)
          setProfileMenuOpen(false)
          setMobileMenuOpen(false)
        }
      }}
      onQueryChange={handleQueryChange}
      onModeChange={setSearchTab}
      onMediaFilterChange={setSearchMediaFilter}
      onLoadMore={() => setSearchLimit((current) => Math.min(current + SEARCH_RESULTS_PER_PAGE, SEARCH_MAX_RESULT_LIMIT))}
      onOpenEntity={handleOpenSearchEntity}
      onOpenUser={handleOpenUserFromSearch}
      storageScope={currentUser?.uid}
    />
  )

  const renderGlobalHeader = () => {
    const isHomeHeader = activeView === 'feed'

    return (
    <>
    <header className={`global-app-header ${isHomeHeader ? 'is-home-page' : 'is-inner-page'}`}>
      <div className="global-app-header-layout">
        <div className="global-header-navigation">
          <button
            type="button"
            className={`global-header-nav-btn ${isHomeHeader ? 'is-placeholder' : ''}`}
            onClick={handleHome}
            aria-label="Go home"
            aria-hidden={isHomeHeader}
            tabIndex={isHomeHeader ? -1 : undefined}
            disabled={isHomeHeader}
            title={isHomeHeader ? undefined : 'Home'}
          >
            <Home aria-hidden="true" />
          </button>
        </div>

        <button
          type="button"
          className="global-header-brand"
          onClick={handleHome}
          aria-label="The Commonplace home"
        >
          <span className="global-brand-ornament is-left" aria-hidden="true"><i /><b>✦</b></span>
          <span className="global-header-brand-copy">
            <span className="global-header-wordmark">The Commonplace.</span>
            <span className="global-header-beta-badge">Beta</span>
          </span>
          <span className="global-brand-ornament is-right" aria-hidden="true"><b>✦</b><i /></span>
        </button>

        <div className="global-header-actions">
          {renderSearchBox()}

          {renderNotificationsGroup()}

      <div className="profile-menu-wrapper" ref={profileMenuRef}>
        <button
          className="profile-avatar-btn"
          type="button"
          aria-label="User Profile & Settings"
          title="User Profile & Settings"
          onClick={() => {
            const next = !profileMenuOpen
            setProfileMenuOpen(next)
            if (next) {
              setNotificationsOpen(false)
              setSearchOpen(false)
              setMobileMenuOpen(false)
            }
          }}
        >
          {userProfile.avatarUrl ? (
            <img src={userProfile.avatarUrl} alt="Avatar" className="profile-avatar-img-sm" />
          ) : (
            <CircleUserRound aria-hidden="true" />
          )}
        </button>

        {profileMenuOpen && (
          <div className="profile-dropdown-menu">
            <button
              type="button"
              className="menu-identity-block"
              onClick={() => {
                handleOpenUserProfile(userProfile.handle)
                setProfileMenuOpen(false)
              }}
              aria-label={`View @${userProfile.handle.replace(/^@/, '')} profile`}
            >
              <span className="menu-identity-avatar">
                {userProfile.avatarUrl ? (
                  <img src={userProfile.avatarUrl} alt="Avatar" className="menu-identity-avatar-img" />
                ) : (
                  <User aria-hidden="true" />
                )}
              </span>
              <span className="menu-identity-info">
                {showUserProfileName && <span className="menu-user-name">{userProfileName}</span>}
                <span className="menu-user-handle">
                  @{userProfile.handle.replace(/^@/, '')}
                </span>
              </span>
            </button>
            <button type="button" className="menu-item" onClick={handleOpenActivity}>
              <Activity aria-hidden="true" />
              <span>Activity</span>
            </button>
            <button
              type="button"
              className="menu-item"
              onClick={handleOpenSettings}
            >
              <Settings aria-hidden="true" />
              <span>Settings</span>
            </button>
            <button type="button" className="menu-item" onClick={handleOpenHelp}>
              <CircleHelp aria-hidden="true" />
              <span>Help &amp; Support</span>
            </button>
            <button type="button" className="menu-item" onClick={handleLogout}>
              <LogOut aria-hidden="true" />
              <span>Log out</span>
            </button>
          </div>
        )}
          </div>
          <button
            type="button"
            className="mobile-menu-toggle"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
            onClick={() => {
              const next = !mobileMenuOpen
              setMobileMenuOpen(next)
              if (next) {
                setNotificationsOpen(false)
                setSearchOpen(false)
                setProfileMenuOpen(false)
              }
            }}
          >
            {mobileMenuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </div>
      <div className="app-feedback-region" aria-live="polite">
        <AnimatePresence>
          {appFeedback && (
            <motion.div
              className={`app-feedback-toast ${appFeedback.kind}`}
              role={appFeedback.kind === 'error' ? 'alert' : 'status'}
              initial={{ opacity: 0, y: -12, scale: 0.96 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
                transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
              }}
              exit={{
                opacity: 0,
                y: -12,
                scale: 0.96,
                transition: { duration: 0.22, ease: [0.32, 0, 0.67, 0] },
              }}
            >
              {appFeedback.kind === 'success' ? (
                <CircleCheck aria-hidden="true" />
              ) : appFeedback.kind === 'offline' ? (
                <WifiOff aria-hidden="true" />
              ) : (
                <TriangleAlert aria-hidden="true" />
              )}
              <span>{appFeedback.message}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
    <AnimatePresence>
      {mobileMenuOpen && (
        <>
          <motion.button
            type="button"
            className="mobile-menu-backdrop"
            aria-label="Close menu"
            onClick={() => setMobileMenuOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.nav
            ref={mobileMenuDialogRef}
            id="mobile-navigation"
            className="mobile-menu-drawer"
            role="navigation"
            aria-label="Mobile navigation"
            tabIndex={-1}
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 28 }}
          >
            <div className="mobile-menu-identity">
              {showUserProfileName ? (
                <>
                  <strong>{userProfileName}</strong>
                  <span>@{userProfile.handle.replace(/^@/, '')}</span>
                </>
              ) : (
                <strong>@{userProfile.handle.replace(/^@/, '')}</strong>
              )}
            </div>
            <button type="button" onClick={() => { setMobileMenuOpen(false); handleHome() }}><Home aria-hidden="true" /> Home</button>
            <button type="button" onClick={() => { setMobileMenuOpen(false); handleOpenUserProfile(userProfile.handle) }}><CircleUserRound aria-hidden="true" /> Profile</button>
            <button type="button" onClick={() => { setMobileMenuOpen(false); handleOpenActivity() }}><Activity aria-hidden="true" /> Activity</button>
            <button type="button" onClick={() => { setMobileMenuOpen(false); handleOpenSettings() }}><Settings aria-hidden="true" /> Settings</button>
            <button type="button" onClick={() => { setMobileMenuOpen(false); handleOpenHelp() }}><CircleHelp aria-hidden="true" /> Help &amp; Support</button>
            <button type="button" className="danger" onClick={() => { setMobileMenuOpen(false); void handleLogout() }}><LogOut aria-hidden="true" /> Log out</button>
          </motion.nav>
        </>
      )}
    </AnimatePresence>
    {(activeView === 'feed' || activeView === 'profile')
      && !currentUser?.emailVerified
      && !verificationBannerDismissed && (
      <div className="email-verification-banner" role="status">
        <div className="email-verification-banner-message">
          <MailCheck aria-hidden="true" />
          <span className="email-verification-banner-copy">
            <span>Email hasn&apos;t been verified. Confirm your address to unlock posting and protect your account.</span>
            {bannerEmailNotice && <span className="email-verification-banner-notice">{bannerEmailNotice}</span>}
          </span>
        </div>
        <button
          type="button"
          className="email-verification-banner-action"
          onClick={handleBannerVerifyNow}
          disabled={verificationEmailCooldownSeconds > 0 || bannerSendingEmail}
        >
          {bannerSendingEmail
            ? 'Sending...'
            : verificationEmailCooldownSeconds > 0
              ? `Resend in ${verificationCooldownLabel}`
              : verificationEmailSent
                ? 'Resend email'
                : 'Verify now'}
        </button>
        <button
          type="button"
          className="email-verification-banner-close"
          onClick={() => setVerificationBannerDismissed(true)}
          aria-label="Dismiss email verification reminder"
        >
          <X aria-hidden="true" />
        </button>
      </div>
    )}
    <LogoutConfirmModal
      open={logoutConfirmOpen}
      loading={logoutLoading}
      error={logoutError}
      onCancel={() => {
        setLogoutConfirmOpen(false)
        setLogoutError('')
      }}
      onConfirm={confirmLogout}
    />
    </>
    )
  }

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openComposer = (
    entry: Entry | null = null,
    initialDraft: EntryDraft | null = null,
    initialLyrics = '',
    draftId: string | null = null,
  ) => {
    void loadEntryComposerModule()
    if (cloudUserId && homeDataStatus !== 'ready') return
    if (!currentUser?.emailVerified) {
      setVerificationPromptOpen(true)
      return
    }
    setEditingEntry(entry)
    setProfileMenuOpen(false)
    setNotificationsOpen(false)
    setSearchOpen(false)
    setComposerInitialDraft(entry ? null : initialDraft)
    setComposerInitialLyrics(entry ? '' : initialLyrics)
    setActiveComposerDraftId(entry ? null : draftId)
    setComposerOpen(true)
  }

  const closeComposer = () => {
    setComposerOpen(false)
    setEditingEntry(null)
    setComposerInitialDraft(null)
    setComposerInitialLyrics('')
    setActiveComposerDraftId(null)
  }

  const handleSaveEntryDraft = (draft: EntryDraft, lyrics: string, metadataQuery: string, draftId: string | null) => {
    const next = saveEntryDraft(draftStorageOwnerId, draft, lyrics, metadataQuery, draftId)
    setSavedEntryDrafts(next)
    setAppFeedback({ kind: 'success', message: draftId ? 'Draft updated.' : 'Saved to drafts.' })
    closeComposer()
  }

  const handleDeleteEntryDraft = (draftId: string) => {
    setSavedEntryDrafts(deleteEntryDraft(draftStorageOwnerId, draftId))
    setAppFeedback({ kind: 'success', message: 'Draft deleted.' })
  }

  const handleQuickAddEntityEntry = ({
    entity,
    favoritePassage,
    lyrics,
    artworkUrl,
    metadataChips,
  }: {
    entity: UniversalMediaEntity
    favoritePassage: string
    lyrics: string
    artworkUrl: string
    metadataChips: Array<{ label: string; value: string }>
  }) => {
    const getChip = (pattern: RegExp) =>
      metadataChips.find((chip) => pattern.test(chip.label))?.value || ''
    const artist = getChip(/artist|creator/i)
    const album = getChip(/album/i)
    const year = getChip(/year|release/i)

    openComposer(
      null,
      {
        ...emptyDraft,
        type: entity.type === 'song' ? 'song' : 'album',
        title: entity.name,
        creator: artist,
        provider: album || entity.categoryLabel,
        providerId: entity.providerId || entity.id,
        year,
        coverUrl: artworkUrl,
        summary: entity.description,
        explicit: entity.explicit || metadataChips.some((chip) =>
          chip.label.toLowerCase() === 'explicit' && chip.value.toLowerCase() === 'yes',
        ),
        favoritePassage,
        coverTone: getDefaultCoverTone(entity.type === 'song' ? 'song' : 'album'),
        authorHandle: userProfile.handle,
        authorName: userProfileName,
        authorAvatarUrl: userProfile.avatarUrl,
      },
      lyrics,
    )
  }

  const handleSave = (draft: EntryDraft) => {
    if (cloudUserId && homeDataStatus !== 'ready') return
    if (!currentUser?.emailVerified) {
      closeComposer()
      setVerificationPromptOpen(true)
      return
    }
    const timestamp = new Date().toISOString()

    if (editingEntry) {
      const updatedEntry: Entry = { ...editingEntry, ...draft, updatedAt: timestamp }
      const nextEntries = entries.map((entry) =>
        entry.id === editingEntry.id
          ? updatedEntry
          : entry,
      )
      saveEntries(nextEntries)
      setOverlayEntry((current) => current?.id === updatedEntry.id ? { ...current, ...updatedEntry } : current)
      setExpandedCardId(editingEntry.id)
      setAppFeedback({ kind: 'success', message: 'Entry changes saved.' })
    } else {
      const newId = makeEntryId()
      const newEntry: Entry = {
        ...draft,
        id: newId,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      saveEntries([newEntry, ...entries], disabledCommentEntryIds, newEntry.id)
      sendFeedSignal('catalog', newEntry, true)
      setExpandedCardId('')
      if (activeComposerDraftId) {
        setSavedEntryDrafts(deleteEntryDraft(draftStorageOwnerId, activeComposerDraftId))
      }
    }

    closeComposer()
  }

  const [deletingEntry, setDeletingEntry] = useState<Entry | null>(null)
  const deleteDialogRef = useAccessibleDialog<HTMLDivElement>({
    open: Boolean(deletingEntry),
    onClose: () => setDeletingEntry(null),
  })
  const verificationDialogRef = useAccessibleDialog<HTMLDivElement>({
    open: verificationPromptOpen,
    onClose: () => setVerificationPromptOpen(false),
  })

  const promptDeleteEntry = (entryId: string) => {
    const target = entries.find((e) => e.id === entryId)
    if (target) {
      setDeletingEntry(target)
    }
  }

  const deleteEntry = (entryId: string) => {
    const removedEntry = entries.find((entry) => entry.id === entryId)
    const nextEntries = entries.filter((entry) => entry.id !== entryId)
    saveEntries(nextEntries)
    if (removedEntry) sendFeedSignal('catalog', removedEntry, false)
    if (expandedCardId === entryId) setExpandedCardId('')
    setAppFeedback({ kind: 'success', message: 'Entry deleted.' })
  }

  const renderEmailVerificationPrompt = () => (
    <AnimatePresence>
      {verificationPromptOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setVerificationPromptOpen(false)}
        >
          <motion.div
            ref={verificationDialogRef}
            className="settings-modal"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="email-verification-title"
            tabIndex={-1}
          >
            <div className="settings-header">
              <div className="settings-header-title">
                <MailCheck aria-hidden="true" />
                <h2 id="email-verification-title">Verify your email first</h2>
              </div>
            </div>
            <p style={{ color: 'var(--secondary)', lineHeight: 1.6, marginBottom: 12 }}>
              You haven&apos;t confirmed your email yet. To publish entries and access all posting features,
              verify <strong>{currentUser?.email || 'your email address'}</strong> first.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="primary-btn"
                onClick={() => setVerificationPromptOpen(false)}
              >
                Okay
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )

  // Render Standalone Pages
  if (location.pathname === '/verify-email' || location.pathname.startsWith('/v/')) {
    return <EmailVerificationPage />
  }

  if (location.pathname.startsWith('/reset-password/')) {
    return <ResetPasswordPage />
  }

  if (authLoading || (currentUser && (location.pathname === '/login' || location.pathname === '/register'))) {
    return <PageLoadingSkeleton />
  }

  if (!currentUser) {
    if (activeView === 'not-found') {
      return <NotFoundPage onHome={() => navigate('/login')} onBack={() => navigate(-1)} />
    }
    return location.pathname === '/register'
      ? <RegisterPage onSwitchToLogin={() => navigate('/login')} />
      : <LoginPage onSwitchToRegister={() => navigate('/register')} />
  }

  if (activeView === 'not-found') {
    return (
      <>
        {renderGlobalHeader()}
        <NotFoundPage onHome={handleHome} onBack={handlePageBack} />
      </>
    )
  }

  if (activeView === 'reading') {
    if (readingEntryStatus === 'not-found') {
      return (
        <>
          {renderGlobalHeader()}
          <NotFoundPage onHome={handleHome} onBack={handlePageBack} />
        </>
      )
    }

    return (
      <>
        {renderGlobalHeader()}
        {overlayEntry ? (
          <EntryReadingPage
            entry={overlayEntry}
            onClose={closeEntryOverlay}
            focusCommentId={overlayNotificationFocus?.postId === overlayEntry.id ? overlayNotificationFocus?.commentId : undefined}
            focusReplyId={overlayNotificationFocus?.postId === overlayEntry.id ? overlayNotificationFocus?.replyId : undefined}
            focusRequestId={overlayNotificationFocus?.postId === overlayEntry.id ? overlayNotificationFocus?.requestId : undefined}
            isLiked={postEngagements[overlayEntry.id]?.isLiked ?? likedEntryIds.includes(overlayEntry.id)}
            isSaved={savedEntryIds.includes(overlayEntry.id)}
            likeCount={postEngagements[overlayEntry.id]?.likeCount || 0}
            onToggleLike={() => toggleLikeEntry(overlayEntry.id)}
            onToggleSave={() => toggleSaveEntry(overlayEntry.id)}
            onEdit={(
              (cloudUserId && overlayEntry.ownerId === cloudUserId)
              || entries.some((entry) => entry.id === overlayEntry.id)
            ) ? () => openComposer(overlayEntry) : undefined}
            onOpenProfile={(handle) => {
              setOverlayEntry(null)
              handleOpenUserProfile(handle)
            }}
            currentUserHandle={userProfile.handle}
          />
        ) : (
          <main className="reading-page-root reading-page-loading" aria-label="Loading reading page">
            <div className="reading-page-shell" aria-hidden="true">
              <span className="skeleton-box reading-page-back-skeleton" />
              <div className="reading-page-card-skeleton">
                <span className="skeleton-box reading-page-cover-skeleton" />
                <div className="reading-page-copy-skeleton">
                  <span className="skeleton-box is-title" />
                  <span className="skeleton-box is-meta" />
                  <span className="skeleton-box is-line" />
                  <span className="skeleton-box is-line" />
                  <span className="skeleton-box is-line is-short" />
                </div>
              </div>
            </div>
          </main>
        )}
        <Suspense fallback={<ComposerLoadingFallback />}>
          <AnimatePresence>
            {composerOpen ? (
              <EntryComposer
              key={editingEntry?.id || activeComposerDraftId || 'new-entry'}
              entry={editingEntry}
              initialDraft={composerInitialDraft}
              initialLyrics={composerInitialLyrics}
              onClose={closeComposer}
              onSave={handleSave}
              communityEntries={allHomepageEntries}
              savedDrafts={savedEntryDrafts}
              activeDraftId={activeComposerDraftId}
              onSaveDraft={handleSaveEntryDraft}
              onSelectDraft={setActiveComposerDraftId}
              onDeleteDraft={handleDeleteEntryDraft}
              isOnline={isOnline}
              />
            ) : null}
          </AnimatePresence>
        </Suspense>
        {renderEmailVerificationPrompt()}
      </>
    )
  }

  if (activeView === 'profile') {
    const isViewingOwn = selectedProfileHandle === null || selectedProfileHandle === userProfile.handle
    const externalProfileData = isViewingOwn
      ? undefined
      : cloudExternalProfile?.handle === selectedProfileHandle
        ? cloudExternalProfile.data
        : undefined
    const currentProfileData = isViewingOwn
      ? { profile: userProfile, entries: ownProfileEntries }
      : externalProfileData || emptyPublicProfile(selectedProfileHandle || '')
    const externalSavedIsVisible = externalProfileData?.profile.showSavedActivity === true
    const catalogSavedEntryIds = isViewingOwn
      ? savedEntryIds
      : externalSavedIsVisible ? externalProfileData?.savedEntryIds ?? [] : []
    const publicSavedCollections = externalSavedIsVisible ? externalProfileData?.savedCollections ?? [] : []

    return (
      <>
        {renderGlobalHeader()}
        <UserProfilePage
          key={currentProfileData.profile.handle}
          onBack={handlePageBack}
          showLocalNavigation={false}
          entries={currentProfileData.entries}
          popularDemandEntries={allHomepageEntries}
          savedCatalogEntries={allHomepageEntries}
          savedEntryIds={savedEntryIds}
          catalogSavedEntryIds={catalogSavedEntryIds}
          publicCollections={externalProfileData?.collections}
          publicSavedCollections={publicSavedCollections}
          likedEntryIds={likedEntryIds}
          postEngagements={postEngagements}
          disabledCommentEntryIds={disabledCommentEntryIds}
          onSelectEntry={openEntryOverlay}
          onOpenMediaProfile={handleOpenCollectionMedia}
          onOpenEntryCreator={handleOpenEntryCreator}
          onOpenEntryAlbum={handleOpenEntryAlbum}
          onToggleLike={toggleLikeEntry}
          onToggleSave={toggleSaveEntry}
          onToggleCommentsDisabled={toggleCommentsDisabled}
          userProfile={currentProfileData.profile}
          onUpdateProfile={isViewingOwn ? persistUserProfile : undefined}
          onDeleteEntry={(id) => promptDeleteEntry(id)}
          onEditEntry={(entry) => openComposer(entry)}
          onAddEntry={() => openComposer()}
          addEntryDisabled={Boolean(cloudUserId && homeDataStatus !== 'ready')}
          categoryFilter={profileCategoryFilter}
          onCategoryFilterChange={setProfileCategoryFilter}
          isOwnProfile={isViewingOwn}
          onSelectUserProfile={handleOpenUserProfile}
          followedUserHandles={followedUserHandles}
          onToggleFollowUser={toggleFollowUser}
          currentUserProfile={userProfile}
          cloudUserId={cloudUserId}
          followRequestedHandles={followRequestedHandles}
          onToggleFollowRequest={toggleFollowRequest}
          initialCollectionId={selectedProfileCollectionId}
          onOpenCollectionPage={(collectionId) => {
            setSelectedProfileCollectionId(collectionId)
            navigate(`/users/${routeSegment(currentProfileData.profile.handle)}/collections/${routeSegment(collectionId)}`)
          }}
          onCloseCollectionPage={() => {
            setSelectedProfileCollectionId(null)
            navigate(`/users/${routeSegment(currentProfileData.profile.handle)}`)
          }}
          privateContentLocked={!isViewingOwn && externalProfileData?.isContentLocked === true}
        />
        <AnimatePresence>
          {deletingEntry && (
            <div className="modal-backdrop" onClick={() => setDeletingEntry(null)}>
              <motion.div
                ref={deleteDialogRef}
                className="settings-modal"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="delete-entry-title"
                tabIndex={-1}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="settings-header">
                  <div className="settings-header-title">
                    <Trash2 style={{ color: '#e57373' }} aria-hidden="true" />
                    <h2 id="delete-entry-title">Delete Entry?</h2>
                  </div>
                </div>
                <p style={{ color: 'var(--secondary)', lineHeight: 1.6, marginBottom: 20 }}>
                  Are you sure you want to delete <strong>"{deletingEntry.title}"</strong>? This action cannot be undone.
                </p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button type="button" className="ghost-btn" onClick={() => setDeletingEntry(null)}>Cancel</button>
                  <button
                    type="button"
                    className="action-btn danger"
                    onClick={() => { if (deletingEntry) { deleteEntry(deletingEntry.id); setDeletingEntry(null) } }}
                  >
                    Delete Entry
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        <Suspense fallback={<ComposerLoadingFallback />}>
          <AnimatePresence>
            {composerOpen ? (
              <EntryComposer
              key={editingEntry?.id || activeComposerDraftId || 'new-entry'}
              entry={editingEntry}
              initialDraft={composerInitialDraft}
              initialLyrics={composerInitialLyrics}
              onClose={closeComposer}
              onSave={handleSave}
              communityEntries={allHomepageEntries}
              savedDrafts={savedEntryDrafts}
              activeDraftId={activeComposerDraftId}
              onSaveDraft={handleSaveEntryDraft}
              onSelectDraft={setActiveComposerDraftId}
              onDeleteDraft={handleDeleteEntryDraft}
              isOnline={isOnline}
              />
            ) : null}
          </AnimatePresence>
        </Suspense>
        {renderEmailVerificationPrompt()}
      </>
    )
  }

  if (activeView === 'entity' && selectedEntityId) {
    let universalEntity: UniversalMediaEntity | null =
      UNIVERSAL_MEDIA_ENTITIES[selectedEntityId] ||
      searchEntityCacheRef.current.get(selectedEntityId) ||
      persistedEntityCache[selectedEntityId] ||
      (MOCK_ENTITY_PROFILES[selectedEntityId]
        ? MOCK_ENTITY_PROFILES[selectedEntityId].universalEntity || {
            id: MOCK_ENTITY_PROFILES[selectedEntityId].id,
            name: MOCK_ENTITY_PROFILES[selectedEntityId].title,
            type: MOCK_ENTITY_PROFILES[selectedEntityId].type,
            categoryLabel: MOCK_ENTITY_PROFILES[selectedEntityId].type.toUpperCase(),
            artworkUrl: MOCK_ENTITY_PROFILES[selectedEntityId].coverUrl,
            description: MOCK_ENTITY_PROFILES[selectedEntityId].bio,
            metadataChips: [
              {
                label: MOCK_ENTITY_PROFILES[selectedEntityId].creatorLabel,
                value: MOCK_ENTITY_PROFILES[selectedEntityId].creatorValue,
              },
            ],
            communityRating: {
              average: 0,
              count: 0,
              distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
            },
          }
        : null)

    if (!universalEntity) {
      const mapItem = albumEntityMap.get(selectedEntityId) || albumEntityMap.get(selectedEntityId.toLowerCase())
      const igdbGameMatch = selectedEntityId.match(/^igdb:game:(.+)$/i)
      const steamGameMatch = selectedEntityId.match(/^steam:game:(.+)$/i)
      const trackIdMatch = selectedEntityId.match(/^song-(?:itunes-)?(\d+)$/i)
      const legacyItunesTrackIdMatch = selectedEntityId.match(/^itunes:song:(\d+)$/i)
      const albumIdMatch = selectedEntityId.match(/^album-(\d+)$/i)
      const legacyItunesAlbumIdMatch = selectedEntityId.match(/^itunes:album:(\d+)$/i)

      const cleanName = mapItem
        ? mapItem.name
        : selectedEntityId
            .replace(/^igdb:game:/i, '')
            .replace(/^steam:game:/i, '')
            .replace(/^game-/i, '')
            .replace(/^album-\d+/i, '')
            .replace(/^album-/i, '')
            .replace(/^song-itunes-\d+/i, '')
            .replace(/^song-\d+/i, '')
            .replace(/^song-/i, '')
            .replace(/^itunes:song:\d+/i, '')
            .replace(/^itunes:album:\d+/i, '')
            .replace(/^human:/i, '')
            .replace(/^(?:artist|author|director|creator|actor|game-studio):/i, '')
            .replace(/-/g, ' ')
            .replace(/\b\w/g, (l) => l.toUpperCase())

      const fallbackType = legacyItunesTrackIdMatch
        ? 'song'
        : legacyItunesAlbumIdMatch
          ? 'album'
          : selectedEntityType || inferEntityTypeFromId(selectedEntityId)
      const isSong = fallbackType === 'song'
      const isAlbum = fallbackType === 'album'
      const isGame = fallbackType === 'game'
      const isHuman = ['artist', 'author', 'director', 'creator', 'actor'].includes(fallbackType)

      const providerId = trackIdMatch
        ? trackIdMatch[1]
        : legacyItunesTrackIdMatch
          ? legacyItunesTrackIdMatch[1]
        : albumIdMatch
          ? albumIdMatch[1]
          : legacyItunesAlbumIdMatch
            ? legacyItunesAlbumIdMatch[1]
          : igdbGameMatch
            ? igdbGameMatch[1]
            : steamGameMatch
              ? steamGameMatch[1]
              : undefined

      const gameMetadata = isGame
        ? {
            metadataSource: igdbGameMatch ? 'IGDB' : steamGameMatch ? 'Steam Store' : 'IGDB',
            metadataUpdatedAt: new Date().toISOString(),
          }
        : undefined

      universalEntity = {
        id: selectedEntityId,
        name: cleanName,
        type: fallbackType,
        categoryLabel: fallbackType === 'movie' ? 'Film' : fallbackType.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
        providerId,
        explicit: mapItem?.explicit,
        preferWikipediaArtwork: isGame && Boolean(steamGameMatch),
        gameMetadata,
        artworkUrl: resolveArtworkUrl(
          mapItem?.artworkUrl || '',
          cleanName,
          isSong ? 'Song' : isAlbum ? 'Album' : fallbackType,
        ),
        description: '',
        metadataChips: isHuman
          ? [{ label: 'Profession', value: fallbackType.charAt(0).toUpperCase() + fallbackType.slice(1) }]
          : [
              { label: isAlbum || isSong ? 'Artist' : isGame ? 'Studio' : 'Creator', value: mapItem?.artist || 'Unknown' },
              { label: 'Category', value: fallbackType === 'movie' ? 'Film' : fallbackType.replace('_', ' ') },
              ...(mapItem?.year ? [{ label: 'Release Year', value: mapItem.year }] : []),
              ...(mapItem?.explicit ? [{ label: 'Explicit', value: 'Yes' }] : []),
            ],
        communityRating: {
          average: 0,
          count: 0,
          distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        },
      }
    }

    if (universalEntity) {
      return (
        <>
          {renderGlobalHeader()}
          <UniversalMediaProfilePage
            key={universalEntity.id}
            entity={universalEntity}
            onBack={handlePageBack}
            onHome={handleHome}
            showLocalNavigation={false}
            communityEntries={allHomepageEntries}
            onSelectEntry={openEntryOverlay}
            onOpenUserProfile={handleOpenUserProfile}
            onNavigateToEntity={handleNavigateEntityBreadcrumb}
            onCanonicalMediaResolved={handleCanonicalMediaResolved}
            onQuickAddEntry={handleQuickAddEntityEntry}
            onAddToCollection={({ entity, artworkUrl, metadataChips }) => {
              const item = collectionItemFromEntity(entity, artworkUrl, metadataChips)
              if (item) setCollectionTarget(item)
            }}
            likedEntryIds={likedEntryIds}
            postEngagements={postEngagements}
            savedEntryIds={savedEntryIds}
            disabledCommentEntryIds={disabledCommentEntryIds}
            onToggleLike={toggleLikeEntry}
            onToggleSave={toggleSaveEntry}
          />
          <Suspense fallback={<ComposerLoadingFallback />}>
            <AnimatePresence>
              {composerOpen ? (
                <EntryComposer
                key={editingEntry?.id || activeComposerDraftId || 'new-entry'}
                entry={editingEntry}
                initialDraft={composerInitialDraft}
                initialLyrics={composerInitialLyrics}
                onClose={closeComposer}
                onSave={handleSave}
                communityEntries={allHomepageEntries}
                savedDrafts={savedEntryDrafts}
                activeDraftId={activeComposerDraftId}
                onSaveDraft={handleSaveEntryDraft}
                onSelectDraft={setActiveComposerDraftId}
                onDeleteDraft={handleDeleteEntryDraft}
                isOnline={isOnline}
                />
              ) : null}
            </AnimatePresence>
          </Suspense>
          <AnimatePresence>
            {collectionTarget && (
              <CollectionPickerModal
                handle={userProfile.handle}
                userId={cloudUserId}
                item={collectionTarget}
                onClose={() => setCollectionTarget(null)}
              />
            )}
          </AnimatePresence>
          {renderEmailVerificationPrompt()}
        </>
      )
    }
  }

  if (activeView === 'activity') {
    return (
      <>
        {renderGlobalHeader()}
        <ActivityPage
          entries={ownProfileEntries}
          availableEntries={allHomepageEntries}
          engagements={postEngagements}
          likedEntryIds={likedEntryIds}
          likedCount={likedEntryIds.length}
          savedCount={savedEntryIds.length}
          followingCount={followedUserHandles.length}
          currentUserId={cloudUserId || undefined}
          currentUserHandle={userProfile.handle}
          onOpenEntry={(entry, focus) => {
            openEntryOverlay(entry)
            if (focus?.commentId) {
              setOverlayNotificationFocus({
                postId: entry.id,
                commentId: focus.commentId,
                replyId: focus.replyId,
                requestId: `activity-${entry.id}-${focus.replyId || focus.commentId}`,
              })
            }
          }}
        />
        {renderEmailVerificationPrompt()}
      </>
    )
  }

  if (activeView === 'help') {
    return (
      <>
        {renderGlobalHeader()}
        <HelpSupportPage onOpenSettings={handleOpenSettings} />
        {renderEmailVerificationPrompt()}
      </>
    )
  }

  if (activeView === 'settings') {
    return (
      <>
        {renderGlobalHeader()}
        <SettingsPage
          onBack={handlePageBack}
          showLocalNavigation={false}
          userProfile={userProfile}
          onSaveProfile={persistUserProfile}
          onResetHomeRecommendations={async () => {
            if (!currentUser) return
            await resetFeedPreferences(currentUser)
            personalizedFeed.refresh()
          }}
        />
        {renderEmailVerificationPrompt()}
      </>
    )
  }

  return (
    <div className="app-shell">
      {renderGlobalHeader()}
      {/* Main content */}
      <main className="main-content">

          <div className="homepage-filter-shell">
          {/* Type filter tabs with animated pill */}
          <div className="filter-row">
            <nav className="type-tabs" aria-label="Filter by type">
              {/* Always render the pill inside every tab button — visibility is toggled via opacity
                  so Framer Motion's layoutId can animate it correctly without a double-render glitch */}
              <button
                className={`tab ${typeFilter === 'all' ? 'active' : ''}`}
                type="button"
                onClick={() => handleTypeFilterChange('all')}
              >
                {typeFilter === 'all' && (
                  <motion.div
                    layoutId="activeFilterPill"
                    className="active-tab-pill"
                    transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
                  />
                )}
                <span>All</span>
              </button>
              {entryTypes.map(({ id, label, Icon }) => {
                const isActive = typeFilter === id
                return (
                  <button
                    key={id}
                    className={`tab ${isActive ? 'active' : ''}`}
                    type="button"
                    onClick={() => handleTypeFilterChange(id)}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeFilterPill"
                        className="active-tab-pill"
                        transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
                      />
                    )}
                    <Icon aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                )
              })}
            </nav>
          </div>
          </div>

        <div className="home-card-stage">
          {showHomeSkeleton ? (
            <CardSkeletonGrid count={8} />
          ) : null}

          {/* Card grid — JS absolute-position masonry, newest top-left */}
          <section
            className="card-grid"
            ref={gridRef as React.RefObject<HTMLElement>}
            style={{
              position: showHomeSkeleton ? 'absolute' : 'relative',
              inset: showHomeSkeleton ? 0 : undefined,
              height: masonryLayout ? masonryLayout.height : 'auto',
              minHeight: filteredEntries.length === 0 ? 320 : undefined,
              visibility: !showHomeSkeleton ? 'visible' : 'hidden',
              opacity: !showHomeSkeleton ? 1 : 0,
              transition: 'none',
              pointerEvents: showHomeSkeleton ? 'none' : undefined,
            }}
            aria-label="Saved entries"
            aria-busy={showHomeSkeleton}
            aria-hidden={showHomeSkeleton}
          >
          {filteredEntries.map((entry) => {
            const pos = masonryLayout?.positions.get(entry.id)
            const hadMeasuredPosition = positionedCardIdsRef.current.has(entry.id)
            const typeMeta = getTypeMeta(entry.type)
            const isOwnEntry = Boolean(cloudUserId && entry.ownerId === cloudUserId)
              || ownedEntryIds.has(entry.id)
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
                  transition: (isInitialRender || isFilterSwitching || !hadMeasuredPosition)
                    ? 'none'
                    : 'transform 280ms cubic-bezier(0.2, 0, 0, 1)',
                } : { width: '100%', marginBottom: 14 }}
              >
                <Card
                  entry={entry}
                  expanded={expandedCardId === entry.id}
                  onDelete={isOwnEntry ? () => promptDeleteEntry(entry.id) : undefined}
                  onEdit={isOwnEntry ? () => openComposer(entry) : undefined}
                  onToggle={() => toggleCardExpanded(entry.id)}
                  onExpandOverlay={() => openEntryOverlay(entry)}
                  onOpenProfile={() => handleOpenUserProfile(entry.authorHandle)}
                  onOpenMedia={() => handleOpenCollectionMedia(entry)}
                  onOpenCreator={entry.type === 'game' ? undefined : (creatorName) => handleOpenEntryCreator(entry, creatorName)}
                  onOpenAlbum={entry.type === 'song' ? () => handleOpenEntryAlbum(entry) : undefined}
                  typeIcon={typeMeta.Icon}
                  typeLabel={typeMeta.label}
                  isLiked={engagement?.isLiked ?? likedEntryIds.includes(entry.id)}
                  isSaved={savedEntryIds.includes(entry.id)}
                  likeCount={engagement?.likeCount || 0}
                  commentCount={engagement?.commentCount || 0}
                  onToggleLike={() => toggleLikeEntry(entry.id)}
                  onToggleSave={() => toggleSaveEntry(entry.id)}
                  commentsDisabled={disabledCommentEntryIdSet.has(entry.id)}
                  onToggleCommentsDisabled={isOwnEntry ? () => toggleCommentsDisabled(entry.id) : undefined}
                  isFriend={Boolean(entry.ownerId && mutualFollowIdSet.has(entry.ownerId))}
                />
              </div>
            )
          })}
          {homeDataStatus === 'ready' && filteredEntries.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">
                <BookOpen aria-hidden="true" />
              </div>
              {entries.length === 0 ? (
                <>
                  <h3 className="empty-state-title">Your commonplace is waiting.</h3>
                  <p className="empty-state-subtitle">
                    Catalog your favorite quotes, books, albums, films, songs, games, and personal reflections in one quiet place.
                  </p>
                  <button
                    className="primary-btn"
                    type="button"
                    onClick={() => openComposer()}
                  >
                    <Plus aria-hidden="true" />
                    <span>Add your first entry</span>
                  </button>
                </>
              ) : (
                <>
                  <h3 className="empty-state-title">No entries found.</h3>
                  <p className="empty-state-subtitle">
                    No items match your search query or selected filter tab.
                  </p>
                  <button
                    className="ghost-btn"
                    type="button"
                    onClick={() => {
                      setQuery('')
                      setTypeFilter('all')
                    }}
                  >
                    <span>Reset Filters</span>
                  </button>
                </>
              )}
            </div>
          )}
          </section>
        </div>

        {personalizedFeed.enabled && personalizedFeed.error && (
          <div className="feed-status" role="alert">
            <span>{personalizedFeed.error}</span>
            <button type="button" className="ghost-btn" onClick={personalizedFeed.retry}>Retry</button>
          </div>
        )}
        {personalizedFeed.enabled && personalizedFeed.hasMore && !personalizedFeed.error && (
          <div ref={feedSentinelRef} className="feed-sentinel" aria-hidden="true">
            {personalizedFeed.loadingMore && <span>Gathering more entries…</span>}
          </div>
        )}

        {/* Confirm Delete Card Modal */}
        <AnimatePresence>
          {deletingEntry && (
            <div className="modal-backdrop" onClick={() => setDeletingEntry(null)}>
              <motion.div
                ref={deleteDialogRef}
                className="settings-modal"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="delete-entry-title"
                tabIndex={-1}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="settings-header">
                  <div className="settings-header-title">
                    <Trash2 style={{ color: '#e57373' }} aria-hidden="true" />
                    <h2 id="delete-entry-title">Delete Entry?</h2>
                  </div>
                </div>
                <p style={{ color: 'var(--secondary)', lineHeight: 1.6, marginBottom: 20 }}>
                  Are you sure you want to delete <strong>"{deletingEntry.title}"</strong>? This action cannot be undone.
                </p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => setDeletingEntry(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="action-btn danger"
                    onClick={() => {
                      if (deletingEntry) {
                        deleteEntry(deletingEntry.id)
                        setDeletingEntry(null)
                      }
                    }}
                  >
                    Delete Entry
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </main>

      {/* Floating action buttons stack */}
      <div className="fab-stack">
        {showScrollToTop ? (
          <button
            className="fab fab-scroll-top"
            type="button"
            aria-label="Back to top"
            title="Back to top"
            onClick={scrollToTop}
          >
            <ChevronUp aria-hidden="true" />
          </button>
        ) : null}

        <button
          className="fab"
          type="button"
          aria-label="Add new entry"
          title="Add new entry"
          disabled={Boolean(cloudUserId && homeDataStatus !== 'ready')}
          onClick={() => openComposer()}
        >
          <Plus aria-hidden="true" />
        </button>
      </div>

      {/* Entry composer modal */}
      <Suspense fallback={<ComposerLoadingFallback />}>
        <AnimatePresence>
          {composerOpen ? (
            <EntryComposer
            key={editingEntry?.id || activeComposerDraftId || 'new-entry'}
            entry={editingEntry}
            initialDraft={composerInitialDraft}
            initialLyrics={composerInitialLyrics}
            onClose={closeComposer}
            onSave={handleSave}
            communityEntries={allHomepageEntries}
            savedDrafts={savedEntryDrafts}
            activeDraftId={activeComposerDraftId}
            onSaveDraft={handleSaveEntryDraft}
            onSelectDraft={setActiveComposerDraftId}
            onDeleteDraft={handleDeleteEntryDraft}
            isOnline={isOnline}
            />
          ) : null}
        </AnimatePresence>
      </Suspense>
      {renderEmailVerificationPrompt()}
    </div>
  )
}

