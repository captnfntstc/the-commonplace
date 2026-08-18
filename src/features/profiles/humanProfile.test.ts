import { describe, expect, it } from 'vitest'
import {
  canonicalHumanId,
  contextualHumanLabel,
  getDynamicHumanTabs,
  verifiedProfessionsFromWikipedia,
} from './humanProfile'

describe('unified human profile identity', () => {
  it('does not infer actor for a musician whose Wikipedia lead only establishes music', () => {
    expect(verifiedProfessionsFromWikipedia(
      'Taylor Swift is an American singer-songwriter. She has appeared in films and concert documentaries.',
      'artist',
    )).toEqual({ professions: ['artist'], occupationLabels: ['Singer-songwriter'] })
  })

  it('retains multiple professions explicitly established in the lead', () => {
    expect(verifiedProfessionsFromWikipedia(
      'Olivia Rodrigo is an American singer-songwriter and actress.',
      'artist',
    )).toEqual({ professions: ['artist', 'actor'], occupationLabels: ['Singer-songwriter', 'Actress'] })
  })

  it('uses the verified contextual label without combining labels', () => {
    expect(contextualHumanLabel('actor', ['artist', 'actor'])).toBe('Actor')
    expect(contextualHumanLabel('actor', ['artist'])).toBe('Artist')
  })

  it('prioritizes work tabs by entry context and hides unavailable catalogs', () => {
    const capabilities = {
      topSongs: true,
      discography: true,
      filmography: true,
      publishedWorks: false,
      directing: false,
      creating: false,
    }
    expect(getDynamicHumanTabs({ context: 'artist', capabilities }).map((tab) => tab.id))
      .toEqual(['overview', 'top_content', 'discography', 'filmography', 'reviews', 'related'])
    expect(getDynamicHumanTabs({ context: 'actor', capabilities }).map((tab) => tab.id))
      .toEqual(['overview', 'filmography', 'top_content', 'discography', 'reviews', 'related'])
  })

  it('prefers stable canonical provider identifiers', () => {
    expect(canonicalHumanId({ wikidataId: 'q26876', wikipediaPageId: '123' })).toBe('human:Q26876')
    expect(canonicalHumanId({ wikipediaPageId: '123' })).toBe('human:wikipedia:123')
  })
})
