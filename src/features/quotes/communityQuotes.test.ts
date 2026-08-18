import { describe, expect, it } from 'vitest'
import {
  buildCommunityQuoteRanking,
  isHighConfidenceTypoMatch,
  normalizeQuoteText,
  quoteToPlainText,
} from './communityQuotes'

describe('community quote ranking', () => {
  it('normalizes rich text, entities, punctuation, capitalization, and spacing', () => {
    const richText = '<p>  You&rsquo;re <strong>always</strong> here.&nbsp;</p><p>With me!</p>'

    expect(quoteToPlainText(richText)).toBe("You\u2019re always here.\nWith me!")
    expect(normalizeQuoteText(richText)).toBe('youre always here with me')
  })

  it('groups normalized matches and counts unique contributors', () => {
    const ranking = buildCommunityQuoteRanking([
      {
        id: 'entry-1',
        text: '"It is a truth universally acknowledged."',
        contributorHandle: '@reader_one',
      },
      {
        id: 'entry-2',
        text: '<p>IT IS A TRUTH universally acknowledged!</p>',
        contributorHandle: 'reader_two',
      },
      {
        id: 'entry-3',
        text: 'It is a truth universally acknowledged',
        contributorHandle: 'reader_one',
      },
    ])

    expect(ranking.ranked).toHaveLength(1)
    expect(ranking.ranked[0]).toMatchObject({
      uniqueContributorCount: 2,
      submissionCount: 3,
      wordingVariantCount: 1,
    })
  })

  it('automatically groups an unmistakable transposition typo in a longer quote', () => {
    const correct = 'the night was dark and full of terrors'
    const typo = 'the nihgt was dark and full of terrors'

    expect(isHighConfidenceTypoMatch(correct, typo)).toBe(true)

    const ranking = buildCommunityQuoteRanking([
      { id: 'entry-1', text: correct, contributorHandle: 'one' },
      { id: 'entry-2', text: typo, contributorHandle: 'two' },
    ])

    expect(ranking.ranked).toHaveLength(1)
    expect(ranking.ranked[0].wordingVariantCount).toBe(2)
  })

  it('keeps meaning-changing and short ambiguous sentences separate', () => {
    const ranking = buildCommunityQuoteRanking([
      { id: 'entry-1', text: 'You will always be in my heart', contributorHandle: 'one' },
      { id: 'entry-2', text: "You're always be on my heart", contributorHandle: 'two' },
      { id: 'entry-3', text: "It's not enough", contributorHandle: 'three' },
      { id: 'entry-4', text: "I'm not enough", contributorHandle: 'four' },
    ])

    expect(ranking.ranked).toHaveLength(0)
    expect(ranking.unmatched).toHaveLength(4)
  })

  it('does not turn repeat submissions from one person into a most-quoted passage', () => {
    const ranking = buildCommunityQuoteRanking([
      { id: 'entry-1', text: 'The same passage.', contributorHandle: 'one' },
      { id: 'entry-2', text: 'The same passage!', contributorHandle: '@one' },
    ])

    expect(ranking.ranked).toHaveLength(0)
    expect(ranking.unmatched[0]).toMatchObject({
      uniqueContributorCount: 1,
      submissionCount: 2,
    })
  })

  it('keeps unidentified contributors distinct instead of sharing an anonymous identity', () => {
    const ranking = buildCommunityQuoteRanking([
      { id: 'entry-1', text: 'A passage without an author.' },
      { id: 'entry-2', text: 'A passage without an author!' },
    ])

    expect(ranking.ranked[0].uniqueContributorCount).toBe(2)
  })
})
