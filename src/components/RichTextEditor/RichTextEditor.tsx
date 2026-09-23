import React, { useEffect, useRef, useState } from 'react'
import { type Alignment } from '../CommonplaceCard/FormattedText'
import {
  isQuotedParagraph,
  normalizeHtmlTextEntities,
  normalizeQuotedParagraphBlocks,
} from '../../utils/text'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  onFocus?: () => void
  placeholder?: string
  minHeight?: number
  className?: string
  editorRef?: React.RefObject<HTMLDivElement | null>
  align?: Alignment
  maxCharacters?: number
}

function richTextCharacterCount(html: string) {
  if (!html) return 0
  if (typeof document === 'undefined') {
    return normalizeHtmlTextEntities(html.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]*>/g, '')).length
  }
  const template = document.createElement('template')
  template.innerHTML = html
  return (template.content.textContent || '').length
}

function placeCaretAtEnd(element: HTMLElement) {
  const selection = window.getSelection()
  if (!selection) return
  const range = document.createRange()
  range.selectNodeContents(element)
  range.collapse(false)
  selection.removeAllRanges()
  selection.addRange(range)
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  onFocus,
  placeholder = 'What stayed with you?',
  minHeight = 160,
  className = '',
  editorRef: externalRef,
  align = 'left',
  maxCharacters,
}) => {
  const internalRef = useRef<HTMLDivElement | null>(null)
  const ref = externalRef || internalRef
  const lastAcceptedHtmlRef = useRef(value)
  const [characterCount, setCharacterCount] = useState(() => richTextCharacterCount(value))

  useEffect(() => {
    const editor = ref.current
    if (!editor) return

    const normalizedInner = editor.innerHTML.trim()
    const normalizedValue = normalizeQuotedParagraphBlocks(normalizeHtmlTextEntities(value)).trim()
    const nextCount = richTextCharacterCount(normalizedValue)

    setCharacterCount(nextCount)
    if (!maxCharacters || nextCount <= maxCharacters) {
      lastAcceptedHtmlRef.current = normalizedValue
    }

    if (normalizedInner !== normalizedValue && document.activeElement !== editor) {
      editor.innerHTML = normalizedValue
    }
  }, [maxCharacters, value, ref])

  const handleInput = () => {
    const editor = ref.current
    if (!editor) return
    const html = editor.innerHTML
    const nextValue = html === '<br>' || html === '<div><br></div>' || html === '<p><br></p>' ? '' : html
    const nextCount = richTextCharacterCount(nextValue)

    if (maxCharacters && nextCount > maxCharacters) {
      editor.innerHTML = lastAcceptedHtmlRef.current
      setCharacterCount(richTextCharacterCount(lastAcceptedHtmlRef.current))
      placeCaretAtEnd(editor)
      return
    }

    lastAcceptedHtmlRef.current = nextValue
    setCharacterCount(nextCount)
    onChange(nextValue)
  }

  const handleBlur = () => {
    const editor = ref.current
    if (!editor) return
    const normalized = normalizeQuotedParagraphBlocks(editor.innerHTML)
    if (normalized !== editor.innerHTML) editor.innerHTML = normalized
    handleInput()
  }

  const breakOutOfQuote = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return false
    const editor = ref.current
    const selection = window.getSelection()
    if (!editor || !selection || selection.rangeCount === 0 || !selection.isCollapsed) return false

    const range = selection.getRangeAt(0)
    let current: Node | null = range.startContainer
    if (current.nodeType === Node.TEXT_NODE) current = current.parentNode
    while (current && current.parentNode !== editor && current !== editor) current = current.parentNode
    if (!(current instanceof HTMLElement)) return false

    const isBlockquote = current.tagName === 'BLOCKQUOTE'
    const isAutomaticQuote = ['P', 'DIV'].includes(current.tagName) && isQuotedParagraph(current.textContent)
    const isRootTextQuote = current === editor
      && !editor.querySelector('p, div, blockquote, ul, ol')
      && isQuotedParagraph(editor.textContent)
    if (!isBlockquote && !isAutomaticQuote && !isRootTextQuote) return false

    const remainingRange = document.createRange()
    remainingRange.selectNodeContents(current)
    remainingRange.setStart(range.endContainer, range.endOffset)
    if (remainingRange.toString().trim()) return false

    event.preventDefault()
    let quoteBlock = current
    if (!isBlockquote) {
      quoteBlock = document.createElement('blockquote')
      while (current.firstChild) quoteBlock.appendChild(current.firstChild)
      if (current === editor) editor.appendChild(quoteBlock)
      else current.replaceWith(quoteBlock)
    }

    const paragraph = document.createElement('p')
    paragraph.appendChild(document.createElement('br'))
    quoteBlock.after(paragraph)
    const nextRange = document.createRange()
    nextRange.selectNodeContents(paragraph)
    nextRange.collapse(true)
    selection.removeAllRanges()
    selection.addRange(nextRange)
    handleInput()
    document.dispatchEvent(new Event('selectionchange'))
    return true
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (breakOutOfQuote(e)) return
    const isCmdOrCtrl = e.ctrlKey || e.metaKey
    if (!isCmdOrCtrl) return

    const key = e.key.toLowerCase()

    if (!e.shiftKey && key === 'b') {
      e.preventDefault()
      document.execCommand('bold', false)
      handleInput()
      document.dispatchEvent(new Event('selectionchange'))
    } else if (!e.shiftKey && key === 'i') {
      e.preventDefault()
      document.execCommand('italic', false)
      handleInput()
      document.dispatchEvent(new Event('selectionchange'))
    } else if (!e.shiftKey && key === 'u') {
      e.preventDefault()
      document.execCommand('underline', false)
      handleInput()
      document.dispatchEvent(new Event('selectionchange'))
    } else if (!e.shiftKey && key === 'k') {
      e.preventDefault()
      const selection = window.getSelection()
      let isLink = false
      if (selection && selection.rangeCount > 0 && ref.current) {
        let node: Node | null = selection.getRangeAt(0).commonAncestorContainer
        while (node && node !== ref.current) {
          if (node.nodeName.toLowerCase() === 'a') {
            isLink = true
            break
          }
          node = node.parentNode
        }
      }

      if (isLink) {
        document.execCommand('unlink', false)
      } else {
        const url = window.prompt('Enter link URL:', 'https://')
        if (url && url.trim() && url !== 'https://') {
          document.execCommand('createLink', false, url.trim())
        }
      }
      handleInput()
      document.dispatchEvent(new Event('selectionchange'))
    } else if (e.shiftKey && (e.key === '7' || e.code === 'Digit7' || e.key === '8' || e.code === 'Digit8')) {
      e.preventDefault()
      document.execCommand('insertUnorderedList', false)
      handleInput()
      document.dispatchEvent(new Event('selectionchange'))
    } else if (e.shiftKey && (e.key === '9' || e.code === 'Digit9')) {
      e.preventDefault()
      const selection = window.getSelection()
      let isQuote = false
      if (selection && selection.rangeCount > 0 && ref.current) {
        let node: Node | null = selection.getRangeAt(0).commonAncestorContainer
        while (node && node !== ref.current) {
          if (node.nodeName.toLowerCase() === 'blockquote') {
            isQuote = true
            break
          }
          node = node.parentNode
        }
      }

      if (isQuote) {
        document.execCommand('formatBlock', false, 'p')
      } else {
        document.execCommand('formatBlock', false, 'blockquote')
      }
      handleInput()
      document.dispatchEvent(new Event('selectionchange'))
    }
  }

  const isEmpty =
    !value ||
    value === '<br>' ||
    value === '<div><br></div>' ||
    value === '<p><br></p>' ||
    value.replace(/<[^>]*>/g, '').trim() === ''

  return (
    <div className={`rich-editor-wrapper ${isEmpty ? 'is-empty' : ''} ${maxCharacters ? 'has-character-limit' : ''} ${className}`}>
      <div
        ref={ref}
        contentEditable
        spellCheck={false}
        className="rich-editor-content"
        style={{ minHeight: `${minHeight}px`, textAlign: align }}
        onInput={handleInput}
        onFocus={onFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />
      {maxCharacters && (
        <span
          className={`rich-editor-character-count ${characterCount >= maxCharacters ? 'at-limit' : ''}`}
          aria-live="polite"
        >
          {characterCount} / {maxCharacters}
        </span>
      )}
    </div>
  )
}
