import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  Clapperboard,
  Disc3,
  Gamepad2,
  Layers,
  Lock,
  Music4,
  Search,
  Tv,
  User,
  Users,
  X,
} from 'lucide-react'
import { USER_DIRECTORY } from '../../pages/UserProfilePage'
import { fetchWikipediaPortrait } from '../../metadata'
import { createArtworkPlaceholder, resolveArtworkUrl } from '../../utils/artwork'

// ─────────────────────────────────────────────────────────────────────────────
// Alternate Search — experimental developer feature.
// A separate archival-style search experience rendered only while the
// "Alternate search" toggle in Developer Settings is enabled. The default
// search (src/App.tsx) is untouched while this flag is off.
// ─────────────────────────────────────────────────────────────────────────────

export type AltSearchCategory =
  | 'people'
  | 'books'
  | 'albums'
  | 'songs'
  | 'films'
  | 'shows'
  | 'games'

export type AltSearchType =
  | 'artist'
  | 'author'
  | 'director'
  | 'actor'
  | 'game_creator'
  | 'book'
  | 'album'
  | 'song'
  | 'film'
  | 'show'
  | 'game'

export type AltMediaResult = {
  id: string
  name: string
  image: string
  category: AltSearchCategory
  type: AltSearchType
  subtitle: string
  explicit?: boolean
}

export type AltSearchUser = {
  handle: string
  name: string
  avatar: string
  isPrivate?: boolean
}

interface AlternateSearchProps {
  query: string
  onQueryChange: (value: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'media' | 'users'
  onModeChange: (mode: 'media' | 'users') => void
  mediaResults: AltMediaResult[]
  mediaLoading: boolean
  onOpenEntity: (result: AltMediaResult) => void
  onOpenUser: (handle: string) => void
}

const FILTERS: Array<{
  id: AltSearchCategory | 'all'
  label: string
  plural: string
  Icon: typeof Search
}> = [
  { id: 'all', label: 'All', plural: 'media', Icon: Layers },
  { id: 'people', label: 'People', plural: 'people', Icon: Users },
  { id: 'books', label: 'Books', plural: 'books', Icon: BookOpen },
  { id: 'albums', label: 'Albums', plural: 'albums', Icon: Disc3 },
  { id: 'songs', label: 'Songs', plural: 'songs', Icon: Music4 },
  { id: 'films', label: 'Films', plural: 'films', Icon: Clapperboard },
  { id: 'shows', label: 'Shows', plural: 'shows', Icon: Tv },
  { id: 'games', label: 'Games', plural: 'games', Icon: Gamepad2 },
]

const TYPE_BADGES: Record<AltSearchType, string> = {
  artist: 'Artist',
  author: 'Author',
  director: 'Director',
  actor: 'Actor',
  game_creator: 'Game Creator',
  book: 'Book',
  album: 'Album',
  song: 'Song',
  film: 'Film',
  show: 'Show',
  game: 'Game',
}

const PORTRAIT_TYPES = new Set<AltSearchType>([
  'artist',
  'author',
  'director',
  'actor',
  'game_creator',
])

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function isSquareThumb(type: AltSearchType) {
  return PORTRAIT_TYPES.has(type) || type === 'album' || type === 'song'
}

const AltSearchThumb: React.FC<{
  image: string
  name: string
  type: AltSearchType
  square?: boolean
}> = ({ image, name, type, square = false }) => {
  const isPortrait = PORTRAIT_TYPES.has(type)
  const [photo, setPhoto] = useState(() => image || createArtworkPlaceholder(name, TYPE_BADGES[type]))

  useEffect(() => {
    setPhoto(image || createArtworkPlaceholder(name, TYPE_BADGES[type]))
  }, [image, name, type])

  useEffect(() => {
    if (!isPortrait) return
    let cancelled = false
    fetchWikipediaPortrait(name)
      .then((portraitUrl) => {
        if (!cancelled && portraitUrl) setPhoto(resolveArtworkUrl(portraitUrl, name, type))
      })
      .catch(() => {
        if (!cancelled) {
          setPhoto((current) => current || createArtworkPlaceholder(name, TYPE_BADGES[type]))
        }
      })

    return () => {
      cancelled = true
    }
  }, [name, isPortrait, type])

  return (
    <span className={`alt-search-thumb ${square ? 'is-square' : ''}`}>
      {photo ? (
        <img
          src={photo}
          alt=""
          referrerPolicy="no-referrer"
          loading="eager"
          decoding="async"
          onError={() => setPhoto(createArtworkPlaceholder(name, TYPE_BADGES[type]))}
        />
      ) : (
        <Search aria-hidden="true" />
      )}
    </span>
  )
}

const AltSearchSkeleton: React.FC = () => (
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

const AltMediaResultRow: React.FC<{
  result: AltMediaResult
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
    <AltSearchThumb
      image={result.image}
      name={result.name}
      type={result.type}
      square={isSquareThumb(result.type)}
    />
    <span className="alt-search-result-copy">
      <span className="alt-search-result-title">
        <span>{result.name}</span>
        {result.explicit && <span className="explicit-badge explicit-badge--inline" aria-label="Explicit">E</span>}
      </span>
      <span className="alt-search-result-sub">{result.subtitle}</span>
    </span>
    <span className="alt-search-type-badge">{TYPE_BADGES[result.type]}</span>
  </button>
)

const AltUserResultRow: React.FC<{
  user: AltSearchUser
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

export const AlternateSearch: React.FC<AlternateSearchProps> = ({
  query,
  onQueryChange,
  open,
  onOpenChange,
  mode,
  onModeChange,
  mediaResults,
  mediaLoading,
  onOpenEntity,
  onOpenUser,
}) => {
  const [mediaFilter, setMediaFilter] = useState<AltSearchCategory | 'all'>('all')
  const [activeIndex, setActiveIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const trimmedQuery = query.trim()

  const userResults = useMemo<AltSearchUser[]>(() => {
    const normalizedQuery = normalizeSearchText(query)
    if (!normalizedQuery) return []

    return USER_DIRECTORY.filter((user) => {
      return (
        normalizeSearchText(user.name).includes(normalizedQuery) ||
        normalizeSearchText(user.handle).includes(normalizedQuery)
      )
    }).map((user) => ({
      handle: user.handle,
      name: user.name,
      avatar: user.avatar || '',
      isPrivate: user.isPrivate,
    }))
  }, [query])

  const mediaResultsFiltered = useMemo(() => {
    if (mediaFilter === 'all') return mediaResults
    return mediaResults.filter((result) => result.category === mediaFilter)
  }, [mediaFilter, mediaResults])

  const results = mode === 'media' ? mediaResultsFiltered : userResults

  // Clicking outside closes the dropdown.
  useEffect(() => {
    if (!open) return
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onOpenChange(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open, onOpenChange])

  // Reset keyboard selection whenever the visible list or open state changes.
  useEffect(() => {
    setActiveIndex(-1)
  }, [open, results])

  const scrollActiveIntoView = (index: number) => {
    const node = resultsRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)
    node?.scrollIntoView({ block: 'nearest' })
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!open) return

    if (event.key === 'Escape') {
      event.preventDefault()
      onOpenChange(false)
      return
    }

    if (results.length === 0) return

    // If a tab/filter/result button is focused, Enter should activate that
    // button natively rather than open the highlighted result.
    if (event.key === 'Enter' && (event.target as HTMLElement).tagName === 'BUTTON') return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      const next = activeIndex >= results.length - 1 ? activeIndex : activeIndex + 1
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
      if (activeIndex >= 0 && activeIndex < results.length) {
        event.preventDefault()
        handleOpenResult(activeIndex)
      }
    }
  }

  const handleClear = () => {
    if (trimmedQuery) {
      onQueryChange('')
      inputRef.current?.focus()
    } else {
      onOpenChange(false)
    }
  }

  const handleOpenResult = (index: number) => {
    const result = results[index]
    if (mode === 'media') {
      onOpenEntity(result as AltMediaResult)
    } else {
      onOpenUser((result as AltSearchUser).handle)
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
      className={`alt-search ${open ? 'open' : ''} ${trimmedQuery ? 'has-value' : ''}`}
      ref={containerRef}
      onKeyDown={handleKeyDown}
    >
      <div className="alt-search-bar">
        <button
          className="alt-search-icon-btn"
          type="button"
          aria-label="Search"
          title="Search"
          onClick={() => onOpenChange(!open)}
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
            onQueryChange(e.target.value)
            if (!open) onOpenChange(true)
          }}
          placeholder={mode === 'users' ? 'Search users…' : 'Search media…'}
          aria-label="Search"
          autoFocus
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
              onClick={() => onModeChange('media')}
            >
              Media
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'users'}
              className={`alt-search-tab ${mode === 'users' ? 'active' : ''}`}
              onClick={() => onModeChange('users')}
            >
              Users
            </button>
          </div>

          {mode === 'media' && (
            <div className="alt-search-filters" role="group" aria-label="Media filters">
              {FILTERS.map(({ Icon, ...filter }) => (
                <button
                  key={filter.id}
                  type="button"
                  className={`alt-search-filter ${mediaFilter === filter.id ? 'active' : ''}`}
                  onClick={() => setMediaFilter(filter.id)}
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
              <div className="alt-search-empty">
                {mode === 'users' ? 'Start typing to search users.' : 'Start typing to search media.'}
              </div>
            ) : mediaLoading && results.length === 0 ? (
              <AltSearchSkeleton />
            ) : results.length === 0 ? (
              <div className="alt-search-empty">{emptyLabel}</div>
            ) : (
              results.map((result, index) =>
                mode === 'media' ? (
                  <div key={(result as AltMediaResult).id} data-index={index}>
                    <AltMediaResultRow
                      result={result as AltMediaResult}
                      active={index === activeIndex}
                      onHover={() => setActiveIndex(index)}
                      onOpen={() => handleOpenResult(index)}
                    />
                  </div>
                ) : (
                  <div key={(result as AltSearchUser).handle} data-index={index}>
                    <AltUserResultRow
                      user={result as AltSearchUser}
                      active={index === activeIndex}
                      onHover={() => setActiveIndex(index)}
                      onOpen={() => handleOpenResult(index)}
                    />
                  </div>
                ),
              )
            )}
          </div>

          {trimmedQuery.length > 0 && results.length > 0 && (
            <div className="alt-search-footer">
              <span>View all results for "{trimmedQuery}"</span>
              <ArrowRight size={12} aria-hidden="true" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export type { AlternateSearchProps }
