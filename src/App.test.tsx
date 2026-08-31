import { fireEvent, render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react'
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
}: { authenticated?: boolean; verified?: boolean } = {}) {
  return render(
    <BrowserRouter>
      <AuthProvider
        initialUser={authenticated ? { ...TEST_USER, emailVerified: verified } as User : undefined}
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
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('starts logged out when there is no Firebase session', async () => {
    renderApplication({ authenticated: false })

    expect(await screen.findByRole('heading', { name: 'Welcome back.' })).toBeInTheDocument()
    expect(screen.queryByText(/Test login/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Continue as Guest/i })).not.toBeInTheDocument()
    await waitFor(() => expect(window.location.pathname).toBe('/login'))
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
    expect(screen.getByRole('banner')).toHaveClass('global-app-header', 'is-home-page')
    expect(screen.queryByRole('button', { name: 'Go home' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add new entry' }))
    const composerTitle = await screen.findByText('New Margin')
    expect(composerTitle).toBeInTheDocument()
    expect(composerTitle.closest('.modal-backdrop')).toBeInTheDocument()
  })

  it('blocks posting until the signed-in email is verified', async () => {
    renderApplication({ verified: false })

    expect(await screen.findByText(/Email hasn't been verified/i)).toBeInTheDocument()
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
    window.history.replaceState({}, '', '/users/jimboii')
    renderApplication()
    expect(await screen.findByText('@jimboii')).toBeInTheDocument()
    expect(screen.getByRole('banner')).toHaveClass('global-app-header', 'is-inner-page')
    expect(screen.getByRole('button', { name: 'Go home' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back to Feed' })).not.toBeInTheDocument()
  })

  it('opens the default header search', async () => {
    renderApplication()
    fireEvent.click(await screen.findByRole('button', { name: 'Search' }))
    expect(screen.getByRole('textbox', { name: 'Search' })).toBeInTheDocument()
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
    window.history.replaceState({}, '', '/users/jimboii')
    renderApplication()

    expect(await screen.findByRole('tab', { name: 'Catalogs' })).toHaveAttribute('aria-selected', 'true')
    const savedTab = screen.getByRole('tab', { name: /^Saved Catalog/ })
    expect(savedTab).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByLabelText('Saved catalog is private')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^Saved Collections/ })).toBeInTheDocument()

    fireEvent.click(savedTab)
    await waitForElementToBeRemoved(() => screen.queryByRole('status', { name: 'Loading saved catalog' }))
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
})
