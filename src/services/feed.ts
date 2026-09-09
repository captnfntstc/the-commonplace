import type { User } from 'firebase/auth'
import type { Entry, EntryType } from '../features/entries/model'

export type FeedCategory = EntryType | 'all'

export type FeedItem = Entry & {
  ownerId: string
  visibility: 'public' | 'mutual'
  engagement?: {
    likeCount: number
    commentCount: number
    isLiked: boolean
  }
}

export type FeedPage = {
  items: FeedItem[]
  nextCursor: string | null
  hasMore: boolean
}

export type FeedSignalAction = 'catalog' | 'save' | 'like' | 'open' | 'search_open'

export type FeedSignalSubject = {
  type: EntryType
  creator?: string
  genres?: string[]
}

export const personalizedHomeFeedEnabled = import.meta.env.VITE_PERSONALIZED_HOME_FEED === 'true'

async function authenticatedFetch(user: User, input: string, init: RequestInit = {}) {
  const token = await user.getIdToken()
  const response = await fetch(input, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  })
  const payload = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) throw new Error(payload.error || 'The personalized feed is temporarily unavailable.')
  return payload
}

export async function loadFeedPage(
  user: User,
  category: FeedCategory,
  cursor?: string | null,
): Promise<FeedPage> {
  const search = new URLSearchParams({ category })
  if (cursor) search.set('cursor', cursor)
  const payload = await authenticatedFetch(user, `/api/feed?${search}`) as FeedPage
  return {
    items: Array.isArray(payload.items) ? payload.items : [],
    nextCursor: typeof payload.nextCursor === 'string' ? payload.nextCursor : null,
    hasMore: payload.hasMore === true,
  }
}

function openSignalStorageKey(userId: string, entryId: string) {
  return `the-commonplace.feed-open.${userId}.${entryId}`
}

export function shouldRecordEntryOpen(userId: string, entryId: string, now = Date.now()) {
  const storageKey = openSignalStorageKey(userId, entryId)
  const previous = Number(localStorage.getItem(storageKey) || 0)
  if (previous > 0 && Number.isFinite(previous) && now - previous < 24 * 60 * 60 * 1000) return false
  localStorage.setItem(storageKey, String(now))
  return true
}

export async function recordFeedSignal(
  user: User,
  action: FeedSignalAction,
  subject: FeedSignalSubject,
  active?: boolean,
) {
  await authenticatedFetch(user, '/api/feed/signals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, active, subject }),
  })
}

export async function resetFeedPreferences(user: User) {
  await authenticatedFetch(user, '/api/feed/preferences', { method: 'DELETE' })
}

export function feedSignalSubject(entry: Pick<Entry, 'type' | 'creator' | 'genre'>): FeedSignalSubject {
  return {
    type: entry.type,
    creator: entry.creator,
    genres: entry.genre ? entry.genre.split(',').map((genre) => genre.trim()).filter(Boolean).slice(0, 3) : [],
  }
}
