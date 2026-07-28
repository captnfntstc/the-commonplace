import { AnimatePresence, motion } from 'framer-motion'
import {
  BookOpen,
  ChevronUp,
  Clapperboard,
  Disc3,
  Ellipsis,
  Gamepad2,
  Loader2,
  Music4,
  Plus,
  Quote,
  Save,
  Search,
  Star,
  Tv,
  X,
} from 'lucide-react'
import { type FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import {
  fetchLyrics,
  getCachedMetadata,
  type MetadataResult,
  type MetadataType,
  searchMetadata,
} from './metadata'
import { ExpansionProvider, useCardExpansion } from './context/ExpansionContext'
import { Card } from './components/CommonplaceCard/Card'
import { CardOverlayModal } from './components/CommonplaceCard/CardOverlayModal'
import { FormattingToolbar } from './components/FormattingToolbar/FormattingToolbar'
import { RichTextEditor } from './components/RichTextEditor/RichTextEditor'
import { stripHtmlAlignment, type Alignment } from './components/CommonplaceCard/FormattedText'

type EntryType = MetadataType

type CoverTone = 'gold' | 'rose' | 'sage' | 'blue' | 'violet' | 'ember'

type Entry = {
  id: string
  type: EntryType
  title: string
  creator: string
  provider: string
  providerId: string
  genre?: string
  rating: number
  favoritePassage: string
  reflection: string
  reflectionAlign?: Alignment
  passageAlign?: Alignment
  enableDropCap?: boolean
  year?: string
  coverUrl?: string
  summary?: string
  createdAt: string
  updatedAt: string
  coverTone: CoverTone
}

type EntryDraft = Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>

const storageKey = 'the-commonplace.entries'

const entryTypes: Array<{
  id: EntryType
  label: string
  Icon: typeof BookOpen
}> = [
  { id: 'book', label: 'Books', Icon: BookOpen },
  { id: 'album', label: 'Albums', Icon: Disc3 },
  { id: 'song', label: 'Songs', Icon: Music4 },
  { id: 'film', label: 'Films', Icon: Clapperboard },
  { id: 'game', label: 'Games', Icon: Gamepad2 },
  { id: 'tv', label: 'Shows', Icon: Tv },
]

const defaultCoverToneByType: Record<EntryType, CoverTone> = {
  book: 'blue',
  album: 'gold',
  song: 'violet',
  film: 'ember',
  tv: 'sage',
  game: 'rose',
}

const sampleEntryIds = new Set([
  'entry-1',
  'entry-2',
  'entry-3',
  'entry-4',
  'entry-5',
  'entry-6',
  'entry-7',
  'entry-8',
  'entry-9',
])

const emptyDraft: EntryDraft = {
  type: 'book',
  title: '',
  creator: '',
  provider: 'Manual',
  providerId: '',
  genre: '',
  rating: 4,
  favoritePassage: '',
  reflection: '',
  reflectionAlign: 'left',
  passageAlign: 'left',
  enableDropCap: false,
  coverTone: 'gold',
}

function loadEntries(): Entry[] {
  const stored = localStorage.getItem(storageKey)

  if (!stored) {
    return []
  }

  try {
    const parsed = JSON.parse(stored) as Entry[]
    if (!Array.isArray(parsed)) return []
    // Filter out initial sample entries and clean legacy HTML alignment tags
    return parsed
      .filter((entry) => !sampleEntryIds.has(entry.id))
      .map((entry) => {
        const { cleanText: cleanRef, align: refAlign } = stripHtmlAlignment(entry.reflection || '')
        const { cleanText: cleanPas, align: pasAlign } = stripHtmlAlignment(entry.favoritePassage || '')
        return {
          ...entry,
          reflection: cleanRef,
          favoritePassage: cleanPas,
          reflectionAlign: entry.reflectionAlign || refAlign || 'left',
          passageAlign: entry.passageAlign || pasAlign || 'left',
        }
      })
  } catch {
    return []
  }
}

function makeId() {
  return `entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function getDefaultCoverTone(type: EntryType) {
  return defaultCoverToneByType[type]
}

function usesSquareArtwork(type: EntryType) {
  return type === 'album' || type === 'song'
}

function getTypeMeta(type: EntryType) {
  return entryTypes.find((entryType) => entryType.id === type) ?? entryTypes[0]
}

// ─── Column-Based Dynamic Grid Layout ───────────────────────────────────────
// Column length has no limit.
// Expanding a card pushes only the cards below it in that column down.
// Adding a new card at index 0 shifts all cards to the right across columns.

const M_GAP = 30
const M_PAD_X = 40
const M_PAD_TOP = 28

function getColumnCount(width: number): number {
  if (width < 640) return 1
  if (width < 960) return 2
  if (width < 1280) return 3
  return 4
}

type MasonryPos = { left: number; top: number; width: number }
type MasonryLayout = { positions: Map<string, MasonryPos>; height: number } | null

function getItemTargetHeight(item: HTMLElement, isExpanded: boolean): number {
  const card = item.querySelector('.entry-card') as HTMLElement | null
  if (!card) return item.offsetHeight

  const reflection = card.querySelector('.card-reflection') as HTMLElement | null
  const reflectionInner = card.querySelector('.reflection-inner') as HTMLElement | null

  const currentReflectionH = reflection ? reflection.offsetHeight : 0
  const collapsedH = card.offsetHeight > 0 ? card.offsetHeight - currentReflectionH : item.offsetHeight

  if (isExpanded) {
    const reflectionH = reflectionInner ? reflectionInner.scrollHeight + 4 : 0
    return collapsedH + reflectionH
  }

  return collapsedH
}

function useMasonryLayout(
  containerRef: React.RefObject<HTMLElement | null>,
  itemCount: number,
  expandedId?: string,
): MasonryLayout {
  const [layout, setLayout] = useState<MasonryLayout>(null)

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    let frameId = 0
    const recalculate = () => {
      cancelAnimationFrame(frameId)
      frameId = requestAnimationFrame(() => {
        const items = Array.from(container.children).filter(
          (el) => el.classList.contains('masonry-item'),
        ) as HTMLElement[]
        if (items.length === 0) {
          setLayout(null)
          return
        }

        const w = container.clientWidth
        const numCols = getColumnCount(w)
        const colWidth = (w - M_PAD_X * 2 - M_GAP * (numCols - 1)) / numCols
        const heights = Array<number>(numCols).fill(M_PAD_TOP)
        const positions = new Map<string, MasonryPos>()

        items.forEach((item, index) => {
          const id = item.dataset.id
          if (!id) return
          const col = index % numCols
          const isExpanded = id === expandedId

          item.style.width = `${colWidth}px`

          const itemHeight = getItemTargetHeight(item, isExpanded)

          positions.set(id, {
            left: M_PAD_X + col * (colWidth + M_GAP),
            top: heights[col],
            width: colWidth,
          })
          heights[col] += itemHeight + M_GAP
        })

        setLayout({ positions, height: Math.max(...heights) + 80 })
      })
    }

    const ro = new ResizeObserver(recalculate)
    ro.observe(container)

    container.addEventListener('load', recalculate, true)

    recalculate()

    return () => {
      ro.disconnect()
      container.removeEventListener('load', recalculate, true)
      cancelAnimationFrame(frameId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, itemCount, expandedId])

  return layout
}

function draftFromMetadata(
  result: MetadataResult,
  current: EntryDraft,
): EntryDraft {
  const provider =
    result.provider && result.provider !== result.year
      ? result.provider
      : (result.genre || '')

  return {
    ...current,
    type: result.type,
    title: result.title,
    creator: result.creator,
    provider,
    providerId: result.providerId,
    year: result.year,
    genre: result.genre,
    coverUrl: result.coverUrl,
    summary: result.summary,
    coverTone: getDefaultCoverTone(result.type),
  }
}

function TypeIconBar({
  value,
  onChange,
}: {
  value: EntryType
  onChange: (type: EntryType) => void
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  return (
    <div className="type-icon-bar" role="radiogroup" aria-label="Select type">
      {entryTypes.map(({ id, label, Icon }) => {
        const isSelected = id === value
        const isHovered = hoveredId === id

        return (
          <button
            key={id}
            type="button"
            className={`type-icon-btn ${isSelected ? 'active' : ''}`}
            onClick={() => onChange(id)}
            onMouseEnter={() => setHoveredId(id)}
            onMouseLeave={() => setHoveredId(null)}
            aria-label={label}
            aria-checked={isSelected}
            role="radio"
          >
            <Icon aria-hidden="true" />
            {isHovered && <span className="type-icon-tooltip">{label}</span>}
          </button>
        )
      })}
    </div>
  )
}

function AppContent() {
  const [entries, setEntries] = useState<Entry[]>(loadEntries)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<EntryType | 'all'>('all')
  const { expandedCardId, setExpandedCardId, toggleCardExpanded } = useCardExpansion()

  const [composerOpen, setComposerOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null)
  const [overlayEntry, setOverlayEntry] = useState<Entry | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const gridRef = useRef<HTMLElement>(null)

  const filteredEntries = useMemo(() => {
    const byType =
      typeFilter === 'all'
        ? entries
        : entries.filter((entry) => entry.type === typeFilter)
    if (!query.trim()) return byType
    const q = query.toLowerCase()
    return byType.filter(
      (entry) =>
        entry.title.toLowerCase().includes(q) ||
        entry.creator.toLowerCase().includes(q) ||
        entry.provider.toLowerCase().includes(q) ||
        entry.favoritePassage.toLowerCase().includes(q) ||
        entry.reflection.toLowerCase().includes(q)
    )
  }, [entries, query, typeFilter])

  const masonryLayout = useMasonryLayout(gridRef, filteredEntries.length, expandedCardId)
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
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [masonryLayout, typeFilter, query])

  const saveEntries = (nextEntries: Entry[]) => {
    setEntries(nextEntries)
    localStorage.setItem(storageKey, JSON.stringify(nextEntries))
  }

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

  const openComposer = (entry: Entry | null = null) => {
    setEditingEntry(entry)
    setComposerOpen(true)
  }

  const closeComposer = () => {
    setComposerOpen(false)
    setEditingEntry(null)
  }

  const handleSave = (draft: EntryDraft) => {
    const timestamp = new Date().toISOString()

    if (editingEntry) {
      const nextEntries = entries.map((entry) =>
        entry.id === editingEntry.id
          ? { ...entry, ...draft, updatedAt: timestamp }
          : entry,
      )
      saveEntries(nextEntries)
      setExpandedCardId(editingEntry.id)
    } else {
      const newEntry: Entry = {
        ...draft,
        id: makeId(),
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      saveEntries([newEntry, ...entries])
      setExpandedCardId('')
    }

    closeComposer()
  }

  const deleteEntry = (entryId: string) => {
    const nextEntries = entries.filter((entry) => entry.id !== entryId)
    saveEntries(nextEntries)
    if (expandedCardId === entryId) setExpandedCardId('')
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
              <button
                className="hdr-icon-btn"
                type="button"
                aria-label="Search"
                onClick={() => setSearchOpen((v) => !v)}
              >
                <Search aria-hidden="true" />
              </button>
              <button
                className="hdr-icon-btn"
                type="button"
                aria-label="Menu"
              >
                <Ellipsis aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="header-rule" />

          {/* Search bar (collapsible) */}
          <AnimatePresence initial={false}>
            {searchOpen && (
              <motion.div
                className="search-bar"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Search aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  placeholder="Search title, creator, passage…"
                  aria-label="Search entries"
                  autoFocus
                />
                {query && (
                  <button
                    type="button"
                    className="search-clear"
                    onClick={() => handleQueryChange('')}
                    aria-label="Clear search"
                  >
                    <X aria-hidden="true" />
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Type filter tabs */}
          <div className="filter-row">
            <nav className="type-tabs" aria-label="Filter by type">
              <button
                className={typeFilter === 'all' ? 'tab active' : 'tab'}
                type="button"
                onClick={() => handleTypeFilterChange('all')}
              >
                <span>All</span>
              </button>
              {entryTypes.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  className={typeFilter === id ? 'tab active' : 'tab'}
                  type="button"
                  onClick={() => handleTypeFilterChange(id)}
                >
                  <Icon aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}
            </nav>
          </div>
        </header>

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
                  onDelete={() => deleteEntry(entry.id)}
                  onEdit={() => openComposer(entry)}
                  onToggle={() => toggleCardExpanded(entry.id)}
                  onExpandOverlay={() => setOverlayEntry(entry)}
                  typeIcon={typeMeta.Icon}
                  typeLabel={typeMeta.label}
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
        />
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
            onClose={closeComposer}
            onSave={handleSave}
          />
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function App() {
  return (
    <ExpansionProvider>
      <AppContent />
    </ExpansionProvider>
  )
}



function EntryComposer({
  entry,
  onClose,
  onSave,
}: {
  entry: Entry | null
  onClose: () => void
  onSave: (draft: EntryDraft) => void
}) {
  const initialDraft = entry
    ? {
        type: entry.type,
        title: entry.title,
        creator: entry.creator,
        provider: entry.provider,
        providerId: entry.providerId,
        rating: entry.rating,
        favoritePassage: entry.favoritePassage,
        reflection: entry.reflection,
        reflectionAlign: entry.reflectionAlign || 'left',
        passageAlign: entry.passageAlign || 'left',
        coverUrl: entry.coverUrl,
        summary: entry.summary,
        coverTone: entry.coverTone,
      }
    : emptyDraft
  const [draft, setDraft] = useState<EntryDraft>(
    initialDraft,
  )
  const [metadataQuery, setMetadataQuery] = useState(initialDraft.title)
  const [metadataResults, setMetadataResults] = useState<MetadataResult[]>([])
  const [searchStatus, setSearchStatus] = useState<
    'idle' | 'searching' | 'ready' | 'error'
  >('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [selectedLyricIndexes, setSelectedLyricIndexes] = useState<number[]>([])
  const [showPassage, setShowPassage] = useState(() => Boolean(entry?.favoritePassage?.trim()))
  const [lyricsStatus, setLyricsStatus] = useState<
    'idle' | 'loading' | 'ready' | 'not-found'
  >('idle')
  const [lyrics, setLyrics] = useState('')
  const lyricsFetchId = useRef(0)
  const reflectionRef = useRef<HTMLDivElement>(null)
  const passageRef = useRef<HTMLDivElement>(null)
  const [activeTarget, setActiveTarget] = useState<'reflection' | 'favoritePassage'>('reflection')

  const activeRef = activeTarget === 'favoritePassage' ? passageRef : reflectionRef
  const activeValue = activeTarget === 'favoritePassage' ? draft.favoritePassage : draft.reflection
  const setActiveValue = (val: string) => setDraft((cur) => ({ ...cur, [activeTarget]: val }))

  const isMusicEntry = draft.type === 'song' || draft.type === 'album'
  const lyricLines = lyrics
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  useEffect(() => {
    const normalizedQuery = metadataQuery.trim()
    const isSelectedValue =
      draft.providerId && normalizedQuery === draft.title.trim()

    if (normalizedQuery.length < 2 || isSelectedValue) {
      setSearchStatus('idle')
      setStatusMessage('')
      if (normalizedQuery.length < 2) setMetadataResults([])
      return
    }

    // Instant return if result is already cached
    const cached = getCachedMetadata(draft.type, normalizedQuery)
    if (cached) {
      setMetadataResults(cached)
      setSearchStatus('ready')
      return
    }

    setSearchStatus('searching')
    setStatusMessage('Searching metadata…')

    let cancelled = false
    const abortController = new AbortController()

    const timeout = window.setTimeout(() => {
      searchMetadata(draft.type, normalizedQuery, abortController.signal)
        .then((results) => {
          if (cancelled) return
          setMetadataResults(results)
          setSearchStatus('ready')
          setStatusMessage(
            results.length > 0 ? '' : 'No results found. You can still fill details manually.',
          )
        })
        .catch((err: unknown) => {
          if (cancelled || (err instanceof Error && err.name === 'AbortError')) return
          setSearchStatus('error')
          setStatusMessage(
            err instanceof Error ? err.message : 'Failed to search metadata API.',
          )
        })
    }, 120)

    return () => {
      cancelled = true
      abortController.abort()
      window.clearTimeout(timeout)
    }
  }, [draft.providerId, draft.title, draft.type, metadataQuery])

  const changeType = (type: EntryType) => {
    setDraft((cur) => ({
      ...emptyDraft,
      rating: cur.rating,
      reflection: cur.reflection,
      type,
      coverTone: getDefaultCoverTone(type),
    }))
    setMetadataQuery('')
    setMetadataResults([])
    setSelectedLyricIndexes([])
    setLyricsStatus('idle')
    setLyrics('')
    setSearchStatus('idle')
    setStatusMessage('')
    setShowPassage(false)
  }

  const updateMetadataQuery = (value: string) => {
    setMetadataQuery(value)
    setDraft((cur) => ({
      ...cur,
      title: '',
      creator: '',
      provider: '',
      providerId: '',
      coverUrl: undefined,
      summary: undefined,
      favoritePassage: isMusicEntry ? '' : cur.favoritePassage,
    }))
    setSelectedLyricIndexes([])
    setLyricsStatus('idle')
    setLyrics('')
  }

  const selectMetadata = async (result: MetadataResult) => {
    const fetchId = ++lyricsFetchId.current
    setDraft((cur) => draftFromMetadata(result, cur))
    setMetadataQuery(result.title)
    setMetadataResults([])
    setSearchStatus('idle')
    setStatusMessage('')
    setSelectedLyricIndexes([])

    if (result.type === 'song') {
      setLyricsStatus('loading')
      setLyrics('')
      const abortController = new AbortController()
      try {
        const fetched = await fetchLyrics(result.creator, result.title, abortController.signal)
        if (lyricsFetchId.current !== fetchId) return // stale — user picked another item
        if (fetched) {
          setLyrics(fetched)
          setLyricsStatus('ready')
        } else {
          setLyricsStatus('not-found')
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return
        if (lyricsFetchId.current === fetchId) setLyricsStatus('not-found')
      }
    } else {
      setLyricsStatus('idle')
      setLyrics('')
    }
  }

  const toggleLyricLine = (index: number) => {
    const nextIndexes = selectedLyricIndexes.includes(index)
      ? selectedLyricIndexes.filter((selectedIndex) => selectedIndex !== index)
      : [...selectedLyricIndexes, index].sort((a, b) => a - b)

    setSelectedLyricIndexes(nextIndexes)
    setShowPassage(true)
    setDraft((cur) => ({
      ...cur,
      favoritePassage: nextIndexes.map((lineIndex) => lyricLines[lineIndex]).join('\n'),
    }))
  }

  const submitDraft = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!draft.title.trim()) {
      setSearchStatus('error')
      setStatusMessage('Choose an API result before saving.')
      return
    }

    onSave({
      ...draft,
      title: draft.title.trim(),
      creator: draft.creator.trim(),
      provider: draft.provider.trim(),
      providerId: draft.providerId.trim(),
      favoritePassage: draft.favoritePassage.trim(),
      reflection: draft.reflection.trim(),
    })
  }

  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.form
        className="composer"
        onSubmit={submitDraft}
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ duration: 0.2 }}
      >
        <div className="composer-header composer-header--landscape">
          <div className="composer-header-spacer" />
          <div className="composer-title">
            <p className="composer-eyebrow">{entry ? 'Edit entry' : 'New entry'}</p>
            <h2>{entry ? entry.title : 'New Margin'}</h2>
            <div className="composer-title-rule" />
          </div>
          <button
            className="composer-close-icon"
            type="button"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <div className="composer-landscape">
          <section className="composer-left">
            <div className="form-grid">
              <label>
                <span>Type</span>
                <TypeIconBar value={draft.type} onChange={changeType} />
              </label>

              <label className="metadata-search-field">
                <span>Select {draft.type === 'tv' ? 'a show' : `a ${draft.type}`}</span>
                <input
                  value={metadataQuery}
                  onChange={(event) => updateMetadataQuery(event.target.value)}
                  placeholder={`Search ${getTypeMeta(draft.type).label.toLowerCase()}`}
                />
                {metadataQuery.trim().length >= 2 && (
                  <div className="metadata-dropdown">
                    {searchStatus === 'searching' && (
                      <p className="metadata-status searching">
                        <Loader2 className="spin-icon" aria-hidden="true" />
                        <span>Searching metadata…</span>
                      </p>
                    )}
                    {searchStatus !== 'searching' && statusMessage && (
                      <p className="metadata-status">{statusMessage}</p>
                    )}
                    {searchStatus === 'ready' && metadataResults.map((result) => (
                      <button
                        className={
                          result.providerId === draft.providerId
                            ? 'metadata-option selected'
                            : 'metadata-option'
                        }
                        key={result.id}
                        type="button"
                        onClick={() => selectMetadata(result)}
                      >
                        <span
                          className={
                            usesSquareArtwork(result.type)
                              ? 'metadata-thumb metadata-thumb--square'
                              : 'metadata-thumb'
                          }
                        >
                          {result.coverUrl ? (
                            <img src={result.coverUrl} alt="" />
                          ) : (
                            <Search aria-hidden="true" />
                          )}
                        </span>
                        <span className="metadata-option-copy">
                          <strong>{result.title}</strong>
                          <span className="metadata-type-line">
                            <span>{[result.creator, result.provider || result.genre].filter(Boolean).join(' • ')}</span>
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </label>
            </div>

            {draft.title ? (
              <div className="selected-metadata">
                <div
                  className={
                    usesSquareArtwork(draft.type)
                      ? 'selected-cover selected-cover--square'
                      : 'selected-cover'
                  }
                >
                  {draft.coverUrl ? (
                    <img src={draft.coverUrl} alt="" />
                  ) : (
                    <BookOpen aria-hidden="true" />
                  )}
                </div>
                <div className="selected-metadata-info">
                  <h3>{draft.title}</h3>
                  {draft.type === 'book' && (
                    <>
                      {draft.creator && <p>Author: {draft.creator}</p>}
                      {draft.genre && <p className="selected-genre">{draft.genre}</p>}
                    </>
                  )}
                  {draft.type === 'album' && (
                    <>
                      {draft.creator && <p>Artist: {draft.creator}</p>}
                      {draft.genre && <p className="selected-genre">{draft.genre}</p>}
                    </>
                  )}
                  {draft.type === 'song' && (
                    <>
                      {draft.creator && <p>Artist: {draft.creator}</p>}
                      {draft.genre && <p className="selected-genre">{draft.genre}</p>}
                      {draft.provider && draft.provider !== draft.genre && draft.provider !== draft.year && (
                        <p>{draft.provider}</p>
                      )}
                    </>
                  )}
                  {draft.type === 'film' && (
                    <>
                      {draft.genre && <p className="selected-genre">{draft.genre}</p>}
                      {(draft.creator || draft.year) && (
                        <p>{draft.creator || (draft.year ? `Released ${draft.year}` : '')}</p>
                      )}
                    </>
                  )}
                  {draft.type === 'game' && (
                    <>
                      {draft.genre && <p className="selected-genre">{draft.genre}</p>}
                      {draft.creator && <p>Developer: {draft.creator}</p>}
                    </>
                  )}
                  {draft.type === 'tv' && (
                    <>
                      {draft.genre && <p className="selected-genre">{draft.genre}</p>}
                      {draft.creator && <p>Cast: {draft.creator}</p>}
                    </>
                  )}
                  {draft.summary && <p className="selected-summary">{draft.summary}</p>}
                </div>
              </div>
            ) : (
              <div className="selected-metadata selected-metadata--empty">
                <div className="selected-cover">
                  <BookOpen aria-hidden="true" />
                </div>
                <div className="selected-metadata-info">
                  <h3>Choose something to keep</h3>
                  <p>Search results will auto-fill the title, creator, year, source, and artwork.</p>
                </div>
              </div>
            )}

            <div className="full-label">
              <span>Rating ({draft.rating} / 5)</span>
              <RatingPicker
                value={draft.rating}
                onChange={(rating) => setDraft((cur) => ({ ...cur, rating }))}
              />
            </div>
          </section>

          <section className="composer-right">
            {draft.type === 'song' ? (
              <div className="full-label lyrics-section">
                <span>Favorite lyrics</span>
                <div className="lyrics-box">
                  {lyricsStatus === 'idle' && (
                    <div className="lyrics-placeholder">
                      <Music4 aria-hidden="true" />
                      <p>Select a song to load lyrics and tap the lines you love.</p>
                    </div>
                  )}
                  {lyricsStatus === 'loading' && (
                    <div className="lyrics-placeholder">
                      <Loader2 className="spin-icon" aria-hidden="true" />
                      <p>Fetching lyrics…</p>
                    </div>
                  )}
                  {lyricsStatus === 'not-found' && (
                    <div className="lyrics-placeholder">
                      <p>No lyrics found for this track.</p>
                    </div>
                  )}
                  {lyricsStatus === 'ready' && lyricLines.length > 0 && (
                    <div className="lyrics-selector">
                      {lyricLines.map((line, index) => (
                        <button
                          className={
                            selectedLyricIndexes.includes(index)
                              ? 'lyric-line selected'
                              : 'lyric-line'
                          }
                          key={`${line}-${index}`}
                          type="button"
                          onClick={() => toggleLyricLine(index)}
                        >
                          {line}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : showPassage ? (
              <div className="full-label passage-container">
                <div className="passage-header">
                  <span>
                    {draft.type === 'album'
                      ? 'Favorite lyrics / passage'
                      : 'Favorite passage'}
                  </span>
                  <button
                    type="button"
                    className="collapse-passage-btn"
                    onClick={() => {
                      setShowPassage(false)
                      setDraft((cur) => ({ ...cur, favoritePassage: '' }))
                    }}
                    title="Remove favorite passage"
                  >
                    <X aria-hidden="true" />
                  </button>
                </div>
                <RichTextEditor
                  editorRef={passageRef}
                  value={draft.favoritePassage}
                  onFocus={() => setActiveTarget('favoritePassage')}
                  onChange={(html) =>
                    setDraft((cur) => ({ ...cur, favoritePassage: html }))
                  }
                  minHeight={100}
                  placeholder={
                    draft.type === 'album'
                      ? 'A lyric or line from this album that stayed with you…'
                      : 'A line, a scene, a quote, or a moment…'
                  }
                />
              </div>
            ) : (
              <button
                type="button"
                className="toggle-passage-btn"
                onClick={() => setShowPassage(true)}
              >
                <Quote aria-hidden="true" />
                <span>+ Add favorite passage / quote</span>
              </button>
            )}

            <div className="full-label composer-review">
              <div className="passage-header">
                <span>Review / Reflection</span>
              </div>
              <RichTextEditor
                editorRef={reflectionRef}
                value={draft.reflection}
                onFocus={() => setActiveTarget('reflection')}
                onChange={(html) =>
                  setDraft((cur) => ({ ...cur, reflection: html }))
                }
                minHeight={180}
                placeholder="What stayed with you?"
              />
            </div>

            <div className="composer-actions">
              <FormattingToolbar
                editorRef={activeRef}
                value={activeValue}
                onChange={setActiveValue}
                enableDropCap={Boolean(draft.enableDropCap)}
                onToggleDropCap={() =>
                  setDraft((cur) => ({
                    ...cur,
                    enableDropCap: !cur.enableDropCap,
                  }))
                }
              />
              <div className="composer-action-btns">
                <button className="ghost-btn" type="button" onClick={onClose}>
                  Cancel
                </button>
                <button className="primary-btn" type="submit">
                  <Save aria-hidden="true" />
                  <span>Publish</span>
                </button>
              </div>
            </div>
          </section>
        </div>
      </motion.form>
    </motion.div>
  )
}

function RatingPicker({
  value,
  onChange,
}: {
  value: number
  onChange: (rating: number) => void
}) {
  const [hoverValue, setHoverValue] = useState<number | null>(null)
  const isHovering = hoverValue !== null
  const activeRating = isHovering ? hoverValue : value

  return (
    <div
      className={isHovering ? 'rating-picker is-hovering' : 'rating-picker'}
      aria-label={`${value} out of 5 stars`}
      onMouseLeave={() => setHoverValue(null)}
    >
      {Array.from({ length: 5 }, (_, index) => {
        const fillPercent = Math.max(0, Math.min(1, activeRating - index)) * 100

        return (
          <span className="rating-star-control" key={index}>
            <Star aria-hidden="true" className="rating-star-outline" />
            <span className="rating-star-fill" style={{ width: `${fillPercent}%` }}>
              <Star aria-hidden="true" />
            </span>
            <button
              type="button"
              className="rating-hit rating-hit-left"
              aria-label={`${index + 0.5} stars`}
              onMouseEnter={() => setHoverValue(index + 0.5)}
              onClick={() => onChange(index + 0.5)}
            />
            <button
              type="button"
              className="rating-hit rating-hit-right"
              aria-label={`${index + 1} stars`}
              onMouseEnter={() => setHoverValue(index + 1)}
              onClick={() => onChange(index + 1)}
            />
          </span>
        )
      })}
    </div>
  )
}

export default App
