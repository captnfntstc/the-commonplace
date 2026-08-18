import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearMetadataCache, fetchItunesAlbumVersionFamily, fetchItunesSongAppearances } from './metadata'

const cleanTrack = {
  wrapperType: 'track',
  kind: 'song',
  trackId: 940001,
  trackName: 'Versioned Song',
  artistName: 'Appearance Artist',
  collectionId: 940010,
  collectionName: 'Clean Album Edition',
  releaseDate: '2025-01-01T00:00:00Z',
  trackCount: 10,
  trackExplicitness: 'notExplicit',
  collectionExplicitness: 'notExplicit',
}

const explicitTrack = {
  ...cleanTrack,
  trackId: 940002,
  collectionId: 940020,
  collectionName: 'Explicit Album Edition',
  trackExplicitness: 'explicit',
  collectionExplicitness: 'explicit',
}

describe('song appearance advisory filtering', () => {
  beforeEach(() => {
    clearMetadataCache()
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/lookup?id=940001')) {
        return { ok: true, json: async () => ({ results: [cleanTrack] }) } as Response
      }
      if (url.includes('/search?') && url.includes('entity=song')) {
        return { ok: true, json: async () => ({ results: [explicitTrack, cleanTrack] }) } as Response
      }
      throw new Error(`Unexpected request: ${url}`)
    }))
  })

  afterEach(() => vi.unstubAllGlobals())

  it('shows only albums containing the clean track from a clean profile', async () => {
    const appearances = await fetchItunesSongAppearances(
      'Versioned Song',
      'Appearance Artist',
      '940001',
      undefined,
      false,
    )

    expect(appearances.map((item) => item.title)).toEqual(['Clean Album Edition'])
    expect(appearances[0]?.explicit).toBe(false)
  })

  it('shows only albums containing the explicit track from an explicit profile', async () => {
    const appearances = await fetchItunesSongAppearances(
      'Versioned Song',
      'Appearance Artist',
      '940001',
      undefined,
      true,
    )

    expect(appearances.map((item) => item.title)).toEqual(['Explicit Album Edition'])
    expect(appearances[0]?.explicit).toBe(true)
  })

  it('does not cap valid appearances at four collections', async () => {
    const cleanAppearances = Array.from({ length: 6 }, (_, index) => ({
      ...cleanTrack,
      trackId: 941001 + index,
      collectionId: 941010 + index,
      collectionName: `Version Album ${index + 1}`,
    }))
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/lookup?id=941001')) {
        return { ok: true, json: async () => ({ results: [cleanAppearances[0]] }) } as Response
      }
      if (url.includes('/search?') && url.includes('entity=song')) {
        return { ok: true, json: async () => ({ results: cleanAppearances }) } as Response
      }
      throw new Error(`Unexpected request: ${url}`)
    }))

    const appearances = await fetchItunesSongAppearances(
      'Versioned Song',
      'Appearance Artist',
      '941001',
      undefined,
      false,
    )

    expect(appearances).toHaveLength(6)
  })

  it('finds matching advisory tracks through album versions missing from song search', async () => {
    const artistId = 951000
    const coreNames = ['Versioned Song', ...Array.from({ length: 9 }, (_, index) => `Family Track ${index + 2}`)]
    const album = (collectionId: number, collectionName: string, explicit: boolean, trackCount: number) => ({
      wrapperType: 'collection',
      artistId,
      artistName: 'Appearance Artist',
      collectionId,
      collectionName,
      releaseDate: '2025-01-01T00:00:00Z',
      trackCount,
      collectionExplicitness: explicit ? 'explicit' : 'notExplicit',
    })
    const albumTracks = (
      collectionId: number,
      collectionName: string,
      explicit: boolean,
      names: string[],
    ) => names.map((trackName, index) => ({
      wrapperType: 'track',
      kind: 'song',
      artistId,
      artistName: 'Appearance Artist',
      collectionId,
      collectionName,
      trackId: collectionId * 100 + index,
      trackName,
      trackNumber: index + 1,
      trackCount: names.length,
      releaseDate: '2025-01-01T00:00:00Z',
      trackExplicitness: explicit && trackName === 'Versioned Song' ? 'explicit' : 'notExplicit',
      collectionExplicitness: explicit ? 'explicit' : 'notExplicit',
    }))
    const collections = [
      album(951010, 'Family Standard [Clean]', false, 10),
      album(951020, 'Family Standard (Deluxe) [Clean]', false, 12),
      album(951030, 'Family Standard (Deluxe)', true, 12),
    ]
    const lookups = new Map<number, object[]>([
      [951010, [collections[0], ...albumTracks(951010, collections[0].collectionName, false, coreNames)]],
      [951020, [collections[1], ...albumTracks(951020, collections[1].collectionName, false, [...coreNames, 'Clean Bonus 1', 'Clean Bonus 2'])]],
      [951030, [collections[2], ...albumTracks(951030, collections[2].collectionName, true, [...coreNames, 'Explicit Bonus 1', 'Explicit Bonus 2'])]],
    ])
    const exactTrack = {
      ...((lookups.get(951010) || [])[1] as Record<string, unknown>),
      trackId: 951001,
    }

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const lookupId = Number(url.match(/[?&]id=(\d+)/)?.[1] || 0)
      if (url.includes('/lookup?id=951001')) {
        return { ok: true, json: async () => ({ results: [exactTrack] }) } as Response
      }
      if (url.includes('entity=musicArtist')) {
        return { ok: true, json: async () => ({ results: [{ wrapperType: 'artist', artistId, artistName: 'Appearance Artist' }] }) } as Response
      }
      if (url.includes('/search?') && url.includes('entity=album')) {
        return { ok: true, json: async () => ({ results: collections }) } as Response
      }
      if (url.includes(`/lookup?id=${artistId}`) && url.includes('entity=album')) {
        return { ok: true, json: async () => ({ results: collections }) } as Response
      }
      if (lookupId && lookups.has(lookupId)) {
        return { ok: true, json: async () => ({ results: lookups.get(lookupId) }) } as Response
      }
      if (url.includes('/search?') && url.includes('entity=song')) {
        return { ok: true, json: async () => ({ results: [exactTrack] }) } as Response
      }
      throw new Error(`Unexpected request: ${url}`)
    }))

    const family = await fetchItunesAlbumVersionFamily({
      albumName: 'Family Standard [Clean]',
      artistName: 'Appearance Artist',
      year: '2025',
      collectionId: '951010',
      trackCount: 10,
    })
    expect(family?.collectionIds).toEqual(expect.arrayContaining(['951010', '951020', '951030']))

    const appearances = await fetchItunesSongAppearances(
      'Versioned Song',
      'Appearance Artist',
      '951001',
      undefined,
      false,
    )

    expect(appearances).toHaveLength(2)
    expect(appearances.map((item) => item.title)).toEqual(expect.arrayContaining([
      'Family Standard [Clean]',
      'Family Standard (Deluxe) [Clean]',
    ]))
  })
})
