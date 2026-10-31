import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearReadingHistory,
  clearVisitedProfiles,
  getReadingHistory,
  getRecentSearches,
  getVisitedProfiles,
  recordReadingHistory,
  recordVisitedProfile,
} from './activityHistory'

describe('activityHistory service', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  describe('reading view history', () => {
    it('records entries and deduplicates by entry ID', () => {
      recordReadingHistory({ id: 'entry-1', title: 'First Book', type: 'book' })
      recordReadingHistory({ id: 'entry-2', title: 'Second Movie', type: 'film' })
      recordReadingHistory({ id: 'entry-1', title: 'First Book (Updated)', type: 'book' })

      const history = getReadingHistory()
      expect(history).toHaveLength(2)
      expect(history[0].id).toBe('entry-1')
      expect(history[0].title).toBe('First Book (Updated)')
      expect(history[1].id).toBe('entry-2')
    })

    it('clears reading history', () => {
      recordReadingHistory({ id: 'entry-1', title: 'First Book', type: 'book' })
      expect(getReadingHistory()).toHaveLength(1)
      clearReadingHistory()
      expect(getReadingHistory()).toHaveLength(0)
    })
  })

  describe('visited profiles history', () => {
    it('records profiles and normalizes handles', () => {
      recordVisitedProfile({ handle: '@JaneDoe', name: 'Jane Doe' })
      recordVisitedProfile({ handle: 'JohnSmith', name: 'John Smith' })
      recordVisitedProfile({ handle: 'janedoe', name: 'Jane Doe' })

      const profiles = getVisitedProfiles()
      expect(profiles).toHaveLength(2)
      expect(profiles[0].handle).toBe('janedoe')
      expect(profiles[1].handle).toBe('johnsmith')
    })

    it('clears visited profiles', () => {
      recordVisitedProfile({ handle: '@curator' })
      expect(getVisitedProfiles()).toHaveLength(1)
      clearVisitedProfiles()
      expect(getVisitedProfiles()).toHaveLength(0)
    })
  })

  describe('recent searches', () => {
    it('loads recent searches from localStorage if present', () => {
      const mediaSearches = [{ id: 'search-1', name: 'Radiohead', type: 'query' }]
      const userSearches = [{ id: 'user-1', name: 'Alice', type: 'user', handle: 'alice' }]

      window.localStorage.setItem('the_commonplace_recent_media_searches_v4', JSON.stringify(mediaSearches))
      window.localStorage.setItem('the_commonplace_recent_user_searches_v3', JSON.stringify(userSearches))

      const combined = getRecentSearches()
      expect(combined).toHaveLength(2)
      expect(combined[0].name).toBe('Radiohead')
      expect(combined[1].name).toBe('Alice')
    })
  })
})
