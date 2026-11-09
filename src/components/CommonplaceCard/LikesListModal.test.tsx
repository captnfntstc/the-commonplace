import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LikesListModal } from './LikesListModal'
import * as cloudData from '../../services/cloudData'

describe('LikesListModal', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <LikesListModal
        isOpen={false}
        onClose={vi.fn()}
        postId="post-1"
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('fetches and renders likers, allows search, and triggers onOpenProfile', async () => {
    const mockLikers = [
      { userId: 'u1', handle: 'taylorswift', name: 'Taylor Swift', avatarUrl: '' },
      { userId: 'u2', handle: 'jimboi', name: 'Jimboi', avatarUrl: '' },
      { userId: 'u3', handle: 'oliviarodrigo', name: 'Olivia Rodrigo', avatarUrl: '' },
      { userId: 'u4', handle: 'phoebe', name: 'Phoebe Bridgers', avatarUrl: '' },
    ]

    vi.spyOn(cloudData, 'fetchEntryLikers').mockResolvedValue(mockLikers)

    const onOpenProfile = vi.fn()
    const onClose = vi.fn()

    render(
      <LikesListModal
        isOpen={true}
        onClose={onClose}
        postId="post-1"
        entryTitle="you seem pretty sad for a girl so in love"
        likeCount={4}
        onOpenProfile={onOpenProfile}
        currentUserHandle="jimboi"
      />
    )

    expect(screen.getByText('Likes')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Taylor Swift')).toBeInTheDocument()
      expect(screen.getByText('Jimboi')).toBeInTheDocument()
      expect(screen.getByText('You')).toBeInTheDocument()
    })

    // Search filtering
    const searchInput = screen.getByPlaceholderText('Search likes…')
    fireEvent.change(searchInput, { target: { value: 'taylor' } })

    expect(screen.getByText('Taylor Swift')).toBeInTheDocument()
    expect(screen.queryByText('Olivia Rodrigo')).not.toBeInTheDocument()

    // Click profile
    fireEvent.click(screen.getByText('Taylor Swift'))
    expect(onClose).toHaveBeenCalled()
    expect(onOpenProfile).toHaveBeenCalledWith('taylorswift')
  })

  it('renders empty state when there are no likes', async () => {
    vi.spyOn(cloudData, 'fetchEntryLikers').mockResolvedValue([])

    render(
      <LikesListModal
        isOpen={true}
        onClose={vi.fn()}
        postId="post-empty"
        entryTitle="A Lonely Entry"
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/No likes yet on "A Lonely Entry"./i)).toBeInTheDocument()
    })
  })
})
