const htmlEntities: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: '\u00a0',
  quot: '"',
}

/** Decode text entities without treating the decoded result as markup. */
export function decodeHtmlEntities(value?: string | null, maxPasses = 2) {
  let result = value || ''
  for (let pass = 0; pass < maxPasses; pass += 1) {
    const decoded = result.replace(/&(#(?:x[0-9a-f]+|\d+)|amp|apos|gt|lt|nbsp|quot);/gi, (match, entity: string) => {
      if (entity.startsWith('#')) {
        const isHex = entity[1]?.toLowerCase() === 'x'
        const codePoint = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10)
        if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return match
        try {
          return String.fromCodePoint(codePoint)
        } catch {
          return match
        }
      }
      return htmlEntities[entity.toLowerCase()] ?? match
    })
    if (decoded === result) break
    result = decoded
  }
  return result
}

export function cleanDisplayText(value?: string | null) {
  return decodeHtmlEntities(value)
    .replace(/\u00c2\u00b7/g, '\u00b7')
    .replace(/\u00e2\u20ac\u00a6/g, '\u2026')
    .replace(/\u00e2\u20ac\u201d/g, '\u2014')
    .replace(/\u00e2\u20ac\u201c/g, '\u2013')
    .replace(/\u00e2\u2020\u2019/g, '\u2192')
    .replace(/\u00e2\u2020\u2014/g, '\u2197')
    .replace(/\u00e2\u20ac\u0153/g, '\u201c')
    .replace(/\u00e2\u20ac\u009d/g, '\u201d')
    .replace(/\u00c3\u00a2\u00e2\u201a\u00ac\u00e2\u201e\u00a2/g, '\u2019')
    .replace(/\u00c3\u00a2\u00e2\u201a\u00ac\u00cb\u0153/g, '\u2018')
    .replace(/\u00e2\u201d\u20ac/g, '\u2500')
}

/** Decode entities inside HTML text nodes while preserving the markup structure. */
export function normalizeHtmlTextEntities(html?: string | null) {
  if (!html || typeof document === 'undefined') return html || ''
  const template = document.createElement('template')
  template.innerHTML = html
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    node.textContent = decodeHtmlEntities(node.textContent || '')
    node = walker.nextNode()
  }
  return template.innerHTML
}

export function isQuotedParagraph(value?: string | null) {
  const text = (value || '').trim()
  if (text.length < 2) return false
  const first = text[0]
  const last = text[text.length - 1]
  return (first === '"' && last === '"')
    || (first === '“' && last === '”')
    || (first === '„' && last === '”')
}

/** Turn fully quoted HTML paragraphs into independent blockquote elements. */
export function normalizeQuotedParagraphBlocks(html?: string | null) {
  if (!html || typeof document === 'undefined') return html || ''
  const template = document.createElement('template')
  template.innerHTML = html
  const candidates = Array.from(template.content.querySelectorAll('p, div')).reverse()

  candidates.forEach((element) => {
    if (element.querySelector('p, div, blockquote, ul, ol, li')) return
    if (!isQuotedParagraph(element.textContent)) return

    const blockquote = document.createElement('blockquote')
    blockquote.innerHTML = element.innerHTML
    if (element instanceof HTMLElement && element.style.cssText) {
      blockquote.style.cssText = element.style.cssText
    }
    element.replaceWith(blockquote)
  })

  return template.innerHTML
}

export function cleanMetadataChips<T extends { label: string; value: string }>(chips: T[]) {
  return chips.map((chip) => ({ ...chip, value: cleanDisplayText(chip.value) }))
}
