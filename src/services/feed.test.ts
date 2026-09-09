import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from 'firebase/auth'
import {
  feedSignalSubject,
  loadFeedPage,
  recordFeedSignal,
  shouldRecordEntryOpen,
} from './feed'

const user = {
  uid: 'viewer-1',
  getIdToken: vi.fn().mockResolvedValue('token-1'),
} as unknown as User

describe('personalized feed client', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('loads an authenticated category page with its cursor', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ items: [], nextCursor: 'next', hasMore: true }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(loadFeedPage(user, 'book', 'previous')).resolves.toEqual({
      items: [],
      nextCursor: 'next',
      hasMore: true,
    })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/feed?category=book&cursor=previous',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token-1' }) }),
    )
  })

  it('sends reversible preference signals without raw search text', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ recorded: true }) })
    vi.stubGlobal('fetch', fetchMock)
    await recordFeedSignal(user, 'save', { type: 'book', creator: 'Author', genres: ['Fantasy'] }, false)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      action: 'save',
      active: false,
      subject: { type: 'book', creator: 'Author', genres: ['Fantasy'] },
    })
  })

  it('deduplicates entry-open signals for twenty-four hours per account', () => {
    expect(shouldRecordEntryOpen('viewer-1', 'entry-1', 1_000_000)).toBe(true)
    expect(shouldRecordEntryOpen('viewer-1', 'entry-1', 1_000_001)).toBe(false)
    expect(shouldRecordEntryOpen('viewer-2', 'entry-1', 1_000_001)).toBe(true)
    expect(shouldRecordEntryOpen('viewer-1', 'entry-1', 1_000_000 + 86_400_000)).toBe(true)
  })

  it('normalizes entry metadata into a bounded signal subject', () => {
    expect(feedSignalSubject({ type: 'book', creator: 'Author', genre: 'Fantasy, Classics, Epic, Extra' })).toEqual({
      type: 'book',
      creator: 'Author',
      genres: ['Fantasy', 'Classics', 'Epic'],
    })
  })
})
