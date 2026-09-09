import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Clock,
  Layers,
  Lock,
  Search,
  User,
  Users,
  X,
} from 'lucide-react'
import { createArtworkPlaceholder } from '../../utils/artwork'
import { AdaptiveGameArtwork } from '../GameArtwork/AdaptiveGameArtwork'
import { getEntryTypeIcon } from '../../utils/mediaIcons'
import { searchPublicUsers } from '../../services/cloudData'
import { isLegacySeedHandle } from '../../utils/legacySeedCleanup'

type SearchMode = 'media' | 'users'

const LEGACY_RECENT_SEARCHES_KEY = 'the_commonplace_recent_searches_v2'
const RECENT_SEARCHES_KEYS: Record<SearchMode, string> = {
  media: 'the_commonplace_recent_media_searches_v3',
  users: 'the_commonplace_recent_user_searches_v3',
}
const MAX_RECENT_SEARCHES = 8

export type RecentSearchItem = {
  id: string
  name: string
  subtitle?: string
  badge?: string
  image?: string
  category?: SearchCategory
  type: SearchResultType | 'user' | 'query'
  handle?: string
}

function belongsToSearchMode(item: RecentSearchItem, mode: SearchMode) {
  return mode === 'users' ? item.type === 'user' : item.type !== 'user'
}

function recentSearchesKey(mode: SearchMode, storageScope?: string) {
  return storageScope ? `${RECENT_SEARCHES_KEYS[mode]}:${storageScope}` : RECENT_SEARCHES_KEYS[mode]
}

function loadRecentSearches(mode: SearchMode, storageScope?: string): RecentSearchItem[] {
  try {
    const raw = localStorage.getItem(recentSearchesKey(mode, storageScope))
    if (raw !== null) {
      return (JSON.parse(raw) as RecentSearchItem[]).filter(
        (item) => belongsToSearchMode(item, mode) && !isLegacySeedHandle(item.handle),
      )
    }

    if (storageScope) return []

    const legacyRaw = localStorage.getItem(LEGACY_RECENT_SEARCHES_KEY)
    const migrated = legacyRaw
      ? (JSON.parse(legacyRaw) as RecentSearchItem[]).filter(
          (item) => belongsToSearchMode(item, mode) && !isLegacySeedHandle(item.handle),
        )
      : []
    saveRecentSearches(mode, migrated)
    return migrated
  } catch {
    return []
  }
}

function saveRecentSearches(mode: SearchMode, items: RecentSearchItem[], storageScope?: string) {
  try {
    const scopedItems = items
      .filter((item) => belongsToSearchMode(item, mode))
      .slice(0, MAX_RECENT_SEARCHES)
    localStorage.setItem(recentSearchesKey(mode, storageScope), JSON.stringify(scopedItems))
  } catch {
    // ignore
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Primary archival-style header search experience.
// ─────────────────────────────────────────────────────────────────────────────

export type SearchCategory =
  | 'people'
  | 'books'
  | 'albums'
  | 'songs'
  | 'films'
  | 'shows'
  | 'games'

export type SearchResultType =
  | 'human'
  | 'music_group'
  | 'artist'
  | 'author'
  | 'director'
  | 'creator'
  | 'actor'
  | 'game_creator'
  | 'book'
  | 'album'
  | 'song'
  | 'film'
  | 'show'
  | 'game'

export type SearchMediaResult = {
  id: string
  name: string
  image: string
  category: SearchCategory
  type: SearchResultType
  subtitle: string
  badge?: string
  explicit?: boolean
  preferWikipediaArtwork?: boolean
}

export type SearchUser = {
  handle: string
  name: string
  avatar: string
  isPrivate?: boolean
}

interface PrimarySearchProps {
  query: string
  onQueryChange: (value: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: SearchMode
  onModeChange: (mode: SearchMode) => void
  onMediaFilterChange?: (filter: SearchCategory | 'all') => void
  mediaResults: SearchMediaResult[]
  mediaLoading: boolean
  resultLimit: number
  onLoadMore: () => void
  onOpenEntity: (result: SearchMediaResult) => void
  onOpenUser: (handle: string) => void
  storageScope?: string
}

const FILTERS: Array<{
  id: SearchCategory | 'all'
  label: string
  plural: string
  Icon: typeof Search
}> = [
  { id: 'all', label: 'All', plural: 'media', Icon: Layers },
  { id: 'people', label: 'People', plural: 'people', Icon: Users },
  { id: 'books', label: 'Books', plural: 'books', Icon: getEntryTypeIcon('book') },
  { id: 'albums', label: 'Albums', plural: 'albums', Icon: getEntryTypeIcon('album') },
  { id: 'songs', label: 'Songs', plural: 'songs', Icon: getEntryTypeIcon('song') },
  { id: 'films', label: 'Films', plural: 'films', Icon: getEntryTypeIcon('film') },
  { id: 'shows', label: 'Shows', plural: 'shows', Icon: getEntryTypeIcon('tv') },
  { id: 'games', label: 'Games', plural: 'games', Icon: getEntryTypeIcon('game') },
]

const MAX_VISIBLE_SEARCH_RESULTS = 40

const TYPE_BADGES: Record<SearchResultType, string> = {
  human: 'Person',
  music_group: 'Music Group',
  artist: 'Artist',
  author: 'Author',
  director: 'Director',
  creator: 'Creator',
  actor: 'Actor',
  game_creator: 'Game Creator',
  book: 'Book',
  album: 'Album',
  song: 'Song',
  film: 'Film',
  show: 'Show',
  game: 'Game',
}

const PORTRAIT_TYPES = new Set<SearchResultType>([
  'human',
  'music_group',
  'artist',
  'author',
  'director',
  'creator',
  'actor',
  'game_creator',
])

function isSquareThumb(type: SearchResultType) {
  return PORTRAIT_TYPES.has(type) || type === 'album' || type === 'song'
}

const SearchThumb: React.FC<{
  image: string
  name: string
  type: SearchResultType
  square?: boolean
  preferWikipediaArtwork?: boolean
}> = ({ image, name, type, square = false, preferWikipediaArtwork = false }) => {
  const photoKey = `${type}:${name}:${image}`
  const fallbackPhoto = image || createArtworkPlaceholder(name, TYPE_BADGES[type])
  const [resolvedPhoto, setResolvedPhoto] = useState<{ key: string; url: string } | null>(null)
  const photo = resolvedPhoto?.key === photoKey ? resolvedPhoto.url : fallbackPhoto

  return (
    <span className={`alt-search-thumb ${square ? 'is-square' : ''}`}>
      {type === 'game' ? (
        <AdaptiveGameArtwork
          src={photo}
          title={name}
          preferWikipedia={preferWikipediaArtwork}
          alt=""
          frameAspect={36 / 50}
          referrerPolicy="no-referrer"
          loading="eager"
          decoding="async"
        />
      ) : photo ? (
        <img
          src={photo}
          alt=""
          referrerPolicy="no-referrer"
          loading="eager"
          decoding="async"
          onError={() => setResolvedPhoto({
            key: photoKey,
            url: createArtworkPlaceholder(name, TYPE_BADGES[type]),
          })}
        />
      ) : (
        <Search aria-hidden="true" />
      )}
    </span>
  )
}

const SearchSkeleton: React.FC = () => (
  <div className="alt-search-skeleton" aria-hidden="true">
    {[0, 1, 2, 3, 4].map((i) => (
      <div key={i} className="alt-search-skeleton-row">
        <span className="alt-search-skeleton-thumb" />
        <span className="alt-search-skeleton-lines">
          <span />
          <span />
        </span>
        <span className="alt-search-skeleton-badge" />
      </div>
    ))}
  </div>
)

const MediaResultRow: React.FC<{
  result: SearchMediaResult
  active: boolean
  onHover: () => void
  onOpen: () => void
}> = ({ result, active, onHover, onOpen }) => (
  <button
    type="button"
    className={`alt-search-result ${active ? 'keyboard' : ''}`}
    onMouseEnter={onHover}
    onClick={onOpen}
  >
    <SearchThumb
      image={result.image}
      name={result.name}
      type={result.type}
      square={isSquareThumb(result.type)}
      preferWikipediaArtwork={result.preferWikipediaArtwork}
    />
    <span className="alt-search-result-copy">
      <span className="alt-search-result-title">
        <span>{result.name}</span>
        {result.explicit && <span className="explicit-badge explicit-badge--inline" aria-label="Explicit">E</span>}
      </span>
      {result.subtitle && <span className="alt-search-result-sub">{result.subtitle}</span>}
    </span>
    <span className="alt-search-type-badge">{result.badge || TYPE_BADGES[result.type]}</span>
  </button>
)

const UserResultRow: React.FC<{
  user: SearchUser
  active: boolean
  onHover: () => void
  onOpen: () => void
}> = ({ user, active, onHover, onOpen }) => (
  <button
    type="button"
    className={`alt-search-result ${active ? 'keyboard' : ''}`}
    onMouseEnter={onHover}
    onClick={onOpen}
  >
    <span className="alt-search-user-avatar">
      {user.avatar ? (
        <img src={user.avatar} alt="" referrerPolicy="no-referrer" loading="eager" decoding="async" />
      ) : (
        <User aria-hidden="true" />
      )}
    </span>
    <span className="alt-search-result-copy">
      <span className="alt-search-result-title alt-search-result-title--mono">
        @{user.handle}
        {user.isPrivate && <Lock size={11} aria-hidden="true" />}
      </span>
      <span className="alt-search-result-sub">{user.name}</span>
    </span>
  </button>
)

export const PrimarySearch: React.FC<PrimarySearchProps> = ({
  query,
  onQueryChange,
  open,
  onOpenChange,
  mode,
  onModeChange,
  onMediaFilterChange,
  mediaResults,
  mediaLoading,
  resultLimit,
  onLoadMore,
  onOpenEntity,
  onOpenUser,
  storageScope,
}) => {
  const [mediaFilter, setMediaFilter] = useState<SearchCategory | 'all'>('all')
  const [activeIndex, setActiveIndex] = useState(-1)
  const [recentSearchesByMode, setRecentSearchesByMode] = useState<Record<SearchMode, RecentSearchItem[]>>(() => ({
    media: loadRecentSearches('media', storageScope),
    users: loadRecentSearches('users', storageScope),
  }))
  const [iconExpanded, setIconExpanded] = useState(false)
  const [userSearchState, setUserSearchState] = useState<{
    key: string
    results: SearchUser[]
    loading: boolean
  }>({ key: '', results: [], loading: false })
  const containerRef = useRef<HTMLDivElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const trimmedQuery = query.trim()
  const expanded = iconExpanded || open || Boolean(trimmedQuery)
  const recentSearches = recentSearchesByMode[mode]

  const replaceRecentSearches = (items: RecentSearchItem[]) => {
    setRecentSearchesByMode((current) => ({ ...current, [mode]: items }))
    saveRecentSearches(mode, items, storageScope)
  }

  const addRecentSearch = (item: SearchMediaResult | SearchUser) => {
    const isUser = 'handle' in item
    const newItem: RecentSearchItem = isUser
      ? {
          id: `user:${item.handle}`,
          name: `@${item.handle}`,
          subtitle: item.name,
          image: item.avatar,
          type: 'user',
          handle: item.handle,
        }
      : {
          id: item.id,
          name: item.name,
          subtitle: item.subtitle,
          badge: item.badge,
          image: item.image,
          category: item.category,
          type: item.type,
        }

    const filtered = recentSearches.filter((r) => r.id !== newItem.id)
    const updated = [newItem, ...filtered].slice(0, MAX_RECENT_SEARCHES)
    replaceRecentSearches(updated)
  }

  const addRecentQuery = (text: string) => {
    const cleanText = text.trim()
    if (!cleanText) return
    const newItem: RecentSearchItem = {
      id: `query:${cleanText.toLowerCase()}`,
      name: cleanText,
      subtitle: 'Search query',
      type: 'query',
    }

    const filtered = recentSearches.filter(
      (r) => r.id !== newItem.id && r.name.toLowerCase() !== cleanText.toLowerCase(),
    )
    const updated = [newItem, ...filtered].slice(0, MAX_RECENT_SEARCHES)
    replaceRecentSearches(updated)
  }

  const handleRemoveRecent = (id: string) => {
    const updated = recentSearches.filter((r) => r.id !== id)
    replaceRecentSearches(updated)
  }

  const handleClearAllRecent = () => {
    replaceRecentSearches([])
  }

  const handleOpenRecent = (recent: RecentSearchItem) => {
    if (recent.type === 'query') {
      onQueryChange(recent.name)
      inputRef.current?.focus()
      return
    }
    setIconExpanded(false)
    onOpenChange(false)
    if (recent.type === 'user' && recent.handle) {
      onOpenUser(recent.handle)
    } else {
      onOpenEntity({
        id: recent.id,
        name: recent.name,
        image: recent.image || '',
        category: recent.category || 'albums',
        type: recent.type as SearchResultType,
        subtitle: recent.subtitle || '',
        badge: recent.badge,
      })
    }
  }

  useEffect(() => {
    const handle = query.replace(/^@/, '').trim()
    if (mode !== 'users' || !handle || isLegacySeedHandle(handle)) return

    let cancelled = false
    const searchKey = handle.toLowerCase()
    const timer = window.setTimeout(() => {
      setUserSearchState({ key: searchKey, results: [], loading: true })
      void searchPublicUsers(handle)
        .then((users) => {
          if (cancelled) return
          if (users.length === 0) {
            setUserSearchState({ key: searchKey, results: [], loading: false })
            return
          }
          setUserSearchState({
            key: searchKey,
            loading: false,
            results: users.map((user) => ({
              handle: user.handle,
              name: user.name,
              avatar: user.avatarUrl,
              isPrivate: user.isPrivate,
            })),
          })
        })
        .catch(() => {
          if (!cancelled) setUserSearchState({ key: searchKey, results: [], loading: false })
        })
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [mode, query])

  const userSearchKey = query.replace(/^@/, '').trim().toLowerCase()
  const userSearchIsValid = mode === 'users'
    && Boolean(userSearchKey)
    && !isLegacySeedHandle(userSearchKey)
  const userResults = userSearchIsValid && userSearchState.key === userSearchKey
    ? userSearchState.results
    : []
  const userLoading = userSearchIsValid
    && (userSearchState.key !== userSearchKey || userSearchState.loading)

  const mediaResultsFiltered = useMemo(() => {
    if (mediaFilter === 'all') return mediaResults
    return mediaResults.filter((result) => result.category === mediaFilter)
  }, [mediaFilter, mediaResults])

  const results = mode === 'media' ? mediaResultsFiltered : userResults
  const resultsLoading = mode === 'users' ? userLoading : mediaLoading
  const visibleResults = useMemo(() => results.slice(0, resultLimit), [resultLimit, results])

  // Clicking outside closes the dropdown and returns search to its icon.
  useEffect(() => {
    if (!expanded) return
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIconExpanded(false)
        if (open) onOpenChange(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [expanded, open, onOpenChange])

  useEffect(() => {
    const handleSearchShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setIconExpanded(true)
        onOpenChange(true)
        window.requestAnimationFrame(() => inputRef.current?.focus())
      }
    }
    window.addEventListener('keydown', handleSearchShortcut)
    return () => window.removeEventListener('keydown', handleSearchShortcut)
  }, [onOpenChange])

  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [open])

  const scrollActiveIntoView = (index: number) => {
    const node = resultsRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)
    node?.scrollIntoView({ block: 'nearest' })
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!open) return

    if (event.key === 'Escape') {
      event.preventDefault()
      setActiveIndex(-1)
      setIconExpanded(false)
      onOpenChange(false)
      return
    }

    // If a tab/filter/result button is focused, Enter should activate that
    // button natively rather than open the highlighted result.
    if (event.key === 'Enter' && (event.target as HTMLElement).tagName === 'BUTTON') return

    const maxItems = trimmedQuery.length === 0 ? recentSearches.length : visibleResults.length
    if (maxItems === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      const next = activeIndex >= maxItems - 1 ? activeIndex : activeIndex + 1
      setActiveIndex(next)
      scrollActiveIntoView(next)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      const next = activeIndex <= 0 ? 0 : activeIndex - 1
      setActiveIndex(next)
      scrollActiveIntoView(next)
      return
    }

    if (event.key === 'Enter') {
      if (trimmedQuery.length === 0) {
        if (activeIndex >= 0 && activeIndex < recentSearches.length) {
          event.preventDefault()
          handleOpenRecent(recentSearches[activeIndex])
        }
      } else {
        if (activeIndex >= 0 && activeIndex < visibleResults.length) {
          event.preventDefault()
          handleOpenResult(activeIndex)
        } else if (visibleResults.length > 0) {
          event.preventDefault()
          addRecentQuery(trimmedQuery)
          handleOpenResult(0)
        }
      }
    }
  }

  const handleClear = () => {
    if (trimmedQuery) {
      onQueryChange('')
      setActiveIndex(-1)
      inputRef.current?.focus()
    } else {
      setActiveIndex(-1)
      setIconExpanded(false)
      onOpenChange(false)
    }
  }

  const handleOpenResult = (index: number) => {
    const result = visibleResults[index]
    if (mode === 'media') {
      const mediaResult = result as SearchMediaResult
      addRecentSearch(mediaResult)
      setIconExpanded(false)
      onOpenEntity(mediaResult)
    } else {
      const userResult = result as SearchUser
      addRecentSearch(userResult)
      setIconExpanded(false)
      onOpenUser(userResult.handle)
    }
  }

  const emptyLabel =
    mode === 'users'
      ? `No users found for "${trimmedQuery}"`
      : mediaFilter === 'all'
        ? `No media found for "${trimmedQuery}"`
        : `No ${FILTERS.find((f) => f.id === mediaFilter)?.plural ?? 'media'} found for "${trimmedQuery}"`

  return (
    <div
      className={`alt-search ${expanded ? 'expanded' : ''} ${open ? 'open' : ''} ${trimmedQuery ? 'has-value' : ''}`}
      ref={containerRef}
      onKeyDown={handleKeyDown}
    >
      <div className="alt-search-bar">
        <button
          className="alt-search-icon-btn"
          type="button"
          aria-label="Search"
          title="Search"
          onClick={() => {
            setActiveIndex(-1)
            if (!expanded) setIconExpanded(true)
          }}
        >
          <Search aria-hidden="true" />
        </button>
        <input
          ref={inputRef}
          type="text"
          className="alt-search-input"
          value={query}
          onFocus={() => {
            if (!open) onOpenChange(true)
          }}
          onClick={() => {
            if (!open) onOpenChange(true)
          }}
          onChange={(e) => {
            setActiveIndex(-1)
            onQueryChange(e.target.value)
            if (!open) onOpenChange(true)
          }}
          placeholder={mode === 'users' ? 'Search users…' : 'Search media, people, thoughts…'}
          aria-label="Search"
        />
        <button
          type="button"
          className="alt-search-clear"
          title="Close search"
          aria-label="Close search"
          onClick={handleClear}
        >
          <X aria-hidden="true" />
        </button>
      </div>

      {open && (
        <div className="alt-search-dropdown">
          <div className="alt-search-tabs" role="tablist" aria-label="Search mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'media'}
              className={`alt-search-tab ${mode === 'media' ? 'active' : ''}`}
              onClick={() => {
                setActiveIndex(-1)
                onModeChange('media')
              }}
            >
              Media
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'users'}
              className={`alt-search-tab ${mode === 'users' ? 'active' : ''}`}
              onClick={() => {
                setActiveIndex(-1)
                onModeChange('users')
              }}
            >
              Users
            </button>
          </div>

          {mode === 'media' && trimmedQuery.length > 0 && (
            <div className="alt-search-filters" role="group" aria-label="Media filters">
              {FILTERS.map(({ Icon, ...filter }) => (
                <button
                  key={filter.id}
                  type="button"
                  className={`alt-search-filter ${mediaFilter === filter.id ? 'active' : ''}`}
                  onClick={() => {
                    setActiveIndex(-1)
                    setMediaFilter(filter.id)
                    onMediaFilterChange?.(filter.id)
                  }}
                  title={filter.label}
                  aria-label={`Filter by ${filter.label}`}
                  aria-pressed={mediaFilter === filter.id}
                >
                  <Icon aria-hidden="true" />
                </button>
              ))}
            </div>
          )}

          <div className="alt-search-results" ref={resultsRef}>
            {trimmedQuery.length === 0 ? (
              recentSearches.length > 0 ? (
                <div className="alt-search-recent-section">
                  <div className="alt-search-recent-header">
                    <span className="alt-search-recent-title">
                      <Clock size={13} aria-hidden="true" />
                      <span>Recent Searches</span>
                    </span>
                    <button
                      type="button"
                      className="alt-search-clear-all"
                      onClick={handleClearAllRecent}
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="alt-search-recent-list">
                    {recentSearches.map((item, index) => (
                      <div
                        key={item.id}
                        className={`alt-search-recent-row ${index === activeIndex ? 'keyboard' : ''}`}
                        data-index={index}
                        onMouseEnter={() => setActiveIndex(index)}
                      >
                        <button
                          type="button"
                          className="alt-search-result alt-search-recent-item-btn"
                          onClick={() => handleOpenRecent(item)}
                        >
                          {item.type === 'user' ? (
                            <span className="alt-search-user-avatar">
                              {item.image ? (
                                <img src={item.image} alt="" referrerPolicy="no-referrer" loading="eager" decoding="async" />
                              ) : (
                                <User aria-hidden="true" />
                              )}
                            </span>
                          ) : item.type === 'query' ? (
                            <span className="alt-search-query-icon">
                              <Search size={14} aria-hidden="true" />
                            </span>
                          ) : (
                            <SearchThumb
                              image={item.image || ''}
                              name={item.name}
                              type={item.type as SearchResultType}
                              square={isSquareThumb(item.type as SearchResultType)}
                            />
                          )}
                          <span className="alt-search-result-copy">
                            <span className="alt-search-result-title">{item.name}</span>
                            {item.subtitle && !PORTRAIT_TYPES.has(item.type as SearchResultType) && (
                              <span className="alt-search-result-sub">{item.subtitle}</span>
                            )}
                          </span>
                          <span className="alt-search-type-badge">
                            {item.type === 'user'
                              ? 'User'
                              : item.type === 'query'
                                ? 'Search'
                                : item.badge || (
                                  PORTRAIT_TYPES.has(item.type as SearchResultType)
                                    ? item.subtitle?.split('·')[0]?.trim()
                                    : ''
                                ) || TYPE_BADGES[item.type as SearchResultType] || 'Media'}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="alt-search-remove-recent"
                          title="Remove recent search"
                          aria-label={`Remove ${item.name} from recent searches`}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveRecent(item.id)
                          }}
                        >
                          <X size={14} aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="alt-search-empty">
                  {mode === 'users' ? 'Start typing to search users.' : 'Start typing to search media.'}
                </div>
              )
            ) : resultsLoading && results.length === 0 ? (
              <SearchSkeleton />
            ) : results.length === 0 ? (
              <div className="alt-search-empty">{emptyLabel}</div>
            ) : (
              visibleResults.map((result, index) =>
                mode === 'media' ? (
                  <div key={(result as SearchMediaResult).id} data-index={index}>
                    <MediaResultRow
                      result={result as SearchMediaResult}
                      active={index === activeIndex}
                      onHover={() => setActiveIndex(index)}
                      onOpen={() => handleOpenResult(index)}
                    />
                  </div>
                ) : (
                  <div key={(result as SearchUser).handle} data-index={index}>
                    <UserResultRow
                      user={result as SearchUser}
                      active={index === activeIndex}
                      onHover={() => setActiveIndex(index)}
                      onOpen={() => handleOpenResult(index)}
                    />
                  </div>
                ),
              )
            )}
            {trimmedQuery.length > 0 && resultLimit < Math.min(results.length, MAX_VISIBLE_SEARCH_RESULTS) && (
              <div className="alt-search-footer">
                <button type="button" className="alt-search-more-button" onClick={onLoadMore}>
                  Show More
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export type { PrimarySearchProps }
