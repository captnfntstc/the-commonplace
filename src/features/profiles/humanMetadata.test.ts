import { describe, expect, it } from 'vitest'
import { buildHumanMetadata, getDominantCatalogGenre } from './humanMetadata'

describe('human profile metadata', () => {
  it('uses the majority discography genre instead of the newest release genre', () => {
    expect(getDominantCatalogGenre([
      { id: '1', title: 'Recent Remix', subtitle: '', artworkUrl: '', genre: 'Electronic' },
      { id: '2', title: 'Album One', subtitle: '', artworkUrl: '', genre: 'Alternative' },
      { id: '3', title: 'Album Two', subtitle: '', artworkUrl: '', genre: 'alternative' },
    ])).toBe('Alternative')
  })

  it('uses the newest occurrence only as a deterministic tie-breaker', () => {
    expect(getDominantCatalogGenre([
      { id: '1', title: 'Newest', subtitle: '', artworkUrl: '', genre: 'Folk' },
      { id: '2', title: 'Older', subtitle: '', artworkUrl: '', genre: 'Alternative' },
    ])).toBe('Folk')
  })

  it('extracts band facts into compact metadata', () => {
    expect(buildHumanMetadata({
      type: 'artist',
      description: 'The Smiths were an English rock band formed in Manchester in 1982.',
      fallbackProfession: 'Artist',
      catalogGenre: 'Alternative',
    })).toEqual([
      { label: 'Profession', value: 'Band' },
      { label: 'Genre', value: 'Alternative' },
      { label: 'Origin', value: 'Manchester' },
      { label: 'Formed', value: '1982' },
    ])
  })

  it('extracts individual nationality and birth year', () => {
    expect(buildHumanMetadata({
      type: 'artist',
      description: 'Niki (born 24 January 1999) is an Indonesian singer-songwriter.',
      fallbackProfession: 'Artist',
      catalogGenre: 'R&B/Soul',
    })).toEqual([
      { label: 'Profession', value: 'Singer-songwriter' },
      { label: 'Genre', value: 'R&B/Soul' },
      { label: 'Nationality', value: 'Indonesian' },
      { label: 'Born', value: '1999' },
    ])
  })
})
