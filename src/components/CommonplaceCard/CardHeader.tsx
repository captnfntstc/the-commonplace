import React from 'react'
import { User, Star } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface CardHeaderProps {
  rating: number
  typeIcon: LucideIcon
  typeLabel: string
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
  rating,
  typeIcon: Icon,
  typeLabel,
  onOpenProfile,
}) => {
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
          title="View jimboii's profile"
          aria-label="View jimboii's profile"
        >
          <div className="avatar" aria-hidden="true">
            <User />
          </div>
          <span className="username">jimboii</span>
        </button>
        <StarRating rating={rating} />
      </div>
      <div className="card-type-icon" aria-label={typeLabel}>
        <Icon aria-hidden="true" />
      </div>
    </div>
  )
}


