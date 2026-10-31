import React from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ShieldCheck, Scroll, Cookie, Scale } from 'lucide-react'
import { useAccessibleDialog } from '../../hooks/useAccessibleDialog'

export type LegalModalType = 'terms' | 'privacy' | 'age' | 'cookies' | 'standards' | null

interface LegalModalProps {
  type: LegalModalType
  onClose: () => void
}

export const LegalModal: React.FC<LegalModalProps> = ({ type, onClose }) => {
  const dialogRef = useAccessibleDialog<HTMLDivElement>({ open: Boolean(type), onClose })
  const isTerms = type === 'terms'
  const isAgeGuide = type === 'age'
  const isCookies = type === 'cookies'
  const isStandards = type === 'standards'

  const title = isTerms
    ? 'Terms of Service'
    : isAgeGuide
      ? 'Age & Content Guide'
      : isCookies
        ? 'Cookie & Storage Policy'
        : isStandards
          ? 'Community Standards'
          : 'Privacy Policy'

  const subtitle = isAgeGuide
    ? 'The Commonplace • Account eligibility and content awareness'
    : isCookies
      ? 'The Commonplace • Local storage & minimal data footprint'
      : isStandards
        ? 'The Commonplace • Principles of sanctuary & respectful discourse'
        : 'The Commonplace • Principles of Sanctuary'

  const modalContent = (
    <AnimatePresence>
      {type && (
        <div className="auth-legal-backdrop" onClick={onClose}>
          <motion.div
            ref={dialogRef}
            className="auth-legal-modal"
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="legal-modal-title"
            tabIndex={-1}
          >
            {/* Modal Header */}
            <div className="auth-legal-header">
              <div className="auth-legal-title-block">
                <div className="auth-legal-icon">
                  {isTerms ? (
                    <Scroll size={20} />
                  ) : isCookies ? (
                    <Cookie size={20} />
                  ) : isStandards ? (
                    <Scale size={20} />
                  ) : (
                    <ShieldCheck size={20} />
                  )}
                </div>
                <div>
                  <h2 id="legal-modal-title" className="auth-legal-title">
                    {title}
                  </h2>
                  <span className="auth-legal-subtitle">{subtitle}</span>
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

                  <h3 className="auth-legal-section-title">2. Age Eligibility</h3>
                  <p className="auth-legal-text">
                    You must be at least 16 years old to create or use an account. By registering, you confirm that the date of birth you provide is accurate and that you meet this minimum age requirement.
                  </p>

                  <h3 className="auth-legal-section-title">3. Conduct & Intent</h3>
                  <p className="auth-legal-text">
                    This space is designed for intentional reading and quiet curation. You agree not to misuse automated bots, scrape private user collections, or introduce malicious script injections into reflections.
                  </p>

                  <h3 className="auth-legal-section-title">4. Account Integrity</h3>
                  <p className="auth-legal-text">
                    You are responsible for preserving the security of your authentication credentials. Should you choose to share your catalog publicly or set your profile to private, your visibility preferences will be honored.
                  </p>

                  <h3 className="auth-legal-section-title">5. Public Visibility &amp; Indexing</h3>
                  <p className="auth-legal-text">
                    By keeping your profile public, you consent to your public profile, username, catalog entries, and public collections being discoverable by other users and eligible for indexing by search engines. Making your profile private withdraws this consent for future visibility and indexing, although previously cached search results may take time to disappear.
                  </p>

                  <h3 className="auth-legal-section-title">6. Account Deactivation</h3>
                  <p className="auth-legal-text">
                    You may temporarily deactivate your account. During deactivation, your profile is removed from discovery and your identity is replaced with a neutral label on retained activity. If you choose a return date, visibility resumes automatically on that date; choosing “In my own time” disables automatic reactivation. Signing in reactivates your account.
                  </p>

                  <h3 className="auth-legal-section-title">7. Safety Reports</h3>
                  <p className="auth-legal-text">
                    You may privately report profiles or posts that appear unsafe or violate these terms. Reports must be made in good faith; knowingly false or abusive reports may result in account restrictions.
                  </p>

                  <h3 className="auth-legal-section-title">8. Service Continuity</h3>
                  <p className="auth-legal-text">
                    We strive to ensure your library remains accessible without interruption. You may export your catalog archive at any time from your account settings.
                  </p>
                </div>
              ) : isAgeGuide ? (
                <div className="auth-legal-content">
                  <p className="auth-legal-preamble">
                    <em>The Commonplace</em> is a personal catalog and social space for recording, sharing, and discussing books, films, music, games, and other media that stay with you.
                  </p>

                  <h3 className="auth-legal-section-title">1. Why the service is 16+</h3>
                  <p className="auth-legal-text">
                    Catalog entries, reflections, quotations, comments, and replies are created by users. They may discuss mature themes, strong language, violence, sexuality, mental health, substance use, or other topics that may not be appropriate for younger audiences. The Commonplace is not designed for children.
                  </p>

                  <h3 className="auth-legal-section-title">2. Your date of birth</h3>
                  <p className="auth-legal-text">
                    Your date of birth is kept private and used for eligibility and birthday greetings. It is not shown on your public profile.
                  </p>

                  <h3 className="auth-legal-section-title">3. Country and regional requirements</h3>
                  <p className="auth-legal-text">
                    The Commonplace requires every account holder to be at least 16 years old, regardless of country. Some countries or regions may require a higher minimum age, permission from a parent or guardian, or additional consent before a person can use an online service. When local law sets a stricter requirement, that local requirement applies.
                  </p>

                  <div className="auth-age-region-list">
                    <div>
                      <strong>European Economic Area and United Kingdom</strong>
                      <span>You must be at least 16. Local rules concerning a minor&apos;s digital consent or parental authorization may also apply.</span>
                    </div>
                    <div>
                      <strong>United States and Canada</strong>
                      <span>You must be at least 16. The service is not directed to children, even where another law may use a lower threshold.</span>
                    </div>
                    <div>
                      <strong>All other countries</strong>
                      <span>You must be at least 16 and meet any higher age or consent requirement that applies where you live.</span>
                    </div>
                  </div>

                  <h3 className="auth-legal-section-title">4. If you are unsure</h3>
                  <p className="auth-legal-text">
                    Do not create an account until you can confirm that you meet both The Commonplace&apos;s 16+ requirement and the rules that apply in your country. A parent or guardian should review the service with you whenever local law requires their permission.
                  </p>

                  <h3 className="auth-legal-section-title">5. Content and safety</h3>
                  <p className="auth-legal-text">
                    You can control your profile visibility and report posts or profiles that appear unsafe or violate the Terms of Service. Reports are private and are used for safety review.
                  </p>
                </div>
              ) : isCookies ? (
                <div className="auth-legal-content">
                  <p className="auth-legal-preamble">
                    <em>The Commonplace</em> is built with deep reverence for digital quietude and user privacy. We do not use third-party tracking cookies, advertising beacons, or cross-site fingerprinting scripts.
                  </p>

                  <h3 className="auth-legal-section-title">1. Essential Session Storage</h3>
                  <p className="auth-legal-text">
                    We utilize strictly necessary browser storage to maintain your authenticated session and secure account operations. Without these essential tokens, you would be unable to access or edit your private commonplace.
                  </p>

                  <h3 className="auth-legal-section-title">2. Local Browser Preferences</h3>
                  <p className="auth-legal-text">
                    Your reading preferences—such as typography selection, catalog layout density, and dark appearance—are preserved directly in your local browser storage. This ensures your reading sanctuary loads instantaneously without unnecessary network queries.
                  </p>

                  <h3 className="auth-legal-section-title">3. Zero Advertising or Tracking Cookies</h3>
                  <p className="auth-legal-text">
                    We do not partner with ad networks or behavioral data brokers. Your reading reflections, book logs, and saved items are never tracked across other web domains or monetized for commercial advertising.
                  </p>

                  <h3 className="auth-legal-section-title">4. Managing Local Storage</h3>
                  <p className="auth-legal-text">
                    You can inspect or clear your browser's local storage and cookies at any time through your browser's site settings or by signing out of your account.
                  </p>
                </div>
              ) : isStandards ? (
                <div className="auth-legal-content">
                  <p className="auth-legal-preamble">
                    <em>The Commonplace</em> is conceived as a sanctuary for contemplation, thoughtful critique, and aesthetic discovery. We hold all members to principles of mutual respect and creative integrity.
                  </p>

                  <h3 className="auth-legal-section-title">1. Respectful Discourse</h3>
                  <p className="auth-legal-text">
                    We welcome rigorous literary debate, critical analysis, and differing perspectives on culture and art. Personal attacks, harassment, hateful conduct, intimidation, and targeted vitriol have no place here and are strictly prohibited.
                  </p>

                  <h3 className="auth-legal-section-title">2. Intellectual Honesty &amp; Citation</h3>
                  <p className="auth-legal-text">
                    When quoting, transcribing, or citing passages from authors, thinkers, and fellow readers, credit original sources with integrity. Automated scraping, plagiarism, and spamming are violations of the sanctuary.
                  </p>

                  <h3 className="auth-legal-section-title">3. Content Sensitivities &amp; Spoilers</h3>
                  <p className="auth-legal-text">
                    When discussing pivotal narrative developments or mature thematic elements, use respectful framing and appropriate content notices so other readers may navigate their reading journey unmarred.
                  </p>

                  <h3 className="auth-legal-section-title">4. Safety &amp; Confidential Reporting</h3>
                  <p className="auth-legal-text">
                    If you encounter behavior or content that compromises reader safety or breaches these covenants, please file a confidential safety report. Our moderation stewards review all flags carefully and impartially.
                  </p>
                </div>
              ) : (
                <div className="auth-legal-content">
                  <p className="auth-legal-preamble">
                    Your privacy is fundamental to the essence of <em>The Commonplace</em>. We build tools for contemplation, not for data harvesting or digital noise.
                  </p>

                  <h3 className="auth-legal-section-title">1. Data Minimization</h3>
                  <p className="auth-legal-text">
                    We collect information needed to provide the service, including your name, email address, private date of birth, authentication records, and content you choose to save or publish. We do not sell, rent, or trade your personal information to advertisers or third parties.
                  </p>

                  <h3 className="auth-legal-section-title">2. Date of Birth</h3>
                  <p className="auth-legal-text">
                    Your date of birth is kept in your restricted account settings and is not displayed publicly. It is used to confirm that you meet the 16+ eligibility requirement and to provide an annual birthday greeting.
                  </p>

                  <h3 className="auth-legal-section-title">3. Profile Visibility</h3>
                  <p className="auth-legal-text">
                    Public profiles and their public content may be discoverable by other users and indexed by search engines. When you enable the Private Profile setting, your profile is excluded from future public discovery and indexing, although previously cached search results may take time to disappear.
                  </p>

                  <h3 className="auth-legal-section-title">4. Deactivation Feedback</h3>
                  <p className="auth-legal-text">
                    If you deactivate your account, you may optionally share feedback or identify a safety concern. These answers are stored in your restricted account settings, are not shown on your public profile, and may be used to improve safety and the service experience.
                  </p>

                  <h3 className="auth-legal-section-title">5. Safety Reports</h3>
                  <p className="auth-legal-text">
                    Profile and post reports are private moderation records. They include the reporter, reported account or post, selected reason, optional details, and submission time, and are used only for safety review and enforcement.
                  </p>

                  <h3 className="auth-legal-section-title">6. Cookies & Storage</h3>
                  <p className="auth-legal-text">
                    We store local preferences (such as rating preferences and reading themes) directly in your browser's local storage. No invasive tracking cookies or cross-site fingerprinting scripts are used.
                  </p>

                  <h3 className="auth-legal-section-title">7. Your Data Rights</h3>
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
