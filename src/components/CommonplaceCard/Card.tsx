import React, { useState } from 'react'
import { ChevronDown, ChevronUp, Heart, MessageSquare, Bookmark, Sliders, Settings } from 'lucide-react'
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
}

interface CardProps {
  entry: CardEntry
  expanded: boolean
  onDelete: () => void
  onEdit: () => void
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
  saveCount = 5,
  onToggleLike,
  onToggleSave,
  commentsDisabled = false,
  onToggleCommentsDisabled,
}) => {
  const [showQuickSettings, setShowQuickSettings] = useState(false)

  return (
    <article className={`entry-card tone-${entry.coverTone}`}>
      {/* Top Header Row */}
      <CardHeader
        rating={entry.rating}
        typeIcon={typeIcon}
        typeLabel={typeLabel}
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
          <FormattedText text={entry.favoritePassage} align={entry.passageAlign} />
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
      <div className="card-glance-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
          <button
            type="button"
            className={`glance-btn ${isLiked ? 'liked' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              onToggleLike?.()
            }}
            style={{ background: 'none', border: 'none', color: isLiked ? '#e57373' : 'var(--secondary)', display: 'flex', alignItems: 'center', gap: 5, fontSize: '12px', cursor: 'pointer' }}
          >
            <Heart size={15} fill={isLiked ? '#e57373' : 'none'} />
            <span>{likeCount + (isLiked ? 1 : 0)}</span>
          </button>

          <button
            type="button"
            className="glance-btn"
            onClick={(e) => {
              e.stopPropagation()
              onExpandOverlay?.()
            }}
            style={{ background: 'none', border: 'none', color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: 5, fontSize: '12px', cursor: 'pointer' }}
          >
            <MessageSquare size={15} />
            <span>{commentCount}</span>
          </button>

          <button
            type="button"
            className={`glance-btn ${isSaved ? 'saved' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              onToggleSave?.()
            }}
            style={{ background: 'none', border: 'none', color: isSaved ? '#f5b74c' : 'var(--secondary)', display: 'flex', alignItems: 'center', gap: 5, fontSize: '12px', cursor: 'pointer' }}
          >
            <Bookmark size={15} fill={isSaved ? '#f5b74c' : 'none'} />
            <span>{saveCount + (isSaved ? 1 : 0)}</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="card-quick-settings-btn"
            onClick={(e) => {
              e.stopPropagation()
              setShowQuickSettings((prev) => !prev)
            }}
            title="Card Quick Settings"
            aria-label="Card Quick Settings"
            style={{ background: 'none', border: 'none', color: 'var(--secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <Settings size={14} />
          </button>

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

      {/* Inline Quick Settings Popover */}
      {showQuickSettings && (
        <div style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.3)', borderTop: '1px dashed rgba(255,255,255,0.1)', display: 'flex', gap: '12px', alignItems: 'center', fontSize: '12px', color: 'var(--secondary)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={commentsDisabled}
              onChange={() => onToggleCommentsDisabled?.()}
            />
            <span>Disable comments on this card</span>
          </label>
        </div>
      )}
    </article>
  )
}
