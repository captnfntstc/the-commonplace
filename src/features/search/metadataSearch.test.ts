import { describe, expect, it } from 'vitest'
import type { MetadataResult } from '../../metadata'
import { mergeMetadataSearchResults } from './metadataSearch'

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
})
