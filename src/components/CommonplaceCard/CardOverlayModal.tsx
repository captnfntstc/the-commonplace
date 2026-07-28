import React, { useEffect } from 'react'
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
} from 'lucide-react'
import { FormattedText, stripHtmlAlignment } from './FormattedText'
import { StarRating } from './CardHeader'

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

interface CardOverlayModalProps {
  entry: OverlayEntry | null
  onClose: () => void
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
}) => {
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
                <p className="overlay-creator">by {entry.creator}</p>
              )}
              {entry.genre && (
                <span className="overlay-genre-pill">{entry.genre}</span>
              )}
              {entry.provider && (
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
            <FormattedText text={entry.reflection} align={entry.reflectionAlign} />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
