import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearMetadataCache, fetchItunesSongArtwork } from './metadata'

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }))
}

function track(overrides: Record<string, unknown>) {
  return {
    wrapperType: 'track',
    kind: 'song',
    trackName: 'Lover',
    artistName: 'Taylor Swift',
    collectionName: 'Lover',
    trackCount: 18,
    artworkUrl100: 'https://example.com/lover/100x100bb.jpg',
    releaseDate: '2019-08-23T07:00:00Z',
    ...overrides,
  }
}

describe('fetchItunesSongArtwork', () => {
  beforeEach(() => clearMetadataCache())

  afterEach(() => {
    vi.unstubAllGlobals()
    clearMetadataCache()
  })

  it('prefers the artist album track over a "Various Artists" compilation with the same title', async () => {
    const realLover = track({ trackId: 1468058173, collectionId: 1468058165 })
    const letsPlayCompilation = track({
      trackId: 1599780073,
      collectionId: 1599779755,
      collectionName: "Let's Play",
      collectionArtistName: 'Various Artists',
      trackCount: 20,
      artworkUrl100: 'https://example.com/lets-play/100x100bb.jpg',
      releaseDate: '2012-01-01T12:00:00Z',
    })

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('itunes.apple.com/search')) {
        return jsonResponse({ results: [realLover, letsPlayCompilation] })
      }
      return jsonResponse([])
    })
    vi.stubGlobal('fetch', fetchMock)

    const artwork = await fetchItunesSongArtwork('Lover', 'Taylor Swift')

    expect(artwork).toBe('https://example.com/lover/600x600bb.jpg')
  })

  it('still picks the artist album even when the compilation is listed first', async () => {
    const realLover = track({ trackId: 1468058173, collectionId: 1468058165 })
    const letsPlayCompilation = track({
      trackId: 1599780073,
      collectionId: 1599779755,
      collectionName: "Let's Play",
      collectionArtistName: 'Various Artists',
      trackCount: 20,
      artworkUrl100: 'https://example.com/lets-play/100x100bb.jpg',
      releaseDate: '2012-01-01T12:00:00Z',
    })
    const moreLoverChapterEp = track({
      trackId: 1677234271,
      collectionId: 1677234264,
      collectionName: 'The More Lover Chapter',
      trackCount: 5,
      artworkUrl100: 'https://example.com/more-lover-chapter/100x100bb.jpg',
      releaseDate: '2019-08-16T07:00:00Z',
    })

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('itunes.apple.com/search')) {
        return jsonResponse({ results: [letsPlayCompilation, moreLoverChapterEp, realLover] })
      }
      return jsonResponse([])
    })
    vi.stubGlobal('fetch', fetchMock)

    const artwork = await fetchItunesSongArtwork('Lover', 'Taylor Swift')

    expect(artwork).toBe('https://example.com/lover/600x600bb.jpg')
  })

  it('prefers the full-length album over an EP-shaped collection with the same track', async () => {
    const realLover = track({ trackId: 1468058173, collectionId: 1468058165 })
    const moreLoverChapterEp = track({
      trackId: 1677234271,
      collectionId: 1677234264,
      collectionName: 'The More Lover Chapter',
      trackCount: 5,
      artworkUrl100: 'https://example.com/more-lover-chapter/100x100bb.jpg',
      releaseDate: '2019-08-16T07:00:00Z',
    })

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('itunes.apple.com/search')) {
        return jsonResponse({ results: [moreLoverChapterEp, realLover] })
      }
      return jsonResponse([])
    })
    vi.stubGlobal('fetch', fetchMock)

    const artwork = await fetchItunesSongArtwork('Lover', 'Taylor Swift')

    expect(artwork).toBe('https://example.com/lover/600x600bb.jpg')
  })
})