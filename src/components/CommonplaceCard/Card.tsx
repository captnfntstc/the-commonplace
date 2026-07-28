import React from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
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
  year?: string
  coverUrl?: string
  summary?: string
  createdAt: string
  updatedAt: string
  coverTone: string
}

interface CardProps {
  entry: CardEntry
  expanded: boolean
  onDelete: () => void
  onEdit: () => void
  onToggle: () => void
  typeIcon: LucideIcon
  typeLabel: string
}

export const Card: React.FC<CardProps> = ({
  entry,
  expanded,
  onDelete,
  onEdit,
  onToggle,
  typeIcon,
  typeLabel,
}) => {
  return (
    <article className={`entry-card tone-${entry.coverTone}`}>
      {/* Top Header Row */}
      <CardHeader
        rating={entry.rating}
        typeIcon={typeIcon}
        typeLabel={typeLabel}
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
        expanded={expanded}
        onEdit={onEdit}
        onDelete={onDelete}
      />

      {/* Card Toggle Button */}
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
    </article>
  )
}
