import { ArrowLeft, Home, SearchX } from 'lucide-react'

interface NotFoundPageProps {
  onHome: () => void
  onBack?: () => void
}

export function NotFoundPage({ onHome, onBack }: NotFoundPageProps) {
  return (
    <main className="not-found-page">
      <div className="not-found-card">
        <SearchX aria-hidden="true" />
        <p className="not-found-code">404</p>
        <h1>This page slipped between the margins.</h1>
        <p>The link may be outdated, incomplete, or the page may have moved.</p>
        <div className="not-found-actions">
          {onBack && (
            <button type="button" className="ghost-btn" onClick={onBack}>
              <ArrowLeft aria-hidden="true" /> Back
            </button>
          )}
          <button type="button" className="primary-btn" onClick={onHome}>
            <Home aria-hidden="true" /> Go home
          </button>
        </div>
      </div>
    </main>
  )
}
