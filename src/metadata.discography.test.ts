import { describe, expect, it, vi } from 'vitest'
import {
  classifyItunesDiscographyRelease,
  fetchItunesAlbumDetails,
  fetchItunesDiscography,
  preferExplicitAlbumEditions,
} from './metadata'

describe('iTunes discography release classification', () => {
  it('classifies four-track single bundles as singles', () => {
    expect(classifyItunesDiscographyRelease('Elizabeth Taylor', 4)).toBe('single')
    expect(classifyItunesDiscographyRelease('Example Song', 1)).toBe('single')
  })

  it('honors explicit EP and single catalog labels', () => {
    expect(classifyItunesDiscographyRelease('A Short Collection - EP', 4)).toBe('ep')
    expect(classifyItunesDiscographyRelease('Example Release - Single', 6)).toBe('single')
  })

  it('keeps medium-length releases with EPs and full-length releases with albums', () => {
    expect(classifyItunesDiscographyRelease('Untitled Release', 6)).toBe('ep')
    expect(classifyItunesDiscographyRelease('Studio Record', 12)).toBe('album')
  })

  it('does not guess that a release with missing track data is a single', () => {
    expect(classifyItunesDiscographyRelease('Unknown Release')).toBe('album')
  })

  it('collapses clean/explicit pairs to explicit while keeping named editions separate', () => {
    const releases = preferExplicitAlbumEditions([
      { id: 'album-1', title: 'GUTS', subtitle: '', artworkUrl: '', year: '2023', category: 'album', explicit: false },
      { id: 'album-2', title: 'GUTS (Explicit)', subtitle: '', artworkUrl: '', year: '2023', category: 'album', explicit: true },
      { id: 'album-3', title: 'GUTS (spilled)', subtitle: '', artworkUrl: '', year: '2024', category: 'album', explicit: true },
    ])

    expect(releases).toHaveLength(2)
    expect(releases).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'album-2', explicit: true }),
      expect.objectContaining({ id: 'album-3', title: 'GUTS (spilled)' }),
    ]))
  })

  it('fills the singles group from standalone song collections missing from the album response', async () => {
    const artistName = 'Discography Singles Test Artist'
    const artistId = 987654321
    const jsonResponse = (results: object[]) => ({
      ok: true,
      json: async () => ({ results }),
    }) as Response

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('entity=musicArtist')) {
        return jsonResponse([{ wrapperType: 'artist', artistId, artistName }])
      }
      if (url.includes('entity=album')) {
        return jsonResponse([{
          wrapperType: 'collection',
          artistId,
          artistName,
          collectionId: 1001,
          collectionName: 'The Full Album',
          trackCount: 11,
          releaseDate: '2025-01-10T00:00:00Z',
        }])
      }
      if (url.includes('entity=song')) {
        return jsonResponse([
          {
            wrapperType: 'track',
            kind: 'song',
            artistId,
            artistName,
            collectionId: 2001,
            collectionName: 'A Standalone Song - Single',
            trackCount: 1,
            releaseDate: '2026-02-14T00:00:00Z',
          },
          {
            wrapperType: 'track',
            kind: 'song',
            artistId,
            artistName,
            collectionId: 1001,
            collectionName: 'The Full Album',
            trackCount: 11,
            releaseDate: '2025-01-10T00:00:00Z',
          },
        ])
      }
      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const releases = await fetchItunesDiscography(artistName)

    expect(releases).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: 'The Full Album', category: 'album' }),
      expect.objectContaining({ title: 'A Standalone Song - Single', category: 'single' }),
    ]))
    expect(releases.filter((release) => release.category === 'single')).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('entity=song'),
      expect.any(Object),
    )
  })

  it('uses artist and year context when same-title albums have different covers', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/search?') && url.includes('entity=album')) {
        return {
          ok: true,
          json: async () => ({
            results: [
              {
                wrapperType: 'collection',
                collectionId: 111,
                collectionName: 'Home',
                artistName: 'Context Artist',
                releaseDate: '2018-01-01T00:00:00Z',
                trackCount: 10,
                artworkUrl100: 'https://example.com/wrong/100x100bb.jpg',
              },
              {
                wrapperType: 'collection',
                collectionId: 222,
                collectionName: 'Home',
                artistName: 'Context Artist',
                releaseDate: '2024-01-01T00:00:00Z',
                trackCount: 10,
                artworkUrl100: 'https://example.com/correct/100x100bb.jpg',
              },
            ],
          }),
        } as Response
      }
      if (url.includes('/lookup?id=222')) {
        return {
          ok: true,
          json: async () => ({
            results: [
              {
                wrapperType: 'collection',
                collectionId: 222,
                collectionName: 'Home',
                artistName: 'Context Artist',
                artworkUrl100: 'https://example.com/correct/100x100bb.jpg',
              },
              {
                wrapperType: 'track',
                kind: 'song',
                collectionId: 222,
                trackId: 333,
                trackName: 'Opening Track',
                artistName: 'Context Artist',
                releaseDate: '2024-01-01T00:00:00Z',
                trackNumber: 1,
                trackCount: 10,
              },
            ],
          }),
        } as Response
      }
      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const details = await fetchItunesAlbumDetails(
      'Home',
      'Context Artist',
      undefined,
      10,
      'non-itunes-provider-id',
      '2024',
    )

    expect(details).toMatchObject({
      title: 'Home',
      artist: 'Context Artist',
      year: '2024',
      coverUrl: 'https://example.com/correct/600x600bb.jpg',
    })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/lookup?id=222'),
      expect.any(Object),
    )
  })

  it('rejects a stale collection id and resolves artwork from title, artist, and year', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/lookup?id=999')) {
        return {
          ok: true,
          json: async () => ({
            results: [
              {
                wrapperType: 'collection',
                collectionId: 999,
                collectionName: 'The Largest Black Holes',
                artistName: 'Epic Mountain',
                releaseDate: '2024-01-01T00:00:00Z',
                artworkUrl100: 'https://example.com/black-holes/100x100bb.jpg',
              },
              {
                wrapperType: 'track',
                kind: 'song',
                collectionId: 999,
                trackName: 'A Science Soundtrack',
                artistName: 'Epic Mountain',
                releaseDate: '2024-01-01T00:00:00Z',
              },
            ],
          }),
        } as Response
      }
      if (url.includes('/search?') && url.includes('entity=album')) {
        return {
          ok: true,
          json: async () => ({
            results: [{
              wrapperType: 'collection',
              collectionId: 777,
              collectionName: 'Mountain Sounds - EP',
              artistName: 'John Vincent III',
              releaseDate: '2015-05-01T00:00:00Z',
              trackCount: 6,
              artworkUrl100: 'https://example.com/mountain-sounds/100x100bb.jpg',
            }],
          }),
        } as Response
      }
      if (url.includes('/lookup?id=777')) {
        return {
          ok: true,
          json: async () => ({
            results: [
              {
                wrapperType: 'collection',
                collectionId: 777,
                collectionName: 'Mountain Sounds - EP',
                artistName: 'John Vincent III',
                releaseDate: '2015-05-01T00:00:00Z',
                artworkUrl100: 'https://example.com/mountain-sounds/100x100bb.jpg',
              },
              {
                wrapperType: 'track',
                kind: 'song',
                collectionId: 777,
                trackId: 778,
                trackName: 'I Want You to See',
                artistName: 'John Vincent III',
                collectionName: 'Mountain Sounds - EP',
                releaseDate: '2015-05-01T00:00:00Z',
                trackNumber: 1,
                trackCount: 6,
              },
            ],
          }),
        } as Response
      }
      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const details = await fetchItunesAlbumDetails(
      'Mountain Sounds - EP',
      'John Vincent III',
      undefined,
      6,
      '999',
      '2015',
    )

    expect(details).toMatchObject({
      title: 'Mountain Sounds - EP',
      artist: 'John Vincent III',
      year: '2015',
      coverUrl: 'https://example.com/mountain-sounds/600x600bb.jpg',
    })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/lookup?id=999'),
      expect.any(Object),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/lookup?id=777'),
      expect.any(Object),
    )
  })
})
