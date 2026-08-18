import { describe, expect, it } from 'vitest'
import {
  decodeRouteSegment,
  getEntityRoutePath,
  inferEntityTypeFromId,
  routeSegment,
} from './routing'

describe('entity routing', () => {
  it('round-trips route segments without changing the entity id', () => {
    const id = 'artist:Beyoncé & Jay-Z'
    expect(decodeRouteSegment(routeSegment(id))).toBe(id)
  })

  it('keeps the established route shapes', () => {
    expect(getEntityRoutePath('album-123', 'album')).toBe('/albums/album-123')
    expect(getEntityRoutePath('igdb:game:42', 'game')).toBe('/games/igdb%3Agame%3A42')
    expect(getEntityRoutePath('human:Q26876', 'human')).toBe('/people/human%3AQ26876')
  })

  it('infers legacy and provider-backed entity types', () => {
    expect(inferEntityTypeFromId('song-100')).toBe('song')
    expect(inferEntityTypeFromId('Itunes:Song:1650841747')).toBe('song')
    expect(inferEntityTypeFromId('ITUNES:ALBUM:123')).toBe('album')
    expect(inferEntityTypeFromId('rawg:game:3498')).toBe('game')
    expect(inferEntityTypeFromId('author-ursula-le-guin')).toBe('author')
    expect(inferEntityTypeFromId('human:Q26876')).toBe('human')
  })
})
