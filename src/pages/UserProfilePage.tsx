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
} from 'lucide-react'
import { Card, type CardEntry } from '../components/CommonplaceCard/Card'
import { useMasonryLayout } from '../hooks/useMasonryLayout'
import { CardSkeletonGrid } from '../components/CommonplaceCard/CardSkeleton'
import type { UserProfileState } from './SettingsPage'

interface UserProfilePageProps {
  onBack: () => void
  entries: CardEntry[]
  savedEntryIds?: string[]
  onSelectEntry?: (entry: CardEntry) => void
  userProfile: UserProfileState
  onNavigateToSettings: () => void
  onDeleteEntry?: (id: string) => void
  onEditEntry?: (entry: CardEntry) => void
  categoryFilter: string
  onCategoryFilterChange: (id: string) => void
  isOwnProfile?: boolean
}

const SAMPLE_FOLLOWERS = [
  { id: 'f1', name: 'Elena Rostova', handle: '@elena_r', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop' },
  { id: 'f2', name: 'Marcus Vance', handle: '@marcus_v', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop' },
  { id: 'f3', name: 'Sophia Chen', handle: '@sophiac', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop' },
]

const SAMPLE_FOLLOWING = [
  { id: 'g1', name: 'Julian Thorne', handle: '@jthorne', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop' },
  { id: 'g2', name: 'Clara Oswald', handle: '@clara_o', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop' },
]

export const UserProfilePage: React.FC<UserProfilePageProps> = ({
  onBack,
  entries,
  savedEntryIds = [],
  onSelectEntry,
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
    if (profileCategoryFilter === 'saved') {
      result = result.filter((e) => savedEntryIds.includes(e.id))
    } else if (profileCategoryFilter !== 'all') {
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

  const stats = [
    { id: 'all', label: 'All', count: entries.length, Icon: Layers },
    ...(isOwnProfile ? [{ id: 'saved', label: 'Saved (Private)', count: savedCount, Icon: Bookmark }] : []),
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
              onClick={() => setActiveFollowModal('followers')}
            >
              <Users aria-hidden="true" />
              <span>142 Followers</span>
            </button>
            <button
              type="button"
              className="profile-pill-badge"
              style={{ cursor: 'pointer' }}
              onClick={() => setActiveFollowModal('following')}
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

          {/* Review Cards Grid Reusing Home Card Component with True Masonry Layout & Fade In */}
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
                    />
                  </div>
                )
              })}
            </motion.section>
          )}
        </section>
      </div>

      {/* Followers / Following List Modal */}
      <AnimatePresence>
        {activeFollowModal && (
          <div className="modal-backdrop" onClick={() => setActiveFollowModal(null)}>
            <motion.div
              className="settings-modal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="settings-header" style={{ justifyContent: 'space-between', display: 'flex', alignItems: 'center' }}>
                <div className="settings-header-title">
                  <Users aria-hidden="true" />
                  <h2>{activeFollowModal === 'followers' ? 'Followers' : 'Following'}</h2>
                </div>
                <button type="button" className="composer-close-icon" onClick={() => setActiveFollowModal(null)}>
                  <X aria-hidden="true" />
                </button>
              </div>

              {!canViewFollowLists && !isOwnProfile ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--secondary)' }}>
                  <Lock style={{ marginBottom: '8px', opacity: 0.6 }} />
                  <p>Followers and Following lists are hidden by this user in their privacy settings.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                  {(activeFollowModal === 'followers' ? SAMPLE_FOLLOWERS : SAMPLE_FOLLOWING).map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justify: 'space-between',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img
                          src={item.avatar}
                          alt={item.name}
                          style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}
                        />
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--primary)', fontSize: '14px' }}>{item.name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--secondary)' }}>{item.handle}</div>
                        </div>
                      </div>
                      <button type="button" className="ghost-btn" style={{ padding: '6px 12px', fontSize: '12px' }}>
                        View
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
