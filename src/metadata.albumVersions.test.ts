import { describe, expect, it, vi } from 'vitest'
import {
  albumVersionBaseTitle,
  fetchItunesAlbumVersionFamily,
  preferAlbumSearchEditions,
  type MetadataResult,
} from './metadata'

const ARTIST = 'Version Family Test Artist'
const ARTIST_ID = 76543210

function collection(
  collectionId: number,
  collectionName: string,
  explicit: boolean,
  trackCount: number,
  year: string,
) {
  return {
    wrapperType: 'collection',
    artistId: ARTIST_ID,
    artistName: ARTIST,
    collectionId,
    collectionName,
    collectionExplicitness: explicit ? 'explicit' : 'notExplicit',
    trackCount,
    releaseDate: `${year}-01-01T00:00:00Z`,
    artworkUrl100: `https://example.com/${collectionId}/100x100bb.jpg`,
    primaryGenreName: 'Pop',
  }
}

function lookup(album: ReturnType<typeof collection>, trackNames: string[]) {
  return [
    album,
    ...trackNames.map((trackName, index) => ({
      wrapperType: 'track',
      kind: 'song',
      artistId: ARTIST_ID,
      artistName: ARTIST,
      collectionId: album.collectionId,
      collectionName: album.collectionName,
      trackId: album.collectionId * 100 + index,
      trackName,
      trackNumber: index + 1,
      trackCount: trackNames.length,
      releaseDate: album.releaseDate,
      trackExplicitness: album.collectionExplicitness,
      artworkUrl100: album.artworkUrl100,
    })),
  ]
}

describe('album version families', () => {
  it('normalizes well-known named edition markers', () => {
    expect(albumVersionBaseTitle('Midnights (The Til Dawn Edition)')).toBe('midnights')
    expect(albumVersionBaseTitle('Midnights (3am Edition)')).toBe('midnights')
    expect(albumVersionBaseTitle('GUTS (spilled)')).toBe('guts')
    expect(albumVersionBaseTitle('The Great Divide: The Last Of The Bugs')).toBe('the great divide')
  })

  it('discovers every edition bidirectionally, keeps clean as a separate entity, and rejects low track overlap', async () => {
    const coreTracks = Array.from({ length: 10 }, (_, index) => `Core Track ${index + 1}`)
    const albums = [
      collection(910001, 'Midnights', true, 10, '2022'),
      collection(910002, 'Midnights (Clean)', false, 10, '2022'),
      collection(910003, 'Midnights (3am Edition)', true, 13, '2022'),
      collection(910004, 'Midnights (The Til Dawn Edition)', true, 15, '2023'),
      collection(910005, 'Midnights (Deluxe Edition)', true, 10, '2022'),
    ]
    const lookups = new Map<number, object[]>([
      [910001, lookup(albums[0], coreTracks)],
      [910002, lookup(albums[1], coreTracks)],
      [910003, lookup(albums[2], [...coreTracks, 'Paris', 'High Infidelity', 'Glitch'])],
      [910004, lookup(albums[3], [...coreTracks, 'Hits Different', 'Snow on the Beach Remix', 'Karma Remix', 'Paris', 'Glitch'])],
      [910005, lookup(albums[4], ['Core Track 1', 'Core Track 2', ...Array.from({ length: 8 }, (_, index) => `Unrelated ${index}`)])],
    ])

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const lookupId = Number(url.match(/[?&]id=(\d+)/)?.[1] || 0)
      if (url.includes('entity=musicArtist')) {
        return { ok: true, json: async () => ({ results: [{ wrapperType: 'artist', artistId: ARTIST_ID, artistName: ARTIST }] }) } as Response
      }
      if (url.includes('/search?') && url.includes('entity=album')) {
        return { ok: true, json: async () => ({ results: albums }) } as Response
      }
      if (url.includes('/lookup?') && url.includes('entity=album')) {
        return { ok: true, json: async () => ({ results: albums }) } as Response
      }
      if (lookupId && lookups.has(lookupId)) {
        return { ok: true, json: async () => ({ results: lookups.get(lookupId) }) } as Response
      }
      throw new Error(`Unexpected request: ${url}`)
    }))

    const standard = await fetchItunesAlbumVersionFamily({
      albumName: 'Midnights', artistName: ARTIST, year: '2022', collectionId: '910001', trackCount: 10,
    })
    expect(standard).toMatchObject({
      currentCollectionId: '910001',
      canonicalCollectionId: '910001',
      currentExplicit: true,
    })
    expect(standard?.editions.map((item) => item.collectionId)).toEqual(['910002', '910003', '910004'])
    expect(standard?.editions.find((item) => item.collectionId === '910002')).toMatchObject({
      explicit: false,
      versionLabel: 'Clean Edition',
    })
    expect(standard?.collectionIds).not.toContain('910005')

    const tilDawn = await fetchItunesAlbumVersionFamily({
      albumName: 'Midnights (The Til Dawn Edition)', artistName: ARTIST, year: '2023', collectionId: '910004', trackCount: 15,
    })
    expect(tilDawn?.editions.map((item) => item.collectionId)).toEqual(expect.arrayContaining(['910001', '910003']))
    expect(tilDawn?.editions.map((item) => item.collectionId)).not.toContain('910004')

    const clean = await fetchItunesAlbumVersionFamily({
      albumName: 'Midnights (Clean)', artistName: ARTIST, year: '2022', collectionId: '910002', trackCount: 10,
    })
    expect(clean?.editions.map((item) => item.collectionId)).toEqual(expect.arrayContaining(['910001', '910003', '910004']))
    expect(clean?.editions.map((item) => item.collectionId)).not.toContain('910002')
  })

  it('forms a bidirectional GUTS and GUTS (spilled) family', async () => {
    const coreTracks = Array.from({ length: 12 }, (_, index) => `GUTS Track ${index + 1}`)
    const albums = [
      collection(920001, 'GUTS', true, 12, '2023'),
      collection(920002, 'GUTS (spilled)', true, 17, '2024'),
    ]
    const lookups = new Map<number, object[]>([
      [920001, lookup(albums[0], coreTracks)],
      [920002, lookup(albums[1], [...coreTracks, 'obsessed', 'scared of my guitar', 'stranger', 'girl ive always been', 'so american'])],
    ])

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const lookupId = Number(url.match(/[?&]id=(\d+)/)?.[1] || 0)
      if (url.includes('entity=musicArtist')) {
        return { ok: true, json: async () => ({ results: [{ wrapperType: 'artist', artistId: ARTIST_ID, artistName: ARTIST }] }) } as Response
      }
      if (url.includes('/search?') && url.includes('entity=album')) {
        return { ok: true, json: async () => ({ results: albums }) } as Response
      }
      if (url.includes('/lookup?') && url.includes('entity=album')) {
        return { ok: true, json: async () => ({ results: albums }) } as Response
      }
      if (lookupId && lookups.has(lookupId)) {
        return { ok: true, json: async () => ({ results: lookups.get(lookupId) }) } as Response
      }
      throw new Error(`Unexpected request: ${url}`)
    }))

    const guts = await fetchItunesAlbumVersionFamily({
      albumName: 'GUTS', artistName: ARTIST, year: '2023', collectionId: '920001', trackCount: 12,
    })
    const spilled = await fetchItunesAlbumVersionFamily({
      albumName: 'GUTS (spilled)', artistName: ARTIST, year: '2024', collectionId: '920002', trackCount: 17,
    })

    expect(guts?.editions.map((item) => item.collectionId)).toEqual(['920002'])
    expect(spilled?.editions.map((item) => item.collectionId)).toEqual(['920001'])
  })

  it('discovers differently named extensions and removes duplicate storefront copies sitewide', async () => {
    const coreTracks = Array.from({ length: 17 }, (_, index) => `Divide Track ${index + 1}`)
    const albums = [
      collection(930101, 'The Great Divide', true, 17, '2026'),
      collection(930102, 'The Great Divide', true, 17, '2026'),
      collection(930103, 'The Great Divide: The Last Of The Bugs', true, 21, '2026'),
    ]
    const lookups = new Map<number, object[]>([
      [930101, lookup(albums[0], coreTracks)],
      [930102, lookup(albums[1], coreTracks)],
      [930103, lookup(albums[2], [...coreTracks, 'Bug Bonus 1', 'Bug Bonus 2', 'Bug Bonus 3', 'Bug Bonus 4'])],
    ])

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const lookupId = Number(url.match(/[?&]id=(\d+)/)?.[1] || 0)
      if (url.includes('entity=musicArtist')) {
        return { ok: true, json: async () => ({ results: [{ wrapperType: 'artist', artistId: ARTIST_ID, artistName: ARTIST }] }) } as Response
      }
      if (url.includes('/search?') && url.includes('entity=album')) {
        return { ok: true, json: async () => ({ results: albums }) } as Response
      }
      if (url.includes('/lookup?') && url.includes('entity=album')) {
        return { ok: true, json: async () => ({ results: albums }) } as Response
      }
      if (lookupId && lookups.has(lookupId)) {
        return { ok: true, json: async () => ({ results: lookups.get(lookupId) }) } as Response
      }
      throw new Error(`Unexpected request: ${url}`)
    }))

    const standard = await fetchItunesAlbumVersionFamily({
      albumName: 'The Great Divide', artistName: ARTIST, year: '2026', collectionId: '930101', trackCount: 17,
    })
    expect(standard?.editions).toHaveLength(1)
    expect(standard?.editions[0]).toMatchObject({
      collectionId: '930103',
      title: 'The Great Divide: The Last Of The Bugs',
    })

    const extended = await fetchItunesAlbumVersionFamily({
      albumName: 'The Great Divide: The Last Of The Bugs', artistName: ARTIST, year: '2026', collectionId: '930103', trackCount: 21,
    })
    expect(extended?.editions).toHaveLength(1)
    expect(extended?.editions[0]?.title).toBe('The Great Divide')
  })
})

describe('explicit-first album search selection', () => {
  const result = (providerId: string, title: string, explicit: boolean): MetadataResult => ({
    id: `album-${providerId}`,
    type: 'album',
    title,
    creator: 'Taylor Swift',
    provider: 'Pop',
    providerId,
    explicit,
    year: '2022',
  })
  const results = [
    result('1', 'Midnights', false),
    result('2', 'Midnights', true),
    result('3', 'Midnights (3am Edition)', true),
    result('4', 'Midnights (The Til Dawn Edition)', true),
    result('5', 'Midnights (The Til Dawn Edition) [Clean]', false),
  ]

  it('keeps standard and named editions in broad search while collapsing clean copies', () => {
    expect(preferAlbumSearchEditions(results, 'Midnights')[0]).toMatchObject({ providerId: '2', explicit: true })
    expect(preferAlbumSearchEditions(results, 'Midnights').map((item) => item.providerId)).toEqual(['2', '3', '4'])
  })

  it('returns the requested named edition for an edition-specific query', () => {
    expect(preferAlbumSearchEditions(results, 'Midnights Til Dawn')[0]).toMatchObject({ providerId: '4' })
  })

  it('omits a clean-labelled edition when no explicit copy is returned', () => {
    expect(preferAlbumSearchEditions([
      result('6', 'Midnights (Clean Edition)', false),
    ], 'Midnights')).toEqual([])
  })
})
