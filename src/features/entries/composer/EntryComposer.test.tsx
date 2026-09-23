import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { emptyDraft, type Entry } from '../model'
import { EntryComposer } from './EntryComposer'

describe('EntryComposer metadata dropdown', () => {
  it('allows selecting at most four lyric lines', () => {
    const onSave = vi.fn()
    render(
      <EntryComposer
        entry={null}
        initialDraft={{
          ...emptyDraft,
          type: 'song',
          title: 'A Song',
          creator: 'An Artist',
          providerId: 'song-id',
          rating: 5,
        }}
        initialLyrics={'Line one\nLine two\nLine three\nLine four\nLine five'}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    )

    ;['Line one', 'Line two', 'Line three', 'Line four'].forEach((line) => {
      fireEvent.click(screen.getByRole('button', { name: line }))
    })

    expect(screen.getByText('4 / 4 lines')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Line five' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      favoritePassage: 'Line one\nLine two\nLine three\nLine four',
    }))
  })

  it('limits notable lines to 250 visible characters', () => {
    const onSave = vi.fn()
    const { container } = render(
      <EntryComposer
        entry={null}
        initialDraft={{
          ...emptyDraft,
          type: 'album',
          title: 'An Album',
          creator: 'An Artist',
          providerId: 'album-id',
          rating: 5,
        }}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Add favorite passage/i }))
    const editor = container.querySelector<HTMLDivElement>('.passage-container .rich-editor-content')!
    editor.innerHTML = 'a'.repeat(250)
    fireEvent.input(editor)
    expect(screen.getByText('250 / 250')).toBeInTheDocument()

    editor.innerHTML = 'a'.repeat(251)
    fireEvent.input(editor)
    expect(editor.textContent).toBe('a'.repeat(250))

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ favoritePassage: 'a'.repeat(250) }))
  })

  it('restores the full lyrics source when editing a published song', () => {
    const onSave = vi.fn()
    const entry: Entry = {
      id: 'song-entry',
      type: 'song',
      title: 'A Song',
      creator: 'An Artist',
      provider: 'An Album',
      providerId: 'song-id',
      rating: 5,
      lyrics: 'First lyric\nSecond lyric\nThird lyric',
      favoritePassage: 'Second lyric',
      reflection: 'A reflection.',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
      coverTone: 'violet',
    }

    render(
      <EntryComposer
        entry={entry}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    )

    expect(screen.getByRole('button', { name: 'First lyric' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Second lyric' })).toHaveClass('selected')

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      lyrics: entry.lyrics,
      favoritePassage: 'Second lyric',
    }))
  })

  it('persists the selected paragraph alignment with the published entry', () => {
    const originalExecCommand = document.execCommand
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn(() => true),
    })
    const onSave = vi.fn()

    render(
      <EntryComposer
        entry={null}
        initialDraft={{
          ...emptyDraft,
          title: 'Aligned reflection',
          providerId: 'manual-entry',
          rating: 4,
          reflection: 'This should stay justified.',
        }}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    )

    fireEvent.click(screen.getByTitle('Justify'))
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ reflectionAlign: 'justify' }))
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: originalExecCommand,
    })
  })

  it('uses a single New Entry heading when creating an entry', () => {
    render(
      <EntryComposer
        entry={null}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { name: 'New Entry' })).toBeInTheDocument()
    expect(screen.queryByText('New entry')).not.toBeInTheDocument()
    expect(screen.queryByText('New Margin')).not.toBeInTheDocument()
  })

  it('keeps comment management out of the entry form', () => {
    render(
      <EntryComposer
        entry={null}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    )

    expect(screen.queryByTitle(/comments disabled|disable comments/i)).not.toBeInTheDocument()
  })

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

  it('does not show discard confirmation after the form is restored to its opening state', async () => {
    const onClose = vi.fn()
    const { container } = render(
      <EntryComposer
        entry={null}
        onClose={onClose}
        onSave={vi.fn()}
        onSaveDraft={vi.fn()}
      />,
    )
    const searchInput = container.querySelector<HTMLInputElement>('.metadata-search-field input')!

    fireEvent.change(searchInput, { target: { value: 'Temporary search' } })
    expect(screen.queryByRole('button', { name: 'Save to Draft' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close modal' }))
    const discardDialog = screen.getByRole('alertdialog', { name: 'Discard Unsaved Changes?' })
    expect(within(discardDialog).getByRole('button', { name: 'Save to Draft' })).toBeInTheDocument()
    fireEvent.click(within(discardDialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog', { name: 'Discard Unsaved Changes?' })).not.toBeInTheDocument()
    })

    fireEvent.change(searchInput, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Close modal' }))

    expect(onClose).toHaveBeenCalledOnce()
    expect(screen.queryByRole('alertdialog', { name: 'Discard Unsaved Changes?' })).not.toBeInTheDocument()
  })

  it('saves partial work as a draft', () => {
    const onSaveDraft = vi.fn()
    const { container } = render(
      <EntryComposer
        entry={null}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onSaveDraft={onSaveDraft}
      />,
    )

    fireEvent.change(container.querySelector<HTMLInputElement>('.metadata-search-field input')!, {
      target: { value: 'Dune' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Close modal' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save to Draft' }))

    expect(onSaveDraft).toHaveBeenCalledWith(expect.objectContaining({ title: '' }), '', 'Dune', null)
  })

  it('shows drafts in place and returns to the unchanged New Entry form', () => {
    const { container } = render(
      <EntryComposer entry={null} onClose={vi.fn()} onSave={vi.fn()} />,
    )
    const searchInput = container.querySelector<HTMLInputElement>('.metadata-search-field input')!

    fireEvent.change(searchInput, { target: { value: 'Dune' } })
    fireEvent.click(screen.getByRole('button', { name: 'Open drafts' }))

    expect(screen.getByRole('heading', { name: 'Drafts' })).toBeInTheDocument()
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Back to New Entry' }))

    expect(screen.getByRole('heading', { name: 'New Entry' })).toBeInTheDocument()
    expect(searchInput).toHaveValue('Dune')
  })

  it('restores every saved field and can delete a draft from the picker', () => {
    const onDeleteDraft = vi.fn()
    const { container } = render(
      <EntryComposer
        entry={null}
        onClose={vi.fn()}
        onSave={vi.fn()}
        savedDrafts={[{
          id: 'draft-one',
          createdAt: '2026-09-20T01:00:00.000Z',
          updatedAt: '2026-09-20T02:00:00.000Z',
          metadataQuery: 'Dune',
          lyrics: '',
          draft: {
            ...emptyDraft,
            type: 'book',
            title: 'Dune',
            creator: 'Frank Herbert',
            providerId: 'dune-id',
            rating: 5,
            favoritePassage: 'Fear is the mind-killer.',
            reflection: 'A lasting thought.',
          },
        }]}
        draftsInitiallyOpen
        onDeleteDraft={onDeleteDraft}
      />,
    )

    fireEvent.click(container.querySelector<HTMLButtonElement>('.entry-draft-select')!)

    expect(container.querySelector<HTMLInputElement>('.metadata-search-field input')).toHaveValue('Dune')
    expect(screen.getByText(/Frank Herbert/)).toBeInTheDocument()
    expect(screen.getByText('Fear is the mind-killer.')).toBeInTheDocument()
    expect(screen.getByText('A lasting thought.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Open drafts' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete draft Dune' }))
    expect(onDeleteDraft).toHaveBeenCalledWith('draft-one')
  })
})
