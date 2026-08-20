import assert from 'node:assert/strict'
import test from 'node:test'
import {
  fetchFanartArtistPortrait,
  selectLatestArtistThumb,
  selectMusicBrainzArtist,
} from './fanart.mjs'

test('selects the exact MusicBrainz artist instead of a similarly named person', () => {
  const artist = selectMusicBrainzArtist([
    { id: 'person', name: 'Hayley Williams', type: 'Person', score: 100 },
    { id: 'band', name: 'Paramore', type: 'Group', score: 98 },
  ], 'Paramore')

  assert.equal(artist.id, 'band')
})

test('selects the most recently added Fanart.tv artist thumbnail', () => {
  const image = selectLatestArtistThumb([
    { id: '200', url: 'https://images.example/older.jpg', added: '2025-08-12 08:00:00' },
    { id: '100', url: 'https://images.example/newer.jpg', added: '2026-01-04 09:30:00' },
  ])

  assert.equal(image.url, 'https://images.example/newer.jpg')
})

test('does not call Fanart.tv for a solo artist', async () => {
  const requestedUrls = []
  const fetchImpl = async (url) => {
    requestedUrls.push(String(url))
    return {
      ok: true,
      status: 200,
      json: async () => ({ artists: [{ id: 'solo-id', name: 'NIKI', type: 'Person', score: 100 }] }),
    }
  }

  const result = await fetchFanartArtistPortrait('NIKI', { FANART_TV_API_KEY: 'test-key' }, fetchImpl)

  assert.equal(result.artistType, 'Person')
  assert.equal(result.imageUrl, '')
  assert.equal(requestedUrls.length, 1)
  assert.match(requestedUrls[0], /musicbrainz\.org/)
})

test('uses the newest Fanart.tv upload for a MusicBrainz group', async () => {
  const fetchImpl = async (url) => {
    if (String(url).includes('musicbrainz.org')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ artists: [{ id: 'band-id', name: 'Paramore', type: 'Group', score: 100 }] }),
      }
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        artistthumb: [
          { id: '2', url: 'https://images.example/old.jpg', added: '2024-01-01 00:00:00' },
          { id: '1', url: 'https://images.example/latest.jpg', added: '2026-08-01 00:00:00' },
        ],
      }),
    }
  }

  const result = await fetchFanartArtistPortrait('Paramore', { FANART_TV_API_KEY: 'test-key' }, fetchImpl)

  assert.equal(result.artistType, 'Group')
  assert.equal(result.imageUrl, 'https://images.example/latest.jpg')
  assert.equal(result.added, '2026-08-01 00:00:00')
})

test('returns empty imageUrl when Fanart.tv returns 404 for a band', async () => {
  const fetchImpl = async (url) => {
    if (String(url).includes('musicbrainz.org')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ artists: [{ id: 'wings-id', name: 'Wings', type: 'Group', score: 100 }] }),
      }
    }
    return {
      ok: false,
      status: 404,
      json: async () => ({ error: 'artist not found' }),
    }
  }

  const result = await fetchFanartArtistPortrait('Wings', { FANART_TV_API_KEY: 'test-key' }, fetchImpl)

  assert.equal(result.artistType, 'Group')
  assert.equal(result.imageUrl, '')
})
