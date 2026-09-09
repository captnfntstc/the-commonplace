import { stripHtmlAlignment } from './FormattedText'

interface GraphemeSegment {
  segment: string
}

interface SegmenterInstance {
  segment: (value: string) => Iterable<GraphemeSegment>
}

type SegmenterConstructor = new (
  locales?: string | string[],
  options?: { granularity: 'grapheme' },
) => SegmenterInstance

function firstGrapheme(value: string) {
  const Segmenter = (Intl as typeof Intl & { Segmenter?: SegmenterConstructor }).Segmenter
  if (Segmenter) {
    const segments = Array.from(new Segmenter(undefined, { granularity: 'grapheme' }).segment(value))
    if (segments[0]) return segments[0].segment
  }
  return Array.from(value)[0] || ''
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
  const checkLowercase = (char: string) => (
    char === char.toLowerCase() && char !== char.toUpperCase()
  )

  if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(trimmed, 'text/html')
      let firstTextNode: Node | null = null
      const walk = (node: Node) => {
        if (firstTextNode) return
        if (node.nodeType === Node.TEXT_NODE && node.nodeValue?.trim()) {
          firstTextNode = node
          return
        }
        for (let child = node.firstChild; child; child = child.nextSibling) walk(child)
      }
      walk(doc.body)

      const textNode = firstTextNode as Node | null
      if (textNode) {
        const fullText = textNode.nodeValue || ''
        const leadingWhitespace = fullText.match(/^\s*/)?.[0] || ''
        const trimmedText = fullText.trimStart()
        const firstChar = firstGrapheme(trimmedText)
        textNode.nodeValue = leadingWhitespace + trimmedText.slice(firstChar.length)
        return {
          firstChar,
          restText: doc.body.innerHTML,
          isEmoji: /\p{Extended_Pictographic}|\p{Emoji_Presentation}/u.test(firstChar),
          isLowercase: checkLowercase(firstChar),
        }
      }
    } catch {
      // Fall back to plain text when DOM parsing is unavailable.
    }
  }

  const firstChar = firstGrapheme(trimmed)
  return {
    firstChar,
    restText: trimmed.slice(firstChar.length),
    isEmoji: /\p{Extended_Pictographic}|\p{Emoji_Presentation}/u.test(firstChar),
    isLowercase: checkLowercase(firstChar),
  }
}
