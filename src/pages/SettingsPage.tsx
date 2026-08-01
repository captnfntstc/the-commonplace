import React, { useState, useEffect } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Trash2,
  Download,
  Lock,
} from 'lucide-react'
import {
  LinkedAccountCard,
  type ConnectionStatus,
  type ProviderInfo,
} from '../components/Settings/LinkedAccountCard'
import {
  SettingsSidebar,
  type SettingsNavTab,
} from '../components/Settings/SettingsSidebar'
import { SettingsSection } from '../components/Settings/SettingsSection'
import { SettingsField } from '../components/Settings/SettingsField'
import { SettingsToggle } from '../components/Settings/SettingsToggle'
import { AvatarUploader } from '../components/Settings/AvatarUploader'
import { CoverUploader } from '../components/Settings/CoverUploader'


const PROVIDERS: ProviderInfo[] = [
  {
    id: 'google',
    name: 'Google',
    description: 'Use your Google account for authentication and faster sign in.',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
        <path d="M12.24 10.285V13.4h6.887c-.58 3.407-3.41 5.604-6.887 5.604-4.156 0-7.56-3.376-7.56-7.54s3.404-7.54 7.56-7.54c1.86 0 3.56.666 4.88 1.884l2.5-2.5C17.65 1.585 15.13.785 12.24.785 6.03.785 1 5.815 1 12.025s5.03 11.24 11.24 11.24c6.48 0 10.77-4.56 10.77-10.96 0-.74-.08-1.46-.2-2.02H12.24z" />
      </svg>
    ),
  },
  {
    id: 'apple',
    name: 'Apple',
    description: 'Sign in with your Apple ID for enhanced privacy and security.',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.54c.67-.82 1.13-1.96.99-3.11-.98.04-2.18.66-2.88 1.48-.63.73-1.18 1.89-1.03 3.02 1.1.09 2.24-.56 2.92-1.39z" />
      </svg>
    ),
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Link your GitHub profile to showcase developer activity and code.',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
      </svg>
    ),
  },
  {
    id: 'discord',
    name: 'Discord',
    description: 'Connect your Discord profile to display community status.',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
      </svg>
    ),
  },
  {
    id: 'facebook',
    name: 'Facebook',
    description: 'Link your Facebook account for social authentication.',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  {
    id: 'instagram',
    name: 'Instagram',
    description: 'Connect Instagram to sync profile picture and handle.',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
  },
  {
    id: 'twitterX',
    name: 'X (Twitter)',
    description: 'Sign in and verify your account handle with X.',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
]

export type UserProfileState = {
  firstName: string
  lastName: string
  showFullName: boolean
  handle: string
  email: string
  bio: string
  avatarUrl: string
  coverUrl: string
  lastUsernameChangeDate?: string
}

interface SettingsPageProps {
  onBack: () => void
  onClearAllData: () => void
  userProfile: UserProfileState
  onSaveProfile: (updated: UserProfileState) => void
}

const TAKEN_USERNAMES = new Set(['admin', 'commonplace', 'system', 'root', 'collector', 'superuser', 'official'])
const USERNAME_COOLDOWN_DAYS = 14

export const SettingsPage: React.FC<SettingsPageProps> = ({
  onBack,
  onClearAllData,
  userProfile,
  onSaveProfile,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsNavTab>('profile')

  // Form State
  const [firstName, setFirstName] = useState(userProfile.firstName)
  const [lastName, setLastName] = useState(userProfile.lastName)
  const [showFullName, setShowFullName] = useState(userProfile.showFullName)
  const [handleInput, setHandleInput] = useState(userProfile.handle.replace(/^@/, ''))
  const [email, setEmail] = useState(userProfile.email)
  const [bio, setBio] = useState(userProfile.bio)
  const [avatarUrl, setAvatarUrl] = useState(userProfile.avatarUrl)
  const [coverUrl, setCoverUrl] = useState(userProfile.coverUrl)
  const [savedNotice, setSavedNotice] = useState(false)

  // Sync form state if props update
  useEffect(() => {
    setFirstName(userProfile.firstName)
    setLastName(userProfile.lastName)
    setShowFullName(userProfile.showFullName)
    setHandleInput(userProfile.handle.replace(/^@/, ''))
    setEmail(userProfile.email)
    setBio(userProfile.bio)
    setAvatarUrl(userProfile.avatarUrl)
    setCoverUrl(userProfile.coverUrl)
  }, [userProfile])

  // Account Statuses Map (Google & GitHub connected by default)
  const [accountStatuses, setAccountStatuses] = useState<Record<string, ConnectionStatus>>({
    google: 'connected',
    apple: 'disconnected',
    github: 'connected',
    discord: 'disconnected',
    facebook: 'disconnected',
    instagram: 'disconnected',
    twitterX: 'disconnected',
  })

  const handleToggleProvider = (id: string) => {
    const current = accountStatuses[id] || 'disconnected'
    if (current === 'connecting') return

    if (current === 'connected') {
      setAccountStatuses((prev) => ({ ...prev, [id]: 'disconnected' }))
    } else {
      setAccountStatuses((prev) => ({ ...prev, [id]: 'connecting' }))
      setTimeout(() => {
        setAccountStatuses((prev) => ({ ...prev, [id]: 'connected' }))
      }, 750)
    }
  }

  // Security state (2FA & Password)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordNotice, setPasswordNotice] = useState('')

  const handlePasswordUpdate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPassword) {
      alert('Please enter your current password.')
      return
    }
    if (newPassword.length < 6) {
      alert('New password must be at least 6 characters long.')
      return
    }
    if (newPassword !== confirmPassword) {
      alert('New password and confirmation do not match.')
      return
    }
    setPasswordNotice('Password updated successfully!')
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setTimeout(() => setPasswordNotice(''), 3000)
  }

  // General toggles state
  const [warnUnratedEntry, setWarnUnratedEntry] = useState(() => {
    const stored = localStorage.getItem('the-commonplace.warn-unrated')
    return stored === null ? true : stored !== 'false'
  })
  const [dropCapEnabled, setDropCapEnabled] = useState(true)
  const [gpuAccelerated, setGpuAccelerated] = useState(true)
  const [smoothAccordion, setSmoothAccordion] = useState(true)
  const [weeklyDigest, setWeeklyDigest] = useState(true)
  const [publicIndexing, setPublicIndexing] = useState(true)
  const [privateProfile, setPrivateProfile] = useState(false)

  // Check if dirty changes exist
  const sanitizedHandle = handleInput.trim().toLowerCase().replace(/^@/, '')
  const hasChanges =
    firstName.trim() !== userProfile.firstName ||
    lastName.trim() !== userProfile.lastName ||
    showFullName !== userProfile.showFullName ||
    sanitizedHandle !== userProfile.handle.toLowerCase().replace(/^@/, '') ||
    email.trim() !== userProfile.email ||
    bio.trim() !== userProfile.bio ||
    avatarUrl.trim() !== userProfile.avatarUrl ||
    coverUrl.trim() !== userProfile.coverUrl

  // 14-Day Cooldown Calculation
  const lastChangeMs = userProfile.lastUsernameChangeDate
    ? new Date(userProfile.lastUsernameChangeDate).getTime()
    : 0
  const nowMs = Date.now()
  const daysPassed = (nowMs - lastChangeMs) / (1000 * 60 * 60 * 24)
  const isUsernameCooldownActive = daysPassed < USERNAME_COOLDOWN_DAYS && lastChangeMs > 0
  const nextAvailableDate = new Date(lastChangeMs + USERNAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toLocaleDateString(
    undefined,
    { year: 'numeric', month: 'short', day: 'numeric' },
  )

  // Username validation
  const isCurrentUsername = sanitizedHandle === userProfile.handle.toLowerCase().replace(/^@/, '')
  const isTaken = TAKEN_USERNAMES.has(sanitizedHandle) && !isCurrentUsername
  const isValidUsernameFormat = /^[a-zA-Z0-9_]{3,20}$/.test(sanitizedHandle)
  const isUsernameAvailable = !isTaken && isValidUsernameFormat

  const handleResetForm = () => {
    setFirstName(userProfile.firstName)
    setLastName(userProfile.lastName)
    setShowFullName(userProfile.showFullName)
    setHandleInput(userProfile.handle.replace(/^@/, ''))
    setEmail(userProfile.email)
    setBio(userProfile.bio)
    setAvatarUrl(userProfile.avatarUrl)
    setCoverUrl(userProfile.coverUrl)
  }

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault()

    if (!isCurrentUsername && isTaken) {
      alert('This username is taken. Please choose another unique username.')
      return
    }

    if (!isCurrentUsername && isUsernameCooldownActive) {
      alert(`Username cannot be changed yet. Next change available on ${nextAvailableDate}.`)
      return
    }

    const usernameChanged = !isCurrentUsername && !isUsernameCooldownActive

    const updated: UserProfileState = {
      firstName: firstName.trim() || 'Jimmy',
      lastName: lastName.trim() || 'Boy',
      showFullName,
      handle: sanitizedHandle || 'jimboii',
      email: email.trim() || 'jimboii@commonplace.app',
      bio: bio.trim(),
      avatarUrl: avatarUrl.trim(),
      coverUrl: coverUrl.trim(),
      lastUsernameChangeDate: usernameChanged ? new Date().toISOString() : userProfile.lastUsernameChangeDate,
    }

    onSaveProfile(updated)
    setSavedNotice(true)
    setTimeout(() => setSavedNotice(false), 3000)
  }

  const computedDisplayName = showFullName ? `${firstName} ${lastName}`.trim() : firstName

  return (
    <div className="page-wrapper settings-desktop-wrapper">
      {/* Top Floating Circle Back Button */}
      <button
        type="button"
        className="profile-back-circle"
        onClick={onBack}
        title="Back to Feed"
        aria-label="Back to Feed"
      >
        <ArrowLeft aria-hidden="true" />
      </button>

      <div className="settings-desktop-container">
        {/* Left Sticky Navigation Sidebar */}
        <SettingsSidebar activeTab={activeTab} onSelectTab={(tab) => setActiveTab(tab)} />

        {/* Right Main Settings Panel */}
        <main className="settings-main-panel">
          {savedNotice && (
            <div className="settings-saved-banner">
              <CheckCircle2 aria-hidden="true" />
              <span>Settings updated successfully!</span>
            </div>
          )}

          {/* PAGE 1: PROFILE */}
          {activeTab === 'profile' && (
            <div className="settings-page-content">
              {/* Profile Page Header */}
              <div className="settings-header-minimal">
                <h1 className="settings-page-title">Profile</h1>
                <p className="settings-page-desc">
                  Manage your public profile information and how others see you.
                </p>
              </div>

              {/* Section 1: Picture & Cover */}
              <SettingsSection
                title="Profile Picture & Cover"
                description="Upload custom artwork or choose from editorial presets."
              >
                <div className="settings-block">
                  <div className="uploader-sublabel">Avatar Photo</div>
                  <AvatarUploader avatarUrl={avatarUrl} onChangeAvatar={setAvatarUrl} />
                </div>

                <div className="settings-block" style={{ marginTop: 32 }}>
                  <div className="uploader-sublabel">Banner Artwork</div>
                  <CoverUploader coverUrl={coverUrl} onChangeCover={setCoverUrl} />
                </div>
              </SettingsSection>

              {/* Section 2: Profile Information */}
              <SettingsSection
                title="Profile Information"
                description="Your personal identity details on The Commonplace."
              >
                <div className="settings-form-grid">
                  <div className="form-row-two-col">
                    <SettingsField label="First Name" htmlFor="first-name">
                      <input
                        id="first-name"
                        type="text"
                        className="dark-setting-input"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="e.g. Jimmy"
                      />
                    </SettingsField>

                    <SettingsField label="Last Name" htmlFor="last-name">
                      <input
                        id="last-name"
                        type="text"
                        className="dark-setting-input"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="e.g. Boy"
                      />
                    </SettingsField>
                  </div>

                  <SettingsField
                    label="Display Name"
                    helperText="This name is shown at the top of your public profile."
                    htmlFor="display-name"
                  >
                    <input
                      id="display-name"
                      type="text"
                      className="dark-setting-input"
                      value={computedDisplayName}
                      readOnly
                      style={{ opacity: 0.8 }}
                    />
                  </SettingsField>

                  <SettingsField
                    label="Username Identifier"
                    badge={
                      !isCurrentUsername && (
                        <span className={`username-status-badge ${isUsernameAvailable ? 'available' : 'taken'}`}>
                          {isUsernameAvailable ? (
                            <>
                              <CheckCircle2 aria-hidden="true" />
                              <span>Available</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle aria-hidden="true" />
                              <span>{isTaken ? 'Username Taken' : 'Invalid format'}</span>
                            </>
                          )}
                        </span>
                      )
                    }
                    helperText={
                      isUsernameCooldownActive ? (
                        <span className="cooldown-notice locked">
                          <Clock aria-hidden="true" />
                          <span>
                            Username locked. Usernames can only be changed once every 14 days. Next change available on{' '}
                            <strong>{nextAvailableDate}</strong>.
                          </span>
                        </span>
                      ) : (
                        <span className="cooldown-notice">
                          <ShieldCheck aria-hidden="true" />
                          <span>Unique account identifier. Can be changed once every 14 days.</span>
                        </span>
                      )
                    }
                    htmlFor="username"
                  >
                    <div className="username-input-wrapper">
                      <span className="at-prefix">@</span>
                      <input
                        id="username"
                        type="text"
                        className={`dark-setting-input with-prefix ${
                          !isCurrentUsername && !isUsernameAvailable ? 'error' : ''
                        }`}
                        value={handleInput}
                        onChange={(e) => setHandleInput(e.target.value.replace(/\s+/g, ''))}
                        disabled={isUsernameCooldownActive}
                        placeholder="jimboii"
                      />
                    </div>
                  </SettingsField>

                  <SettingsField label="Email Address" htmlFor="email-address">
                    <input
                      id="email-address"
                      type="email"
                      className="dark-setting-input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="jimboii@commonplace.app"
                    />
                  </SettingsField>
                </div>
              </SettingsSection>

              {/* Section 3: Biography */}
              <SettingsSection title="Biography" description="Share a short introduction about your taste and library.">
                <SettingsField
                  label="Bio"
                  helperText={<span className="char-count">{bio.length} / 300 characters</span>}
                  htmlFor="bio"
                >
                  <textarea
                    id="bio"
                    className="dark-setting-textarea"
                    rows={4}
                    value={bio}
                    maxLength={300}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Collector of timeless passages, album impressions, cinematic notes, and personal reflections..."
                  />
                </SettingsField>
              </SettingsSection>

              {/* Section 4: Visibility */}
              <SettingsSection title="Visibility & Preferences" description="Control how your profile appears to others.">
                <SettingsToggle
                  label="Display Full Name"
                  description="Show your full name publicly alongside your username handle."
                  checked={showFullName}
                  onChange={setShowFullName}
                />
              </SettingsSection>
            </div>
          )}

          {/* PAGE 2: GENERAL */}
          {activeTab === 'general' && (
            <div className="settings-page-content">
              <div className="settings-header-minimal">
                <h1 className="settings-page-title">General Settings</h1>
                <p className="settings-page-desc">Interface behavior and reading preferences.</p>
              </div>

              <SettingsSection title="Publishing Preferences">
                <SettingsToggle
                  label="Warn Before Publishing Unrated Entries"
                  description="Display a confirmation prompt when publishing an entry without a star rating."
                  checked={warnUnratedEntry}
                  onChange={(val) => {
                    setWarnUnratedEntry(val)
                    localStorage.setItem('the-commonplace.warn-unrated', String(val))
                  }}
                />
              </SettingsSection>

              <SettingsSection title="Reading Experience">
                <SettingsToggle
                  label="Drop Cap Initial Letter"
                  description="Display large serif drop cap letters at the start of reflections by default."
                  checked={dropCapEnabled}
                  onChange={setDropCapEnabled}
                />
                <SettingsToggle
                  label="GPU Accelerated Column Layout"
                  description="Use hardware-accelerated transforms for dynamic masonry card repositioning."
                  checked={gpuAccelerated}
                  onChange={setGpuAccelerated}
                />
                <SettingsToggle
                  label="Smooth Accordion Expansion"
                  description="Fluid Framer Motion spring physics when expanding reflections inline."
                  checked={smoothAccordion}
                  onChange={setSmoothAccordion}
                />
              </SettingsSection>
            </div>
          )}

          {/* PAGE 3: APPEARANCE */}
          {activeTab === 'appearance' && (
            <div className="settings-page-content">
              <div className="settings-header-minimal">
                <h1 className="settings-page-title">Appearance</h1>
                <p className="settings-page-desc">Customize typography and visual palette.</p>
              </div>

              <SettingsSection title="Theme Palette">
                <div className="theme-badge-card">
                  <div className="theme-badge-info">
                    <span className="theme-title">Warm Obsidian Antique Gold</span>
                    <span className="theme-sub">#0f0d0a base with #c8a26a accents and serif typography</span>
                  </div>
                  <span className="theme-active-tag">Active Theme</span>
                </div>
              </SettingsSection>
            </div>
          )}

          {/* PAGE 4: NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="settings-page-content">
              <div className="settings-header-minimal">
                <h1 className="settings-page-title">Notifications</h1>
                <p className="settings-page-desc">Manage digest and updates.</p>
              </div>

              <SettingsSection title="Email Updates">
                <SettingsToggle
                  label="Weekly Commonplace Digest"
                  description="Receive a weekly curated summary of catalog entries and passages."
                  checked={weeklyDigest}
                  onChange={setWeeklyDigest}
                />
              </SettingsSection>
            </div>
          )}

          {/* PAGE 5: LINKED ACCOUNTS */}
          {activeTab === 'linked' && (
            <div className="settings-page-content">
              <div className="settings-header-minimal">
                <h1 className="settings-page-title">Linked Accounts</h1>
                <p className="settings-page-desc">Connect trusted services to simplify sign in and enrich your profile.</p>
              </div>

              <div className="linked-accounts-editorial-list">
                {PROVIDERS.map((provider) => {
                  const status = accountStatuses[provider.id] || 'disconnected'
                  return (
                    <LinkedAccountCard
                      key={provider.id}
                      provider={provider}
                      status={status}
                      onToggle={() => handleToggleProvider(provider.id)}
                    />
                  )
                })}
              </div>
            </div>
          )}

          {/* PAGE 6: PRIVACY */}
          {activeTab === 'privacy' && (
            <div className="settings-page-content">
              <div className="settings-header-minimal">
                <h1 className="settings-page-title">Privacy</h1>
                <p className="settings-page-desc">Control who can see your profile and how it appears online.</p>
              </div>

              <SettingsSection
                title="Profile Visibility"
                description="Choose whether your commonplace is open to others or kept entirely private."
              >
                <SettingsToggle
                  label="Private Profile"
                  description="When enabled, your profile and catalog will be hidden from all other users and public search results."
                  checked={privateProfile}
                  onChange={setPrivateProfile}
                />

                {/* Status badge + context box */}
                <div style={{ marginTop: 14 }}>
                  <span className={`privacy-badge ${privateProfile ? 'private' : ''}`}>
                    {privateProfile ? '🔒 Private' : '🌐 Public'}
                  </span>

                  <div className={`privacy-info-box ${privateProfile ? 'private' : ''}`} style={{ marginTop: 10 }}>
                    <p className="privacy-info-text">
                      {privateProfile ? (
                        <>
                          <strong>Your library is private.</strong> Only you can view your profile,
                          catalog, and collected passages. No one else can find or follow your commonplace.
                        </>
                      ) : (
                        <>
                          <strong>Your library is public.</strong> Anyone can view your profile and
                          catalog. Your collected passages are visible to other readers on The Commonplace.
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </SettingsSection>

              <SettingsSection title="Search Engine Indexing">
                <SettingsToggle
                  label="Allow Search Engine Indexing"
                  description="Allow search engines to index your public commonplace profile. Has no effect when profile is set to Private."
                  checked={publicIndexing && !privateProfile}
                  onChange={(val) => {
                    if (privateProfile) return
                    setPublicIndexing(val)
                  }}
                />
                {privateProfile && (
                  <p className="privacy-info-text" style={{ marginTop: 10, opacity: 0.55 }}>
                    Indexing is automatically disabled while your profile is private.
                  </p>
                )}
              </SettingsSection>
            </div>
          )}

          {/* PAGE 7: SECURITY */}
          {activeTab === 'security' && (
            <div className="settings-page-content">
              <div className="settings-header-minimal">
                <h1 className="settings-page-title">Security & Password</h1>
                <p className="settings-page-desc">Manage two-factor authentication, passwords, and active sessions.</p>
              </div>

              {passwordNotice && (
                <div className="settings-saved-banner">
                  <CheckCircle2 aria-hidden="true" />
                  <span>{passwordNotice}</span>
                </div>
              )}

              {/* Two-Factor Authentication (2FA) */}
              <SettingsSection
                title="Two-Factor Authentication (2FA)"
                description="Add an extra layer of security using an authenticator app (TOTP)."
              >
                <div className="security-2fa-card">
                  <SettingsToggle
                    label="Enable Two-Factor Authentication"
                    description="Require a 6-digit verification code from your authenticator app when signing in."
                    checked={twoFactorEnabled}
                    onChange={setTwoFactorEnabled}
                  />

                  {twoFactorEnabled && (
                    <div className="two-factor-active-box">
                      <div className="two-factor-badge-active">
                        <CheckCircle2 aria-hidden="true" />
                        <span>2FA Protection Active</span>
                      </div>
                      <p className="two-factor-hint">
                        Your account is secured with time-based multi-factor authentication. Keep your backup security keys stored in a safe place.
                      </p>
                    </div>
                  )}
                </div>
              </SettingsSection>

              {/* Change Password */}
              <SettingsSection
                title="Change Password"
                description="Update your account password regularly to keep your library secure."
              >
                <form onSubmit={handlePasswordUpdate} className="settings-form-grid">
                  <SettingsField label="Current Password" htmlFor="current-password">
                    <input
                      id="current-password"
                      type="password"
                      className="dark-setting-input"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                    />
                  </SettingsField>

                  <div className="form-row-two-col">
                    <SettingsField label="New Password" htmlFor="new-password">
                      <input
                        id="new-password"
                        type="password"
                        className="dark-setting-input"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••••••"
                        required
                      />
                    </SettingsField>

                    <SettingsField label="Confirm New Password" htmlFor="confirm-password">
                      <input
                        id="confirm-password"
                        type="password"
                        className="dark-setting-input"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••••••"
                        required
                      />
                    </SettingsField>
                  </div>

                  <div>
                    <button type="submit" className="secondary-action-btn">
                      <Lock aria-hidden="true" />
                      <span>Update Password</span>
                    </button>
                  </div>
                </form>
              </SettingsSection>

              <SettingsSection title="Active Sessions">
                <p className="settings-section-desc">You are currently signed in from this browser session.</p>
              </SettingsSection>
            </div>
          )}

          {/* PAGE 8: DATA & STORAGE */}
          {activeTab === 'storage' && (
            <div className="settings-page-content">
              <div className="settings-header-minimal">
                <h1 className="settings-page-title">Data & Storage</h1>
                <p className="settings-page-desc">Manage local storage and database resets.</p>
              </div>

              <SettingsSection title="Catalog Reset" isDanger>
                <div className="settings-action-row">
                  <div className="action-info">
                    <span className="action-title">Reset Local Storage Catalog</span>
                    <span className="action-sub">Permanently delete all saved entries and reset local storage.</span>
                  </div>
                  <button
                    type="button"
                    className="action-btn danger"
                    onClick={() => {
                      if (window.confirm('Are you sure you want to clear all cataloged entries?')) {
                        onClearAllData()
                        onBack()
                      }
                    }}
                  >
                    <Trash2 aria-hidden="true" />
                    Clear All Data
                  </button>
                </div>
              </SettingsSection>
            </div>
          )}

          {/* PAGE 9: EXPORT DATA */}
          {activeTab === 'export' && (
            <div className="settings-page-content">
              <div className="settings-header-minimal">
                <h1 className="settings-page-title">Export Data</h1>
                <p className="settings-page-desc">Download a backup copy of your catalog entries.</p>
              </div>

              <SettingsSection title="Download Catalog Archive">
                <button
                  type="button"
                  className="secondary-action-btn"
                  onClick={() => alert('Catalog export JSON downloaded successfully.')}
                >
                  <Download aria-hidden="true" />
                  <span>Download JSON Archive</span>
                </button>
              </SettingsSection>
            </div>
          )}

          {/* PAGE 10: DELETE ACCOUNT */}
          {activeTab === 'delete' && (
            <div className="settings-page-content">
              <div className="settings-header-minimal">
                <h1 className="settings-page-title danger">Delete Account</h1>
                <p className="settings-page-desc">Permanently remove your profile and clear all data.</p>
              </div>

              <SettingsSection title="Irreversible Action" isDanger>
                <p className="settings-section-desc" style={{ marginBottom: 16 }}>
                  Deleting your account will permanently remove your profile, username, and all saved reviews.
                </p>
                <button
                  type="button"
                  className="action-btn danger"
                  onClick={() => {
                    if (window.confirm('Permanently delete account and reset all data?')) {
                      onClearAllData()
                      onBack()
                    }
                  }}
                >
                  <Trash2 aria-hidden="true" />
                  Delete Account
                </button>
              </SettingsSection>
            </div>
          )}
        </main>
      </div>

      {/* Floating Sticky Save Bar at Bottom-Right (Only visible when form changes exist!) */}
      {hasChanges && (
        <div className="settings-sticky-save-bar">
          <div className="save-bar-info">
            <span>Unsaved changes on profile</span>
          </div>
          <div className="save-bar-actions">
            <button type="button" className="save-bar-cancel-btn" onClick={handleResetForm}>
              Cancel
            </button>
            <button type="button" className="save-bar-save-btn" onClick={() => handleSave()}>
              Save Changes
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
