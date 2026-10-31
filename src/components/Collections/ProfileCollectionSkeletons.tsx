export function CollectionShelfSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="profile-collections-row profile-collections-skeleton-row" role="status" aria-label="Loading collections">
      {Array.from({ length: count }, (_, index) => (
        <div className="profile-collection-card profile-collection-card-skeleton" key={index} aria-hidden="true">
          <div className="profile-collection-card-main">
            <span className="profile-collection-preview collection-skeleton-collage">
              {Array.from({ length: 4 }, (_, tileIndex) => (
                <span className="skeleton-box" key={tileIndex} />
              ))}
            </span>
            <span className="profile-collection-card-copy">
              <span className="skeleton-box collection-skeleton-title" />
              <span className="skeleton-box collection-skeleton-creator" />
              <span className="skeleton-box collection-skeleton-count" />
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

export function CollectionDetailHeroSkeleton() {
  return (
    <div className="collection-detail-heading collection-detail-skeleton-heading" role="status" aria-label="Loading collection details">
      <div className="collection-detail-nav">
        <span className="skeleton-box collection-skeleton-back-btn" />
      </div>

      <div className="collection-detail-hero collection-detail-hero-skeleton">
        <div className="collection-detail-hero-glow" aria-hidden="true" />
        <div className="collection-detail-hero-cover collection-detail-cover-skeleton" aria-hidden="true">
          <span className="skeleton-box collection-skeleton-hero-cover-art" />
        </div>

        <div className="collection-detail-hero-body collection-detail-body-skeleton">
          <div className="collection-detail-copy">
            <div className="collection-detail-eyebrow">
              <span className="skeleton-box collection-skeleton-badge" />
              <span className="skeleton-box collection-skeleton-curator" />
            </div>
            <span className="skeleton-box collection-skeleton-hero-title" />
            <div className="collection-detail-meta">
              <span className="skeleton-box collection-skeleton-meta-pill count" />
              <span className="skeleton-box collection-skeleton-meta-pill" />
              <span className="skeleton-box collection-skeleton-meta-pill short" />
            </div>
            <div className="collection-skeleton-description">
              <span className="skeleton-box" />
              <span className="skeleton-box short" />
            </div>
          </div>

          <div className="collection-detail-hero-actions">
            <span className="skeleton-box collection-skeleton-action-btn primary" />
            <span className="skeleton-box collection-skeleton-action-btn secondary" />
            <span className="skeleton-box collection-skeleton-action-btn danger" />
          </div>
        </div>
      </div>
    </div>
  )
}

