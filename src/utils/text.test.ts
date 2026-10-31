import { describe, expect, it } from 'vitest'
import {
  cleanDisplayText,
  damerauLevenshtein,
  decodeHtmlEntities,
  isFuzzyStringMatch,
  isFuzzyTokenMatch,
  isQuotedParagraph,
  normalizeQuotedParagraphBlocks,
  searchTokensMatch,
} from './text'

describe('display text normalization', () => {
  it('decodes normal and double-encoded HTML entities', () => {
    expect(decodeHtmlEntities('&lt;&gt;?!@#$')).toBe('<>?!@#$')
    expect(decodeHtmlEntities('&amp;lt;hello&amp;gt;')).toBe('<hello>')
    expect(decodeHtmlEntities('&#9733; &#x1F3AE;')).toBe('★ 🎮')
  })

  it('repairs common mojibake sequences', () => {
    expect(cleanDisplayText('one\u00c2\u00b7two \u00e2\u20ac\u201done')).toBe('one·two —one')
  })
  it('recognizes matching straight and curly quotation marks', () => {
    expect(isQuotedParagraph(' "A quote." ')).toBe(true)
    expect(isQuotedParagraph('“A quote.”')).toBe(true)
    expect(isQuotedParagraph('A quote without delimiters.')).toBe(false)
  })

  it('converts only fully quoted paragraphs to blockquotes', () => {
    expect(normalizeQuotedParagraphBlocks('<p>Regular.</p><p>"Quoted."</p><p>Regular again.</p>'))
      .toBe('<p>Regular.</p><blockquote>"Quoted."</blockquote><p>Regular again.</p>')
  })
})

describe('fuzzy and typo-tolerant search matching', () => {
  it('calculates Damerau-Levenshtein distance with transposition support', () => {
    expect(damerauLevenshtein('taylor', 'tayler')).toBe(1)
    expect(damerauLevenshtein('taylor', 'tyalor')).toBe(1) // transposition
    expect(damerauLevenshtein('kahan', 'kahn')).toBe(1) // deletion
    expect(damerauLevenshtein('swift', 'swiftt')).toBe(1) // insertion
    expect(damerauLevenshtein('beyonce', 'beyonse')).toBe(1) // substitution
    expect(damerauLevenshtein('red', 'bed')).toBe(1)
    expect(damerauLevenshtein('1984', '2021')).toBe(4)
  })

  it('matches tokens fuzzily while avoiding false short word collisions', () => {
    expect(isFuzzyTokenMatch('tayler', 'taylor')).toBe(true)
    expect(isFuzzyTokenMatch('beyonse', 'beyonce')).toBe(true)
    expect(isFuzzyTokenMatch('kahn', 'kahan')).toBe(true)
    expect(isFuzzyTokenMatch('tink', 'think')).toBe(true)
    expect(isFuzzyTokenMatch('swif', 'swift')).toBe(true)
    expect(isFuzzyTokenMatch('swft', 'swift')).toBe(true)
    expect(isFuzzyTokenMatch('noe', 'neo')).toBe(true)

    // Short 3-letter substitution collisions must NOT match
    expect(isFuzzyTokenMatch('red', 'bed')).toBe(false)
    expect(isFuzzyTokenMatch('cat', 'bat')).toBe(false)

    // Numeric tokens must NOT match fuzzily
    expect(isFuzzyTokenMatch('1984', '2021')).toBe(false)
    expect(isFuzzyTokenMatch('1984', '1985')).toBe(false)
  })

  it('matches full strings fuzzily', () => {
    expect(isFuzzyStringMatch('taylor swift', 'tayler swift')).toBe(true)
    expect(isFuzzyStringMatch('noah kahan', 'noah kahn')).toBe(true)
    expect(isFuzzyStringMatch('beyonce', 'beyonse')).toBe(true)
    expect(isFuzzyStringMatch('stick season', 'stick seson')).toBe(true)
    expect(isFuzzyStringMatch('i bet you think about me', 'i bet you tink about me')).toBe(true)
    expect(isFuzzyStringMatch('red', 'bed')).toBe(false)
    expect(isFuzzyStringMatch('dune', 'dude')).toBe(false)
  })

  it('matches search queries containing simple typos', () => {
    expect(searchTokensMatch('Shake It Off Taylor Swift 1989 song', 'Tayler Swift')).toBe(true)
    expect(searchTokensMatch('Stick Season Noah Kahan song', 'Noah Kahn')).toBe(true)
    expect(searchTokensMatch('Halo Beyonce song', 'Beyonse')).toBe(true)
    expect(searchTokensMatch('Stick Season Noah Kahan song', 'Stick Seson')).toBe(true)
    expect(searchTokensMatch('I Bet You Think About Me Taylor Swift song', 'I Bet You Tink About Me')).toBe(true)
    expect(searchTokensMatch('Not Like Us Kendrick Lamar song', 'Kendrik Lamar')).toBe(true)
    expect(searchTokensMatch('Birds of a Feather Billie Eilish song', 'Bilie Eilish')).toBe(true)
    expect(searchTokensMatch('Oppenheimer Christopher Nolan film', 'Oppenhimer')).toBe(true)
    expect(searchTokensMatch('Interstellar Christopher Nolan film', 'Interstelar')).toBe(true)

    // Unrelated text should not match
    expect(searchTokensMatch('Taylor Swift 1989 song', 'Random Nonsense')).toBe(false)
    expect(searchTokensMatch('Taylor Swift 1989 song', 'xyz123')).toBe(false)

    // Numeric tokens in query must strictly match
    expect(searchTokensMatch('Dune 2021 Denis Villeneuve Film', 'Dune 1984')).toBe(false)
    expect(searchTokensMatch('Dune 2021 Denis Villeneuve Film', 'Dune 2021')).toBe(true)
  })
})
