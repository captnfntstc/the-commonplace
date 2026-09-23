// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FormattedText } from './FormattedText'

describe('FormattedText', () => {
  it('renders encoded symbols as text', () => {
    render(<FormattedText text="&amp;lt;&amp;gt;?!@#$" />)
    expect(screen.getByText('<>?!@#$')).toBeTruthy()
  })

  it('decodes rich-text text nodes and removes executable markup', () => {
    const { container } = render(
      <FormattedText text={'<p>&amp;lt;safe&amp;gt;</p><script>window.bad = true</script>'} />,
    )
    expect(screen.getByText('<safe>')).toBeTruthy()
    expect(container.querySelector('script')).toBeNull()
  })

  it('renders each quoted HTML paragraph as an independent quote block', () => {
    const { container } = render(
      <FormattedText
        text={'<p><strong>Lorem Ipsum</strong> is regular text.</p><p>"First quotation."</p><p>Back to regular text.</p><p>“Second quotation.”</p>'}
      />,
    )

    const quotes = container.querySelectorAll('blockquote')
    expect(quotes).toHaveLength(2)
    expect(quotes[0]).toHaveTextContent('"First quotation."')
    expect(quotes[1]).toHaveTextContent('“Second quotation.”')
    expect(screen.getByText('Back to regular text.').tagName).toBe('P')
  })

  it('recognizes quotation-delimited lines in plain text', () => {
    const { container } = render(
      <FormattedText text={'Introduction.\n\n"A separate quote."\n\nConclusion.'} />,
    )

    expect(container.querySelectorAll('blockquote')).toHaveLength(1)
    expect(screen.getByText('Introduction.').tagName).toBe('P')
    expect(screen.getByText('Conclusion.').tagName).toBe('P')
  })

  it('reflows legacy reflection line wraps while retaining paragraph breaks', () => {
    const { container } = render(
      <FormattedText
        text={'A legacy reflection that was\nwrapped across short lines.\n\nA second paragraph remains separate.'}
        reflowPlainText
      />,
    )

    const content = container.querySelector('.formatted-text-content')
    expect(content).toHaveTextContent('A legacy reflection that was wrapped across short lines.')
    expect(content?.textContent).toContain('\n\n')
  })

  it('preserves author formatting and block alignment from rich text', () => {
    const { container } = render(
      <FormattedText text={'<p style="text-align: right"><strong>Right aligned</strong> and <em>emphasized</em>.</p>'} />,
    )

    const paragraph = container.querySelector('p')
    expect(paragraph).toHaveStyle({ textAlign: 'right' })
    expect(paragraph?.querySelector('strong')).toHaveTextContent('Right aligned')
    expect(paragraph?.querySelector('em')).toHaveTextContent('emphasized')
  })

  it('reflows rich-text line blocks across the reflection width without losing inline formatting', () => {
    const { container } = render(
      <FormattedText
        text={'<div style="text-align: justify">A reflection <strong>wrapped</strong></div><div style="text-align: justify">into editor line blocks.</div>'}
        reflowPlainText
      />,
    )

    const paragraphs = container.querySelectorAll('.formatted-text-content > p')
    expect(paragraphs).toHaveLength(1)
    expect(paragraphs[0]).toHaveTextContent('A reflection wrapped into editor line blocks.')
    expect(paragraphs[0]).toHaveStyle({ textAlign: 'justify' })
    expect(paragraphs[0].querySelector('strong')).toHaveTextContent('wrapped')
  })
})
