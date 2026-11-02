import {
  AlertTriangle,
  Check,
  Folder,
  FolderPlus,
  Plus,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import {
  addItemToProfileCollection,
  createProfileCollection,
  loadProfileCollections,
  profileCollectionHasItem,
  saveProfileCollections,
  type ProfileCollection,
  type ProfileCollectionItem,
} from '../../features/collections/profileCollections'
import { loadOrMigrateUserCollections, saveUserCollections } from '../../services/cloudData'
import { useAccessibleDialog } from '../../hooks/useAccessibleDialog'
import { getEntryTypeIcon } from '../../utils/mediaIcons'
import { getGradientCoverStyle } from '../../utils/collectionCovers'
import { searchTokensMatch } from '../../utils/text'

interface CollectionPickerModalProps {
  handle: string
  userId?: string | null
  item: ProfileCollectionItem
  onClose: () => void
}

function renderCollectionCover(collection: ProfileCollection) {
  const items = collection.items ?? []

  const isGradient =
    collection.coverMode === 'gradient' ||
    Boolean(collection.coverStyle?.startsWith('gradient-')) ||
    Boolean(collection.customCoverUrl?.startsWith('data:image/svg+xml'))

  if (isGradient) {
    const rawVariant = collection.coverStyle?.startsWith('gradient-')
      ? Number(collection.coverStyle.replace('gradient-', ''))
      : 1
    const variant = (rawVariant >= 1 && rawVariant <= 4 ? rawVariant : 1) as 1 | 2 | 3 | 4
    const isDark = variant === 1 || variant === 2
    return (
      <div
        className={`collection-apple-cover variant-${variant} ${items.length === 0 ? 'no-items' : ''}`}
        style={getGradientCoverStyle(variant, items)}
      >
        <span
          className="collection-apple-cover-title"
          style={{
            color: items.length === 0
              ? 'rgba(237, 229, 216, 0.45)'
              : (isDark ? '#ffffff' : '#0e0d0b'),
            textShadow: (items.length > 0 && isDark)
              ? '0 2px 10px rgba(0, 0, 0, 0.55)'
              : 'none',
          }}
        >
          {collection.name.trim() || 'Untitled Shelf'}
        </span>
      </div>
    )
  }

  const isCustom =
    (collection.coverMode === 'custom' ||
      (!collection.coverMode &&
        collection.customCoverUrl &&
        !collection.customCoverUrl.startsWith('data:image/svg+xml'))) &&
    Boolean(collection.customCoverUrl)

  if (isCustom && collection.customCoverUrl) {
    return (
      <img
        src={collection.customCoverUrl}
        alt=""
        className="collection-preview-custom-cover"
        loading="lazy"
        decoding="async"
      />
    )
  }

  if (items.length === 0) {
    return (
      <div className="collection-picker-grid-cover-fallback">
        <Folder size={26} aria-hidden="true" />
      </div>
    )
  }

  return (
    <div className="collection-preview-collage-grid">
      {Array.from({ length: 4 }, (_, index) => {
        const entry = items[index]
        if (!entry) {
          return <span key={`empty-slot-${index}`} className="empty" />
        }
        if (entry.coverUrl) {
          return (
            <span key={entry.id ?? `slot-${index}`}>
              <img src={entry.coverUrl} alt="" loading="lazy" decoding="async" />
            </span>
          )
        }
        const ItemIcon = getEntryTypeIcon(entry.type)
        return (
          <span key={entry.id ?? `slot-${index}`}>
            <ItemIcon size={16} aria-hidden="true" />
          </span>
        )
      })}
    </div>
  )
}

export function CollectionPickerModal({ handle, userId = null, item, onClose }: CollectionPickerModalProps) {
  const [collections, setCollections] = useState(() => loadProfileCollections(handle))
  const [newCollectionName, setNewCollectionName] = useState('')
  const [searchFilter, setSearchFilter] = useState('')
  const [duplicateCollectionId, setDuplicateCollectionId] = useState<string | null>(null)
  const duplicateCollection = collections.find((collection) => collection.id === duplicateCollectionId)
  const dialogRef = useAccessibleDialog<HTMLElement>({ open: true, onClose })
  const duplicateDialogRef = useAccessibleDialog<HTMLDivElement>({
    open: Boolean(duplicateCollection),
    onClose: () => setDuplicateCollectionId(null),
  })

  const MediaIcon = getEntryTypeIcon(item.type)
  const isSquareItem = item.type === 'album' || item.type === 'song'

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void loadOrMigrateUserCollections(userId, 'created', loadProfileCollections(handle))
      .then((nextCollections) => {
        if (!cancelled) {
          setCollections(nextCollections)
          saveProfileCollections(handle, nextCollections)
        }
      })
      .catch((error) => console.error('Unable to load collections from Supabase.', error))
    return () => {
      cancelled = true
    }
  }, [handle, userId])

  const persist = (nextCollections: typeof collections) => {
    setCollections(nextCollections)
    saveProfileCollections(handle, nextCollections)
    if (userId) {
      void saveUserCollections(userId, 'created', nextCollections)
        .then((savedCollections) => {
          setCollections(savedCollections)
          saveProfileCollections(handle, savedCollections)
        })
        .catch((error) => console.error('Unable to sync collections to Supabase.', error))
    }
  }

  const addToCollection = (collectionId: string, allowDuplicate = false) => {
    persist(
      collections.map((collection) =>
        collection.id === collectionId
          ? addItemToProfileCollection(collection, item, { allowDuplicate })
          : collection,
      ),
    )
    setDuplicateCollectionId(null)
  }

  const createAndAdd = (nameToUse = newCollectionName) => {
    const trimmed = nameToUse.trim()
    if (!trimmed) return
    const collection = createProfileCollection(trimmed, [item.type], {
      items: [item],
      entryIds: item.entryId ? [item.entryId] : [],
      coverMode: 'auto',
    })
    persist([collection, ...collections])
    setNewCollectionName('')
  }

  const filteredCollections = useMemo(() => {
    if (!searchFilter.trim()) return collections
    return collections.filter((col) => searchTokensMatch(col.name, searchFilter))
  }, [collections, searchFilter])

  const inCollectionCount = useMemo(() => {
    return collections.filter((col) => profileCollectionHasItem(col, item)).length
  }, [collections, item])

  return (
    <div className="collection-picker-backdrop" onClick={onClose}>
      <motion.section
        ref={dialogRef}
        className="collection-picker-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="collection-picker-title"
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <header className="collection-picker-header">
          <div className="collection-picker-header-text">
            <div className="collection-picker-eyebrow">
              <Sparkles size={11} aria-hidden="true" />
              <span>Add to Collection</span>
            </div>
            <h2 id="collection-picker-title" className="collection-picker-title">
              Choose a shelf for <span className="collection-picker-title-target">{item.title}</span>
            </h2>
          </div>
          <button
            type="button"
            className="collection-picker-close-btn"
            onClick={onClose}
            aria-label="Close collection picker"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        {/* Media Item Spotlight Card */}
        <div className="collection-picker-item">
          <div className={`collection-picker-item-art ${isSquareItem ? 'is-square' : 'is-poster'}`}>
            {item.coverUrl ? (
              <img src={item.coverUrl} alt={item.title} loading="lazy" decoding="async" />
            ) : (
              <div className="collection-picker-item-fallback">
                <MediaIcon size={22} aria-hidden="true" />
              </div>
            )}
          </div>
          <div className="collection-picker-item-info">
            <div className="collection-picker-item-badges">
              <span className="collection-picker-type-badge">
                <MediaIcon size={10} aria-hidden="true" />
                <span>{item.type.toUpperCase()}</span>
              </span>
              {item.year && <span className="collection-picker-year-badge">· {item.year}</span>}
            </div>
            <strong className="collection-picker-item-title" title={item.title}>
              {item.title}
            </strong>
            <small className="collection-picker-item-creator" title={item.creator}>
              {item.creator}
            </small>
          </div>
        </div>

        {/* Search Shelves Filter (shown when user has 2+ shelves) */}
        {collections.length >= 2 && (
          <div className="collection-picker-search-wrap">
            <Search size={14} className="collection-picker-search-icon" aria-hidden="true" />
            <input
              type="search"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter your shelves..."
              className="collection-picker-search-input"
              aria-label="Filter your shelves"
            />
            {searchFilter && (
              <button
                type="button"
                className="collection-picker-search-clear"
                onClick={() => setSearchFilter('')}
                aria-label="Clear filter"
              >
                <X size={12} aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        {/* Shelves Grid (fits 2 per row, scrollable) */}
        <div className="collection-picker-grid" role="list" aria-label="Collections list">
          {filteredCollections.map((collection) => {
            const added = profileCollectionHasItem(collection, item)
            const itemCount = collection.items?.length ?? 0
            return (
              <button
                key={collection.id}
                type="button"
                className={`collection-picker-grid-card ${added ? 'is-added' : ''}`}
                onClick={() => (added ? setDuplicateCollectionId(collection.id) : addToCollection(collection.id))}
                aria-label={`${collection.name}, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}${added ? ', already in shelf' : ''}`}
              >
                <div className="collection-picker-grid-cover" aria-hidden="true">
                  {renderCollectionCover(collection)}
                  {added && (
                    <span className="collection-picker-grid-badge" title="Already added">
                      <Check size={12} strokeWidth={2.8} />
                    </span>
                  )}
                </div>

                <div className="collection-picker-grid-meta">
                  <strong className="collection-picker-grid-name" title={collection.name}>
                    {collection.name}
                  </strong>
                  <div className="collection-picker-grid-footer">
                    <span className="collection-picker-grid-count">
                      {itemCount} {itemCount === 1 ? 'item' : 'items'}
                    </span>
                    <span className={`collection-picker-status-pill ${added ? 'added' : 'add'}`}>
                      {added ? (
                        <>
                          <Check size={11} strokeWidth={2.5} aria-hidden="true" />
                          <span>In Shelf</span>
                        </>
                      ) : (
                        <>
                          <Plus size={12} strokeWidth={2.5} aria-hidden="true" />
                          <span>Add</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </button>
            )
          })}

          {collections.length === 0 && (
            <div className="collection-picker-empty-state">
              <div className="collection-picker-empty-icon" aria-hidden="true">
                <FolderPlus size={26} />
              </div>
              <h4>No shelves created yet</h4>
              <p>Create your first shelf below to save and curate this work.</p>
            </div>
          )}

          {collections.length > 0 && filteredCollections.length === 0 && (
            <div className="collection-picker-empty-state">
              <p>No shelf matching &ldquo;{searchFilter}&rdquo; found.</p>
              <button
                type="button"
                className="collection-picker-create-matched-btn"
                onClick={() => {
                  createAndAdd(searchFilter.trim())
                  setSearchFilter('')
                }}
              >
                <Plus size={13} aria-hidden="true" />
                <span>Create &ldquo;{searchFilter}&rdquo; &amp; add</span>
              </button>
            </div>
          )}
        </div>

        {/* Quick Create Shelf */}
        <form
          className="collection-picker-create"
          onSubmit={(event) => {
            event.preventDefault()
            createAndAdd(newCollectionName)
          }}
        >
          <div className="collection-picker-create-input-wrap">
            <FolderPlus size={15} className="collection-picker-create-icon" aria-hidden="true" />
            <input
              value={newCollectionName}
              onChange={(event) => setNewCollectionName(event.target.value)}
              placeholder="Name a new shelf..."
              maxLength={50}
              aria-label="New collection name"
              className="collection-picker-create-input"
            />
          </div>
          <button
            type="submit"
            className="collection-picker-create-submit-btn"
            disabled={!newCollectionName.trim()}
          >
            <Plus size={14} strokeWidth={2.5} aria-hidden="true" />
            <span>Create &amp; Add</span>
          </button>
        </form>

        {/* Footer */}
        <footer className="collection-picker-footer">
          <div className="collection-picker-footer-summary">
            {inCollectionCount > 0 ? (
              <span className="collection-picker-summary-badge">
                <Check size={11} strokeWidth={2.5} aria-hidden="true" />
                <span>In {inCollectionCount} {inCollectionCount === 1 ? 'shelf' : 'shelves'}</span>
              </span>
            ) : (
              <span className="collection-picker-summary-hint">
                Select a shelf above to save this item
              </span>
            )}
          </div>
          <button type="button" className="collection-picker-done-btn" onClick={onClose}>
            Done
          </button>
        </footer>

        {/* Duplicate Warning Prompt */}
        <AnimatePresence>
          {duplicateCollection && (
            <div className="collection-remove-confirm-backdrop" onClick={() => setDuplicateCollectionId(null)}>
              <motion.div
                ref={duplicateDialogRef}
                className="collection-remove-confirm collection-duplicate-confirm"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="collection-duplicate-title"
                tabIndex={-1}
                initial={{ opacity: 0, scale: 0.94, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 8 }}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="collection-duplicate-alert-icon" aria-hidden="true">
                  <AlertTriangle size={24} />
                </div>
                <h3 id="collection-duplicate-title">Already in this shelf</h3>
                <p>
                  <strong>{item.title}</strong> is already in <strong>{duplicateCollection.name}</strong>.
                  Would you like to add another copy anyway?
                </p>
                <div className="collection-duplicate-btn-row">
                  <button
                    type="button"
                    className="collection-duplicate-btn cancel"
                    onClick={() => setDuplicateCollectionId(null)}
                  >
                    Keep one
                  </button>
                  <button
                    type="button"
                    className="collection-duplicate-btn confirm"
                    onClick={() => addToCollection(duplicateCollection.id, true)}
                  >
                    Add anyway
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.section>
    </div>
  )
}
