import { AnimatePresence, motion } from 'framer-motion'
import {
  User,
  Trash2,
  BookOpen,
  ChevronUp,
  Clapperboard,
  Disc3,
  Gamepad2,
  Loader2,
  Music4,
  Plus,
  Quote,
  Save,
  Search,
  Settings,
  LogOut,
  Star,
  Tv,
  X,
  AlertCircle,
} from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
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
import { CardSkeletonGrid } from './components/CommonplaceCard/CardSkeleton'
import { UserProfilePage } from './pages/UserProfilePage'
import { SettingsPage, type UserProfileState } from './pages/SettingsPage'
import { useMasonryLayout } from './hooks/useMasonryLayout'

const WARN_UNRATED_KEY = 'the-commonplace.warn-unrated'

function getWarnUnratedPreference(): boolean {
  const stored = localStorage.getItem(WARN_UNRATED_KEY)
  return stored === null ? true : stored !== 'false'
}

function setWarnUnratedPreference(val: boolean) {
  localStorage.setItem(WARN_UNRATED_KEY, String(val))
}

function getMatchingLyricIndexes(lyricsText: string, favoritePassageText: string): number[] {
  if (!lyricsText || !favoritePassageText) return []

  const lyricLines = lyricsText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const cleanedPassage = favoritePassageText
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')

  const passageLines = cleanedPassage
    .split(/\r?\n/)
    .map((line) => line.trim().toLowerCase())
    .filter(Boolean)

  if (passageLines.length === 0) return []

  const matched: number[] = []
  lyricLines.forEach((line, index) => {
    const normLine = line.toLowerCase()
    const isMatch = passageLines.some((pLine) => {
      if (pLine === normLine) return true
      if (pLine.length > 4 && normLine.length > 4) {
        return pLine.includes(normLine) || normLine.includes(pLine)
      }
      return false
    })
    if (isMatch) {
      matched.push(index)
    }
  })

  return matched
}

function isDraftDirty(current: EntryDraft, base: EntryDraft): boolean {
  return (
    current.type !== base.type ||
    current.title.trim() !== base.title.trim() ||
    current.creator.trim() !== base.creator.trim() ||
    current.rating !== base.rating ||
    current.favoritePassage.trim() !== base.favoritePassage.trim() ||
    current.reflection.trim() !== base.reflection.trim() ||
    current.coverTone !== base.coverTone ||
    current.enableDropCap !== base.enableDropCap
  )
}

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
  { id: 'album', label: 'Albums', Icon: Disc3 },
  { id: 'book', label: 'Books', Icon: BookOpen },
  { id: 'film', label: 'Films', Icon: Clapperboard },
  { id: 'game', label: 'Games', Icon: Gamepad2 },
  { id: 'song', label: 'Songs', Icon: Music4 },
  { id: 'tv', label: 'Shows', Icon: Tv },
]

const defaultCoverToneByType: Record<EntryType, CoverTone> = {
  album: 'gold',
  book: 'blue',
  film: 'ember',
  game: 'rose',
  song: 'violet',
  tv: 'sage',
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
  type: 'album',
  title: '',
  creator: '',
  provider: 'Manual',
  providerId: '',
  genre: '',
  rating: 0,
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

function AppContent() {
  const [entries, setEntries] = useState<Entry[]>(loadEntries)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<EntryType | 'all'>('all')
  const { expandedCardId, setExpandedCardId, toggleCardExpanded } = useCardExpansion()

  const [activeView, setActiveView] = useState<'feed' | 'profile' | 'settings'>('feed')
  const [profileCategoryFilter, setProfileCategoryFilter] = useState<string>('all')
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
  const [overlayEntry, setOverlayEntry] = useState<Entry | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [isLoggedOut, setIsLoggedOut] = useState(false)
  const gridRef = useRef<HTMLElement>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const userProfileName = userProfile.showFullName
    ? `${userProfile.firstName} ${userProfile.lastName}`.trim()
    : userProfile.firstName

  const filteredEntries = useMemo(() => {
    let byType = entries
    if (typeFilter !== 'all') {
      byType = entries.filter((entry) => entry.type === typeFilter)
    }

    if (!query.trim()) return byType

    const q = query.toLowerCase()
    return byType.filter(
      (entry) =>
        entry.title.toLowerCase().includes(q) ||
        entry.creator.toLowerCase().includes(q) ||
        entry.provider.toLowerCase().includes(q) ||
        (entry.genre && entry.genre.toLowerCase().includes(q)) ||
        entry.favoritePassage.toLowerCase().includes(q) ||
        entry.reflection.toLowerCase().includes(q) ||
        userProfileName.toLowerCase().includes(q)
    )
  }, [entries, query, typeFilter, userProfileName])

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
    localStorage.setItem(storageKey, JSON.stringify(nextEntries))
  }

  const handleLogout = () => {
    if (window.confirm(`Log out of ${userProfileName} session?`)) {
      setIsLoggedOut(true)
      setProfileMenuOpen(false)
    }
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
    return (
      <>
        <UserProfilePage
          onBack={() => setActiveView('feed')}
          entries={entries}
          savedEntryIds={savedEntryIds}
          likedEntryIds={likedEntryIds}
          disabledCommentEntryIds={disabledCommentEntryIds}
          onSelectEntry={(entry) => setOverlayEntry(entry)}
          onToggleLike={toggleLikeEntry}
          onToggleSave={toggleSaveEntry}
          onToggleCommentsDisabled={toggleCommentsDisabled}
          userProfile={userProfile}
          onNavigateToSettings={() => setActiveView('settings')}
          onDeleteEntry={(id) => promptDeleteEntry(id)}
          onEditEntry={(entry) => openComposer(entry)}
          categoryFilter={profileCategoryFilter}
          onCategoryFilterChange={setProfileCategoryFilter}
          isOwnProfile={true}
        />
        <CardOverlayModal
          entry={overlayEntry}
          onClose={() => setOverlayEntry(null)}
          isLiked={overlayEntry ? likedEntryIds.includes(overlayEntry.id) : false}
          isSaved={overlayEntry ? savedEntryIds.includes(overlayEntry.id) : false}
          onToggleLike={() => overlayEntry && toggleLikeEntry(overlayEntry.id)}
          onToggleSave={() => overlayEntry && toggleSaveEntry(overlayEntry.id)}
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
              onClose={closeComposer}
              onSave={handleSave}
              commentsDisabled={editingEntry ? disabledCommentEntryIds.includes(editingEntry.id) : false}
              onToggleCommentsDisabled={() => editingEntry && toggleCommentsDisabled(editingEntry.id)}
            />
          ) : null}
        </AnimatePresence>
      </>
    )
  }

  if (activeView === 'settings') {
    return (
      <SettingsPage
        onBack={() => setActiveView('feed')}
        onClearAllData={() => {
          setEntries([])
          localStorage.removeItem(storageKey)
          localStorage.removeItem('the-commonplace.likes')
          localStorage.removeItem('the-commonplace.saves')
        }}
        userProfile={userProfile}
        onSaveProfile={(updated) => setUserProfile(updated)}
      />
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
              <div className={`hdr-search-box ${searchOpen ? 'open' : ''}`}>
                <button
                  className="hdr-icon-btn"
                  type="button"
                  aria-label="Search"
                  onClick={() => setSearchOpen((v) => !v)}
                  title="Search entries and users"
                >
                  <Search aria-hidden="true" />
                </button>
                {searchOpen && (
                  <>
                    <input
                      type="text"
                      className="hdr-search-input"
                      value={query}
                      onChange={(e) => handleQueryChange(e.target.value)}
                      placeholder="Search title, user, author…"
                      aria-label="Search entries and users"
                      autoFocus
                    />
                    <button
                      type="button"
                      className="hdr-search-close"
                      title="Close search"
                      aria-label="Close search"
                      onClick={() => {
                        setQuery('')
                        setSearchOpen(false)
                      }}
                    >
                      <X aria-hidden="true" />
                    </button>
                  </>
                )}

                {/* Search Dropdown with Users */}
                {searchOpen && query.trim().length > 0 && (
                  <div className="search-results-dropdown">
                    <div className="search-dropdown-section">
                      <span className="search-dropdown-header">Matching Users</span>
                      {['jimboii', 'jim', 'user', 'collector', 'catalog'].some((term) =>
                        'jimboii'.includes(query.toLowerCase()) || term.includes(query.toLowerCase())
                      ) ? (
                        <button
                          type="button"
                          className="search-user-item"
                          onClick={() => {
                            setActiveView('profile')
                            setSearchOpen(false)
                          }}
                        >
                          <div className="search-user-left">
                            <div className="search-user-avatar">
                              <User aria-hidden="true" />
                            </div>
                            <div className="search-user-info">
                              <span className="search-user-name">
                                {userProfile.showFullName ? `${userProfile.firstName} ${userProfile.lastName}` : userProfile.firstName}
                              </span>
                              <span className="search-user-handle">@{userProfile.handle.replace(/^@/, '')} &bull; {entries.length} reviews</span>
                            </div>
                          </div>
                          <span className="search-user-action">View Profile</span>
                        </button>
                      ) : (
                        <div style={{ padding: '6px', fontSize: '12px', color: 'var(--secondary)' }}>
                          No users matching "{query}"
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

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
                    <button
                      type="button"
                      className="menu-header"
                      onClick={() => {
                        setActiveView('profile')
                        setProfileMenuOpen(false)
                      }}
                      title="View Profile"
                    >
                      <span className="menu-user-name">
                        {userProfile.showFullName ? `${userProfile.firstName} ${userProfile.lastName}` : userProfile.firstName}
                      </span>
                    </button>
                    <div className="menu-divider" />
                    <button
                      type="button"
                      className="menu-item"
                      onClick={() => {
                        setActiveView('profile')
                        setProfileMenuOpen(false)
                      }}
                    >
                      <User aria-hidden="true" />
                      <span>My Profile</span>
                    </button>
                    <button
                      type="button"
                      className="menu-item"
                      onClick={() => {
                        setActiveView('settings')
                        setProfileMenuOpen(false)
                      }}
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
                  onOpenProfile={() => setActiveView('profile')}
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
            onClose={closeComposer}
            onSave={handleSave}
            commentsDisabled={editingEntry ? disabledCommentEntryIds.includes(editingEntry.id) : false}
            onToggleCommentsDisabled={() => editingEntry && toggleCommentsDisabled(editingEntry.id)}
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

function TypeIconBar({
  value,
  onChange,
  disabled,
}: {
  value: EntryType
  onChange: (type: EntryType) => void
  disabled?: boolean
}) {
  return (
    <div className="type-icon-bar">
      {entryTypes.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className={`type-icon-btn ${value === id ? 'active' : ''}`}
          onClick={() => !disabled && onChange(id)}
          disabled={disabled}
          aria-label={label}
        >
          <Icon aria-hidden="true" style={{ width: 18, height: 18 }} />
          <span className="type-icon-tooltip">{label}</span>
        </button>
      ))}
    </div>
  )
}

function EntryComposer({
  entry,
  onClose,
  onSave,
  commentsDisabled = false,
  onToggleCommentsDisabled,
}: {
  entry: Entry | null
  onClose: () => void
  onSave: (draft: EntryDraft) => void
  commentsDisabled?: boolean
  onToggleCommentsDisabled?: () => void
}) {
  const initialDraft = entry
    ? {
        type: entry.type,
        title: entry.title,
        creator: entry.creator,
        provider: entry.provider,
        providerId: entry.providerId,
        genre: entry.genre,
        year: entry.year,
        rating: entry.rating,
        favoritePassage: entry.favoritePassage,
        reflection: entry.reflection,
        reflectionAlign: entry.reflectionAlign || 'left',
        passageAlign: entry.passageAlign || 'left',
        enableDropCap: entry.enableDropCap ?? false,
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
  >(entry ? 'idle' : 'idle') // on edit, we skip auto-fetch; set to 'loaded-skip' sentinel
  const isEditMode = Boolean(entry)
  const [lyrics, setLyrics] = useState('')
  const [showUnratedConfirm, setShowUnratedConfirm] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [dontShowAgain, setDontShowAgain] = useState(false)
  const [pendingDraft, setPendingDraft] = useState<EntryDraft | null>(null)
  const lyricsFetchId = useRef(0)
  const reflectionRef = useRef<HTMLDivElement>(null)
  const passageRef = useRef<HTMLDivElement>(null)
  const [activeTarget, setActiveTarget] = useState<'reflection' | 'favoritePassage'>('reflection')

  const activeRef = activeTarget === 'favoritePassage' ? passageRef : reflectionRef
  const activeValue = activeTarget === 'favoritePassage' ? draft.favoritePassage : draft.reflection
  const setActiveValue = (val: string) => setDraft((cur) => ({ ...cur, [activeTarget]: val }))

  const handleRequestClose = () => {
    if (isDraftDirty(draft, initialDraft)) {
      setShowDiscardConfirm(true)
    } else {
      onClose()
    }
  }

  const isMusicEntry = draft.type === 'song' || draft.type === 'album'
  const lyricLines = lyrics
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  useEffect(() => {
    if (draft.type !== 'song' || !draft.title || !draft.creator) return
    if (lyricsStatus !== 'idle') return

    const fetchId = ++lyricsFetchId.current
    setLyricsStatus('loading')
    const abortController = new AbortController()

    fetchLyrics(draft.creator, draft.title, abortController.signal)
      .then((fetched) => {
        if (lyricsFetchId.current !== fetchId) return
        if (fetched) {
          setLyrics(fetched)
          setLyricsStatus('ready')

          if (draft.favoritePassage) {
            const matched = getMatchingLyricIndexes(fetched, draft.favoritePassage)
            if (matched.length > 0) {
              setSelectedLyricIndexes(matched)
            }
          }
        } else {
          setLyricsStatus('not-found')
        }
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        if (lyricsFetchId.current === fetchId) setLyricsStatus('not-found')
      })

    return () => abortController.abort()
  }, [isEditMode, draft.type, draft.title, draft.creator, lyricsStatus, draft.favoritePassage])

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
          if (draft.favoritePassage) {
            const matched = getMatchingLyricIndexes(fetched, draft.favoritePassage)
            if (matched.length > 0) {
              setSelectedLyricIndexes(matched)
            }
          }
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

    const finalDraft: EntryDraft = {
      ...draft,
      title: draft.title.trim(),
      creator: draft.creator.trim(),
      provider: draft.provider.trim(),
      providerId: draft.providerId.trim(),
      favoritePassage: draft.favoritePassage.trim(),
      reflection: draft.reflection.trim(),
    }

    if (draft.rating === 0 && getWarnUnratedPreference()) {
      setPendingDraft(finalDraft)
      setShowUnratedConfirm(true)
      return
    }

    onSave(finalDraft)
  }

  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => { if (e.target === e.currentTarget) handleRequestClose() }}
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
            onClick={handleRequestClose}
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
                <TypeIconBar
                  value={draft.type}
                  onChange={changeType}
                  disabled={Boolean(entry)}
                />
              </label>

              {!entry && (
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
              )}
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
                <div className="passage-header">
                  <span>Favorite lyrics</span>
                </div>
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
                      <p>No lyrics found automatically for this track.</p>
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
                {entry && onToggleCommentsDisabled && (
                  <label className="dont-show-again-label" style={{ marginRight: 'auto', fontSize: '12px' }}>
                    <input
                      type="checkbox"
                      checked={commentsDisabled}
                      onChange={onToggleCommentsDisabled}
                    />
                    <span>Disable comments</span>
                  </label>
                )}
                <button className="ghost-btn" type="button" onClick={handleRequestClose}>
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

      {/* Confirmation modal when discarding unsaved changes */}
      <AnimatePresence>
        {showDiscardConfirm && (
          <div
            className="modal-backdrop"
            style={{ zIndex: 110 }}
            onClick={() => setShowDiscardConfirm(false)}
          >
            <motion.div
              className="settings-modal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="settings-header">
                <div className="settings-header-title">
                  <AlertCircle style={{ color: '#e57373' }} aria-hidden="true" />
                  <h2>Discard Unsaved Changes?</h2>
                </div>
              </div>
              <p style={{ color: 'var(--secondary)', lineHeight: 1.6, marginBottom: 20 }}>
                You have unsaved changes in this entry. Are you sure you want to discard them?
              </p>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => setShowDiscardConfirm(false)}
                >
                  Keep Editing
                </button>
                <button
                  type="button"
                  className="action-btn danger"
                  onClick={() => {
                    setShowDiscardConfirm(false)
                    onClose()
                  }}
                >
                  Discard Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation modal when publishing an unrated entry */}
      <AnimatePresence>
        {showUnratedConfirm && (
          <div
            className="modal-backdrop"
            style={{ zIndex: 100 }}
            onClick={() => setShowUnratedConfirm(false)}
          >
            <motion.div
              className="settings-modal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="settings-header">
                <div className="settings-header-title">
                  <AlertCircle style={{ color: '#f5b74c' }} aria-hidden="true" />
                  <h2>Publish Without Rating?</h2>
                </div>
              </div>
              <p style={{ color: 'var(--secondary)', lineHeight: 1.6, marginBottom: 16 }}>
                You have not assigned a star rating to this entry. Are you sure you want to publish it without a rating?
              </p>

              <label className="dont-show-again-label">
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                />
                <span>Don't show this warning again</span>
              </label>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => setShowUnratedConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => {
                    if (dontShowAgain) {
                      setWarnUnratedPreference(false)
                    }
                    setShowUnratedConfirm(false)
                    if (pendingDraft) {
                      onSave(pendingDraft)
                    }
                  }}
                >
                  Publish Anyway
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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
