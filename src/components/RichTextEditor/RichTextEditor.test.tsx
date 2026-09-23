// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RichTextEditor } from './RichTextEditor'

describe('RichTextEditor quote blocks', () => {
  it('applies the saved paragraph alignment when an entry is reopened', () => {
    const { container } = render(
      <RichTextEditor value="A saved reflection" align="right" onChange={vi.fn()} />,
    )

    expect(container.querySelector('.rich-editor-content')).toHaveStyle({ textAlign: 'right' })
  })

  it('normalizes quotation-delimited paragraphs when editing finishes', () => {
    const onChange = vi.fn()
    const { container } = render(<RichTextEditor value="" onChange={onChange} />)
    const editor = container.querySelector<HTMLDivElement>('.rich-editor-content')!
    editor.innerHTML = '<p>Regular text.</p><p>"A separate quote."</p><p>Regular again.</p>'

    fireEvent.blur(editor)

    expect(editor.querySelectorAll('blockquote')).toHaveLength(1)
    expect(onChange).toHaveBeenLastCalledWith(
      '<p>Regular text.</p><blockquote>"A separate quote."</blockquote><p>Regular again.</p>',
    )
  })

  it('starts a normal paragraph after Enter at the end of a quote block', () => {
    const onChange = vi.fn()
    const { container } = render(
      <RichTextEditor value={'<blockquote>"A separate quote."</blockquote>'} onChange={onChange} />,
    )
    const editor = container.querySelector<HTMLDivElement>('.rich-editor-content')!
    const quote = editor.querySelector('blockquote')!
    const range = document.createRange()
    range.selectNodeContents(quote)
    range.collapse(false)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)

    fireEvent.keyDown(editor, { key: 'Enter' })

    expect(editor.lastElementChild?.tagName).toBe('P')
    expect(editor.querySelectorAll('blockquote')).toHaveLength(1)
    expect(onChange).toHaveBeenLastCalledWith(
      '<blockquote>"A separate quote."</blockquote><p><br></p>',
    )
  })
})
