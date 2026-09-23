import { AlertTriangle, Check, FolderPlus, Plus, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import {
  addItemToProfileCollection,
  createProfileCollection,
  loadProfileCollections,
  profileCollectionHasItem,
  saveProfileCollections,
  type ProfileCollectionItem,
} from '../../features/collections/profileCollections'
import { loadOrMigrateUserCollections, saveUserCollections } from '../../services/cloudData'
import { useAccessibleDialog } from '../../hooks/useAccessibleDialog'

interface CollectionPickerModalProps {
  handle: string
  userId?: string | null
  item: ProfileCollectionItem
  onClose: () => void
}

export function CollectionPickerModal({ handle, userId = null, item, onClose }: CollectionPickerModalProps) {
  const [collections, setCollections] = useState(() => loadProfileCollections(handle))
  const [newCollectionName, setNewCollectionName] = useState('')
  const [duplicateCollectionId, setDuplicateCollectionId] = useState<string | null>(null)
  const duplicateCollection = collections.find((collection) => collection.id === duplicateCollectionId)
  const dialogRef = useAccessibleDialog<HTMLElement>({ open: true, onClose })
  const duplicateDialogRef = useAccessibleDialog<HTMLDivElement>({
    open: Boolean(duplicateCollection),
    onClose: () => setDuplicateCollectionId(null),
  })

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
      .catch((error) => console.error('Unable to load collections from Firebase.', error))
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
        .catch((error) => console.error('Unable to sync collections to Firebase.', error))
    }
  }

  const addToCollection = (collectionId: string, allowDuplicate = false) => {
    persist(collections.map((collection) =>
      collection.id === collectionId
        ? addItemToProfileCollection(collection, item, { allowDuplicate })
        : collection,
    ))
    setDuplicateCollectionId(null)
  }

  const createAndAdd = () => {
    if (!newCollectionName.trim()) return
    const collection = createProfileCollection(newCollectionName, [item.type], {
      items: [item],
      entryIds: item.entryId ? [item.entryId] : [],
      coverMode: 'auto',
    })
    persist([collection, ...collections])
    setNewCollectionName('')
  }

  return (
    <div className="collection-picker-backdrop" onClick={onClose}>
      <motion.section
        ref={dialogRef}
        className="collection-picker-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="collection-picker-title"
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.18 }}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="collection-picker-header">
          <div>
            <span>Add to collection</span>
            <h2 id="collection-picker-title">Choose a shelf for {item.title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close collection picker"><X /></button>
        </header>

        <div className="collection-picker-item">
          <span>{item.coverUrl ? <img src={item.coverUrl} alt="" loading="lazy" decoding="async" /> : <FolderPlus aria-hidden="true" />}</span>
          <div><strong>{item.title}</strong><small>{item.creator}</small></div>
        </div>

        <div className="collection-picker-list">
          {collections.map((collection) => {
            const added = profileCollectionHasItem(collection, item)
            return (
              <button
                key={collection.id}
                type="button"
                className={added ? 'added' : ''}
                onClick={() => added
                  ? setDuplicateCollectionId(collection.id)
                  : addToCollection(collection.id)}
              >
                <span><FolderPlus aria-hidden="true" /></span>
                <strong>{collection.name}</strong>
                <small>{collection.items?.length ?? 0} items</small>
                {added ? <Check aria-label="Added" /> : <Plus aria-label="Add" />}
              </button>
            )
          })}
          {collections.length === 0 && <p>No shelves yet. Create one below and this item will be added automatically.</p>}
        </div>

        <form className="collection-picker-create" onSubmit={(event) => { event.preventDefault(); createAndAdd() }}>
          <input
            value={newCollectionName}
            onChange={(event) => setNewCollectionName(event.target.value)}
            placeholder="New collection name"
            maxLength={50}
            aria-label="New collection name"
          />
          <button type="submit" disabled={!newCollectionName.trim()}><Plus /> Create & add</button>
        </form>

        <footer><button type="button" onClick={onClose}>Done</button></footer>

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
                <AlertTriangle aria-hidden="true" />
                <h3 id="collection-duplicate-title">Already in this collection</h3>
                <p>
                  <strong>{item.title}</strong> is already in <strong>{duplicateCollection.name}</strong>.
                  Would you like to add another copy anyway?
                </p>
                <div>
                  <button type="button" onClick={() => setDuplicateCollectionId(null)}>No, keep one</button>
                  <button
                    type="button"
                    className="confirm"
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
