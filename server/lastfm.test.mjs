import assert from 'node:assert/strict'
import test from 'node:test'
import {
  fetchLastFmSimilarArtists,
  handleLastFmApiRequest,
  normalizeLastFmSimilarArtists,
} from './lastfm.mjs'

test('normalizes, deduplicates, excludes the current artist, and ranks by match', () => {
  const artists = normalizeLastFmSimilarArtists([
    { name: 'Target Artist', mbid: 'target', match: '1' },
    { name: 'Second Artist', mbid: 'second', match: '0.7' },
    { name: 'Closest Artist', mbid: 'closest', match: '0.95' },
    { name: 'Closest Artist', mbid: 'closest', match: '0.8' },
    { name: 'No Evidence', mbid: 'none', match: '0' },
  ], 'Target Artist', 10)

  assert.deepEqual(artists.map((artist) => artist.name), ['Closest Artist', 'Second Artist'])
  assert.equal(artists[0].musicBrainzId, 'closest')
})

test('calls Last.fm getSimilar without requiring user authentication', async () => {
  let requestedUrl = ''
  const result = await fetchLastFmSimilarArtists(
    'Taylor Swift',
    4,
    { LASTFM_API_KEY: 'server-secret' },
    async (url) => {
      requestedUrl = String(url)
      return {
        ok: true,
        status: 200,
        json: async () => ({
          similarartists: {
            '@attr': { artist: 'Taylor Swift' },
            artist: [{ name: 'Similar Artist', mbid: 'similar-id', match: '0.9', url: 'https://last.fm/a' }],
          },
        }),
      }
    },
  )

  const url = new URL(requestedUrl)
  assert.equal(url.searchParams.get('method'), 'artist.getsimilar')
  assert.equal(url.searchParams.get('artist'), 'Taylor Swift')
  assert.equal(url.searchParams.get('api_key'), 'server-secret')
  assert.equal(url.searchParams.get('autocorrect'), '1')
  assert.equal(result.artists[0].name, 'Similar Artist')
})

test('fails clearly when the Last.fm server key is missing', async () => {
  await assert.rejects(
    fetchLastFmSimilarArtists('Taylor Swift', 4, {}, async () => assert.fail('fetch should not run')),
    (error) => error.statusCode === 503 && /LASTFM_API_KEY/.test(error.message),
  )
})

test('handles only the Similar Artists API route', async () => {
  assert.equal(await handleLastFmApiRequest('/api/another-route', {}), undefined)
})
