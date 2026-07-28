import React, { useEffect, useState } from 'react'
import {
  Bold,
  Italic,
  Underline,
  Quote,
  List,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Link,
  Unlink,
  Type,
} from 'lucide-react'

interface FormattingToolbarProps {
  editorRef: React.RefObject<HTMLDivElement | null>
  value: string
  onChange: (value: string) => void
  enableDropCap?: boolean
  onToggleDropCap?: () => void
}

export const FormattingToolbar: React.FC<FormattingToolbarProps> = ({
  editorRef,
  onChange,
  enableDropCap,
  onToggleDropCap,
}) => {
  const [activeState, setActiveState] = useState({
    bold: false,
    italic: false,
    underline: false,
    quote: false,
    list: false,
    link: false,
    align: 'left' as 'left' | 'center' | 'right' | 'justify',
  })

  const isInsideNode = (nodeNames: string[]): boolean => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return false
    let node: Node | null = selection.getRangeAt(0).commonAncestorContainer
    if (node && node.nodeType === Node.TEXT_NODE) {
      node = node.parentNode
    }
    while (node && node !== editorRef.current) {
      if (nodeNames.includes(node.nodeName.toLowerCase())) {
        return true
      }
      node = node.parentNode
    }
    return false
  }

  const isFormatted = (command: string, tagNames: string[]): boolean => {
    try {
      if (document.queryCommandState(command)) return true
    } catch {
      // Fallback
    }

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return false

    // Check anchor, focus, and common ancestor nodes
    const nodesToCheck: Node[] = [
      selection.anchorNode,
      selection.focusNode,
      selection.getRangeAt(0).commonAncestorContainer,
    ].filter(Boolean) as Node[]

    for (let node of nodesToCheck) {
      if (node.nodeType === Node.TEXT_NODE) {
        node = node.parentNode!
      }
      let curr: Node | null = node
      while (curr && curr !== editorRef.current) {
        const tag = curr.nodeName.toLowerCase()
        if (tagNames.includes(tag)) {
          return true
        }
        if (curr instanceof HTMLElement) {
          const style = curr.style
          if (command === 'bold' && (style.fontWeight === 'bold' || parseInt(style.fontWeight || '0') >= 600)) {
            return true
          }
          if (command === 'italic' && style.fontStyle === 'italic') {
            return true
          }
          if (command === 'underline' && style.textDecoration && style.textDecoration.includes('underline')) {
            return true
          }
        }
        curr = curr.parentNode
      }
    }

    return false
  }

  const updateActiveStates = () => {
    if (!editorRef.current) return
    try {
      const isBold = isFormatted('bold', ['b', 'strong'])
      const isItalic = isFormatted('italic', ['i', 'em'])
      const isUnderline = isFormatted('underline', ['u'])
      const isList = isInsideNode(['ul', 'ol', 'li']) || document.queryCommandState('insertUnorderedList')
      const isQuote = isInsideNode(['blockquote'])
      const isLink = isInsideNode(['a'])

      let align: 'left' | 'center' | 'right' | 'justify' = 'left'
      if (document.queryCommandState('justifyCenter')) align = 'center'
      else if (document.queryCommandState('justifyRight')) align = 'right'
      else if (document.queryCommandState('justifyFull')) align = 'justify'

      setActiveState({
        bold: isBold,
        italic: isItalic,
        underline: isUnderline,
        quote: isQuote,
        list: isList,
        link: isLink,
        align,
      })
    } catch {
      // Ignore if disconnected
    }
  }

  useEffect(() => {
    const handleEvents = () => {
      updateActiveStates()
    }

    document.addEventListener('selectionchange', handleEvents)
    const editor = editorRef.current
    if (editor) {
      editor.addEventListener('keyup', handleEvents)
      editor.addEventListener('mouseup', handleEvents)
      editor.addEventListener('focus', handleEvents)
      editor.addEventListener('input', handleEvents)
    }

    // Trigger initial check
    updateActiveStates()

    return () => {
      document.removeEventListener('selectionchange', handleEvents)
      if (editor) {
        editor.removeEventListener('keyup', handleEvents)
        editor.removeEventListener('mouseup', handleEvents)
        editor.removeEventListener('focus', handleEvents)
        editor.removeEventListener('input', handleEvents)
      }
    }
  }, [editorRef.current])

  const execCmd = (command: string, valueArg: string | undefined = undefined) => {
    const editor = editorRef.current
    if (!editor) return

    editor.focus()
    document.execCommand(command, false, valueArg)

    setTimeout(() => {
      if (editor) {
        onChange(editor.innerHTML)
        updateActiveStates()
      }
    }, 0)
    setTimeout(() => updateActiveStates(), 50)
  }

  const toggleLink = () => {
    const editor = editorRef.current
    if (!editor) return

    editor.focus()
    if (activeState.link) {
      document.execCommand('unlink', false)
    } else {
      const url = window.prompt('Enter link URL:', 'https://')
      if (url && url.trim() && url !== 'https://') {
        document.execCommand('createLink', false, url.trim())
      }
    }

    setTimeout(() => {
      if (editor) {
        onChange(editor.innerHTML)
        updateActiveStates()
      }
    }, 0)
    setTimeout(() => updateActiveStates(), 50)
  }

  const toggleBlockquote = () => {
    const editor = editorRef.current
    if (!editor) return

    editor.focus()
    if (isInsideNode(['blockquote'])) {
      document.execCommand('formatBlock', false, 'p')
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        let node: Node | null = selection.getRangeAt(0).commonAncestorContainer
        while (node && node !== editor) {
          if (node.nodeName.toLowerCase() === 'blockquote') {
            const parent = node.parentNode
            if (parent) {
              while (node.firstChild) {
                parent.insertBefore(node.firstChild, node)
              }
              parent.removeChild(node)
            }
            break
          }
          node = node.parentNode
        }
      }
    } else {
      document.execCommand('formatBlock', false, 'blockquote')
    }

    setTimeout(() => {
      if (editor) {
        onChange(editor.innerHTML)
        updateActiveStates()
      }
    }, 0)
    setTimeout(() => updateActiveStates(), 50)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
  }

  return (
    <div className="formatting-toolbar">
      {/* Inline Character Formatting & Links */}
      <div className="toolbar-group">
        <button
          type="button"
          className={`toolbar-btn ${activeState.bold ? 'active' : ''}`}
          title="Bold (Ctrl+B)"
          onMouseDown={handleMouseDown}
          onClick={() => execCmd('bold')}
        >
          <Bold aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`toolbar-btn ${activeState.italic ? 'active' : ''}`}
          title="Italic (Ctrl+I)"
          onMouseDown={handleMouseDown}
          onClick={() => execCmd('italic')}
        >
          <Italic aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`toolbar-btn ${activeState.underline ? 'active' : ''}`}
          title="Underline (Ctrl+U)"
          onMouseDown={handleMouseDown}
          onClick={() => execCmd('underline')}
        >
          <Underline aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`toolbar-btn ${activeState.link ? 'active' : ''}`}
          title={activeState.link ? 'Remove Link' : 'Insert Link (Ctrl+K)'}
          onMouseDown={handleMouseDown}
          onClick={toggleLink}
        >
          {activeState.link ? <Unlink aria-hidden="true" /> : <Link aria-hidden="true" />}
        </button>
        <button
          type="button"
          className={`toolbar-btn ${activeState.quote ? 'active' : ''}`}
          title="Block Quote (Ctrl+Shift+9)"
          onMouseDown={handleMouseDown}
          onClick={toggleBlockquote}
        >
          <Quote aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`toolbar-btn ${activeState.list ? 'active' : ''}`}
          title="Bullet List (Ctrl+Shift+7)"
          onMouseDown={handleMouseDown}
          onClick={() => execCmd('insertUnorderedList')}
        >
          <List aria-hidden="true" />
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Paragraph Alignment Group */}
      <div className="toolbar-group">
        <button
          type="button"
          className={`toolbar-btn ${activeState.align === 'left' ? 'active' : ''}`}
          title="Align Left"
          onMouseDown={handleMouseDown}
          onClick={() => execCmd('justifyLeft')}
        >
          <AlignLeft aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`toolbar-btn ${activeState.align === 'center' ? 'active' : ''}`}
          title="Align Center"
          onMouseDown={handleMouseDown}
          onClick={() => execCmd('justifyCenter')}
        >
          <AlignCenter aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`toolbar-btn ${activeState.align === 'right' ? 'active' : ''}`}
          title="Align Right"
          onMouseDown={handleMouseDown}
          onClick={() => execCmd('justifyRight')}
        >
          <AlignRight aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`toolbar-btn ${activeState.align === 'justify' ? 'active' : ''}`}
          title="Justify"
          onMouseDown={handleMouseDown}
          onClick={() => execCmd('justifyFull')}
        >
          <AlignJustify aria-hidden="true" />
        </button>
      </div>

      {/* Drop Cap Toggle Section with Icon */}
      {onToggleDropCap && (
        <>
          <div className="toolbar-divider" />
          <div className="toolbar-group">
            <button
              type="button"
              className={`toolbar-btn ${Boolean(enableDropCap) ? 'active' : ''}`}
              title="Toggle Drop Cap (Per Entry)"
              onMouseDown={handleMouseDown}
              onClick={onToggleDropCap}
            >
              <Type aria-hidden="true" />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
