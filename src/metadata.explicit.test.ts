import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearMetadataCache,
  fetchItunesAlbumDetails,
  isExplicitItunesTrack,
  preferExplicitSongSearchItems,
  searchMetadata,
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

  it('makes the explicit recording canonical and removes standalone clean edits from search', () => {
    const items = preferExplicitSongSearchItems([
      { trackId: 1, trackName: 'Long Song Title', artistName: 'Test Artist', trackExplicitness: 'cleaned' },
      { trackId: 2, trackName: 'Long Song Title', artistName: 'Test Artist & Guest', trackExplicitness: 'explicit' },
      { trackId: 3, trackName: 'Naturally Radio Safe', artistName: 'Test Artist', trackExplicitness: 'notExplicit' },
      { trackId: 4, trackName: 'Missing Original (Clean)', artistName: 'Test Artist', trackExplicitness: 'cleaned' },
    ])

    expect(items.map((item) => item.trackId)).toEqual([2, 3])
  })

  it('preserves mainstream recordings flagged cleaned by the provider when there is no explicit variant', () => {
    const items = preferExplicitSongSearchItems([
      {
        trackId: 101,
        trackName: "I Bet You Think About Me (Taylor's Version) (From The Vault) [feat. Chris Stapleton]",
        artistName: 'Taylor Swift',
        trackExplicitness: 'cleaned',
      },
      {
        trackId: 102,
        trackName: 'Dial Drunk',
        artistName: 'Noah Kahan',
        trackExplicitness: 'cleaned',
      },
    ])

    expect(items.map((item) => item.trackId)).toEqual([101, 102])
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

  it('marks songs clean even when their parent album is tagged explicit in song search', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (!url.includes('/search')) throw new Error(`Unexpected request: ${url}`)
      return {
        ok: true,
        json: async () => ({
          results: [
            {
              wrapperType: 'track',
              kind: 'song',
              trackId: 1729001,
              trackName: 'honeybee',
              artistName: 'Olivia Rodrigo',
              collectionName: 'GUTS (spilled)',
              releaseDate: '2024-03-22T00:00:00Z',
              trackExplicitness: 'notExplicit',
              collectionExplicitness: 'explicit',
            },
            {
              wrapperType: 'track',
              kind: 'song',
              trackId: 1729002,
              trackName: "22 (Taylor's Version)",
              artistName: 'Taylor Swift',
              collectionName: "Red (Taylor's Version)",
              releaseDate: '2021-11-12T00:00:00Z',
              trackExplicitness: 'notExplicit',
              collectionExplicitness: 'explicit',
            },
            {
              wrapperType: 'track',
              kind: 'song',
              trackId: 1729003,
              trackName: 'bad idea right?',
              artistName: 'Olivia Rodrigo',
              collectionName: 'GUTS (spilled)',
              releaseDate: '2023-08-11T00:00:00Z',
              trackExplicitness: 'explicit',
              collectionExplicitness: 'explicit',
            },
          ],
        }),
      } as Response
    }))

    const results = await searchMetadata('song', 'test query')
    const honeybee = results.find((r) => r.title === 'honeybee')
    const twentyTwo = results.find((r) => r.title === "22 (Taylor's Version)")
    const badIdea = results.find((r) => r.title === 'bad idea right?')

    expect(honeybee?.explicit).toBe(false)
    expect(twentyTwo?.explicit).toBe(false)
    expect(badIdea?.explicit).toBe(true)
  })

  it('preferExplicitSongSearchItems prefers track from standard album over clean album for clean track', () => {
    const rawCleanAlbumTrack = {
      wrapperType: 'track',
      kind: 'song',
      trackId: 101,
      trackName: 'honeybee',
      artistName: 'Olivia Rodrigo',
      collectionName: 'you seem pretty sad for a girl so in love',
      trackExplicitness: 'notExplicit',
      collectionExplicitness: 'cleaned',
    }
    const rawStandardAlbumTrack = {
      wrapperType: 'track',
      kind: 'song',
      trackId: 102,
      trackName: 'honeybee',
      artistName: 'Olivia Rodrigo',
      collectionName: 'you seem pretty sad for a girl so in love',
      trackExplicitness: 'notExplicit',
      collectionExplicitness: 'explicit',
    }

    const filtered = preferExplicitSongSearchItems([rawCleanAlbumTrack, rawStandardAlbumTrack])
    expect(filtered).toHaveLength(1)
    expect(filtered[0].trackId).toBe(102)
    expect(filtered[0].collectionExplicitness).toBe('explicit')
  })
})
