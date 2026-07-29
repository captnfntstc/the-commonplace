import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Edit3, Trash2, Clock, Maximize2 } from 'lucide-react'
import { FormattedText, stripHtmlAlignment, type Alignment } from '../FormattedText'

interface VariantProps {
  reflection: string
  reflectionAlign?: Alignment
  enableDropCap?: boolean
  expanded: boolean
  onEdit: () => void
  onDelete: () => void
  onExpandOverlay?: () => void
}

export function getDropCapParts(text: string): {
  firstChar: string
  restText: string
  isEmoji: boolean
  isLowercase: boolean
} {
  if (!text || !text.trim()) {
    return { firstChar: '', restText: '', isEmoji: false, isLowercase: false }
  }

  const { cleanText } = stripHtmlAlignment(text)
  const trimmed = cleanText.trim()

  const checkLowercase = (char: string) => {
    return char === char.toLowerCase() && char !== char.toUpperCase()
  }

  if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(trimmed, 'text/html')
      const body = doc.body

      let firstTextNode: Node | null = null
      const walk = (node: Node) => {
        if (firstTextNode) return
        if (node.nodeType === Node.TEXT_NODE && node.nodeValue && node.nodeValue.trim().length > 0) {
          firstTextNode = node
          return
        }
        for (let child = node.firstChild; child; child = child.nextSibling) {
          walk(child)
        }
      }
      walk(body)

      if (firstTextNode) {
        const fullStr = (firstTextNode as Node).nodeValue || ''
        const leadingWhitespaceMatch = fullStr.match(/^\s*/)
        const leadingWhitespace = leadingWhitespaceMatch ? leadingWhitespaceMatch[0] : ''
        const trimmedStr = fullStr.trimStart()

        let firstChar = ''
        if (typeof Intl !== 'undefined' && (Intl as any).Segmenter) {
          const segmenter = new (Intl as any).Segmenter(undefined, { granularity: 'grapheme' })
          const segments = Array.from(segmenter.segment(trimmedStr))
          if (segments.length > 0) {
            firstChar = (segments[0] as any).segment
          }
        }
        if (!firstChar) {
          firstChar = Array.from(trimmedStr)[0] || ''
        }

        const charLen = firstChar.length
        const remainingStr = trimmedStr.slice(charLen)
        ;(firstTextNode as Node).nodeValue = leadingWhitespace + remainingStr

        const restText = body.innerHTML
        const isEmoji = /\p{Extended_Pictographic}|\p{Emoji_Presentation}/u.test(firstChar)
        const isLowercase = checkLowercase(firstChar)

        return { firstChar, restText, isEmoji, isLowercase }
      }
    } catch {
      // Fallback to plain text logic below if DOM parsing fails
    }
  }

  let firstChar = ''
  if (typeof Intl !== 'undefined' && (Intl as any).Segmenter) {
    const segmenter = new (Intl as any).Segmenter(undefined, { granularity: 'grapheme' })
    const segments = Array.from(segmenter.segment(trimmed))
    if (segments.length > 0) {
      firstChar = (segments[0] as any).segment
    }
  }
  if (!firstChar) {
    firstChar = Array.from(trimmed)[0] || ''
  }

  const restText = trimmed.slice(firstChar.length)
  const isEmoji = /\p{Extended_Pictographic}|\p{Emoji_Presentation}/u.test(firstChar)
  const isLowercase = checkLowercase(firstChar)

  return { firstChar, restText, isEmoji, isLowercase }
}

export const HybridScrollVariant: React.FC<VariantProps> = ({
  reflection,
  reflectionAlign,
  enableDropCap = false,
  expanded,
  onEdit,
  onDelete,
  onExpandOverlay,
}) => {
  const { cleanText } = stripHtmlAlignment(reflection)
  const wordCount = cleanText.replace(/<[^>]*>/g, '').trim().split(/\s+/).filter(Boolean).length
  const readTimeMin = Math.max(1, Math.ceil(wordCount / 180))

  const showDropCap = Boolean(enableDropCap)
  const { firstChar, restText, isEmoji, isLowercase } = getDropCapParts(reflection)

  return (
    <AnimatePresence initial={false}>
      {expanded && (
        <motion.div
          key="card-reflection"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.2, 0, 0, 1] }}
          className="card-reflection expanded v12-hybrid-scroll"
          style={{ overflow: 'hidden' }}
        >
          <div className="reflection-inner">
            <div className="article-badge-row">
              <span className="article-tag">
                <Clock aria-hidden="true" />
                {readTimeMin} min read &bull; {wordCount} words
              </span>
            </div>

            <div className="scroll-container">
              <div className="reading-width-wrapper">
                {showDropCap ? (
                  <div className="dropcap-container">
                    <span className={`dropcap-letter ${isEmoji ? 'is-emoji' : ''} ${isLowercase ? 'is-lowercase' : ''}`}>
                      {firstChar}
                    </span>
                    <span className="dropcap-body">
                      <FormattedText text={restText} align={reflectionAlign} />
                    </span>
                  </div>
                ) : (
                  <div className="standard-body">
                    <FormattedText text={reflection} align={reflectionAlign} />
                  </div>
                )}
              </div>
            </div>

            <div className="card-actions">
              {onExpandOverlay && (
                <button
                  className="action-btn icon-only"
                  type="button"
                  onClick={onExpandOverlay}
                  title="View Reading Overlay"
                  aria-label="View Reading Overlay"
                >
                  <Maximize2 aria-hidden="true" />
                </button>
              )}
              <button
                className="action-btn icon-only"
                type="button"
                onClick={onEdit}
                title="Edit Entry"
                aria-label="Edit Entry"
              >
                <Edit3 aria-hidden="true" />
              </button>
              <button
                className="action-btn danger icon-only"
                type="button"
                onClick={onDelete}
                title="Delete Entry"
                aria-label="Delete Entry"
              >
                <Trash2 aria-hidden="true" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

