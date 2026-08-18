import { describe, expect, it } from 'vitest'
import type { Entry } from '../entries/model'
import { buildMostQuotedWorks } from './quotedWorks'

function entry(overrides: Partial<Entry>): Entry {
  return {
    id: 'entry-1',
    type: 'film',
    title: 'Arrival',
    creator: 'Denis Villeneuve',
    provider: 'TMDB',
    providerId: '329865',
    rating: 5,
    favoritePassage: 'There are days that define your story beyond your life.',
    reflection: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    coverTone: 'ember',
    authorHandle: 'reader-one',
    ...overrides,
  }
}

describe('most quoted works', () => {
  it('ranks works by unique community contributors before raw quote count', () => {
    const ranking = buildMostQuotedWorks([
      entry({ id: 'arrival-1', authorHandle: 'one' }),
      entry({ id: 'arrival-2', authorHandle: 'two' }),
      entry({ id: 'dune-1', title: 'Dune', providerId: '438631', authorHandle: 'one', favoritePassage: 'Dreams are messages.' }),
      entry({ id: 'dune-2', title: 'Dune', providerId: '438631', authorHandle: 'one', favoritePassage: 'Fear is the mind-killer.' }),
      entry({ id: 'dune-3', title: 'Dune', providerId: '438631', authorHandle: 'one', favoritePassage: 'The mystery of life.' }),
    ])

    expect(ranking.map((work) => work.title)).toEqual(['Arrival', 'Dune'])
    expect(ranking[0]).toMatchObject({ uniqueContributorCount: 2, quoteCount: 2 })
  })

  it('counts selected song lines as individual quote contributions', () => {
    const ranking = buildMostQuotedWorks([
      entry({
        id: 'song-1',
        type: 'song',
        title: 'Example Song',
        provider: 'Example Album',
        providerId: 'song-1',
        year: '2025',
        favoritePassage: 'First selected line\nSecond selected line',
      }),
    ])

    expect(ranking[0]).toMatchObject({
      title: 'Example Song',
      providerId: 'song-1',
      album: 'Example Album',
      year: '2025',
      quoteCount: 2,
    })
  })
})
