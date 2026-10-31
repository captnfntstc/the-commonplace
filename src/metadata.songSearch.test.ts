import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearMetadataCache, searchMetadata } from './metadata'

describe('searchMetadata for songs', () => {
  beforeEach(() => clearMetadataCache())
  afterEach(() => vi.unstubAllGlobals())

  it('ranks Taylor Swift at #1 for "I Bet You Think About Me" and does not drop the cleaned track', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('itunes.apple.com/search')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            results: [
              {
                trackId: 1590368923,
                trackName: "I Bet You Think About Me (Taylor's Version) (From The Vault) [feat. Chris Stapleton]",
                artistName: 'Taylor Swift',
                collectionName: 'Red (Taylor’s Version) (+ A Message from Taylor)',
                trackExplicitness: 'cleaned',
                collectionExplicitness: 'cleaned',
                trackCount: 30,
                releaseDate: '2021-11-12T08:00:00Z',
              },
              {
                trackId: 1871601692,
                trackName: 'I Bet You Think About Me',
                artistName: 'Katie Rose',
                collectionName: 'Dear Baby - EP',
                trackExplicitness: 'notExplicit',
                trackCount: 4,
                releaseDate: '2022-01-01T08:00:00Z',
              },
              {
                trackId: 1596827189,
                trackName: 'I Bet You Think About Me',
                artistName: 'Minnz Piano',
                collectionName: 'Red: Piano Instrumentals',
                trackExplicitness: 'notExplicit',
                trackCount: 14,
                releaseDate: '2021-11-15T08:00:00Z',
              },
            ],
          }),
        } as Response
      }
      throw new Error(`Unexpected url: ${url}`)
    }))

    const results = await searchMetadata('song', 'I Bet You Think About Me')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].title).toContain('I Bet You Think About Me')
    expect(results[0].creator).toBe('Taylor Swift')
    expect(results[0].providerId).toBe('1590368923')
  })

  it('ranks artist songs over a track named after the artist when querying an artist name', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('itunes.apple.com/search')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            results: [
              {
                trackId: 1440935467,
                trackName: 'Shake It Off',
                artistName: 'Taylor Swift',
                collectionName: '1989',
                trackExplicitness: 'notExplicit',
                trackCount: 13,
                releaseDate: '2014-10-27T07:00:00Z',
              },
              {
                trackId: 1440935468,
                trackName: 'Cruel Summer',
                artistName: 'Taylor Swift',
                collectionName: 'Lover',
                trackExplicitness: 'notExplicit',
                trackCount: 18,
                releaseDate: '2019-08-23T07:00:00Z',
              },
              {
                trackId: 9999999,
                trackName: 'Taylor Swift',
                artistName: 'Walker Hayes',
                collectionName: 'New Money',
                trackExplicitness: 'notExplicit',
                trackCount: 8,
                releaseDate: '2023-01-01T08:00:00Z',
              },
            ],
          }),
        } as Response
      }
      throw new Error(`Unexpected url: ${url}`)
    }))

    const results = await searchMetadata('song', 'Taylor Swift')
    expect(results[0].creator).toBe('Taylor Swift')
    expect(results[1].creator).toBe('Taylor Swift')
    // Walker Hayes is not ranking above Taylor Swift's own songs
    const walkerIndex = results.findIndex((r) => r.creator === 'Walker Hayes')
    expect(walkerIndex).toBeGreaterThan(1)
  })

  it('demotes cover and karaoke tracks in favor of original artist tracks', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('itunes.apple.com/search')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            results: [
              {
                trackId: 2001,
                trackName: "TEXAS HOLD 'EM",
                artistName: 'KIDZ BOP Kids',
                collectionName: "TEXAS HOLD 'EM - EP",
                trackExplicitness: 'notExplicit',
                trackCount: 4,
                releaseDate: '2024-03-01T08:00:00Z',
              },
              {
                trackId: 2002,
                trackName: "TEXAS HOLD 'EM",
                artistName: 'Beyoncé',
                collectionName: 'COWBOY CARTER',
                trackExplicitness: 'cleaned',
                collectionExplicitness: 'cleaned',
                trackCount: 27,
                releaseDate: '2024-03-29T07:00:00Z',
              },
            ],
          }),
        } as Response
      }
      throw new Error(`Unexpected url: ${url}`)
    }))

    const results = await searchMetadata('song', 'TEXAS HOLD EM')
    expect(results[0].creator).toBe('Beyoncé')
    expect(results[0].providerId).toBe('2002')
  })

  it('ranks original tracks and artists even when the query has typos', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('itunes.apple.com/search')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            results: [
              {
                trackId: 1590368923,
                trackName: "I Bet You Think About Me (Taylor's Version) (From The Vault) [feat. Chris Stapleton]",
                artistName: 'Taylor Swift',
                collectionName: 'Red (Taylor’s Version) (+ A Message from Taylor)',
                trackExplicitness: 'cleaned',
                collectionExplicitness: 'cleaned',
                trackCount: 30,
                releaseDate: '2021-11-12T08:00:00Z',
              },
              {
                trackId: 1871601692,
                trackName: 'Bet You Still Think About Me',
                artistName: 'Blake Shelton',
                collectionName: 'If I’m Honest',
                trackExplicitness: 'notExplicit',
                trackCount: 15,
                releaseDate: '2016-05-20T07:00:00Z',
              },
            ],
          }),
        } as Response
      }
      throw new Error(`Unexpected url: ${url}`)
    }))

    const results = await searchMetadata('song', 'I Bet You Tink About Me')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].creator).toBe('Taylor Swift')
    expect(results[0].providerId).toBe('1590368923')
  })
})

