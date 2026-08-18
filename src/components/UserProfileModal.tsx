import React from 'react'
import { motion } from 'framer-motion'
import { User, X, BookOpen, Disc3, Clapperboard, Gamepad2, Music4, Tv, Calendar, Award } from 'lucide-react'
import type { Entry as CardEntry } from '../features/entries/model'
import { StarRating } from './CommonplaceCard/CardHeader'

interface UserProfileModalProps {
  isOpen: boolean
  onClose: () => void
  entries: CardEntry[]
  onSelectEntry?: (entry: CardEntry) => void
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  entries,
  onSelectEntry,
}) => {
  if (!isOpen) return null

  const booksCount = entries.filter((e) => e.type === 'book').length
  const albumsCount = entries.filter((e) => e.type === 'album').length
  const filmsCount = entries.filter((e) => e.type === 'film').length
  const songsCount = entries.filter((e) => e.type === 'song').length
  const gamesCount = entries.filter((e) => e.type === 'game').length
  const showsCount = entries.filter((e) => e.type === 'tv').length

  const avgRating =
    entries.length > 0
      ? (entries.reduce((acc, curr) => acc + curr.rating, 0) / entries.length).toFixed(1)
      : '0.0'

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <motion.div
        className="user-profile-modal"
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 15 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Banner & Header */}
        <div className="profile-banner">
          <button
            type="button"
            className="profile-modal-close"
            onClick={onClose}
            aria-label="Close profile"
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <div className="profile-identity-section">
          <div className="profile-avatar-large">
            <User aria-hidden="true" />
          </div>

          <div className="profile-main-info">
            <div className="profile-name-row">
              <h2 className="profile-display-name">jimboii</h2>
              <span className="profile-badge">
                <Award aria-hidden="true" />
                Catalog Collector
              </span>
            </div>
            <span className="profile-handle">@jimboii</span>
            <p className="profile-bio">
              Collector of timeless passages, album impressions, cinematic notes, and personal reflections in one quiet place.
            </p>
            <div className="profile-meta-row">
              <span>
                <Calendar aria-hidden="true" />
                Member since July 2026
              </span>
              <span>&bull;</span>
              <span>Average Rating: {avgRating} ★</span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="profile-stats-grid">
          <div className="stat-card">
            <span className="stat-value">{entries.length}</span>
            <span className="stat-label">Total Entries</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{booksCount}</span>
            <span className="stat-label">Books</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{albumsCount + songsCount}</span>
            <span className="stat-label">Music</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{filmsCount + showsCount}</span>
            <span className="stat-label">Film & TV</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{gamesCount}</span>
            <span className="stat-label">Games</span>
          </div>
        </div>

        <div className="profile-section-divider" />

        {/* User's Created Reviews / Entries List */}
        <div className="profile-reviews-container">
          <h3 className="profile-reviews-title">
            Passages & Reviews ({entries.length})
          </h3>

          {entries.length === 0 ? (
            <div className="profile-empty">
              <BookOpen aria-hidden="true" />
              <p>No reviews cataloged yet.</p>
            </div>
          ) : (
            <div className="profile-reviews-list">
              {entries.map((entry) => {
                const getIcon = () => {
                  switch (entry.type) {
                    case 'album': return Disc3
                    case 'book': return BookOpen
                    case 'film': return Clapperboard
                    case 'game': return Gamepad2
                    case 'song': return Music4
                    case 'tv': return Tv
                    default: return BookOpen
                  }
                }
                const Icon = getIcon()

                return (
                  <div
                    key={entry.id}
                    className="profile-review-card"
                    onClick={() => {
                      onSelectEntry?.(entry)
                      onClose()
                    }}
                  >
                    <div className="review-card-left">
                      {entry.coverUrl ? (
                        <img
                          src={entry.coverUrl}
                          alt={entry.title}
                          className="review-cover-img"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className={`review-cover-placeholder tone-${entry.coverTone}`}>
                          <Icon aria-hidden="true" />
                        </div>
                      )}
                    </div>

                    <div className="review-card-main">
                      <div className="review-title-row">
                        <h4 className="review-title">
                          <span>{entry.title}</span>
                          {(entry.type === 'song' || entry.type === 'album') && entry.explicit && (
                            <span className="explicit-badge explicit-badge--inline" aria-label="Explicit">E</span>
                          )}
                        </h4>
                        <StarRating rating={entry.rating} />
                      </div>
                      <span className="review-creator">{entry.creator} &bull; <span className="review-type-tag">{entry.type}</span></span>

                      {entry.favoritePassage && (
                        <p className="review-quote-snippet">
                          "{entry.favoritePassage.replace(/<[^>]*>/g, '').slice(0, 140)}{entry.favoritePassage.length > 140 ? '…' : ''}"
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
