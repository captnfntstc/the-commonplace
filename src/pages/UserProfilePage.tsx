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
  MessageCircle,
} from 'lucide-react'
import { Card, type CardEntry } from '../components/CommonplaceCard/Card'
import { useMasonryLayout } from '../hooks/useMasonryLayout'
import { CardSkeletonGrid } from '../components/CommonplaceCard/CardSkeleton'
import type { UserProfileState } from './SettingsPage'

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
}

const SAMPLE_FOLLOWERS = [
  { id: 'f1', name: 'Elena Rostova', handle: '@elena_r', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop', reviews: 34, mutuals: 2 },
  { id: 'f2', name: 'Marcus Vance', handle: '@marcus_v', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop', reviews: 18, mutuals: 1 },
  { id: 'f3', name: 'Sophia Chen', handle: '@sophiac', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop', reviews: 57, mutuals: 3 },
]

const SAMPLE_FOLLOWING = [
  { id: 'g1', name: 'Julian Thorne', handle: '@jthorne', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop', reviews: 21, mutuals: 0 },
  { id: 'g2', name: 'Clara Oswald', handle: '@clara_o', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop', reviews: 43, mutuals: 2 },
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
}) => {
  const [profileSearchQuery, setProfileSearchQuery] = useState('')
  const profileCategoryFilter = categoryFilter
  const setProfileCategoryFilter = onCategoryFilterChange
  const [expandedCardId, setExpandedCardId] = useState<string>('')
  const [isFilterSwitching, setIsFilterSwitching] = useState(false)
  const [activeFollowModal, setActiveFollowModal] = useState<'followers' | 'following' | null>(null)
  const [savedPanelOpen, setSavedPanelOpen] = useState(false)
  const [savedPanelFilter, setSavedPanelFilter] = useState('all')
  const [followSearch, setFollowSearch] = useState('')
  const profileGridRef = useRef<HTMLElement>(null)

  const booksCount = entries.filter((e) => e.type === 'book').length
  const albumsCount = entries.filter((e) => e.type === 'album').length
  const filmsCount = entries.filter((e) => e.type === 'film').length
  const songsCount = entries.filter((e) => e.type === 'song').length
  const gamesCount = entries.filter((e) => e.type === 'game').length
  const showsCount = entries.filter((e) => e.type === 'tv').length
  const savedCount = entries.filter((e) => savedEntryIds.includes(e.id)).length

  const avgRating =
    entries.length > 0
      ? (entries.reduce((acc, curr) => acc + curr.rating, 0) / entries.length).toFixed(1)
      : '0.0'

  const handleCategoryChange = (id: string) => {
    if (id === profileCategoryFilter) return
    setIsFilterSwitching(true)
    setProfileCategoryFilter(id)
  }

  const handleSearchChange = (val: string) => {
    setIsFilterSwitching(true)
    setProfileSearchQuery(val)
  }

  const filteredProfileEntries = useMemo(() => {
    let result = entries
    if (profileCategoryFilter !== 'all') {
      result = result.filter((e) => e.type === profileCategoryFilter)
    }

    if (!profileSearchQuery.trim()) return result

    const q = profileSearchQuery.toLowerCase()
    return result.filter(
      (entry) =>
        entry.title.toLowerCase().includes(q) ||
        entry.creator.toLowerCase().includes(q) ||
        entry.provider.toLowerCase().includes(q) ||
        (entry.genre && entry.genre.toLowerCase().includes(q)) ||
        entry.favoritePassage.toLowerCase().includes(q) ||
        entry.reflection.toLowerCase().includes(q),
    )
  }, [entries, savedEntryIds, profileSearchQuery, profileCategoryFilter])

  // Saved entries for the saved panel
  const savedEntries = useMemo(() => {
    let result = entries.filter((e) => savedEntryIds.includes(e.id))
    if (savedPanelFilter !== 'all') {
      result = result.filter((e) => e.type === savedPanelFilter)
    }
    return result
  }, [entries, savedEntryIds, savedPanelFilter])

  const masonryLayout = useMasonryLayout(
    profileGridRef,
    filteredProfileEntries.length,
    expandedCardId,
    profileCategoryFilter,
  )

  useEffect(() => {
    if (masonryLayout) {
      const timer = setTimeout(() => setIsFilterSwitching(false), 140)
      return () => clearTimeout(timer)
    }
  }, [masonryLayout, profileCategoryFilter, profileSearchQuery])

  // Stats — no Saved button; it moved to the search bar area
  const stats = [
    { id: 'all', label: 'All', count: entries.length, Icon: Layers },
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
  const canViewFollowLists = userProfile.showFollowLists ?? true

  const currentFollowList = activeFollowModal === 'followers' ? SAMPLE_FOLLOWERS : SAMPLE_FOLLOWING
  const filteredFollowList = followSearch.trim()
    ? currentFollowList.filter(
        (p) =>
          p.name.toLowerCase().includes(followSearch.toLowerCase()) ||
          p.handle.toLowerCase().includes(followSearch.toLowerCase()),
      )
    : currentFollowList

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

          <button
            type="button"
            className="edit-profile-btn"
            onClick={onNavigateToSettings}
            title="Edit Profile Settings"
          >
            <Edit3 aria-hidden="true" />
            <span>Edit Profile</span>
          </button>
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
              <span>142 Followers</span>
            </button>
            <button
              type="button"
              className="profile-pill-badge"
              style={{ cursor: 'pointer' }}
              onClick={() => { setActiveFollowModal('following'); setFollowSearch('') }}
            >
              <Users aria-hidden="true" />
              <span>89 Following</span>
            </button>
          </div>
        </div>

        {/* Interactive Stats Grid (Clickable Filter Buttons) */}
        <div className="profile-stats-grid">
          {stats.map(({ id, label, count, Icon }) => {
            const isActive = profileCategoryFilter === id
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

        <div className="profile-section-divider" />

        {/* Catalog Section */}
        <section className="profile-catalog-section">
          <div className="profile-catalog-header">
            <h2 className="profile-catalog-title">
              Reviewed Catalog ({filteredProfileEntries.length})
            </h2>

            <div className="profile-catalog-actions">
              {/* Saved bookmark icon — opens saved panel (own profile only) */}
              {isOwnProfile && (
                <button
                  type="button"
                  className={`profile-saved-icon-btn ${savedPanelOpen ? 'active' : ''}`}
                  onClick={() => setSavedPanelOpen((v) => !v)}
                  title="View saved entries (only visible to you)"
                  aria-label="Saved entries"
                >
                  <Bookmark size={16} fill={savedPanelOpen ? 'currentColor' : 'none'} />
                  {savedCount > 0 && <span className="profile-saved-badge">{savedCount}</span>}
                </button>
              )}

              {/* Compact Search Box */}
              <div className="profile-search-box">
                <Search aria-hidden="true" className="profile-search-icon" />
                <input
                  type="text"
                  className="profile-search-input"
                  value={profileSearchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search profile"
                  aria-label="Search profile"
                />
                {profileSearchQuery && (
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

          {/* Saved Panel */}
          <AnimatePresence>
            {savedPanelOpen && (
              <motion.div
                className="saved-panel"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                <div className="saved-panel-header">
                  <div className="saved-panel-title">
                    <Bookmark size={14} />
                    <span>Saved Entries</span>
                  </div>
                  <p className="saved-panel-note">
                    Saved entries are only visible to you.
                  </p>
                  <button
                    type="button"
                    className="saved-panel-close"
                    onClick={() => setSavedPanelOpen(false)}
                    aria-label="Close saved panel"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Saved type filters */}
                <div className="saved-panel-filters">
                  {['all', 'book', 'album', 'song', 'film', 'game', 'tv'].map((f) => (
                    <button
                      key={f}
                      type="button"
                      className={`saved-filter-pill ${savedPanelFilter === f ? 'active' : ''}`}
                      onClick={() => setSavedPanelFilter(f)}
                    >
                      {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1) + 's'}
                    </button>
                  ))}
                </div>

                {savedEntries.length === 0 ? (
                  <div className="saved-panel-empty">
                    <Bookmark size={22} opacity={0.4} />
                    <p>No saved entries in this category.</p>
                  </div>
                ) : (
                  <div className="saved-panel-list">
                    {savedEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="saved-panel-item"
                        onClick={() => onSelectEntry?.(entry)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && onSelectEntry?.(entry)}
                      >
                        {entry.coverUrl ? (
                          <img src={entry.coverUrl} alt={entry.title} className="saved-item-cover" />
                        ) : (
                          <div className="saved-item-cover-fallback">
                            <BookOpen size={14} />
                          </div>
                        )}
                        <div className="saved-item-info">
                          <span className="saved-item-title">{entry.title}</span>
                          <span className="saved-item-creator">{entry.creator}</span>
                        </div>
                        <button
                          type="button"
                          className="saved-item-unsave"
                          onClick={(e) => { e.stopPropagation(); onToggleSave?.(entry.id) }}
                          title="Unsave"
                          aria-label="Remove from saved"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Skeleton Loading Grid with Fade In Animation */}
          <AnimatePresence mode="wait">
            {(isFilterSwitching || !masonryLayout) && filteredProfileEntries.length > 0 ? (
              <motion.div
                key="profile-skeleton"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <CardSkeletonGrid count={filteredProfileEntries.length > 6 ? 6 : Math.max(2, filteredProfileEntries.length)} />
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Review Cards Grid */}
          {filteredProfileEntries.length === 0 ? (
            <div className="profile-empty">
              <BookOpen aria-hidden="true" />
              <h3>No matching reviews found</h3>
              <p>
                {profileSearchQuery
                  ? `No reviews match "${profileSearchQuery}" in ${displayName}'s profile.`
                  : 'No entries cataloged in this category.'}
              </p>
            </div>
          ) : (
            <motion.section
              key="profile-cards"
              className="card-grid profile-masonry-grid"
              ref={profileGridRef as React.RefObject<HTMLElement>}
              initial={{ opacity: 0 }}
              animate={{ opacity: (masonryLayout && !isFilterSwitching) ? 1 : 0 }}
              transition={{ duration: 0.28 }}
              style={{
                position: 'relative',
                height: masonryLayout ? masonryLayout.height : 'auto',
                minHeight: 320,
              }}
            >
              {filteredProfileEntries.map((entry) => {
                const pos = masonryLayout?.positions.get(entry.id)
                const getMeta = () => {
                  switch (entry.type) {
                    case 'album': return { Icon: Disc3, label: 'Albums' }
                    case 'book': return { Icon: BookOpen, label: 'Books' }
                    case 'film': return { Icon: Clapperboard, label: 'Films' }
                    case 'game': return { Icon: Gamepad2, label: 'Games' }
                    case 'song': return { Icon: Music4, label: 'Songs' }
                    case 'tv': return { Icon: Tv, label: 'Shows' }
                    default: return { Icon: BookOpen, label: 'Books' }
                  }
                }
                const { Icon, label } = getMeta()

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
                      expanded={expandedCardId === entry.id}
                      onDelete={() => onDeleteEntry?.(entry.id)}
                      onEdit={() => onEditEntry?.(entry)}
                      onToggle={() =>
                        setExpandedCardId(expandedCardId === entry.id ? '' : entry.id)
                      }
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
            </motion.section>
          )}
        </section>
      </div>

      {/* ── Followers / Following Modal — redesigned ── */}
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
                    <span className="follow-tab-count">142</span>
                  </button>
                  <button
                    type="button"
                    className={`follow-modal-tab ${activeFollowModal === 'following' ? 'active' : ''}`}
                    onClick={() => { setActiveFollowModal('following'); setFollowSearch('') }}
                  >
                    Following
                    <span className="follow-tab-count">89</span>
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
              {!canViewFollowLists && !isOwnProfile ? (
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
                      <div key={person.id} className="follow-person-row">
                        <img
                          src={person.avatar}
                          alt={person.name}
                          className="follow-person-avatar"
                        />
                        <div className="follow-person-info">
                          <span className="follow-person-name">{person.name}</span>
                          <span className="follow-person-meta">
                            {person.handle}
                            <span className="follow-person-dot">·</span>
                            {person.reviews} reviews
                            {person.mutuals > 0 && (
                              <>
                                <span className="follow-person-dot">·</span>
                                <span className="follow-mutual">{person.mutuals} mutual</span>
                              </>
                            )}
                          </span>
                        </div>
                        <div className="follow-person-actions">
                          <button type="button" className="follow-person-btn follow-btn-secondary">
                            <MessageCircle size={13} />
                          </button>
                          {activeFollowModal === 'followers' ? (
                            <button type="button" className="follow-person-btn follow-btn-primary">
                              <UserCheck size={13} />
                              <span>Following</span>
                            </button>
                          ) : (
                            <button type="button" className="follow-person-btn follow-btn-primary is-following">
                              <UserCheck size={13} />
                              <span>Following</span>
                            </button>
                          )}
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
