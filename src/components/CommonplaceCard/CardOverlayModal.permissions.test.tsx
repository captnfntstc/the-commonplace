import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deletePostComment, submitContentReport } from '../../services/cloudData'
import { CardOverlayModal, type OverlayEntry } from './CardOverlayModal'

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    currentUser: {
      uid: 'current-user',
      displayName: 'Current Reader',
      email: 'reader@example.com',
    },
  }),
}))

vi.mock('../../services/cloudData', () => ({
  canUseCloudData: () => true,
  createPostComment: vi.fn(),
  createPostReply: vi.fn(),
  deletePostComment: vi.fn().mockResolvedValue(undefined),
  deletePostReply: vi.fn().mockResolvedValue(undefined),
  loadMutualFollowers: vi.fn().mockResolvedValue([]),
  loadPostComments: vi.fn(),
  togglePostCommentLike: vi.fn(),
  togglePostReplyLike: vi.fn(),
  submitContentReport: vi.fn().mockResolvedValue('report-1'),
}))

const ENTRY: OverlayEntry = {
  id: 'post-1',
  type: 'book',
  title: 'A Discussion',
  creator: 'A Writer',
  provider: 'test',
  providerId: 'book-1',
  rating: 4,
  favoritePassage: '',
  reflection: 'A reflection.',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  coverTone: 'gold',
  authorHandle: 'post_owner',
}

describe('CardOverlayModal comment permissions', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { loadPostComments } = await import('../../services/cloudData')
    vi.mocked(loadPostComments).mockResolvedValue([
      {
        id: 'own-comment',
        authorId: 'current-user',
        authorHandle: 'reader',
        author: 'Current Reader',
        initials: 'CR',
        text: 'My own comment',
        createdAt: '2026-09-06T00:00:00.000Z',
        replies: [],
      },
      {
        id: 'other-comment',
        authorId: 'other-user',
        authorHandle: 'other_reader',
        author: 'Other Reader',
        initials: 'OR',
        text: 'Another user comment',
        createdAt: '2026-09-07T00:00:00.000Z',
        replies: [],
      },
    ])
  })

  it('shows the report action for another user\'s reading view', () => {
    render(
      <CardOverlayModal
        entry={{ ...ENTRY, authorHandle: 'reader' }}
        currentUserHandle="reader"
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Report entry' })).toBeInTheDocument()
  })

  it('shows the reading-view edit action only when an owner handler is provided', () => {
    const onEdit = vi.fn()
    const { rerender } = render(
      <CardOverlayModal
        entry={{ ...ENTRY, ownerId: 'current-user', authorHandle: 'reader' }}
        currentUserHandle="reader"
        onClose={vi.fn()}
        onEdit={onEdit}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit entry' }))
    expect(onEdit).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'Report entry' })).not.toBeInTheDocument()
    const ownerActions = screen.getByLabelText('Entry actions')
    expect(ownerActions).toHaveClass('entry-reading-actions')
    expect(ownerActions.closest('.entry-reading-meta-row')).not.toBeNull()
    expect(ownerActions.closest('.entry-reading-art-column')).toBeNull()
    expect(ownerActions.querySelectorAll(':scope > button')).toHaveLength(3)

    rerender(
      <CardOverlayModal
        entry={ENTRY}
        currentUserHandle="reader"
        onClose={vi.fn()}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Edit entry' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Report entry' })).toBeInTheDocument()
  })

  it('shows delete only for the current user and hides another comment after reporting it', async () => {
    render(
      <CardOverlayModal
        entry={ENTRY}
        currentUserHandle="reader"
        onClose={vi.fn()}
      />,
    )

    const ownComment = (await screen.findByText('My own comment')).closest('.overlay-comment-item')
    const otherComment = screen.getByText('Another user comment').closest('.overlay-comment-item')
    expect(ownComment).not.toBeNull()
    expect(otherComment).not.toBeNull()
    expect(within(ownComment as HTMLElement).getByRole('button', { name: 'Delete comment' })).toBeInTheDocument()
    expect(within(ownComment as HTMLElement).queryByRole('button', { name: 'Report comment' })).not.toBeInTheDocument()
    expect(within(otherComment as HTMLElement).queryByRole('button', { name: 'Delete comment' })).not.toBeInTheDocument()

    fireEvent.click(within(otherComment as HTMLElement).getByRole('button', { name: 'Report comment' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Harassment or bullying' }))
    fireEvent.click(screen.getByRole('button', { name: 'Submit report' }))

    await waitFor(() => expect(submitContentReport).toHaveBeenCalledWith(
      'current-user',
      expect.objectContaining({
        targetType: 'comment',
        targetId: 'other-comment',
        postId: 'post-1',
      }),
    ))
    await waitFor(() => expect(screen.queryByText('Another user comment')).not.toBeInTheDocument())
    expect(screen.getByText('My own comment')).toBeInTheDocument()
  })

  it('asks for confirmation before deleting a comment', async () => {
    render(
      <CardOverlayModal
        entry={ENTRY}
        currentUserHandle="reader"
        onClose={vi.fn()}
      />,
    )

    const ownComment = (await screen.findByText('My own comment')).closest('.overlay-comment-item')
    fireEvent.click(within(ownComment as HTMLElement).getByRole('button', { name: 'Delete comment' }))

    const dialog = screen.getByRole('alertdialog', { name: 'Delete this comment?' })
    expect(within(dialog).getByText('This comment will be permanently removed from the discussion. This action cannot be undone.')).toBeInTheDocument()
    expect(within(dialog).queryByText('My own comment')).not.toBeInTheDocument()
    expect(deletePostComment).not.toHaveBeenCalled()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog', { name: 'Delete this comment?' })).not.toBeInTheDocument())
    expect(screen.getByText('My own comment')).toBeInTheDocument()

    const remainingComment = screen.getByText('My own comment').closest('.overlay-comment-item')
    fireEvent.click(within(remainingComment as HTMLElement).getByRole('button', { name: 'Delete comment' }))
    fireEvent.click(within(screen.getByRole('alertdialog', { name: 'Delete this comment?' })).getByRole('button', { name: 'Delete comment' }))

    await waitFor(() => expect(deletePostComment).toHaveBeenCalledWith('post-1', 'own-comment', 'current-user'))
    await waitFor(() => expect(screen.queryByText('My own comment')).not.toBeInTheDocument())
  })
})
