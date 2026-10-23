import React, { useState, useMemo, useRef, useEffect } from 'react'
import {
  ArrowLeft,
  Plus,
  Edit3,
  Trash2,
  Bookmark,
  Layers,
  Sparkles,
  Search,
  ExternalLink,
  BookOpen,
  Film,
  Music,
  Disc3,
  Tv,
  Gamepad2,
  Check,
  MoreHorizontal,
  Share2,
  MessageSquareOff,
  MessageSquare,
  UserPlus,
  UserCheck,
  Users,
  LayoutGrid,
  Eye,
  EyeOff,
  Star,
  ChevronLeft,
  ChevronRight,
  Upload,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Entry, EntryType } from '../../features/entries/model'
import { useDevSettings, type CollectionLayoutDesign } from '../DeveloperTools/devSettings'
import { getGradientHeroBannerStyle } from '../../utils/collectionCovers'
import { CollectionCommentsSection } from './CollectionCommentsSection'
import type { AlternativeCollectionDetailProps } from './AlternativeCollectionDetail'
import './AlternativeCollection.css'

const TYPE_META: Record<string, { label: string; color: string }> = {
  book: { label: 'Book', color: '#f59e0b' },
  film: { label: 'Film', color: '#06b6d4' },
  tv: { label: 'TV Show', color: '#38bdf8' },
  album: { label: 'Album', color: '#ec4899' },
  song: { label: 'Song', color: '#a855f7' },
  game: { label: 'Game', color: '#f43f5e' },
}

function getTypeMeta(type: string): { label: string; color: string } {
  return (
    TYPE_META[type] || {
      label: type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Media',
      color: 'var(--accent)',
    }
  )
}

function renderTypeIcon(type: EntryType, size = 14) {
  switch (type) {
    case 'book':
      return <BookOpen size={size} aria-hidden="true" />
    case 'film':
      return <Film size={size} aria-hidden="true" />
    case 'tv':
      return <Tv size={size} aria-hidden="true" />
    case 'album':
      return <Disc3 size={size} aria-hidden="true" />
    case 'song':
      return <Music size={size} aria-hidden="true" />
    case 'game':
      return <Gamepad2 size={size} aria-hidden="true" />
    default:
      return <Layers size={size} aria-hidden="true" />
  }
}

export const UniversalCollectionLayout: React.FC<AlternativeCollectionDetailProps> = ({
  collection,
  items,
  creatorHandle,
  creatorName,
  currentUserHandle,
  isOwnedByCurrentUser,
  isSaved,
  isTcpAdminUser,
  isEditingInline,
  collectionName,
  setCollectionName,
  collectionDescription,
  setCollectionDescription,
  onSaveInlineEdit,
  onCancelInlineEdit,
  onBack,
  onOpenMedia,
  onSelectEntry: _onSelectEntry,
  onOpenCreator: _onOpenCreator,
  onOpenAlbum,
  onOpenUserProfile,
  onAddMedia,
  onStartInlineEdit,
  onDeleteCollection,
  onToggleSave,
  onRemoveItem,
  renderCoverArtwork,
  followersCount = 0,
  followingCount = 0,
  isFollowingUser = false,
  onToggleFollow,
  collectionCoverMode = 'auto',
  setCollectionCoverMode,
  collectionCustomCover = '',
  setCollectionCustomCover,
  collectionGradientVariant = 1,
  setCollectionGradientVariant,
  onCoverUpload,
  onToggleHideFromProfile,
}) => {
  const { settings, updateSetting } = useDevSettings()
  const devSettings = settings
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [activeCardMenuId, setActiveCardMenuId] = useState<string | null>(null)

  // Format filter (can be 'all' or specific type, or combined)
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [spotlightItemId, setSpotlightItemId] = useState<string | null>(items[0]?.id ?? null)

  // Triple dots popover menu
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  // Comments disabled state persisted in localStorage
  const [commentsDisabled, setCommentsDisabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(`tcp.collection_comments_disabled.${collection.id}`) === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    if (!menuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  useEffect(() => {
    if (!activeCardMenuId) return
    const handleClick = () => setActiveCardMenuId(null)
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [activeCardMenuId])

  const handleToggleCommentsDisabled = () => {
    const next = !commentsDisabled
    setCommentsDisabled(next)
    try {
      localStorage.setItem(`tcp.collection_comments_disabled.${collection.id}`, String(next))
    } catch {}
    setMenuOpen(false)
  }

  const handleShareCollection = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    } catch (err) {
      console.error('Failed to copy link', err)
    }
    setMenuOpen(false)
  }

  const handleSwitchLayout = (layout: CollectionLayoutDesign) => {
    updateSetting('collectionLayout', layout)
  }

  const handleOpenEntry = (entry: Entry) => {
    if (entry.type === 'album' && onOpenAlbum) {
      onOpenAlbum(entry)
    } else {
      onOpenMedia?.(entry)
    }
  }

  const navigate = useNavigate()

  const handleOpenCuratorProfile = () => {
    const handle = (creatorHandle || creatorName || '').replace(/^@/, '')
    if (!handle) return
    if (onOpenUserProfile) {
      onOpenUserProfile(handle)
    } else {
      navigate(`/users/${encodeURIComponent(handle)}`)
    }
  }

  // Filtered items
  const displayedItems = useMemo(() => {
    let result = [...items]
    if (selectedTypeFilter !== 'all') {
      result = result.filter((item) => item.type === selectedTypeFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.creator.toLowerCase().includes(q) ||
          (item.year && String(item.year).includes(q)),
      )
    }
    return result
  }, [items, selectedTypeFilter, searchQuery])

  // Responsive column count: 4 on desktop, 2 on <= 720px, 1 on <= 480px
  const [columnCount, setColumnCount] = useState(4)
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth
      if (w <= 480) setColumnCount(1)
      else if (w <= 720) setColumnCount(2)
      else setColumnCount(4)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const masonryColumns = useMemo(() => {
    const cols: Entry[][] = Array.from({ length: columnCount }, () => [])
    displayedItems.forEach((entry, idx) => {
      cols[idx % columnCount].push(entry)
    })
    return cols
  }, [displayedItems, columnCount])

  // Active spotlight item
  const spotlightItem = useMemo(() => {
    if (!spotlightItemId) return displayedItems[0] ?? items[0] ?? null
    return items.find((item) => item.id === spotlightItemId) ?? displayedItems[0] ?? items[0] ?? null
  }, [items, displayedItems, spotlightItemId])

  // Media type breakdown for stats & combined filter widget
  const typeBreakdown = useMemo(() => {
    const counts: Record<string, number> = {}
    items.forEach((item) => {
      counts[item.type] = (counts[item.type] || 0) + 1
    })

    const total = items.length || 1
    return Object.entries(counts).map(([type, count]) => {
      const { label, color } = getTypeMeta(type)
      const pct = Math.round((count / total) * 100)
      return { type, label, count, pct, color }
    })
  }, [items])

  // Layout 2 gradient hero matches Layout 1: fills container with gradient preview when gradient mode is chosen
  const isContainerGradient = useMemo(() => {
    if (isEditingInline) {
      return collectionCoverMode === 'gradient'
    }
    return (
      collection.coverMode === 'gradient' ||
      Boolean(collection.coverStyle?.startsWith('gradient-')) ||
      Boolean(collection.customCoverUrl?.startsWith('data:image/svg+xml'))
    )
  }, [isEditingInline, collectionCoverMode, collection.coverMode, collection.coverStyle, collection.customCoverUrl])

  const showCoverBox = isEditingInline || !isContainerGradient || devSettings.showCoverOnGradient

  const currentGradientVariant = useMemo(() => {
    const rawVariant = (isEditingInline && collectionGradientVariant)
      ? collectionGradientVariant
      : collection.coverStyle?.startsWith('gradient-')
        ? Number(collection.coverStyle.replace('gradient-', ''))
        : 1
    return (rawVariant >= 1 && rawVariant <= 4 ? rawVariant : 1) as 1 | 2 | 3 | 4
  }, [isEditingInline, collectionGradientVariant, collection.coverStyle])

  const gradientHeroStyle = useMemo(() => {
    if (!isContainerGradient) return undefined
    return getGradientHeroBannerStyle(currentGradientVariant, items)
  }, [isContainerGradient, currentGradientVariant, items])

  const isGradientLight = isContainerGradient && (currentGradientVariant === 3 || currentGradientVariant === 4)

  const creatorDisplay = creatorName?.trim() ? creatorName : creatorHandle

  const COVER_STYLE_KEYS = ['photo', 'auto', 'g1', 'g2', 'g3', 'g4'] as const

  const getCurrentStyleKey = () => {
    if (collectionCoverMode === 'custom') return 'photo'
    if (collectionCoverMode === 'auto') return 'auto'
    return `g${collectionGradientVariant || 1}` as const
  }

  const applyCoverStyleKey = (key: typeof COVER_STYLE_KEYS[number]) => {
    if (key === 'photo') {
      setCollectionCoverMode?.('custom')
      if (!collectionCustomCover) {
        photoInputRef.current?.click()
      }
    } else if (key === 'auto') {
      setCollectionCoverMode?.('auto')
    } else if (key === 'g1') {
      setCollectionCoverMode?.('gradient')
      setCollectionGradientVariant?.(1)
    } else if (key === 'g2') {
      setCollectionCoverMode?.('gradient')
      setCollectionGradientVariant?.(2)
    } else if (key === 'g3') {
      setCollectionCoverMode?.('gradient')
      setCollectionGradientVariant?.(3)
    } else if (key === 'g4') {
      setCollectionCoverMode?.('gradient')
      setCollectionGradientVariant?.(4)
    }
  }

  const handlePrevCover = () => {
    const cur = getCurrentStyleKey()
    const idx = COVER_STYLE_KEYS.indexOf(cur)
    const prevIdx = (idx - 1 + COVER_STYLE_KEYS.length) % COVER_STYLE_KEYS.length
    applyCoverStyleKey(COVER_STYLE_KEYS[prevIdx])
  }

  const handleNextCover = () => {
    const cur = getCurrentStyleKey()
    const idx = COVER_STYLE_KEYS.indexOf(cur)
    const nextIdx = (idx + 1) % COVER_STYLE_KEYS.length
    applyCoverStyleKey(COVER_STYLE_KEYS[nextIdx])
  }

  const handleCoverFileUpload = (file?: File) => {
    if (!file || !file.type.startsWith('image/')) return
    if (onCoverUpload) {
      onCoverUpload(file)
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCollectionCustomCover?.(reader.result)
        setCollectionCoverMode?.('custom')
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="universal-collection-root">
      {/* ── Top Bar: Back Button & Dev Switcher (No red brand text!) ── */}
      <div className="tcp-alt-top-bar">
        <button
          type="button"
          className="collection-back-btn tcp-alt-back-btn"
          onClick={onBack}
          aria-label="Back to collections"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Back to Collections</span>
        </button>

        <div className="tcp-alt-top-bar-actions">
          {/* 3-Way Seamless Switcher for @tcpadmin */}
          {isTcpAdminUser && (
            <div className="tcp-admin-layout-switcher" title="Seamlessly toggle collection designs (@tcpadmin)">
              <span className="tcp-switcher-label">
                <Sparkles size={12} aria-hidden="true" />
                <span>Dev Layout:</span>
              </span>
              <div className="tcp-switcher-pill-group">
                <button
                  type="button"
                  className={`tcp-switcher-pill ${settings.collectionLayout === 'classic' ? 'is-active' : ''}`}
                  onClick={() => handleSwitchLayout('classic')}
                >
                  Classic
                </button>
                <button
                  type="button"
                  className={`tcp-switcher-pill ${settings.collectionLayout === 'hollis' ? 'is-active' : ''}`}
                  onClick={() => handleSwitchLayout('hollis')}
                >
                  Layout 1 (Hollis)
                </button>
                <button
                  type="button"
                  className={`tcp-switcher-pill ${settings.collectionLayout === 'universal' ? 'is-active' : ''}`}
                  onClick={() => handleSwitchLayout('universal')}
                >
                  Layout 2 (Universal)
                </button>
              </div>
            </div>
          )}

          {/* Triple Dots Popover Menu: Accessible outside the container in top bar */}
          {!isEditingInline && (
            <div className="tcp-alt-menu-wrap" ref={menuRef}>
              <button
                type="button"
                className="universal-btn icon-only tcp-alt-top-menu-btn"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-label="More collection options"
                title="More options"
              >
                <MoreHorizontal size={18} aria-hidden="true" />
              </button>

              {menuOpen && (
                <div className="tcp-alt-dropdown-popover" role="menu">
                  <button
                    type="button"
                    className="tcp-alt-dropdown-item"
                    onClick={handleShareCollection}
                    role="menuitem"
                  >
                    <Share2 size={14} aria-hidden="true" />
                    <span>{copiedLink ? 'Link Copied!' : 'Share Collection'}</span>
                  </button>

                  {isOwnedByCurrentUser && (
                    <>
                      <button
                        type="button"
                        className="tcp-alt-dropdown-item"
                        onClick={handleToggleCommentsDisabled}
                        role="menuitem"
                      >
                        {commentsDisabled ? (
                          <>
                            <MessageSquare size={14} aria-hidden="true" />
                            <span>Enable Comments</span>
                          </>
                        ) : (
                          <>
                            <MessageSquareOff size={14} aria-hidden="true" />
                            <span>Disable Comments</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        className="tcp-alt-dropdown-item"
                        onClick={() => {
                          setMenuOpen(false)
                          onToggleHideFromProfile?.()
                        }}
                        role="menuitem"
                      >
                        {collection.isHidden ? (
                          <>
                            <Eye size={14} aria-hidden="true" />
                            <span>Show on Profile</span>
                          </>
                        ) : (
                          <>
                            <EyeOff size={14} aria-hidden="true" />
                            <span>Hide from Profile</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        className="tcp-alt-dropdown-item danger"
                        onClick={() => {
                          setMenuOpen(false)
                          onDeleteCollection?.()
                        }}
                        role="menuitem"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                        <span>Delete Collection</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Universal Hero Banner (Website color palette, no red outline!) ── */}
      <section
        className={`universal-hero ${isContainerGradient ? 'is-gradient-bg' : ''} ${isGradientLight ? 'is-gradient-light' : ''}`}
        style={gradientHeroStyle}
      >
        {/* Square Cover Artwork Column: Vertically centered, with cover selector when editing */}
        {showCoverBox && (
          <div className="universal-hero-cover-column">
            <div className="collection-preview-cover-stage">
              {isEditingInline && (
                <button
                  type="button"
                  className="collection-cover-nav-btn prev"
                  onClick={handlePrevCover}
                  aria-label="Previous cover style"
                  title="Previous style"
                >
                  <ChevronLeft aria-hidden="true" size={18} />
                </button>
              )}

              <div
                className="universal-hero-artwork-wrap"
                aria-hidden="true"
                onClick={() => {
                  if (isEditingInline && collectionCoverMode === 'custom') {
                    photoInputRef.current?.click()
                  }
                }}
                style={{ cursor: isEditingInline && collectionCoverMode === 'custom' ? 'pointer' : 'default' }}
              >
                {collectionCoverMode === 'custom' ? (
                  !collectionCustomCover ? (
                    <button
                      type="button"
                      className="collection-preview-custom-empty-upload"
                      onClick={() => photoInputRef.current?.click()}
                      title="Click to upload cover photo"
                    >
                      <Upload size={24} aria-hidden="true" />
                      <span>Click to upload cover</span>
                    </button>
                  ) : (
                    <div className="collection-preview-custom-cover-wrap">
                      <img
                        className="collection-preview-custom-cover"
                        src={collectionCustomCover}
                        alt="Collection custom cover"
                      />
                      {isEditingInline && (
                        <div
                          className="collection-custom-cover-hover-overlay"
                          onClick={() => photoInputRef.current?.click()}
                          title="Change cover photo"
                        >
                          <Upload size={22} aria-hidden="true" />
                          <span>Change photo</span>
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  renderCoverArtwork()
                )}
              </div>

              {isEditingInline && (
                <button
                  type="button"
                  className="collection-cover-nav-btn next"
                  onClick={handleNextCover}
                  aria-label="Next cover style"
                  title="Next style"
                >
                  <ChevronRight aria-hidden="true" size={18} />
                </button>
              )}
            </div>

            {isEditingInline && (
              <div className="collection-cover-controls">
                <div className="collection-cover-dots" role="tablist" aria-label="Cover appearance styles">
                  <button
                    type="button"
                    className={`collection-cover-dot photo-dot ${collectionCoverMode === 'custom' ? 'active' : ''}`}
                    onClick={() => {
                      photoInputRef.current?.click()
                    }}
                    title={
                      collectionCustomCover
                        ? 'Change custom cover photo'
                        : 'Upload custom cover photo'
                    }
                    aria-label="Upload custom cover photo"
                  >
                    <Upload aria-hidden="true" size={13} />
                  </button>

                  <button
                    type="button"
                    className={`collection-cover-dot collage-dot ${collectionCoverMode === 'auto' ? 'active' : ''}`}
                    onClick={() => setCollectionCoverMode?.('auto')}
                    title="Auto collage"
                    aria-label="Auto collage"
                  >
                    <LayoutGrid aria-hidden="true" size={13} />
                  </button>

                  {([1, 2, 3, 4] as const).map((variant) => (
                    <button
                      key={variant}
                      type="button"
                      className={`collection-cover-dot ${collectionCoverMode === 'gradient' && collectionGradientVariant === variant ? 'active' : ''}`}
                      onClick={() => {
                        setCollectionCoverMode?.('gradient')
                        setCollectionGradientVariant?.(variant)
                      }}
                      title={`Gradient style ${variant}`}
                      aria-label={`Gradient style ${variant}`}
                    >
                      <span className="dot-pip" />
                    </button>
                  ))}
                </div>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    handleCoverFileUpload(file)
                  }}
                />
              </div>
            )}
          </div>
        )}

        <div className="universal-hero-info enlarged">
          {isEditingInline ? (
            <div className="universal-inline-edit-fields">
              <div className="tcp-inline-field-group">
                <label className="tcp-inline-label">Collection Title</label>
                <input
                  className="universal-inline-title-input"
                  value={collectionName}
                  onChange={(e) => setCollectionName(e.target.value)}
                  maxLength={50}
                  placeholder="Collection title..."
                  aria-label="Collection title"
                  autoFocus
                />
              </div>
              <div className="tcp-inline-field-group">
                <label className="tcp-inline-label">Description</label>
                <textarea
                  className="universal-inline-desc-input"
                  value={collectionDescription}
                  onChange={(e) => setCollectionDescription(e.target.value)}
                  maxLength={200}
                  rows={3}
                  placeholder="Add a description for this collection..."
                  aria-label="Collection description"
                />
                <div className="tcp-inline-char-count">{collectionDescription.length}/200</div>
              </div>
            </div>
          ) : (
            <>
              <h1 className="universal-hero-title enlarged">{collection.name}</h1>
              {collection.description?.trim() ? (
                <p className="universal-hero-description">{collection.description}</p>
              ) : null}
            </>
          )}

          {/* Action Menus: Limited to two (or three if other user) + Triple Dots */}
          <div className="universal-hero-buttons">
            {isOwnedByCurrentUser ? (
              isEditingInline ? (
                <>
                  <button
                    type="button"
                    className="universal-btn primary"
                    onClick={onSaveInlineEdit}
                    disabled={!collectionName.trim() || (collectionCoverMode === 'custom' && !collectionCustomCover)}
                  >
                    <Check size={14} aria-hidden="true" />
                    <span>Done Editing</span>
                  </button>
                  <button type="button" className="universal-btn secondary" onClick={onCancelInlineEdit}>
                    <span>Discard</span>
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="universal-btn primary" onClick={onAddMedia}>
                    <Plus size={14} aria-hidden="true" />
                    <span>Add Media</span>
                  </button>
                  <button type="button" className="universal-btn secondary" onClick={onStartInlineEdit}>
                    <Edit3 size={14} aria-hidden="true" />
                    <span>Edit</span>
                  </button>
                </>
              )
            ) : (
              <button
                type="button"
                className={`universal-btn ${isSaved ? 'is-saved' : 'primary'}`}
                onClick={onToggleSave}
              >
                <Bookmark size={15} fill={isSaved ? 'currentColor' : 'none'} aria-hidden="true" />
                <span>{isSaved ? 'Saved in Collection' : 'Save Collection'}</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── Universal Body: Masonry Grid (Left/Center) + Right Insights Sidebar ── */}
      <div className="universal-layout-body">
        {/* Left / Center: Collection Masonry Grid */}
        <main className="universal-main-pane">
          {/* Main Pane Toolbar: Item Counter moved next to Search In Collection */}
          <div className="universal-pane-header">
            <div className="universal-items-counter-tag">
              <strong>{displayedItems.length}</strong> {displayedItems.length === 1 ? 'item' : 'items'}
              {selectedTypeFilter !== 'all' && (
                <button
                  type="button"
                  className="universal-clear-filter-btn"
                  onClick={() => setSelectedTypeFilter('all')}
                  title="Clear format filter"
                >
                  (Filtered by {getTypeMeta(selectedTypeFilter).label} — Show all)
                </button>
              )}
            </div>

            <div className="universal-search-box">
              <Search size={14} aria-hidden="true" />
              <input
                type="text"
                placeholder="Search in collection..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search in collection"
              />
            </div>
          </div>

          {/* ── MASONRY GRID OF THE COLLECTION (No entity container box, 4 items per row) ── */}
          {displayedItems.length === 0 ? (
            <div className="universal-empty">
              <Layers size={32} aria-hidden="true" />
              <p>No matching items in this collection.</p>
            </div>
          ) : (
            <section
              className="universal-masonry-container four-col"
              aria-label={`${collection.name} media items`}
            >
              {masonryColumns.map((colItems, colIdx) => (
                <div key={colIdx} className="universal-masonry-column">
                  {colItems.map((entry) => {
                    const isSpotlighted = spotlightItem?.id === entry.id
                    const { label } = getTypeMeta(entry.type)
                    const isSquareArtwork = entry.type === 'album' || entry.type === 'song'

                    return (
                      <article
                        key={entry.id}
                        className={`universal-media-entity ${isSpotlighted ? 'is-spotlighted' : ''} ${isEditingInline && isSpotlighted ? 'is-featured-edit' : ''}`}
                        data-id={entry.id}
                        onClick={() => {
                          setSpotlightItemId(entry.id)
                          handleOpenEntry(entry)
                        }}
                      >
                        {/* Artwork Stage: contains the clipped artwork + unclipped card action ellipsis */}
                        <div className="universal-entity-art-stage">
                          {/* Media Artwork (No container box!) */}
                          <div className={`universal-entity-art ${isSquareArtwork ? 'is-square' : 'is-poster'}`}>
                            {entry.coverUrl ? (
                              <img src={entry.coverUrl} alt={entry.title} className="universal-entity-img" loading="lazy" />
                            ) : (
                              <div className="universal-entity-fallback">{renderTypeIcon(entry.type, 30)}</div>
                            )}

                            <span className="universal-entity-type-badge">
                              {renderTypeIcon(entry.type, 11)}
                              <span>{label}</span>
                            </span>

                            {/* Featured Item Badge in Edit Mode */}
                            {isEditingInline && isSpotlighted && (
                              <span className="universal-featured-ribbon">
                                <Star size={10} fill="currentColor" aria-hidden="true" />
                                <span>Featured</span>
                              </span>
                            )}
                          </div>

                          {/* Consolidate Remove & Feature on Card Ellipsis (Unclipped) */}
                          {isOwnedByCurrentUser && isEditingInline && (
                            <div className="universal-card-actions-wrap" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                className="universal-card-ellipsis-btn"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setActiveCardMenuId((prev) => (prev === entry.id ? null : entry.id))
                                }}
                                title="Item options"
                                aria-label={`Options for ${entry.title}`}
                              >
                                <MoreHorizontal size={14} aria-hidden="true" />
                              </button>

                              {activeCardMenuId === entry.id && (
                                <div className="universal-card-menu-dropdown" role="menu">
                                  <button
                                    type="button"
                                    className={`universal-card-menu-item ${isSpotlighted ? 'is-active-feature' : ''}`}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSpotlightItemId(entry.id)
                                      setActiveCardMenuId(null)
                                    }}
                                    role="menuitem"
                                  >
                                    <Star size={13} fill={isSpotlighted ? 'currentColor' : 'none'} aria-hidden="true" />
                                    <span>{isSpotlighted ? 'Featured item (Active)' : 'Feature this item'}</span>
                                  </button>

                                  <button
                                    type="button"
                                    className="universal-card-menu-item danger"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setActiveCardMenuId(null)
                                      onRemoveItem?.(entry)
                                    }}
                                    role="menuitem"
                                  >
                                    <Trash2 size={13} aria-hidden="true" />
                                    <span>Remove from collection</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Media Copy */}
                        <div className="universal-entity-copy">
                          <strong className="universal-entity-title" title={entry.title}>
                            {entry.title}
                          </strong>
                          <small className="universal-entity-meta">
                            {entry.creator}
                            {entry.year ? ` · ${entry.year}` : ''}
                          </small>
                        </div>
                      </article>
                    )
                  })}
                </div>
              ))}
            </section>
          )}
        </main>

        {/* Right Sidebar: Curator at Top, Combined Filter/Media Mix, Spotlight, Comments */}
        <aside className="universal-sidebar" aria-label="Universal Collection Insights">
          {/* 1. Curator Profile Card (Moved to the very top!) */}
          <div className="universal-side-widget curator-widget">
            <h4 className="universal-widget-title">Collection by:</h4>
            <div className="universal-curator-card" onClick={handleOpenCuratorProfile} role="button" tabIndex={0}>
              <div className="curator-avatar" aria-hidden="true">
                {(creatorDisplay || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="curator-details">
                <strong className="curator-name">{creatorDisplay}</strong>
                <small className="curator-handle">@{creatorHandle.replace(/^@/, '')}</small>
                <div className="curator-stats-line">
                  <Users size={11} aria-hidden="true" />
                  <span>{followersCount} Followers</span>
                  <span className="stats-dot">·</span>
                  <span>{followingCount} Following</span>
                </div>
              </div>
              <ExternalLink size={14} className="curator-link-icon" aria-hidden="true" />
            </div>

            {/* Follow button if viewing another user's collection */}
            {!isOwnedByCurrentUser && onToggleFollow && (
              <button
                type="button"
                className={`universal-follow-btn ${isFollowingUser ? 'is-following' : ''}`}
                onClick={onToggleFollow}
              >
                {isFollowingUser ? (
                  <>
                    <UserCheck size={13} aria-hidden="true" />
                    <span>Following</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={13} aria-hidden="true" />
                    <span>Follow</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* 2. Spotlight / Featured Item Work in Collection (Moved directly below Curator!) */}
          {spotlightItem && (
            <div className="universal-side-widget spotlight-widget">
              <div className="universal-spotlight-top">
                <div className="universal-spotlight-thumb">
                  {spotlightItem.coverUrl ? (
                    <img src={spotlightItem.coverUrl} alt="" />
                  ) : (
                    renderTypeIcon(spotlightItem.type, 22)
                  )}
                </div>
                <div className="universal-spotlight-copy">
                  <span className="spotlight-badge">Featured Item</span>
                  <strong className="spotlight-title">{spotlightItem.title}</strong>
                  <p className="spotlight-artist">{spotlightItem.creator}</p>
                </div>
              </div>

              <button
                type="button"
                className="universal-spotlight-open-btn"
                onClick={() => handleOpenEntry(spotlightItem)}
              >
                <span>Explore Media</span>
                <ExternalLink size={13} aria-hidden="true" />
              </button>
            </div>
          )}

          {/* 3. Combined Format Filter & Media Mix Breakdown */}
          <div className="universal-side-widget">
            <div className="universal-widget-split">
              <h4 className="universal-widget-title">Media Filter &amp; Mix</h4>
              <button
                type="button"
                className={`universal-filter-pill-reset ${selectedTypeFilter === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedTypeFilter('all')}
              >
                All ({items.length})
              </button>
            </div>

            {/* Distribution Bar */}
            <div className="universal-distribution-bar" role="progressbar" aria-label="Media distribution">
              {typeBreakdown.map((seg) => (
                <div
                  key={seg.type}
                  className="universal-bar-seg"
                  style={{ width: `${seg.pct}%`, background: seg.color }}
                  title={`${seg.label}: ${seg.count} (${seg.pct}%)`}
                />
              ))}
            </div>

            {/* Interactive Format Filter List */}
            <div className="universal-breakdown-legend">
              {typeBreakdown.map((seg) => {
                const isActive = selectedTypeFilter === seg.type
                return (
                  <button
                    key={seg.type}
                    type="button"
                    className={`breakdown-legend-btn ${isActive ? 'is-selected' : ''}`}
                    onClick={() => setSelectedTypeFilter(isActive ? 'all' : seg.type)}
                    title={`Filter by ${seg.label}`}
                  >
                    <span className="legend-dot" style={{ background: seg.color }} />
                    <span className="legend-label">{seg.label}</span>
                    <strong className="legend-count">{seg.count}</strong>
                    <span className="legend-pct">{seg.pct}%</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 4. Comments Section in Right Panel */}
          <CollectionCommentsSection
            collectionId={collection.id}
            collectionName={collection.name}
            currentUserHandle={currentUserHandle || 'reader'}
            commentsDisabled={commentsDisabled}
            isCollectionOwner={isOwnedByCurrentUser}
          />
        </aside>
      </div>
    </div>
  )
}

export default UniversalCollectionLayout
