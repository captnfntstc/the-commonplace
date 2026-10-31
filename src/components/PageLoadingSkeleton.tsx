import { CardSkeletonGrid } from './CommonplaceCard/CardSkeleton'
import { pageLoadingVariantForPath, type PageLoadingVariant } from './pageLoadingRoute'

function GlobalHeaderSkeleton({ home = false }: { home?: boolean }) {
  return (
    <header className={`global-app-header ${home ? 'is-home-page' : 'is-inner-page'} route-skeleton-header`} aria-hidden="true">
      <div className="global-app-header-layout">
        <div className="global-header-navigation">
          {!home && <span className="skeleton-box route-skeleton-home-icon" />}
        </div>
        <span className="skeleton-box route-skeleton-wordmark" />
        <div className="global-header-actions route-skeleton-header-actions">
          <span className="skeleton-box" />
          <span className="skeleton-box" />
          <span className="skeleton-box is-avatar" />
        </div>
      </div>
    </header>
  )
}

function HomeLoadingSkeleton() {
  return (
    <div className="app-shell route-home-skeleton">
      <GlobalHeaderSkeleton home />
      <main className="main-content">
        <div className="homepage-filter-shell">
          <div className="filter-row">
            <div className="route-skeleton-type-tabs" aria-hidden="true">
              {Array.from({ length: 7 }, (_, index) => <span className="skeleton-box" key={index} />)}
            </div>
          </div>
        </div>
        <div className="home-card-stage">
          <CardSkeletonGrid count={8} label="Loading home entries" />
        </div>
      </main>
    </div>
  )
}

function ProfileLoadingSkeleton() {
  return (
    <>
      <GlobalHeaderSkeleton />
      <main className="page-wrapper profile-page-wrapper route-profile-skeleton" aria-hidden="true">
        <div className="profile-page-container">
          <div className="skeleton-box route-profile-banner" />
          <div className="route-profile-identity">
            <span className="skeleton-box route-profile-avatar" />
            <span className="route-profile-copy">
              <span className="skeleton-box is-name" />
              <span className="skeleton-box is-handle" />
              <span className="skeleton-box is-bio" />
            </span>
          </div>
          <div className="route-profile-stats">
            {Array.from({ length: 4 }, (_, index) => <span className="skeleton-box" key={index} />)}
          </div>
          <div className="route-profile-tabs">
            {Array.from({ length: 4 }, (_, index) => <span className="skeleton-box" key={index} />)}
          </div>
          <CardSkeletonGrid count={4} label="Loading profile entries" />
        </div>
      </main>
    </>
  )
}

export function EntityLoadingSkeleton({
  showHeader = true,
  showLocalNavigation = false,
}: {
  showHeader?: boolean
  showLocalNavigation?: boolean
}) {
  return (
    <>
      {showHeader && <GlobalHeaderSkeleton />}
      <main className="universal-media-profile-page is-spotlight-profile route-entity-skeleton" aria-hidden="true">
        {showLocalNavigation && (
          <>
            <div className="media-profile-topbar">
              <span className="skeleton-box route-entity-back-btn" />
              <div className="media-profile-topbar-actions">
                <span className="skeleton-box route-entity-topbar-badge" />
              </div>
            </div>
            <div className="editorial-divider" />
          </>
        )}
        <section className="media-hero-section">
          <div className="media-container-category-badge skeleton-box" />

          {/* Left Column in DOM (art grid-area, appears on the right in Spotlight desktop layout) */}
          <div className="media-hero-left">
            <div className="media-artwork-container is-square-artwork skeleton-box route-entity-artwork" />
          </div>

          {/* Right Column in DOM (copy grid-area, appears on the left in Spotlight desktop layout) */}
          <div className="media-hero-right">
            <div className="media-hero-text-block">
              <div className="media-hero-meta-header">
                <span className="skeleton-box route-entity-eyebrow" />
                <div className="media-title-row">
                  <span className="skeleton-box route-entity-title" />
                </div>
              </div>

              <div className="media-chips-row">
                <span className="skeleton-box route-entity-chip" />
                <span className="skeleton-box route-entity-chip" />
                <span className="skeleton-box route-entity-chip" />
                <span className="skeleton-box route-entity-chip" />
              </div>

              <div className="media-hero-body-block">
                <span className="skeleton-box route-entity-desc-line" />
                <span className="skeleton-box route-entity-desc-line route-entity-desc-line--short" />
                <div className="media-hero-actions">
                  <span className="skeleton-box route-entity-action-btn" />
                  <span className="skeleton-box route-entity-action-btn" />
                  <span className="skeleton-box route-entity-action-icon" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="media-tabs-container">
          <div className="media-tabs-wrapper">
            <div className="media-tabs-row route-entity-tabs">
              <span className="skeleton-box route-entity-tab is-active" />
              <span className="skeleton-box route-entity-tab" />
              <span className="skeleton-box route-entity-tab" />
              <span className="skeleton-box route-entity-tab" />
            </div>
            <div className="media-tab-content-area">
              <div className="route-entity-content">
                <span className="skeleton-box is-heading" />
                <span className="skeleton-box is-panel" />
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}

function SettingsLoadingSkeleton() {
  return (
    <>
      <GlobalHeaderSkeleton />
      <main className="page-wrapper settings-desktop-wrapper route-settings-skeleton" aria-hidden="true">
        <div className="settings-desktop-container">
          <aside className="route-settings-sidebar">
            <span className="skeleton-box is-group-title" />
            {Array.from({ length: 6 }, (_, index) => <span className="skeleton-box is-nav-item" key={index} />)}
          </aside>
          <section className="route-settings-main">
            <span className="skeleton-box is-title" />
            <span className="skeleton-box is-description" />
            {Array.from({ length: 3 }, (_, index) => (
              <div className="route-settings-section" key={index}>
                <span className="skeleton-box is-section-title" />
                <span className="skeleton-box is-section-copy" />
                <span className="skeleton-box is-field" />
                <span className="skeleton-box is-field is-short" />
              </div>
            ))}
          </section>
        </div>
      </main>
    </>
  )
}

function ActivityLoadingSkeleton() {
  return (
    <>
      <GlobalHeaderSkeleton />
      <main className="page-wrapper account-utility-page route-activity-skeleton" aria-hidden="true">
        <div className="account-utility-container">
          <div className="route-utility-heading">
            <span className="skeleton-box is-title" />
            <span className="skeleton-box is-description" />
          </div>
          <div className="activity-stat-grid">
            {Array.from({ length: 3 }, (_, index) => <span className="skeleton-box route-activity-stat" key={index} />)}
          </div>
          <span className="skeleton-box route-activity-panel" />
          <span className="skeleton-box route-activity-panel is-tall" />
        </div>
      </main>
    </>
  )
}

function HelpLoadingSkeleton() {
  return (
    <>
      <GlobalHeaderSkeleton />
      <main className="page-wrapper account-utility-page route-help-skeleton" aria-hidden="true">
        <div className="account-utility-container">
          <div className="route-help-heading">
            <span className="skeleton-box is-icon" />
            <span className="route-help-heading-copy">
              <span className="skeleton-box is-eyebrow" />
              <span className="skeleton-box is-title" />
              <span className="skeleton-box is-description" />
            </span>
          </div>
          <div className="route-help-grid">
            {Array.from({ length: 4 }, (_, index) => <span className="skeleton-box" key={index} />)}
          </div>
          <span className="skeleton-box route-help-panel" />
        </div>
      </main>
    </>
  )
}

function AuthLoadingSkeleton() {
  return (
    <main className="auth-page route-auth-skeleton" aria-hidden="true">
      <header className="route-auth-header">
        <span className="skeleton-box" />
      </header>
      <div className="route-auth-card">
        <section className="route-auth-art">
          <span className="skeleton-box is-illustration" />
          <span className="skeleton-box is-quote" />
          <span className="skeleton-box is-copy" />
        </section>
        <section className="route-auth-form">
          <span className="skeleton-box is-heading" />
          <span className="skeleton-box is-subheading" />
          <span className="skeleton-box is-field" />
          <span className="skeleton-box is-field" />
          <span className="skeleton-box is-button" />
        </section>
      </div>
    </main>
  )
}

function UtilityLoadingSkeleton() {
  return (
    <>
      <GlobalHeaderSkeleton />
      <main className="page-wrapper account-utility-page route-utility-skeleton" aria-hidden="true">
        <div className="account-utility-container">
          <div className="route-utility-heading">
            <span className="skeleton-box is-title" />
            <span className="skeleton-box is-description" />
          </div>
          <span className="skeleton-box route-utility-panel" />
        </div>
      </main>
    </>
  )
}

const variantLabels: Record<PageLoadingVariant, string> = {
  home: 'home',
  profile: 'profile',
  entity: 'media profile',
  settings: 'settings',
  activity: 'activity',
  help: 'help and support',
  auth: 'account page',
  utility: 'page',
}

export function PageLoadingSkeleton({ pathname }: { pathname?: string }) {
  const currentPath = pathname ?? (typeof window === 'undefined' ? '/' : window.location.pathname)
  const variant = pageLoadingVariantForPath(currentPath)
  const content = variant === 'home'
    ? <HomeLoadingSkeleton />
    : variant === 'profile'
      ? <ProfileLoadingSkeleton />
      : variant === 'entity'
        ? <EntityLoadingSkeleton />
        : variant === 'settings'
          ? <SettingsLoadingSkeleton />
          : variant === 'activity'
            ? <ActivityLoadingSkeleton />
            : variant === 'help'
              ? <HelpLoadingSkeleton />
              : variant === 'auth'
                ? <AuthLoadingSkeleton />
                : <UtilityLoadingSkeleton />

  return (
    <div
      className={`page-loading-skeleton is-${variant}`}
      role="status"
      aria-live="polite"
      aria-label={`Loading ${variantLabels[variant]}`}
      data-loading-variant={variant}
    >
      {content}
    </div>
  )
}
