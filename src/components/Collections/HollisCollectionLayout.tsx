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
  BookOpen,
  Film,
  Music,
  Disc3,
  Tv,
  Gamepad2,
  Check,
  Minus,
  MoreHorizontal,
  Share2,
  MessageSquareOff,
  MessageSquare,
  Users,
  ExternalLink,
  UserPlus,
  UserCheck,
  LayoutGrid,
  Eye,
  EyeOff,
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

export const HollisCollectionLayout: React.FC<AlternativeCollectionDetailProps> = ({
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

  // Multi-select format filter: empty array means "All Items"
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')

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

  // Close triple dots menu on outside click
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

  // Type counts
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    items.forEach((item) => {
      counts[item.type] = (counts[item.type] || 0) + 1
    })
    return counts
  }, [items])

  const uniqueTypes = useMemo(() => Object.keys(typeCounts), [typeCounts])

  // Toggle multi-select media type
  const handleToggleType = (type: string) => {
    if (type === 'all') {
      setSelectedTypes([])
      return
    }
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    )
  }

  // Filtered entries
  const filteredItems = useMemo(() => {
    let result = [...items]

    if (selectedTypes.length > 0) {
      result = result.filter((item) => selectedTypes.includes(item.type))
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
  }, [items, selectedTypes, searchQuery])

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
    filteredItems.forEach((entry, idx) => {
      cols[idx % columnCount].push(entry)
    })
    return cols
  }, [filteredItems, columnCount])

  // Check if gradient cover is used
  const isGradientCover = useMemo(() => {
    if (isEditingInline && collectionCoverMode) {
      return collectionCoverMode === 'gradient'
    }
    return (
      collection.coverMode === 'gradient' ||
      Boolean(collection.coverStyle?.startsWith('gradient-')) ||
      Boolean(collection.customCoverUrl?.startsWith('data:image/svg+xml'))
    )
  }, [isEditingInline, collectionCoverMode, collection.coverMode, collection.coverStyle, collection.customCoverUrl])

  const showCoverBox = isEditingInline || !isGradientCover || devSettings.showCoverOnGradient

  const currentGradientVariant = useMemo(() => {
    const rawVariant = (isEditingInline && collectionGradientVariant)
      ? collectionGradientVariant
      : collection.coverStyle?.startsWith('gradient-')
        ? Number(collection.coverStyle.replace('gradient-', ''))
        : 1
    return (rawVariant >= 1 && rawVariant <= 4 ? rawVariant : 1) as 1 | 2 | 3 | 4
  }, [isEditingInline, collectionGradientVariant, collection.coverStyle])

  const gradientHeroStyle = useMemo(() => {
    if (!isGradientCover) return undefined
    return getGradientHeroBannerStyle(currentGradientVariant, items)
  }, [isGradientCover, currentGradientVariant, items])

  const isGradientLight = isGradientCover && (currentGradientVariant === 3 || currentGradientVariant === 4)

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
    <div className="hollis-collection-root">
      {/* ── Top Bar: Back Button & Dev Switcher ── */}
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
                className="hollis-btn icon-only tcp-alt-top-menu-btn"
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

      {/* ── Hollis Hero Header ── */}
      <header
        className={`hollis-hero ${isGradientCover ? 'is-gradient-bg' : ''} ${isGradientLight ? 'is-gradient-light' : ''}`}
        style={gradientHeroStyle}
      >
        <div className="hollis-hero-main">
          {isEditingInline ? (
            <div className="hollis-inline-edit-fields">
              <div className="tcp-inline-field-group">
                <label className="tcp-inline-label">Collection Title</label>
                <input
                  className="hollis-inline-input"
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
                  className="hollis-inline-textarea"
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
              <h1 className="hollis-hero-title">{collection.name}</h1>
              {collection.description?.trim() ? (
                <p className="hollis-hero-desc">{collection.description}</p>
              ) : null}
            </>
          )}

          {/* Action Menus: Limited to two (or three if other user) + Triple Dots */}
          <div className="hollis-hero-actions">
            {isOwnedByCurrentUser ? (
              isEditingInline ? (
                <>
                  <button
                    type="button"
                    className="hollis-btn primary"
                    onClick={onSaveInlineEdit}
                    disabled={!collectionName.trim() || (collectionCoverMode === 'custom' && !collectionCustomCover)}
                  >
                    <Check size={14} aria-hidden="true" />
                    <span>Done Editing</span>
                  </button>
                  <button type="button" className="hollis-btn secondary" onClick={onCancelInlineEdit}>
                    <span>Discard</span>
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="hollis-btn primary" onClick={onAddMedia}>
                    <Plus size={14} aria-hidden="true" />
                    <span>Add Media</span>
                  </button>
                  <button type="button" className="hollis-btn secondary" onClick={onStartInlineEdit}>
                    <Edit3 size={14} aria-hidden="true" />
                    <span>Edit</span>
                  </button>
                </>
              )
            ) : (
              <button
                type="button"
                className={`hollis-btn ${isSaved ? 'saved' : 'secondary'}`}
                onClick={onToggleSave}
              >
                <Bookmark size={14} fill={isSaved ? 'currentColor' : 'none'} aria-hidden="true" />
                <span>{isSaved ? 'Saved in Collection' : 'Save Collection'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Square Cover Artwork Column: Vertically centered, with cover selector when editing */}
        {showCoverBox && (
          <div className="hollis-hero-cover-column">
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
                className="hollis-hero-art-frame"
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
      </header>

      {/* ── Hollis Body: Left Panel (Filters & Comments) + Right Main Area (Masonry Grid) ── */}
      <div className="hollis-catalog-shell">
        {/* Left Sidepanel: Created by, Multi-select Format Filter, and Comments */}
        <aside className="hollis-filters-sidebar" aria-label="Collection filters and discussion">
          {/* 1. Created by Curator Card */}
          <div className="hollis-curator-card-widget">
            <h4 className="hollis-sidebar-heading">Created by:</h4>
            <div
              className="hollis-curator-card"
              onClick={handleOpenCuratorProfile}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleOpenCuratorProfile()}
            >
              <div className="curator-avatar" aria-hidden="true">
                {(creatorDisplay || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="curator-details">
                <strong className="curator-name">{creatorDisplay}</strong>
                {creatorHandle && <small className="curator-handle">@{creatorHandle.replace(/^@/, '')}</small>}
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
                className={`hollis-follow-btn ${isFollowingUser ? 'is-following' : ''}`}
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

          {/* Multi-select Media Format Filters */}
          <div className="hollis-filter-group">
            <span className="hollis-filter-group-title">Media Format</span>
            <div className="hollis-pill-wrap" role="toolbar" aria-label="Filter items by format">
              <button
                type="button"
                className={`hollis-filter-pill ${selectedTypes.length === 0 ? 'is-active' : ''}`}
                onClick={() => handleToggleType('all')}
              >
                <span>All Formats</span>
                <span className="pill-count">{items.length}</span>
              </button>
              {uniqueTypes.map((type) => {
                const count = typeCounts[type] || 0
                const isSelected = selectedTypes.includes(type)
                const { label } = getTypeMeta(type)
                return (
                  <button
                    key={type}
                    type="button"
                    className={`hollis-filter-pill ${isSelected ? 'is-active' : ''}`}
                    onClick={() => handleToggleType(type)}
                    title={isSelected ? `Deselect ${label}` : `Filter by ${label}`}
                  >
                    {renderTypeIcon(type as EntryType, 12)}
                    <span>{label}</span>
                    <span className="pill-count">{count}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Comments Panel */}
          <CollectionCommentsSection
            collectionId={collection.id}
            collectionName={collection.name}
            currentUserHandle={currentUserHandle || 'reader'}
            commentsDisabled={commentsDisabled}
            isCollectionOwner={isOwnedByCurrentUser}
          />
        </aside>

        {/* Right Main Grid Area: Separated Header & 4-Column Masonry Grid */}
        <main className="hollis-main-content">
          {/* Main Pane Toolbar: Item Counter and Search Bar in container, separated */}
          <div className="hollis-pane-header">
            <div className="hollis-items-counter-tag">
              <strong>{filteredItems.length}</strong> {filteredItems.length === 1 ? 'item' : 'items'}
              {selectedTypes.length > 0 && (
                <button
                  type="button"
                  className="hollis-clear-filter-btn"
                  onClick={() => setSelectedTypes([])}
                  title="Clear format filter"
                >
                  (Filtered by {selectedTypes.map((t) => getTypeMeta(t).label).join(', ')} — Show all)
                </button>
              )}
            </div>

            <div className="hollis-search-box">
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

          {/* ── Collection Masonry Grid (No entity container box, 4 items per row) ── */}
          {filteredItems.length === 0 ? (
            <div className="hollis-empty-state">
              <Layers size={36} aria-hidden="true" />
              <h3>No matching items found</h3>
              <p>Try clearing your format filter or search query to see more items in this collection.</p>
            </div>
          ) : (
            <section
              className="hollis-masonry-container four-col"
              aria-label={`${collection.name} media items`}
            >
              {masonryColumns.map((colItems, colIdx) => (
                <div key={colIdx} className="hollis-masonry-column">
                  {colItems.map((entry) => {
                    const { label } = getTypeMeta(entry.type)
                    const isSquareArtwork = entry.type === 'album' || entry.type === 'song'

                    return (
                      <article
                        key={entry.id}
                        className="hollis-media-entity"
                        data-id={entry.id}
                        onClick={() => handleOpenEntry(entry)}
                      >
                        {/* Media Artwork (No container box!) */}
                        <div className={`hollis-entity-art ${isSquareArtwork ? 'is-square' : 'is-poster'}`}>
                          {entry.coverUrl ? (
                            <img src={entry.coverUrl} alt={entry.title} className="hollis-entity-img" loading="lazy" />
                          ) : (
                            <div className="hollis-entity-fallback">{renderTypeIcon(entry.type, 30)}</div>
                          )}

                          <span className="hollis-entity-type-badge">
                            {renderTypeIcon(entry.type, 11)}
                            <span>{label}</span>
                          </span>

                          <div className="hollis-entity-sheen" aria-hidden="true" />

                          {isOwnedByCurrentUser && isEditingInline && (
                            <button
                              type="button"
                              className="hollis-entity-remove-btn"
                              onClick={(e) => {
                                e.stopPropagation()
                                onRemoveItem?.(entry)
                              }}
                              title={`Remove ${entry.title} from collection`}
                              aria-label={`Remove ${entry.title}`}
                            >
                              <Minus size={13} aria-hidden="true" />
                            </button>
                          )}
                        </div>

                        {/* Media Copy */}
                        <div className="hollis-entity-copy">
                          <strong className="hollis-entity-title" title={entry.title}>
                            {entry.title}
                          </strong>
                          <small className="hollis-entity-meta">
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
      </div>
    </div>
  )
}

export default HollisCollectionLayout
