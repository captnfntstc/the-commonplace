import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearMetadataCache,
  entityImageCacheMap,
  fetchSimilarArtistPortrait,
  getSimilarArtistPortraitCacheKey,
} from './metadata'

afterEach(() => {
  vi.unstubAllGlobals()
  clearMetadataCache()
  entityImageCacheMap.clear()
})

describe('similar artist portrait loading', () => {
  it('shares concurrent requests and returns the first valid portrait source', async () => {
    let wikipediaCalls = 0
    let fanartCalls = 0
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
      const url = new URL(String(input), window.location.origin)
      if (url.hostname === 'en.wikipedia.org') {
        wikipediaCalls += 1
        return {
          ok: true,
          status: 200,
          json: async () => ({
            query: {
              pages: {
                1: {
                  pageid: 1,
                  title: 'Sabrina Carpenter',
                  thumbnail: { source: 'https://example.com/sabrina.jpg' },
                  extract: 'American singer and actress.',
                },
              },
            },
          }),
        }
      }
      if (url.pathname === '/api/fanart/artist') {
        fanartCalls += 1
        await new Promise((resolve) => window.setTimeout(resolve, 20))
        return { ok: true, status: 200, json: async () => ({ artistType: 'Person', imageUrl: '' }) }
      }
      return { ok: false, status: 404, json: async () => ({}) }
    }))

    const [first, second] = await Promise.all([
      fetchSimilarArtistPortrait('Sabrina Carpenter'),
      fetchSimilarArtistPortrait('Sabrina Carpenter'),
    ])

    expect(first).toBe('https://example.com/sabrina.jpg')
    expect(second).toBe(first)
    expect(wikipediaCalls).toBe(1)
    expect(fanartCalls).toBe(1)
    expect(entityImageCacheMap.get(getSimilarArtistPortraitCacheKey('Sabrina Carpenter'))).toBe(first)
  })
})
