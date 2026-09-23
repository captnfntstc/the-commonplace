import { describe, expect, it } from 'vitest'
import {
  cleanDisplayText,
  decodeHtmlEntities,
  isQuotedParagraph,
  normalizeQuotedParagraphBlocks,
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
