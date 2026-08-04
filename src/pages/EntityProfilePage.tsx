import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Disc3,
  Clapperboard,
  Tv,
  Gamepad2,
  BookOpen,
  Star,
  Sparkles,
  Layers,
  Search,
  X,
  Loader2,
} from 'lucide-react'
import { Card, type CardEntry } from '../components/CommonplaceCard/Card'
import { searchMetadata, type MetadataType } from '../metadata'

export interface EntityProfile {
  id: string
  type: 'artist' | 'movie' | 'tv' | 'game'
  title: string
  creatorLabel: string // e.g. "Director", "Creator", "Studio", "Genre / Style"
  creatorValue: string // e.g. "Christopher Nolan"
  coverUrl: string
  bannerUrl?: string
  bio: string
  topItemsTitle: string // e.g. "Top 5 Most Reviewed Songs", "Top 5 Cast Members"
  topItems: { id: string; name: string; detail: string; rating?: number }[]
}

interface EntityProfilePageProps {
  entity: EntityProfile
  onBack: () => void
  communityEntries: CardEntry[]
  onSelectEntry?: (entry: CardEntry) => void
  onOpenUserProfile?: (handle: string) => void
  likedEntryIds?: string[]
  savedEntryIds?: string[]
  disabledCommentEntryIds?: string[]
  onToggleLike?: (id: string) => void
  onToggleSave?: (id: string) => void
}

function getTypeIcon(type: EntityProfile['type']) {
  switch (type) {
    case 'artist':
      return Disc3
    case 'movie':
      return Clapperboard
    case 'tv':
      return Tv
    case 'game':
      return Gamepad2
    default:
      return BookOpen
  }
}

function getTypeBadgeLabel(type: EntityProfile['type']) {
  switch (type) {
    case 'artist':
      return 'Artist & Album'
    case 'movie':
      return 'Film / Movie'
    case 'tv':
      return 'TV Series'
    case 'game':
      return 'Video Game'
    default:
      return 'Media'
  }
}

function mapEntityToMetaType(type: EntityProfile['type']): MetadataType {
  switch (type) {
    case 'artist':
      return 'album'
    case 'movie':
      return 'film'
    case 'tv':
      return 'tv'
    case 'game':
      return 'game'
    default:
      return 'book'
  }
}

export const EntityProfilePage: React.FC<EntityProfilePageProps> = ({
  entity,
  onBack,
  communityEntries,
  onSelectEntry,
  onOpenUserProfile,
  likedEntryIds = [],
  savedEntryIds = [],
  disabledCommentEntryIds = [],
  onToggleLike,
  onToggleSave,
}) => {
  const IconComponent = getTypeIcon(entity.type)
  const [activeTab, setActiveTab] = useState<'top5' | 'reviews'>('top5')
  const [apiCoverUrl, setApiCoverUrl] = useState<string | null>(null)
  const [apiSummary, setApiSummary] = useState<string | null>(null)
  const [isLoadingApi, setIsLoadingApi] = useState(false)
  const [searchFilter, setSearchFilter] = useState('')

  // Live API Fetch for Entity Information & Pictures
  useEffect(() => {
    let isMounted = true
    setIsLoadingApi(true)
    const metaType = mapEntityToMetaType(entity.type)

    searchMetadata(metaType, entity.title)
      .then((results) => {
        if (!isMounted) return
        if (results && results.length > 0) {
          const match = results[0]
          if (match.coverUrl) setApiCoverUrl(match.coverUrl)
          if (match.summary) setApiSummary(match.summary)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setIsLoadingApi(false)
      })

    return () => {
      isMounted = false
    }
  }, [entity.title, entity.type])

  const displayCover = apiCoverUrl || entity.coverUrl
  const displayBio = apiSummary || entity.bio

  // Filter entries matching this entity
  const matchingEntries = communityEntries.filter(
    (e) =>
      e.title.toLowerCase().includes(entity.title.toLowerCase()) ||
      e.creator.toLowerCase().includes(entity.title.toLowerCase()) ||
      entity.title.toLowerCase().includes(e.title.toLowerCase())
  )

  const filteredCommunityEntries = matchingEntries.filter((e) => {
    if (!searchFilter.trim()) return true
    const q = searchFilter.toLowerCase()
    return (
      e.title.toLowerCase().includes(q) ||
      e.reflection.toLowerCase().includes(q) ||
      e.favoritePassage.toLowerCase().includes(q)
    )
  })

  return (
    <motion.div
      className="profile-page-container entity-profile-page"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Top sticky navigation bar */}
      <div className="profile-page-topbar">
        <button
          type="button"
          className="profile-back-btn"
          onClick={onBack}
          aria-label="Back to feed"
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>

        <span className="entity-topbar-type-badge">
          <IconComponent size={14} />
          <span>{getTypeBadgeLabel(entity.type)}</span>
        </span>
      </div>

      {/* Hero Banner — Styled Identically to User Profile Header */}
      <div className="profile-page-hero">
        <div className="profile-hero-cover-wrapper">
          <img
            src={
              entity.bannerUrl ||
              displayCover ||
              'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?q=80&w=1200&auto=format&fit=crop'
            }
            alt=""
            className="profile-hero-cover"
          />
          <div className="profile-hero-overlay" />
        </div>

        {/* Profile Avatar / Poster Row */}
        <div className="profile-avatar-row">
          <div className={`profile-avatar-wrapper ${entity.type === 'artist' ? '' : 'entity-poster-shape'}`}>
            <img src={displayCover} alt={entity.title} className="profile-avatar-img" />
            {isLoadingApi && (
              <div className="entity-api-loading-overlay">
                <Loader2 size={18} className="spin-icon" />
              </div>
            )}
          </div>
        </div>

        {/* Identity Details Header */}
        <div className="profile-page-header">
          <div className="profile-page-names">
            <h1 className="profile-page-name">{entity.title}</h1>
            <span className="entity-creator-tag">
              <strong>{entity.creatorLabel}:</strong> {entity.creatorValue}
            </span>
          </div>

          <p className="profile-page-bio">{displayBio}</p>

          {/* Inline Pill Container Badges */}
          <div className="profile-pill-container">
            <span className="profile-pill-badge">
              <IconComponent aria-hidden="true" />
              <span>{getTypeBadgeLabel(entity.type)}</span>
            </span>
            <span className="profile-pill-badge rating">
              <Star aria-hidden="true" />
              <span>4.8 Community Rating</span>
            </span>
            <span className="profile-pill-badge">
              <BookOpen aria-hidden="true" />
              <span>{matchingEntries.length} Commonplace Reviews</span>
            </span>
          </div>
        </div>

        {/* Interactive Stats Grid / Tabs — Identical layout to User Profile Page */}
        <div className="profile-stats-grid">
          <button
            type="button"
            className={`profile-stat-card ${activeTab === 'top5' ? 'active' : ''}`}
            onClick={() => setActiveTab('top5')}
          >
            <div className="stat-left-icon">
              <Sparkles size={16} />
            </div>
            <div className="stat-info-text">
              <span className="stat-count">{entity.topItems.length}</span>
              <span className="stat-label">Highlights / Cast</span>
            </div>
          </button>

          <button
            type="button"
            className={`profile-stat-card ${activeTab === 'reviews' ? 'active' : ''}`}
            onClick={() => setActiveTab('reviews')}
          >
            <div className="stat-left-icon">
              <Layers size={16} />
            </div>
            <div className="stat-info-text">
              <span className="stat-count">{matchingEntries.length}</span>
              <span className="stat-label">Community Reviews</span>
            </div>
          </button>
        </div>

        {/* Tab Content Section */}
        {activeTab === 'top5' ? (
          <div className="entity-top5-section">
            <div className="entity-section-title">
              <Sparkles size={16} />
              <h2>{entity.topItemsTitle}</h2>
            </div>
            <div className="entity-top5-grid">
              {entity.topItems.map((item, idx) => (
                <div key={item.id} className="entity-top5-card">
                  <span className="top5-rank-badge">#{idx + 1}</span>
                  <div className="top5-info">
                    <span className="top5-name">{item.name}</span>
                    <span className="top5-detail">{item.detail}</span>
                  </div>
                  {item.rating && (
                    <span className="top5-rating">
                      <Star size={12} fill="currentColor" />
                      <span>{item.rating}</span>
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <section className="profile-catalog-section">
            <div className="profile-catalog-header">
              <h2 className="profile-catalog-title">
                Community Reviews ({matchingEntries.length})
              </h2>

              <div className="profile-search-bar">
                <Search size={14} className="profile-search-icon" />
                <input
                  type="text"
                  placeholder="Search reviews..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="profile-search-input"
                />
                {searchFilter && (
                  <button
                    type="button"
                    className="profile-search-clear"
                    onClick={() => setSearchFilter('')}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {filteredCommunityEntries.length === 0 ? (
              <div className="profile-empty">
                <BookOpen size={32} opacity={0.4} />
                <h3>No reviews found</h3>
                <p>No community reflections matching your query yet.</p>
              </div>
            ) : (
              <div className="card-grid profile-masonry-grid" style={{ position: 'relative' }}>
                {filteredCommunityEntries.map((entry) => (
                  <div key={entry.id} className="masonry-item" style={{ marginBottom: 16 }}>
                    <Card
                      entry={entry}
                      expanded={false}
                      onToggle={() => onSelectEntry?.(entry)}
                      onExpandOverlay={() => onSelectEntry?.(entry)}
                      onOpenProfile={() => onOpenUserProfile?.(entry.authorHandle || 'jimboii')}
                      typeIcon={IconComponent}
                      typeLabel={getTypeBadgeLabel(entity.type)}
                      isLiked={likedEntryIds.includes(entry.id)}
                      isSaved={savedEntryIds.includes(entry.id)}
                      onToggleLike={() => onToggleLike?.(entry.id)}
                      onToggleSave={() => onToggleSave?.(entry.id)}
                      commentsDisabled={disabledCommentEntryIds.includes(entry.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </motion.div>
  )
}
