import React, { useEffect, useRef, useState } from 'react'
import {
  Bookmark,
  Edit3,
  Heart,
  Maximize2,
  MessageSquare,
  MessageSquareOff,
  MoreHorizontal,
  Trash2,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import type { Entry } from '../../features/entries/model'
import { CardHeader } from './CardHeader'
import { CardMedia } from './CardMedia'
import { CardReflection } from './CardReflection'
import { FormattedText } from './FormattedText'

type CardEntry = Entry

interface CardProps {
  entry: CardEntry
  expanded: boolean
  onDelete?: () => void
  onEdit?: () => void
  onToggle: () => void
  onExpandOverlay?: () => void
  onOpenProfile?: () => void
  onOpenMedia?: () => void
  onOpenCreator?: (creatorName: string) => void
  onOpenAlbum?: () => void
  typeIcon: LucideIcon
  typeLabel: string
  isLiked?: boolean
  isSaved?: boolean
  likeCount?: number
  commentCount?: number
  saveCount?: number
  onToggleLike?: () => void
  onToggleSave?: () => void
  commentsDisabled?: boolean
  onToggleCommentsDisabled?: () => void
  isFriend?: boolean
}

function hasVisibleReflection(reflection: string) {
  return reflection
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
    .trim().length > 0
}

export const Card: React.FC<CardProps> = ({
  entry,
  expanded,
  onDelete,
  onEdit,
  onToggle,
  onExpandOverlay,
  onOpenProfile,
  onOpenMedia,
  onOpenCreator,
  onOpenAlbum,
  typeIcon,
  typeLabel,
  isLiked = false,
  isSaved = false,
  likeCount = 0,
  commentCount = 0,
  onToggleLike,
  onToggleSave,
  commentsDisabled = false,
  onToggleCommentsDisabled,
  isFriend = false,
}) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const hasMenuActions = Boolean(onExpandOverlay || onEdit || onDelete || onToggleCommentsDisabled)
  const isExpandable = hasVisibleReflection(entry.reflection)

  useEffect(() => {
    if (!menuOpen) return

    const closeMenu = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('mousedown', closeMenu)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeMenu)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [menuOpen])

  const handleCardClick = (event: React.MouseEvent<HTMLElement>) => {
    if (!isExpandable) return
    const target = event.target
    if (!(target instanceof Element)) return

    // The author row and nested controls keep their own behavior. Everything
    // else in the card's content area expands or collapses the entry.
    if (target.closest(
      '.card-toprow, button, a, input, select, textarea, [role="button"], [role="link"], [role="menu"], [contenteditable="true"]',
    )) return

    onToggle()
  }

  const handleToggle = () => {
    if (isExpandable) onToggle()
  }

  return (
    <article
      className={`entry-card ${isExpandable ? 'is-expandable' : ''} tone-${entry.coverTone}`}
      onClick={handleCardClick}
    >
      {/* Top Header Row */}
      <CardHeader
        typeIcon={typeIcon}
        typeLabel={typeLabel}
        authorHandle={entry.authorHandle}
        authorAvatarUrl={entry.authorAvatarUrl}
        createdAt={entry.createdAt}
        onOpenProfile={onOpenProfile}
        visibility={entry.visibility}
        isFriend={isFriend}
      />

      {/* Body: Artwork & Metadata */}
      <CardMedia
        type={entry.type}
        title={entry.title}
        creator={entry.creator}
        genre={entry.genre}
        provider={entry.provider}
        year={entry.year}
        coverUrl={entry.coverUrl}
        rating={entry.rating}
        explicit={entry.explicit}
        typeIcon={typeIcon}
        onToggle={isExpandable ? handleToggle : undefined}
        onOpenMedia={onOpenMedia}
        onOpenCreator={onOpenCreator}
        onOpenAlbum={onOpenAlbum}
      />

      {/* Favorite passage */}
      {entry.favoritePassage && (isExpandable ? (
        <button
          className="card-passage"
          type="button"
          onClick={handleToggle}
          aria-expanded={expanded}
        >
          <span className="card-passage-quote-mark" aria-hidden="true">&#x201C;</span>
          <div className="card-passage-text">
            <FormattedText text={entry.favoritePassage} align={entry.passageAlign} />
          </div>
        </button>
      ) : (
        <div className="card-passage">
          <span className="card-passage-quote-mark" aria-hidden="true">&#x201C;</span>
          <div className="card-passage-text">
            <FormattedText text={entry.favoritePassage} align={entry.passageAlign} />
          </div>
        </div>
      ))}

      {/* Reflection expansion component */}
      {isExpandable && (
        <CardReflection
          reflection={entry.reflection}
          reflectionAlign={entry.reflectionAlign}
          enableDropCap={entry.enableDropCap}
          expanded={expanded}
        />
      )}

      {/* At-A-Glance Stat Bar & Actions */}
      <div className="card-glance-bar">
        {/* Left: Social actions */}
        <div className="card-glance-left">
          {/* Heart — icon + count always visible */}
          <button
            type="button"
            className={`glance-icon-btn with-count ${isLiked ? 'liked' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              onToggleLike?.()
            }}
            aria-label={isLiked ? 'Unlike' : 'Like'}
            title={isLiked ? 'Unlike' : 'Like'}
          >
            <Heart size={15} fill={isLiked ? 'currentColor' : 'none'} />
            <span className="glance-like-count">{likeCount}</span>
          </button>

          {/* Comment — icon + count, opens overlay */}
          {!commentsDisabled && (
            <button
              type="button"
              className="glance-count-btn"
              onClick={(e) => {
                e.stopPropagation()
                onExpandOverlay?.()
              }}
              aria-label={`${commentCount} comments`}
              title="View comments"
            >
              <MessageSquare size={15} />
              <span>{commentCount}</span>
            </button>
          )}

          {/* Bookmark — icon only */}
          <button
            type="button"
            className={`glance-icon-btn ${isSaved ? 'saved' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              onToggleSave?.()
            }}
            aria-label={isSaved ? 'Unsave' : 'Save'}
            title={isSaved ? 'Unsave entry' : 'Save entry'}
          >
            <Bookmark size={15} fill={isSaved ? 'currentColor' : 'none'} />
          </button>
        </div>

        {/* Right: entry actions */}
        <div className="card-glance-right">
          {hasMenuActions && (
            <div className="card-actions card-glance-actions" ref={menuRef}>
              <button
                className="card-more-btn"
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                title="More actions"
                aria-label="More entry actions"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <MoreHorizontal aria-hidden="true" />
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    className="card-actions-menu"
                    role="menu"
                    initial={{ opacity: 0, scale: 0.96, y: 4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 4 }}
                    transition={{ duration: 0.12 }}
                  >
                    {onExpandOverlay && (
                      <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onExpandOverlay() }}>
                        <Maximize2 aria-hidden="true" />
                        <span>Open reading view</span>
                      </button>
                    )}
                    {onEdit && (
                      <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onEdit() }}>
                        <Edit3 aria-hidden="true" />
                        <span>Edit entry</span>
                      </button>
                    )}
                    {onToggleCommentsDisabled && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { setMenuOpen(false); onToggleCommentsDisabled() }}
                      >
                        {commentsDisabled
                          ? <MessageSquare aria-hidden="true" />
                          : <MessageSquareOff aria-hidden="true" />}
                        <span>{commentsDisabled ? 'Enable comments' : 'Disable comments'}</span>
                      </button>
                    )}
                    {onDelete && (
                      <button className="danger" type="button" role="menuitem" onClick={() => { setMenuOpen(false); onDelete() }}>
                        <Trash2 aria-hidden="true" />
                        <span>Delete entry</span>
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
