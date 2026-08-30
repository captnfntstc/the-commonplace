import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearMetadataCache,
  fetchRelatedAlbums,
  isDerivativeRelatedAlbum,
  isSameAlbumVersionTitle,
  isVerifiedPeerAlbumCandidate,
} from './metadata'

afterEach(() => {
  vi.unstubAllGlobals()
  clearMetadataCache()
})

describe('related album filtering', () => {
  it('rejects tribute, karaoke, lullaby, string-quartet, and cover releases', () => {
    expect(isDerivativeRelatedAlbum('A Tribute to the Artist', 'Various Artists')).toBe(true)
    expect(isDerivativeRelatedAlbum('Greatest Karaoke Hits', 'Sing-Along Crew')).toBe(true)
    expect(isDerivativeRelatedAlbum('Lullaby Versions of Billie Eilish', 'Bedtime Baby')).toBe(true)
    expect(isDerivativeRelatedAlbum('Songs of Billie Eilish', 'Midnite String Quartet')).toBe(true)
    expect(isDerivativeRelatedAlbum('Piano Covers of Lover', 'Quiet Keys')).toBe(true)
    expect(isDerivativeRelatedAlbum('Orchestral Versions of SOUR', 'Pop Symphony')).toBe(true)
    expect(isDerivativeRelatedAlbum('Melodrama', 'Lorde')).toBe(false)
  })

  it('accepts only full albums from the exact verified peer artist', () => {
    const peerAlbum = {
      collectionId: 123,
      collectionType: 'Album',
      collectionName: 'Melodrama',
      artistId: 456,
      artistName: 'Lorde',
      trackCount: 11,
      primaryGenreName: 'Pop',
    }

    expect(isVerifiedPeerAlbumCandidate(peerAlbum, 'Lorde', 456)).toBe(true)
    expect(isVerifiedPeerAlbumCandidate({ ...peerAlbum, artistName: 'Piano Dreamers' }, 'Lorde', 456)).toBe(false)
    expect(isVerifiedPeerAlbumCandidate({ ...peerAlbum, collectionName: 'Melodrama Piano Covers' }, 'Lorde', 456)).toBe(false)
    expect(isVerifiedPeerAlbumCandidate({ ...peerAlbum, trackCount: 4 }, 'Lorde', 456)).toBe(false)
  })

  it('builds four recommendations from verified peers, preferring artist diversity before filling', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
      const url = new URL(String(input), window.location.origin)
      if (url.pathname === '/api/lastfm/similar-artists') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ artists: [
            { name: 'Sabrina Carpenter', match: 1 },
            { name: 'Olivia Rodrigo', match: 0.8 },
          ] }),
        }
      }
      if (url.hostname === 'itunes.apple.com' && url.pathname === '/search') {
        const term = url.searchParams.get('term')
        const results = term === 'Sabrina Carpenter' ? [
          {
            collectionId: 101, collectionType: 'Album', collectionName: 'Short n’ Sweet',
            artistId: 10, artistName: 'Sabrina Carpenter', trackCount: 12,
            primaryGenreName: 'Pop', releaseDate: '2024-08-23', artworkUrl100: 'https://example.com/101.jpg',
          },
          {
            collectionId: 102, collectionType: 'Album', collectionName: 'Emails I Can’t Send',
            artistId: 10, artistName: 'Sabrina Carpenter', trackCount: 13,
            primaryGenreName: 'Pop', releaseDate: '2022-07-15', artworkUrl100: 'https://example.com/102.jpg',
          },
          {
            collectionId: 999, collectionType: 'Album', collectionName: 'Midnights Piano Covers',
            artistId: 999, artistName: 'Piano Dreamers', trackCount: 13,
            primaryGenreName: 'Pop', releaseDate: '2023-01-01', artworkUrl100: 'https://example.com/999.jpg',
          },
        ] : [
          {
            collectionId: 201, collectionType: 'Album', collectionName: 'GUTS',
            artistId: 20, artistName: 'Olivia Rodrigo', trackCount: 12,
            primaryGenreName: 'Pop', releaseDate: '2023-09-08', artworkUrl100: 'https://example.com/201.jpg',
          },
          {
            collectionId: 202, collectionType: 'Album', collectionName: 'SOUR',
            artistId: 20, artistName: 'Olivia Rodrigo', trackCount: 11,
            primaryGenreName: 'Pop', releaseDate: '2021-05-21', artworkUrl100: 'https://example.com/202.jpg',
          },
        ]
        return { ok: true, status: 200, json: async () => ({ results }) }
      }
      return { ok: false, status: 503, json: async () => ({}) }
    }))

    const albums = await fetchRelatedAlbums(
      'Midnights', 'Taylor Swift', 'Pop', 'album-1', undefined, true, '2022',
    )

    expect(albums).toHaveLength(4)
    expect(new Set(albums.slice(0, 2).map((album) => album.artist))).toEqual(
      new Set(['Sabrina Carpenter', 'Olivia Rodrigo']),
    )
    expect(albums.some((album) => /piano|cover/i.test(album.title))).toBe(false)
  })

  it('recognizes named editions by exact artist and normalized base title', () => {
    expect(isSameAlbumVersionTitle(
      'Midnights (The Til Dawn Edition)',
      'Taylor Swift',
      'Midnights',
      'Taylor Swift',
    )).toBe(true)
    expect(isSameAlbumVersionTitle('Midnights (3am Edition)', 'Cover Band', 'Midnights', 'Taylor Swift')).toBe(false)
    expect(isSameAlbumVersionTitle('Midnight Memories', 'Taylor Swift', 'Midnights', 'Taylor Swift')).toBe(false)
  })
})
