import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearMetadataCache, fetchSimilarArtistsByGenreAndLocation } from './metadata'

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }))
}

describe('similar artist provider selection', () => {
  beforeEach(() => {
    clearMetadataCache()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    clearMetadataCache()
  })

  it('uses listener-ranked Last.fm recommendations first', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      void input
      return jsonResponse({
        source: 'Last.fm',
        artists: [
          { name: 'Second Match', musicBrainzId: 'second', match: 0.72 },
          { name: 'Closest Match', musicBrainzId: 'closest', match: 0.94 },
        ],
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const results = await fetchSimilarArtistsByGenreAndLocation('Target Artist', ['Pop'])

    expect(results.map((artist) => artist.name)).toEqual(['Closest Match', 'Second Match'])
    expect(results.map((artist) => artist.score)).toEqual([94, 72])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/lastfm/similar-artists')
  })

  it('falls back to MusicBrainz when Last.fm is not configured', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/lastfm/similar-artists')) {
        return jsonResponse({ error: 'Last.fm is not configured.' }, 503)
      }
      if (url.includes('musicbrainz.org')) {
        const query = new URL(url).searchParams.get('query') || ''
        if (query.startsWith('artist:')) {
          return jsonResponse({
            artists: [{
              id: 'target-mbid',
              name: 'Fallback Artist',
              type: 'Person',
              country: 'US',
              score: 100,
              tags: [{ name: 'pop', count: 10 }],
            }],
          })
        }
        return jsonResponse({
          artists: [{
            id: 'candidate-mbid',
            name: 'Genre Match',
            type: 'Group',
            country: 'US',
            score: 95,
            tags: [{ name: 'pop', count: 8 }],
          }],
        })
      }
      return jsonResponse({ results: [] })
    })
    vi.stubGlobal('fetch', fetchMock)

    const request = fetchSimilarArtistsByGenreAndLocation('Fallback Artist', ['Pop'])
    await vi.runAllTimersAsync()
    const results = await request

    expect(results.map((artist) => artist.name)).toContain('Genre Match')
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes('musicbrainz.org'))).toBe(true)
  })
})
