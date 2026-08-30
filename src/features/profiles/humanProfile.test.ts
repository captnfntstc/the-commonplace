import { describe, expect, it } from 'vitest'
import {
  canonicalHumanId,
  canShowHumanBooks,
  contextualHumanLabel,
  getDynamicHumanTabs,
  shouldShowHumanDisambiguation,
  verifiedProfessionsFromWikipedia,
} from './humanProfile'
import type { IdentityCandidate } from '../../types/mediaEntity'

describe('unified human profile identity', () => {
  it('does not infer actor for a musician whose Wikipedia lead only establishes music', () => {
    expect(verifiedProfessionsFromWikipedia(
      'Taylor Swift is an American singer-songwriter. She has appeared in films and concert documentaries.',
      'artist',
    )).toEqual({
      professions: ['singer_songwriter', 'singer', 'songwriter'],
      occupationLabels: ['Singer-songwriter', 'Singer', 'Songwriter'],
    })
  })

  it('retains multiple professions explicitly established in the lead', () => {
    expect(verifiedProfessionsFromWikipedia(
      'Olivia Rodrigo is an American singer-songwriter and actress.',
      'artist',
    )).toEqual({
      professions: ['singer_songwriter', 'singer', 'songwriter', 'actor'],
      occupationLabels: ['Singer-songwriter', 'Singer', 'Songwriter', 'Actress'],
    })
  })

  it('uses the verified contextual label without combining labels', () => {
    expect(contextualHumanLabel('actor', ['musician', 'actor'])).toBe('Actor')
    expect(contextualHumanLabel('actor', ['musician'])).toBe('Musician')
  })

  it('keeps work tabs in one sitewide order regardless of entry context', () => {
    const capabilities = {
      topSongs: true,
      discography: true,
      filmography: true,
      publishedWorks: true,
      directing: false,
      creating: false,
    }
    expect(getDynamicHumanTabs({ context: 'artist', capabilities }).map((tab) => tab.id))
      .toEqual(['overview', 'top_content', 'discography', 'filmography', 'published_works', 'reviews', 'related'])
    expect(getDynamicHumanTabs({ context: 'actor', capabilities }).map((tab) => tab.id))
      .toEqual(['overview', 'top_content', 'discography', 'filmography', 'published_works', 'reviews', 'related'])
    expect(getDynamicHumanTabs({ context: 'author', capabilities }).map((tab) => tab.id))
      .toEqual(['overview', 'top_content', 'discography', 'filmography', 'published_works', 'reviews', 'related'])
  })

  it('prefers stable canonical provider identifiers', () => {
    expect(canonicalHumanId({ wikidataId: 'q26876', wikipediaPageId: '123' })).toBe('human:Q26876')
    expect(canonicalHumanId({ tmdbPersonId: '525' })).toBe('human:tmdb:525')
    expect(canonicalHumanId({ openLibraryAuthorId: 'ol23919a' })).toBe('human:openlibrary:OL23919A')
    expect(canonicalHumanId({ wikipediaPageId: '123' })).toBeUndefined()
  })

  it('requires a verified writing profession before showing an Open Library catalog', () => {
    const baseEntity = {
      id: 'human:Q1',
      name: 'Example Person',
      type: 'human' as const,
      categoryLabel: 'Actor',
      artworkUrl: '',
      description: '',
      metadataChips: [],
      communityRating: { average: 0, count: 0, distribution: {} },
      humanProfile: {
        professions: ['actor' as const],
        occupationLabels: ['Actor'],
        providerIds: { openLibraryAuthorId: 'OL1A' },
        capabilities: {
          topSongs: false, discography: false, filmography: true, publishedWorks: false,
          directing: false, creating: false,
        },
      },
    }
    expect(canShowHumanBooks(baseEntity)).toBe(false)
    expect(canShowHumanBooks({
      ...baseEntity,
      categoryLabel: 'Author',
      humanProfile: { ...baseEntity.humanProfile, professions: ['author'] },
    })).toBe(true)
    expect(canShowHumanBooks({
      ...baseEntity,
      categoryLabel: 'Novelist',
      humanProfile: { ...baseEntity.humanProfile, primaryProfession: 'novelist', professions: ['actor'] },
    })).toBe(true)
  })

  it('shows a role qualifier only for a similarly popular person with the same name', () => {
    const current: IdentityCandidate = {
      canonicalId: 'human:Q1', kind: 'human', name: 'Alex Smith', primaryProfession: 'actor',
      professions: ['actor'], occupationLabels: ['Actor'], description: '', portraitUrl: '', knownFor: [],
      providerIds: { wikidataId: 'Q1' }, popularity: { wikidataSitelinks: 80 },
    }
    const peer = {
      ...current,
      canonicalId: 'human:Q2',
      primaryProfession: 'musician' as const,
      professions: ['musician' as const],
      providerIds: { wikidataId: 'Q2' },
      popularity: { wikidataSitelinks: 40 },
    }
    expect(shouldShowHumanDisambiguation(current, [current, peer])).toBe(true)
    expect(shouldShowHumanDisambiguation(current, [current, { ...peer, name: 'Alex Johnson' }])).toBe(false)
    expect(shouldShowHumanDisambiguation(current, [current, { ...peer, popularity: { wikidataSitelinks: 5 } }])).toBe(false)
  })
})
