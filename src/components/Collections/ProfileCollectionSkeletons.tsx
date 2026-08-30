type CatalogSkeletonMode = 'created' | 'saved'

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

export function ProfileCatalogSkeleton({
  count = 8,
  mode,
}: {
  count?: number
  mode: CatalogSkeletonMode
}) {
  return (
    <div
      className={`profile-catalog-skeleton-grid is-${mode}`}
      role="status"
      aria-label={`Loading ${mode} catalog`}
    >
      {Array.from({ length: count }, (_, index) => (
        <div className="entry-card profile-catalog-entry-skeleton" key={index} aria-hidden="true">
          <div className="profile-entry-skeleton-topline">
            <span className="skeleton-box skeleton-avatar" />
            <span className="skeleton-box profile-entry-skeleton-author" />
            <span className="skeleton-box profile-entry-skeleton-date" />
          </div>
          <div className="profile-entry-skeleton-body">
            <span className="skeleton-box profile-entry-skeleton-art" />
            <span className="profile-entry-skeleton-copy">
              <span className="skeleton-box profile-entry-skeleton-title" />
              <span className="skeleton-box profile-entry-skeleton-creator" />
              <span className="skeleton-box profile-entry-skeleton-meta" />
            </span>
          </div>
          <div className="profile-entry-skeleton-reflection">
            <span className="skeleton-box" />
            <span className="skeleton-box short" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function CollectionMediaSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="profile-collection-media-skeleton-grid" role="status" aria-label="Loading collection media">
      {Array.from({ length: count }, (_, index) => (
        <div
          className={`profile-collection-media-skeleton ${index % 4 === 1 ? 'is-square' : 'is-poster'}`}
          key={index}
          aria-hidden="true"
        >
          <span className="skeleton-box profile-media-skeleton-art" />
          <span className="skeleton-box profile-media-skeleton-title" />
          <span className="skeleton-box profile-media-skeleton-creator" />
        </div>
      ))}
    </div>
  )
}
