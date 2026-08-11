import React from 'react'
import { ChevronDown, ChevronUp, Heart, MessageSquare, Bookmark } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { CardHeader } from './CardHeader'
import { CardMedia } from './CardMedia'
import { CardReflection } from './CardReflection'
import { FormattedText } from './FormattedText'

export type CardEntry = {
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
  coverTone: 'gold' | 'rose' | 'sage' | 'blue' | 'violet' | 'ember'
  authorHandle?: string
  authorName?: string
  authorAvatarUrl?: string
}

interface CardProps {
  entry: CardEntry
  expanded: boolean
  onDelete?: () => void
  onEdit?: () => void
  onToggle: () => void
  onExpandOverlay?: () => void
  onOpenProfile?: () => void
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
}

export const Card: React.FC<CardProps> = ({
  entry,
  expanded,
  onDelete,
  onEdit,
  onToggle,
  onExpandOverlay,
  onOpenProfile,
  typeIcon,
  typeLabel,
  isLiked = false,
  isSaved = false,
  likeCount = 12,
  commentCount = 3,
  onToggleLike,
  onToggleSave,
  commentsDisabled = false,
}) => {
  return (
    <article className={`entry-card tone-${entry.coverTone}`}>
      {/* Top Header Row */}
      <CardHeader
        typeIcon={typeIcon}
        typeLabel={typeLabel}
        authorHandle={entry.authorHandle}
        authorAvatarUrl={entry.authorAvatarUrl}
        createdAt={entry.createdAt}
        onOpenProfile={onOpenProfile}
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
        typeIcon={typeIcon}
        onToggle={onToggle}
      />

      {/* Favorite passage */}
      {entry.favoritePassage && (
        <button
          className="card-passage"
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
        >
          <span className="card-passage-quote-mark" aria-hidden="true">&#x201C;</span>
          <div className="card-passage-text">
            <FormattedText text={entry.favoritePassage} align={entry.passageAlign} />
          </div>
        </button>
      )}

      {/* Reflection expansion component */}
      <CardReflection
        reflection={entry.reflection}
        reflectionAlign={entry.reflectionAlign}
        enableDropCap={entry.enableDropCap}
        expanded={expanded}
        onEdit={onEdit}
        onDelete={onDelete}
        onExpandOverlay={onExpandOverlay}
      />

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
            <span className="glance-like-count">{likeCount + (isLiked ? 1 : 0)}</span>
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

        {/* Right: expand/collapse toggle */}
        <div className="card-glance-right">
          <button
            className="card-toggle"
            type="button"
            onClick={onToggle}
            aria-label={expanded ? 'Collapse card' : 'Expand card'}
          >
            {expanded ? (
              <ChevronUp aria-hidden="true" />
            ) : (
              <ChevronDown aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </article>
  )
}
