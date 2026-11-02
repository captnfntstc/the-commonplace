import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SettingsPage } from './SettingsPage'
import {
  getAppearanceSettings,
  resetAppearanceSettings,
} from '../features/appearance/appearanceSettings'
import type { UserProfileState } from '../types/userProfile'

// Mock useAuth
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    currentUser: {
      uid: 'test-user-id',
      email: 'reader@example.com',
      emailVerified: true,
      providerData: [{ providerId: 'google.com' }],
    },
    changeEmail: vi.fn(),
    changePassword: vi.fn(),
    setAppleAccountLinked: vi.fn(),
    setGoogleAccountLinked: vi.fn(),
    deactivateAccount: vi.fn(),
    deleteAccount: vi.fn(),
    resendVerificationEmail: vi.fn(),
    verificationEmailCooldownSeconds: 0,
    verificationEmailSent: false,
  }),
}))

const mockProfile: UserProfileState = {
  firstName: 'Virginia',
  lastName: 'Woolf',
  showFullName: true,
  handle: '@virginia',
  email: 'reader@example.com',
  bio: 'A room of one’s own.',
  avatarUrl: '',
  coverUrl: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  birthday: '1882-01-25',
  showFollowLists: true,
  allowComments: true,
  isPrivate: false,
  showSavedActivity: true,
}

describe('SettingsPage Redesign & Content Updates', () => {
  beforeEach(() => {
    window.localStorage.clear()
    resetAppearanceSettings()
  })

  afterEach(() => {
    window.localStorage.clear()
    resetAppearanceSettings()
  })

  it('renders updated navigation tabs including Theme & Appearance and excludes Curation & Space', () => {
    render(
      <SettingsPage
        onBack={vi.fn()}
        userProfile={mockProfile}
        onSaveProfile={vi.fn()}
      />
    )

    // Expected tabs
    expect(screen.getByRole('button', { name: /Profile Information/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Theme & Appearance/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Notifications/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Social & Interactions/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Language & Region/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Privacy & Visibility/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Your Data/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Account & Security/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Community Standards & Legal Policy/i })).toBeDefined()

    // Excluded tab
    expect(screen.queryByRole('button', { name: /Curation & Space/i })).toBeNull()
  })

  it('navigates to Theme & Appearance tab, omits the Dark Mode toggle, and switches across all 8 two-toned circle pairings', () => {
    render(
      <SettingsPage
        onBack={vi.fn()}
        userProfile={mockProfile}
        onSaveProfile={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Theme & Appearance/i }))

    expect(screen.getByRole('heading', { name: 'Theme & Appearance', level: 1 })).toBeDefined()
    expect(screen.getByRole('radiogroup', { name: /Color pairings/i })).toBeDefined()

    // Dark Mode toggle switch has been removed in favor of two-toned circles
    expect(screen.queryByRole('switch', { name: /Dark Mode/i })).toBeNull()

    // 8 two-toned circles in one flat grid — no light/dark grouping, names speak for themselves
    const lightSunrise = screen.getByRole('radio', { name: /Sunrise/i })
    const lightHoney = screen.getByRole('radio', { name: /Honey/i })
    const lightMatcha = screen.getByRole('radio', { name: /Matcha/i })
    const lightOcean = screen.getByRole('radio', { name: /Ocean/i })
    const darkEspresso = screen.getByRole('radio', { name: /Espresso/i })
    const darkBonfire = screen.getByRole('radio', { name: /Bonfire/i })
    const darkEvergreen = screen.getByRole('radio', { name: /Evergreen/i })
    const darkMidnight = screen.getByRole('radio', { name: /Midnight/i })

    expect(lightSunrise).toBeDefined()
    expect(lightHoney).toBeDefined()
    expect(lightMatcha).toBeDefined()
    expect(lightOcean).toBeDefined()
    expect(darkEspresso).toBeDefined()
    expect(darkBonfire).toBeDefined()
    expect(darkEvergreen).toBeDefined()
    expect(darkMidnight).toBeDefined()

    // Default is Sunrise (white)
    expect(getAppearanceSettings().theme).toBe('white')
    expect(lightSunrise.getAttribute('aria-checked')).toBe('true')

    // Switch to Matcha (light pairing)
    fireEvent.click(lightMatcha)
    expect(getAppearanceSettings().theme).toBe('white-emerald')
    expect(document.documentElement.dataset.theme).toBe('white-emerald')
    expect(document.documentElement.classList.contains('theme-white')).toBe(true)
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#059669')
    expect(document.documentElement.style.getPropertyValue('--logo-ink')).toBe('#09090b')
    expect(lightMatcha.getAttribute('aria-checked')).toBe('true')

    // Switch to Midnight (dark pairing)
    fireEvent.click(darkMidnight)
    expect(getAppearanceSettings().theme).toBe('dark-cobalt')
    expect(document.documentElement.dataset.theme).toBe('dark-cobalt')
    expect(document.documentElement.classList.contains('theme-dark')).toBe(true)
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#60a5fa')
    expect(document.documentElement.style.getPropertyValue('--logo-ink')).toBe('#ffffff')
    expect(darkMidnight.getAttribute('aria-checked')).toBe('true')
  })

  it('removes curator role, location, and website from Profile tab while keeping biography', () => {
    render(
      <SettingsPage
        onBack={vi.fn()}
        userProfile={mockProfile}
        onSaveProfile={vi.fn()}
      />
    )

    // Removed curator and presence notes
    expect(screen.queryByText(/Curator Presence & Notes/i)).toBeNull()
    expect(screen.queryByLabelText(/Curator Role/i)).toBeNull()
    expect(screen.queryByLabelText(/Location or Base/i)).toBeNull()
    expect(screen.queryByLabelText(/Personal Publication or Website/i)).toBeNull()

    // Preserved bio and display fields
    expect(screen.getByLabelText(/Biography/i)).toBeDefined()
    expect(screen.getByLabelText(/First Name/i)).toBeDefined()
    expect(screen.getByLabelText(/Last Name/i)).toBeDefined()
  })

  it('navigates to Notifications tab and displays interaction alerts and quiet hours', () => {
    render(
      <SettingsPage
        onBack={vi.fn()}
        userProfile={mockProfile}
        onSaveProfile={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Notifications/i }))

    expect(screen.getByText(/Discussion & Interaction Alerts/i)).toBeDefined()
    expect(screen.getByText(/In-App Activity Notifications/i)).toBeDefined()
    expect(screen.getByText(/Quote & Citation Notices/i)).toBeDefined()
    expect(screen.getByText(/Weekly Sanctuary Digest/i)).toBeDefined()
    expect(screen.getByText(/Enable Quiet Hours/i)).toBeDefined()
  })

  it('navigates to Language & Region tab and displays multilingual placeholder and formatting', () => {
    render(
      <SettingsPage
        onBack={vi.fn()}
        userProfile={mockProfile}
        onSaveProfile={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Language & Region/i }))

    expect(screen.getByText(/Multilingual Support Coming Soon/i)).toBeDefined()
    expect(screen.getByText(/Literary translations currently in progress/i)).toBeDefined()
    expect(screen.getByText(/Date & Time Formatting/i)).toBeDefined()
    expect(screen.getByText(/Detected Timezone/i)).toBeDefined()
  })

  it('navigates to Community Standards & Legal Policy and opens legal modal for Terms and Cookies', async () => {
    render(
      <SettingsPage
        onBack={vi.fn()}
        userProfile={mockProfile}
        onSaveProfile={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Community Standards & Legal Policy/i }))

    // All policy cards should be visible
    expect(screen.getAllByRole('heading', { name: /Terms of Service/i }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole('heading', { name: /Privacy Policy/i }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('heading', { name: /Cookie & Storage Principles/i, level: 3 })).toBeDefined()
    expect(screen.getAllByRole('heading', { name: /Community Standards/i }).length).toBeGreaterThanOrEqual(1)

    // Test opening Terms modal
    fireEvent.click(screen.getByRole('button', { name: /Read Full Terms/i }))
    expect(screen.getByRole('dialog')).toBeDefined()
    expect(screen.getByRole('heading', { name: /Terms of Service/i, level: 2 })).toBeDefined()

    // Close modal
    fireEvent.click(screen.getByRole('button', { name: /Understood/i }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    // Test opening Cookie Policy modal
    fireEvent.click(screen.getByRole('button', { name: /Read Full Cookie Policy/i }))
    expect(screen.getByRole('dialog')).toBeDefined()
    expect(screen.getByRole('heading', { name: /Cookie & Storage Policy/i, level: 2 })).toBeDefined()

    // Close modal
    fireEvent.click(screen.getByRole('button', { name: /Understood/i }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  it('removes Avatar section and provides Change Username button with cooldown support', () => {
    // 1. Profile with no recent username change (eligible to change)
    const { unmount } = render(
      <SettingsPage
        onBack={vi.fn()}
        userProfile={mockProfile}
        onSaveProfile={vi.fn()}
      />
    )

    // Avatar section removed
    expect(screen.queryByText(/Visual Identity & Avatar/i)).toBeNull()
    expect(screen.queryByLabelText(/Upload new avatar/i)).toBeNull()

    // Change Username button is enabled and clickable
    const changeUsernameBtn = screen.getByRole('button', { name: /Change Username/i })
    expect(changeUsernameBtn).toBeDefined()
    expect(changeUsernameBtn.getAttribute('disabled')).toBeNull()

    unmount()

    // 2. Profile with recent username change within 14 days (cooldown active)
    const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    render(
      <SettingsPage
        onBack={vi.fn()}
        userProfile={{ ...mockProfile, lastUsernameChangeDate: recentDate }}
        onSaveProfile={vi.fn()}
      />
    )

    const disabledBtn = screen.getByRole('button', { name: /Change Username/i })
    expect(disabledBtn.getAttribute('disabled')).not.toBeNull()
    expect(screen.getByText(/Username locked/i)).toBeDefined()
  })

  it('renders Display Name in Privacy & Visibility tab', () => {
    render(
      <SettingsPage
        onBack={vi.fn()}
        userProfile={mockProfile}
        onSaveProfile={vi.fn()}
      />
    )

    // Not in Profile tab
    expect(screen.queryByText(/Display Name & Identity Visibility/i)).toBeNull()

    // Navigate to Privacy & Visibility tab
    fireEvent.click(screen.getByRole('button', { name: /Privacy & Visibility/i }))

    expect(screen.getByText(/Display Name & Identity Visibility/i)).toBeDefined()
    expect(screen.getByLabelText(/Display Name/i)).toBeDefined()
    expect(screen.getByLabelText(/Display Full Name/i)).toBeDefined()
  })

  it('renders Your Data tab with export options, activity traces, and offline cache settings', () => {
    render(
      <SettingsPage
        onBack={vi.fn()}
        userProfile={mockProfile}
        onSaveProfile={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Your Data/i }))

    // Tab title
    expect(screen.getByRole('heading', { name: 'Your Data', level: 1 })).toBeDefined()

    // Data Sovereignty & Archival Export
    expect(screen.getByRole('button', { name: /Export Archive \(\.json\)/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Export Notes \(\.md\)/i })).toBeDefined()

    // Activity & Session Traces
    expect(screen.getByRole('button', { name: /Clear Reading Trace/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Clear Visited Curators/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Clear Search Cache/i })).toBeDefined()

    // Storage & Offline Cache
    expect(screen.getByRole('button', { name: /Purge Local Cache/i })).toBeDefined()

    // Sanctuary Data Covenant
    expect(screen.getByText(/Your library belongs solely to you\./i)).toBeDefined()
  })

  it('renders Account & Security with inline email change action and symmetrical danger zone', () => {
    render(
      <SettingsPage
        onBack={vi.fn()}
        userProfile={mockProfile}
        onSaveProfile={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Account & Security/i }))

    // Inline Email change button
    expect(screen.getByRole('button', { name: /Change Email/i })).toBeDefined()
    expect(screen.getByLabelText(/Email Verification/i)).toBeDefined()

    // Danger Zone
    expect(screen.getByRole('button', { name: /Deactivate account/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Delete account/i })).toBeDefined()
  })
})
