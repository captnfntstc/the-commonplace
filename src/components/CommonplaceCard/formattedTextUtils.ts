export type Alignment = 'left' | 'center' | 'right' | 'justify'

export function stripHtmlAlignment(text: string): { cleanText: string; align?: Alignment } {
  if (!text) return { cleanText: '' }
  let align: Alignment | undefined

  const match = text.match(/(?:<div|<p)[^>]*style="[^"]*text-align:\s*(left|center|right|justify)/i)
    || text.match(/<div align="(left|center|right|justify)"/i)
  if (match) align = match[1].toLowerCase() as Alignment

  return { cleanText: text, align }
}
