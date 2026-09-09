import { describe, expect, it } from 'vitest'
import type { MetadataResult } from '../../metadata'
import {
  COMMUNITY_SEARCH_RANKING_MIN_REVIEWS,
  mergeMetadataSearchResults,
  rankMetadataSearchResults,
} from './metadataSearch'

const game = (overrides: Partial<MetadataResult> = {}): MetadataResult => ({
  id: 'igdb:game:1',
  type: 'game',
  title: 'The Example Game',
  creator: 'Example Studio',
  provider: 'Adventure',
  providerId: '1',
  year: '2025',
  ...overrides,
})

const film = (id: string, overrides: Partial<MetadataResult> = {}): MetadataResult => ({
  id: `tmdb:film:${id}`,
  type: 'film',
  title: `Film ${id}`,
  creator: 'Director',
  provider: '2026',
  providerId: id,
  screenSearchRelevance: 3,
  ...overrides,
})

describe('metadata result merging', () => {
  it('deduplicates the same provider result', () => {
    expect(mergeMetadataSearchResults([game()], [game()])).toHaveLength(1)
  })

  it('preserves the artwork fallback flag across merged game results', () => {
    const results = mergeMetadataSearchResults(
      [game()],
      [game({ id: 'rawg:game:2', providerId: '2', title: 'Another Game', preferWikipediaArtwork: true })],
    )
    expect(results.every((result) => result.preferWikipediaArtwork)).toBe(true)
  })

  it('uses external ratings and popularity while community reviews are sparse', () => {
    const quieter = film('1', { externalRating: 7.2, externalRatingCount: 100, externalPopularity: 20 })
    const popular = film('2', { externalRating: 8.8, externalRatingCount: 10000, externalPopularity: 200 })

    expect(rankMetadataSearchResults([quieter, popular])).toEqual([popular, quieter])
  })

  it('fully switches a title to community ranking at the review threshold', () => {
    const externallyPopular = film('1', { externalRating: 9.8, externalRatingCount: 100000, externalPopularity: 500 })
    const communityFavorite = film('2', { externalRating: 5, externalRatingCount: 20, externalPopularity: 2 })
    const reviews = [externallyPopular, communityFavorite].flatMap((result) => (
      Array.from({ length: COMMUNITY_SEARCH_RANKING_MIN_REVIEWS }, (_, index) => ({
        id: `${result.id}-${index}`,
        ownerId: `reviewer-${result.id}-${index}`,
        type: result.type,
        title: result.title,
        providerId: result.providerId,
        rating: result === communityFavorite ? 5 : 1,
      }))
    ))

    expect(rankMetadataSearchResults([externallyPopular, communityFavorite], reviews))
      .toEqual([communityFavorite, externallyPopular])
  })
})
