export const MIN_MOST_QUOTED_CONTRIBUTORS = 2

export interface QuoteContribution {
  id: string
  text: string
  contributorHandle?: string
  contributorName?: string
  createdAt?: string
}

export interface CommunityQuoteGroup {
  id: string
  text: string
  normalizedText: string
  contributions: QuoteContribution[]
  contributorHandles: string[]
  uniqueContributorCount: number
  submissionCount: number
  wordingVariantCount: number
  latestContributionAt?: string
  score: number
}

export interface PossibleQuoteMatch {
  firstGroupId: string
  secondGroupId: string
  similarity: number
}

export interface CommunityQuoteRanking {
  ranked: CommunityQuoteGroup[]
  unmatched: CommunityQuoteGroup[]
  allGroups: CommunityQuoteGroup[]
  possibleMatches: PossibleQuoteMatch[]
  contributionCount: number
}

interface ExactQuoteGroup {
  normalizedText: string
  contributions: QuoteContribution[]
  contributorIds: Set<string>
  firstContributionIndex: number
}

interface MergedQuoteGroup {
  anchorNormalizedText: string
  exactGroups: ExactQuoteGroup[]
}

const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  hellip: '\u2026',
  ldquo: '\u201c',
  lsquo: '\u2018',
  lt: '<',
  nbsp: ' ',
  quot: '"',
  rdquo: '\u201d',
  rsquo: '\u2019',
}

function decodeHtmlEntities(value: string) {
  return value.replace(/&(#(?:x[0-9a-f]+|\d+)|[a-z]+);/gi, (entity, key: string) => {
    if (key.startsWith('#')) {
      const isHex = key[1]?.toLowerCase() === 'x'
      const rawCodePoint = key.slice(isHex ? 2 : 1)
      const codePoint = Number.parseInt(rawCodePoint, isHex ? 16 : 10)
      if (Number.isFinite(codePoint)) {
        try {
          return String.fromCodePoint(codePoint)
        } catch {
          return entity
        }
      }
      return entity
    }

    return NAMED_HTML_ENTITIES[key.toLowerCase()] ?? entity
  })
}

export function quoteToPlainText(value: string) {
  if (!value) return ''

  return decodeHtmlEntities(
    value
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<\/(?:blockquote|div|h[1-6]|li|p)>/gi, '\n')
      .replace(/<[^>]*>/g, ''),
  )
    .replace(/\u00a0/g, ' ')
    .split(/\r?\n/)
    .map((line) => line.replace(/[\t ]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim()
}

export function normalizeQuoteText(value: string) {
  return quoteToPlainText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en')
    .replace(/[\u2018\u2019\u02bc']/g, '')
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function contributorId(contribution: QuoteContribution) {
  const handle = contribution.contributorHandle?.replace(/^@/, '').trim().toLocaleLowerCase('en')
  if (handle) return `handle:${handle}`

  const name = contribution.contributorName?.trim().toLocaleLowerCase('en')
  if (name) return `name:${name}`

  // Entries without an identity must stay distinct; a shared "anonymous" key would
  // let one unknown contributor accidentally manufacture community consensus.
  return `entry:${contribution.id}`
}

function compareDates(left?: string, right?: string) {
  const leftTime = left ? new Date(left).getTime() : 0
  const rightTime = right ? new Date(right).getTime() : 0
  const safeLeft = Number.isFinite(leftTime) ? leftTime : 0
  const safeRight = Number.isFinite(rightTime) ? rightTime : 0
  return safeRight - safeLeft
}

function isSingleAdjacentTransposition(left: string, right: string) {
  if (left.length !== right.length || left === right) return false

  const mismatches: number[] = []
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) mismatches.push(index)
    if (mismatches.length > 2) return false
  }

  return mismatches.length === 2 &&
    mismatches[1] === mismatches[0] + 1 &&
    left[mismatches[0]] === right[mismatches[1]] &&
    left[mismatches[1]] === right[mismatches[0]]
}

function isRepeatedCharacterInsertion(left: string, right: string) {
  const shorter = left.length < right.length ? left : right
  const longer = left.length < right.length ? right : left
  if (longer.length !== shorter.length + 1) return false

  for (let index = 0; index < longer.length; index += 1) {
    const withoutCharacter = `${longer.slice(0, index)}${longer.slice(index + 1)}`
    if (withoutCharacter !== shorter) continue

    const removedCharacter = longer[index]
    return longer[index - 1] === removedCharacter || longer[index + 1] === removedCharacter
  }

  return false
}

function isHighConfidenceWordTypo(left: string, right: string) {
  if (Math.min(left.length, right.length) < 4) return false
  return isSingleAdjacentTransposition(left, right) || isRepeatedCharacterInsertion(left, right)
}

/**
 * Only unmistakable mechanical mistakes are merged automatically. Ordinary
 * substitutions are deliberately excluded because heart/heard-style changes
 * can produce a different sentence even when their edit distance is tiny.
 */
export function isHighConfidenceTypoMatch(left: string, right: string) {
  if (!left || !right || left === right) return false

  const leftTokens = left.split(' ')
  const rightTokens = right.split(' ')
  if (leftTokens.length !== rightTokens.length || leftTokens.length < 5) return false

  const differingIndexes: number[] = []
  leftTokens.forEach((token, index) => {
    if (token !== rightTokens[index]) differingIndexes.push(index)
  })

  if (differingIndexes.length !== 1) return false
  const typoIndex = differingIndexes[0]
  return isHighConfidenceWordTypo(leftTokens[typoIndex], rightTokens[typoIndex])
}

function levenshteinDistance(left: string, right: string) {
  if (left === right) return 0
  if (!left) return right.length
  if (!right) return left.length

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex]
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + substitutionCost,
      )
    }
    previous = current
  }

  return previous[right.length]
}

export function getQuoteSimilarity(left: string, right: string) {
  if (!left || !right) return 0
  if (left === right) return 1
  const longestLength = Math.max(left.length, right.length)
  return longestLength === 0 ? 1 : 1 - levenshteinDistance(left, right) / longestLength
}

function exactGroupSort(left: ExactQuoteGroup, right: ExactQuoteGroup) {
  return right.contributorIds.size - left.contributorIds.size ||
    right.contributions.length - left.contributions.length ||
    left.firstContributionIndex - right.firstContributionIndex
}

function groupSort(left: CommunityQuoteGroup, right: CommunityQuoteGroup) {
  return right.score - left.score ||
    right.uniqueContributorCount - left.uniqueContributorCount ||
    right.submissionCount - left.submissionCount ||
    compareDates(left.latestContributionAt, right.latestContributionAt) ||
    left.text.localeCompare(right.text)
}

function buildDisplayGroup(group: MergedQuoteGroup): CommunityQuoteGroup {
  const representative = [...group.exactGroups].sort(exactGroupSort)[0]
  const contributions = group.exactGroups
    .flatMap((exactGroup) => exactGroup.contributions)
    .sort((left, right) => compareDates(left.createdAt, right.createdAt))
  const uniqueContributors = new Set(contributions.map(contributorId))
  const contributorHandles = Array.from(new Set(
    contributions
      .map((contribution) => contribution.contributorHandle?.replace(/^@/, '').trim())
      .filter((handle): handle is string => Boolean(handle)),
  ))
  const latestContributionAt = contributions.find((contribution) => contribution.createdAt)?.createdAt
  const text = quoteToPlainText(representative.contributions[0]?.text || '')
  const uniqueContributorCount = uniqueContributors.size
  const submissionCount = contributions.length

  return {
    id: `community-quote-${representative.contributions[0]?.id || representative.firstContributionIndex}`,
    text,
    normalizedText: representative.normalizedText,
    contributions,
    contributorHandles,
    uniqueContributorCount,
    submissionCount,
    wordingVariantCount: group.exactGroups.length,
    latestContributionAt,
    score: uniqueContributorCount * 5 + submissionCount,
  }
}

function findPossibleMatches(groups: CommunityQuoteGroup[]) {
  const matches: PossibleQuoteMatch[] = []

  for (let firstIndex = 0; firstIndex < groups.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < groups.length; secondIndex += 1) {
      const first = groups[firstIndex]
      const second = groups[secondIndex]
      const shortestWordCount = Math.min(
        first.normalizedText.split(' ').length,
        second.normalizedText.split(' ').length,
      )
      if (shortestWordCount < 5) continue

      const similarity = getQuoteSimilarity(first.normalizedText, second.normalizedText)
      if (similarity < 0.88) continue

      matches.push({
        firstGroupId: first.id,
        secondGroupId: second.id,
        similarity,
      })
    }
  }

  return matches.sort((left, right) => right.similarity - left.similarity)
}

export function buildCommunityQuoteRanking(
  contributions: QuoteContribution[],
  minimumContributors = MIN_MOST_QUOTED_CONTRIBUTORS,
): CommunityQuoteRanking {
  const exactGroupsByText = new Map<string, ExactQuoteGroup>()

  contributions.forEach((contribution, index) => {
    const normalizedText = normalizeQuoteText(contribution.text)
    if (!normalizedText) return

    const existing = exactGroupsByText.get(normalizedText)
    if (existing) {
      existing.contributions.push(contribution)
      existing.contributorIds.add(contributorId(contribution))
      return
    }

    exactGroupsByText.set(normalizedText, {
      normalizedText,
      contributions: [contribution],
      contributorIds: new Set([contributorId(contribution)]),
      firstContributionIndex: index,
    })
  })

  const mergedGroups: MergedQuoteGroup[] = []
  Array.from(exactGroupsByText.values())
    .sort(exactGroupSort)
    .forEach((exactGroup) => {
      const matchingGroup = mergedGroups.find((group) =>
        isHighConfidenceTypoMatch(group.anchorNormalizedText, exactGroup.normalizedText),
      )

      if (matchingGroup) {
        matchingGroup.exactGroups.push(exactGroup)
      } else {
        mergedGroups.push({
          anchorNormalizedText: exactGroup.normalizedText,
          exactGroups: [exactGroup],
        })
      }
    })

  const allGroups = mergedGroups.map(buildDisplayGroup).sort(groupSort)
  const ranked = allGroups
    .filter((group) => group.uniqueContributorCount >= minimumContributors)
    .sort(groupSort)
  const unmatched = allGroups
    .filter((group) => group.uniqueContributorCount < minimumContributors)
    .sort(groupSort)

  return {
    ranked,
    unmatched,
    allGroups,
    possibleMatches: findPossibleMatches(allGroups),
    contributionCount: allGroups.reduce((total, group) => total + group.submissionCount, 0),
  }
}
