import { scoreGameTitleMatch, type MetadataResult } from '../../metadata'
import { UNIVERSAL_MEDIA_ENTITIES } from '../../data/universalMediaEntities'
import { resolveArtworkUrl } from '../../utils/artwork'

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function localGameMetadataResults(query: string): MetadataResult[] {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return []

  return Object.values(UNIVERSAL_MEDIA_ENTITIES)
    .filter((entity) => {
      if (entity.type !== 'game') return false
      const normalizedTitle = normalizeSearchText(entity.name)
      return normalizedTitle.includes(normalizedQuery) || normalizedQuery.includes(normalizedTitle)
    })
    .map((entity) => {
      const developer = entity.gameMetadata?.developers?.join(', ')
      const publisher = entity.gameMetadata?.publishers?.join(', ')
      const genres = entity.gameMetadata?.genres?.join(', ')
      return {
        id: entity.id,
        type: 'game' as const,
        title: entity.name,
        creator: developer || publisher || 'Game',
        provider: genres || entity.categoryLabel,
        providerId: entity.providerId || entity.id,
        genre: genres,
        coverUrl: resolveArtworkUrl(entity.artworkUrl, entity.name, 'Game'),
        year: entity.gameMetadata?.releaseDate?.match(/\b\d{4}\b/)?.[0],
        summary: entity.description,
        gameMetadata: entity.gameMetadata,
      }
    })
    .sort((left, right) => scoreGameTitleMatch(right.title, query) - scoreGameTitleMatch(left.title, query))
}

export function mergeMetadataSearchResults(...groups: MetadataResult[][]) {
  const flattened = groups.flat()
  const steamArtworkFallbackActive = flattened.some((result) =>
    result.type === 'game' && (
      Boolean(result.preferWikipediaArtwork) || /rawg|steam/i.test(result.gameMetadata?.metadataSource || '')
    ),
  )
  const seen = new Set<string>()
  return flattened
    .filter((result) => {
      const key = result.type === 'game'
        ? `${result.type}:${normalizeSearchText(result.title)}:${result.year || result.providerId || result.id}`
        : `${result.type}:${result.providerId || result.id}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map((result) => steamArtworkFallbackActive && result.type === 'game'
      ? { ...result, preferWikipediaArtwork: true }
      : result)
}
