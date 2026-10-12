import React from 'react'
import { stripHtmlAlignment, type Alignment } from './formattedTextUtils'
import {
  cleanDisplayText,
  decodeHtmlEntities,
  isQuotedParagraph,
  normalizeQuotedParagraphBlocks,
} from '../../utils/text'

export type { Alignment } from './formattedTextUtils'

const allowedRichTextTags = new Set([
  'A', 'B', 'BLOCKQUOTE', 'BR', 'DEL', 'DIV', 'EM', 'I', 'LI', 'OL', 'P', 'S', 'SPAN', 'STRONG', 'U', 'UL',
])

function cleanHtmlContent(html: string): string {
  if (!html) return ''
  const normalized = html
    .replace(/<div><br><\/div>/gi, '<br>')
    .replace(/<p><br><\/p>/gi, '<br>')
  if (typeof document === 'undefined') return cleanDisplayText(normalized)

  const source = document.createElement('template')
  source.innerHTML = normalized
  const output = document.createElement('div')

  const copyNode = (node: Node, parent: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      parent.appendChild(document.createTextNode(decodeHtmlEntities(node.textContent || '')))
      return
    }
    if (!(node instanceof HTMLElement)) return
    if (['IFRAME', 'OBJECT', 'SCRIPT', 'STYLE'].includes(node.tagName)) return
    if (!allowedRichTextTags.has(node.tagName)) {
      node.childNodes.forEach((child) => copyNode(child, parent))
      return
    }

    const element = document.createElement(node.tagName.toLowerCase())
    const alignment = node.style.textAlign || node.getAttribute('align') || ''
    if (/^(left|center|right|justify)$/i.test(alignment)) element.style.textAlign = alignment.toLowerCase()
    if (node.tagName === 'A') {
      const href = node.getAttribute('href') || ''
      if (/^(https?:|mailto:)/i.test(href)) {
        element.setAttribute('href', href)
        element.setAttribute('rel', 'noopener noreferrer')
      }
    }
    node.childNodes.forEach((child) => copyNode(child, element))
    parent.appendChild(element)
  }

  source.content.childNodes.forEach((node) => copyNode(node, output))
  return output.innerHTML
}

function reflowHtmlLineBlocks(html: string): string {
  if (!html || typeof document === 'undefined') return html

  const source = document.createElement('template')
  source.innerHTML = html
  const output = document.createElement('div')
  let paragraph: HTMLParagraphElement | null = null
  let paragraphAlignment = ''

  const flushParagraph = () => {
    if (!paragraph) return
    output.appendChild(paragraph)
    paragraph = null
    paragraphAlignment = ''
  }

  const appendLine = (node: Node, alignment = '') => {
    if (!paragraph || paragraphAlignment !== alignment) {
      flushParagraph()
      paragraph = document.createElement('p')
      paragraphAlignment = alignment
      if (alignment) paragraph.style.textAlign = alignment
    } else if (paragraph.textContent?.trim()) {
      paragraph.appendChild(document.createTextNode(' '))
    }

    if (node.nodeType === Node.TEXT_NODE) {
      paragraph.appendChild(document.createTextNode(node.textContent?.trim() || ''))
      return
    }

    const element = node as HTMLElement
    Array.from(element.childNodes).forEach((child) => paragraph?.appendChild(child.cloneNode(true)))
  }

  Array.from(source.content.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent?.trim()) appendLine(node)
      return
    }
    if (!(node instanceof HTMLElement)) return

    const isLineBlock = ['DIV'].includes(node.tagName)
      && !node.querySelector('blockquote, div, ol, p, ul')
      && Boolean(node.textContent?.trim())
    if (isLineBlock) {
      appendLine(node, node.style.textAlign || node.getAttribute('align') || '')
      return
    }

    flushParagraph()
    if (node.textContent?.trim() || !['DIV', 'P'].includes(node.tagName)) {
      output.appendChild(node.cloneNode(true))
    }
  })
  flushParagraph()
  return output.innerHTML
}

function parseInlineFormatting(raw: string): React.ReactNode[] {
  const regex = /(\*\*(.*?)\*\*|\*(.*?)\*|<u>(.*?)<\/u>|<b>(.*?)<\/b>|<i>(.*?)<\/i>|~(.*?)~)/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      parts.push(raw.substring(lastIndex, match.index))
    }

    if (match[2] !== undefined || match[5] !== undefined) {
      parts.push(<strong key={`b-${match.index}`}>{match[2] || match[5]}</strong>)
    } else if (match[3] !== undefined || match[6] !== undefined) {
      parts.push(<em key={`i-${match.index}`}>{match[3] || match[6]}</em>)
    } else if (match[4] !== undefined) {
      parts.push(<u key={`u-${match.index}`}>{match[4]}</u>)
    } else if (match[7] !== undefined) {
      parts.push(<del key={`s-${match.index}`}>{match[7]}</del>)
    }

    lastIndex = regex.lastIndex
  }

  if (lastIndex < raw.length) {
    parts.push(raw.substring(lastIndex))
  }

  return parts
}

export const FormattedText: React.FC<{
  text: string
  align?: Alignment
  className?: string
  reflowPlainText?: boolean
}> = React.memo(({ text, align, className, reflowPlainText = false }) => {
  if (!text) return null

  const isHtml = /<[a-z][\s\S]*>/i.test(text)

  if (isHtml) {
    // HTML from the rich text editor: render as block HTML, let CSS handle spacing
    const normalized = normalizeQuotedParagraphBlocks(text)
    const cleaned = cleanHtmlContent(reflowPlainText ? reflowHtmlLineBlocks(normalized) : normalized)
    const { align: extractedAlign } = stripHtmlAlignment(text)
    const finalAlign = align || extractedAlign

    return (
      <div
        className={`formatted-text-content rich-rendered-text ${className || ''}`}
        style={{
          textAlign: finalAlign,
          wordBreak: 'break-word',
          width: '100%',
        }}
        dangerouslySetInnerHTML={{ __html: cleaned }}
      />
    )
  }

  // Plain text (no HTML tags): use pre-wrap to preserve newlines
  const cleanedText = cleanDisplayText(text)
  const displayText = reflowPlainText
    ? cleanedText
        .split(/\r?\n\s*\r?\n+/)
        .map((paragraph) => paragraph.replace(/\s*\r?\n\s*/g, ' ').trim())
        .filter(Boolean)
        .join('\n\n')
    : cleanedText
  const paragraphs = displayText.split(/\r?\n+/).filter((paragraph) => paragraph.trim())
  const hasQuoteParagraph = paragraphs.some(isQuotedParagraph)

  return (
    <div
      className={`formatted-text-content rich-rendered-text ${className || ''}`}
      style={{
        textAlign: align || 'left',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        width: '100%',
      }}
    >
      {hasQuoteParagraph
        ? paragraphs.map((paragraph, index) => isQuotedParagraph(paragraph)
            ? <blockquote key={`quote-${index}`}>{parseInlineFormatting(paragraph.trim())}</blockquote>
            : <p key={`paragraph-${index}`}>{parseInlineFormatting(paragraph)}</p>)
        : parseInlineFormatting(displayText)}
    </div>
  )
})
