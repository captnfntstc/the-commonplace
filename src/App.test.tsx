import { fireEvent, render, screen, waitFor, waitForElementToBeRemoved, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import type { User } from 'firebase/auth'
import AppController from './app/AppController'
import { ExpansionProvider } from './context/ExpansionContext'
import { AuthProvider } from './context/AuthContext'

const TEST_USER = {
  uid: '',
  email: 'jimmy@example.com',
  displayName: 'Jimmy Boy',
  photoURL: null,
  emailVerified: true,
  getIdToken: vi.fn().mockResolvedValue('test-id-token'),
} as unknown as User

function renderApplication({
  authenticated = true,
  verified = true,
  user = TEST_USER,
}: { authenticated?: boolean; verified?: boolean; user?: User } = {}) {
  return render(
    <BrowserRouter>
      <AuthProvider
        initialUser={authenticated ? { ...user, emailVerified: verified } as User : undefined}
      >
        <ExpansionProvider>
          <AppController />
        </ExpansionProvider>
      </AuthProvider>
    </BrowserRouter>,
  )
}

describe('application shell', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.replaceState({}, '', '/')
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('starts logged out when there is no Firebase session', async () => {
    renderApplication({ authenticated: false })

    expect(await screen.findByRole('heading', { name: 'Welcome back.' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Keep me signed in' })).toBeChecked()
    expect(screen.queryByText(/Test login/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Continue as Guest/i })).not.toBeInTheDocument()
    await waitFor(() => expect(window.location.pathname).toBe('/login'))
  })

  it('checks registration usernames and offers verified alternatives when one is taken', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          handle: 'reader',
          available: false,
          suggestions: ['reader_314', 'reader_2718', 'reader_808'],
        }),
      })
      .mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          handle: 'reader_314',
          available: true,
          suggestions: [],
        }),
      })
    vi.stubGlobal('fetch', fetchMock)
    renderApplication({ authenticated: false })

    fireEvent.click(await screen.findByRole('button', { name: 'Create one' }))
    const usernameInput = screen.getByRole('textbox', { name: 'Username' })
    fireEvent.change(usernameInput, { target: { value: 'Reader' } })

    expect(await screen.findByText('That username is already taken.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '@reader_314' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '@reader_2718' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '@reader_314' }))
    expect(usernameInput).toHaveValue('reader_314')
    expect(await screen.findByText('Username is available.')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/auth/handle-availability?handle=reader_314',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    )
  })

  it('requires a private date of birth and blocks registration below age 16', async () => {
    renderApplication({ authenticated: false })

    fireEvent.click(await screen.findByRole('button', { name: 'Create one' }))
    expect(screen.getByRole('checkbox', { name: /confirm that I am 16 or older/i })).toBeInTheDocument()
    expect(screen.queryByText(/Kept private and used for eligibility and birthday greetings/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Learn more' }))
    expect(screen.getByRole('dialog', { name: 'Age & Content Guide' })).toBeInTheDocument()
    expect(screen.getByText(/Kept private and used for eligibility and birthday greetings/i)).toBeInTheDocument()
    expect(screen.getByText('3. Country and regional requirements')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Understood' }))
    fireEvent.change(screen.getByLabelText('Date of birth'), { target: { value: '2015-09-02' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('You must be at least 16 years old to create an account.')).toBeInTheDocument()
  })

  it('uses a generic two-step forgot-password flow for email or username', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ sent: true }),
    })
    vi.stubGlobal('fetch', fetchMock)
    renderApplication({ authenticated: false })

    fireEvent.click(await screen.findByRole('button', { name: 'Forgot password?' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Email or username' }), {
      target: { value: '@jimboii' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(await screen.findByRole('heading', { name: 'Check your email.' })).toBeInTheDocument()
    expect(screen.getByText(/If an account matching those credentials exists/i)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/password-reset-links', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ identifier: '@jimboii' }),
    }))
  })

  it('shows a stable message when the password reset service cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('NetworkError when attempting to fetch resource.')))
    renderApplication({ authenticated: false })

    fireEvent.click(await screen.findByRole('button', { name: 'Forgot password?' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Email or username' }), {
      target: { value: 'reader@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(await screen.findByText('The password reset service is unavailable. Please try again shortly.')).toBeInTheDocument()
    expect(screen.queryByText(/NetworkError/i)).not.toBeInTheDocument()
  })

  it('renders invalid password reset tokens in the app without requiring a session', async () => {
    window.history.replaceState({}, '', '/reset-password/abcdefghijklmnopqrst')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ valid: false }),
    }))

    renderApplication({ authenticated: false })
    expect(await screen.findByRole('heading', { name: 'This link is invalid or expired.' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/reset-password/abcdefghijklmnopqrst')
  })

  it('hides Firebase email-action parameters from the address bar', async () => {
    window.history.replaceState({}, '', '/verify-email?mode=verifyEmail&apiKey=visible-key')
    renderApplication()

    expect(await screen.findByRole('heading', { name: 'Verification link unavailable.' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/verify-email')
    expect(window.location.search).toBe('')
  })

  it('renders the feed and opens the entry composer', async () => {
    renderApplication()
    expect(await screen.findByText('The Commonplace.')).toBeInTheDocument()
    const header = screen.getByRole('banner')
    expect(header).toHaveClass('global-app-header', 'is-home-page')
    expect(header.closest('.main-content')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Go home' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add new entry' }))
    const composerTitle = await screen.findByText('New Margin')
    expect(composerTitle).toBeInTheDocument()
    expect(composerTitle.closest('.modal-backdrop')).toBeInTheDocument()
  })

  it('opens a dedicated mobile navigation menu', async () => {
    renderApplication()
    fireEvent.click(await screen.findByRole('button', { name: 'Open menu' }))

    expect(screen.getByRole('navigation', { name: 'Mobile navigation' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Profile' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument()
  })

  it('renders a custom 404 page without rewriting an unknown URL', async () => {
    window.history.replaceState({}, '', '/missing-page')
    renderApplication()

    expect(await screen.findByRole('heading', { name: 'This page slipped between the margins.' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/missing-page')
  })

  it('keeps an owned username even when old profile fields resemble the legacy demo', async () => {
    localStorage.setItem('the-commonplace.user-profile.v1', JSON.stringify({
      firstName: 'Jimmy',
      lastName: 'Boy',
      showFullName: true,
      handle: 'jimboii',
      email: 'jimmy@example.com',
      bio: 'Collector of timeless passages, album impressions, cinematic notes, and personal reflections in one quiet place.',
      avatarUrl: '',
      coverUrl: '',
      lastUsernameChangeDate: '2026-07-01T00:00:00.000Z',
    }))

    renderApplication()
    await screen.findByText('The Commonplace.')
    fireEvent.click(screen.getByRole('button', { name: 'User Profile & Settings' }))

    expect(screen.getByRole('button', { name: 'View @jimboii profile' })).toBeInTheDocument()
    expect(screen.queryByText('@jimmy_account')).not.toBeInTheDocument()
  })

  it('only shows the back-to-top control while the page is scrolled', async () => {
    renderApplication()
    await screen.findByText('The Commonplace.')

    expect(screen.queryByRole('button', { name: 'Back to top' })).not.toBeInTheDocument()

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 240 })
    fireEvent.scroll(window)
    expect(screen.getByRole('button', { name: 'Back to top' })).toBeInTheDocument()

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
    fireEvent.scroll(window)
    expect(screen.queryByRole('button', { name: 'Back to top' })).not.toBeInTheDocument()
  })

  it('opens an in-app sign-out confirmation instead of calling window.confirm', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    renderApplication()

    fireEvent.click(await screen.findByRole('button', { name: 'User Profile & Settings' }))
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }))

    expect(await screen.findByRole('dialog', { name: 'Sign out?' })).toBeInTheDocument()
    expect(screen.getByText("You'll be returned to the login screen.")).toBeInTheDocument()
    expect(confirmSpy).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitForElementToBeRemoved(() => screen.queryByRole('dialog', { name: 'Sign out?' }))

    localStorage.setItem('the-commonplace.likes', '["entry-1"]')
    localStorage.setItem('the_commonplace_recent_media_searches_v3:old-user', '[{"id":"old"}]')
    localStorage.setItem('unrelated.preference', 'keep-me')
    fireEvent.click(screen.getByRole('button', { name: 'User Profile & Settings' }))
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Sign Out' }))

    expect(await screen.findByRole('heading', { name: 'Welcome back.' })).toBeInTheDocument()
    expect(localStorage.getItem('the-commonplace.likes')).toBeNull()
    expect(localStorage.getItem('the_commonplace_recent_media_searches_v3:old-user')).toBeNull()
    expect(localStorage.getItem('unrelated.preference')).toBe('keep-me')
  })

  it('shows the simplified account menu and opens Activity', async () => {
    renderApplication()

    fireEvent.click(await screen.findByRole('button', { name: 'User Profile & Settings' }))
    expect(screen.queryByRole('button', { name: 'View Profile' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /View @.+ profile/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Activity' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Help & Support' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Activity' }))
    expect(await screen.findByRole('heading', { name: 'Activity' })).toBeInTheDocument()
    expect(screen.getByText('Personal Activity Logs')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /View My Liked Entries/ }))
    expect(screen.getByRole('dialog', { name: /My Liked Entries/ })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/activity')
  })

  it('closes the profile menu when another header popup opens', async () => {
    renderApplication()

    fireEvent.click(await screen.findByRole('button', { name: 'User Profile & Settings' }))
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }))
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument()
    expect(screen.getByText("You're all caught up!")).toBeInTheDocument()
  })

  it('opens the profile from the complete account identity row', async () => {
    renderApplication()

    fireEvent.click(await screen.findByRole('button', { name: 'User Profile & Settings' }))
    const identityLink = screen.getByRole('button', { name: /View @.+ profile/ })
    expect(identityLink.querySelector('.menu-identity-avatar')).not.toBeNull()
    expect(identityLink.querySelector('.menu-user-name')).not.toBeNull()
    expect(identityLink.querySelector('.menu-user-handle')).not.toBeNull()

    fireEvent.click(identityLink)
    expect(window.location.pathname).toMatch(/^\/users\//)
  })

  it('opens the Help & Support page from the account menu', async () => {
    renderApplication()

    fireEvent.click(await screen.findByRole('button', { name: 'User Profile & Settings' }))
    fireEvent.click(screen.getByRole('button', { name: 'Help & Support' }))
    expect(await screen.findByRole('heading', { name: 'Help & Support' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Settings' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/help')
  })

  it('blocks posting until the signed-in email is verified', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    renderApplication({ verified: false })

    expect(await screen.findByText(/Email hasn't been verified/i)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Dismiss email verification reminder' })).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: 'Add new entry' }))
    expect(await screen.findByRole('dialog', { name: 'Verify your email first' })).toBeInTheDocument()
    expect(screen.getByText('jimmy@example.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Okay' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Not now' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Resend email' })).not.toBeInTheDocument()
    expect(screen.getByText(/Email hasn't been verified/i)).toBeInTheDocument()
    expect(screen.queryByText('New Margin')).not.toBeInTheDocument()
  })

  it('sends verification directly from the banner and starts the resend timer', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ sent: true, retryAfter: 60 }),
    })
    vi.stubGlobal('fetch', fetchMock)
    renderApplication({ verified: false })

    fireEvent.click(await screen.findByRole('button', { name: 'Verify now' }))

    expect(await screen.findByRole('button', { name: /Resend in (1:00|0:59)/ })).toBeDisabled()
    expect(await screen.findByText(/Sent to jimmy@example\.com/i)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/verification-links', expect.objectContaining({ method: 'POST' }))
  })

  it('restores the verification resend timer after a refresh', async () => {
    localStorage.setItem(
      'the-commonplace.verification-email-cooldown.jimmy@example.com',
      String(Date.now() + 60_000),
    )
    renderApplication({ verified: false })

    expect(await screen.findByRole('button', { name: /Resend in (1:00|0:59)/ })).toBeDisabled()
  })

  it('does not show the verification banner in settings', async () => {
    window.history.replaceState({}, '', '/settings')
    renderApplication({ verified: false })

    expect(await screen.findByRole('heading', { name: 'Profile Information' })).toBeInTheDocument()
    expect(screen.queryByText(/Email hasn't been verified/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Verify now' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Check status' })).not.toBeInTheDocument()
  })

  it('renders a direct user profile route without an undefined profile callback', async () => {
    window.history.replaceState({}, '', '/users/jimmy_account')
    renderApplication()
    expect(await screen.findByText('@jimmy_account')).toBeInTheDocument()
    expect(screen.getByRole('banner')).toHaveClass('global-app-header', 'is-inner-page')
    expect(screen.getByRole('button', { name: 'Go home' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back to Feed' })).not.toBeInTheDocument()
    const newEntryButton = screen.getByRole('button', { name: 'Add new entry' })
    expect(newEntryButton).toHaveClass('fab')
    fireEvent.click(newEntryButton)
    expect(await screen.findByText('New Margin')).toBeInTheDocument()
  })

  it('keeps the profile viewport stable and slides the created-catalog filter pill', async () => {
    window.history.replaceState({}, '', '/users/jimmy_account')
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 640 })
    const scrollToSpy = vi.spyOn(window, 'scrollTo')
    renderApplication()

    const filters = await screen.findByLabelText('Filter created catalog by media type')
    const allButton = within(filters).getByText('All').closest('button')
    const albumsButton = within(filters).getByText('Albums').closest('button')
    expect(allButton?.querySelector('.profile-filter-pill')).toBeInTheDocument()

    scrollToSpy.mockClear()
    fireEvent.click(albumsButton!)

    await waitFor(() => {
      expect(albumsButton).toHaveClass('active')
      expect(albumsButton?.querySelector('.profile-filter-pill')).toBeInTheDocument()
    })
    expect(allButton?.querySelector('.profile-filter-pill')).not.toBeInTheDocument()
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 640, behavior: 'auto' })
  })

  it('opens the default header search', async () => {
    renderApplication()
    fireEvent.click(await screen.findByRole('button', { name: 'Search' }))
    expect(screen.getByRole('textbox', { name: 'Search' })).toBeInTheDocument()
  })

  it('finishes a home filter transition when the selected type has no entries', async () => {
    const scrollToSpy = vi.spyOn(window, 'scrollTo')
    renderApplication()
    expect(await screen.findByRole('heading', { name: 'Your commonplace is waiting.' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Books' }))

    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Saved entries' })).toHaveAttribute('aria-busy', 'false')
    })
    expect(screen.queryByRole('status', { name: 'Loading home entries' })).not.toBeInTheDocument()
    expect(scrollToSpy).not.toHaveBeenCalled()
  })

  it('removes legacy demo content instead of rendering it on home', async () => {
    localStorage.setItem('the-commonplace.entries', JSON.stringify([{
      id: 'ext-elena-book-1',
      type: 'book',
      title: 'Legacy demo book',
      creator: 'Demo author',
      provider: 'demo',
      providerId: 'demo-book',
      rating: 5,
      favoritePassage: '',
      reflection: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      coverTone: 'gold',
      authorHandle: 'elena_r',
    }]))
    localStorage.setItem('the-commonplace.following-users', JSON.stringify(['elena_r']))
    localStorage.setItem('the-commonplace.profile-collections.v1:elena_r', '[]')

    renderApplication()

    expect(await screen.findByRole('heading', { name: 'Your commonplace is waiting.' })).toBeInTheDocument()
    expect(screen.queryByText('Legacy demo book')).not.toBeInTheDocument()
    expect(localStorage.getItem('the-commonplace.profile-collections.v1:elena_r')).toBeNull()
  })

  it('keeps a private Saved tab accessible to its owner and marks it with a lock', async () => {
    window.history.replaceState({}, '', '/users/jimmy_account')
    renderApplication()

    expect(await screen.findByRole('tab', { name: 'Catalogs' })).toHaveAttribute('aria-selected', 'true')
    const savedTab = screen.getByRole('tab', { name: /^Saved Catalog/ })
    expect(savedTab).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByLabelText('Saved catalog is private')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^Saved Collections/ })).toBeInTheDocument()

    fireEvent.click(savedTab)
    await waitForElementToBeRemoved(() => screen.queryByRole('status', { name: 'Loading saved catalog entries' }))
    expect(savedTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: /Saved Catalog/ })).toBeInTheDocument()
  })

  it('keeps saved activity private by default and exposes an opt-in privacy setting', async () => {
    window.history.replaceState({}, '', '/settings')
    renderApplication()

    expect(await screen.findByRole('button', { name: 'Privacy & Visibility' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Developer Tools' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Data & Storage' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Email Verification')).toHaveTextContent('Verified')
    fireEvent.click(screen.getByRole('button', { name: 'Privacy & Visibility' }))
    const savedVisibility = screen.getByRole('switch', { name: 'Show Saved Catalog & Collections' })
    expect(savedVisibility).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(savedVisibility)
    expect(savedVisibility).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(await screen.findByText('Settings updated successfully!')).toBeInTheDocument()
  })

  it('requires typed confirmation before permanently deleting an account', async () => {
    window.history.replaceState({}, '', '/settings')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ deleted: true }),
    })
    vi.stubGlobal('fetch', fetchMock)
    renderApplication()

    fireEvent.click(await screen.findByRole('button', { name: 'Account & Security' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))

    const dialog = screen.getByRole('dialog', { name: 'Delete your account?' })
    const permanentDelete = screen.getByRole('button', { name: 'Permanently delete account' })
    expect(dialog).toBeInTheDocument()
    expect(permanentDelete).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Confirmation'), { target: { value: 'DELETE' } })
    expect(permanentDelete).toBeEnabled()
    fireEvent.click(permanentDelete)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/auth/account', expect.objectContaining({
      method: 'DELETE',
      headers: { Authorization: 'Bearer test-id-token' },
    })))
    expect(await screen.findByRole('heading', { name: 'Welcome back.' })).toBeInTheDocument()
  })

  it('collects deactivation timing and optional safety feedback', async () => {
    window.history.replaceState({}, '', '/settings')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ deactivated: true, reactivatesAt: null }),
    })
    vi.stubGlobal('fetch', fetchMock)
    renderApplication()

    fireEvent.click(await screen.findByRole('button', { name: 'Account & Security' }))
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate account' }))

    expect(screen.getByRole('dialog', { name: 'Take a quiet break' })).toBeInTheDocument()
    const submit = screen.getByRole('button', { name: 'Deactivate my account' })
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Why are you deactivating?'), {
      target: { value: 'privacy_or_safety' },
    })
    fireEvent.change(screen.getByLabelText('When would you like to return?'), {
      target: { value: 'in_my_own_time' },
    })
    fireEvent.click(screen.getByLabelText(/made me feel unsafe or unwelcome/i))
    fireEvent.change(screen.getByLabelText(/Anything you would like us to understand/i), {
      target: { value: 'Please add stronger blocking tools.' },
    })
    fireEvent.click(submit)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/account/deactivate',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-id-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: 'privacy_or_safety',
          returnPlan: 'in_my_own_time',
          safetyConcern: true,
          feedback: 'Please add stronger blocking tools.',
        }),
      }),
    ))
    expect(await screen.findByRole('heading', { name: 'Welcome back.' })).toBeInTheDocument()
  })

  it('offers deactivation from the permanent deletion dialog', async () => {
    window.history.replaceState({}, '', '/settings')
    renderApplication()

    fireEvent.click(await screen.findByRole('button', { name: 'Account & Security' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))
    fireEvent.click(screen.getByRole('button', { name: 'deactivating your account instead' }))

    expect(screen.queryByRole('dialog', { name: 'Delete your account?' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Take a quiet break' })).toBeInTheDocument()
  })
})
