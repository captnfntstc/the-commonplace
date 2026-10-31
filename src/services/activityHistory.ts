import type { RecentSearchItem } from '../components/Search/PrimarySearch'

export interface ReadingHistoryItem {
  id: string
  title: string
  creator?: string
  type?: string
  coverUrl?: string
  openedAt: string
}

export interface VisitedProfileItem {
  handle: string
  name?: string
  avatarUrl?: string
  visitedAt: string
}

export const READING_HISTORY_STORAGE_KEY = 'the_commonplace_reading_history_v1'
export const VISITED_PROFILES_STORAGE_KEY = 'the_commonplace_visited_profiles_v1'
const MAX_HISTORY_ITEMS = 30

/**
 * Records an entry into the local reading/preview history when opened into reading view.
 */
export function recordReadingHistory(entry: {
  id: string
  title: string
  creator?: string
  type?: string
  coverUrl?: string
}): void {
  if (typeof window === 'undefined' || !entry?.id) return
  try {
    const raw = window.localStorage.getItem(READING_HISTORY_STORAGE_KEY)
    const existing: ReadingHistoryItem[] = raw ? JSON.parse(raw) : []
    const filtered = existing.filter((item) => item.id !== entry.id)
    const nextItem: ReadingHistoryItem = {
      id: entry.id,
      title: entry.title || 'Untitled Entry',
      creator: entry.creator,
      type: entry.type || 'entry',
      coverUrl: entry.coverUrl,
      openedAt: new Date().toISOString(),
    }
    const updated = [nextItem, ...filtered].slice(0, MAX_HISTORY_ITEMS)
    window.localStorage.setItem(READING_HISTORY_STORAGE_KEY, JSON.stringify(updated))
  } catch (error) {
    console.error('Failed to record reading history', error)
  }
}

/**
 * Retrieves the user's reading/preview history.
 */
export function getReadingHistory(): ReadingHistoryItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(READING_HISTORY_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ReadingHistoryItem[]) : []
  } catch {
    return []
  }
}

/**
 * Clears the user's reading/preview history.
 */
export function clearReadingHistory(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(READING_HISTORY_STORAGE_KEY)
  } catch {
    // Ignore storage errors
  }
}

/**
 * Records a visited profile into the user's local history.
 */
export function recordVisitedProfile(profile: {
  handle: string
  name?: string
  avatarUrl?: string
}): void {
  if (typeof window === 'undefined' || !profile?.handle) return
  const cleanHandle = profile.handle.trim().replace(/^@/, '').toLowerCase()
  if (!cleanHandle) return

  try {
    const raw = window.localStorage.getItem(VISITED_PROFILES_STORAGE_KEY)
    const existing: VisitedProfileItem[] = raw ? JSON.parse(raw) : []
    const filtered = existing.filter((item) => item.handle.toLowerCase() !== cleanHandle)
    const nextItem: VisitedProfileItem = {
      handle: cleanHandle,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      visitedAt: new Date().toISOString(),
    }
    const updated = [nextItem, ...filtered].slice(0, MAX_HISTORY_ITEMS)
    window.localStorage.setItem(VISITED_PROFILES_STORAGE_KEY, JSON.stringify(updated))
  } catch (error) {
    console.error('Failed to record visited profile', error)
  }
}

/**
 * Retrieves the user's visited profiles history.
 */
export function getVisitedProfiles(): VisitedProfileItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(VISITED_PROFILES_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as VisitedProfileItem[]) : []
  } catch {
    return []
  }
}

/**
 * Clears the user's visited profiles history.
 */
export function clearVisitedProfiles(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(VISITED_PROFILES_STORAGE_KEY)
  } catch {
    // Ignore storage errors
  }
}

/**
 * Retrieves recent searches stored in the search tab (media and user searches).
 * If the user deleted searches in the search tab, they are excluded.
 */
export function getRecentSearches(storageScope?: string): RecentSearchItem[] {
  if (typeof window === 'undefined') return []
  try {
    const mediaKey = storageScope
      ? `the_commonplace_recent_media_searches_v4:${storageScope}`
      : 'the_commonplace_recent_media_searches_v4'
    const userKey = storageScope
      ? `the_commonplace_recent_user_searches_v3:${storageScope}`
      : 'the_commonplace_recent_user_searches_v3'

    const mediaRaw = window.localStorage.getItem(mediaKey)
    const userRaw = window.localStorage.getItem(userKey)

    const mediaItems: RecentSearchItem[] = mediaRaw ? JSON.parse(mediaRaw) : []
    const userItems: RecentSearchItem[] = userRaw ? JSON.parse(userRaw) : []

    // Combine and deduplicate by id
    const seen = new Set<string>()
    const combined: RecentSearchItem[] = []

    for (const item of [...mediaItems, ...userItems]) {
      if (item && item.id && !seen.has(item.id)) {
        seen.add(item.id)
        combined.push(item)
      }
    }

    return combined.slice(0, 16)
  } catch {
    return []
  }
}
