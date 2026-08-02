import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Clock,
  BookOpen,
  Disc3,
  Music4,
  Clapperboard,
  Gamepad2,
  Tv,
  Heart,
  MessageSquare,
  Bookmark,
  Send,
  MoreHorizontal,
  CornerUpLeft,
} from 'lucide-react'
import { FormattedText, stripHtmlAlignment } from './FormattedText'
import { StarRating } from './CardHeader'
import { getDropCapParts } from './variants/HybridScrollVariant'

export interface OverlayEntry {
  id: string
  type: 'book' | 'album' | 'song' | 'film' | 'tv' | 'game'
  title: string
  creator: string
  provider: string
  providerId: string
  genre?: string
  rating: number
  favoritePassage: string
  reflection: string
  reflectionAlign?: 'left' | 'center' | 'right' | 'justify'
  passageAlign?: 'left' | 'center' | 'right' | 'justify'
  enableDropCap?: boolean
  year?: string
  coverUrl?: string
  summary?: string
  createdAt: string
  updatedAt: string
  coverTone: string
}

interface ReplyItem {
  id: string
  author: string
  initials: string
  text: string
  createdAt: string
}

interface CommentItem {
  id: string
  author: string
  initials: string
  text: string
  createdAt: string
  replies: ReplyItem[]
}

interface CardOverlayModalProps {
  entry: OverlayEntry | null
  onClose: () => void
  isLiked?: boolean
  isSaved?: boolean
  onToggleLike?: () => void
  onToggleSave?: () => void
}

const typeIconMap = {
  book: BookOpen,
  album: Disc3,
  song: Music4,
  film: Clapperboard,
  game: Gamepad2,
  tv: Tv,
}

export const CardOverlayModal: React.FC<CardOverlayModalProps> = ({
  entry,
  onClose,
  isLiked = false,
  isSaved = false,
  onToggleLike,
  onToggleSave,
}) => {
  const [comments, setComments] = useState<CommentItem[]>([
    { id: 'c1', author: 'Elena Rostova', initials: 'ER', text: 'Beautiful reflection! This passage resonated deeply with me as well.', createdAt: '2 hours ago', replies: [] },
    { id: 'c2', author: 'Marcus Vance', initials: 'MV', text: 'Stunning review. Added to my personal reading list!', createdAt: '5 hours ago', replies: [] },
  ])
  const [newCommentText, setNewCommentText] = useState('')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({})

  const likeCount = 12

  const handleReplySubmit = (commentId: string) => {
    const text = (replyTexts[commentId] || '').trim()
    if (!text) return
    const reply: ReplyItem = {
      id: `r-${Date.now()}`,
      author: 'jimboii',
      initials: 'JB',
      text,
      createdAt: 'Just now',
    }
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId ? { ...c, replies: [...c.replies, reply] } : c
      )
    )
    setReplyTexts((prev) => ({ ...prev, [commentId]: '' }))
    setReplyingToId(null)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (entry) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [entry, onClose])

  if (!entry) return null

  const IconComponent = typeIconMap[entry.type] || BookOpen
  const { cleanText } = stripHtmlAlignment(entry.reflection)
  const wordCount = cleanText.replace(/<[^>]*>/g, '').trim().split(/\s+/).filter(Boolean).length
  const readTimeMin = Math.max(1, Math.ceil(wordCount / 180))

  const showDropCap = Boolean(entry.enableDropCap)
  const { firstChar, restText, isEmoji, isLowercase } = getDropCapParts(entry.reflection)
  const isSquare = entry.type === 'album' || entry.type === 'song'

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCommentText.trim()) return
    const item: CommentItem = {
      id: `c-${Date.now()}`,
      author: 'jimboii',
      initials: 'JB',
      text: newCommentText.trim(),
      createdAt: 'Just now',
    }
    setComments((prev) => [...prev, item])
    setNewCommentText('')
  }

  const sortedComments = sortOrder === 'newest' ? [...comments].reverse() : comments

  return (
    <AnimatePresence>
      <div className="overlay-modal-root">
        <motion.div
          className="overlay-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />

        <motion.div
          className={`overlay-modal tone-${entry.coverTone}`}
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 20 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          role="dialog"
          aria-modal="true"
          aria-label={entry.title}
        >
          {/* ── Top bar: icon | read-time | (spacer) | stars | close ── */}
          <div className="overlay-topbar">
            <div className="overlay-topbar-left">
              {/* Type icon — icon only, no text */}
              <span className="overlay-type-icon" aria-label={entry.type}>
                <IconComponent aria-hidden="true" />
              </span>

              {/* Vertical divider */}
              <span className="overlay-topbar-divider" aria-hidden="true" />

              {/* Read-time pill */}
              <span className="overlay-readtime-pill">
                <Clock aria-hidden="true" />
                {readTimeMin} min read &bull; {wordCount} words
              </span>
            </div>

            <div className="overlay-topbar-right">
              <StarRating rating={entry.rating} />
              <button
                className="overlay-close-btn"
                type="button"
                onClick={onClose}
                aria-label="Close reading view"
              >
                <X aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* ── Cover + Metadata ── */}
          <div className="overlay-card-media">
            <div className={`overlay-cover-wrapper ${isSquare ? 'is-square' : ''}`}>
              {entry.coverUrl ? (
                <img src={entry.coverUrl} alt={entry.title} className="overlay-cover-img" />
              ) : (
                <div className="overlay-cover-fallback">
                  <IconComponent />
                </div>
              )}
            </div>

            <div className="overlay-card-details">
              <h2 className="overlay-title">{entry.title}</h2>
              {entry.creator && <p className="overlay-creator">{entry.creator}</p>}
              {entry.genre && <span className="overlay-genre-pill">{entry.genre}</span>}
              {entry.provider && entry.provider !== 'Manual' && (
                <p className="overlay-provider">
                  {entry.provider}{entry.year ? ` (${entry.year})` : ''}
                </p>
              )}

              {/* Passage lives in the right column, below metadata */}
              {entry.favoritePassage && (
                <div className="overlay-favorite-passage">
                  <span className="overlay-passage-quote" aria-hidden="true">&#x201C;</span>
                  <div className="overlay-passage-text">
                    <FormattedText text={entry.favoritePassage} align={entry.passageAlign} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Reflection body ── */}
          {entry.reflection && (
            <div className="overlay-reflection-body">
              {showDropCap ? (
                <div className="dropcap-container">
                  <span className={`dropcap-letter ${isEmoji ? 'is-emoji' : ''} ${isLowercase ? 'is-lowercase' : ''}`}>
                    {firstChar}
                  </span>
                  <span className="dropcap-body">
                    <FormattedText text={restText} align={entry.reflectionAlign} />
                  </span>
                </div>
              ) : (
                <FormattedText text={entry.reflection} align={entry.reflectionAlign} />
              )}
            </div>
          )}

          {/* ── Social bar — icon-only ── */}
          <div className="overlay-social-bar">
            <div className="overlay-social-left">
              <button
                type="button"
                className={`overlay-icon-action ${isLiked ? 'is-liked' : ''}`}
                onClick={onToggleLike}
                title={isLiked ? 'Unlike' : 'Like'}
              >
                <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} />
                <span>{likeCount + (isLiked ? 1 : 0)}</span>
              </button>

              <button
                type="button"
                className={`overlay-icon-action ${isSaved ? 'is-saved' : ''}`}
                onClick={onToggleSave}
                title={isSaved ? 'Unsave' : 'Save entry'}
              >
                <Bookmark size={16} fill={isSaved ? 'currentColor' : 'none'} />
              </button>
            </div>

            <span className="overlay-comment-count">
              <MessageSquare size={15} />
              <span>{comments.length} Comments</span>
            </span>
          </div>

          {/* ── Comments & Discussion ── */}
          <div className="overlay-comments-section">
            <div className="overlay-comments-header">
              <h3>Comments &amp; Discussion</h3>
              <button
                type="button"
                className="overlay-sort-btn"
                onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
              >
                {sortOrder === 'newest' ? 'Newest first' : 'Oldest first'}
                <span className="overlay-sort-chevron">▾</span>
              </button>
            </div>

            <div className="overlay-comments-list">
              {sortedComments.map((c) => (
                <div key={c.id} className="overlay-comment-item">
                  <div className="overlay-comment-avatar">{c.initials}</div>
                  <div className="overlay-comment-body">
                    <div className="overlay-comment-meta">
                      <span className="overlay-comment-author">{c.author}</span>
                      <span className="overlay-comment-time">{c.createdAt}</span>
                      <button type="button" className="overlay-comment-more" aria-label="Comment options">
                        <MoreHorizontal size={14} />
                      </button>
                    </div>
                    <p className="overlay-comment-text">{c.text}</p>
                    <button
                      type="button"
                      className="overlay-comment-reply"
                      onClick={() => setReplyingToId(replyingToId === c.id ? null : c.id)}
                    >
                      <CornerUpLeft size={12} />
                      {replyingToId === c.id ? 'Cancel' : 'Reply'}
                    </button>

                    {/* Inline reply input - Auto-expanding textarea */}
                    {replyingToId === c.id && (
                      <form
                        className="overlay-reply-form"
                        onSubmit={(e) => {
                          e.preventDefault()
                          handleReplySubmit(c.id)
                        }}
                      >
                        <div className="overlay-reply-avatar">JB</div>
                        <textarea
                          className="overlay-reply-input"
                          placeholder={`Reply to ${c.author}…`}
                          value={replyTexts[c.id] || ''}
                          rows={1}
                          onChange={(e) => {
                            const val = e.target.value
                            setReplyTexts((prev) => ({ ...prev, [c.id]: val }))
                            e.target.style.height = 'auto'
                            e.target.style.height = Math.min(e.target.scrollHeight, 110) + 'px'
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault()
                              handleReplySubmit(c.id)
                            }
                          }}
                          autoFocus
                        />
                        <button type="submit" className="overlay-reply-send" aria-label="Send reply">
                          <Send size={12} />
                        </button>
                      </form>
                    )}

                    {/* Nested replies */}
                    {c.replies.length > 0 && (
                      <div className="overlay-replies-list">
                        {c.replies.map((r) => (
                          <div key={r.id} className="overlay-reply-item">
                            <div className="overlay-reply-avatar-sm">{r.initials}</div>
                            <div className="overlay-reply-body">
                              <div className="overlay-comment-meta">
                                <span className="overlay-comment-author">{r.author}</span>
                                <span className="overlay-comment-time">{r.createdAt}</span>
                              </div>
                              <p className="overlay-comment-text">{r.text}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Main comment form - Auto-expanding textarea */}
            <form onSubmit={handlePostComment} className="overlay-comment-form">
              <textarea
                className="overlay-comment-textarea"
                placeholder="Write a comment…"
                value={newCommentText}
                rows={1}
                onChange={(e) => {
                  setNewCommentText(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 110) + 'px'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handlePostComment(e)
                  }
                }}
              />
              <button type="submit" className="primary-btn overlay-post-btn">
                <Send size={14} />
                <span>Post</span>
              </button>
            </form>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  )
}
