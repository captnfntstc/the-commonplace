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

/**
 * Calculates the Damerau-Levenshtein distance between two strings,
 * supporting deletion, insertion, substitution, and adjacent transposition.
 */
export function damerauLevenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a) return b.length
  if (!b) return a.length

  const lenA = a.length
  const lenB = b.length
  const dp: number[][] = Array.from({ length: lenA + 1 }, () => Array(lenB + 1).fill(0))

  for (let i = 0; i <= lenA; i += 1) dp[i][0] = i
  for (let j = 0; j <= lenB; j += 1) dp[0][j] = j

  for (let i = 1; i <= lenA; i += 1) {
    for (let j = 1; j <= lenB; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      )
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1)
      }
    }
  }

  return dp[lenA][lenB]
}

export function isAdjacentTransposition(a: string, b: string): boolean {
  if (a.length !== b.length || a.length < 2) return false
  let diffCount = 0
  let idx = -1
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      diffCount += 1
      if (diffCount === 1) {
        idx = i
      } else if (diffCount === 2) {
        if (i !== idx + 1 || a[idx] !== b[i] || a[i] !== b[idx]) return false
      } else {
        return false
      }
    }
  }
  return diffCount === 2
}

/**
 * Checks if queryToken matches targetToken directly, as a prefix, or with a minor typo.
 * Prevents spurious short collisions (e.g. 3-letter words like red/bed) while allowing
 * genuine typos (e.g. tayler/taylor, beyonse/beyonce, kahn/kahan, tink/think).
 */
export function isFuzzyTokenMatch(queryToken: string, targetToken: string): boolean {
  if (queryToken === targetToken) return true
  if (targetToken.startsWith(queryToken)) return true
  if (queryToken.length <= 2) return false

  // Numeric tokens (years, track/volume numbers) must match strictly
  if (/^\d+$/.test(queryToken) || /^\d+$/.test(targetToken)) {
    return targetToken === queryToken || targetToken.startsWith(queryToken)
  }

  // 3-letter tokens: allow exact, prefix, or adjacent transposition only
  if (queryToken.length === 3) {
    return targetToken.length === 3 && isAdjacentTransposition(queryToken, targetToken)
  }

  const maxDist = queryToken.length <= 7 ? 1 : 2

  // Compare full tokens if length difference is within threshold
  if (Math.abs(queryToken.length - targetToken.length) <= maxDist) {
    if (damerauLevenshtein(queryToken, targetToken) <= maxDist) {
      return true
    }
  }

  // Prefix match with typo for longer tokens (e.g. query length >= 5)
  if (queryToken.length >= 5 && targetToken.length > queryToken.length) {
    const targetPrefix = targetToken.slice(0, queryToken.length)
    if (damerauLevenshtein(queryToken, targetPrefix) <= 1) {
      return true
    }
  }

  return false
}

/**
 * Checks if two normalized strings (e.g. full title or creator name) match fuzzily.
 */
export function isFuzzyStringMatch(target: string, query: string): boolean {
  if (target === query) return true
  const maxLen = Math.max(target.length, query.length)
  if (maxLen <= 3) return false
  if (maxLen === 4) {
    return isAdjacentTransposition(target, query)
  }

  const maxDist = maxLen <= 7 ? 1 : maxLen <= 15 ? 2 : 3
  if (Math.abs(target.length - query.length) > maxDist) return false
  return damerauLevenshtein(target, query) <= maxDist
}

export function normalizeSearchValue(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/**
 * Checks if a searchable text value satisfies a search query with typo tolerance.
 * - Handles numeric tokens (e.g. 1984 vs 2021) strictly.
 * - For multi-word queries, requires high token coverage (100% for 1-2 words, >= 75% for 3+ words).
 */
export function searchTokensMatch(searchableValue: string, query: string): boolean {
  const normSearchable = normalizeSearchValue(searchableValue)
  const normQuery = normalizeSearchValue(query)
  const queryTokens = normQuery.split(' ').filter(Boolean)
  const searchableTokens = normSearchable.split(' ').filter(Boolean)
  if (queryTokens.length === 0 || searchableTokens.length === 0) return false

  // Fast path: exact substring match
  if (normSearchable.includes(normQuery)) return true

  let matchCount = 0
  for (const queryToken of queryTokens) {
    const isNumeric = /^\d+$/.test(queryToken)
    const matched = searchableTokens.some((searchableToken) => {
      if (isNumeric) {
        return searchableToken === queryToken || searchableToken.startsWith(queryToken)
      }
      return isFuzzyTokenMatch(queryToken, searchableToken)
    })
    if (matched) matchCount += 1
  }

  // Numeric tokens must always match
  const numericTokens = queryTokens.filter((token) => /^\d+$/.test(token))
  for (const numToken of numericTokens) {
    const hasNum = searchableTokens.some((s) => s === numToken || s.startsWith(numToken))
    if (!hasNum) return false
  }

  const requiredMatches = queryTokens.length <= 2
    ? queryTokens.length
    : Math.ceil(queryTokens.length * 0.75)

  return matchCount >= requiredMatches
}

