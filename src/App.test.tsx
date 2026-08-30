import { fireEvent, render, screen, waitForElementToBeRemoved } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import AppController from './app/AppController'
import { ExpansionProvider } from './context/ExpansionContext'
import { AuthProvider } from './context/AuthContext'

function renderApplication() {
  return render(
    <BrowserRouter>
      <AuthProvider>
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

  it('renders the feed and opens the entry composer', async () => {
    renderApplication()
    expect(await screen.findByText('The Commonplace.')).toBeInTheDocument()
    expect(screen.getByRole('banner')).toHaveClass('global-app-header', 'is-home-page')
    expect(screen.queryByRole('button', { name: 'Go home' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add new entry' }))
    expect(await screen.findByText('New Margin')).toBeInTheDocument()
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

  it('renders a collection route as a standalone page with a real save action', async () => {
    window.history.replaceState({}, '', '/users/elena_r/collections/collection-elena_r-highlights')
    renderApplication()

    expect(await screen.findByRole('heading', { name: "Elena's Highlights" })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Loading collection media' })).toBeInTheDocument()
    await waitForElementToBeRemoved(() => screen.queryByRole('status', { name: 'Loading collection media' }))
    expect(screen.queryByRole('heading', { name: 'Elena Rostova' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to collections' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save collection' }))
    expect(await screen.findByRole('button', { name: 'Saved' })).toBeInTheDocument()
    expect(screen.getByText('Created by Elena Rostova')).toBeInTheDocument()
    expect(localStorage.getItem('the-commonplace.saved-profile-collections.v1:jimboii')).toContain('collection-elena_r-highlights')
  })

  it('keeps saved activity hidden on profiles that have not shared it', async () => {
    window.history.replaceState({}, '', '/users/elena_r')
    renderApplication()

    expect(await screen.findByRole('heading', { name: 'Created Catalog (3)' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Catalogs' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('tab', { name: /^Saved/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /^Collections/ }))
    await waitForElementToBeRemoved(() => screen.queryByRole('status', { name: 'Loading collections' }))
    expect(screen.getByRole('heading', { name: 'Created Collections (1)' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Created Catalog (3)' })).not.toBeInTheDocument()
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

  it('opens shared profiles on Created and lets visitors switch to their public Saved activity', async () => {
    window.history.replaceState({}, '', '/users/marcus_v')
    renderApplication()

    expect(await screen.findByRole('tab', { name: 'Catalogs' })).toHaveAttribute('aria-selected', 'true')
    const savedTab = screen.getByRole('tab', { name: /^Saved Catalog/ })
    expect(savedTab).toHaveAttribute('aria-selected', 'false')
    expect(screen.queryByLabelText('Saved catalog is private')).not.toBeInTheDocument()

    fireEvent.click(savedTab)
    await waitForElementToBeRemoved(() => screen.queryByRole('status', { name: 'Loading saved catalog' }))

    expect(screen.getByRole('heading', { name: 'Saved Catalog (2)' })).toBeInTheDocument()
    expect(screen.queryByText("Elena's Highlights")).not.toBeInTheDocument()

    const savedCollectionsTab = screen.getByRole('tab', { name: /^Saved Collections/ })
    fireEvent.click(savedCollectionsTab)
    await waitForElementToBeRemoved(() => screen.queryByRole('status', { name: 'Loading collections' }))

    expect(screen.getByRole('heading', { name: 'Saved Collections (1)' })).toBeInTheDocument()
    expect(screen.getByText("Elena's Highlights")).toBeInTheDocument()
  })

  it('keeps saved activity private by default and exposes an opt-in privacy setting', async () => {
    window.history.replaceState({}, '', '/settings')
    renderApplication()

    fireEvent.click(await screen.findByRole('button', { name: 'Privacy & Visibility' }))
    const savedVisibility = screen.getByRole('switch', { name: 'Show Saved Catalog & Collections' })
    expect(savedVisibility).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(savedVisibility)
    expect(savedVisibility).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(await screen.findByText('Settings updated successfully!')).toBeInTheDocument()
  })
})
