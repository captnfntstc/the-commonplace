import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LegalModal, type LegalModalType } from './auth/LegalModal'
import { useAuth } from '../context/AuthContext'

export function SiteFooter() {
  const { currentUser } = useAuth()
  const [legalModal, setLegalModal] = useState<LegalModalType>(null)
  const year = new Date().getFullYear()

  return (
    <footer className="site-footer">
      <p>© {year} The Commonplace.</p>
      <nav aria-label="Footer navigation">
        <Link to={currentUser ? '/' : '/login'}>Home</Link>
        {currentUser && <Link to="/help">Help &amp; Support</Link>}
        <button type="button" onClick={() => setLegalModal('privacy')}>Privacy</button>
        <button type="button" onClick={() => setLegalModal('terms')}>Terms</button>
      </nav>
      <LegalModal type={legalModal} onClose={() => setLegalModal(null)} />
    </footer>
  )
}
