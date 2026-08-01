import React from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ShieldCheck, Scroll } from 'lucide-react'

export type LegalModalType = 'terms' | 'privacy' | null

interface LegalModalProps {
  type: LegalModalType
  onClose: () => void
}

export const LegalModal: React.FC<LegalModalProps> = ({ type, onClose }) => {
  const isTerms = type === 'terms'
  const title = isTerms ? 'Terms of Service' : 'Privacy Policy'

  const modalContent = (
    <AnimatePresence>
      {type && (
        <div className="auth-legal-backdrop" onClick={onClose}>
          <motion.div
            className="auth-legal-modal"
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="legal-modal-title"
          >
            {/* Modal Header */}
            <div className="auth-legal-header">
              <div className="auth-legal-title-block">
                <div className="auth-legal-icon">
                  {isTerms ? <Scroll size={20} /> : <ShieldCheck size={20} />}
                </div>
                <div>
                  <h2 id="legal-modal-title" className="auth-legal-title">
                    {title}
                  </h2>
                  <span className="auth-legal-subtitle">The Commonplace • Principles of Sanctuary</span>
                </div>
              </div>
              <button
                type="button"
                className="auth-legal-close-btn"
                onClick={onClose}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="auth-legal-divider" />

            {/* Modal Body */}
            <div className="auth-legal-body">
              {isTerms ? (
                <div className="auth-legal-content">
                  <p className="auth-legal-preamble">
                    By creating a personal account on <em>The Commonplace</em>, you enter into a quiet covenant to maintain a thoughtful, private library for your own study and reflection.
                  </p>

                  <h3 className="auth-legal-section-title">1. Ownership & Sanctuary</h3>
                  <p className="auth-legal-text">
                    Your collections, book passages, album impressions, and personal journals remain strictly yours. We claim no intellectual property rights over the notes, excerpts, or media logs you gather within your commonplace book.
                  </p>

                  <h3 className="auth-legal-section-title">2. Conduct & Intent</h3>
                  <p className="auth-legal-text">
                    This space is designed for intentional reading and quiet curation. You agree not to misuse automated bots, scrape private user collections, or introduce malicious script injections into reflections.
                  </p>

                  <h3 className="auth-legal-section-title">3. Account Integrity</h3>
                  <p className="auth-legal-text">
                    You are responsible for preserving the security of your authentication credentials. Should you choose to share your catalog publicly or set your profile to private, your visibility preferences will be honored.
                  </p>

                  <h3 className="auth-legal-section-title">4. Service Continuity</h3>
                  <p className="auth-legal-text">
                    We strive to ensure your library remains accessible without interruption. You may export your catalog archive at any time from your account settings.
                  </p>
                </div>
              ) : (
                <div className="auth-legal-content">
                  <p className="auth-legal-preamble">
                    Your privacy is fundamental to the essence of <em>The Commonplace</em>. We build tools for contemplation, not for data harvesting or digital noise.
                  </p>

                  <h3 className="auth-legal-section-title">1. Data Minimization</h3>
                  <p className="auth-legal-text">
                    We collect only the essential information required to maintain your account: your name, email address, and encrypted security tokens. We do not sell, rent, or trade your personal information to advertisers or third parties.
                  </p>

                  <h3 className="auth-legal-section-title">2. Private Profile Option</h3>
                  <p className="auth-legal-text">
                    When you enable the Private Profile setting, your catalog, username, and reading notes are completely invisible to search engines and other users.
                  </p>

                  <h3 className="auth-legal-section-title">3. Cookies & Storage</h3>
                  <p className="auth-legal-text">
                    We store local preferences (such as rating preferences and reading themes) directly in your browser's local storage. No invasive tracking cookies or cross-site fingerprinting scripts are used.
                  </p>

                  <h3 className="auth-legal-section-title">4. Your Data Rights</h3>
                  <p className="auth-legal-text">
                    You retain full control over your data. You may request a complete export of your catalog or delete your account and all associated entries at any time from your settings.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="auth-legal-footer">
              <button
                type="button"
                className="auth-primary-btn auth-legal-ack-btn"
                onClick={onClose}
              >
                Understood
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )

  return createPortal(modalContent, document.body)
}
