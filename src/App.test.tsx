import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import AppController from './app/AppController'
import { ExpansionProvider } from './context/ExpansionContext'

function renderApplication() {
  return render(
    <BrowserRouter>
      <ExpansionProvider>
        <AppController />
      </ExpansionProvider>
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
    fireEvent.click(screen.getByRole('button', { name: 'Add new entry' }))
    expect(await screen.findByText('New Margin')).toBeInTheDocument()
  })

  it('renders a direct user profile route without an undefined profile callback', async () => {
    window.history.replaceState({}, '', '/users/jimboii')
    renderApplication()
    expect(await screen.findByText('@jimboii')).toBeInTheDocument()
  })

  it('opens the default header search', async () => {
    renderApplication()
    fireEvent.click(await screen.findByRole('button', { name: 'Search' }))
    expect(screen.getByRole('textbox', { name: 'Search' })).toBeInTheDocument()
  })
})
