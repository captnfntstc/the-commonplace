import { useEffect, useMemo, useRef, useState } from 'react'
import {
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
import { USER_DIRECTORY } from '../../data/userDirectory'
import { fetchArtistPortrait, fetchWikipediaPortrait } from '../../metadata'
import { createArtworkPlaceholder, resolveArtworkUrl } from '../../utils/artwork'
import { AdaptiveGameArtwork } from '../GameArtwork/AdaptiveGameArtwork'

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
  mode: 'media' | 'users'
  onModeChange: (mode: 'media' | 'users') => void
  mediaResults: SearchMediaResult[]
  mediaLoading: boolean
  resultLimit: number
  onLoadMore: () => void
  onOpenEntity: (result: SearchMediaResult) => void
  onOpenUser: (handle: string) => void
}

const FILTERS: Array<{
  id: SearchCategory | 'all'
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

const MAX_VISIBLE_SEARCH_RESULTS = 40

const TYPE_BADGES: Record<SearchResultType, string> = {
  human: 'Person',
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
  'artist',
  'author',
  'director',
  'creator',
  'actor',
  'game_creator',
])

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

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
  const isPortrait = PORTRAIT_TYPES.has(type)
  const photoKey = `${type}:${name}:${image}`
  const fallbackPhoto = image || createArtworkPlaceholder(name, TYPE_BADGES[type])
  const [resolvedPhoto, setResolvedPhoto] = useState<{ key: string; url: string } | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const photo = resolvedPhoto?.key === photoKey ? resolvedPhoto.url : fallbackPhoto

  useEffect(() => {
    if (!isPortrait) return
    let cancelled = false

    // Debounce portrait fetches by 120ms — avoids firing on every keystroke
    // when the user types quickly and components mount/unmount rapidly.
    debounceRef.current = setTimeout(() => {
      if (cancelled) return
      const wikipediaType = type === 'artist' || type === 'author' || type === 'director' || type === 'creator' || type === 'actor'
        ? type
        : undefined
      const portraitRequest = type === 'artist'
        ? fetchArtistPortrait(name)
        : fetchWikipediaPortrait(name, undefined, wikipediaType)
      portraitRequest
        .then((portraitUrl) => {
          if (!cancelled && portraitUrl) {
            setResolvedPhoto({ key: photoKey, url: resolveArtworkUrl(portraitUrl, name, type) })
          }
        })
        .catch(() => {
          if (!cancelled) {
            setResolvedPhoto({ key: photoKey, url: fallbackPhoto })
          }
        })
    }, 120)

    return () => {
      cancelled = true
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [fallbackPhoto, isPortrait, name, photoKey, type])

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
      <span className="alt-search-result-sub">{result.subtitle}</span>
    </span>
    <span className="alt-search-type-badge">{TYPE_BADGES[result.type]}</span>
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
  mediaResults,
  mediaLoading,
  resultLimit,
  onLoadMore,
  onOpenEntity,
  onOpenUser,
}) => {
  const [mediaFilter, setMediaFilter] = useState<SearchCategory | 'all'>('all')
  const [activeIndex, setActiveIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const trimmedQuery = query.trim()

  const userResults = useMemo<SearchUser[]>(() => {
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
  const visibleResults = useMemo(() => results.slice(0, resultLimit), [resultLimit, results])

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

  const scrollActiveIntoView = (index: number) => {
    const node = resultsRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)
    node?.scrollIntoView({ block: 'nearest' })
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!open) return

    if (event.key === 'Escape') {
      event.preventDefault()
      setActiveIndex(-1)
      onOpenChange(false)
      return
    }

    if (visibleResults.length === 0) return

    // If a tab/filter/result button is focused, Enter should activate that
    // button natively rather than open the highlighted result.
    if (event.key === 'Enter' && (event.target as HTMLElement).tagName === 'BUTTON') return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      const next = activeIndex >= visibleResults.length - 1 ? activeIndex : activeIndex + 1
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
      if (activeIndex >= 0 && activeIndex < visibleResults.length) {
        event.preventDefault()
        handleOpenResult(activeIndex)
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
      onOpenChange(false)
    }
  }

  const handleOpenResult = (index: number) => {
    const result = visibleResults[index]
    if (mode === 'media') {
      onOpenEntity(result as SearchMediaResult)
    } else {
      onOpenUser((result as SearchUser).handle)
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
          onClick={() => {
            setActiveIndex(-1)
            onOpenChange(!open)
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

          {mode === 'media' && (
            <div className="alt-search-filters" role="group" aria-label="Media filters">
              {FILTERS.map(({ Icon, ...filter }) => (
                <button
                  key={filter.id}
                  type="button"
                  className={`alt-search-filter ${mediaFilter === filter.id ? 'active' : ''}`}
                  onClick={() => {
                    setActiveIndex(-1)
                    setMediaFilter(filter.id)
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
              <div className="alt-search-empty">
                {mode === 'users' ? 'Start typing to search users.' : 'Start typing to search media.'}
              </div>
            ) : mediaLoading && results.length === 0 ? (
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
