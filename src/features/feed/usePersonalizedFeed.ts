import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { User } from 'firebase/auth'
import type { Entry } from '../entries/model'
import { subscribeMutualFollowIds } from '../../services/cloudData'
import {
  loadFeedPage,
  personalizedHomeFeedEnabled,
  type FeedCategory,
  type FeedItem,
} from '../../services/feed'

const REVEAL_SIZE = 20
const MUTUAL_ID_KEY_PREFIX = 'mutual-follow:'

type FeedBucket = {
  items: FeedItem[]
  visibleCount: number
  cursor: string | null
  hasMore: boolean
  loading: boolean
  initialized: boolean
  error: string
}

const emptyBucket = (): FeedBucket => ({
  items: [],
  visibleCount: 0,
  cursor: null,
  hasMore: true,
  loading: false,
  initialized: false,
  error: '',
})

function dedupe(items: FeedItem[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values())
}

export function usePersonalizedFeed(user: User | null, category: FeedCategory, ready: boolean) {
  const [buckets, setBuckets] = useState<Partial<Record<FeedCategory, FeedBucket>>>({})
  const bucketsRef = useRef(buckets)
  const requestKeys = useRef(new Set<string>())
  useEffect(() => { bucketsRef.current = buckets }, [buckets])

  const updateBucket = useCallback((target: FeedCategory, update: (current: FeedBucket) => FeedBucket) => {
    setBuckets((current) => ({
      ...current,
      [target]: update(current[target] || emptyBucket()),
    }))
  }, [])

  const fetchBucket = useCallback(async (target: FeedCategory, reset = false, revealAfterFetch = false) => {
    if (!user?.uid || !personalizedHomeFeedEnabled) return
    const current = bucketsRef.current[target] || emptyBucket()
    const cursor = reset ? null : current.cursor
    const requestKey = `${target}:${reset ? 'reset' : cursor || 'initial'}`
    if (requestKeys.current.has(requestKey) || (!reset && current.loading)) return
    requestKeys.current.add(requestKey)
    updateBucket(target, (bucket) => ({ ...bucket, loading: true, error: '', ...(reset ? { initialized: false } : {}) }))
    try {
      const page = await loadFeedPage(user, target, cursor)
      updateBucket(target, (bucket) => {
        const items = dedupe(reset ? page.items : [...bucket.items, ...page.items])
        return {
          ...bucket,
          items,
          visibleCount: reset
            ? Math.min(REVEAL_SIZE, items.length)
            : revealAfterFetch
              ? Math.min(items.length, bucket.visibleCount + REVEAL_SIZE)
              : Math.max(bucket.visibleCount, Math.min(REVEAL_SIZE, items.length)),
          cursor: page.nextCursor,
          hasMore: page.hasMore,
          loading: false,
          initialized: true,
          error: '',
        }
      })
    } catch (error) {
      updateBucket(target, (bucket) => ({
        ...bucket,
        loading: false,
        initialized: true,
        error: (error as Error)?.message || 'The personalized feed is temporarily unavailable.',
      }))
    } finally {
      requestKeys.current.delete(requestKey)
    }
  }, [updateBucket, user])

  useEffect(() => {
    if (!ready || !user?.uid || !personalizedHomeFeedEnabled) return
    const bucket = bucketsRef.current[category]
    if (!bucket?.initialized && !bucket?.loading) void fetchBucket(category)
  }, [category, fetchBucket, ready, user])

  useEffect(() => {
    if (!user?.uid) return
    return subscribeMutualFollowIds(user.uid, (mutualIds) => {
      Array.from(requestKeys.current).forEach((key) => {
        if (key.startsWith(MUTUAL_ID_KEY_PREFIX)) requestKeys.current.delete(key)
      })
      mutualIds.forEach((id) => requestKeys.current.add(`${MUTUAL_ID_KEY_PREFIX}${user.uid}:${id}`))
      const allowed = new Set(mutualIds)
      setBuckets((current) => Object.fromEntries(Object.entries(current).map(([key, bucket]) => [
        key,
        bucket ? { ...bucket, items: bucket.items.filter((item) => item.visibility !== 'mutual' || allowed.has(item.ownerId)) } : bucket,
      ])))
    })
  }, [user?.uid])

  const bucket = buckets[category] || emptyBucket()
  const activeMutualIdPrefix = user?.uid ? `${MUTUAL_ID_KEY_PREFIX}${user.uid}:` : ''
  const mutualFollowIds = activeMutualIdPrefix
    ? Array.from(requestKeys.current)
      .filter((key) => key.startsWith(activeMutualIdPrefix))
      .map((key) => key.slice(activeMutualIdPrefix.length))
    : []
  const visibleItems = useMemo(
    () => bucket.items.slice(0, bucket.visibleCount),
    [bucket.items, bucket.visibleCount],
  )

  const loadMore = useCallback(() => {
    const current = bucketsRef.current[category] || emptyBucket()
    if (current.visibleCount < current.items.length) {
      updateBucket(category, (value) => ({
        ...value,
        visibleCount: Math.min(value.items.length, value.visibleCount + REVEAL_SIZE),
      }))
      return
    }
    if (current.hasMore && !current.loading) void fetchBucket(category, false, true)
  }, [category, fetchBucket, updateBucket])

  const refresh = useCallback(
    () => fetchBucket(category, true),
    [category, fetchBucket],
  )

  useEffect(() => {
    if (!ready || bucket.loading || !bucket.initialized || !bucket.hasMore) return
    if (bucket.items.length - bucket.visibleCount < REVEAL_SIZE) void fetchBucket(category)
  }, [bucket.hasMore, bucket.initialized, bucket.items.length, bucket.loading, bucket.visibleCount, category, fetchBucket, ready])

  return {
    enabled: personalizedHomeFeedEnabled && Boolean(user?.uid),
    items: visibleItems as Entry[],
    loading: bucket.loading && !bucket.initialized,
    loadingMore: bucket.loading && bucket.initialized,
    error: bucket.error,
    hasMore: bucket.visibleCount < bucket.items.length || bucket.hasMore,
    loadMore,
    retry: () => void fetchBucket(category, bucket.items.length === 0),
    refresh,
    mutualFollowIds,
  }
}
