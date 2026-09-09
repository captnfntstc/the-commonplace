import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Entry } from '../features/entries/model'
import { loadPostComments } from '../services/cloudData'
import { ActivityPage } from './ActivityPage'

vi.mock('../services/cloudData', async () => {
  const actual = await vi.importActual<typeof import('../services/cloudData')>('../services/cloudData')
  return {
    ...actual,
    loadPostComments: vi.fn(),
    loadPostEntry: vi.fn(),
  }
})

const ENTRY: Entry = {
  id: 'entry-1',
  ownerId: 'author-1',
  type: 'book',
  title: 'A Real Entry',
  creator: 'A Writer',
  provider: 'test',
  providerId: 'book-1',
  rating: 5,
  favoritePassage: '',
  reflection: '',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  coverTone: 'gold',
}

function renderActivity(onOpenEntry = vi.fn()) {
  render(
    <ActivityPage
      entries={[]}
      availableEntries={[ENTRY]}
      engagements={{ 'entry-1': { likeCount: 1, commentCount: 1, isLiked: true } }}
      likedEntryIds={['entry-1']}
      likedCount={1}
      savedCount={0}
      followingCount={0}
      currentUserId="viewer-1"
      currentUserHandle="reader"
      onOpenEntry={onOpenEntry}
    />,
  )
  return onOpenEntry
}

describe('ActivityPage', () => {
  beforeEach(() => {
    vi.mocked(loadPostComments).mockResolvedValue([{
      id: 'comment-1',
      authorId: 'viewer-1',
      authorHandle: 'reader',
      author: 'Reader',
      initials: 'R',
      text: 'A comment that should appear in activity.',
      createdAt: '2026-09-07T00:00:00.000Z',
      replies: [],
    }])
  })

  it('shows real liked entries and opens the selected entry', async () => {
    const onOpenEntry = renderActivity()

    fireEvent.click(screen.getByRole('button', { name: /View My Liked Entries/ }))
    fireEvent.click(await screen.findByRole('button', { name: /A Real Entry/ }))

    expect(onOpenEntry).toHaveBeenCalledWith(ENTRY)
  })

  it('shows authored comments and opens the focused discussion', async () => {
    const onOpenEntry = renderActivity()

    fireEvent.click(screen.getByRole('button', { name: /View My Comments History/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Comment on A Real Entry/ }))

    expect(onOpenEntry).toHaveBeenCalledWith(ENTRY, {
      commentId: 'comment-1',
      replyId: undefined,
    })
  })
})
