import React, { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Heart, Search, X } from 'lucide-react'
import { useAccessibleDialog } from '../../hooks/useAccessibleDialog'
import { fetchEntryLikers, type EntryLiker } from '../../services/cloudData'
import './LikesListModal.css'

export interface LikesListModalProps {
  isOpen: boolean
  onClose: () => void
  postId: string
  entryTitle?: string
  likeCount?: number
  onOpenProfile?: (handle: string) => void
  currentUserHandle?: string
  isViewerLiked?: boolean
  viewerProfile?: { handle?: string; name?: string; avatarUrl?: string }
}

export const LikesListModal: React.FC<LikesListModalProps> = ({
  isOpen,
  onClose,
  postId,
  entryTitle,
  likeCount = 0,
  onOpenProfile,
  currentUserHandle,
  isViewerLiked,
  viewerProfile,
}) => {
  const [likers, setLikers] = useState<EntryLiker[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const dialogRef = useAccessibleDialog<HTMLDivElement>({
    open: isOpen,
    onClose,
  })

  useEffect(() => {
    if (!isOpen || !postId) return
    let active = true
    setLoading(true)

    void fetchEntryLikers(postId, {
      isViewerLiked,
      viewerProfile,
      fallbackCount: likeCount,
    }).then((data) => {
      if (!active) return
      setLikers(data)
      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [isOpen, postId, isViewerLiked, viewerProfile, likeCount])

  const filteredLikers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return likers
    return likers.filter(
      (liker) =>
        liker.name.toLowerCase().includes(q) ||
        liker.handle.toLowerCase().includes(q)
    )
  }, [likers, searchQuery])

  if (!isOpen) return null

  const cleanCurrentHandle = (currentUserHandle || '').toLowerCase().replace(/^@/, '')

  return (
    <AnimatePresence>
      <div className="tcp-likes-backdrop" onClick={onClose} role="presentation">
        <motion.div
          ref={dialogRef}
          className="tcp-likes-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tcp-likes-title"
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Header */}
          <div className="tcp-likes-header">
            <div className="tcp-likes-header-content">
              <div className="tcp-likes-icon-badge" aria-hidden="true">
                <Heart size={16} fill="currentColor" />
              </div>
              <div>
                <h2 id="tcp-likes-title" className="tcp-likes-title">
                  Likes
                </h2>
                <span className="tcp-likes-count-badge">
                  {Math.max(likers.length, likeCount)} {Math.max(likers.length, likeCount) === 1 ? 'like' : 'likes'}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="tcp-likes-close-btn"
              onClick={onClose}
              aria-label="Close likes modal"
              title="Close"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          {/* Search box if there are multiple likers */}
          {likers.length > 3 && (
            <div className="tcp-likes-search-wrap">
              <Search size={14} className="tcp-likes-search-icon" aria-hidden="true" />
              <input
                type="text"
                className="tcp-likes-search-input"
                placeholder="Search likes…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search likes"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="tcp-likes-search-clear"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <X size={12} aria-hidden="true" />
                </button>
              )}
            </div>
          )}

          {/* Body */}
          <div className="tcp-likes-body">
            {loading ? (
              <div className="tcp-likes-loading" role="status" aria-label="Loading likes">
                <div className="tcp-likes-skeleton-row" />
                <div className="tcp-likes-skeleton-row" />
                <div className="tcp-likes-skeleton-row" />
              </div>
            ) : filteredLikers.length === 0 ? (
              <div className="tcp-likes-empty">
                <p>
                  {searchQuery
                    ? `No users matching "${searchQuery}"`
                    : entryTitle
                    ? `No likes yet on "${entryTitle}".`
                    : 'No likes yet on this entry.'}
                </p>
              </div>
            ) : (
              <ul className="tcp-likes-list" role="list">
                {filteredLikers.map((liker) => {
                  const cleanHandle = liker.handle.replace(/^@/, '')
                  const isViewer = Boolean(cleanCurrentHandle && cleanHandle.toLowerCase() === cleanCurrentHandle)

                  return (
                    <li key={liker.userId || liker.handle} className="tcp-likes-item">
                      <button
                        type="button"
                        className="tcp-likes-user-btn"
                        onClick={() => {
                          onClose()
                          onOpenProfile?.(cleanHandle)
                        }}
                        title={`View @${cleanHandle}'s profile`}
                      >
                        <div className="tcp-likes-avatar">
                          {liker.avatarUrl ? (
                            <img
                              src={liker.avatarUrl}
                              alt=""
                              referrerPolicy="no-referrer"
                              loading="lazy"
                            />
                          ) : (
                            <span className="tcp-likes-avatar-initial">
                              {(liker.name || cleanHandle || 'U').charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="tcp-likes-user-info">
                          <span className="tcp-likes-user-name">
                            {liker.name}
                            {isViewer && <span className="tcp-likes-you-pill">You</span>}
                          </span>
                          <span className="tcp-likes-user-handle">
                            @{cleanHandle}
                          </span>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

export default LikesListModal
