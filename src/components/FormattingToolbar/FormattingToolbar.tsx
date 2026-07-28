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
} from 'lucide-react'

interface FormattingToolbarProps {
  editorRef: React.RefObject<HTMLDivElement | null>
  value: string
  onChange: (value: string) => void
}

export const FormattingToolbar: React.FC<FormattingToolbarProps> = ({
  editorRef,
  onChange,
}) => {
  const [activeState, setActiveState] = useState({
    bold: false,
    italic: false,
    underline: false,
    quote: false,
    list: false,
    align: 'left' as 'left' | 'center' | 'right' | 'justify',
  })

  const isInsideBlockquote = (): boolean => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return false
    let node: Node | null = selection.getRangeAt(0).commonAncestorContainer
    while (node && node !== editorRef.current) {
      if (node.nodeName.toLowerCase() === 'blockquote') {
        return true
      }
      node = node.parentNode
    }
    return false
  }

  const updateActiveStates = () => {
    if (!editorRef.current) return
    try {
      const isBold = document.queryCommandState('bold')
      const isItalic = document.queryCommandState('italic')
      const isUnderline = document.queryCommandState('underline')
      const isList = document.queryCommandState('insertUnorderedList')
      const isQuote = isInsideBlockquote()

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
        align,
      })
    } catch {
      // Ignore if disconnected
    }
  }

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection()
      if (
        selection &&
        editorRef.current &&
        editorRef.current.contains(selection.anchorNode)
      ) {
        updateActiveStates()
      }
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [editorRef])

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
  }

  const toggleBlockquote = () => {
    const editor = editorRef.current
    if (!editor) return

    editor.focus()
    if (isInsideBlockquote()) {
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
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
  }

  return (
    <div className="formatting-toolbar">
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
    </div>
  )
}

