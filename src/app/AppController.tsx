/* eslint-disable react-hooks/set-state-in-effect, react-hooks/refs -- Route synchronization and the legacy entity cache intentionally bridge external browser state. */
import { AnimatePresence, motion } from 'framer-motion'
import {
  User,
  Trash2,
  BookOpen,
  ChevronUp,
  Plus,
  Settings,
  LogOut,
  CircleUserRound,
  Home,
  MailCheck,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import '../App.css'
import {
  type MetadataResult,
  searchMetadata,
  entityImageCacheMap,
  albumEntityMap,
  scoreGameTitleMatch,
} from '../metadata'
import { useCardExpansion } from '../context/ExpansionContext'
import { Card } from '../components/CommonplaceCard/Card'
import { CardOverlayModal } from '../components/CommonplaceCard/CardOverlayModal'
import { CardSkeletonGrid } from '../components/CommonplaceCard/CardSkeleton'
import { UserProfilePage } from '../pages/UserProfilePage'
import { SettingsPage } from '../pages/SettingsPage'
import { LoginPage } from '../pages/LoginPage'
import { RegisterPage } from '../pages/RegisterPage'
import { EmailVerificationPage } from '../pages/EmailVerificationPage'
import { useAuth } from '../context/AuthContext'
import { useMasonryLayout } from '../hooks/useMasonryLayout'
import { NotificationBell } from '../components/Notifications/NotificationPanel'
import { MOCK_ENTITY_PROFILES } from '../data/entityProfiles'
import { UniversalMediaProfilePage } from '../pages/UniversalMediaProfilePage'
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
import { MOCK_EXTERNAL_PROFILES } from '../data/externalProfiles'
import type { UserProfileState } from '../types/userProfile'
import type { MetadataChip } from '../types/mediaEntity'
import {
  loadProfileCollections,
  loadSavedProfileCollections,
  saveProfileCollections,
  saveSavedProfileCollections,
  type ProfileCollectionItem,
} from '../features/collections/profileCollections'
import type { AppNotification } from '../types/notification'
import { EntryComposer } from '../features/entries/composer/EntryComposer'
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
import {
  decodeRouteSegment,
  entityTypeByRouteSegment,
  getEntityRoutePath,
  inferEntityTypeFromId,
  metadataResultToUniversalEntity,
  routeSegment,
} from '../features/entities/routing'
import {
  emptyDraft,
  entryTypes,
  getDefaultCoverTone,
  getTypeMeta,
  loadEntries,
  makeEntryId,
  saveEntriesToStorage,
  type Entry,
  type EntryDraft,
  type EntryType,
} from '../features/entries/model'
import {
  canUseCloudData,
  loadPublicUserByHandle,
  loadOrMigrateUserCollections,
  loadOrMigrateUserData,
  saveFollowRequest,
  saveFollowRelationship,
  savePostCommenting,
  saveUserCloudState,
  saveUserEntries,
  saveUserProfile,
  uploadUserImage,
  type PublicUserData,
  type UserCloudSnapshot,
} from '../services/cloudData'

const SEARCH_INITIAL_RESULT_LIMIT = 6
const SEARCH_RESULTS_PER_PAGE = 6
const SEARCH_MAX_RESULT_LIMIT = 40
const PROFILE_STORAGE_KEY = 'the-commonplace.user-profile.v1'

const DEFAULT_USER_PROFILE: UserProfileState = {
  firstName: 'Jimmy',
  lastName: 'Boy',
  showFullName: true,
  handle: 'jimboii',
  email: 'jimboii@commonplace.app',
  bio: 'Collector of timeless passages, album impressions, cinematic notes, and personal reflections in one quiet place.',
  avatarUrl: '',
  coverUrl: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?q=80&w=1200&auto=format&fit=crop',
  lastUsernameChangeDate: '2026-07-01T00:00:00.000Z',
  showFollowLists: true,
  allowComments: true,
  showSavedActivity: false,
}

function loadLocalUserProfile() {
  try {
    const stored = localStorage.getItem(PROFILE_STORAGE_KEY)
    return stored ? { ...DEFAULT_USER_PROFILE, ...JSON.parse(stored) } as UserProfileState : DEFAULT_USER_PROFILE
  } catch {
    return DEFAULT_USER_PROFILE
  }
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
  const [entries, setEntries] = useState<Entry[]>(loadEntries)
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
  const cloudUserId = currentUser?.uid || null
  const [activeView, setActiveView] = useState<'feed' | 'profile' | 'settings' | 'entity' | 'login' | 'register'>('feed')
  const [selectedProfileHandle, setSelectedProfileHandle] = useState<string | null>(null)
  const [selectedProfileCollectionId, setSelectedProfileCollectionId] = useState<string | null>(null)
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null)
  const [selectedEntityType, setSelectedEntityType] = useState<MediaEntityType | null>(null)
  const [searchTab, setSearchTab] = useState<'media' | 'users'>('media')
  const [headerMediaResults, setHeaderMediaResults] = useState<MetadataResult[]>([])
  const [headerIdentityResults, setHeaderIdentityResults] = useState<UniversalMediaEntity[]>([])
  const [headerMediaSearchLoading, setHeaderMediaSearchLoading] = useState(false)
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

  const [userProfile, setUserProfile] = useState<UserProfileState>(loadLocalUserProfile)
  const [cloudExternalProfile, setCloudExternalProfile] = useState<{
    handle: string
    data: PublicUserData
  } | null>(null)

  useEffect(() => {
    const handle = selectedProfileHandle
    if (!handle || handle === userProfile.handle) {
      setCloudExternalProfile(null)
      return
    }
    let cancelled = false
    void loadPublicUserByHandle(handle)
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
  }, [selectedProfileHandle, userProfile.handle])

  const persistUserProfile = async (updated: UserProfileState) => {
    let nextProfile = updated
    if (cloudUserId && canUseCloudData(cloudUserId)) {
      const [avatarUrl, coverUrl] = await Promise.all([
        uploadUserImage(cloudUserId, 'avatar', updated.avatarUrl),
        uploadUserImage(cloudUserId, 'cover', updated.coverUrl),
      ])
      nextProfile = await saveUserProfile(cloudUserId, { ...updated, avatarUrl, coverUrl })
    }
    setUserProfile(nextProfile)
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(nextProfile))
  }

  const userProfileName = userProfile.showFullName
    ? `${userProfile.firstName} ${userProfile.lastName}`.trim()
    : userProfile.firstName

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
    try {
      return JSON.parse(localStorage.getItem('the-commonplace.likes') || '[]')
    } catch {
      return []
    }
  })
  const [savedEntryIds, setSavedEntryIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('the-commonplace.saves') || '[]')
    } catch {
      return []
    }
  })
  const [disabledCommentEntryIds, setDisabledCommentEntryIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('the-commonplace.disabled-comments') || '[]')
    } catch {
      return []
    }
  })

  const toggleLikeEntry = (id: string) => {
    setLikedEntryIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
      localStorage.setItem('the-commonplace.likes', JSON.stringify(next))
      persistCloudState({ likedEntryIds: next })
      return next
    })
  }

  const toggleSaveEntry = (id: string) => {
    setSavedEntryIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
      localStorage.setItem('the-commonplace.saves', JSON.stringify(next))
      persistCloudState({ savedEntryIds: next })
      return next
    })
  }

  const toggleCommentsDisabled = (id: string) => {
    setDisabledCommentEntryIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
      localStorage.setItem('the-commonplace.disabled-comments', JSON.stringify(next))
      persistCloudState({ disabledCommentEntryIds: next })
      if (cloudUserId) {
        void savePostCommenting(cloudUserId, id, next.includes(id)).catch((error) => {
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
  const [verificationPromptOpen, setVerificationPromptOpen] = useState(false)
  const [verificationBannerDismissed, setVerificationBannerDismissed] = useState(false)
  const [bannerSendingEmail, setBannerSendingEmail] = useState(false)
  const [bannerEmailNotice, setBannerEmailNotice] = useState('')
  const verificationCooldownLabel = `${Math.floor(verificationEmailCooldownSeconds / 60)}:${String(verificationEmailCooldownSeconds % 60).padStart(2, '0')}`

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
  const [searchOpen, setSearchOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [collectionTarget, setCollectionTarget] = useState<ProfileCollectionItem | null>(null)
  const gridRef = useRef<HTMLElement>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const [searchLimit, setSearchLimit] = useState(SEARCH_INITIAL_RESULT_LIMIT)
  const [persistedEntityCache, setPersistedEntityCache] = useState<Record<string, UniversalMediaEntity>>({})

  useEffect(() => {
    void migrateUnsafeIdentityCaches()
  }, [])

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

    if (section === 'verify-email' || (section === 'v' && rawId)) return
    if (authLoading) return
    const isAuthRoute = section === 'login' || section === 'register'
    if (!currentUser) {
      if (section === 'register') {
        setActiveView('register')
      } else {
        setActiveView('login')
        if (section !== 'login') navigate('/login', { replace: true })
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

    navigate('/', { replace: true })
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

  useEffect(() => {
    const normalizedQuery = query.trim()
    if (!searchOpen || searchTab !== 'media' || normalizedQuery.length < 2) {
      setHeaderMediaResults([])
      setHeaderIdentityResults([])
      setHeaderMediaSearchLoading(false)
      return
    }

    const abortController = new AbortController()
    const timer = window.setTimeout(() => {
      const typesToSearch = entryTypes.map((entryType) => entryType.id)
      setHeaderMediaSearchLoading(true)

      let pendingSearches = typesToSearch.length + 1
      setHeaderMediaResults([])
      setHeaderIdentityResults([])

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
          pendingSearches -= 1
          if (pendingSearches === 0 && !abortController.signal.aborted) setHeaderMediaSearchLoading(false)
        })

      typesToSearch.forEach((type) => {
        searchMetadata(type, normalizedQuery, abortController.signal)
          .then((results) => {
            if (!abortController.signal.aborted) {
              setHeaderMediaResults((current) => [...current, ...results])
            }
          })
          .catch((err) => {
            if ((err as Error)?.name === 'AbortError') return
          })
          .finally(() => {
            pendingSearches -= 1
            if (pendingSearches === 0 && !abortController.signal.aborted) {
              setHeaderMediaSearchLoading(false)
            }
          })
      })
    }, 350)

    return () => {
      abortController.abort()
      window.clearTimeout(timer)
    }
  }, [query, searchOpen, searchTab])

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
    try {
      return JSON.parse(localStorage.getItem('the-commonplace.following-users') || '["elena_r"]')
    } catch {
      return ['elena_r']
    }
  })

  const toggleFollowUser = (handle: string) => {
    const clean = handle.replace(/^@/, '')
    setFollowedUserHandles((prev) => {
      const next = prev.includes(clean) ? prev.filter((h) => h !== clean) : [...prev, clean]
      localStorage.setItem('the-commonplace.following-users', JSON.stringify(next))
      persistCloudState({ followedUserHandles: next })
      if (cloudUserId) {
        void saveFollowRelationship(cloudUserId, clean, next.includes(clean)).catch((error) => {
          console.error('Unable to sync follow relationship to Firebase.', error)
        })
      }
      return next
    })
  }

  const [followRequestedHandles, setFollowRequestedHandles] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('the-commonplace.follow-requests') || '[]')
    } catch {
      return []
    }
  })

  const toggleFollowRequest = (handle: string) => {
    const clean = handle.replace(/^@/, '')
    setFollowRequestedHandles((prev) => {
      const next = prev.includes(clean) ? prev.filter((h) => h !== clean) : [...prev, clean]
      localStorage.setItem('the-commonplace.follow-requests', JSON.stringify(next))
      persistCloudState({ followRequestedHandles: next })
      if (cloudUserId) {
        void saveFollowRequest(cloudUserId, clean, next.includes(clean)).catch((error) => {
          console.error('Unable to sync follow request to Firebase.', error)
        })
      }
      return next
    })
  }

  // ── Notifications ────────────────────────────────────────────────────────────
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('the-commonplace.notifications') || '[]')
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
    if (!cloudUserId || cloudHydratedUserRef.current === cloudUserId) return
    cloudHydratedUserRef.current = cloudUserId
    let cancelled = false

    void loadOrMigrateUserData(cloudUserId, localMigrationSnapshotRef.current)
      .then(async (snapshot) => {
        const [createdCollections, savedCollections] = await Promise.all([
          loadOrMigrateUserCollections(
            cloudUserId,
            'created',
            loadProfileCollections(snapshot.profile.handle),
          ),
          loadOrMigrateUserCollections(
            cloudUserId,
            'saved',
            loadSavedProfileCollections(snapshot.profile.handle),
          ),
        ])
        if (cancelled) return
        saveProfileCollections(snapshot.profile.handle, createdCollections)
        saveSavedProfileCollections(snapshot.profile.handle, savedCollections)
        setUserProfile(snapshot.profile)
        setEntries(snapshot.entries)
        setLikedEntryIds(snapshot.state.likedEntryIds)
        setSavedEntryIds(snapshot.state.savedEntryIds)
        setDisabledCommentEntryIds(snapshot.state.disabledCommentEntryIds)
        setFollowedUserHandles(snapshot.state.followedUserHandles)
        setFollowRequestedHandles(snapshot.state.followRequestedHandles)
        setNotifications(snapshot.state.notifications)

        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(snapshot.profile))
        saveEntriesToStorage(snapshot.entries)
        localStorage.setItem('the-commonplace.likes', JSON.stringify(snapshot.state.likedEntryIds))
        localStorage.setItem('the-commonplace.saves', JSON.stringify(snapshot.state.savedEntryIds))
        localStorage.setItem('the-commonplace.disabled-comments', JSON.stringify(snapshot.state.disabledCommentEntryIds))
        localStorage.setItem('the-commonplace.following-users', JSON.stringify(snapshot.state.followedUserHandles))
        localStorage.setItem('the-commonplace.follow-requests', JSON.stringify(snapshot.state.followRequestedHandles))
        localStorage.setItem('the-commonplace.notifications', JSON.stringify(snapshot.state.notifications))
      })
      .catch((error) => {
        console.error('Unable to hydrate Firebase data; continuing with local data.', error)
        cloudHydratedUserRef.current = null
      })

    return () => {
      cancelled = true
      if (cloudHydratedUserRef.current === cloudUserId) {
        cloudHydratedUserRef.current = null
      }
    }
  }, [cloudUserId])

  const persistCloudState = (patch: Parameters<typeof saveUserCloudState>[1]) => {
    if (!cloudUserId) return
    void saveUserCloudState(cloudUserId, patch).catch((error) => {
      console.error('Unable to sync account state to Firebase.', error)
    })
  }

  const markAllNotificationsRead = () => {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }))
      localStorage.setItem('the-commonplace.notifications', JSON.stringify(next))
      persistCloudState({ notifications: next })
      return next
    })
  }

  const dismissNotification = (id: string) => {
    setNotifications((prev) => {
      const next = prev.filter((n) => n.id !== id)
      localStorage.setItem('the-commonplace.notifications', JSON.stringify(next))
      persistCloudState({ notifications: next })
      return next
    })
  }

  const clearAllNotifications = () => {
    setNotifications([])
    localStorage.removeItem('the-commonplace.notifications')
    persistCloudState({ notifications: [] })
  }

  const ownProfileEntries = useMemo(() => entries.map((e) => ({
      ...e,
      authorHandle: userProfile.handle,
      authorName: userProfileName,
      authorAvatarUrl: userProfile.avatarUrl,
    })), [entries, userProfile.handle, userProfile.avatarUrl, userProfileName])

  const allHomepageEntries = useMemo(() => {
    // Only include external profile entries if the profile is public OR the user follows them
    const externalEntries = Object.entries(MOCK_EXTERNAL_PROFILES).flatMap(([handle, p]) => {
      if (p.profile.isPrivate && !followedUserHandles.includes(handle)) return []
      return p.entries
    })
    const combined = [...ownProfileEntries, ...externalEntries]
    return combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [ownProfileEntries, followedUserHandles])

  const filteredEntries = useMemo(() => {
    if (typeFilter !== 'all') {
      return allHomepageEntries.filter((entry) => entry.type === typeFilter)
    }
    return allHomepageEntries
  }, [allHomepageEntries, typeFilter])

  const masonryLayout = useMasonryLayout(gridRef, filteredEntries.length, expandedCardId, activeView)
  const [isInitialRender, setIsInitialRender] = useState(true)
  const [isFilterSwitching, setIsFilterSwitching] = useState(false)

  const handleTypeFilterChange = (nextFilter: EntryType | 'all') => {
    if (nextFilter === typeFilter) return
    setIsFilterSwitching(true)
    setTypeFilter(nextFilter)
  }

  const handleQueryChange = (val: string) => {
    setIsFilterSwitching(true)
    setQuery(val)
  }

  useEffect(() => {
    if (masonryLayout) {
      const timer = setTimeout(() => {
        setIsInitialRender(false)
        setIsFilterSwitching(false)
      }, 120)
      return () => clearTimeout(timer)
    }
  }, [masonryLayout, typeFilter, query])

  const saveEntries = (nextEntries: Entry[], nextDisabledCommentEntryIds = disabledCommentEntryIds) => {
    setEntries(nextEntries)
    saveEntriesToStorage(nextEntries)
    if (cloudUserId) {
      void saveUserEntries(cloudUserId, nextEntries, nextDisabledCommentEntryIds).catch((error) => {
        console.error('Unable to sync posts to Firebase.', error)
      })
    }
  }

  const handleLogout = async () => {
    if (window.confirm(`Log out of ${userProfileName} session?`)) {
      try {
        await logout()
      } catch {
        // ignore
      }
      setProfileMenuOpen(false)
      navigate('/login')
    }
  }

  const renderNotificationsGroup = () => (
    <NotificationBell
      notifications={notifications}
      onMarkAllRead={markAllNotificationsRead}
      onClearAll={clearAllNotifications}
      onDismiss={dismissNotification}
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
      open={searchOpen}
      query={query}
      mode={searchTab}
      mediaResults={mediaSearchResults}
      mediaLoading={headerMediaSearchLoading}
      resultLimit={searchLimit}
      onOpenChange={setSearchOpen}
      onQueryChange={handleQueryChange}
      onModeChange={setSearchTab}
      onLoadMore={() => setSearchLimit((current) => Math.min(current + SEARCH_RESULTS_PER_PAGE, SEARCH_MAX_RESULT_LIMIT))}
      onOpenEntity={handleOpenSearchEntity}
      onOpenUser={handleOpenUserFromSearch}
    />
  )

  const renderGlobalHeader = () => {
    const isHomeHeader = activeView === 'feed'

    return (
    <>
    <header className={`global-app-header ${isHomeHeader ? 'is-home-page' : 'is-inner-page'}`}>
      <div className="global-app-header-layout">
        <div className="global-header-navigation">
          {!isHomeHeader && (
            <button
              type="button"
              className="global-header-nav-btn"
              onClick={handleHome}
              aria-label="Go home"
              title="Home"
            >
              <Home aria-hidden="true" />
            </button>
          )}
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
          onClick={() => setProfileMenuOpen((v) => !v)}
        >
          {userProfile.avatarUrl ? (
            <img src={userProfile.avatarUrl} alt="Avatar" className="profile-avatar-img-sm" />
          ) : (
            <CircleUserRound aria-hidden="true" />
          )}
        </button>

        {profileMenuOpen && (
          <div className="profile-dropdown-menu">
            <div className="menu-identity-block">
              <div className="menu-identity-avatar">
                {userProfile.avatarUrl ? (
                  <img src={userProfile.avatarUrl} alt="Avatar" className="menu-identity-avatar-img" />
                ) : (
                  <User aria-hidden="true" />
                )}
              </div>
              <div className="menu-identity-info">
                <span className="menu-user-name">
                  {userProfile.showFullName ? `${userProfile.firstName} ${userProfile.lastName}` : userProfile.firstName}
                </span>
                <button
                  type="button"
                  className="menu-view-profile-link"
                  onClick={() => {
                    handleOpenUserProfile(userProfile.handle)
                    setProfileMenuOpen(false)
                  }}
                >
                  View Profile
                </button>
              </div>
            </div>
            <div className="menu-divider" />
            <button
              type="button"
              className="menu-item"
              onClick={handleOpenSettings}
            >
              <Settings aria-hidden="true" />
              <span>Settings</span>
            </button>
            <div className="menu-divider" />
            <button type="button" className="menu-item" onClick={handleLogout}>
              <LogOut aria-hidden="true" />
              <span>Logout</span>
            </button>
          </div>
        )}
          </div>
        </div>
      </div>
    </header>
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
  ) => {
    if (!currentUser?.emailVerified) {
      setVerificationPromptOpen(true)
      return
    }
    setEditingEntry(entry)
    setComposerInitialDraft(entry ? null : initialDraft)
    setComposerInitialLyrics(entry ? '' : initialLyrics)
    setComposerOpen(true)
  }

  const closeComposer = () => {
    setComposerOpen(false)
    setEditingEntry(null)
    setComposerInitialDraft(null)
    setComposerInitialLyrics('')
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

  const handleSave = (draft: EntryDraft, disableComments?: boolean) => {
    if (!currentUser?.emailVerified) {
      closeComposer()
      setVerificationPromptOpen(true)
      return
    }
    const timestamp = new Date().toISOString()

    if (editingEntry) {
      const nextDisabledCommentEntryIds = disableComments === undefined
        ? disabledCommentEntryIds
        : disableComments
          ? Array.from(new Set([...disabledCommentEntryIds, editingEntry.id]))
          : disabledCommentEntryIds.filter((id) => id !== editingEntry.id)
      const nextEntries = entries.map((entry) =>
        entry.id === editingEntry.id
          ? { ...entry, ...draft, updatedAt: timestamp }
          : entry,
      )
      saveEntries(nextEntries, nextDisabledCommentEntryIds)
      if (disableComments !== undefined) {
        setDisabledCommentEntryIds(nextDisabledCommentEntryIds)
        localStorage.setItem('the-commonplace.disabled-comments', JSON.stringify(nextDisabledCommentEntryIds))
        persistCloudState({ disabledCommentEntryIds: nextDisabledCommentEntryIds })
      }
      setExpandedCardId(editingEntry.id)
    } else {
      const newId = makeEntryId()
      const newEntry: Entry = {
        ...draft,
        id: newId,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      const nextDisabledCommentEntryIds = disableComments
        ? [...disabledCommentEntryIds, newId]
        : disabledCommentEntryIds
      saveEntries([newEntry, ...entries], nextDisabledCommentEntryIds)
      if (disableComments) {
        setDisabledCommentEntryIds(nextDisabledCommentEntryIds)
        localStorage.setItem('the-commonplace.disabled-comments', JSON.stringify(nextDisabledCommentEntryIds))
        persistCloudState({ disabledCommentEntryIds: nextDisabledCommentEntryIds })
      }
      setExpandedCardId('')
    }

    closeComposer()
  }

  const [deletingEntry, setDeletingEntry] = useState<Entry | null>(null)

  const promptDeleteEntry = (entryId: string) => {
    const target = entries.find((e) => e.id === entryId)
    if (target) {
      setDeletingEntry(target)
    }
  }

  const deleteEntry = (entryId: string) => {
    const nextEntries = entries.filter((entry) => entry.id !== entryId)
    saveEntries(nextEntries)
    if (expandedCardId === entryId) setExpandedCardId('')
  }

  const renderEmailVerificationPrompt = () => (
    <AnimatePresence>
      {verificationPromptOpen && (
        <div
          className="modal-backdrop"
          style={{ zIndex: 180 }}
          onClick={() => setVerificationPromptOpen(false)}
        >
          <motion.div
            className="settings-modal"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="email-verification-title"
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

  if (authLoading || (currentUser && (location.pathname === '/login' || location.pathname === '/register'))) {
    return (
      <div className="auth-page" role="status" aria-label="Checking account session">
        <span className="auth-loading-copy">Checking your account...</span>
      </div>
    )
  }

  if (!currentUser) {
    return location.pathname === '/register'
      ? <RegisterPage onSwitchToLogin={() => navigate('/login')} />
      : <LoginPage onSwitchToRegister={() => navigate('/register')} />
  }

  if (activeView === 'profile') {
    const isViewingOwn = selectedProfileHandle === null || selectedProfileHandle === userProfile.handle
    const externalProfileData = isViewingOwn
      ? undefined
      : cloudExternalProfile?.handle === selectedProfileHandle
        ? cloudExternalProfile.data
        : MOCK_EXTERNAL_PROFILES[selectedProfileHandle || '']
    const currentProfileData = isViewingOwn
      ? { profile: userProfile, entries: ownProfileEntries }
      : externalProfileData || { profile: userProfile, entries: entries }
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
          disabledCommentEntryIds={disabledCommentEntryIds}
          onSelectEntry={(entry) => setOverlayEntry(entry)}
          onOpenMediaProfile={handleOpenCollectionMedia}
          onToggleLike={toggleLikeEntry}
          onToggleSave={toggleSaveEntry}
          onToggleCommentsDisabled={toggleCommentsDisabled}
          userProfile={currentProfileData.profile}
          onUpdateProfile={isViewingOwn ? persistUserProfile : undefined}
          onNavigateToSettings={handleOpenSettings}
          onDeleteEntry={(id) => promptDeleteEntry(id)}
          onEditEntry={(entry) => openComposer(entry)}
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
        />
        <CardOverlayModal
          entry={overlayEntry}
          onClose={() => setOverlayEntry(null)}
          isLiked={overlayEntry ? likedEntryIds.includes(overlayEntry.id) : false}
          isSaved={overlayEntry ? savedEntryIds.includes(overlayEntry.id) : false}
          onToggleLike={() => overlayEntry && toggleLikeEntry(overlayEntry.id)}
          onToggleSave={() => overlayEntry && toggleSaveEntry(overlayEntry.id)}
          onOpenProfile={(handle) => {
            setOverlayEntry(null)
            handleOpenUserProfile(handle)
          }}
        />
        <AnimatePresence>
          {deletingEntry && (
            <div className="modal-backdrop" style={{ zIndex: 120 }} onClick={() => setDeletingEntry(null)}>
              <motion.div
                className="settings-modal"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="settings-header">
                  <div className="settings-header-title">
                    <Trash2 style={{ color: '#e57373' }} aria-hidden="true" />
                    <h2>Delete Entry?</h2>
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
        <AnimatePresence>
          {composerOpen ? (
            <EntryComposer
              entry={editingEntry}
              initialDraft={composerInitialDraft}
              initialLyrics={composerInitialLyrics}
              onClose={closeComposer}
              onSave={handleSave}
              commentsDisabled={editingEntry ? disabledCommentEntryIds.includes(editingEntry.id) : false}
            />
          ) : null}
        </AnimatePresence>
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
              average: 4.8,
              count: 2413,
              distribution: { 5: 85, 4: 11, 3: 3, 2: 1, 1: 0 },
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
        description: `Official catalog entry for ${cleanName} in The Commonplace community reflections archive.`,
        metadataChips: isHuman
          ? [{ label: 'Profession', value: fallbackType.charAt(0).toUpperCase() + fallbackType.slice(1) }]
          : [
              { label: isAlbum || isSong ? 'Artist' : isGame ? 'Studio' : 'Creator', value: mapItem?.artist || 'Unknown' },
              { label: 'Category', value: fallbackType === 'movie' ? 'Film' : fallbackType.replace('_', ' ') },
              { label: 'Release Year', value: mapItem?.year || '2023' },
              ...(mapItem?.explicit ? [{ label: 'Explicit', value: 'Yes' }] : []),
            ],
        communityRating: {
          average: 4.9,
          count: 1250,
          distribution: { 5: 88, 4: 10, 3: 2, 2: 0, 1: 0 },
        },
      }
    }

    if (universalEntity) {
      return (
        <>
          {renderGlobalHeader()}
          <UniversalMediaProfilePage
            entity={universalEntity}
            onBack={handlePageBack}
            onHome={handleHome}
            showLocalNavigation={false}
            communityEntries={allHomepageEntries}
            onSelectEntry={setOverlayEntry}
            onOpenUserProfile={handleOpenUserProfile}
            onNavigateToEntity={handleNavigateEntityBreadcrumb}
            onCanonicalMediaResolved={handleCanonicalMediaResolved}
            onQuickAddEntry={handleQuickAddEntityEntry}
            onAddToCollection={({ entity, artworkUrl, metadataChips }) => {
              const item = collectionItemFromEntity(entity, artworkUrl, metadataChips)
              if (item) setCollectionTarget(item)
            }}
            likedEntryIds={likedEntryIds}
            savedEntryIds={savedEntryIds}
            disabledCommentEntryIds={disabledCommentEntryIds}
            onToggleLike={toggleLikeEntry}
            onToggleSave={toggleSaveEntry}
          />
          <CardOverlayModal
            entry={overlayEntry}
            onClose={() => setOverlayEntry(null)}
            isLiked={overlayEntry ? likedEntryIds.includes(overlayEntry.id) : false}
            isSaved={overlayEntry ? savedEntryIds.includes(overlayEntry.id) : false}
            onToggleLike={() => overlayEntry && toggleLikeEntry(overlayEntry.id)}
            onToggleSave={() => overlayEntry && toggleSaveEntry(overlayEntry.id)}
            onOpenProfile={(handle) => {
              setOverlayEntry(null)
              handleOpenUserProfile(handle)
            }}
          />
          <AnimatePresence>
            {composerOpen ? (
              <EntryComposer
                entry={editingEntry}
                initialDraft={composerInitialDraft}
                initialLyrics={composerInitialLyrics}
                onClose={closeComposer}
                onSave={handleSave}
                commentsDisabled={editingEntry ? disabledCommentEntryIds.includes(editingEntry.id) : false}
              />
            ) : null}
          </AnimatePresence>
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

  if (activeView === 'settings') {
    return (
      <>
        {renderGlobalHeader()}
        <SettingsPage
          onBack={handlePageBack}
          showLocalNavigation={false}
          userProfile={userProfile}
          onSaveProfile={persistUserProfile}
        />
        {renderEmailVerificationPrompt()}
      </>
    )
  }

  return (
    <div className="app-shell">
      {/* Main content */}
      <main className="main-content">
        {renderGlobalHeader()}

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
                    transition={{ type: 'spring', stiffness: 380, damping: 36 }}
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
                        transition={{ type: 'spring', stiffness: 380, damping: 36 }}
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

        {/* Skeleton loading grid during filter switching or initialization */}
        {(!masonryLayout || isFilterSwitching) && filteredEntries.length > 0 ? (
          <CardSkeletonGrid count={filteredEntries.length > 6 ? 6 : Math.max(2, filteredEntries.length)} />
        ) : null}

        {/* Card grid — JS absolute-position masonry, newest top-left */}
        <section
          className="card-grid"
          ref={gridRef as React.RefObject<HTMLElement>}
          style={{
            position: 'relative',
            height: masonryLayout ? masonryLayout.height : 'auto',
            minHeight: filteredEntries.length === 0 ? 320 : undefined,
            visibility: masonryLayout && !isFilterSwitching ? 'visible' : 'hidden',
            opacity: masonryLayout && !isFilterSwitching ? 1 : 0,
            transition: masonryLayout && !isFilterSwitching
              ? 'opacity 140ms ease-out'
              : 'none',
          }}
          aria-label="Saved entries"
        >
          {filteredEntries.map((entry) => {
            const pos = masonryLayout?.positions.get(entry.id)
            const typeMeta = getTypeMeta(entry.type)
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
                  transition: (isInitialRender || isFilterSwitching)
                    ? 'none'
                    : 'transform 320ms cubic-bezier(0.2, 0, 0, 1)',
                  willChange: 'transform',
                } : { width: '100%', marginBottom: 14 }}
              >
                <Card
                  entry={entry}
                  expanded={expandedCardId === entry.id}
                  onDelete={() => promptDeleteEntry(entry.id)}
                  onEdit={() => openComposer(entry)}
                  onToggle={() => toggleCardExpanded(entry.id)}
                  onExpandOverlay={() => setOverlayEntry(entry)}
                  onOpenProfile={() => handleOpenUserProfile(entry.authorHandle)}
                  typeIcon={typeMeta.Icon}
                  typeLabel={typeMeta.label}
                  isLiked={likedEntryIds.includes(entry.id)}
                  isSaved={savedEntryIds.includes(entry.id)}
                  onToggleLike={() => toggleLikeEntry(entry.id)}
                  onToggleSave={() => toggleSaveEntry(entry.id)}
                  commentsDisabled={disabledCommentEntryIds.includes(entry.id)}
                  onToggleCommentsDisabled={() => toggleCommentsDisabled(entry.id)}
                />
              </div>
            )
          })}
          {filteredEntries.length === 0 && (
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

        {/* Reading Overlay Modal */}
        <CardOverlayModal
          entry={overlayEntry}
          onClose={() => setOverlayEntry(null)}
          isLiked={overlayEntry ? likedEntryIds.includes(overlayEntry.id) : false}
          isSaved={overlayEntry ? savedEntryIds.includes(overlayEntry.id) : false}
          onToggleLike={() => overlayEntry && toggleLikeEntry(overlayEntry.id)}
          onToggleSave={() => overlayEntry && toggleSaveEntry(overlayEntry.id)}
          onOpenProfile={(handle) => {
            setOverlayEntry(null)
            handleOpenUserProfile(handle)
          }}
        />

        {/* Confirm Delete Card Modal */}
        <AnimatePresence>
          {deletingEntry && (
            <div className="modal-backdrop" style={{ zIndex: 120 }} onClick={() => setDeletingEntry(null)}>
              <motion.div
                className="settings-modal"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="settings-header">
                  <div className="settings-header-title">
                    <Trash2 style={{ color: '#e57373' }} aria-hidden="true" />
                    <h2>Delete Entry?</h2>
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
        <button
          className="fab fab-scroll-top"
          type="button"
          aria-label="Back to top"
          title="Back to top"
          onClick={scrollToTop}
        >
          <ChevronUp aria-hidden="true" />
        </button>

        <button
          className="fab"
          type="button"
          aria-label="Add new entry"
          title="Add new entry"
          onClick={() => openComposer()}
        >
          <Plus aria-hidden="true" />
        </button>
      </div>

      {/* Entry composer modal */}
      <AnimatePresence>
        {composerOpen ? (
          <EntryComposer
            entry={editingEntry}
            initialDraft={composerInitialDraft}
            initialLyrics={composerInitialLyrics}
            onClose={closeComposer}
            onSave={handleSave}
            commentsDisabled={editingEntry ? disabledCommentEntryIds.includes(editingEntry.id) : false}
          />
        ) : null}
      </AnimatePresence>
      {renderEmailVerificationPrompt()}
    </div>
  )
}

