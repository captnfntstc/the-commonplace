import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearMetadataCache,
  fetchItunesAlbumDetails,
  isExplicitItunesTrack,
} from './metadata'

describe('track-level explicit metadata', () => {
  beforeEach(() => clearMetadataCache())
  afterEach(() => vi.unstubAllGlobals())

  it('does not inherit an explicit badge from the containing album', () => {
    expect(isExplicitItunesTrack({
      trackExplicitness: 'notExplicit',
      contentAdvisoryRating: 'Clean',
    })).toBe(false)
    expect(isExplicitItunesTrack({ trackExplicitness: 'explicit' })).toBe(true)
  })

  it('keeps the album explicit while marking only individually explicit tracks', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (!url.includes('/lookup?id=930001')) throw new Error(`Unexpected request: ${url}`)
      return {
        ok: true,
        json: async () => ({
          results: [
            {
              wrapperType: 'collection',
              collectionId: 930001,
              collectionName: 'Mixed Advisory Album',
              artistName: 'Advisory Test Artist',
              releaseDate: '2025-01-01T00:00:00Z',
              collectionExplicitness: 'explicit',
            },
            {
              wrapperType: 'track',
              kind: 'song',
              collectionId: 930001,
              trackId: 930011,
              trackName: 'No Explicit Words',
              artistName: 'Advisory Test Artist',
              collectionName: 'Mixed Advisory Album',
              releaseDate: '2025-01-01T00:00:00Z',
              trackNumber: 1,
              trackExplicitness: 'notExplicit',
              collectionExplicitness: 'explicit',
            },
            {
              wrapperType: 'track',
              kind: 'song',
              collectionId: 930001,
              trackId: 930012,
              trackName: 'Actually Explicit',
              artistName: 'Advisory Test Artist',
              collectionName: 'Mixed Advisory Album',
              releaseDate: '2025-01-01T00:00:00Z',
              trackNumber: 2,
              trackExplicitness: 'explicit',
              collectionExplicitness: 'explicit',
            },
          ],
        }),
      } as Response
    }))

    const details = await fetchItunesAlbumDetails(
      'Mixed Advisory Album',
      'Advisory Test Artist',
      undefined,
      2,
      '930001',
      '2025',
    )

    expect(details?.explicit).toBe(true)
    expect(details?.tracks.map((track) => ({ title: track.title, explicit: track.explicit }))).toEqual([
      { title: 'No Explicit Words', explicit: false },
      { title: 'Actually Explicit', explicit: true },
    ])
  })
})
