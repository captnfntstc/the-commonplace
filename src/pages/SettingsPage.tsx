import React, { useState, useEffect, useRef } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Lock,
  Trash2,
  User,
  MessageSquare,
  Shield,
  HardDrive,
  Globe,
  Sparkles,
  Bookmark,
  Users,
  Bell,
  Mail,
  Link2,
  Download,
  FileText,
  AlertTriangle,
  Check,
  Cookie,
  Scale,
  Scroll,
} from 'lucide-react'
import {
  APPEARANCE_THEMES,
  useAppearanceSettings,
} from '../features/appearance/appearanceSettings'
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
import { LegalModal, type LegalModalType } from '../components/auth/LegalModal'
import { clearReadingHistory, clearVisitedProfiles } from '../services/activityHistory'
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
  const { settings: appearanceSettings, updateSettings: updateAppearanceSettings } = useAppearanceSettings()
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
  const [exportNotice, setExportNotice] = useState('')
  const [cacheNotice, setCacheNotice] = useState('')
  const [usernameEditorOpen, setUsernameEditorOpen] = useState(false)
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
  const [commentAudience, setCommentAudience] = useState(userProfile.commentAudience || 'anyone')
  const [activityDigest, setActivityDigest] = useState(userProfile.activityDigest ?? true)
  const [commentAlerts, setCommentAlerts] = useState(true)
  const [quoteAlerts, setQuoteAlerts] = useState(true)
  const [followerAlerts, setFollowerAlerts] = useState(true)
  const [emailDigest, setEmailDigest] = useState(true)
  const [announcementAlerts, setAnnouncementAlerts] = useState(false)
  const [quietHours, setQuietHours] = useState(false)
  const [dateFormat, setDateFormat] = useState<'locale' | 'iso' | 'editorial'>('locale')
  const [firstDayOfWeek, setFirstDayOfWeek] = useState<'sunday' | 'monday'>('sunday')
  const [legalModalType, setLegalModalType] = useState<LegalModalType>(null)
  const [preferenceStorage, setPreferenceStorage] = useState(true)
  const [analyticsStorage, setAnalyticsStorage] = useState(false)
  const [showFollowLists, setShowFollowLists] = useState(userProfile.showFollowLists ?? true)
  const [allowComments, setAllowComments] = useState(userProfile.allowComments ?? true)
  const [privateProfile, setPrivateProfile] = useState(userProfile.isPrivate ?? false)
  const [showSavedActivity, setShowSavedActivity] = useState(userProfile.showSavedActivity ?? false)
  const [avatarUrl, setAvatarUrl] = useState(userProfile.avatarUrl || '')
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

  const handleExportArchive = () => {
    try {
      const storedEntries = localStorage.getItem('the-commonplace.entries')
      const storedCollections = localStorage.getItem('the-commonplace.collections')
      const entries = storedEntries ? JSON.parse(storedEntries) : []
      const collections = storedCollections ? JSON.parse(storedCollections) : []

      const archiveData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        owner: {
          displayName: computedDisplayName,
          handle: `@${sanitizedHandle || 'reader'}`,
          email: currentEmail,
          bio,
          location: userProfile.location || '',
          website: userProfile.website || '',
          curatorRole: userProfile.curatorRole || '',
          joined: userProfile.createdAt,
        },
        preferences: {
          readingTypography: userProfile.readingTypography || 'serif',
          catalogDensity: userProfile.catalogDensity || 'comfortable',
          isPrivate: privateProfile,
          allowComments,
          allowQuotes: userProfile.allowQuotes ?? true,
        },
        stats: {
          totalEntries: entries.length,
          totalCollections: collections.length,
        },
        entries,
        collections,
      }

      const blob = new Blob([JSON.stringify(archiveData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `commonplace-archive-${sanitizedHandle || 'user'}-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      setExportNotice('Personal archive exported successfully!')
      setTimeout(() => setExportNotice(''), 4000)
    } catch (err) {
      console.error('Export failed:', err)
    }
  }

  const handleExportMarkdown = () => {
    try {
      const storedEntries = localStorage.getItem('the-commonplace.entries')
      const entries = storedEntries ? JSON.parse(storedEntries) : []
      const lines: string[] = [
        `# Commonplace Reading Notes - @${sanitizedHandle || 'reader'}`,
        `Exported: ${new Date().toISOString().split('T')[0]}`,
        '',
      ]
      entries.forEach((e: { title?: string; creator?: string; type?: string; rating?: number; createdAt?: string; favoritePassage?: string; reflection?: string }) => {
        lines.push(`## ${e.title || 'Untitled'}`)
        lines.push(`- **Creator:** ${e.creator || 'Unknown'}`)
        lines.push(`- **Type:** ${e.type || 'entry'}`)
        if (e.rating) lines.push(`- **Rating:** ${'★'.repeat(e.rating)} (${e.rating}/5)`)
        if (e.createdAt) lines.push(`- **Added:** ${e.createdAt.split('T')[0]}`)
        if (e.favoritePassage) {
          lines.push('')
          lines.push('### Favorite Passage')
          lines.push(`> ${e.favoritePassage}`)
        }
        if (e.reflection) {
          lines.push('')
          lines.push('### Reflection')
          lines.push(e.reflection)
        }
        lines.push('')
        lines.push('---')
        lines.push('')
      })
      const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `commonplace-notes-${sanitizedHandle || 'user'}-${new Date().toISOString().split('T')[0]}.md`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      setExportNotice('Markdown reading notes exported successfully!')
      setTimeout(() => setExportNotice(''), 4000)
    } catch (err) {
      console.error('Markdown export failed:', err)
    }
  }

  const handleClearLocalCache = () => {
    try {
      localStorage.removeItem('the_commonplace_recent_media_searches_v4')
      localStorage.removeItem('the_commonplace_recent_user_searches_v3')
      sessionStorage.clear()
      setCacheNotice('Local offline cache and search history cleared.')
      setTimeout(() => setCacheNotice(''), 4000)
    } catch {
      setCacheNotice('Unable to clear local cache.')
    }
  }

  const handleClearReadingTrace = () => {
    try {
      clearReadingHistory()
      setCacheNotice('Reading and preview trace cleared.')
      setTimeout(() => setCacheNotice(''), 4000)
    } catch {
      setCacheNotice('Unable to clear reading trace.')
    }
  }

  const handleClearVisitedProfiles = () => {
    try {
      clearVisitedProfiles()
      setCacheNotice('Curator visitation history cleared.')
      setTimeout(() => setCacheNotice(''), 4000)
    } catch {
      setCacheNotice('Unable to clear visited profiles.')
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
    setCommentAudience(userProfile.commentAudience || 'anyone')
    setActivityDigest(userProfile.activityDigest ?? true)
    setShowFollowLists(userProfile.showFollowLists ?? true)
    setAllowComments(userProfile.allowComments ?? true)
    setPrivateProfile(userProfile.isPrivate ?? false)
    setShowSavedActivity(userProfile.showSavedActivity ?? false)
    setAvatarUrl(userProfile.avatarUrl || '')
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
    commentAudience !== (userProfile.commentAudience || 'anyone') ||
    activityDigest !== (userProfile.activityDigest ?? true) ||
    showFollowLists !== (userProfile.showFollowLists ?? true) ||
    allowComments !== (userProfile.allowComments ?? true) ||
    privateProfile !== (userProfile.isPrivate ?? false) ||
    showSavedActivity !== (userProfile.showSavedActivity ?? false) ||
    avatarUrl !== (userProfile.avatarUrl || '')

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
    setCommentAudience(userProfile.commentAudience || 'anyone')
    setActivityDigest(userProfile.activityDigest ?? true)
    setShowFollowLists(userProfile.showFollowLists ?? true)
    setAllowComments(userProfile.allowComments ?? true)
    setPrivateProfile(userProfile.isPrivate ?? false)
    setShowSavedActivity(userProfile.showSavedActivity ?? false)
    setAvatarUrl(userProfile.avatarUrl || '')
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
      avatarUrl: avatarUrl || userProfile.avatarUrl,
      coverUrl: userProfile.coverUrl,
      createdAt: userProfile.createdAt,
      birthday: userProfile.birthday,
      lastUsernameChangeDate: usernameChanged ? new Date().toISOString() : userProfile.lastUsernameChangeDate,
      showFollowLists,
      allowComments,
      isPrivate: privateProfile,
      showSavedActivity,
      location: userProfile.location || '',
      website: userProfile.website || '',
      curatorRole: userProfile.curatorRole || '',
      readingTypography: userProfile.readingTypography || 'serif',
      catalogDensity: userProfile.catalogDensity || 'comfortable',
      commentAudience,
      allowQuotes: userProfile.allowQuotes ?? true,
      activityDigest,
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
  const joinYear = userProfile.createdAt ? new Date(userProfile.createdAt).getFullYear() : '2026'
  const monogram = (firstName?.[0] || 'C').toUpperCase()

  return (
    <div className="page-wrapper settings-desktop-wrapper">
      {/* Top Floating Circle Back Button */}
      {showLocalNavigation && (
        <button
          type="button"
          className="profile-back-circle"
          onClick={onBack}
          title="Back to Feed"
          aria-label="Back to Feed"
        >
          <ArrowLeft aria-hidden="true" />
        </button>
      )}

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

          {/* TAB 1: PROFILE */}
          {activeTab === 'profile' && (
            <div className="settings-page-content">
              <div className="settings-header-minimal">
                <h1 className="settings-page-title">Profile Information</h1>
                <p className="settings-page-desc">
                  Manage your public identity, curator credentials, and presence across The Commonplace.
                </p>
              </div>

              {/* Live Commonplace Passport Card */}
              <div className="settings-passport-card">
                <div className="passport-glow" />
                <div className="passport-body">
                  <div className="passport-avatar-wrap">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="Profile Avatar"
                        className="passport-avatar-img"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="passport-avatar-monogram">{monogram}</div>
                    )}
                  </div>
                  <div className="passport-meta">
                    <div className="passport-name-row">
                      <span className="passport-name">{computedDisplayName || 'Commonplace Reader'}</span>
                      {currentUser?.emailVerified && (
                        <span className="passport-badge-verified">
                          <CheckCircle2 aria-hidden="true" />
                          <span>Verified</span>
                        </span>
                      )}
                    </div>
                    <div className="passport-handle-row">
                      <span>@{sanitizedHandle || 'reader'}</span>
                      <span>•</span>
                      <span>Member since {joinYear}</span>
                    </div>
                    {bio && <p className="passport-bio-snippet">{bio}</p>}
                  </div>
                </div>
              </div>

              <SettingsSection
                title="Identity & Profile"
                description="Personal information and display preferences for your public commonplace."
                icon={User}
              >
                <div className="settings-card">
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

                    {/* Change Username (Replaces Username Identifier) */}
                    <SettingsField
                      label="Change Username"
                      badge={
                        usernameEditorOpen && !isCurrentUsername ? (
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
                        ) : undefined
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
                        ) : usernameEditorOpen ? (
                          <span className="cooldown-notice">
                            <ShieldCheck aria-hidden="true" />
                            <span>Choose a unique handle between 3-20 characters (letters, numbers, underscores).</span>
                          </span>
                        ) : (
                          <span className="cooldown-notice">
                            <ShieldCheck aria-hidden="true" />
                            <span>Unique account identifier. Can be changed once every 14 days.</span>
                          </span>
                        )
                      }
                      htmlFor={usernameEditorOpen ? 'username-edit-input' : 'username-current-display'}
                    >
                      {!usernameEditorOpen ? (
                        <div className="settings-inline-action-row">
                          <div className="username-input-wrapper" style={{ flex: 1 }}>
                            <span className="at-prefix">@</span>
                            <input
                              id="username-current-display"
                              type="text"
                              className="dark-setting-input with-prefix"
                              value={sanitizedHandle}
                              readOnly
                              style={{ cursor: 'default', opacity: 0.85 }}
                            />
                          </div>
                          <button
                            type="button"
                            className="secondary-action-btn"
                            onClick={() => {
                              if (!isUsernameCooldownActive) {
                                setUsernameEditorOpen(true)
                              }
                            }}
                            disabled={isUsernameCooldownActive}
                            style={isUsernameCooldownActive ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
                            title={isUsernameCooldownActive ? `Username locked until ${nextAvailableDate}` : 'Change Username'}
                          >
                            Change Username
                          </button>
                        </div>
                      ) : (
                        <div className="settings-inline-action-row">
                          <div className="username-input-wrapper" style={{ flex: 1 }}>
                            <span className="at-prefix">@</span>
                            <input
                              id="username-edit-input"
                              type="text"
                              className={`dark-setting-input with-prefix ${
                                !isCurrentUsername && !isUsernameAvailable ? 'error' : ''
                              }`}
                              value={handleInput}
                              onChange={(e) => setHandleInput(e.target.value.replace(/\s+/g, ''))}
                              placeholder="newusername"
                              autoFocus
                            />
                          </div>
                          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                            <button
                              type="button"
                              className="save-bar-cancel-btn"
                              onClick={() => {
                                setHandleInput(userProfile.handle.replace(/^@/, ''))
                                setUsernameEditorOpen(false)
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              className="secondary-action-btn"
                              onClick={() => {
                                if (isUsernameAvailable) {
                                  setUsernameEditorOpen(false)
                                }
                              }}
                              disabled={!isUsernameAvailable}
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                      )}
                    </SettingsField>

                    <div className="email-verification-setting full-width" aria-label="Email Verification">
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
                </div>
              </SettingsSection>

              <SettingsSection
                title="Biography"
                description="A brief personal introduction displayed on your public commonplace."
                icon={User}
              >
                <div className="settings-card">
                  <SettingsField
                    label="Biography"
                    helperText={<span className="char-count">{bio.length} / 300 characters</span>}
                    htmlFor="bio"
                  >
                    <textarea
                      id="bio"
                      className="dark-setting-textarea"
                      rows={3}
                      value={bio}
                      maxLength={300}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Collector of timeless passages, album impressions, cinematic notes..."
                    />
                  </SettingsField>
                </div>
              </SettingsSection>
            </div>
          )}

          {/* TAB: THEME & APPEARANCE */}
          {activeTab === 'theme' && (
            <div className="settings-page-content">
              <div className="settings-header-minimal">
                <h1 className="settings-page-title">Theme &amp; Appearance</h1>
                <p className="settings-page-desc">
                  Choose how The Commonplace looks on this device. Your selection applies
                  instantly and is remembered here.
                </p>
              </div>

              <div
                className="settings-card settings-theme-picker-card"
                role="radiogroup"
                aria-label="Color pairings"
              >
                <div className="settings-theme-circles-grid">
                  {APPEARANCE_THEMES.map((theme) => {
                    const isActive = appearanceSettings.theme === theme.id
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        aria-label={theme.name}
                        title={`${theme.name} — ${theme.description}`}
                        className={`settings-theme-circle-option ${isActive ? 'is-active' : ''}`}
                        onClick={() => updateAppearanceSettings({ theme: theme.id })}
                      >
                        <span className="settings-theme-duotone-ring" aria-hidden="true">
                          <span
                            className="settings-theme-duotone-circle"
                            style={{
                              background: `linear-gradient(135deg, ${theme.palette.baseSwatch} 0% 49.5%, ${theme.palette.accent} 50.5% 100%)`,
                            }}
                          />
                          {isActive && (
                            <span
                              className="settings-theme-circle-check"
                              style={{
                                backgroundColor: theme.palette.accent,
                                color: theme.palette.accentFg,
                              }}
                            >
                              <Check size={11} strokeWidth={3.2} />
                            </span>
                          )}
                        </span>
                        <span className="settings-theme-circle-label">{theme.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="settings-page-content">
              <div className="settings-header-minimal">
                <h1 className="settings-page-title">Notifications</h1>
                <p className="settings-page-desc">
                  Choose how and when The Commonplace notifies you of community responses, citations, and digests.
                </p>
              </div>

              <SettingsSection
                title="Discussion & Interaction Alerts"
                description="Manage notifications for direct interactions with your entries and notebook entries."
                icon={Bell}
              >
                <div className="settings-card">
                  <SettingsToggle
                    label="In-App Activity Notifications"
                    description="Receive in-app alerts when other readers like, save, or quote your entries."
                    checked={activityDigest}
                    onChange={setActivityDigest}
                    icon={Bell}
                  />

                  <SettingsToggle
                    label="Discussion & Comment Replies"
                    description="Receive alerts when other readers reply to your thoughts or comment on your catalog entries."
                    checked={commentAlerts}
                    onChange={setCommentAlerts}
                    icon={MessageSquare}
                  />

                  <SettingsToggle
                    label="Quote & Citation Notices"
                    description="Notify you when someone cites or excerpts a passage from your library into their notebook."
                    checked={quoteAlerts}
                    onChange={setQuoteAlerts}
                    icon={Bookmark}
                  />

                  <SettingsToggle
                    label="New Follower Notices"
                    description="Receive a discreet notification when another reader begins following your commonplace."
                    checked={followerAlerts}
                    onChange={setFollowerAlerts}
                    icon={Users}
                  />
                </div>
              </SettingsSection>

              <SettingsSection
                title="Email Communications & Digests"
                description="Periodic reflections and administrative dispatches delivered directly to your inbox."
                icon={Mail}
              >
                <div className="settings-card">
                  <SettingsToggle
                    label="Weekly Sanctuary Digest"
                    description="A calm Sunday morning summary highlighting discussions, notable quotes, and popular media in your circle."
                    checked={emailDigest}
                    onChange={setEmailDigest}
                    icon={Mail}
                  />

                  <SettingsToggle
                    label="Product & Feature Announcements"
                    description="Infrequent, intentional updates regarding new capabilities, typography releases, and archiving tools."
                    checked={announcementAlerts}
                    onChange={setAnnouncementAlerts}
                    icon={Sparkles}
                  />
                </div>
              </SettingsSection>

              <SettingsSection
                title="Quiet Hours & Focus"
                description="Silence notification sounds and real-time banners during contemplation or reading hours."
                icon={Clock}
              >
                <div className="settings-card">
                  <SettingsToggle
                    label="Enable Quiet Hours"
                    description="Temporarily silence push sounds and banners between 10:00 PM and 8:00 AM in your local timezone."
                    checked={quietHours}
                    onChange={setQuietHours}
                    icon={Clock}
                    badge={quietHours ? '10 PM – 8 AM' : 'Inactive'}
                  />
                </div>
              </SettingsSection>
            </div>
          )}

          {/* TAB 3: SOCIAL & INTERACTIONS */}
          {activeTab === 'social' && (
            <div className="settings-page-content">
              <div className="settings-header-minimal">
                <h1 className="settings-page-title">Social & Interactions</h1>
                <p className="settings-page-desc">Manage comments, community replies, and interaction boundaries.</p>
              </div>

              <SettingsSection
                title="Comment Settings"
                description="Control who is permitted to leave responses on your entries."
                icon={MessageSquare}
              >
                <div className="settings-card">
                  <SettingsToggle
                    label="Allow Comments on Entries"
                    description="Allow other readers to post comments and replies on your catalog entries."
                    checked={allowComments}
                    onChange={setAllowComments}
                    icon={MessageSquare}
                  />

                  {allowComments && (
                    <div style={{ paddingTop: '12px', borderTop: '1px solid var(--divider)' }}>
                      <SettingsField label="Who can comment" helperText="Restrict comments to readers you mutually follow.">
                        <div className="settings-tile-group">
                          <button
                            type="button"
                            className={`settings-tile-card ${commentAudience === 'anyone' ? 'selected' : ''}`}
                            onClick={() => setCommentAudience('anyone')}
                          >
                            <div className="settings-tile-title-row">
                              <span>Anyone on The Commonplace</span>
                              {commentAudience === 'anyone' && <Check size={14} aria-hidden="true" />}
                            </div>
                            <p className="settings-tile-desc">Open to any registered reader browsing your commonplace.</p>
                          </button>

                          <button
                            type="button"
                            className={`settings-tile-card ${commentAudience === 'mutuals' ? 'selected' : ''}`}
                            onClick={() => setCommentAudience('mutuals')}
                          >
                            <div className="settings-tile-title-row">
                              <span>Mutual Followers Only</span>
                              {commentAudience === 'mutuals' && <Check size={14} aria-hidden="true" />}
                            </div>
                            <p className="settings-tile-desc">Only people you follow back may leave remarks.</p>
                          </button>
                        </div>
                      </SettingsField>
                    </div>
                  )}
                </div>
              </SettingsSection>

              <SettingsSection
                title="Social List Preferences"
                description="Control visibility of your followers and following lists."
                icon={Users}
              >
                <div className="settings-card">
                  <SettingsToggle
                    label="Show Followers & Following Lists"
                    description="Allow visitors to click your follower and following counts on your profile to view your connections."
                    checked={showFollowLists}
                    onChange={setShowFollowLists}
                    icon={Users}
                  />
                </div>
              </SettingsSection>
            </div>
          )}

          {/* TAB 4: LANGUAGE & REGION */}
          {activeTab === 'language' && (
            <div className="settings-page-content">
              <div className="settings-header-minimal">
                <h1 className="settings-page-title">Language & Region</h1>
                <p className="settings-page-desc">
                  Customize your locale, regional formatting conventions, and upcoming multilingual preferences.
                </p>
              </div>

              <SettingsSection
                title="Multilingual Commonplace"
                description="The Commonplace is being prepared for a global community of readers and scholars."
                icon={Globe}
              >
                {/* Multilingual Placeholder Callout Card */}
                <div className="settings-card settings-multilingual-card">
                  <div className="settings-multilingual-badge-row">
                    <span className="multilingual-status-pill">
                      <Sparkles size={13} aria-hidden="true" />
                      Multilingual Support Coming Soon
                    </span>
                  </div>
                  <h3 className="settings-multilingual-headline">
                    Literary translations currently in progress
                  </h3>
                  <p className="settings-multilingual-text">
                    We are thoughtfully translating interface typography, literary catalogs, and sanctuary navigation
                    into world languages. The current interface is fully available in English, with additional languages
                    rolling out soon.
                  </p>

                  <div className="settings-language-grid">
                    <div className="settings-language-option active">
                      <div className="language-option-header">
                        <span className="language-name">English</span>
                        <span className="language-badge active">
                          <Check size={12} aria-hidden="true" /> Active
                        </span>
                      </div>
                      <span className="language-subname">English (US / International)</span>
                    </div>

                    <div className="settings-language-option coming-soon">
                      <div className="language-option-header">
                        <span className="language-name">Français</span>
                        <span className="language-badge coming-soon">In Translation</span>
                      </div>
                      <span className="language-subname">French</span>
                    </div>

                    <div className="settings-language-option coming-soon">
                      <div className="language-option-header">
                        <span className="language-name">Deutsch</span>
                        <span className="language-badge coming-soon">In Translation</span>
                      </div>
                      <span className="language-subname">German</span>
                    </div>

                    <div className="settings-language-option coming-soon">
                      <div className="language-option-header">
                        <span className="language-name">日本語</span>
                        <span className="language-badge coming-soon">In Translation</span>
                      </div>
                      <span className="language-subname">Japanese</span>
                    </div>

                    <div className="settings-language-option coming-soon">
                      <div className="language-option-header">
                        <span className="language-name">Español</span>
                        <span className="language-badge coming-soon">In Translation</span>
                      </div>
                      <span className="language-subname">Spanish</span>
                    </div>

                    <div className="settings-language-option coming-soon">
                      <div className="language-option-header">
                        <span className="language-name">Italiano</span>
                        <span className="language-badge coming-soon">In Translation</span>
                      </div>
                      <span className="language-subname">Italian</span>
                    </div>
                  </div>
                </div>
              </SettingsSection>

              <SettingsSection
                title="Date & Time Formatting"
                description="Select how dates, journal stamps, and publication years appear across your commonplace."
                icon={Clock}
              >
                <div className="settings-card">
                  <SettingsField label="Date Format Style" helperText="Applied to entry timestamps, reviews, and reading milestones.">
                    <div className="settings-tile-group">
                      <button
                        type="button"
                        className={`settings-tile-card ${dateFormat === 'locale' ? 'selected' : ''}`}
                        onClick={() => setDateFormat('locale')}
                      >
                        <div className="settings-tile-title-row">
                          <span>Standard Locale</span>
                          {dateFormat === 'locale' && <Check size={14} aria-hidden="true" />}
                        </div>
                        <p className="settings-tile-desc">e.g. 27 Oct 2026 • Follows your browser's natural regional formatting.</p>
                      </button>

                      <button
                        type="button"
                        className={`settings-tile-card ${dateFormat === 'editorial' ? 'selected' : ''}`}
                        onClick={() => setDateFormat('editorial')}
                      >
                        <div className="settings-tile-title-row">
                          <span>Literary Longform</span>
                          {dateFormat === 'editorial' && <Check size={14} aria-hidden="true" />}
                        </div>
                        <p className="settings-tile-desc">e.g. October 27, 2026 • Manuscript format for reflections and essays.</p>
                      </button>

                      <button
                        type="button"
                        className={`settings-tile-card ${dateFormat === 'iso' ? 'selected' : ''}`}
                        onClick={() => setDateFormat('iso')}
                      >
                        <div className="settings-tile-title-row">
                          <span>Archival ISO 8601</span>
                          {dateFormat === 'iso' && <Check size={14} aria-hidden="true" />}
                        </div>
                        <p className="settings-tile-desc">e.g. 2026-10-27 • Strict chronological standard for archival records.</p>
                      </button>
                    </div>
                  </SettingsField>

                  <div style={{ paddingTop: '16px', borderTop: '1px solid var(--divider)' }}>
                    <SettingsField label="First Day of the Week" helperText="Defines the starting day on reading logs and calendars.">
                      <div className="settings-tile-group" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                        <button
                          type="button"
                          className={`settings-tile-card ${firstDayOfWeek === 'sunday' ? 'selected' : ''}`}
                          onClick={() => setFirstDayOfWeek('sunday')}
                        >
                          <div className="settings-tile-title-row">
                            <span>Sunday</span>
                            {firstDayOfWeek === 'sunday' && <Check size={14} aria-hidden="true" />}
                          </div>
                          <p className="settings-tile-desc">Standard in US, Canada, and Japan</p>
                        </button>

                        <button
                          type="button"
                          className={`settings-tile-card ${firstDayOfWeek === 'monday' ? 'selected' : ''}`}
                          onClick={() => setFirstDayOfWeek('monday')}
                        >
                          <div className="settings-tile-title-row">
                            <span>Monday</span>
                            {firstDayOfWeek === 'monday' && <Check size={14} aria-hidden="true" />}
                          </div>
                          <p className="settings-tile-desc">ISO standard &amp; common throughout Europe</p>
                        </button>
                      </div>
                    </SettingsField>
                  </div>

                  <div style={{ paddingTop: '16px', borderTop: '1px solid var(--divider)' }}>
                    <div className="settings-timezone-row">
                      <div className="settings-timezone-info">
                        <span className="settings-timezone-label">Detected Timezone</span>
                        <span className="settings-timezone-value">
                          {Intl?.DateTimeFormat ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC'}
                        </span>
                        <span className="settings-timezone-hint">
                          Automatically synchronized with your operating system device clock.
                        </span>
                      </div>
                      <span className="settings-badge-synced">
                        <CheckCircle2 size={13} aria-hidden="true" /> Synchronized
                      </span>
                    </div>
                  </div>
                </div>
              </SettingsSection>
            </div>
          )}

          {/* TAB 4: PRIVACY */}
          {activeTab === 'privacy' && (
            <div className="settings-page-content">
              <div className="settings-header-minimal">
                <h1 className="settings-page-title">Privacy & Visibility</h1>
                <p className="settings-page-desc">Control who can see your profile and how it appears online.</p>
              </div>

              <SettingsSection
                title="Display Name & Identity Visibility"
                description="Control how your display name and full name appear publicly across the community."
                icon={User}
              >
                <div className="settings-card">
                  <SettingsField
                    label="Display Name"
                    helperText={
                      <span>
                        Preview: <strong>{computedDisplayName}</strong> • Shown at the top of your public profile and discussions.
                      </span>
                    }
                    htmlFor="privacy-display-name"
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <input
                        id="privacy-display-name"
                        type="text"
                        className="dark-setting-input"
                        value={computedDisplayName}
                        readOnly
                        style={{ opacity: 0.85, cursor: 'default' }}
                      />
                      <SettingsToggle
                        label="Display Full Name"
                        description="Include your last name in public displays alongside your @handle."
                        checked={showFullName}
                        onChange={setShowFullName}
                        icon={User}
                      />
                    </div>
                  </SettingsField>
                </div>
              </SettingsSection>

              <SettingsSection
                title="Profile Visibility"
                description="Choose whether your commonplace is open to others or kept entirely private."
                icon={Shield}
              >
                <div className="settings-card">
                  <SettingsToggle
                    label="Private Profile"
                    description="When enabled, your profile and catalog will be hidden from all other users."
                    checked={privateProfile}
                    onChange={setPrivateProfile}
                    icon={Shield}
                    badge={privateProfile ? 'Private Sanctum' : 'Public'}
                  />
                </div>
              </SettingsSection>

              <SettingsSection
                title="Saved Activity"
                description="Choose whether visitors can browse the things you have saved."
                icon={Bookmark}
              >
                <div className="settings-card">
                  <SettingsToggle
                    label="Show Saved Catalog & Collections"
                    description="Display a Saved tab on your public profile. This is hidden by default and does not affect what you can see yourself."
                    checked={showSavedActivity}
                    onChange={setShowSavedActivity}
                    icon={Bookmark}
                  />
                </div>
              </SettingsSection>

              <SettingsSection
                title="Home Recommendations"
                description="Clear the interests learned from your catalog, saves, likes, and opened media."
                icon={Sparkles}
              >
                <div className="settings-card">
                  <div
                    className="settings-danger-zone-row"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '20px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <strong style={{ display: 'block', color: 'var(--text-strong)', fontSize: '14px', marginBottom: '3px' }}>
                        Reset Home recommendations
                      </strong>
                      <span style={{ fontSize: '12.5px', color: 'var(--secondary)' }}>
                        Your public and mutual-follow feed will return to a fresh, diverse ordering.
                      </span>
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
                </div>
              </SettingsSection>
            </div>
          )}

          {/* TAB: YOUR DATA */}
          {activeTab === 'data' && (
            <div className="settings-page-content">
              <div className="settings-header-minimal">
                <h1 className="settings-page-title">Your Data</h1>
                <p className="settings-page-desc">
                  Maintain complete sovereignty over your library, export archival records, and control local session traces.
                </p>
              </div>

              {exportNotice && (
                <div className="settings-saved-banner">
                  <CheckCircle2 aria-hidden="true" />
                  <span>{exportNotice}</span>
                </div>
              )}

              {cacheNotice && (
                <div className="settings-saved-banner">
                  <CheckCircle2 aria-hidden="true" />
                  <span>{cacheNotice}</span>
                </div>
              )}

              <SettingsSection
                title="Data Sovereignty & Archival Export"
                description="Download a complete copy of your entries, reflections, and commonplace collections in portable formats."
                icon={Download}
              >
                <div className="settings-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="settings-export-card" style={{ border: 'none', padding: 0 }}>
                    <div className="settings-export-info">
                      <span className="settings-export-title">Export Commonplace Archive (.json)</span>
                      <span className="settings-export-desc">
                        A machine-readable, timestamped JSON archive containing your complete catalog, quotes, reflections, and account metadata.
                      </span>
                    </div>
                    <button
                      type="button"
                      className="secondary-action-btn"
                      onClick={handleExportArchive}
                    >
                      <Download aria-hidden="true" />
                      <span>Export Archive (.json)</span>
                    </button>
                  </div>

                  <div style={{ height: '1px', background: 'var(--divider)', width: '100%' }} />

                  <div className="settings-export-card" style={{ border: 'none', padding: 0 }}>
                    <div className="settings-export-info">
                      <span className="settings-export-title">Export Literary Notes (.md)</span>
                      <span className="settings-export-desc">
                        Formatted Markdown document of your reading notes, favorite passages, and reflections for Obsidian, Notion, or personal archives.
                      </span>
                    </div>
                    <button
                      type="button"
                      className="secondary-action-btn"
                      onClick={handleExportMarkdown}
                    >
                      <FileText aria-hidden="true" />
                      <span>Export Notes (.md)</span>
                    </button>
                  </div>
                </div>
              </SettingsSection>

              <SettingsSection
                title="Activity & Session Traces"
                description="Manage local device traces of your reading and exploration activity."
                icon={Clock}
              >
                <div className="settings-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="settings-danger-row" style={{ padding: 0 }}>
                    <div className="settings-danger-info">
                      <strong className="settings-danger-title" style={{ color: 'var(--text-strong)' }}>
                        Clear Reading &amp; Preview Trace
                      </strong>
                      <p className="settings-danger-desc">
                        Clears the record of entries you opened to full reading view over the last 7 days.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="secondary-action-btn"
                      onClick={handleClearReadingTrace}
                    >
                      <Trash2 aria-hidden="true" />
                      <span>Clear Reading Trace</span>
                    </button>
                  </div>

                  <div style={{ height: '1px', background: 'var(--divider)', width: '100%' }} />

                  <div className="settings-danger-row" style={{ padding: 0 }}>
                    <div className="settings-danger-info">
                      <strong className="settings-danger-title" style={{ color: 'var(--text-strong)' }}>
                        Clear Visited Curators
                      </strong>
                      <p className="settings-danger-desc">
                        Clears the quick-access history of curator profiles you have visited in the Activity tab.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="secondary-action-btn"
                      onClick={handleClearVisitedProfiles}
                    >
                      <Trash2 aria-hidden="true" />
                      <span>Clear Visited Curators</span>
                    </button>
                  </div>

                  <div style={{ height: '1px', background: 'var(--divider)', width: '100%' }} />

                  <div className="settings-danger-row" style={{ padding: 0 }}>
                    <div className="settings-danger-info">
                      <strong className="settings-danger-title" style={{ color: 'var(--text-strong)' }}>
                        Clear Search Queries
                      </strong>
                      <p className="settings-danger-desc">
                        Deletes recent author and media search keywords cached in your local browser storage.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="secondary-action-btn"
                      onClick={handleClearLocalCache}
                    >
                      <Trash2 aria-hidden="true" />
                      <span>Clear Search Cache</span>
                    </button>
                  </div>
                </div>
              </SettingsSection>

              <SettingsSection
                title="Storage & Offline Cache"
                description="Manage client-side caching to reduce device memory usage or force synchronization."
                icon={HardDrive}
              >
                <div className="settings-card">
                  <div className="settings-danger-row" style={{ padding: 0 }}>
                    <div className="settings-danger-info">
                      <strong className="settings-danger-title" style={{ color: 'var(--text-strong)' }}>
                        Purge Local Device Cache
                      </strong>
                      <p className="settings-danger-desc">
                        Removes temporary media thumbnails, cached feed snippets, and session artifacts without modifying your cloud commonplace data.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="secondary-action-btn"
                      onClick={handleClearLocalCache}
                    >
                      <HardDrive aria-hidden="true" />
                      <span>Purge Local Cache</span>
                    </button>
                  </div>
                </div>
              </SettingsSection>

              <SettingsSection
                title="Sanctuary Data Covenant"
                description="Our fundamental commitment to personal sovereignty and zero monetization."
                icon={ShieldCheck}
              >
                <div className="settings-card">
                  <div className="settings-legal-policy-card">
                    <div className="legal-policy-card-body">
                      <div className="legal-policy-card-header">
                        <div className="legal-policy-badge">
                          <ShieldCheck size={13} aria-hidden="true" />
                          <span>Zero Ad Monetization</span>
                        </div>
                        <span className="legal-policy-updated">Sovereignty Promise</span>
                      </div>
                      <h3 className="legal-policy-title">Your library belongs solely to you.</h3>
                      <p className="legal-policy-desc">
                        We never sell, rent, or broker your reading history, personal notes, or intellectual reflections to third parties.
                        The Commonplace is designed as a sanctuary—free from advertising surveillance, algorithmic manipulation, and locked silos.
                      </p>
                    </div>
                  </div>
                </div>
              </SettingsSection>
            </div>
          )}

          {/* TAB 5: SECURITY */}
          {activeTab === 'security' && (
            <div className="settings-page-content">
              <div className="settings-header-minimal">
                <h1 className="settings-page-title">Account & Security</h1>
                <p className="settings-page-desc">Manage credentials, passwords, and linked accounts.</p>
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
                icon={Mail}
              >
                <div className="settings-card">
                  <div className="settings-email-address-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
                    <SettingsField label="Current email" htmlFor="security-current-email">
                      {!emailEditorOpen ? (
                        <div className="settings-inline-action-row">
                          <input
                            id="security-current-email"
                            type="email"
                            className="dark-setting-input"
                            value={currentEmail}
                            readOnly
                          />
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
                        </div>
                      ) : (
                        <input
                          id="security-current-email"
                          type="email"
                          className="dark-setting-input"
                          value={currentEmail}
                          readOnly
                        />
                      )}
                    </SettingsField>

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
                        <div className="settings-email-change-actions" style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
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

                    <div className="email-verification-setting full-width" style={{ width: '100%', boxSizing: 'border-box' }} aria-label="Email Verification">
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
                </div>
              </SettingsSection>

              <SettingsSection
                title="Change Password"
                description="Update your account password regularly."
                icon={Lock}
              >
                <div className="settings-card">
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
                </div>
              </SettingsSection>

              <SettingsSection title="Linked Accounts" description="Fast, secure sign-in with verified third-party identities." icon={Link2}>
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
                  icon={AlertTriangle}
                  isDanger
                >
                  <div className="settings-card" style={{ borderColor: 'rgba(239, 68, 68, 0.25)' }}>
                    <div className="settings-danger-zone-container">
                      <div className="settings-danger-row settings-deactivation-row">
                        <div className="settings-danger-info">
                          <strong className="settings-danger-title">Deactivate account</strong>
                          <p className="settings-danger-desc">
                            Hide your profile and activity until your chosen return date—or until you decide to return.
                          </p>
                        </div>
                        <button
                          type="button"
                          className="settings-deactivation-button"
                          onClick={openDeactivationFlow}
                        >
                          <Clock aria-hidden="true" />
                          <span>Deactivate account</span>
                        </button>
                      </div>

                      <div className="settings-danger-divider" />

                      <div className="settings-danger-row">
                        <div className="settings-danger-info">
                          <strong className="settings-danger-title is-delete">Delete account</strong>
                          <p className="settings-danger-desc">
                            This removes your profile, catalogs, collections, comments, likes, follows, and sign-in account permanently.
                          </p>
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
                          <span>Delete account</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </SettingsSection>
              </div>
            </div>
          )}

          {/* TAB 7: COMMUNITY STANDARDS & LEGAL POLICY */}
          {activeTab === 'legal' && (
            <div className="settings-page-content">
              <div className="settings-header-minimal">
                <h1 className="settings-page-title">Community Standards &amp; Legal Policy</h1>
                <p className="settings-page-desc">
                  The covenants, safety rules, and legal agreements that preserve The Commonplace as a thoughtful, respectful sanctuary.
                </p>
              </div>

              <SettingsSection
                title="Terms of Service & Covenants"
                description="The core agreement governing account ownership, intellectual property, and sanctuary integrity."
                icon={Scroll}
              >
                <div className="settings-card">
                  <div className="settings-legal-policy-card">
                    <div className="legal-policy-card-body">
                      <div className="legal-policy-card-header">
                        <div className="legal-policy-badge">
                          <Scroll size={13} aria-hidden="true" />
                          <span>Binding Covenant</span>
                        </div>
                        <span className="legal-policy-updated">Updated for 2026</span>
                      </div>
                      <h3 className="legal-policy-title">Terms of Service</h3>
                      <p className="legal-policy-desc">
                        Covers your intellectual property rights (you own everything you record), 16+ age eligibility,
                        responsible curation, and service continuity. We claim no ownership over your reading reflections or notes.
                      </p>
                    </div>
                    <div className="legal-policy-actions">
                      <button
                        type="button"
                        className="secondary-action-btn"
                        onClick={() => setLegalModalType('terms')}
                      >
                        Read Full Terms
                      </button>
                    </div>
                  </div>
                </div>
              </SettingsSection>

              <SettingsSection
                title="Privacy Policy"
                description="How your data is protected, minimized, and kept free from advertising monetization."
                icon={ShieldCheck}
              >
                <div className="settings-card">
                  <div className="settings-legal-policy-card">
                    <div className="legal-policy-card-body">
                      <div className="legal-policy-card-header">
                        <div className="legal-policy-badge">
                          <ShieldCheck size={13} aria-hidden="true" />
                          <span>Privacy by Design</span>
                        </div>
                        <span className="legal-policy-updated">Zero Ad Tracking</span>
                      </div>
                      <h3 className="legal-policy-title">Privacy Policy</h3>
                      <p className="legal-policy-desc">
                        Details our strict data minimization principles. We do not sell or monetize personal information,
                        your date of birth is kept private and hidden, and private profiles remain completely excluded from indexing.
                      </p>
                    </div>
                    <div className="legal-policy-actions">
                      <button
                        type="button"
                        className="secondary-action-btn"
                        onClick={() => setLegalModalType('privacy')}
                      >
                        Read Full Privacy Policy
                      </button>
                    </div>
                  </div>
                </div>
              </SettingsSection>

              <SettingsSection
                title="Cookie & Local Storage Policy"
                description="Understand and manage how data is stored in your browser to maintain your reading experience."
                icon={Cookie}
              >
                <div className="settings-card">
                  <div className="settings-legal-policy-card" style={{ marginBottom: '16px' }}>
                    <div className="legal-policy-card-body">
                      <div className="legal-policy-card-header">
                        <div className="legal-policy-badge">
                          <Cookie size={13} aria-hidden="true" />
                          <span>Minimal Footprint</span>
                        </div>
                        <span className="legal-policy-updated">No Cross-Site Cookies</span>
                      </div>
                      <h3 className="legal-policy-title">Cookie &amp; Storage Principles</h3>
                      <p className="legal-policy-desc">
                        The Commonplace avoids third-party advertising cookies entirely. We use strictly necessary local storage
                        for secure session preservation and local caching of your typography and reading themes.
                      </p>
                    </div>
                    <div className="legal-policy-actions">
                      <button
                        type="button"
                        className="secondary-action-btn"
                        onClick={() => setLegalModalType('cookies')}
                      >
                        Read Full Cookie Policy
                      </button>
                    </div>
                  </div>

                  <div style={{ paddingTop: '16px', borderTop: '1px solid var(--divider)' }}>
                    <span className="toggle-label" style={{ display: 'block', marginBottom: '8px' }}>
                      Browser Storage Preferences
                    </span>
                    <SettingsToggle
                      label="Essential Authentication & Session Tokens"
                      description="Required to keep your account signed in and protect transactions. Cannot be disabled."
                      checked={true}
                      disabled={true}
                      onChange={() => {}}
                      badge="Strictly Necessary"
                    />

                    <SettingsToggle
                      label="Local Reading & Typography Cache"
                      description="Stores your reading theme, catalog layout density, and font choices in localStorage for instantaneous rendering."
                      checked={preferenceStorage}
                      onChange={setPreferenceStorage}
                      badge="Functional"
                    />

                    <SettingsToggle
                      label="Anonymous Performance Telemetry"
                      description="Helps us understand app performance bottlenecks and masonry render speed without collecting personal data."
                      checked={analyticsStorage}
                      onChange={setAnalyticsStorage}
                      badge="Optional"
                    />
                  </div>
                </div>
              </SettingsSection>

              <SettingsSection
                title="Community Standards & Guidelines"
                description="The Principles of Sanctuary: fostering contemplative, civil, and generous artistic discourse."
                icon={Scale}
              >
                <div className="settings-card">
                  <div className="settings-legal-policy-card">
                    <div className="legal-policy-card-body">
                      <div className="legal-policy-card-header">
                        <div className="legal-policy-badge">
                          <Scale size={13} aria-hidden="true" />
                          <span>Sanctuary Guidelines</span>
                        </div>
                        <span className="legal-policy-updated">Peer Moderation</span>
                      </div>
                      <h3 className="legal-policy-title">Community Standards</h3>
                      <p className="legal-policy-desc">
                        Our commitments to civil discourse, intellectual honesty in citations and quotations, responsible
                        spoiler notices, and a zero-tolerance policy for harassment, discrimination, or abusive conduct.
                      </p>
                    </div>
                    <div className="legal-policy-actions">
                      <button
                        type="button"
                        className="secondary-action-btn"
                        onClick={() => setLegalModalType('standards')}
                      >
                        Read Community Standards
                      </button>
                    </div>
                  </div>
                </div>
              </SettingsSection>
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

      {/* Legal & Policy Modal */}
      <LegalModal type={legalModalType} onClose={() => setLegalModalType(null)} />
    </div>
  )
}
