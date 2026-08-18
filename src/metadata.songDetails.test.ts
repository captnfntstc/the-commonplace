import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearMetadataCache, fetchItunesSongDetails } from './metadata'

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }))
}

describe('song profile details', () => {
  beforeEach(() => clearMetadataCache())

  afterEach(() => {
    vi.unstubAllGlobals()
    clearMetadataCache()
  })

  it('returns the contextual biography consumed by the song profile', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('itunes.apple.com/lookup?id=90001')) {
        return jsonResponse({
          results: [{
            wrapperType: 'track',
            kind: 'song',
            trackId: 90001,
            collectionId: 90002,
            trackName: 'Cruel Summer',
            artistName: 'Taylor Swift',
            collectionName: 'Lover',
            trackNumber: 2,
            trackCount: 18,
            trackTimeMillis: 178426,
            releaseDate: '2019-08-23T00:00:00Z',
          }],
        })
      }
      if (url.includes('itunes.apple.com/lookup?id=90002')) {
        return jsonResponse({
          results: [{
            wrapperType: 'collection',
            collectionId: 90002,
            collectionName: 'Lover',
            artworkUrl100: 'https://example.com/lover/100x100bb.jpg',
          }],
        })
      }
      if (url.includes('en.wikipedia.org/w/api.php')) {
        return jsonResponse({
          query: {
            pages: {
              lover: { extract: 'Lover is the seventh studio album by American singer-songwriter Taylor Swift.' },
            },
          },
        })
      }
      return jsonResponse([])
    })
    vi.stubGlobal('fetch', fetchMock)

    const details = await fetchItunesSongDetails('Cruel Summer', 'Taylor Swift', '90001')

    expect(details?.summary).toBe(
      "Cruel Summer is the 2nd track on Taylor Swift's 7th studio album, Lover.",
    )
    expect(details).toMatchObject({
      artist: 'Taylor Swift',
      album: 'Lover',
      trackNumber: 2,
      studioAlbumNumber: 7,
    })
  })
})
