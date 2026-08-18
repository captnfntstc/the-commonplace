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
  Wrench,
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
import { useMasonryLayout } from '../hooks/useMasonryLayout'
import { NotificationBell } from '../components/Notifications/NotificationPanel'
import { MOCK_ENTITY_PROFILES } from '../data/entityProfiles'
import { UniversalMediaProfilePage } from '../pages/UniversalMediaProfilePage'
import { UNIVERSAL_MEDIA_ENTITIES } from '../data/universalMediaEntities'
import type { HumanProfileMetadata, MediaEntityType, UniversalMediaEntity } from '../types/mediaEntity'
import { resolveArtworkUrl } from '../utils/artwork'
import { ApiUsageTracker } from '../components/DeveloperTools/ApiUsageTracker'
import { cacheProfileEntity, getCachedProfileEntity } from '../services/profileCache'
import { MOCK_EXTERNAL_PROFILES } from '../data/externalProfiles'
import type { UserProfileState } from '../types/userProfile'
import type { AppNotification } from '../types/notification'
import { EntryComposer } from '../features/entries/composer/EntryComposer'
import {
  dedupeSearchEntities,
  creatorEntityForMetadataType,
  getSearchEntityScore,
  isCollaborationCredit,
  isYearOnlyMetadataMatch,
  metadataResultToSearchEntity,
  normalizeSearchText,
  searchEntityMatchesQuery,
  shouldSuppressSynthesizedArtist,
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
  ENTRY_STORAGE_KEY,
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

const SEARCH_INITIAL_RESULT_LIMIT = 6
const SEARCH_RESULTS_PER_PAGE = 6
const SEARCH_MAX_RESULT_LIMIT = 40

export default function AppController() {
  const location = useLocation()
  const navigate = useNavigate()
  const [entries, setEntries] = useState<Entry[]>(loadEntries)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<EntryType | 'all'>('all')
  const { expandedCardId, setExpandedCardId, toggleCardExpanded } = useCardExpansion()

  const [activeView, setActiveView] = useState<'feed' | 'profile' | 'settings' | 'entity'>('feed')
  const [selectedProfileHandle, setSelectedProfileHandle] = useState<string | null>(null)
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null)
  const [selectedEntityType, setSelectedEntityType] = useState<MediaEntityType | null>(null)
  const [searchTab, setSearchTab] = useState<'media' | 'users'>('media')
  const [headerMediaResults, setHeaderMediaResults] = useState<MetadataResult[]>([])
  const [headerMediaSearchLoading, setHeaderMediaSearchLoading] = useState(false)
  const headerAlbumResults = headerMediaResults
  const headerAlbumSearchLoading = headerMediaSearchLoading
  void headerAlbumResults
  void headerAlbumSearchLoading
  const [profileCategoryFilter, setProfileCategoryFilter] = useState<string>('all')
  const searchEntityCacheRef = useRef(new Map<string, UniversalMediaEntity>())

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
    const resolvedType =
      resolvedEntity?.type ||
      entityType ||
      searchEntityCacheRef.current.get(entityId)?.type ||
      UNIVERSAL_MEDIA_ENTITIES[entityId]?.type ||
      (MOCK_ENTITY_PROFILES[entityId]?.type as MediaEntityType | undefined) ||
      inferEntityTypeFromId(entityId)

    setSelectedEntityId(entityId)
    setSelectedEntityType(resolvedType)
    setActiveView('entity')
    navigate(getPathForEntity(entityId, resolvedType))
  }

  const handleCanonicalHumanResolved = (
    sourceEntity: UniversalMediaEntity,
    humanProfile: HumanProfileMetadata,
  ) => {
    const canonicalId = humanProfile.canonicalId
    if (!canonicalId || canonicalId === sourceEntity.id) return
    const canonicalEntity: UniversalMediaEntity = {
      ...sourceEntity,
      id: canonicalId,
      type: 'human',
      categoryLabel: humanProfile.context.charAt(0).toUpperCase() + humanProfile.context.slice(1),
      humanProfile,
    }
    searchEntityCacheRef.current.set(canonicalId, canonicalEntity)
    setPersistedEntityCache((current) => ({ ...current, [canonicalId]: canonicalEntity }))
    void cacheProfileEntity(canonicalEntity)
    setSelectedEntityId(canonicalId)
    setSelectedEntityType('human')
    navigate(getEntityRoutePath(canonicalId, 'human'), { replace: true })
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

  const [userProfile, setUserProfile] = useState<UserProfileState>({
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
  })

  const userProfileName = userProfile.showFullName
    ? `${userProfile.firstName} ${userProfile.lastName}`.trim()
    : userProfile.firstName

  const handleOpenUserProfile = (handle?: string) => {
    const cleanHandle = (handle || userProfile.handle).replace(/^@/, '')
    setSelectedProfileHandle(cleanHandle === userProfile.handle ? null : cleanHandle)
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
      return next
    })
  }

  const toggleSaveEntry = (id: string) => {
    setSavedEntryIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
      localStorage.setItem('the-commonplace.saves', JSON.stringify(next))
      return next
    })
  }

  const toggleCommentsDisabled = (id: string) => {
    setDisabledCommentEntryIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
      localStorage.setItem('the-commonplace.disabled-comments', JSON.stringify(next))
      return next
    })
  }

  const [composerOpen, setComposerOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null)
  const [composerInitialDraft, setComposerInitialDraft] = useState<EntryDraft | null>(null)
  const [composerInitialLyrics, setComposerInitialLyrics] = useState<string>('')
  const [overlayEntry, setOverlayEntry] = useState<Entry | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [isLoggedOut, setIsLoggedOut] = useState(false)
  const [quickDevToolsOpen, setQuickDevToolsOpen] = useState(false)
  const gridRef = useRef<HTMLElement>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const [searchLimit, setSearchLimit] = useState(SEARCH_INITIAL_RESULT_LIMIT)
  const [persistedEntityCache, setPersistedEntityCache] = useState<Record<string, UniversalMediaEntity>>({})

  useEffect(() => {
    if (!selectedEntityId || UNIVERSAL_MEDIA_ENTITIES[selectedEntityId] || searchEntityCacheRef.current.has(selectedEntityId)) {
      return
    }

    let cancelled = false
    getCachedProfileEntity(selectedEntityId).then((cachedEntity) => {
      if (cancelled || !cachedEntity) return
      searchEntityCacheRef.current.set(cachedEntity.id, cachedEntity)
      setPersistedEntityCache((current) => ({ ...current, [cachedEntity.id]: cachedEntity }))
    }).catch(() => {})

    return () => {
      cancelled = true
    }
  }, [selectedEntityId])

  useEffect(() => {
    const segments = location.pathname
      .split('/')
      .filter(Boolean)
      .map(decodeRouteSegment)

    const [section, rawId] = segments

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
  }, [location.pathname, navigate, userProfile.handle])

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
          entityImageCacheMap.set(entity.name.toLowerCase(), safeArtworkUrl)
          entityImageCacheMap.set(`${entity.type}:${entity.id}`, safeArtworkUrl)
          entityImageCacheMap.set(`${entity.type}:${entity.name.toLowerCase()}`, safeArtworkUrl)
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
              entityImageCacheMap.set(item.title.toLowerCase(), safeArtworkUrl)
              entityImageCacheMap.set(`${item.type}:${item.id}`, safeArtworkUrl)
              entityImageCacheMap.set(`${item.type}:${item.title.toLowerCase()}`, safeArtworkUrl)
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
      setHeaderMediaSearchLoading(false)
      return
    }

    const abortController = new AbortController()
    const timer = window.setTimeout(() => {
      const typesToSearch = entryTypes.map((entryType) => entryType.id)
      setHeaderMediaSearchLoading(true)

      let pendingSearches = typesToSearch.length
      setHeaderMediaResults([])

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

    const synthesizedPeopleResults: HeaderSearchEntity[] = []
    const knownArtistNames = new Set(
      localProfileResults
        .filter((entity) => entity.type === 'artist')
        .map((entity) => normalizeSearchText(entity.title)),
    )
    const creatorTypesByName = new Map<string, Set<MediaEntityType>>()
    const creatorEvidenceCountByName = new Map<string, Map<MediaEntityType, number>>()
    const creatorEvidenceSourcesByName = new Map<string, Map<MediaEntityType, Set<string>>>()
    headerMediaResults.forEach((result) => {
      if (!result.creator) return
      const creatorNorm = normalizeSearchText(result.creator)
      if (!creatorNorm) return
      const personType = creatorEntityForMetadataType(result.type).type
      const types = creatorTypesByName.get(creatorNorm) || new Set<MediaEntityType>()
      types.add(personType)
      creatorTypesByName.set(creatorNorm, types)

      const evidenceCounts = creatorEvidenceCountByName.get(creatorNorm) || new Map<MediaEntityType, number>()
      evidenceCounts.set(personType, (evidenceCounts.get(personType) || 0) + 1)
      creatorEvidenceCountByName.set(creatorNorm, evidenceCounts)

      const evidenceSources = creatorEvidenceSourcesByName.get(creatorNorm) || new Map<MediaEntityType, Set<string>>()
      const personSources = evidenceSources.get(personType) || new Set<string>()
      personSources.add(result.type)
      evidenceSources.set(personType, personSources)
      creatorEvidenceSourcesByName.set(creatorNorm, evidenceSources)
    })
    const seenPeople = new Set<string>(
      localProfileResults
        .filter((e) => ['artist', 'author', 'director', 'creator', 'actor', 'game_studio'].includes(e.type))
        .map((e) => `${e.type}:${normalizeSearchText(e.title)}`),
    )

    headerMediaResults.forEach((result) => {
      if (!result.creator) return
      if (result.type === 'album' || result.type === 'song') {
        if (isCollaborationCredit(result.creator)) return
      }
      const creatorNorm = normalizeSearchText(result.creator)
      if (!creatorNorm || creatorNorm.length < 1) return
      if (creatorNorm.includes(normalizedQuery) || normalizedQuery.includes(creatorNorm)) {
        const person = creatorEntityForMetadataType(result.type)
        const evidenceCount = creatorEvidenceCountByName.get(creatorNorm)?.get(person.type) || 0
        const evidenceSourceCount = creatorEvidenceSourcesByName.get(creatorNorm)?.get(person.type)?.size || 0
        if (shouldSuppressSynthesizedArtist(
          person.type,
          creatorTypesByName.get(creatorNorm) || [],
          knownArtistNames.has(creatorNorm),
          evidenceCount,
        )) return
        const personKey = `${person.type}:${creatorNorm}`
        if (!seenPeople.has(personKey)) {
          seenPeople.add(personKey)
          synthesizedPeopleResults.push({
            id: `${person.type.replace('_', '-')}:${creatorNorm.replace(/\s+/g, '-')}`,
            title: result.creator,
            artworkUrl: '',
            type: person.type,
            creatorValue: person.label,
            bio: person.bio,
            source: 'metadata',
            rank: 0,
            evidenceCount,
            evidenceSourceCount,
          })
        }
      }
    })

    const combined = dedupeSearchEntities([
      ...synthesizedPeopleResults,
      ...localProfileResults,
      ...metadataResults,
    ])

    return combined.sort((a, b) => {
      const scoreA = getSearchEntityScore(a, normalizedQuery)
      const scoreB = getSearchEntityScore(b, normalizedQuery)
      return scoreB - scoreA
    })
  }, [headerMediaResults, query])

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

  const addNotification = (n: AppNotification) => {
    setNotifications((prev) => {
      const next = [n, ...prev]
      localStorage.setItem('the-commonplace.notifications', JSON.stringify(next))
      return next
    })
  }

  const markAllNotificationsRead = () => {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }))
      localStorage.setItem('the-commonplace.notifications', JSON.stringify(next))
      return next
    })
  }

  const dismissNotification = (id: string) => {
    setNotifications((prev) => {
      const next = prev.filter((n) => n.id !== id)
      localStorage.setItem('the-commonplace.notifications', JSON.stringify(next))
      return next
    })
  }

  const clearAllNotifications = () => {
    setNotifications([])
    localStorage.removeItem('the-commonplace.notifications')
  }

  const allHomepageEntries = useMemo(() => {
    const ownWithAuthor = entries.map((e) => ({
      ...e,
      authorHandle: e.authorHandle || userProfile.handle,
      authorName: e.authorName || userProfileName,
      authorAvatarUrl: e.authorAvatarUrl || userProfile.avatarUrl,
    }))
    // Only include external profile entries if the profile is public OR the user follows them
    const externalEntries = Object.entries(MOCK_EXTERNAL_PROFILES).flatMap(([handle, p]) => {
      if (p.profile.isPrivate && !followedUserHandles.includes(handle)) return []
      return p.entries
    })
    const combined = [...ownWithAuthor, ...externalEntries]
    return combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [entries, userProfile.handle, userProfile.avatarUrl, userProfileName, followedUserHandles])

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

  const saveEntries = (nextEntries: Entry[]) => {
    setEntries(nextEntries)
    saveEntriesToStorage(nextEntries)
  }

  const handleLogout = () => {
    if (window.confirm(`Log out of ${userProfileName} session?`)) {
      setIsLoggedOut(true)
      setProfileMenuOpen(false)
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

  const renderQuickDevTools = () => (
    <div className="quick-devtools">
      {quickDevToolsOpen && (
        <div className="quick-devtools-panel">
          <div className="quick-devtools-panel-header">
            <div className="quick-devtools-title">
              <Wrench aria-hidden="true" />
              <span>Developer Tools</span>
            </div>
            <button
              type="button"
              className="quick-devtools-close"
              onClick={() => setQuickDevToolsOpen(false)}
              aria-label="Close developer tools"
              title="Close"
            >
              <X aria-hidden="true" />
            </button>
          </div>
          <ApiUsageTracker onAddNotification={addNotification} />
        </div>
      )}

      <div className="quick-devtools-dock" aria-label="Developer quick access">
        <button
          type="button"
          className={`quick-devtools-btn ${quickDevToolsOpen ? 'active' : ''}`}
          onClick={() => setQuickDevToolsOpen((open) => !open)}
          title="Open developer tools"
        >
          <Wrench aria-hidden="true" />
          <span>Developer Tools</span>
        </button>
      </div>
    </div>
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

  const renderFloatingHeaderActions = () => (
    <div className="floating-header-actions">
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
            <User aria-hidden="true" />
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
            <button
              type="button"
              className="menu-item danger"
              onClick={() => {
                if (window.confirm('Clear all entries from local storage?')) {
                  setEntries([])
                  localStorage.removeItem('the-commonplace.entries')
                  setProfileMenuOpen(false)
                }
              }}
            >
              <Trash2 aria-hidden="true" />
              <span>Clear All Data</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )

  const [showScrollTop, setShowScrollTop] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY || document.documentElement.scrollTop
      setShowScrollTop(scrollPos > 350)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openComposer = (
    entry: Entry | null = null,
    initialDraft: EntryDraft | null = null,
    initialLyrics = '',
  ) => {
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
    const timestamp = new Date().toISOString()

    if (editingEntry) {
      const nextEntries = entries.map((entry) =>
        entry.id === editingEntry.id
          ? { ...entry, ...draft, updatedAt: timestamp }
          : entry,
      )
      saveEntries(nextEntries)
      if (disableComments !== undefined) {
        setDisabledCommentEntryIds((prev) => {
          const has = prev.includes(editingEntry.id)
          if (disableComments && !has) {
            const next = [...prev, editingEntry.id]
            localStorage.setItem('the-commonplace.disabled-comments', JSON.stringify(next))
            return next
          }
          if (!disableComments && has) {
            const next = prev.filter((id) => id !== editingEntry.id)
            localStorage.setItem('the-commonplace.disabled-comments', JSON.stringify(next))
            return next
          }
          return prev
        })
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
      saveEntries([newEntry, ...entries])
      if (disableComments) {
        setDisabledCommentEntryIds((prev) => {
          const next = [...prev, newId]
          localStorage.setItem('the-commonplace.disabled-comments', JSON.stringify(next))
          return next
        })
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

  // Render Standalone Pages
  if (activeView === 'profile') {
    const isViewingOwn = selectedProfileHandle === null || selectedProfileHandle === userProfile.handle
    const currentProfileData = isViewingOwn
      ? { profile: userProfile, entries: entries }
      : MOCK_EXTERNAL_PROFILES[selectedProfileHandle || ''] || { profile: userProfile, entries: entries }

    return (
      <>
        {renderFloatingHeaderActions()}
        <UserProfilePage
          onBack={handlePageBack}
          entries={currentProfileData.entries}
          savedEntryIds={savedEntryIds}
          likedEntryIds={likedEntryIds}
          disabledCommentEntryIds={disabledCommentEntryIds}
          onSelectEntry={(entry) => setOverlayEntry(entry)}
          onToggleLike={toggleLikeEntry}
          onToggleSave={toggleSaveEntry}
          onToggleCommentsDisabled={toggleCommentsDisabled}
          userProfile={currentProfileData.profile}
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
          followRequestedHandles={followRequestedHandles}
          onToggleFollowRequest={toggleFollowRequest}
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
        {renderQuickDevTools()}
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
      const trackIdMatch = selectedEntityId.match(/^song-(\d+)$/i)
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
          {renderFloatingHeaderActions()}
          <UniversalMediaProfilePage
            entity={universalEntity}
            onBack={handlePageBack}
            onHome={handleHome}
            communityEntries={allHomepageEntries}
            onSelectEntry={setOverlayEntry}
            onOpenUserProfile={handleOpenUserProfile}
            onNavigateToEntity={handleNavigateEntityBreadcrumb}
            onCanonicalHumanResolved={handleCanonicalHumanResolved}
            onQuickAddEntry={handleQuickAddEntityEntry}
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
          {renderQuickDevTools()}
        </>
      )
    }
  }

  if (activeView === 'settings') {
    return (
      <>
        <SettingsPage
          onBack={handlePageBack}
          onClearAllData={() => {
            setEntries([])
            localStorage.removeItem(ENTRY_STORAGE_KEY)
            localStorage.removeItem('the-commonplace.likes')
            localStorage.removeItem('the-commonplace.saves')
          }}
          userProfile={userProfile}
          onSaveProfile={(updated) => setUserProfile(updated)}
          onAddNotification={addNotification}
        />
        {renderQuickDevTools()}
      </>
    )
  }

  return (
    <div className="app-shell">
      {/* Main content */}
      <main className="main-content">
        {/* Header */}
        <header className="commonplace-header">
          <div className="header-title-row">
            <div className="header-title-block">
              <h1 className="commonplace-title">The Commonplace.</h1>
            </div>
            <div className="header-actions">
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
                    <User aria-hidden="true" />
                  )}
                </button>

                {profileMenuOpen && (
                  <div className="profile-dropdown-menu">
                    {/* Identity block at the top */}
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
                    <button
                      type="button"
                      className="menu-item"
                      onClick={handleLogout}
                    >
                      <LogOut aria-hidden="true" />
                      <span>Logout</span>
                    </button>
                    <button
                      type="button"
                      className="menu-item danger"
                      onClick={() => {
                        if (window.confirm('Clear all entries from local storage?')) {
                          setEntries([])
                          localStorage.removeItem('the-commonplace.entries')
                          setProfileMenuOpen(false)
                        }
                      }}
                    >
                      <Trash2 aria-hidden="true" />
                      <span>Clear All Data</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="header-rule" />

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
        </header>

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

        {/* Logged Out Dialog */}
        <AnimatePresence>
          {isLoggedOut && (
            <div className="modal-backdrop" onClick={() => setIsLoggedOut(false)}>
              <motion.div
                className="settings-modal"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="settings-header">
                  <div className="settings-header-title">
                    <LogOut aria-hidden="true" />
                    <h2>Signed Out</h2>
                  </div>
                </div>
                <p style={{ color: 'var(--secondary)', lineHeight: 1.6, marginBottom: 20 }}>
                  You have logged out of your session. Your local catalog entries remain safely preserved.
                </p>
                <button
                  type="button"
                  className="primary-btn"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => setIsLoggedOut(false)}
                >
                  Log back in as jimboii
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* Floating action buttons stack */}
      <div className="fab-stack">
        <AnimatePresence>
          {showScrollTop && (
            <motion.button
              className="fab fab-scroll-top"
              type="button"
              aria-label="Scroll back to top"
              title="Scroll back to top"
              initial={{ opacity: 0, scale: 0.7, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.7, y: 10 }}
              transition={{ duration: 0.18 }}
              onClick={scrollToTop}
            >
              <ChevronUp aria-hidden="true" />
            </motion.button>
          )}
        </AnimatePresence>

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
      {renderQuickDevTools()}
    </div>
  )
}

