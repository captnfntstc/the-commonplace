import React from 'react'

export function CardSkeleton() {
  return (
    <div className="entry-card skeleton-card">
      <div className="card-toprow">
        <div className="card-user">
          <div className="skeleton-box skeleton-avatar" />
          <div className="skeleton-box skeleton-username" />
        </div>
        <div className="skeleton-box skeleton-stars" />
      </div>

      <div className="card-body">
        <div className="skeleton-box skeleton-artwork" />
        <div className="card-meta">
          <div className="skeleton-box skeleton-title" />
          <div className="skeleton-box skeleton-creator" />
          <div className="skeleton-box skeleton-genre" />
        </div>
      </div>

      <div className="skeleton-passage-container">
        <div className="skeleton-box skeleton-line line-full" />
        <div className="skeleton-box skeleton-line line-three-quarters" />
      </div>
    </div>
  )
}

export function CardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="skeleton-grid" aria-label="Loading entries...">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}
