import { beforeEach, describe, expect, it } from 'vitest'
import {
  addItemToProfileCollection,
  buildPopularCollectionRecommendations,
  collectionsCreatedByProfile,
  createProfileCollection,
  loadProfileCollections,
  loadSavedProfileCollections,
  saveProfileCollections,
  saveSavedProfileCollections,
  profileCollectionItemFromEntry,
  profileCollectionItemIdentity,
} from './profileCollections'
import type { Entry } from '../entries/model'

const entry: Entry = {
  id: 'entry-1',
  type: 'book',
  title: 'The Left Hand of Darkness',
  creator: 'Ursula K. Le Guin',
  provider: 'test',
  providerId: 'book-1',
  rating: 5,
  favoritePassage: '',
  reflection: '',
  createdAt: '2026-08-29T00:00:00.000Z',
  updatedAt: '2026-08-29T00:00:00.000Z',
  coverTone: 'gold',
}

describe('profile collections', () => {
  beforeEach(() => localStorage.clear())

  it('keeps created and saved collections in separate account stores', () => {
    const collection = createProfileCollection('Mina\'s Highlights', ['book'], {
      creatorName: 'Mina Reyes',
      creatorHandle: 'minareads',
      items: [profileCollectionItemFromEntry(entry)],
    })

    saveProfileCollections('minareads', [collection])
    saveSavedProfileCollections('jimboii', [collection])

    expect(loadProfileCollections('minareads')).toEqual([collection])
    expect(loadSavedProfileCollections('jimboii')).toEqual([collection])
    expect(loadSavedProfileCollections('minareads')).toEqual([])
  })

  it('keeps only collections created by the profile in Created Collections', () => {
    const owned = createProfileCollection('Jimmy favorites', ['book'], {
      creatorHandle: '@jimboii',
    })
    const savedFromAnotherProfile = createProfileCollection('Mina favorites', ['book'], {
      creatorHandle: 'minareads',
    })
    const legacyOwned = createProfileCollection('Older collection', ['book'])

    expect(collectionsCreatedByProfile(
      [owned, savedFromAnotherProfile, legacyOwned],
      'JIMBOII',
    )).toEqual([owned, legacyOwned])
  })

  it('deduplicates popular recommendations across reviews and provider IDs', () => {
    const duplicate = {
      ...entry,
      id: 'entry-2',
      providerId: 'another-provider-id',
    }
    const other = {
      ...entry,
      id: 'entry-3',
      title: 'Kindred',
      creator: 'Octavia E. Butler',
    }

    const recommendations = buildPopularCollectionRecommendations([entry, duplicate, other], () => 0.5)

    expect(recommendations).toHaveLength(2)
    expect(new Set(recommendations.map(profileCollectionItemIdentity)).size).toBe(2)
  })

  it('uses community demand as the weight for the randomized order', () => {
    const popularReviews = Array.from({ length: 3 }, (_, index) => ({
      ...entry,
      id: `popular-${index}`,
      providerId: `popular-provider-${index}`,
    }))
    const lessPopular = {
      ...entry,
      id: 'less-popular',
      title: 'Kindred',
      creator: 'Octavia E. Butler',
      rating: 0,
    }
    const draws = [0.25, 0.5]

    const recommendations = buildPopularCollectionRecommendations(
      [...popularReviews, lessPopular],
      () => draws.shift() ?? 0.5,
    )

    expect(recommendations[0].title).toBe(entry.title)
  })

  it('keeps the default recommendation grid in complete two-item rows', () => {
    const recommendations = buildPopularCollectionRecommendations([
      entry,
      { ...entry, id: 'entry-2', title: 'Kindred', creator: 'Octavia E. Butler' },
      { ...entry, id: 'entry-3', title: 'Beloved', creator: 'Toni Morrison' },
    ], () => 0.5)

    expect(recommendations).toHaveLength(2)
  })

  it('limits default suggestions to ten rows across two columns', () => {
    const entries = Array.from({ length: 24 }, (_, index) => ({
      ...entry,
      id: `entry-${index}`,
      title: `Book ${index}`,
      providerId: `book-${index}`,
    }))

    expect(buildPopularCollectionRecommendations(entries, () => 0.5)).toHaveLength(20)
  })

  it('only adds an existing item again after explicit duplicate confirmation', () => {
    const item = profileCollectionItemFromEntry(entry)
    const collection = createProfileCollection('Favorites', [entry.type], { items: [item] })

    expect(addItemToProfileCollection(collection, item).items).toHaveLength(1)

    const withDuplicate = addItemToProfileCollection(collection, item, { allowDuplicate: true })
    expect(withDuplicate.items).toHaveLength(2)
    expect(withDuplicate.items?.[0].id).not.toBe(withDuplicate.items?.[1].id)
  })
})
