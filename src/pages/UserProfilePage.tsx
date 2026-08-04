import React, { useState, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  User,
  Search,
  X,
  BookOpen,
  Disc3,
  Clapperboard,
  Gamepad2,
  Music4,
  Tv,
  Calendar,
  Star,
  Edit3,
  Layers,
  Bookmark,
  Users,
  Lock,
  UserCheck,
  UserPlus,
} from 'lucide-react'
import { Card, type CardEntry } from '../components/CommonplaceCard/Card'
import { useMasonryLayout } from '../hooks/useMasonryLayout'
import { CardSkeletonGrid } from '../components/CommonplaceCard/CardSkeleton'
import type { UserProfileState } from './SettingsPage'

// ─── Catalog mode ────────────────────────────────────────────────────────────
type CatalogMode = 'reviewed' | 'shelf'

interface UserProfilePageProps {
  onBack: () => void
  entries: CardEntry[]
  savedEntryIds?: string[]
  likedEntryIds?: string[]
  disabledCommentEntryIds?: string[]
  onSelectEntry?: (entry: CardEntry) => void
  onToggleLike?: (id: string) => void
  onToggleSave?: (id: string) => void
  onToggleCommentsDisabled?: (id: string) => void
  userProfile: UserProfileState
  onNavigateToSettings: () => void
  onDeleteEntry?: (id: string) => void
  onEditEntry?: (entry: CardEntry) => void
  categoryFilter: string
  onCategoryFilterChange: (id: string) => void
  isOwnProfile?: boolean
  onSelectUserProfile?: (handle: string) => void
  followedUserHandles?: string[]
  onToggleFollowUser?: (handle: string) => void
  currentUserProfile?: UserProfileState
  followRequestedHandles?: string[]
  onToggleFollowRequest?: (handle: string) => void
}

export const USER_DIRECTORY = [
  { id: 'jimboii', name: 'Jimmy Boy', handle: 'jimboii', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop', reviews: 14, isPrivate: false },
  { id: 'elena_r', name: 'Elena Rostova', handle: 'elena_r', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop', reviews: 34, isPrivate: false },
  { id: 'marcus_v', name: 'Marcus Vance', handle: 'marcus_v', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop', reviews: 18, isPrivate: false },
  { id: 'aria_s', name: 'Aria Sterling', handle: 'aria_s', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop', reviews: 12, isPrivate: true },
  { id: 'sophiac', name: 'Sophia Chen', handle: 'sophiac', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop', reviews: 27, isPrivate: false },
]

export const UserProfilePage: React.FC<UserProfilePageProps> = ({
  onBack,
  entries,
  savedEntryIds = [],
  likedEntryIds = [],
  disabledCommentEntryIds = [],
  onSelectEntry,
  onToggleLike,
  onToggleSave,
  onToggleCommentsDisabled,
  userProfile,
  onNavigateToSettings,
  onDeleteEntry,
  onEditEntry,
  categoryFilter,
  onCategoryFilterChange,
  isOwnProfile = true,
  onSelectUserProfile,
  followedUserHandles = [],
  onToggleFollowUser,
  currentUserProfile,
  followRequestedHandles = [],
  onToggleFollowRequest,
}) => {
  // ── External profile follow & private state ──────────────────────────────
  const isFollowingUser = followedUserHandles.includes(userProfile.handle)
  const isFollowRequested = followRequestedHandles.includes(userProfile.handle)
  const isPrivateProfile = Boolean(userProfile.isPrivate)
  const isLockedPrivate = !isOwnProfile && isPrivateProfile && !isFollowingUser

  // ── Catalog mode ────────────────────────────────────────────────────────────
  const [catalogMode, setCatalogMode] = useState<CatalogMode>('reviewed')

  // ── Reviewed catalog state ──────────────────────────────────────────────────
  const [profileSearchQuery, setProfileSearchQuery] = useState('')
  const profileCategoryFilter = categoryFilter
  const setProfileCategoryFilter = onCategoryFilterChange
  const [expandedCardId, setExpandedCardId] = useState<string>('')
  const [isFilterSwitching, setIsFilterSwitching] = useState(false)

  // ── Shelf state (independent from reviewed) ─────────────────────────────────
  const [shelfSearchQuery, setShelfSearchQuery] = useState('')
  const [shelfCategoryFilter, setShelfCategoryFilter] = useState('all')
  const [shelfExpandedCardId, setShelfExpandedCardId] = useState<string>('')
  const [isShelfSwitching, setIsShelfSwitching] = useState(false)

  // ── Bookmark press animation ────────────────────────────────────────────────
  const [bookmarkPressing, setBookmarkPressing] = useState(false)

  // ── Follow modal ────────────────────────────────────────────────────────────
  const [activeFollowModal, setActiveFollowModal] = useState<'followers' | 'following' | null>(null)
  const [followSearch, setFollowSearch] = useState('')

  const profileGridRef = useRef<HTMLElement>(null)

  // ── Dynamic Followers & Following lists ─────────────────────────────────────
  const dynamicFollowersList = useMemo(() => {
    const cleanHandle = userProfile.handle.replace(/^@/, '')
    if (cleanHandle === 'jimboii') {
      return USER_DIRECTORY.filter((u) => u.handle !== 'jimboii')
    }
    return USER_DIRECTORY.filter((u) => u.handle !== cleanHandle && u.handle !== 'aria_s')
  }, [userProfile.handle])

  const dynamicFollowingList = useMemo(() => {
    const cleanHandle = userProfile.handle.replace(/^@/, '')
    if (cleanHandle === 'jimboii') {
      return USER_DIRECTORY.filter((u) => followedUserHandles.includes(u.handle))
    }
    return USER_DIRECTORY.filter((u) => u.handle !== cleanHandle && u.handle !== 'aria_s')
  }, [userProfile.handle, followedUserHandles])

  const activeFollowList = activeFollowModal === 'followers' ? dynamicFollowersList : dynamicFollowingList

  const filteredFollowList = useMemo(() => {
    if (!followSearch.trim()) return activeFollowList
    const q = followSearch.toLowerCase()
    return activeFollowList.filter(
      (p) => p.name.toLowerCase().includes(q) || p.handle.toLowerCase().includes(q)
    )
  }, [activeFollowList, followSearch])

  // ── Counts (switches dynamically based on catalogMode) ───────────────────────
  const activeDataset = useMemo(() => {
    return catalogMode === 'reviewed'
      ? entries
      : entries.filter((e) => savedEntryIds.includes(e.id))
  }, [catalogMode, entries, savedEntryIds])

  const booksCount = activeDataset.filter((e) => e.type === 'book').length
  const albumsCount = activeDataset.filter((e) => e.type === 'album').length
  const filmsCount = activeDataset.filter((e) => e.type === 'film').length
  const songsCount = activeDataset.filter((e) => e.type === 'song').length
  const gamesCount = activeDataset.filter((e) => e.type === 'game').length
  const showsCount = activeDataset.filter((e) => e.type === 'tv').length
  const savedCount = entries.filter((e) => savedEntryIds.includes(e.id)).length

  const avgRating =
    entries.length > 0
      ? (entries.reduce((acc, curr) => acc + curr.rating, 0) / entries.length).toFixed(1)
      : '0.0'

  // ── Category change handlers ────────────────────────────────────────────────
  const handleCategoryChange = (id: string) => {
    if (catalogMode === 'reviewed') {
      if (id === profileCategoryFilter) return
      setIsFilterSwitching(true)
      setProfileCategoryFilter(id)
    } else {
      if (id === shelfCategoryFilter) return
      setIsShelfSwitching(true)
      setShelfCategoryFilter(id)
    }
  }

  // ── Search change handlers ──────────────────────────────────────────────────
  const handleSearchChange = (val: string) => {
    if (catalogMode === 'reviewed') {
      setIsFilterSwitching(true)
      setProfileSearchQuery(val)
    } else {
      setIsShelfSwitching(true)
      setShelfSearchQuery(val)
    }
  }

  const currentSearchQuery = catalogMode === 'reviewed' ? profileSearchQuery : shelfSearchQuery

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
    let result = entries.filter((e) => savedEntryIds.includes(e.id))
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
  }, [entries, savedEntryIds, shelfSearchQuery, shelfCategoryFilter])

  // Active dataset for rendering
  const activeEntries = catalogMode === 'reviewed' ? filteredProfileEntries : filteredShelfEntries
  const activeExpandedCardId = catalogMode === 'reviewed' ? expandedCardId : shelfExpandedCardId
  const activeIsFilterSwitching = catalogMode === 'reviewed' ? isFilterSwitching : isShelfSwitching
  const activeFilter = catalogMode === 'reviewed' ? profileCategoryFilter : shelfCategoryFilter

  // ── Masonry layout ─────────────────────────────────────────────────────────
  const activeMasonryLayout = useMasonryLayout(
    profileGridRef,
    activeEntries.length,
    activeExpandedCardId,
    `${catalogMode}-${activeFilter}-${currentSearchQuery}`,
  )

  // ── Filter switching cooldown ───────────────────────────────────────────────
  useEffect(() => {
    if (activeMasonryLayout) {
      const timer = setTimeout(() => {
        setIsFilterSwitching(false)
        setIsShelfSwitching(false)
      }, 140)
      return () => clearTimeout(timer)
    }
  }, [activeMasonryLayout, activeFilter, currentSearchQuery, catalogMode])

  // ── Bookmark toggle ─────────────────────────────────────────────────────────
  const handleBookmarkToggle = () => {
    setBookmarkPressing(true)
    setTimeout(() => setBookmarkPressing(false), 120)
    setCatalogMode((prev) => (prev === 'reviewed' ? 'shelf' : 'reviewed'))
    // Clear shelf switching state so grid animates in cleanly
    setIsShelfSwitching(false)
  }

  // ── Stats ───────────────────────────────────────────────────────────────────
  const stats = [
    { id: 'all', label: 'All', count: activeDataset.length, Icon: Layers },
    { id: 'album', label: 'Albums', count: albumsCount, Icon: Disc3 },
    { id: 'book', label: 'Books', count: booksCount, Icon: BookOpen },
    { id: 'film', label: 'Films', count: filmsCount, Icon: Clapperboard },
    { id: 'game', label: 'Games', count: gamesCount, Icon: Gamepad2 },
    { id: 'song', label: 'Songs', Icon: Music4, count: songsCount },
    { id: 'tv', label: 'Shows', count: showsCount, Icon: Tv },
  ]

  const displayName = userProfile.showFullName
    ? `${userProfile.firstName} ${userProfile.lastName}`.trim()
    : userProfile.firstName
  const handleFormatted = `@${userProfile.handle.replace(/^@/, '')}`
  // ── Type icon helper ────────────────────────────────────────────────────────
  const getTypeMeta = (type: string) => {
    switch (type) {
      case 'album': return { Icon: Disc3, label: 'Albums' }
      case 'book': return { Icon: BookOpen, label: 'Books' }
      case 'film': return { Icon: Clapperboard, label: 'Films' }
      case 'game': return { Icon: Gamepad2, label: 'Games' }
      case 'song': return { Icon: Music4, label: 'Songs' }
      case 'tv': return { Icon: Tv, label: 'Shows' }
      default: return { Icon: BookOpen, label: 'Books' }
    }
  }

  return (
    <motion.div
      className="page-wrapper profile-page-wrapper"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      {/* Top Floating Circle Back Button */}
      <button
        type="button"
        className="profile-back-circle"
        onClick={onBack}
        title="Back to Feed"
        aria-label="Back to Feed"
      >
        <ArrowLeft aria-hidden="true" />
      </button>

      <div className="profile-page-container">
        {/* Banner Hero */}
        <div
          className="profile-page-banner"
          style={{
            backgroundImage: userProfile.coverUrl
              ? `linear-gradient(135deg, rgba(200, 162, 106, 0.2), rgba(15, 13, 10, 0.6)), url('${userProfile.coverUrl}')`
              : undefined,
          }}
        >
          <div className="profile-page-avatar">
            {userProfile.avatarUrl ? (
              <img src={userProfile.avatarUrl} alt={displayName} className="profile-avatar-img" />
            ) : (
              <User aria-hidden="true" />
            )}
          </div>

          {isOwnProfile ? (
            <button
              type="button"
              className="edit-profile-btn"
              onClick={onNavigateToSettings}
              title="Edit Profile Settings"
            >
              <Edit3 aria-hidden="true" />
              <span>Edit Profile</span>
            </button>
          ) : isLockedPrivate ? (
            <button
              type="button"
              className={`edit-profile-btn ${isFollowRequested ? 'is-following' : ''}`}
              onClick={() => onToggleFollowRequest?.(userProfile.handle)}
              style={{
                background: isFollowRequested ? 'rgba(255,255,255,0.08)' : 'var(--accent)',
                color: isFollowRequested ? 'var(--text-strong)' : '#0e0b06',
                borderColor: isFollowRequested ? 'rgba(255,255,255,0.15)' : 'var(--accent)',
              }}
            >
              {isFollowRequested ? <UserCheck size={14} /> : <UserPlus size={14} />}
              <span>{isFollowRequested ? 'Requested' : 'Request to Follow'}</span>
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
          )}
        </div>

        {/* Identity Details */}
        <div className="profile-page-header">
          <div className="profile-page-names">
            <h1 className="profile-page-name">{displayName}</h1>
            <span className="profile-page-handle">{handleFormatted}</span>
          </div>

          {userProfile.bio && (
            <p className="profile-page-bio">{userProfile.bio}</p>
          )}

          {/* Inline Pill Container Badges */}
          <div className="profile-pill-container">
            <span className="profile-pill-badge">
              <Calendar aria-hidden="true" />
              <span>Member since July 2026</span>
            </span>
            <span className="profile-pill-badge rating">
              <Star aria-hidden="true" />
              <span>{avgRating} Avg Rating</span>
            </span>

            {/* Followers & Following Badges */}
            <button
              type="button"
              className="profile-pill-badge"
              style={{ cursor: 'pointer' }}
              onClick={() => { setActiveFollowModal('followers'); setFollowSearch('') }}
            >
              <Users aria-hidden="true" />
              <span>{dynamicFollowersList.length} Followers</span>
            </button>
            <button
              type="button"
              className="profile-pill-badge"
              style={{ cursor: 'pointer' }}
              onClick={() => { setActiveFollowModal('following'); setFollowSearch('') }}
            >
              <Users aria-hidden="true" />
              <span>{dynamicFollowingList.length} Following</span>
            </button>
          </div>
        </div>

        {/* Interactive Stats Grid (Clickable Filter Buttons) — Hidden on private profiles */}
        {!isLockedPrivate && (
          <div className="profile-stats-grid">
            {stats.map(({ id, label, count, Icon }) => {
              const isActive = activeFilter === id
              return (
                <button
                  key={id}
                  type="button"
                  className={`stat-card stat-btn ${isActive ? 'active' : ''}`}
                  onClick={() => handleCategoryChange(id)}
                >
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

        <div className="profile-section-divider" />

        {/* ── Catalog Section (locked if private & not following) ─────────────── */}
        {isLockedPrivate ? (
          <div className="profile-private-locked">
            <div className="private-locked-icon">
              <Lock size={32} />
            </div>
            <h3 className="private-locked-title">This Profile is Private</h3>
            <p className="private-locked-subtitle">
              Follow @{userProfile.handle.replace(/^@/, '')} to see their reviewed catalog, shelf entries, and reflections.
            </p>
            <button
              type="button"
              className="edit-profile-btn"
              style={{
                position: 'static',
                background: isFollowRequested ? 'rgba(255,255,255,0.08)' : 'var(--accent)',
                color: isFollowRequested ? 'var(--text-strong)' : '#0e0b06',
                borderColor: isFollowRequested ? 'rgba(255,255,255,0.15)' : 'var(--accent)',
                padding: '10px 24px',
                fontSize: '13px',
              }}
              onClick={() => onToggleFollowRequest?.(userProfile.handle)}
            >
              {isFollowRequested ? (
                <>
                  <UserCheck size={14} />
                  <span>Requested</span>
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
            <div className="profile-catalog-header">

              {/* Title area — animated crossfade between modes */}
              <AnimatePresence mode="wait" initial={false}>
                {catalogMode === 'reviewed' ? (
                  <motion.div
                    key="header-reviewed"
                    className="catalog-header-title-group"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                  >
                    <h2 className="profile-catalog-title">
                      Reviewed Catalog ({filteredProfileEntries.length})
                    </h2>
                  </motion.div>
                ) : (
                  <motion.div
                    key="header-shelf"
                    className="catalog-header-title-group"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                  >
                    <h2 className="profile-catalog-title">
                      My Shelf ({savedCount > 0 ? filteredShelfEntries.length : 0})
                    </h2>
                    <span className="catalog-privacy-note">
                      Saved entries are only visible to you
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="profile-catalog-actions">
                {/* Bookmark toggle — own profile only */}
                {isOwnProfile && (
                  <button
                    type="button"
                    className={`profile-saved-icon-btn ${catalogMode === 'shelf' ? 'active' : ''} ${bookmarkPressing ? 'is-pressing' : ''}`}
                    onClick={handleBookmarkToggle}
                    title={catalogMode === 'shelf' ? 'Return to Reviewed Catalog' : 'Open Saved Shelf'}
                    aria-label="Open Saved Shelf"
                  >
                    <Bookmark
                      size={16}
                      fill={catalogMode === 'shelf' ? 'currentColor' : 'none'}
                      aria-hidden="true"
                    />
                    {savedCount > 0 && (
                      <span className="profile-saved-badge">{savedCount}</span>
                    )}
                  </button>
                )}

                {/* Search box — placeholder swaps by mode */}
                <div className="profile-search-box">
                  <Search aria-hidden="true" className="profile-search-icon" />
                  <input
                    type="text"
                    className="profile-search-input"
                    value={currentSearchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder={catalogMode === 'reviewed' ? 'Search catalog…' : 'Search shelf…'}
                    aria-label={catalogMode === 'reviewed' ? 'Search catalog' : 'Search shelf'}
                  />
                  {currentSearchQuery && (
                    <button
                      type="button"
                      className="profile-search-clear"
                      onClick={() => handleSearchChange('')}
                      aria-label="Clear search"
                    >
                      <X aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ── Card Grid — smooth masonry calculation & opacity fade ────────── */}
            <div key={catalogMode}>
              {/* Skeleton */}
              {(activeIsFilterSwitching || !activeMasonryLayout) && activeEntries.length > 0 ? (
                <CardSkeletonGrid count={activeEntries.length > 6 ? 6 : Math.max(2, activeEntries.length)} />
              ) : null}

              {/* Empty states */}
              {activeEntries.length === 0 && catalogMode === 'reviewed' && (
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

              {activeEntries.length === 0 && catalogMode === 'shelf' && (
                <div className="profile-empty shelf-empty">
                  <BookOpen size={32} opacity={0.5} aria-hidden="true" />
                  <h3>Your shelf is empty.</h3>
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
                        setIsFilterSwitching(true)
                        setIsShelfSwitching(true)
                        setCatalogMode('reviewed')
                      }}
                    >
                      Explore Catalog
                    </button>
                  )}
                </div>
              )}

              {/* Cards masonry grid */}
              {activeEntries.length > 0 && (
                <section
                  key={`${catalogMode}-cards`}
                  className="card-grid profile-masonry-grid"
                  ref={profileGridRef as React.RefObject<HTMLElement>}
                  style={{
                    position: 'relative',
                    height: activeMasonryLayout ? activeMasonryLayout.height : 'auto',
                    minHeight: 320,
                    opacity: (activeMasonryLayout && !activeIsFilterSwitching) ? 1 : 0,
                    transition: 'opacity 220ms ease-out',
                  }}
                >
                  {activeEntries.map((entry) => {
                    const pos = activeMasonryLayout?.positions.get(entry.id)
                    const { Icon, label } = getTypeMeta(entry.type)

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
                          transition: 'transform 320ms cubic-bezier(0.2, 0, 0, 1)',
                          willChange: 'transform',
                        } : { width: '100%', marginBottom: 14 }}
                      >
                        <Card
                          entry={entry}
                          expanded={activeExpandedCardId === entry.id}
                          onDelete={() => onDeleteEntry?.(entry.id)}
                          onEdit={() => onEditEntry?.(entry)}
                          onToggle={() => {
                            if (catalogMode === 'reviewed') {
                              setExpandedCardId(expandedCardId === entry.id ? '' : entry.id)
                            } else {
                              setShelfExpandedCardId(shelfExpandedCardId === entry.id ? '' : entry.id)
                            }
                          }}
                          onExpandOverlay={() => onSelectEntry?.(entry)}
                          onOpenProfile={() => {}}
                          typeIcon={Icon}
                          typeLabel={label}
                          isLiked={likedEntryIds.includes(entry.id)}
                          isSaved={savedEntryIds.includes(entry.id)}
                          onToggleLike={() => onToggleLike?.(entry.id)}
                          onToggleSave={() => onToggleSave?.(entry.id)}
                          commentsDisabled={disabledCommentEntryIds.includes(entry.id)}
                          onToggleCommentsDisabled={() => onToggleCommentsDisabled?.(entry.id)}
                        />
                      </div>
                    )
                  })}
                </section>
              )}
            </div>
          </section>
        )}
      </div>

      {/* ── Followers / Following Modal ── */}
      <AnimatePresence>
        {activeFollowModal && (
          <div className="modal-backdrop" onClick={() => setActiveFollowModal(null)}>
            <motion.div
              className="follow-modal"
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header with tab switcher */}
              <div className="follow-modal-header">
                <div className="follow-modal-tabs">
                  <button
                    type="button"
                    className={`follow-modal-tab ${activeFollowModal === 'followers' ? 'active' : ''}`}
                    onClick={() => { setActiveFollowModal('followers'); setFollowSearch('') }}
                  >
                    Followers
                    <span className="follow-tab-count">{dynamicFollowersList.length}</span>
                  </button>
                  <button
                    type="button"
                    className={`follow-modal-tab ${activeFollowModal === 'following' ? 'active' : ''}`}
                    onClick={() => { setActiveFollowModal('following'); setFollowSearch('') }}
                  >
                    Following
                    <span className="follow-tab-count">{dynamicFollowingList.length}</span>
                  </button>
                </div>
                <button
                  type="button"
                  className="follow-modal-close"
                  onClick={() => setActiveFollowModal(null)}
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Search within follow list */}
              <div className="follow-modal-search">
                <Search size={14} />
                <input
                  type="text"
                  placeholder={`Search ${activeFollowModal}…`}
                  value={followSearch}
                  onChange={(e) => setFollowSearch(e.target.value)}
                  className="follow-search-input"
                  autoFocus
                />
                {followSearch && (
                  <button type="button" onClick={() => setFollowSearch('')} className="follow-search-clear">
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* List */}
              {!userProfile.showFollowLists && !isOwnProfile ? (
                <div className="follow-modal-locked">
                  <Lock size={24} opacity={0.5} />
                  <p>Followers and Following lists are hidden by this user.</p>
                </div>
              ) : (
                <div className="follow-modal-list">
                  {filteredFollowList.length === 0 ? (
                    <div className="follow-modal-empty">
                      <p>No results for "{followSearch}"</p>
                    </div>
                  ) : (
                    filteredFollowList.map((person) => (
                      <div
                        key={person.id}
                        className="follow-person-row"
                        style={{ cursor: onSelectUserProfile ? 'pointer' : 'default' }}
                        onClick={() => {
                          if (onSelectUserProfile) {
                            onSelectUserProfile(person.handle)
                            setActiveFollowModal(null)
                          }
                        }}
                      >
                        <div className="follow-person-avatar-wrapper">
                          <img
                            src={person.avatar}
                            alt={person.name}
                            className="follow-person-avatar-img"
                          />
                        </div>
                        <div className="follow-person-info">
                          <span className="follow-person-name">{person.name}</span>
                          <span className="follow-person-meta">
                            @{person.handle}
                            <span className="follow-person-dot">·</span>
                            {person.reviews} reviews
                          </span>
                        </div>
                        <div className="follow-person-actions">
                          {(() => {
                            const isPersonFollowing = followedUserHandles.includes(person.handle)
                            const isPersonRequested = followRequestedHandles.includes(person.handle)
                            const isCurrentUser = person.handle === (currentUserProfile?.handle || 'jimboii')

                            if (isCurrentUser) {
                              return <span className="follow-you-badge">You</span>
                            }
                            if (isPersonFollowing) {
                              return (
                                <button
                                  type="button"
                                  className="follow-person-btn follow-btn-primary is-following"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onToggleFollowUser?.(person.handle)
                                  }}
                                  title="Click to unfollow"
                                >
                                  <UserCheck size={13} />
                                  <span>Following</span>
                                </button>
                              )
                            }
                            if (isPersonRequested) {
                              return (
                                <button
                                  type="button"
                                  className="follow-person-btn follow-btn-secondary"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onToggleFollowRequest?.(person.handle)
                                  }}
                                  title="Click to cancel request"
                                >
                                  <UserCheck size={13} />
                                  <span>Requested</span>
                                </button>
                              )
                            }
                            if (person.isPrivate) {
                              return (
                                <button
                                  type="button"
                                  className="follow-person-btn follow-btn-primary"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onToggleFollowRequest?.(person.handle)
                                  }}
                                >
                                  <UserPlus size={13} />
                                  <span>Request</span>
                                </button>
                              )
                            }
                            return (
                              <button
                                type="button"
                                className="follow-person-btn follow-btn-primary"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onToggleFollowUser?.(person.handle)
                                }}
                              >
                                <UserPlus size={13} />
                                <span>Follow</span>
                              </button>
                            )
                          })()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
