import React, { useState, useMemo, useRef, useEffect } from 'react'
import {
  ArrowLeft,
  Plus,
  Edit3,
  Trash2,
  Bookmark,
  Layers,
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
  ArrowDownAZ,
  ArrowUpZA,
  Shuffle,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Entry, EntryType } from '../../features/entries/model'
import { getGradientHeroBannerStyle } from '../../utils/collectionCovers'
import { searchTokensMatch } from '../../utils/text'
import { detectImageLuminance } from '../../utils/imageLuminance'
import { CollectionCommentsSection } from './CollectionCommentsSection'
import { ShareMenuDialog, type ShareTargetInfo } from '../Share/ShareMenuDialog'
import { showToast } from '../../utils/toast'
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
  isEditingInline,
  collectionName,
  setCollectionName,
  collectionDescription,
  setCollectionDescription,
  onSaveInlineEdit,
  onCancelInlineEdit,
  onBack,
  onOpenMedia,
  onOpenUserProfile,
  onAddMedia,
  onStartInlineEdit,
  onDeleteCollection,
  onToggleSave,
  onRemoveItem,
  onRemoveItems,
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
  onToast,
}) => {
  const photoInputRef = useRef<HTMLInputElement>(null)

  const handleNotify = (message: string, type: 'success' | 'error' | 'info' = 'error') => {
    if (onToast) {
      onToast(message, type)
    }
    showToast(message, type === 'error' ? 'error' : 'success')
  }

  // Multi-select format filter: empty array means "All Items"
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [spotlightItemId, setSpotlightItemId] = useState<string | null>(items[0]?.id ?? null)

  // Items marked/selected for batch deletion in edit mode
  const [markedItemIds, setMarkedItemIds] = useState<Set<string>>(new Set())

  // Reordering & sorting state for edit mode
  const [orderedItems, setOrderedItems] = useState<Entry[]>(items)
  const initialOrderRef = useRef<Entry[]>(items)
  const [activeSort, setActiveSort] = useState<'az-asc' | 'az-desc' | 'random' | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const prevEditingRef = useRef(isEditingInline)
  const prevItemsRef = useRef(items)
  const [badgeThemeMap, setBadgeThemeMap] = useState<Record<string, 'dark' | 'light'>>({})

  const toggleMarkItem = (id: string) => {
    setMarkedItemIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleDeleteMarkedItems = () => {
    if (markedItemIds.size === 0) return
    const markedEntries = orderedItems.filter((it) => markedItemIds.has(it.id))
    if (onRemoveItems) {
      onRemoveItems(markedEntries)
    } else if (onRemoveItem) {
      markedEntries.forEach((entry) => onRemoveItem(entry))
    } else {
      setOrderedItems((prev) => prev.filter((it) => !markedItemIds.has(it.id)))
      setMarkedItemIds(new Set())
    }
  }

  useEffect(() => {
    orderedItems.forEach((entry) => {
      if (entry.coverUrl) {
        detectImageLuminance(entry.coverUrl, (theme) => {
          setBadgeThemeMap((prev) => (prev[entry.id] === theme ? prev : { ...prev, [entry.id]: theme }))
        })
      }
    })
  }, [orderedItems])

  useEffect(() => {
    const isEnteringEdit = isEditingInline && !prevEditingRef.current
    const itemsChanged = prevItemsRef.current !== items
    prevEditingRef.current = isEditingInline
    prevItemsRef.current = items

    if (isEnteringEdit) {
      setOrderedItems(items)
      initialOrderRef.current = items
      setActiveSort(null)
      setDraggedId(null)
      setDragOverId(null)
      setMarkedItemIds(new Set())
    } else if (!isEditingInline) {
      setOrderedItems(items)
      initialOrderRef.current = items
      setActiveSort(null)
      setMarkedItemIds(new Set())
    } else if (itemsChanged) {
      const currentIds = new Set(items.map((it) => it.id))
      setOrderedItems((prev) => {
        const remaining = prev.filter((it) => currentIds.has(it.id))
        const existingIds = new Set(remaining.map((it) => it.id))
        const added = items.filter((it) => !existingIds.has(it.id))
        return [...remaining, ...added]
      })
      initialOrderRef.current = initialOrderRef.current.filter((it) => currentIds.has(it.id))
      setMarkedItemIds((prev) => {
        const next = new Set([...prev].filter((id) => currentIds.has(id)))
        return next
      })
    }
  }, [isEditingInline, items])

  const handleSort = (type: 'az-asc' | 'az-desc' | 'random') => {
    if (activeSort === type) {
      // Re-clicking the active sort returns to the original, non sorted layout
      setActiveSort(null)
      setOrderedItems([...initialOrderRef.current])
      return
    }

    setActiveSort(type)
    if (type === 'az-asc') {
      const sorted = [...orderedItems].sort((a, b) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true })
      )
      setOrderedItems(sorted)
    } else if (type === 'az-desc') {
      const sorted = [...orderedItems].sort((a, b) =>
        b.title.localeCompare(a.title, undefined, { sensitivity: 'base', numeric: true })
      )
      setOrderedItems(sorted)
    } else if (type === 'random') {
      const shuffled = [...orderedItems]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      setOrderedItems(shuffled)
    }
  }

  // Triple dots popover menu
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [shareTarget, setShareTarget] = useState<ShareTargetInfo | null>(null)

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

  const handleToggleCommentsDisabled = () => {
    const next = !commentsDisabled
    setCommentsDisabled(next)
    try {
      localStorage.setItem(`tcp.collection_comments_disabled.${collection.id}`, String(next))
    } catch {
      /* Storage can be unavailable. */
    }
    setMenuOpen(false)
  }

  const handleShareCollection = () => {
    setMenuOpen(false)
    setShareTarget({
      title: collection.name,
      url: window.location.href,
      text: collection.description || `Curated collection by ${creatorDisplay}`,
      typeLabel: 'Collection',
    })
  }

  const handleOpenEntry = (entry: Entry) => {
    onOpenMedia?.(entry)
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

  // Type counts
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    items.forEach((item) => {
      counts[item.type] = (counts[item.type] || 0) + 1
    })
    return counts
  }, [items])

  const uniqueTypes = useMemo(() => Object.keys(typeCounts), [typeCounts])

  const handleToggleType = (type: string) => {
    if (type === 'all') {
      setSelectedTypes([])
      return
    }
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    )
  }

  // Filtered items
  const displayedItems = useMemo(() => {
    let result = [...orderedItems]
    if (selectedTypes.length > 0) {
      result = result.filter((item) => selectedTypes.includes(item.type))
    }
    if (searchQuery.trim()) {
      result = result.filter((item) => {
        const itemText = [item.title, item.creator, item.year ? String(item.year) : ''].filter(Boolean).join(' ')
        return searchTokensMatch(itemText, searchQuery)
      })
    }
    return result
  }, [orderedItems, selectedTypes, searchQuery])

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
    if (!spotlightItemId) return displayedItems[0] ?? orderedItems[0] ?? null
    return orderedItems.find((item) => item.id === spotlightItemId) ?? displayedItems[0] ?? orderedItems[0] ?? null
  }, [orderedItems, displayedItems, spotlightItemId])

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

  const hasGradientItems = items.length > 0
  const isGradientLight = isContainerGradient && hasGradientItems && (currentGradientVariant === 3 || currentGradientVariant === 4)
  const isGradientDark = isContainerGradient && (!hasGradientItems || currentGradientVariant === 1 || currentGradientVariant === 2)
  const showCoverColumn = !isContainerGradient || isEditingInline

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
    if (!file) return
    if (!file.type.startsWith('image/')) {
      handleNotify('Please select a valid image file.', 'error')
      return
    }
    try {
      if (onCoverUpload) {
        onCoverUpload(file)
      }
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setCollectionCustomCover?.(reader.result)
          setCollectionCoverMode?.('custom')
        } else {
          handleNotify('An error has occurred.', 'error')
        }
      }
      reader.onerror = () => {
        handleNotify('An error has occurred.', 'error')
      }
      reader.readAsDataURL(file)
    } catch {
      handleNotify('An error has occurred.', 'error')
    }
  }

  return (
    <div className={`universal-collection-root ${isEditingInline ? 'is-editing' : ''}`}>
      {/* ── Top Bar: Back Button & Collection Menu ── */}
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

      </div>

      {/* ── Universal Hero Banner (Website color palette, no red outline!) ── */}
      <section
        className={`universal-hero ${isContainerGradient ? 'is-gradient-bg' : ''} ${isGradientLight ? 'is-gradient-light' : ''} ${isGradientDark ? 'is-gradient-dark' : ''}`}
        style={gradientHeroStyle}
      >
        {/* Square Cover Artwork Column: hidden for gradients unless editing so users can change their cover */}
        {showCoverColumn && (
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
                  {(() => {
                    const hasUploadedPhoto = Boolean(collectionCustomCover) && !collectionCustomCover.startsWith('data:image/svg+xml')
                    return (
                      <button
                        type="button"
                        className={`collection-cover-dot photo-dot ${collectionCoverMode === 'custom' ? 'active' : ''} ${hasUploadedPhoto ? 'has-uploaded' : 'is-empty-placeholder'}`}
                        onClick={() => {
                          if (collectionCoverMode === 'custom' || !hasUploadedPhoto) {
                            photoInputRef.current?.click()
                          } else {
                            setCollectionCoverMode?.('custom')
                          }
                        }}
                        title={hasUploadedPhoto ? 'Click to upload photo' : 'Click to add photo'}
                        aria-label={hasUploadedPhoto ? 'Click to upload photo' : 'Click to add photo'}
                      >
                        {hasUploadedPhoto ? (
                          <span className="photo-dot-thumb-wrap">
                            <img src={collectionCustomCover} alt="" className="photo-dot-thumb" draggable={false} />
                            <span className="photo-dot-hover-icon" aria-hidden="true">
                              <Upload size={10} />
                            </span>
                          </span>
                        ) : (
                          <Upload aria-hidden="true" size={13} />
                        )}
                      </button>
                    )
                  })()}

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
                    onClick={() => {
                      if (!collectionName.trim()) {
                        handleNotify('Please enter a collection title.', 'error')
                        return
                      }
                      if (collectionCoverMode === 'custom' && !collectionCustomCover) {
                        handleNotify('No pictures added', 'error')
                        return
                      }
                      try {
                        onSaveInlineEdit(orderedItems.map((item) => item.id))
                      } catch {
                        handleNotify('An error has occurred.', 'error')
                      }
                    }}
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
                      <span>Share Collection</span>
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
      </section>

      {/* ── Universal Body: Left Insights Sidebar + Masonry Grid ── */}
      <div className="universal-layout-body">
        {/* Main Collection Masonry Grid */}
        <main className="universal-main-pane">
          {/* Main Pane Toolbar: Item Counter moved next to Search In Collection */}
          <div className="universal-pane-header">
            <div className="universal-items-counter-tag">
              <strong>{displayedItems.length}</strong> {displayedItems.length === 1 ? 'item' : 'items'}
              {selectedTypes.length > 0 && (
                <button
                  type="button"
                  className="universal-clear-filter-btn"
                  onClick={() => setSelectedTypes([])}
                  title="Clear filters"
                >
                  (Filtered by {selectedTypes.map((type) => getTypeMeta(type).label).join(', ')} — Show all)
                </button>
              )}
            </div>

            {isEditingInline && (
              <div className="universal-edit-sort-bar" role="toolbar" aria-label="Sort collection items">
                <span className="universal-edit-sort-title">Sort:</span>
                <button
                  type="button"
                  className={`universal-edit-sort-btn ${activeSort === 'az-asc' ? 'is-active' : ''}`}
                  onClick={() => handleSort('az-asc')}
                  title={activeSort === 'az-asc' ? 'Click to reset to original order' : 'Sort A to Z'}
                  aria-pressed={activeSort === 'az-asc'}
                >
                  <ArrowDownAZ size={13} aria-hidden="true" />
                  <span>A–Z</span>
                </button>
                <button
                  type="button"
                  className={`universal-edit-sort-btn ${activeSort === 'az-desc' ? 'is-active' : ''}`}
                  onClick={() => handleSort('az-desc')}
                  title={activeSort === 'az-desc' ? 'Click to reset to original order' : 'Sort Z to A'}
                  aria-pressed={activeSort === 'az-desc'}
                >
                  <ArrowUpZA size={13} aria-hidden="true" />
                  <span>Z–A</span>
                </button>
                <button
                  type="button"
                  className={`universal-edit-sort-btn ${activeSort === 'random' ? 'is-active' : ''}`}
                  onClick={() => handleSort('random')}
                  title={activeSort === 'random' ? 'Click to reset to original order' : 'Randomize items'}
                  aria-pressed={activeSort === 'random'}
                >
                  <Shuffle size={13} aria-hidden="true" />
                  <span>Random</span>
                </button>

                <div className="universal-edit-sort-divider" aria-hidden="true" />

                <button
                  type="button"
                  className={`universal-edit-delete-btn ${markedItemIds.size > 0 ? 'is-active' : 'is-disabled'}`}
                  disabled={markedItemIds.size === 0}
                  onClick={handleDeleteMarkedItems}
                  title={
                    markedItemIds.size > 0
                      ? `Delete ${markedItemIds.size} marked item${markedItemIds.size > 1 ? 's' : ''}`
                      : 'Select items below to delete'
                  }
                  aria-label={
                    markedItemIds.size > 0
                      ? `Delete ${markedItemIds.size} marked items`
                      : 'Delete marked items (none selected)'
                  }
                >
                  <Trash2 size={13} aria-hidden="true" />
                  <span>Delete{markedItemIds.size > 0 ? ` (${markedItemIds.size})` : ''}</span>
                </button>
              </div>
            )}

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
                        className={`universal-media-entity ${isSpotlighted ? 'is-spotlighted' : ''} ${isEditingInline && isSpotlighted ? 'is-featured-edit' : ''} ${isEditingInline ? 'is-editing-mode' : ''} ${isEditingInline && markedItemIds.has(entry.id) ? 'is-marked' : ''} ${draggedId === entry.id ? 'is-dragging' : ''} ${dragOverId === entry.id && draggedId !== entry.id ? 'is-drag-over' : ''}`}
                        data-id={entry.id}
                        draggable={isEditingInline}
                        onDragStart={(e) => {
                          if (!isEditingInline) return
                          e.dataTransfer.setData('text/plain', entry.id)
                          e.dataTransfer.effectAllowed = 'move'
                          setDraggedId(entry.id)
                        }}
                        onDragOver={(e) => {
                          if (!isEditingInline) return
                          e.preventDefault()
                          e.dataTransfer.dropEffect = 'move'
                          if (dragOverId !== entry.id) {
                            setDragOverId(entry.id)
                          }
                        }}
                        onDragLeave={(e) => {
                          if (dragOverId === entry.id && !e.currentTarget.contains(e.relatedTarget as Node)) {
                            setDragOverId(null)
                          }
                        }}
                        onDrop={(e) => {
                          if (!isEditingInline) return
                          e.preventDefault()
                          if (draggedId && draggedId !== entry.id) {
                            const fromIndex = orderedItems.findIndex((it) => it.id === draggedId)
                            const toIndex = orderedItems.findIndex((it) => it.id === entry.id)
                            if (fromIndex !== -1 && toIndex !== -1) {
                              const next = [...orderedItems]
                              const [moved] = next.splice(fromIndex, 1)
                              next.splice(toIndex, 0, moved)
                              setOrderedItems(next)
                              setActiveSort(null)
                            }
                          }
                          setDraggedId(null)
                          setDragOverId(null)
                        }}
                        onDragEnd={() => {
                          setDraggedId(null)
                          setDragOverId(null)
                        }}
                        onClick={() => {
                          if (isEditingInline) {
                            toggleMarkItem(entry.id)
                            return
                          }
                          setSpotlightItemId(entry.id)
                          handleOpenEntry(entry)
                        }}
                      >
                        {/* Artwork Stage: contains the clipped artwork + unclipped card action buttons */}
                        <div className="universal-entity-art-stage">
                          {/* Media Artwork (No container box!) */}
                          <div className={`universal-entity-art ${isSquareArtwork ? 'is-square' : 'is-poster'} ${badgeThemeMap[entry.id] ? `is-${badgeThemeMap[entry.id]}-bg` : ''}`}>
                            {entry.coverUrl ? (
                              <img
                                src={entry.coverUrl}
                                alt={entry.title}
                                className="universal-entity-img"
                                loading="lazy"
                                draggable={false}
                                onLoad={(e) => {
                                  const img = e.currentTarget
                                  try {
                                    const canvas = document.createElement('canvas')
                                    canvas.width = 16
                                    canvas.height = 16
                                    const ctx = canvas.getContext('2d', { willReadFrequently: true })
                                    if (!ctx) return
                                    const sampleW = Math.max(1, Math.round((img.naturalWidth || 100) * 0.35))
                                    const sampleH = Math.max(1, Math.round((img.naturalHeight || 100) * 0.25))
                                    ctx.drawImage(img, 0, 0, sampleW, sampleH, 0, 0, 16, 16)
                                    const { data } = ctx.getImageData(0, 0, 16, 16)
                                    let total = 0
                                    let count = 0
                                    for (let i = 0; i < data.length; i += 4) {
                                      if (data[i + 3] > 64) {
                                        total += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
                                        count++
                                      }
                                    }
                                    if (count > 0) {
                                      const theme: 'dark' | 'light' = total / count < 135 ? 'dark' : 'light'
                                      setBadgeThemeMap((prev) => (prev[entry.id] === theme ? prev : { ...prev, [entry.id]: theme }))
                                    }
                                  } catch {
                                    // CORS blocked canvas access - handled by fallback
                                  }
                                }}
                              />
                            ) : (
                              <div className="universal-entity-fallback">{renderTypeIcon(entry.type, 30)}</div>
                            )}

                            <span className={`universal-entity-type-badge ${badgeThemeMap[entry.id] ? `is-${badgeThemeMap[entry.id]}-bg` : ''}`}>
                              {renderTypeIcon(entry.type, 11)}
                              <span>{label}</span>
                            </span>
                          </div>

                          {/* Star button to pick feature item directly */}
                          {isOwnedByCurrentUser && isEditingInline && (
                            <button
                              type="button"
                              className={`universal-card-star-btn ${isSpotlighted ? 'is-featured' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                setSpotlightItemId(isSpotlighted ? null : entry.id)
                              }}
                              title={isSpotlighted ? 'Featured item (click to unfeature)' : 'Set as featured item'}
                              aria-label={isSpotlighted ? `Unfeature ${entry.title}` : `Feature ${entry.title}`}
                              aria-pressed={isSpotlighted}
                            >
                              <Star size={isSpotlighted ? 12 : 13} fill={isSpotlighted ? '#f59e0b' : 'none'} aria-hidden="true" />
                              {isSpotlighted && <span className="universal-card-star-label">Featured</span>}
                            </button>
                          )}

                          {/* Mark button to select item for deletion */}
                          {isOwnedByCurrentUser && isEditingInline && (
                            <button
                              type="button"
                              className={`universal-card-mark-btn ${markedItemIds.has(entry.id) ? 'is-marked' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleMarkItem(entry.id)
                              }}
                              title={markedItemIds.has(entry.id) ? 'Unmark item' : 'Mark item for deletion'}
                              aria-label={markedItemIds.has(entry.id) ? `Unmark ${entry.title}` : `Mark ${entry.title} for deletion`}
                              aria-checked={markedItemIds.has(entry.id)}
                              role="checkbox"
                            >
                              {markedItemIds.has(entry.id) && <Check size={14} strokeWidth={2.5} aria-hidden="true" />}
                            </button>
                          )}
                        </div>

                        {/* Media Copy */}
                        <div className="universal-entity-copy">
                          <strong className="universal-entity-title" title={entry.title}>
                            <span>{entry.title}</span>
                            {entry.explicit && <span className="explicit-badge explicit-badge--inline" aria-label="Explicit">E</span>}
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

        {/* Left Sidebar: Curator, Spotlight, Media Format Filter, Comments */}
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
                  <strong className="spotlight-title">
                    <span>{spotlightItem.title}</span>
                    {spotlightItem.explicit && <span className="explicit-badge explicit-badge--inline" aria-label="Explicit">E</span>}
                  </strong>
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

          {/* 3. Multi-select Media Format Filters */}
          <div className="universal-filter-group">
            <span className="universal-filter-group-title">Media Format</span>
            <div className="universal-pill-wrap" role="toolbar" aria-label="Filter items by format">
              <button
                type="button"
                className={`universal-filter-pill ${selectedTypes.length === 0 ? 'is-active' : ''}`}
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
                    className={`universal-filter-pill ${isSelected ? 'is-active' : ''}`}
                    onClick={() => handleToggleType(type)}
                    title={isSelected ? `Deselect ${label}` : `Filter by ${label}`}
                  >
                    <span className="universal-pill-label">
                      {renderTypeIcon(type as EntryType, 12)}
                      <span>{label}</span>
                    </span>
                    <span className="pill-count">{count}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 4. Comments Section in Left Panel */}
          <CollectionCommentsSection
            collectionId={collection.id}
            collectionName={collection.name}
            currentUserHandle={currentUserHandle || 'reader'}
            commentsDisabled={commentsDisabled}
            isCollectionOwner={isOwnedByCurrentUser}
            creatorHandle={creatorHandle || (collection as any).creatorHandle || ''}
          />
        </aside>
      </div>

      {/* Share Dialog */}
      <ShareMenuDialog
        isOpen={Boolean(shareTarget)}
        onClose={() => setShareTarget(null)}
        target={shareTarget}
        onToast={(msg) => handleNotify(msg, 'info')}
      />
    </div>
  )
}

export default UniversalCollectionLayout
