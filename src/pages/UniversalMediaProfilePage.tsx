import React, { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Star,
  Search,
  X,
  ChevronRight,
  Layers,
  BookOpen,
  Disc3,
  Clapperboard,
  Tv,
  Gamepad2,
  Sparkles,
  BarChart2,
  Loader2,
  User,
  Music4,
  Quote,
} from 'lucide-react'
import { Card, type CardEntry } from '../components/CommonplaceCard/Card'
import {
  type UniversalMediaEntity,
  type MediaEntityType,
  getEntityTabs,
} from '../types/mediaEntity'
import {
  searchMetadata,
  fetchWikipediaPortrait,
  fetchItunesDiscography,
  fetchItunesAlbumDetails,
  fetchRelatedAlbums,
  fetchItunesSongDetails,
  entityImageCacheMap,
  type MetadataType,
} from '../metadata'
import type { MetadataChip, CollectionItem, TopContentItem } from '../types/mediaEntity'

interface UniversalMediaProfilePageProps {
  entity: UniversalMediaEntity
  onBack: () => void
  communityEntries: CardEntry[]
  onSelectEntry?: (entry: CardEntry) => void
  onOpenUserProfile?: (handle: string) => void
  onNavigateToEntity?: (entityId: string) => void
  likedEntryIds?: string[]
  savedEntryIds?: string[]
  disabledCommentEntryIds?: string[]
  onToggleLike?: (id: string) => void
  onToggleSave?: (id: string) => void
}

function getMediaIcon(type: MediaEntityType) {
  switch (type) {
    case 'artist':
    case 'album':
    case 'song':
      return Disc3
    case 'movie':
    case 'director':
    case 'actor':
      return Clapperboard
    case 'tv':
      return Tv
    case 'game':
    case 'game_studio':
      return Gamepad2
    case 'author':
    case 'book':
    default:
      return BookOpen
  }
}

function mapToMetaType(type: MediaEntityType): MetadataType {
  switch (type) {
    case 'artist':
    case 'album':
    case 'song':
      return 'album'
    case 'movie':
    case 'director':
    case 'actor':
      return 'film'
    case 'tv':
      return 'tv'
    case 'game':
    case 'game_studio':
      return 'game'
    case 'author':
    case 'book':
    default:
      return 'book'
  }
}

const TrackRow: React.FC<{
  item: TopContentItem
  onNavigateToEntity?: (id: string) => void
}> = ({ item, onNavigateToEntity }) => {
  return (
    <div
      className="top-content-row"
      onClick={() => onNavigateToEntity?.(item.id)}
      style={{ cursor: 'pointer' }}
      role="button"
      tabIndex={0}
    >
      <span className="row-rank">#{item.rank}</span>
      {item.artworkUrl && <img src={item.artworkUrl} alt={item.title} className="row-thumb" />}
      <div className="row-info">
        <span className="row-title">{item.title}</span>
        <span className="row-subtitle">{item.subtitle}</span>
      </div>
      {item.rating && (
        <div className="row-rating-pill">
          <Star size={12} fill="currentColor" />
          <span>{item.rating.toFixed(1)}</span>
        </div>
      )}
    </div>
  )
}

const CollectionItemThumb: React.FC<{ title: string; defaultUrl: string }> = ({ title, defaultUrl }) => {
  const [src, setSrc] = useState(defaultUrl)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setSrc(defaultUrl)
    setFailed(false)
  }, [defaultUrl])

  if (failed || !src) {
    return (
      <div className="collection-thumb-fallback">
        <User size={22} className="fallback-icon" />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={title}
      className="collection-thumb"
      referrerPolicy="no-referrer"
      onError={() => {
        searchMetadata('album', title)
          .then((res) => {
            if (res && res[0]?.coverUrl) setSrc(res[0].coverUrl)
            else setFailed(true)
          })
          .catch(() => setFailed(true))
      }}
    />
  )
}

export const UniversalMediaProfilePage: React.FC<UniversalMediaProfilePageProps> = ({
  entity,
  onBack,
  communityEntries,
  onSelectEntry,
  onOpenUserProfile,
  onNavigateToEntity,
  likedEntryIds = [],
  savedEntryIds = [],
  disabledCommentEntryIds = [],
  onToggleLike,
  onToggleSave,
}) => {
  const IconComponent = getMediaIcon(entity.type)
  const tabs = useMemo(() => getEntityTabs(entity.type), [entity.type])
  const [activeTab, setActiveTab] = useState<string>(tabs[0]?.id || 'overview')

  const [showRatingModal, setShowRatingModal] = useState(false)
  const [showAllTopContent, setShowAllTopContent] = useState(false)
  const [showAllCollection, setShowAllCollection] = useState(false)
  const [showAllAlbums, setShowAllAlbums] = useState(false)
  const [showAllEps, setShowAllEps] = useState(false)
  const [showAllSingles, setShowAllSingles] = useState(false)
  const [reviewSearch, setReviewSearch] = useState('')
  const [reviewSort, setReviewSort] = useState<'newest' | 'highest' | 'oldest'>('newest')

  // Live API Fetch for artwork, discography & tracklist details
  const cachedInitial = entityImageCacheMap.get(entity.name) || null
  const [apiCoverUrl, setApiCoverUrl] = useState<string | null>(cachedInitial)
  const [apiSummary, setApiSummary] = useState<string | null>(null)
  const [isLoadingApi, setIsLoadingApi] = useState(false)
  const [heroImgError, setHeroImgError] = useState(false)

  const [liveCollectionItems, setLiveCollectionItems] = useState<CollectionItem[] | null>(null)
  const [liveTrackItems, setLiveTrackItems] = useState<TopContentItem[] | null>(null)
  const [liveAlbumChips, setLiveAlbumChips] = useState<MetadataChip[] | null>(null)
  const [liveRelatedAlbums, setLiveRelatedAlbums] = useState<CollectionItem[] | null>(null)
  const [liveSongLyrics, setLiveSongLyrics] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    setHeroImgError(false)
    setLiveRelatedAlbums(null)

    if (entity.type === 'artist') {
      fetchItunesDiscography(entity.name)
        .then((items) => {
          if (!isMounted) return
          if (items && items.length > 0) setLiveCollectionItems(items)
        })
        .catch(() => {})
    }

    if (entity.type === 'album') {
      const artistChip = entity.metadataChips.find((c) => c.label === 'Artist')?.value
      fetchItunesAlbumDetails(entity.name, artistChip)
        .then((details) => {
          if (!isMounted) return
          if (details) {
            if (details.coverUrl) {
              entityImageCacheMap.set(entity.name, details.coverUrl)
              setApiCoverUrl(details.coverUrl)
            }
            if (details.tracks && details.tracks.length > 0) {
              setLiveTrackItems(details.tracks)
            }
            setLiveAlbumChips([
              { label: 'Artist', value: details.artist || artistChip || 'Artist' },
              { label: 'Release Year', value: details.year || '2023' },
              { label: 'Genre', value: details.genre || 'Pop' },
              { label: 'Track Count', value: `${details.trackCount} Tracks` },
            ])
            fetchRelatedAlbums(entity.name, details.artist || artistChip, details.genre, entity.id)
              .then((items) => {
                if (!isMounted) return
                setLiveRelatedAlbums(items.length > 0 ? items : null)
              })
              .catch(() => {})
          }
        })
        .catch(() => {})
    }

    if (entity.type === 'song') {
      const artistChip = entity.metadataChips.find((c) => c.label === 'Artist')?.value
      fetchItunesSongDetails(entity.name, artistChip)
        .then((details) => {
          if (!isMounted) return
          if (details) {
            if (details.artworkUrl) {
              entityImageCacheMap.set(entity.name, details.artworkUrl)
              setApiCoverUrl(details.artworkUrl)
            }
            if (details.lyrics) setLiveSongLyrics(details.lyrics)
            setLiveAlbumChips([
              { label: 'Artist', value: details.artist || artistChip || 'Artist' },
              { label: 'Album', value: details.album || 'Single' },
              { label: 'Duration', value: details.duration },
              { label: 'Track #', value: `#${details.trackNumber}` },
              { label: 'Release Year', value: details.year },
            ])
          }
        })
        .catch(() => {})
    }

    const existingCache = entityImageCacheMap.get(entity.name)
    if (existingCache) {
      setApiCoverUrl(existingCache)
    } else {
      setIsLoadingApi(true)
      if (['artist', 'author', 'director', 'actor'].includes(entity.type)) {
        fetchWikipediaPortrait(entity.name)
          .then((url) => {
            if (!isMounted) return
            if (url) {
              entityImageCacheMap.set(entity.name, url)
              setApiCoverUrl(url)
            }
          })
          .catch(() => {})
          .finally(() => {
            if (isMounted) setIsLoadingApi(false)
          })
      } else {
        const metaType = mapToMetaType(entity.type)
        searchMetadata(metaType, entity.name)
          .then((results) => {
            if (!isMounted) return
            if (results && results.length > 0) {
              const match = results[0]
              if (match.coverUrl) {
                entityImageCacheMap.set(entity.name, match.coverUrl)
                setApiCoverUrl(match.coverUrl)
              }
              if (match.summary) setApiSummary(match.summary)
            }
          })
          .catch(() => {})
          .finally(() => {
            if (isMounted) setIsLoadingApi(false)
          })
      }
    }

    return () => {
      isMounted = false
    }
  }, [entity.id, entity.name, entity.type])

  const displayArtwork = apiCoverUrl || entity.artworkUrl
  const displayDescription = apiSummary || entity.description

  // Community Reviews Matching
  const matchingReviews = useMemo(() => {
    return communityEntries.filter(
      (e) =>
        e.title.toLowerCase().includes(entity.name.toLowerCase()) ||
        e.creator.toLowerCase().includes(entity.name.toLowerCase()) ||
        entity.name.toLowerCase().includes(e.title.toLowerCase())
    )
  }, [communityEntries, entity.name])

  const filteredSortedReviews = useMemo(() => {
    let list = matchingReviews
    if (reviewSearch.trim()) {
      const q = reviewSearch.toLowerCase()
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.reflection.toLowerCase().includes(q) ||
          r.favoritePassage.toLowerCase().includes(q)
      )
    }
    return [...list].sort((a, b) => {
      if (reviewSort === 'highest') return b.rating - a.rating
      if (reviewSort === 'oldest')
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [matchingReviews, reviewSearch, reviewSort])

  const collectionItems = liveCollectionItems || entity.secondaryCollection?.items || []

  const albumsGroup = useMemo(() => {
    return collectionItems.filter((i) => {
      const cat = (i as any).category
      if (cat) return cat === 'album'
      const sub = (i.subtitle || '').toLowerCase()
      return !sub.includes('ep') && !sub.includes('single')
    })
  }, [collectionItems])

  const epsGroup = useMemo(() => {
    return collectionItems.filter((i) => {
      const cat = (i as any).category
      if (cat) return cat === 'ep'
      const sub = (i.subtitle || '').toLowerCase()
      return sub.includes('ep')
    })
  }, [collectionItems])

  const singlesGroup = useMemo(() => {
    return collectionItems.filter((i) => {
      const cat = (i as any).category
      if (cat) return cat === 'single'
      const sub = (i.subtitle || '').toLowerCase()
      return sub.includes('single')
    })
  }, [collectionItems])

  const songQuotes = useMemo(() => {
    if (entity.type !== 'song') return []
    const extracted = matchingReviews
      .filter((r) => r.favoritePassage || r.reflection)
      .map((r) => ({
        id: r.id,
        text: r.favoritePassage ? `“${r.favoritePassage}”` : `“${r.reflection.slice(0, 150)}${r.reflection.length > 150 ? '…' : ''}”`,
        author: r.authorName || 'Community Member',
        authorHandle: r.authorHandle || '@reflector',
      }))

    if (extracted.length > 0) return extracted

    return [
      {
        id: 'sq-1',
        text: `“Cause baby, now we've got bad blood / You know it used to be mad love…”`,
        author: 'Community Reflection',
        authorHandle: '@taylorswift_archive',
      },
      {
        id: 'sq-2',
        text: `“Say you'll remember me standing in a nice dress, staring at the sunset, babe…”`,
        author: 'Music Journal',
        authorHandle: '@wildest_notes',
      },
    ]
  }, [entity.type, matchingReviews])

  const topItems = liveTrackItems || entity.primaryCollection?.items || []

  const visibleTopItems = useMemo(() => {
    if (entity.type === 'album') {
      if (activeTab === 'overview') return topItems.slice(0, 5)
      if (activeTab === 'top_content') return topItems
    }
    return showAllTopContent ? topItems : topItems.slice(0, 5)
  }, [entity.type, activeTab, topItems, showAllTopContent])

  const chipsToDisplay = liveAlbumChips || entity.metadataChips

  return (
    <motion.div
      className="universal-media-profile-page"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* ── Top Navigation Bar ── */}
      <div className="media-profile-topbar">
        <button
          type="button"
          className="profile-back-btn"
          onClick={onBack}
          aria-label="Back to previous page"
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>

        <span className="media-profile-type-badge">
          <IconComponent size={14} />
          <span>{entity.categoryLabel}</span>
        </span>
      </div>

      <div className="editorial-divider" />

      {/* ── Two-Column Editorial Hero (No Cover Photo) ── */}
      <section className="media-hero-section">
        {/* Left Column: Artwork / Photo */}
        <div className="media-hero-left">
          <div className={`media-artwork-container ${entity.type === 'album' || entity.type === 'song' ? 'is-square-artwork' : ''}`}>
            {!heroImgError && displayArtwork ? (
              <img
                src={displayArtwork}
                alt={entity.name}
                className="media-artwork-img"
                referrerPolicy="no-referrer"
                onError={() => setHeroImgError(true)}
              />
            ) : (
              <div className="media-artwork-fallback">
                <User size={52} className="fallback-human-icon" />
                <span className="fallback-label">{entity.name}</span>
              </div>
            )}
            {isLoadingApi && (
              <div className="media-artwork-loader">
                <Loader2 size={20} className="spin-icon" />
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Textual Information & Rating */}
        <div className="media-hero-right">
          <div className="media-hero-meta-header">
            <span className="media-category-pill">{entity.categoryLabel}</span>
            <h1 className="media-hero-title">{entity.name}</h1>
          </div>

          <p className="media-hero-description">{displayDescription}</p>

          {/* Context-aware Metadata Chips */}
          <div className="media-chips-row">
            {chipsToDisplay.map((chip, idx) => (
              <div key={idx} className="media-metadata-chip">
                <span className="chip-label">{chip.label}:</span>
                <span className="chip-value">{chip.value}</span>
              </div>
            ))}
          </div>

          {/* Interactive Community Rating Block */}
          <div
            className="media-community-rating-card"
            onClick={() => setShowRatingModal(true)}
            title="Click to view rating breakdown"
            role="button"
            tabIndex={0}
          >
            <div className="rating-left-stars">
              <div className="rating-star-icon-row">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    size={16}
                    className={i < Math.floor(entity.communityRating.average) ? 'star-gold' : 'star-muted'}
                    fill="currentColor"
                  />
                ))}
              </div>
              <span className="rating-number">{entity.communityRating.average.toFixed(1)}</span>
            </div>
            <div className="rating-right-info">
              <span className="rating-count-text">
                {entity.communityRating.count.toLocaleString()} Community Ratings
              </span>
              <span className="rating-subtext">Click for rating distribution & analytics →</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Dynamic Generated Navigation Tabs ── */}
      <div className="media-tabs-wrapper">
        <div className="media-tabs-row">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`media-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.label}</span>
              {tab.id === 'reviews' && (
                <span className="media-tab-badge">{matchingReviews.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content Sections ── */}

      {/* Song Lyrics Section (For Song Profiles) */}
      {entity.type === 'song' && (activeTab === 'overview' || activeTab === 'lyrics') && (
        <section className="media-section song-lyrics-section">
          <div className="media-section-header">
            <div className="media-section-title-group">
              <Music4 size={16} className="title-icon" />
              <h2>Lyrics</h2>
            </div>
          </div>
          <div className="lyrics-card">
            {liveSongLyrics ? (
              <pre className="lyrics-text">{liveSongLyrics}</pre>
            ) : (
              <p className="lyrics-empty">Official lyrics for {entity.name} are archived in community reflections.</p>
            )}
          </div>
        </section>
      )}

      {/* Most Quoted Lines Section (For Songs Only) */}
      {entity.type === 'song' && (activeTab === 'overview' || activeTab === 'top_content') && (
        <section className="media-section song-quotes-section">
          <div className="media-section-header">
            <div className="media-section-title-group">
              <Quote size={16} className="title-icon" />
              <h2>Most Quoted Lines ({songQuotes.length})</h2>
            </div>
          </div>
          <div className="song-quotes-grid">
            {songQuotes.map((q) => (
              <div key={q.id} className="song-quote-card">
                <Quote size={20} className="quote-watermark" />
                <p className="song-quote-text">{q.text}</p>
                <div className="song-quote-meta">
                  <span className="song-quote-author">{q.author}</span>
                  <span className="song-quote-handle">{q.authorHandle}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 1. Primary Top Content Section (Tracklist for Albums, Top Songs for Artists, Cast for Movies) */}
      {entity.type !== 'song' && (activeTab === 'overview' || activeTab === 'top_content') && topItems.length > 0 && (
        <section className="media-section top-content-section">
          <div className="media-section-header">
            <div className="media-section-title-group">
              <Sparkles size={16} className="title-icon" />
              <h2>
                {entity.type === 'album'
                  ? activeTab === 'overview'
                    ? 'Top 5 Popular Tracks'
                    : `Full Tracklist (${topItems.length} Tracks)`
                  : entity.primaryCollection?.title || 'Top Items'}
              </h2>
            </div>
            {entity.type === 'album' && activeTab === 'overview' && topItems.length > 5 ? (
              <button
                type="button"
                className="media-view-all-btn"
                onClick={() => setActiveTab('top_content')}
              >
                <span>View Full Tracklist ({topItems.length}) →</span>
              </button>
            ) : entity.type !== 'album' && topItems.length > 5 ? (
              <button
                type="button"
                className="media-view-all-btn"
                onClick={() => setShowAllTopContent((v) => !v)}
              >
                <span>{showAllTopContent ? 'Show Top 5' : 'View All →'}</span>
              </button>
            ) : null}
          </div>

          <div className="top-content-list">
            {visibleTopItems.map((item) => (
              <TrackRow
                key={item.id}
                item={item}
                onNavigateToEntity={onNavigateToEntity}
              />
            ))}
          </div>
        </section>
      )}

      {/* 2. Grouped Discography Sections for Artists (Albums, EPs, Singles) */}
      {(activeTab === 'overview' || activeTab === 'collection') && entity.type === 'artist' && (
        <>
          {albumsGroup.length > 0 && (
            <section className="media-section collection-section">
              <div className="media-section-header">
                <div className="media-section-title-group">
                  <Layers size={16} className="title-icon" />
                  <h2>Studio Albums ({albumsGroup.length})</h2>
                </div>
                {albumsGroup.length > 12 && (
                  <button
                    type="button"
                    className="media-view-all-btn"
                    onClick={() => setShowAllAlbums((v) => !v)}
                  >
                    <span>{showAllAlbums ? 'Show 12' : `View All (${albumsGroup.length}) →`}</span>
                  </button>
                )}
              </div>
              <div className="collection-grid">
                {(showAllAlbums ? albumsGroup : albumsGroup.slice(0, 12)).map((item) => (
                  <div
                    key={item.id}
                    className="collection-card"
                    onClick={() => onNavigateToEntity?.(item.id)}
                    style={{ cursor: 'pointer' }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="collection-thumb-wrapper">
                      <CollectionItemThumb title={item.title} defaultUrl={item.artworkUrl} />
                    </div>
                    <div className="collection-info">
                      <span className="collection-title">{item.title}</span>
                      <span className="collection-subtitle">{item.subtitle}</span>
                    </div>
                    {item.rating && (
                      <span className="collection-rating-badge">
                        <Star size={11} fill="currentColor" />
                        <span>{item.rating.toFixed(1)}</span>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {epsGroup.length > 0 && (
            <section className="media-section collection-section">
              <div className="media-section-header">
                <div className="media-section-title-group">
                  <Layers size={16} className="title-icon" />
                  <h2>EPs ({epsGroup.length})</h2>
                </div>
                {epsGroup.length > 12 && (
                  <button
                    type="button"
                    className="media-view-all-btn"
                    onClick={() => setShowAllEps((v) => !v)}
                  >
                    <span>{showAllEps ? 'Show 12' : `View All (${epsGroup.length}) →`}</span>
                  </button>
                )}
              </div>
              <div className="collection-grid">
                {(showAllEps ? epsGroup : epsGroup.slice(0, 12)).map((item) => (
                  <div
                    key={item.id}
                    className="collection-card"
                    onClick={() => onNavigateToEntity?.(item.id)}
                    style={{ cursor: 'pointer' }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="collection-thumb-wrapper">
                      <CollectionItemThumb title={item.title} defaultUrl={item.artworkUrl} />
                    </div>
                    <div className="collection-info">
                      <span className="collection-title">{item.title}</span>
                      <span className="collection-subtitle">{item.subtitle}</span>
                    </div>
                    {item.rating && (
                      <span className="collection-rating-badge">
                        <Star size={11} fill="currentColor" />
                        <span>{item.rating.toFixed(1)}</span>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {singlesGroup.length > 0 && (
            <section className="media-section collection-section">
              <div className="media-section-header">
                <div className="media-section-title-group">
                  <Layers size={16} className="title-icon" />
                  <h2>Singles ({singlesGroup.length})</h2>
                </div>
                {singlesGroup.length > 12 && (
                  <button
                    type="button"
                    className="media-view-all-btn"
                    onClick={() => setShowAllSingles((v) => !v)}
                  >
                    <span>{showAllSingles ? 'Show 12' : `View All (${singlesGroup.length}) →`}</span>
                  </button>
                )}
              </div>
              <div className="collection-grid">
                {(showAllSingles ? singlesGroup : singlesGroup.slice(0, 12)).map((item) => (
                  <div
                    key={item.id}
                    className="collection-card"
                    onClick={() => onNavigateToEntity?.(item.id)}
                    style={{ cursor: 'pointer' }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="collection-thumb-wrapper">
                      <CollectionItemThumb title={item.title} defaultUrl={item.artworkUrl} />
                    </div>
                    <div className="collection-info">
                      <span className="collection-title">{item.title}</span>
                      <span className="collection-subtitle">{item.subtitle}</span>
                    </div>
                    {item.rating && (
                      <span className="collection-rating-badge">
                        <Star size={11} fill="currentColor" />
                        <span>{item.rating.toFixed(1)}</span>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* 3. Generic Secondary Collection Section for non-artists */}
      {(activeTab === 'overview' || activeTab === 'collection') && entity.type !== 'artist' && entity.secondaryCollection && (
        <section className="media-section collection-section">
          <div className="media-section-header">
            <div className="media-section-title-group">
              <Layers size={16} className="title-icon" />
              <h2>{entity.secondaryCollection.title}</h2>
            </div>
          </div>

          <div className="collection-grid">
            {collectionItems.slice(0, showAllCollection ? undefined : 3).map((item) => (
              <div
                key={item.id}
                className="collection-card"
                onClick={() => onNavigateToEntity?.(item.id)}
                style={{ cursor: 'pointer' }}
                role="button"
                tabIndex={0}
              >
                <div className="collection-thumb-wrapper">
                  <CollectionItemThumb title={item.title} defaultUrl={item.artworkUrl} />
                </div>
                <div className="collection-info">
                  <span className="collection-title">{item.title}</span>
                  <span className="collection-subtitle">{item.subtitle}</span>
                </div>
                {item.rating && (
                  <span className="collection-rating-badge">
                    <Star size={11} fill="currentColor" />
                    <span>{item.rating.toFixed(1)}</span>
                  </span>
                )}
              </div>
            ))}
          </div>

          {collectionItems.length > 3 && (
            <button
              type="button"
              className="media-show-more-btn"
              onClick={() => setShowAllCollection((v) => !v)}
            >
              <span>{showAllCollection ? 'Show Less' : `Show More (${collectionItems.length - 3} items)`}</span>
            </button>
          )}
        </section>
      )}

      {/* 3. Community Reviews Section (Reuses feed Card components) */}
      {(activeTab === 'overview' || activeTab === 'reviews') && (
        <section className="media-section community-reviews-section">
          <div className="media-section-header reviews-header-row">
            <div className="media-section-title-group">
              <BookOpen size={16} className="title-icon" />
              <h2>Community Reviews ({matchingReviews.length})</h2>
            </div>

            <div className="reviews-controls-row">
              <div className="reviews-search-box">
                <Search size={14} />
                <input
                  type="text"
                  placeholder={`Search ${entity.categoryLabel.toLowerCase()} reviews…`}
                  value={reviewSearch}
                  onChange={(e) => setReviewSearch(e.target.value)}
                />
                {reviewSearch && (
                  <button type="button" onClick={() => setReviewSearch('')}>
                    <X size={12} />
                  </button>
                )}
              </div>

              <select
                className="reviews-sort-select"
                value={reviewSort}
                onChange={(e) => setReviewSort(e.target.value as any)}
              >
                <option value="newest">Newest First</option>
                <option value="highest">Highest Rated</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>
          </div>

          {filteredSortedReviews.length === 0 ? (
            <div className="media-empty-reviews">
              <BookOpen size={32} opacity={0.3} />
              <p>No community reflections recorded for {entity.name} yet.</p>
            </div>
          ) : (
            <div className="card-grid media-reviews-masonry">
              {filteredSortedReviews.map((entry) => (
                <div key={entry.id} className="masonry-item" style={{ marginBottom: 16 }}>
                  <Card
                    entry={entry}
                    expanded={false}
                    onToggle={() => onSelectEntry?.(entry)}
                    onExpandOverlay={() => onSelectEntry?.(entry)}
                    onOpenProfile={() => onOpenUserProfile?.(entry.authorHandle || 'jimboii')}
                    typeIcon={IconComponent}
                    typeLabel={entity.categoryLabel}
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

      {/* 4. Related Albums Grid */}
      {(activeTab === 'overview' || activeTab === 'related') && entity.type === 'album' && liveRelatedAlbums && liveRelatedAlbums.length > 0 && (
        <section className="media-section related-albums-section">
          <div className="media-section-header">
            <div className="media-section-title-group">
              <Sparkles size={16} className="title-icon" />
              <h2>Related Albums</h2>
            </div>
          </div>

          <div className="collection-grid related-albums-grid">
            {liveRelatedAlbums.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="collection-card"
                onClick={() => onNavigateToEntity?.(item.id)}
                style={{ cursor: 'pointer' }}
                role="button"
                tabIndex={0}
              >
                <div className="collection-thumb-wrapper">
                  <CollectionItemThumb title={item.title} defaultUrl={item.artworkUrl} />
                </div>
                <div className="collection-info">
                  <span className="collection-title">{item.title}</span>
                  <span className="collection-subtitle">{item.subtitle}</span>
                </div>
                {item.rating && (
                  <span className="collection-rating-badge">
                    <Star size={11} fill="currentColor" />
                    <span>{item.rating.toFixed(1)}</span>
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. Related Media Section (Horizontal Cards at Bottom) */}
      {(activeTab === 'overview' || activeTab === 'related') && entity.relatedEntities && (
        <section className="media-section related-entities-section">
          <div className="media-section-header">
            <div className="media-section-title-group">
              <Sparkles size={16} className="title-icon" />
              <h2>{entity.relatedEntities.title}</h2>
            </div>
          </div>

          <div className="related-cards-scroll">
            {entity.relatedEntities.items.map((rel) => (
              <div
                key={rel.id}
                className="related-media-card"
                onClick={() => onNavigateToEntity?.(rel.id)}
                role="button"
                tabIndex={0}
              >
                <div className="related-thumb-wrapper">
                  <img src={rel.artworkUrl} alt={rel.title} className="related-thumb" />
                </div>
                <div className="related-info">
                  <span className="related-title">{rel.title}</span>
                  <span className="related-subtitle">{rel.subtitle}</span>
                </div>
                <ChevronRight size={14} className="related-arrow" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Rating Distribution & Analytics Modal ── */}
      <AnimatePresence>
        {showRatingModal && (
          <div className="modal-backdrop" onClick={() => setShowRatingModal(false)}>
            <motion.div
              className="rating-analytics-modal"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header-row">
                <div className="modal-title-group">
                  <BarChart2 size={18} className="icon-gold" />
                  <h2>Rating Analytics & Breakdown</h2>
                </div>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setShowRatingModal(false)}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="rating-modal-body">
                <div className="rating-modal-score-block">
                  <span className="large-score">{entity.communityRating.average.toFixed(1)}</span>
                  <div className="stars-wrapper">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        size={18}
                        className={i < Math.floor(entity.communityRating.average) ? 'star-gold' : 'star-muted'}
                        fill="currentColor"
                      />
                    ))}
                  </div>
                  <span className="total-ratings">
                    Based on {entity.communityRating.count.toLocaleString()} Commonplace ratings
                  </span>
                </div>

                <div className="rating-distribution-bars">
                  {[5, 4, 3, 2, 1].map((stars) => {
                    const pct = entity.communityRating.distribution[stars] || 0
                    return (
                      <div key={stars} className="dist-row">
                        <span className="dist-star-label">{stars} ★</span>
                        <div className="dist-bar-track">
                          <div className="dist-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="dist-pct-text">{pct}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
