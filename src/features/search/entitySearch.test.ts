import { describe, expect, it } from 'vitest'
import { getMetadataProviderQuery, type MetadataResult } from '../../metadata'
import type { UniversalMediaEntity } from '../../types/mediaEntity'
import {
  buildEntityMetadataSearchQuery,
  creatorEntityForMetadataType,
  dedupeSearchEntities,
  metadataResultMatchesQuery,
  metadataResultToSearchEntity,
  normalizeSearchText,
  searchEntityMatchesQuery,
  searchResultSubtitle,
  shouldSuppressSynthesizedArtist,
} from './entitySearch'

function metadataResult(overrides: Partial<MetadataResult>): MetadataResult {
  return {
    id: 'film:1',
    type: 'film',
    title: 'Dune',
    creator: 'Denis Villeneuve',
    provider: '2021',
    providerId: '1',
    year: '2021',
    ...overrides,
  }
}

function universalEntity(
  type: UniversalMediaEntity['type'],
  name: string,
  label: string,
  value: string,
): UniversalMediaEntity {
  return {
    id: `${type}:${name}`,
    name,
    type,
    categoryLabel: type,
    artworkUrl: '',
    description: '',
    metadataChips: [{ label, value }],
    communityRating: { average: 0, count: 0, distribution: {} },
  }
}

describe('context-aware media search identity', () => {
  it('matches a movie by title and release year and displays the year instead of director', () => {
    const dune = metadataResultToSearchEntity(metadataResult({}), 0)

    expect(searchEntityMatchesQuery(dune, normalizeSearchText('Dune 2021'))).toBe(true)
    expect(searchEntityMatchesQuery(dune, normalizeSearchText('Dune 1984'))).toBe(false)
    expect(searchResultSubtitle(dune)).toBe('2021')
  })

  it('matches songs and albums by title plus artist', () => {
    const song = metadataResult({
      id: 'song:1',
      type: 'song',
      title: 'cardigan',
      creator: 'Taylor Swift',
      provider: 'folklore',
      providerId: 'song-1',
      year: '2020',
    })

    expect(metadataResultMatchesQuery(song, 'cardigan Taylor Swift')).toBe(true)
    expect(metadataResultMatchesQuery(song, 'cardigan another artist')).toBe(false)
  })

  it('builds the applicable profile lookup context', () => {
    expect(buildEntityMetadataSearchQuery(universalEntity('movie', 'Dune', 'Release Year', '2021')))
      .toBe('Dune 2021')
    expect(buildEntityMetadataSearchQuery(universalEntity('album', 'folklore', 'Artist', 'Taylor Swift')))
      .toBe('folklore Taylor Swift')
    expect(buildEntityMetadataSearchQuery(universalEntity('book', 'Beloved', 'Author', 'Toni Morrison')))
      .toBe('Beloved Toni Morrison')
  })

  it('uses trailing real-world years as provider context without breaking year-like titles', () => {
    expect(getMetadataProviderQuery('Dune 2021', 2026)).toBe('Dune')
    expect(getMetadataProviderQuery('Blade Runner 2049', 2026)).toBe('Blade Runner 2049')
    expect(getMetadataProviderQuery('1989', 2026)).toBe('1989')
  })

  it('keeps same-title movie releases from different years distinct', () => {
    const older = metadataResultToSearchEntity(metadataResult({ id: 'film:1984', providerId: '1984', year: '1984' }), 0)
    const newer = metadataResultToSearchEntity(metadataResult({ id: 'film:2021', providerId: '2021', year: '2021' }), 1)

    expect(dedupeSearchEntities([older, newer])).toHaveLength(2)
  })

  it('maps creators to profession-specific person entities', () => {
    expect(creatorEntityForMetadataType('album').type).toBe('artist')
    expect(creatorEntityForMetadataType('song').type).toBe('artist')
    expect(creatorEntityForMetadataType('book').type).toBe('author')
    expect(creatorEntityForMetadataType('film').type).toBe('director')
    expect(creatorEntityForMetadataType('tv').type).toBe('creator')
    expect(creatorEntityForMetadataType('game').type).toBe('game_studio')
  })

  it('suppresses a spurious music artist when an authoritative person role exists', () => {
    expect(shouldSuppressSynthesizedArtist('artist', ['artist', 'author'], false)).toBe(true)
    expect(shouldSuppressSynthesizedArtist('artist', ['artist', 'author'], false, 8)).toBe(false)
    expect(shouldSuppressSynthesizedArtist('artist', ['artist', 'author'], true)).toBe(false)
    expect(shouldSuppressSynthesizedArtist('author', ['artist', 'author'], false)).toBe(false)
  })
})
