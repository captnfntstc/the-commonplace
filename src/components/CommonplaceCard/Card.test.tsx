import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BookOpen } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import type { Entry } from '../../features/entries/model'
import { Card } from './Card'

const ENTRY: Entry = {
  id: 'card-click-test',
  type: 'book',
  title: 'The Test Book',
  creator: 'Test Author',
  provider: 'Manual',
  providerId: 'test-book',
  genre: 'Literary fiction',
  rating: 4,
  favoritePassage: 'A memorable passage.',
  reflection: 'A thoughtful reflection.',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  coverTone: 'gold',
  authorHandle: 'reader',
}

function renderCard(overrides: {
  entry?: Entry
  expanded?: boolean
  onToggle?: () => void
  onOpenProfile?: () => void
  onOpenMedia?: () => void
  onExpandOverlay?: () => void
  onEdit?: () => void
  onDelete?: () => void
  onToggleCommentsDisabled?: () => void
  commentsDisabled?: boolean
} = {}) {
  const onToggle = overrides.onToggle ?? vi.fn()
  const onOpenProfile = overrides.onOpenProfile ?? vi.fn()
  const onOpenMedia = overrides.onOpenMedia ?? vi.fn()
  const result = render(
    <Card
      entry={overrides.entry ?? ENTRY}
      expanded={overrides.expanded ?? false}
      onToggle={onToggle}
      onOpenProfile={onOpenProfile}
      onOpenMedia={onOpenMedia}
      onExpandOverlay={overrides.onExpandOverlay}
      onEdit={overrides.onEdit}
      onDelete={overrides.onDelete}
      onToggleCommentsDisabled={overrides.onToggleCommentsDisabled}
      commentsDisabled={overrides.commentsDisabled}
      typeIcon={BookOpen}
      typeLabel="Book"
    />,
  )

  return { ...result, onToggle, onOpenProfile, onOpenMedia }
}

describe('card expansion click area', () => {
  it('toggles from non-interactive content throughout the card', () => {
    const { container, onToggle } = renderCard({ expanded: true })

    fireEvent.click(screen.getByText('Literary fiction'))
    fireEvent.click(screen.getByText('A thoughtful reflection.'))
    fireEvent.click(container.querySelector('.card-glance-bar')!)

    expect(onToggle).toHaveBeenCalledTimes(3)
  })

  it('excludes the author header and preserves nested control behavior', () => {
    const { container, onToggle, onOpenProfile, onOpenMedia } = renderCard()

    fireEvent.click(container.querySelector('.card-toprow')!)
    fireEvent.click(screen.getByRole('button', { name: "View @reader's profile" }))
    fireEvent.click(screen.getByRole('button', { name: 'The Test Book' }))

    expect(onToggle).not.toHaveBeenCalled()
    expect(onOpenProfile).toHaveBeenCalledOnce()
    expect(onOpenMedia).toHaveBeenCalledOnce()
  })

  it('opens the media page from artwork without toggling the card', () => {
    const { onToggle, onOpenMedia } = renderCard({ onExpandOverlay: vi.fn() })

    fireEvent.click(screen.getByRole('button', { name: 'Open media page for The Test Book' }))
    fireEvent.click(screen.getByRole('button', { name: /A memorable passage/ }))
    fireEvent.click(screen.getByRole('button', { name: 'More entry actions' }))

    expect(onOpenMedia).toHaveBeenCalledOnce()
    expect(onToggle).toHaveBeenCalledOnce()
  })

  it('is not expandable when the entry has no visible reflection', () => {
    const { container, onToggle } = renderCard({
      entry: { ...ENTRY, reflection: '<p><br></p>' },
      expanded: true,
    })

    fireEvent.click(screen.getByText('Literary fiction'))
    fireEvent.click(screen.getByRole('button', { name: 'Open media page for The Test Book' }))

    expect(onToggle).not.toHaveBeenCalled()
    expect(container.querySelector('.card-artwork')).toBeInstanceOf(HTMLButtonElement)
    expect(container.querySelector('.entry-card')).not.toHaveClass('is-expandable')
    expect(container.querySelector('.card-reflection')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'View details for The Test Book' })).not.toBeInTheDocument()
  })
})

describe('card actions menu', () => {
  it('moves reading and owner controls into the footer ellipsis', async () => {
    const onToggleCommentsDisabled = vi.fn()
    renderCard({
      onExpandOverlay: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      onToggleCommentsDisabled,
    })

    expect(screen.queryByRole('button', { name: 'Expand card' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'More entry actions' }))

    expect(screen.getByRole('menuitem', { name: 'Open reading view' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Edit entry' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Disable comments' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Delete entry' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('menuitem', { name: 'Disable comments' }))
    expect(onToggleCommentsDisabled).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
  })

  it('does not expose owner controls when their callbacks are absent', () => {
    renderCard({ onExpandOverlay: vi.fn() })

    fireEvent.click(screen.getByRole('button', { name: 'More entry actions' }))

    expect(screen.getByRole('menuitem', { name: 'Open reading view' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Edit entry' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Disable comments' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Delete entry' })).not.toBeInTheDocument()
  })

  it('offers to enable comments when they are currently disabled', () => {
    renderCard({ commentsDisabled: true, onToggleCommentsDisabled: vi.fn() })

    fireEvent.click(screen.getByRole('button', { name: 'More entry actions' }))

    expect(screen.getByRole('menuitem', { name: 'Enable comments' })).toBeInTheDocument()
  })
})
