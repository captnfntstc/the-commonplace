import React from 'react'
import { AtSign, BookOpen, CircleHelp, Lock, Settings, ShieldAlert } from 'lucide-react'

interface HelpSupportPageProps {
  onOpenSettings: () => void
}

const helpTopics = [
  {
    Icon: BookOpen,
    title: 'Catalog and collections',
    copy: 'Create reviews from the + button, save entries with the bookmark, and organize media from your profile collections.',
  },
  {
    Icon: AtSign,
    title: 'Comments and mentions',
    copy: 'Type @ while replying to mention someone you mutually follow. Likes, comments, and their notifications update across accounts.',
  },
  {
    Icon: Lock,
    title: 'Privacy and visibility',
    copy: 'Choose whether your profile is private, whether saved activity is visible, and who can comment from your privacy settings.',
  },
  {
    Icon: ShieldAlert,
    title: 'Reporting content',
    copy: 'Use the flag in a post reading view or on another user’s profile. Reports are private and cannot be submitted on your own content.',
  },
]

export const HelpSupportPage: React.FC<HelpSupportPageProps> = ({ onOpenSettings }) => (
  <main className="page-wrapper account-utility-page">
    <div className="account-utility-container">
      <header className="account-utility-heading">
        <span className="account-utility-icon"><CircleHelp aria-hidden="true" /></span>
        <div>
          <p>The Commonplace guide</p>
          <h1>Help &amp; Support</h1>
          <span>Quick answers for managing your catalog, interactions, and account.</span>
        </div>
      </header>

      <section className="help-topic-grid" aria-label="Help topics">
        {helpTopics.map(({ Icon, title, copy }) => (
          <article className="help-topic-card" key={title}>
            <Icon aria-hidden="true" />
            <h2>{title}</h2>
            <p>{copy}</p>
          </article>
        ))}
      </section>

      <section className="account-utility-section support-checklist">
        <div className="account-utility-section-heading">
          <div>
            <h2>Something not working?</h2>
            <p>Try these checks before signing out or changing account details.</p>
          </div>
        </div>
        <ol>
          <li>Refresh the page and confirm you are using the intended account.</li>
          <li>Check that your email is verified for publishing features.</li>
          <li>Review comment, privacy, and account controls in Settings.</li>
        </ol>
        <button type="button" className="support-settings-btn" onClick={onOpenSettings}>
          <Settings aria-hidden="true" />
          <span>Open Settings</span>
        </button>
      </section>
    </div>
  </main>
)
