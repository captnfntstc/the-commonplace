import { describe, expect, it } from 'vitest'
import { mapTmdbCastMembers, tmdbCreditMatchesTitle, tmdbPersonSearchCandidates } from './metadata'

describe('TMDB cast mapping', () => {
  it('splits a title followed by a two- or three-word artist name', () => {
    expect(tmdbPersonSearchCandidates('Seven Brad Pitt')).toContainEqual({
      titleQuery: 'Seven',
      personQuery: 'Brad Pitt',
    })
    expect(tmdbPersonSearchCandidates('Avengers Robert Downey Jr')).toContainEqual({
      titleQuery: 'Avengers',
      personQuery: 'Robert Downey Jr',
    })
    expect(tmdbPersonSearchCandidates('seven br')).toContainEqual({
      titleQuery: 'seven',
      personQuery: 'br',
    })
    expect(tmdbPersonSearchCandidates('the shaw')).not.toContainEqual({
      titleQuery: 'the',
      personQuery: 'shaw',
    })
  })

  it('treats a full two-word artist query as a filmography search', () => {
    expect(tmdbPersonSearchCandidates('Brad Pitt')).toContainEqual({
      titleQuery: '',
      personQuery: 'Brad Pitt',
    })
  })

  it('supports artists who use a single name', () => {
    expect(tmdbPersonSearchCandidates('Cher')).toEqual([{
      titleQuery: '',
      personQuery: 'Cher',
    }])
  })

  it('matches a natural-language Seven query to TMDB\'s stylized Se7en title', () => {
    expect(tmdbCreditMatchesTitle({ id: 807, title: 'Se7en' }, 'Seven')).toBe(true)
  })

  it('sorts principal cast, removes duplicates, and keeps at most twenty people', () => {
    const cast = Array.from({ length: 22 }, (_, index) => ({
      id: index + 1,
      name: `Actor ${index + 1}`,
      character: `Character ${index + 1}`,
      profile_path: `/actor-${index + 1}.jpg`,
      order: 21 - index,
    }))
    cast.push({ ...cast[0], order: 30 })

    const result = mapTmdbCastMembers(cast)

    expect(result).toHaveLength(20)
    expect(result[0]).toMatchObject({
      id: 'tmdb:person:22',
      providerId: '22',
      name: 'Actor 22',
      character: 'Character 22',
      order: 0,
    })
    expect(result[0].profileUrl).toContain('/actor-22.jpg')
    expect(new Set(result.map((member) => member.id)).size).toBe(result.length)
  })
})
