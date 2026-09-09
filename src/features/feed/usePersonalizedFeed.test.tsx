import { act, renderHook, waitFor } from '@testing-library/react'
import type { User } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FeedCategory, FeedItem } from '../../services/feed'

const mocks = vi.hoisted(() => ({
  loadFeedPage: vi.fn(),
  subscribeMutualFollowIds: vi.fn(),
}))

vi.mock('../../services/feed', () => ({
  personalizedHomeFeedEnabled: true,
  loadFeedPage: mocks.loadFeedPage,
}))

vi.mock('../../services/cloudData', () => ({
  subscribeMutualFollowIds: mocks.subscribeMutualFollowIds,
}))

import { usePersonalizedFeed } from './usePersonalizedFeed'

const user = { uid: 'viewer' } as User
let mutualListener: (ids: string[]) => void = () => undefined

function item(index: number, category: FeedCategory = 'book', overrides: Partial<FeedItem> = {}) {
  return {
    id: `${category}-${index}`,
    ownerId: `author-${index}`,
    type: category === 'all' ? 'book' : category,
    title: `Entry ${index}`,
    authorHandle: `author${index}`,
    authorName: `Author ${index}`,
    createdAt: new Date(2026, 8, 7, 0, index).toISOString(),
    visibility: 'public',
    ...overrides,
  } as FeedItem
}

describe('usePersonalizedFeed', () => {
  beforeEach(() => {
    mocks.loadFeedPage.mockReset()
    mocks.subscribeMutualFollowIds.mockReset()
    mocks.subscribeMutualFollowIds.mockImplementation((_uid, onChange) => {
      mutualListener = onChange
      return () => undefined
    })
  })

  it('renders twenty of a forty-item candidate window, then reveals the queued twenty', async () => {
    mocks.loadFeedPage.mockResolvedValue({
      items: Array.from({ length: 40 }, (_, index) => item(index, 'all')),
      nextCursor: null,
      hasMore: false,
    })
    const { result } = renderHook(() => usePersonalizedFeed(user, 'all', true))

    await waitFor(() => expect(result.current.items).toHaveLength(20))
    act(() => result.current.loadMore())
    expect(result.current.items).toHaveLength(40)
    expect(mocks.loadFeedPage).toHaveBeenCalledTimes(1)
  })

  it('keeps separate cached results when switching category chips', async () => {
    mocks.loadFeedPage.mockImplementation((_user, category: FeedCategory) => Promise.resolve({
      items: Array.from({ length: 20 }, (_, index) => item(index, category)),
      nextCursor: null,
      hasMore: false,
    }))
    const { result, rerender } = renderHook(
      ({ category }) => usePersonalizedFeed(user, category, true),
      { initialProps: { category: 'all' as FeedCategory } },
    )

    await waitFor(() => expect(result.current.items[0]?.id).toBe('all-0'))
    rerender({ category: 'book' })
    await waitFor(() => expect(result.current.items[0]?.id).toBe('book-0'))
    rerender({ category: 'all' })
    expect(result.current.items[0]?.id).toBe('all-0')
    expect(mocks.loadFeedPage).toHaveBeenCalledTimes(2)
  })

  it('purges private cards immediately when the mutual relationship disappears', async () => {
    mocks.loadFeedPage.mockResolvedValue({
      items: [
        item(1, 'all', { ownerId: 'private-author', visibility: 'mutual' }),
        item(2, 'all'),
      ],
      nextCursor: null,
      hasMore: false,
    })
    const { result } = renderHook(() => usePersonalizedFeed(user, 'all', true))
    await waitFor(() => expect(result.current.items).toHaveLength(2))

    act(() => mutualListener([]))
    expect(result.current.items.map((entry) => entry.id)).toEqual(['all-2'])
  })
})
