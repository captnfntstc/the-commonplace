import { describe, expect, it } from 'vitest'
import {
  classifyHumanScreenCredit,
  isWikipediaDisambiguationPage,
  wikipediaIdentityMatches,
} from './metadata'

describe('Wikipedia person identity matching', () => {
  it('rejects disambiguation pages even when the API property value is empty', () => {
    expect(isWikipediaDisambiguationPage({
      title: 'James Taylor (disambiguation)',
      extract: 'James Taylor may also refer to:',
      pageprops: { disambiguation: '' },
    })).toBe(true)
    expect(isWikipediaDisambiguationPage({
      title: 'James Taylor',
      extract: 'James Vernon Taylor is an American singer-songwriter and guitarist.',
      pageprops: { wikibase_item: 'Q207192' },
    })).toBe(false)
  })

  it('accepts parenthetical titles for the requested person', () => {
    expect(wikipediaIdentityMatches('Niki', 'Niki (singer)')).toBe(true)
  })

  it('rejects a similarly spelled but different person', () => {
    expect(wikipediaIdentityMatches(
      'Niki',
      'Nikki Stringfield',
      'Nikki Stringfield is an American heavy metal musician.',
    )).toBe(false)
  })

  it('accepts a stage name stated in the introduction', () => {
    expect(wikipediaIdentityMatches(
      'Example Artist',
      'Example Person',
      'Example Person is known professionally as Example Artist.',
    )).toBe(true)
  })

  it('does not treat a band mention as a person alias', () => {
    expect(wikipediaIdentityMatches(
      'Paramore',
      'Hayley Williams',
      'Hayley Williams is an American singer and the lead vocalist of the rock band Paramore.',
    )).toBe(false)
  })
})

describe('human screen-credit classification', () => {
  it('keeps scripted roles separate from self-led screen projects', () => {
    expect(classifyHumanScreenCredit({
      id: 1,
      media_type: 'movie',
      title: 'Valentine\'s Day',
      character: 'Felicia',
    }, 'Taylor Swift')).toBe('acting')

    expect(classifyHumanScreenCredit({
      id: 2,
      media_type: 'movie',
      title: 'Taylor Swift: The Eras Tour',
      character: 'Self',
      genre_ids: [10402],
      order: 0,
    }, 'Taylor Swift')).toBe('concert')

    expect(classifyHumanScreenCredit({
      id: 3,
      media_type: 'movie',
      title: 'Miss Americana',
      character: 'Self',
      genre_ids: [99],
      order: 0,
    }, 'Taylor Swift')).toBe('documentary')
  })

  it('excludes incidental and archive appearances', () => {
    expect(classifyHumanScreenCredit({
      id: 4,
      media_type: 'tv',
      name: 'Awards Tonight',
      character: 'Self - Archive Footage',
      genre_ids: [99],
      order: 0,
    }, 'Taylor Swift')).toBeUndefined()
  })

  it('excludes guest appearances on reality, news, and talk shows', () => {
    expect(classifyHumanScreenCredit({
      id: 5,
      media_type: 'tv',
      name: 'The Tonight Show Starring Jimmy Fallon',
      character: 'Self',
      genre_ids: [10767],
      order: 2,
    }, 'Taylor Swift')).toBeUndefined()

    expect(classifyHumanScreenCredit({
      id: 6,
      media_type: 'tv',
      name: 'Reality Check',
      character: 'Self',
      genre_ids: [10764],
      order: 1,
    }, 'Taylor Swift')).toBeUndefined()

    expect(classifyHumanScreenCredit({
      id: 7,
      media_type: 'tv',
      name: 'Morning News Desk',
      character: 'Self - Guest',
      genre_ids: [10763],
      order: 1,
    }, 'Taylor Swift')).toBeUndefined()
  })

  it('keeps scripted acting roles even when a show is a talk/variety category', () => {
    expect(classifyHumanScreenCredit({
      id: 8,
      media_type: 'tv',
      name: 'Saturday Night Live',
      character: 'Various Characters',
      genre_ids: [10767],
    }, 'Taylor Swift')).toBe('acting')
  })
})
