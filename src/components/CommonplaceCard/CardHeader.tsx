import React from 'react'
import { User, Star } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { formatRelativeTime, formatFullDateTime } from '../../utils/dateUtils'

interface CardHeaderProps {
  rating?: number
  typeIcon: LucideIcon
  typeLabel: string
  authorHandle?: string
  authorAvatarUrl?: string
  createdAt?: string
  onOpenProfile?: () => void
}

export function StarRating({ rating }: { rating: number }) {
  return (
    <div className="star-rating" aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => {
        const fillPercent = Math.max(0, Math.min(1, rating - i)) * 100

        return (
          <span className="star-shell" key={i}>
            <Star aria-hidden="true" className="star" />
            <span className="star-fill" style={{ width: `${fillPercent}%` }}>
              <Star aria-hidden="true" />
            </span>
          </span>
        )
      })}
    </div>
  )
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  typeIcon: Icon,
  typeLabel,
  authorHandle = 'jimboii',
  authorAvatarUrl,
  createdAt,
  onOpenProfile,
}) => {
  const displayHandle = authorHandle.replace(/^@/, '')

  return (
    <div className="card-toprow">
      <div className="card-user-row">
        <button
          type="button"
          className="card-user-btn"
          onClick={(e) => {
            e.stopPropagation()
            onOpenProfile?.()
          }}
          title={`View @${displayHandle}'s profile`}
          aria-label={`View @${displayHandle}'s profile`}
        >
          <div className="avatar" aria-hidden="true">
            {authorAvatarUrl ? (
              <img src={authorAvatarUrl} alt={displayHandle} className="avatar-img" referrerPolicy="no-referrer" />
            ) : (
              <User />
            )}
          </div>
          <span className="username">@{displayHandle}</span>
        </button>
        {createdAt && (
          <span className="card-timestamp" title={formatFullDateTime(createdAt)}>
            &bull; {formatRelativeTime(createdAt)}
          </span>
        )}
      </div>
      <div className="card-type-icon" aria-label={typeLabel} title={typeLabel}>
        <Icon aria-hidden="true" />
      </div>
    </div>
  )
}


