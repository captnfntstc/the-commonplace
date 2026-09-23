import React, { useState, useEffect, useRef } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Lock,
  Trash2,
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
import { useAccessibleDialog } from '../hooks/useAccessibleDialog'
import { SettingsField } from '../components/Settings/SettingsField'
import { SettingsToggle } from '../components/Settings/SettingsToggle'
import type { UserProfileState } from '../types/userProfile'
import { useAuth } from '../context/AuthContext'


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

interface SettingsPageProps {
  onBack: () => void
  showLocalNavigation?: boolean
  userProfile: UserProfileState
  onSaveProfile: (updated: UserProfileState) => void | Promise<void>
  onResetHomeRecommendations?: () => void | Promise<void>
}

const TAKEN_USERNAMES = new Set(['admin', 'commonplace', 'system', 'root', 'collector', 'superuser', 'official'])
const USERNAME_COOLDOWN_DAYS = 14

export const SettingsPage: React.FC<SettingsPageProps> = ({
  onBack,
  showLocalNavigation = true,
  userProfile,
  onSaveProfile,
  onResetHomeRecommendations,
}) => {
  const {
    currentUser,
    changeEmail,
    changePassword,
    setAppleAccountLinked,
    setGoogleAccountLinked,
    deactivateAccount,
    deleteAccount,
    resendVerificationEmail,
    verificationEmailCooldownSeconds,
    verificationEmailSent,
  } = useAuth()
  const [activeTab, setActiveTab] = useState<SettingsNavTab>('profile')
  const [verificationLoading, setVerificationLoading] = useState<'send' | null>(null)
  const [verificationNotice, setVerificationNotice] = useState('')
  const [emailEditorOpen, setEmailEditorOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailChangeLoading, setEmailChangeLoading] = useState(false)
  const [emailChangeNotice, setEmailChangeNotice] = useState('')
  const [emailChangeError, setEmailChangeError] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [deactivationDialogOpen, setDeactivationDialogOpen] = useState(false)
  const [deactivationReason, setDeactivationReason] = useState('')
  const [returnPlan, setReturnPlan] = useState('seven_days')
  const [safetyConcern, setSafetyConcern] = useState(false)
  const [deactivationFeedback, setDeactivationFeedback] = useState('')
  const [deactivationLoading, setDeactivationLoading] = useState(false)
  const [deactivationError, setDeactivationError] = useState('')
  const [recommendationResetting, setRecommendationResetting] = useState(false)
  const [recommendationNotice, setRecommendationNotice] = useState('')
  const deactivationSectionRef = useRef<HTMLDivElement>(null)
  const deactivationDialogRef = useAccessibleDialog<HTMLFormElement>({
    open: deactivationDialogOpen,
    onClose: () => setDeactivationDialogOpen(false),
    closeOnEscape: !deactivationLoading,
  })
  const deleteDialogRef = useAccessibleDialog<HTMLDivElement>({
    open: deleteDialogOpen,
    onClose: () => setDeleteDialogOpen(false),
    closeOnEscape: !deleteLoading,
  })
  const verificationCooldownLabel = `${Math.floor(verificationEmailCooldownSeconds / 60)}:${String(verificationEmailCooldownSeconds % 60).padStart(2, '0')}`
  const currentEmail = currentUser?.email || userProfile.email

  // Form State
  const [firstName, setFirstName] = useState(userProfile.firstName)
  const [lastName, setLastName] = useState(userProfile.lastName)
  const [showFullName, setShowFullName] = useState(userProfile.showFullName)
  const [handleInput, setHandleInput] = useState(userProfile.handle.replace(/^@/, ''))
  const [bio, setBio] = useState(userProfile.bio)
  const [showFollowLists, setShowFollowLists] = useState(userProfile.showFollowLists ?? true)
  const [allowComments, setAllowComments] = useState(userProfile.allowComments ?? true)
  const [privateProfile, setPrivateProfile] = useState(userProfile.isPrivate ?? false)
  const [showSavedActivity, setShowSavedActivity] = useState(userProfile.showSavedActivity ?? false)
  const [savedNotice, setSavedNotice] = useState(false)
  const [saveError, setSaveError] = useState('')

  const handleSendVerification = async () => {
    try {
      setVerificationLoading('send')
      setVerificationNotice('')
      await resendVerificationEmail()
      setVerificationNotice(`Verification email sent to ${currentEmail}.`)
    } catch (error: unknown) {
      setVerificationNotice(
        (error as Error)?.message?.replace(/^Firebase:\s*/, '') || 'Unable to send verification email.',
      )
    } finally {
      setVerificationLoading(null)
    }
  }

  const handleChangeEmail = async (event: React.FormEvent) => {
    event.preventDefault()
    const normalized = newEmail.trim().toLowerCase()
    setEmailChangeError('')
    setEmailChangeNotice('')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setEmailChangeError('Enter a valid email address.')
      return
    }
    if (normalized === currentEmail.toLowerCase()) {
      setEmailChangeError('Enter a different email address.')
      return
    }

    try {
      setEmailChangeLoading(true)
      await changeEmail(normalized)
      setEmailChangeNotice(`A verification link has been sent to ${normalized}. Your email will update once verified.`)
      setNewEmail('')
      setEmailEditorOpen(false)
    } catch (error) {
      setEmailChangeError(
        (error as Error)?.message?.replace(/^Firebase:\s*/, '') || 'Unable to start the email change.',
      )
    } finally {
      setEmailChangeLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') return
    try {
      setDeleteLoading(true)
      setDeleteError('')
      await deleteAccount()
    } catch (error) {
      setDeleteError((error as Error)?.message || 'Unable to delete your account.')
    } finally {
      setDeleteLoading(false)
    }
  }

  const openDeactivationFlow = () => {
    setDeleteDialogOpen(false)
    setDeactivationError('')
    setDeactivationDialogOpen(true)
    window.setTimeout(() => deactivationSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
  }

  const handleDeactivateAccount = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!deactivationReason) {
      setDeactivationError('Choose why you are deactivating your account.')
      return
    }
    try {
      setDeactivationLoading(true)
      setDeactivationError('')
      await deactivateAccount({
        reason: deactivationReason,
        returnPlan,
        safetyConcern,
        feedback: deactivationFeedback.trim(),
      })
    } catch (error) {
      setDeactivationError((error as Error)?.message || 'Unable to deactivate your account.')
    } finally {
      setDeactivationLoading(false)
    }
  }

  const handleResetHomeRecommendations = async () => {
    if (!onResetHomeRecommendations) return
    try {
      setRecommendationResetting(true)
      setRecommendationNotice('')
      await onResetHomeRecommendations()
      setRecommendationNotice('Home recommendations have been reset.')
    } catch (error) {
      setRecommendationNotice((error as Error)?.message || 'Unable to reset Home recommendations.')
    } finally {
      setRecommendationResetting(false)
    }
  }

  // Sync form state if props update
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- The editable draft mirrors externally hydrated account data.
    setFirstName(userProfile.firstName)
    setLastName(userProfile.lastName)
    setShowFullName(userProfile.showFullName)
    setHandleInput(userProfile.handle.replace(/^@/, ''))
    setBio(userProfile.bio)
    setShowFollowLists(userProfile.showFollowLists ?? true)
    setAllowComments(userProfile.allowComments ?? true)
    setPrivateProfile(userProfile.isPrivate ?? false)
    setShowSavedActivity(userProfile.showSavedActivity ?? false)
  }, [userProfile])

  const [accountStatuses, setAccountStatuses] = useState<Record<string, ConnectionStatus>>({
    google: (currentUser?.providerData || []).some(({ providerId }) => providerId === 'google.com') ? 'connected' : 'disconnected',
    apple: (currentUser?.providerData || []).some(({ providerId }) => providerId === 'apple.com') ? 'connected' : 'disconnected',
  })
  const [linkedAccountNotice, setLinkedAccountNotice] = useState('')
  const [linkedAccountError, setLinkedAccountError] = useState('')

  const handleToggleProvider = async (id: string) => {
    const current = accountStatuses[id] || 'disconnected'
    if (current === 'connecting') return
    setLinkedAccountNotice('')
    setLinkedAccountError('')
    setAccountStatuses((prev) => ({ ...prev, [id]: 'connecting' }))
    try {
      const shouldConnect = current !== 'connected'
      const provider = PROVIDERS.find((item) => item.id === id)
      if (id === 'apple') await setAppleAccountLinked(shouldConnect)
      else if (id === 'google') await setGoogleAccountLinked(shouldConnect)
      else return
      setAccountStatuses((prev) => ({ ...prev, [id]: shouldConnect ? 'connected' : 'disconnected' }))
      setLinkedAccountNotice(`${provider?.name || 'Account'} ${shouldConnect ? 'connected' : 'disconnected'} successfully.`)
    } catch (error) {
      setAccountStatuses((prev) => ({ ...prev, [id]: current }))
      setLinkedAccountError((error as Error)?.message?.replace(/^Firebase:\s*/, '') || 'Unable to update this linked account.')
    }
  }

  // Security state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordNotice, setPasswordNotice] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordNotice('')
    if (!currentPassword) {
      setPasswordError('Please enter your current password.')
      return
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.')
      return
    }
    try {
      setPasswordLoading(true)
      await changePassword(currentPassword, newPassword)
      setPasswordNotice('Password updated successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordNotice(''), 3000)
    } catch (error) {
      const message = (error as Error)?.message?.replace(/^Firebase:\s*/, '') || 'Unable to update your password.'
      setPasswordError(/credential|password is invalid/i.test(message) ? 'Your current password is incorrect.' : message)
    } finally {
      setPasswordLoading(false)
    }
  }

  // Check if dirty changes exist
  const sanitizedHandle = handleInput.trim().toLowerCase().replace(/^@/, '')
  const hasChanges =
    firstName.trim() !== userProfile.firstName ||
    lastName.trim() !== userProfile.lastName ||
    showFullName !== userProfile.showFullName ||
    sanitizedHandle !== userProfile.handle.toLowerCase().replace(/^@/, '') ||
    bio.trim() !== userProfile.bio ||
    showFollowLists !== (userProfile.showFollowLists ?? true) ||
    allowComments !== (userProfile.allowComments ?? true) ||
    privateProfile !== (userProfile.isPrivate ?? false) ||
    showSavedActivity !== (userProfile.showSavedActivity ?? false)

  // 14-Day Cooldown Calculation
  const lastChangeMs = userProfile.lastUsernameChangeDate
    ? new Date(userProfile.lastUsernameChangeDate).getTime()
    : 0
  const [nowMs] = useState(() => Date.now())
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
    setBio(userProfile.bio)
    setShowFollowLists(userProfile.showFollowLists ?? true)
    setAllowComments(userProfile.allowComments ?? true)
    setPrivateProfile(userProfile.isPrivate ?? false)
    setShowSavedActivity(userProfile.showSavedActivity ?? false)
  }

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setSaveError('')

    if (!isCurrentUsername && isTaken) {
      setSaveError('This username is taken. Please choose another unique username.')
      return
    }

    if (!isCurrentUsername && isUsernameCooldownActive) {
      setSaveError(`Username cannot be changed yet. Next change available on ${nextAvailableDate}.`)
      return
    }

    const usernameChanged = !isCurrentUsername && !isUsernameCooldownActive

    const updated: UserProfileState = {
      firstName: firstName.trim() || userProfile.firstName || 'Reader',
      lastName: lastName.trim(),
      showFullName,
      handle: sanitizedHandle || userProfile.handle,
      email: currentEmail || userProfile.email,
      bio: bio.trim(),
      avatarUrl: userProfile.avatarUrl,
      coverUrl: userProfile.coverUrl,
      createdAt: userProfile.createdAt,
      birthday: userProfile.birthday,
      lastUsernameChangeDate: usernameChanged ? new Date().toISOString() : userProfile.lastUsernameChangeDate,
      showFollowLists,
      allowComments,
      isPrivate: privateProfile,
      showSavedActivity,
    }

    try {
      await onSaveProfile(updated)
      setSavedNotice(true)
      setTimeout(() => setSavedNotice(false), 3000)
    } catch (error) {
      console.error('Unable to save profile settings.', error)
      setSaveError(error instanceof Error ? error.message : 'Settings could not be saved. Please try again.')
    }
  }

  const computedDisplayName = showFullName ? `${firstName} ${lastName}`.trim() : firstName

  return (
    <div className="page-wrapper settings-desktop-wrapper">
      {/* Top Floating Circle Back Button */}
      {showLocalNavigation && <button
        type="button"
        className="profile-back-circle"
        onClick={onBack}
        title="Back to Feed"
        aria-label="Back to Feed"
      >
        <ArrowLeft aria-hidden="true" />
      </button>}

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
          {saveError && (
            <div className="settings-save-error" role="alert">
              <AlertCircle aria-hidden="true" />
              <span>{saveError}</span>
            </div>
          )}

          {/* PAGE 1: PROFILE */}
          {activeTab === 'profile' && (
            <div className="settings-page-content">
              <div className="settings-header-minimal">
                <h1 className="settings-page-title">Profile Information</h1>
                <p className="settings-page-desc">
                  Manage your public profile identity and social list preferences.
                </p>
              </div>

              <SettingsSection
                title="Identity Details"
                description="Personal information shown on your public commonplace."
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

                  <div className="email-verification-setting" aria-label="Email Verification">
                    <div className="email-verification-setting-copy">
                      <span className="toggle-label">Email Verification</span>
                      <span className="toggle-description">
                        {currentUser?.emailVerified
                          ? 'Your account email has been confirmed.'
                          : 'Confirm your account email to unlock posting.'}
                      </span>
                      {verificationNotice && <span className="email-verification-setting-notice">{verificationNotice}</span>}
                    </div>
                    {currentUser?.emailVerified ? (
                      <span className="email-verification-status verified">
                        <CheckCircle2 aria-hidden="true" />
                        Verified
                      </span>
                    ) : (
                      <div className="email-verification-setting-actions">
                        <button
                          type="button"
                          className="secondary-action-btn"
                          onClick={handleSendVerification}
                          disabled={verificationLoading !== null || verificationEmailCooldownSeconds > 0}
                        >
                          {verificationLoading === 'send'
                            ? 'Sending...'
                            : verificationEmailCooldownSeconds > 0
                              ? `Resend in ${verificationCooldownLabel}`
                              : verificationEmailSent
                                ? 'Resend email'
                                : 'Verify now'}
                        </button>
                      </div>
                    )}
                  </div>

                </div>
              </SettingsSection>

              <SettingsSection title="Biography" description="Share a short introduction about your taste.">
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
                    placeholder="Collector of timeless passages, album impressions, cinematic notes..."
                  />
                </SettingsField>
              </SettingsSection>

              <SettingsSection title="Social List Preferences" description="Control visibility of your followers and following lists.">
                <SettingsToggle
                  label="Show Followers & Following Lists"
                  description="Allow visitors to click your follower and following counts on your profile to view your connections."
                  checked={showFollowLists}
                  onChange={setShowFollowLists}
                />
              </SettingsSection>
            </div>
          )}

          {/* PAGE 2: SOCIAL & INTERACTIONS */}
          {activeTab === 'social' && (
            <div className="settings-page-content">
              <div className="settings-header-minimal">
                <h1 className="settings-page-title">Social & Interactions</h1>
                <p className="settings-page-desc">Manage comments and replies on your entries.</p>
              </div>

              <SettingsSection title="Comment Settings">
                <SettingsToggle
                  label="Allow Comments on Entries"
                  description="Allow other readers to post comments and replies on your catalog entries."
                  checked={allowComments}
                  onChange={setAllowComments}
                />
              </SettingsSection>

            </div>
          )}

          {/* PAGE 4: PRIVACY */}
          {activeTab === 'privacy' && (
            <div className="settings-page-content">
              <div className="settings-header-minimal">
                <h1 className="settings-page-title">Privacy & Visibility</h1>
                <p className="settings-page-desc">Control who can see your profile and how it appears online.</p>
              </div>

              <SettingsSection
                title="Profile Visibility"
                description="Choose whether your commonplace is open to others or kept entirely private."
              >
                <SettingsToggle
                  label="Private Profile"
                  description="When enabled, your profile and catalog will be hidden from all other users."
                  checked={privateProfile}
                  onChange={setPrivateProfile}
                />

                <SettingsToggle
                  label="Display Full Name"
                  description="Show your full name publicly alongside your username handle."
                  checked={showFullName}
                  onChange={setShowFullName}
                />
              </SettingsSection>

              <SettingsSection
                title="Saved Activity"
                description="Choose whether visitors can browse the things you have saved."
              >
                <SettingsToggle
                  label="Show Saved Catalog & Collections"
                  description="Display a Saved tab on your public profile. This is hidden by default and does not affect what you can see yourself."
                  checked={showSavedActivity}
                  onChange={setShowSavedActivity}
                />
              </SettingsSection>

              <SettingsSection
                title="Home Recommendations"
                description="Clear the interests learned from your catalog, saves, likes, and opened media."
              >
                <div className="settings-danger-zone-row">
                  <div>
                    <strong>Reset Home recommendations</strong>
                    <span>Your public and mutual-follow feed will return to a fresh, diverse ordering.</span>
                  </div>
                  <button
                    type="button"
                    className="secondary-action-btn"
                    onClick={handleResetHomeRecommendations}
                    disabled={recommendationResetting || !onResetHomeRecommendations}
                  >
                    {recommendationResetting ? 'Resetting…' : 'Reset recommendations'}
                  </button>
                </div>
                {recommendationNotice && <p className="settings-page-desc" role="status">{recommendationNotice}</p>}
              </SettingsSection>

            </div>
          )}

          {/* PAGE 5: SECURITY */}
          {activeTab === 'security' && (
            <div className="settings-page-content">
              <div className="settings-header-minimal">
                <h1 className="settings-page-title">Account & Security</h1>
                <p className="settings-page-desc">Manage two-factor authentication, passwords, and linked accounts.</p>
              </div>

              {passwordNotice && (
                <div className="settings-saved-banner">
                  <CheckCircle2 aria-hidden="true" />
                  <span>{passwordNotice}</span>
                </div>
              )}

              <SettingsSection
                title="Email Address"
                description="Manage the email used to sign in and receive account messages."
              >
                <div className="settings-email-address-panel">
                  <SettingsField label="Current email" htmlFor="security-current-email">
                    <input
                      id="security-current-email"
                      type="email"
                      className="dark-setting-input"
                      value={currentEmail}
                      readOnly
                    />
                  </SettingsField>

                  {!emailEditorOpen && (
                    <button
                      type="button"
                      className="secondary-action-btn"
                      onClick={() => {
                        setEmailEditorOpen(true)
                        setEmailChangeError('')
                        setEmailChangeNotice('')
                      }}
                    >
                      Change Email
                    </button>
                  )}

                  {emailEditorOpen && (
                    <form className="settings-email-change-form" onSubmit={handleChangeEmail} noValidate>
                      <SettingsField label="New email address" htmlFor="security-new-email">
                        <input
                          id="security-new-email"
                          type="email"
                          autoComplete="email"
                          className={`dark-setting-input ${emailChangeError ? 'error' : ''}`}
                          value={newEmail}
                          onChange={(event) => {
                            setNewEmail(event.target.value)
                            setEmailChangeError('')
                          }}
                          placeholder="you@example.com"
                          autoFocus
                        />
                      </SettingsField>
                      {emailChangeError && <span className="settings-email-change-error" role="alert">{emailChangeError}</span>}
                      <div className="settings-email-change-actions">
                        <button
                          type="button"
                          className="save-bar-cancel-btn"
                          onClick={() => {
                            setEmailEditorOpen(false)
                            setNewEmail('')
                            setEmailChangeError('')
                          }}
                          disabled={emailChangeLoading}
                        >
                          Cancel
                        </button>
                        <button type="submit" className="secondary-action-btn" disabled={emailChangeLoading}>
                          {emailChangeLoading ? 'Sending...' : 'Send verification link'}
                        </button>
                      </div>
                    </form>
                  )}

                  {emailChangeNotice && (
                    <div className="settings-email-change-notice" role="status">
                      <CheckCircle2 aria-hidden="true" />
                      <span>{emailChangeNotice}</span>
                    </div>
                  )}

                  <div className="email-verification-setting" aria-label="Email Verification">
                    <div className="email-verification-setting-copy">
                      <span className="toggle-label">Email Verification</span>
                      <span className="toggle-description">
                        {currentUser?.emailVerified
                          ? 'Your account email has been confirmed.'
                          : 'Confirm your account email to unlock posting.'}
                      </span>
                      {verificationNotice && <span className="email-verification-setting-notice">{verificationNotice}</span>}
                    </div>
                    {currentUser?.emailVerified ? (
                      <span className="email-verification-status verified">
                        <CheckCircle2 aria-hidden="true" />
                        Verified
                      </span>
                    ) : (
                      <div className="email-verification-setting-actions">
                        <button
                          type="button"
                          className="secondary-action-btn"
                          onClick={handleSendVerification}
                          disabled={verificationLoading !== null || verificationEmailCooldownSeconds > 0}
                        >
                          {verificationLoading === 'send'
                            ? 'Sending...'
                            : verificationEmailCooldownSeconds > 0
                              ? `Resend in ${verificationCooldownLabel}`
                              : verificationEmailSent
                                ? 'Resend email'
                                : 'Verify now'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </SettingsSection>

              <SettingsSection
                title="Change Password"
                description="Update your account password regularly."
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
                    <button type="submit" className="secondary-action-btn" disabled={passwordLoading}>
                      <Lock aria-hidden="true" />
                      <span>{passwordLoading ? 'Updating…' : 'Update Password'}</span>
                    </button>
                  </div>
                  {passwordError && <p className="settings-delete-account-error" role="alert">{passwordError}</p>}
                </form>
              </SettingsSection>

              <SettingsSection title="Linked Accounts">
                <div className="linked-accounts-editorial-list">
                  {PROVIDERS.filter(({ id }) => id === 'google' || id === 'apple').map((provider) => {
                    const status = accountStatuses[provider.id] || 'disconnected'
                    return (
                      <LinkedAccountCard
                        key={provider.id}
                        provider={provider}
                        status={status}
                        onToggle={() => { void handleToggleProvider(provider.id) }}
                      />
                    )
                  })}
                </div>
                {linkedAccountNotice && <p className="settings-page-desc" role="status">{linkedAccountNotice}</p>}
                {linkedAccountError && <p className="settings-delete-account-error" role="alert">{linkedAccountError}</p>}
              </SettingsSection>

              <div className="settings-danger-zone" ref={deactivationSectionRef}>
                <SettingsSection
                  title="Danger Zone"
                  description="Step away temporarily or permanently remove your account."
                >
                  <div className="settings-danger-zone-row settings-deactivation-row">
                    <div>
                      <strong>Deactivate account</strong>
                      <span>Hide your profile and activity until your chosen return date—or until you decide to return.</span>
                    </div>
                    <button
                      type="button"
                      className="settings-deactivation-button"
                      onClick={openDeactivationFlow}
                    >
                      <Clock aria-hidden="true" />
                      Deactivate account
                    </button>
                  </div>
                  <div className="settings-danger-zone-row">
                    <div>
                      <strong>Delete account</strong>
                      <span>This removes your profile, catalogs, collections, comments, likes, follows, and sign-in account.</span>
                    </div>
                    <button
                      type="button"
                      className="settings-danger-button"
                      onClick={() => {
                        setDeleteDialogOpen(true)
                        setDeleteConfirmation('')
                        setDeleteError('')
                      }}
                    >
                      <Trash2 aria-hidden="true" />
                      Delete account
                    </button>
                  </div>
                </SettingsSection>
              </div>
            </div>
          )}

        </main>
      </div>

      {deactivationDialogOpen && (
        <div className="modal-backdrop" onClick={() => !deactivationLoading && setDeactivationDialogOpen(false)}>
          <form
            ref={deactivationDialogRef}
            className="settings-modal settings-deactivation-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="deactivation-title"
            tabIndex={-1}
            onSubmit={handleDeactivateAccount}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="settings-deactivation-icon"><Clock aria-hidden="true" /></div>
            <h2 id="deactivation-title">Take a quiet break</h2>
            <p>
              Your profile will disappear from search and your existing activity will use a neutral placeholder while your account is deactivated.
            </p>

            <label htmlFor="deactivation-reason">Why are you deactivating?</label>
            <select
              id="deactivation-reason"
              className="dark-setting-input"
              value={deactivationReason}
              onChange={(event) => {
                setDeactivationReason(event.target.value)
                setDeactivationError('')
              }}
              required
            >
              <option value="">Select a reason</option>
              <option value="taking_a_break">I just need a break</option>
              <option value="privacy_or_safety">I have a privacy or safety concern</option>
              <option value="too_distracting">The app feels too distracting</option>
              <option value="technical_issues">I am having technical issues</option>
              <option value="not_finding_value">I am not finding enough value</option>
              <option value="other">Another reason</option>
            </select>

            <label htmlFor="deactivation-return">When would you like to return?</label>
            <select
              id="deactivation-return"
              className="dark-setting-input"
              value={returnPlan}
              onChange={(event) => setReturnPlan(event.target.value)}
            >
              <option value="tomorrow">Tomorrow</option>
              <option value="seven_days">In 7 days</option>
              <option value="thirty_days">In 30 days</option>
              <option value="in_my_own_time">In my own time</option>
            </select>
            <span className="settings-deactivation-hint">
              {returnPlan === 'in_my_own_time'
                ? 'Automatic reactivation is off. Your account returns only when you sign in again.'
                : 'Your profile will automatically become visible again on the selected date. Signing in sooner also reactivates it.'}
            </span>

            <div className="settings-deactivation-survey">
              <label className="settings-safety-check">
                <input
                  type="checkbox"
                  checked={safetyConcern}
                  onChange={(event) => setSafetyConcern(event.target.checked)}
                />
                <span>Something on The Commonplace made me feel unsafe or unwelcome.</span>
              </label>
              <label htmlFor="deactivation-feedback">Anything you would like us to understand? <span>(optional)</span></label>
              <textarea
                id="deactivation-feedback"
                className="dark-setting-textarea"
                rows={4}
                maxLength={1000}
                value={deactivationFeedback}
                onChange={(event) => setDeactivationFeedback(event.target.value)}
                placeholder="Share feedback, a safety concern, or what could make the space feel better. Please avoid including sensitive personal information."
              />
              <span className="settings-deactivation-character-count">{deactivationFeedback.length}/1000</span>
            </div>

            {deactivationError && <p className="settings-delete-account-error" role="alert">{deactivationError}</p>}
            <div className="settings-delete-account-actions">
              <button
                type="button"
                className="save-bar-cancel-btn"
                onClick={() => setDeactivationDialogOpen(false)}
                disabled={deactivationLoading}
              >
                Keep my account active
              </button>
              <button
                type="submit"
                className="settings-deactivation-button"
                disabled={!deactivationReason || deactivationLoading}
              >
                {deactivationLoading ? 'Deactivating...' : 'Deactivate my account'}
              </button>
            </div>
          </form>
        </div>
      )}


      {deleteDialogOpen && (
        <div className="modal-backdrop" onClick={() => !deleteLoading && setDeleteDialogOpen(false)}>
          <div
            ref={deleteDialogRef}
            className="settings-modal settings-delete-account-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="settings-delete-account-icon"><Trash2 aria-hidden="true" /></div>
            <h2 id="delete-account-title">Delete your account?</h2>
            <p>
              This is permanent and cannot be undone. Type <strong>DELETE</strong> to confirm.
            </p>
            <p className="settings-delete-alternative">
              Sorry to see you go. Would you consider{' '}
              <button type="button" onClick={openDeactivationFlow}>deactivating your account instead</button>?
            </p>
            <label htmlFor="delete-account-confirmation">Confirmation</label>
            <input
              id="delete-account-confirmation"
              className="dark-setting-input"
              value={deleteConfirmation}
              onChange={(event) => {
                setDeleteConfirmation(event.target.value)
                setDeleteError('')
              }}
              autoComplete="off"
              placeholder="Type DELETE"
              autoFocus
            />
            {deleteError && <p className="settings-delete-account-error" role="alert">{deleteError}</p>}
            <div className="settings-delete-account-actions">
              <button
                type="button"
                className="save-bar-cancel-btn"
                onClick={() => setDeleteDialogOpen(false)}
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="settings-danger-button"
                onClick={handleDeleteAccount}
                disabled={deleteConfirmation !== 'DELETE' || deleteLoading}
              >
                {deleteLoading ? 'Deleting account...' : 'Permanently delete account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Sticky Save Bar at Bottom-Right */}
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
