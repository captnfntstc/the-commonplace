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

interface CommentItem {
  id: string
  author: string
  text: string
  createdAt: string
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
    { id: 'c1', author: 'Elena Rostova', text: 'Beautiful reflection! This passage resonated deeply with me as well.', createdAt: '2 hours ago' },
    { id: 'c2', author: 'Marcus Vance', text: 'Stunning review. Added to my personal reading list!', createdAt: '5 hours ago' },
  ])
  const [newCommentText, setNewCommentText] = useState('')

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
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

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCommentText.trim()) return
    const item: CommentItem = {
      id: `c-${Date.now()}`,
      author: 'jimboii',
      text: newCommentText.trim(),
      createdAt: 'Just now',
    }
    setComments((prev) => [...prev, item])
    setNewCommentText('')
  }

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
          <button
            className="overlay-close-btn"
            type="button"
            onClick={onClose}
            aria-label="Close reading view"
          >
            <X aria-hidden="true" />
          </button>

          <div className="overlay-meta-top">
            <span className="overlay-type-badge">
              <IconComponent aria-hidden="true" />
              <span>{entry.type}</span>
            </span>
            <span className="article-tag">
              <Clock aria-hidden="true" />
              {readTimeMin} min read &bull; {wordCount} words
            </span>
            <div className="overlay-stars">
              <StarRating rating={entry.rating} />
            </div>
          </div>

          <div className="overlay-card-media">
            <div className={`overlay-cover-wrapper ${entry.type === 'album' || entry.type === 'song' ? 'is-square' : ''}`}>
              {entry.coverUrl ? (
                <img
                  src={entry.coverUrl}
                  alt={entry.title}
                  className="overlay-cover-img"
                />
              ) : (
                <div className="overlay-cover-fallback">
                  <IconComponent />
                </div>
              )}
            </div>

            <div className="overlay-card-details">
              <h2 className="overlay-title">{entry.title}</h2>
              {entry.creator && (
                <p className="overlay-creator">{entry.creator}</p>
              )}
              {entry.genre && (
                <span className="overlay-genre-pill">{entry.genre}</span>
              )}
              {entry.provider && entry.provider !== 'Manual' && (
                <p className="overlay-provider">
                  {entry.provider} {entry.year ? `(${entry.year})` : ''}
                </p>
              )}
            </div>
          </div>

          {entry.favoritePassage && (
            <div className="overlay-favorite-passage">
              <FormattedText text={entry.favoritePassage} align={entry.passageAlign} />
            </div>
          )}

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

          {/* Social Stats & Actions Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <button
              type="button"
              className="ghost-btn"
              onClick={onToggleLike}
              style={{ color: isLiked ? '#e57373' : 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Heart size={16} fill={isLiked ? '#e57373' : 'none'} />
              <span>{12 + (isLiked ? 1 : 0)} Likes</span>
            </button>
            <button
              type="button"
              className="ghost-btn"
              onClick={onToggleSave}
              style={{ color: isSaved ? '#f5b74c' : 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Bookmark size={16} fill={isSaved ? '#f5b74c' : 'none'} />
              <span>{isSaved ? 'Saved to Profile' : 'Save Entry'}</span>
            </button>
            <span style={{ color: 'var(--secondary)', fontSize: '13px', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              <MessageSquare size={15} />
              <span>{comments.length} Comments</span>
            </span>
          </div>

          {/* Dedicated Comments Thread Section */}
          <div className="overlay-comments-section" style={{ marginTop: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--primary)', marginBottom: '12px' }}>
              Comments & Discussion
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              {comments.map((c) => (
                <div key={c.id} style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--primary)' }}>{c.author}</span>
                    <span style={{ fontSize: '11px', color: 'var(--secondary)' }}>{c.createdAt}</span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--secondary)', margin: 0, lineHeight: 1.4 }}>{c.text}</p>
                </div>
              ))}
            </div>

            <form onSubmit={handlePostComment} style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                className="dark-setting-input"
                placeholder="Write a comment or reply…"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="submit" className="primary-btn" style={{ padding: '0 16px' }}>
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
