import React from 'react'

export type Alignment = 'left' | 'center' | 'right' | 'justify'

export function stripHtmlAlignment(text: string): { cleanText: string; align?: Alignment } {
  if (!text) return { cleanText: '' }
  let align: Alignment | undefined = undefined

  const match = text.match(/(?:<div|<p)[^>]*style="[^"]*text-align:\s*(left|center|right|justify)/i) ||
                text.match(/<div align="(left|center|right|justify)"/i)
  if (match) {
    align = match[1].toLowerCase() as Alignment
  }

  return { cleanText: text, align }
}

function cleanHtmlContent(html: string): string {
  if (!html) return ''
  return html
    .replace(/<div><br><\/div>/gi, '<br>')
    .replace(/<p><br><\/p>/gi, '<br>')
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
}> = ({ text, align, className }) => {
  if (!text) return null

  const isHtml = /<[a-z][\s\S]*>/i.test(text)

  if (isHtml) {
    // HTML from the rich text editor: render as block HTML, let CSS handle spacing
    const cleaned = cleanHtmlContent(text)
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
      {parseInlineFormatting(text)}
    </div>
  )
}
