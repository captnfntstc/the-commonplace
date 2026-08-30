import type { GameMetadata, GamePlatformRelease, UniversalMediaEntity } from '../types/mediaEntity'

function chipValue(entity: UniversalMediaEntity, labels: RegExp) {
  return entity.metadataChips.find((chip) => labels.test(chip.label.trim()))?.value.trim()
}

function nonEmpty(values: Array<string | undefined>) {
  return values.filter((value): value is string => Boolean(value?.trim()))
}

function legacyPlatforms(entity: UniversalMediaEntity): GamePlatformRelease[] {
  const value = chipValue(entity, /^platforms?$/i)
  if (!value) return []

  return value
    .split(',')
    .map((platform) => platform.trim())
    .filter(Boolean)
    .map((platform) => ({ platform, status: 'available' }))
}

const costumeContentPattern = /\b(costumes?|outfits?|skins?|cosmetics?|wardrobes?|clothing|apparel|fashion|hairstyles?|make-?up|accessor(?:y|ies))\b/i

export function isCostumeOnlyGameContent(title: string) {
  return costumeContentPattern.test(title)
}

const patchUpdatePattern = /\s*[:\-\–\—]?\s*\b(patch|update|hotfix|build|ver\.?|version)\s*#?\d+(\.\d+)*\b.*/i

export function isPatchOrUpdateTitle(title: string): boolean {
  return patchUpdatePattern.test(title)
}

export function extractCanonicalGameTitle(title: string): string {
  if (!title) return ''
  const cleaned = title.replace(patchUpdatePattern, '').trim()
  return cleaned.length >= 3 ? cleaned : title
}

export function extractBaseGameTitle(title: string): string | undefined {
  if (!title) return undefined
  const canonicalTitle = extractCanonicalGameTitle(title)
  const clean = canonicalTitle.trim()
  const colonParts = clean.split(/\s*:\s*/)
  if (colonParts.length > 1) {
    const baseCandidate = colonParts[0].trim()
    if (baseCandidate.length >= 3 && baseCandidate.toLowerCase() !== clean.toLowerCase()) {
      return baseCandidate
    }
  }
  const hyphenParts = clean.split(/\s+[\-\–\—]\s+/)
  if (hyphenParts.length > 1) {
    const baseCandidate = hyphenParts[0].trim()
    if (baseCandidate.length >= 3 && baseCandidate.toLowerCase() !== clean.toLowerCase()) {
      return baseCandidate
    }
  }
  return undefined
}

function isSameGenerationGame(resultTitle: string, targetBaseTitle: string): boolean {
  const normResult = resultTitle.toLowerCase().trim()
  const normTarget = targetBaseTitle.toLowerCase().trim()

  if (!normResult.startsWith(normTarget)) return false

  const remainder = normResult.slice(normTarget.length).trim()
  // If the remainder starts with a number (e.g. " 2", " 3", " 4"), it's a different generation sequel!
  if (/^\d/.test(remainder)) return false

  return true
}

export function enrichSeriesRelatedContent(
  gameTitle: string,
  metadata: GameMetadata,
  seriesResults: Array<{ id: string; title: string; coverUrl?: string; year?: string; providerId?: string }> = [],
): GameMetadata['relatedContent'] {
  const existing = [...(metadata.relatedContent || []).filter((item) => !isCostumeOnlyGameContent(item.name))]
  const baseGameTitle = extractBaseGameTitle(gameTitle)
  const targetBaseTitle = baseGameTitle || gameTitle
  const normCurrent = gameTitle.toLowerCase().trim()
  const normTargetBase = targetBaseTitle.toLowerCase().trim()

  // Find artwork for base game if available in seriesResults
  const baseMatch = seriesResults.find((r) => r.title.toLowerCase().trim() === normTargetBase)
  const baseCoverUrl = baseMatch?.coverUrl || ''

  // 1. If viewing an expansion/DLC (e.g. "The Sims: Livin' Large" or "The Sims 3: Pets"), add Base Game if not present
  if (baseGameTitle) {
    const hasBaseEntry = existing.some(
      (item) => item.kind === 'base_game' || item.name.toLowerCase().trim() === normTargetBase,
    )
    if (!hasBaseEntry) {
      existing.unshift({
        providerId: baseMatch?.providerId || baseMatch?.id || `base:${normTargetBase.replace(/\s+/g, '-')}`,
        name: baseGameTitle,
        kind: 'base_game',
        description: `Base Game for ${gameTitle}`,
        coverUrl: baseCoverUrl,
      })
    }
  }

  // Ensure any existing base_game entry has artwork if available
  existing.forEach((item) => {
    if (item.kind === 'base_game' && !item.coverUrl && baseCoverUrl) {
      item.coverUrl = baseCoverUrl
    }
  })

  // 2. Incorporate series search results into related content (expansions, DLC, sequels)
  const seenNames = new Set(existing.map((item) => item.name.toLowerCase().trim()))
  seenNames.add(normCurrent)

  seriesResults.forEach((result) => {
    const normTitle = result.title.toLowerCase().trim()
    if (seenNames.has(normTitle)) return
    seenNames.add(normTitle)

    let kind: 'base_game' | 'expansion' | 'dlc' | 'sequel' = 'sequel'
    const isSameGen = isSameGenerationGame(result.title, targetBaseTitle)

    if (normTitle === normTargetBase) {
      kind = 'base_game'
    } else if (isSameGen) {
      if (/\b(dlc|add-?on|pass|dlc pack)\b/i.test(result.title)) {
        kind = 'dlc'
      } else {
        kind = 'expansion'
      }
    } else {
      kind = 'sequel'
    }

    existing.push({
      providerId: result.providerId || result.id,
      name: result.title,
      kind,
      releaseDate: result.year,
      coverUrl: result.coverUrl,
    })
  })

  return existing
}

export function normalizeGameMetadata(entity: UniversalMediaEntity): GameMetadata {
  const metadata = entity.gameMetadata || {}
  const developer = chipValue(entity, /^developers?$/i)
  const publisher = chipValue(entity, /^publishers?$/i)
  const genre = chipValue(entity, /^genres?$/i)
  const releaseDate = chipValue(entity, /^(release|released|pc release|standalone)$/i)
  const relatedContent = enrichSeriesRelatedContent(entity.name, metadata)

  return {
    ...metadata,
    developers: metadata.developers?.length ? metadata.developers : nonEmpty([developer]),
    publishers: metadata.publishers?.length ? metadata.publishers : nonEmpty([publisher]),
    genres: metadata.genres?.length ? metadata.genres : nonEmpty([genre]),
    releaseDate: metadata.releaseDate || releaseDate,
    platforms: metadata.platforms?.length ? metadata.platforms : legacyPlatforms(entity),
    relatedContent,
  }
}

export function primaryGameCreator(metadata: GameMetadata) {
  return metadata.developers?.[0] || metadata.publishers?.[0]
}

