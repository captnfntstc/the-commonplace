import { describe, expect, it } from 'vitest'
import {
  getCollectionSuggestions,
  TRENDING_COLLECTION_MEDIA,
} from './collectionSuggestions'
import type { ProfileCollectionItem } from './profileCollections'

describe('collectionSuggestions', () => {
  it('contains at least 10 items for every one of the 6 media categories in the curated catalog', () => {
    const categories = ['book', 'film', 'tv', 'album', 'song', 'game'] as const
    for (const cat of categories) {
      const items = TRENDING_COLLECTION_MEDIA.filter((item) => item.type === cat)
      expect(items.length).toBeGreaterThanOrEqual(10)
    }
  })

  it('suggests exactly 8 items when "all" is selected, with at least one item from EVERY category', () => {
    const suggestions = getCollectionSuggestions([], 'all')
    expect(suggestions).toHaveLength(8)

    const categoriesFound = new Set(suggestions.map((item) => item.type))
    const requiredCategories = ['book', 'film', 'tv', 'album', 'song', 'game']
    for (const cat of requiredCategories) {
      expect(categoriesFound.has(cat as any)).toBe(true)
    }
  })

  it('suggests exactly 8 items when a specific category is selected', () => {
    const categories = ['book', 'film', 'tv', 'album', 'song', 'game'] as const
    for (const cat of categories) {
      const suggestions = getCollectionSuggestions([], cat)
      expect(suggestions).toHaveLength(8)
      expect(suggestions.every((item) => item.type === cat)).toBe(true)
    }
  })

  it('excludes items that are already in the collection', () => {
    const existing: ProfileCollectionItem[] = [
      {
        id: 'existing-1',
        type: 'album',
        title: 'Punisher',
        creator: 'Phoebe Bridgers',
        provider: 'Apple Music',
        providerId: '1504699857',
      },
    ]

    const suggestions = getCollectionSuggestions(existing, 'album')
    expect(suggestions).toHaveLength(8)
    expect(suggestions.some((item) => item.title === 'Punisher')).toBe(false)
  })

  it('prioritizes works by the same creator or related creators based on collection contents', () => {
    const existing: ProfileCollectionItem[] = [
      {
        id: 'existing-phoebe',
        type: 'album',
        title: 'Stranger in the Alps',
        creator: 'Phoebe Bridgers',
        provider: 'Apple Music',
        providerId: 'sample',
      },
    ]

    const suggestions = getCollectionSuggestions(existing, 'all')
    expect(suggestions).toHaveLength(8)

    // Should prioritize Phoebe Bridgers songs/works or boygenius/Lorde related works near top
    const topCreators = suggestions.slice(0, 3).map((item) => item.creator.toLowerCase())
    const hasPhoebeOrAffinity = topCreators.some(
      (creator) => creator.includes('phoebe bridgers') || creator.includes('boygenius') || creator.includes('lorde'),
    )
    expect(hasPhoebeOrAffinity).toBe(true)

    // Must still contain at least one of every category
    const categoriesFound = new Set(suggestions.map((item) => item.type))
    const requiredCategories = ['book', 'film', 'tv', 'album', 'song', 'game']
    for (const cat of requiredCategories) {
      expect(categoriesFound.has(cat as any)).toBe(true)
    }
  })

  it('prioritizes cross-media counterparts (e.g. Dune book to Dune movie)', () => {
    const existing: ProfileCollectionItem[] = [
      {
        id: 'existing-dune-book',
        type: 'book',
        title: 'Dune',
        creator: 'Frank Herbert',
        provider: 'Open Library',
        providerId: 'OL893415W',
      },
    ]

    const filmSuggestions = getCollectionSuggestions(existing, 'film')
    expect(filmSuggestions).toHaveLength(8)
    // Dune: Part Two should be ranked at the top of film suggestions
    expect(filmSuggestions[0].title).toBe('Dune: Part Two')
  })
})
