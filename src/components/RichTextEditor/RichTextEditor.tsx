import React, { useEffect, useRef } from 'react'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  onFocus?: () => void
  placeholder?: string
  minHeight?: number
  className?: string
  editorRef?: React.RefObject<HTMLDivElement | null>
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  onFocus,
  placeholder = 'What stayed with you?',
  minHeight = 160,
  className = '',
  editorRef: externalRef,
}) => {
  const internalRef = useRef<HTMLDivElement | null>(null)
  const ref = externalRef || internalRef

  useEffect(() => {
    const editor = ref.current
    if (!editor) return

    const normalizedInner = editor.innerHTML.trim()
    const normalizedValue = (value || '').trim()

    if (normalizedInner !== normalizedValue && document.activeElement !== editor) {
      editor.innerHTML = value || ''
    }
  }, [value, ref])

  const handleInput = () => {
    const editor = ref.current
    if (!editor) return
    const html = editor.innerHTML
    if (html === '<br>' || html === '<div><br></div>' || html === '<p><br></p>') {
      onChange('')
    } else {
      onChange(html)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
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
    <div className={`rich-editor-wrapper ${isEmpty ? 'is-empty' : ''} ${className}`}>
      <div
        ref={ref as any}
        contentEditable
        spellCheck={false}
        className="rich-editor-content"
        style={{ minHeight: `${minHeight}px` }}
        onInput={handleInput}
        onFocus={onFocus}
        onBlur={handleInput}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />
    </div>
  )
}

