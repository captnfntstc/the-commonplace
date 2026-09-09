import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { emptyDraft } from '../model'
import { EntryComposer } from './EntryComposer'

describe('EntryComposer metadata dropdown', () => {
  it('does not leave an empty result popup after metadata has been selected', () => {
    const { container } = render(
      <EntryComposer
        entry={null}
        initialDraft={{
          ...emptyDraft,
          type: 'film',
          title: 'Total Recall',
          providerId: '861',
        }}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    )

    expect(container.querySelector('.metadata-dropdown')).toBeNull()
  })

  it('shows only the currently hovered type tooltip when another button remains focused', () => {
    render(
      <EntryComposer
        entry={null}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    )

    const albumsButton = screen.getByRole('button', { name: 'Albums' })
    const songsButton = screen.getByRole('button', { name: 'Songs' })
    fireEvent.focus(albumsButton)
    fireEvent.mouseEnter(songsButton)

    expect(albumsButton.querySelector('.type-icon-tooltip')).not.toHaveClass('is-visible')
    expect(albumsButton).not.toHaveFocus()
    expect(songsButton.querySelector('.type-icon-tooltip')).toHaveClass('is-visible')
  })

  it('keeps only the selected media type highlighted', () => {
    render(
      <EntryComposer
        entry={null}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    )

    const albumsButton = screen.getByRole('button', { name: 'Albums' })
    const songsButton = screen.getByRole('button', { name: 'Songs' })
    expect(albumsButton).toHaveClass('active')

    fireEvent.click(songsButton)

    expect(albumsButton).not.toHaveClass('active')
    expect(songsButton).toHaveClass('active')
    expect(screen.getByText('Select a song')).toBeInTheDocument()
  })
})
