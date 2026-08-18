import {
  entityImageCacheMap,
  type MetadataResult,
  type MetadataType,
} from '../../metadata'
import type { SearchMediaResult } from '../../components/Search/PrimarySearch'
import type { MediaEntityType, UniversalMediaEntity } from '../../types/mediaEntity'
import { createArtworkPlaceholder } from '../../utils/artwork'
import { MOCK_ENTITY_PROFILES } from '../../data/entityProfiles'
import { UNIVERSAL_MEDIA_ENTITIES } from '../../data/universalMediaEntities'

export function getSearchEntityArtwork(entity: {
  id: string
  title: string
  artworkUrl: string
  type: string
}) {
  const cleanTitle = entity.title.toLowerCase()
  const mockProfile = MOCK_ENTITY_PROFILES[entity.id]
  const universalEntity = UNIVERSAL_MEDIA_ENTITIES[entity.id]
  const isMusicMedia = entity.type === 'album' || entity.type === 'song'

  if (isMusicMedia) {
    return (
      entity.artworkUrl ||
      entityImageCacheMap.get(`${entity.type}:${entity.id}`) ||
      entityImageCacheMap.get(entity.id) ||
      universalEntity?.artworkUrl ||
      mockProfile?.coverUrl ||
      createArtworkPlaceholder(entity.title, entity.type)
    )
  }

  return (
    entityImageCacheMap.get(`${entity.type}:${entity.id}`) ||
    entityImageCacheMap.get(`${entity.type}:${cleanTitle}`) ||
    entityImageCacheMap.get(`wiki-portrait-v5:${cleanTitle}`) ||
    entityImageCacheMap.get(entity.id) ||
    entityImageCacheMap.get(cleanTitle) ||
    universalEntity?.artworkUrl ||
    mockProfile?.coverUrl ||
    entity.artworkUrl ||
    createArtworkPlaceholder(entity.title, entity.type)
  )
}

export type HeaderSearchEntity = {
  id: string
  title: string
  artworkUrl: string
  type: string
  creatorValue: string
  bio: string
  explicit?: boolean
  preferWikipediaArtwork?: boolean
  source: 'metadata' | 'universal'
  rank: number
  evidenceCount?: number
  evidenceSourceCount?: number
  metadataResult?: MetadataResult
  universalEntity?: UniversalMediaEntity
}

export function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function searchTokensMatch(searchableValue: string, normalizedQuery: string) {
  const queryTokens = normalizedQuery.split(' ').filter(Boolean)
  const searchableTokens = normalizeSearchText(searchableValue).split(' ').filter(Boolean)
  return queryTokens.length > 0 && queryTokens.every((queryToken) =>
    searchableTokens.some((searchableToken) =>
      searchableToken === queryToken || searchableToken.startsWith(queryToken),
    ),
  )
}

export function isYearOnlyMetadataMatch(result: MetadataResult, normalizedQuery: string): boolean {
  if (!/^\d{4}$/.test(normalizedQuery)) return false
  const titleMatches = normalizeSearchText(result.title).includes(normalizedQuery)
  const creatorMatches = normalizeSearchText(result.creator).includes(normalizedQuery)
  return !titleMatches && !creatorMatches
}

export function albumEntityIdFromMetadata(result: MetadataResult) {
  return result.providerId
    ? `album-${result.providerId}`
    : `album-${normalizeSearchText(result.title).replace(/\s+/g, '-')}`
}

export function metadataResultToSearchEntity(result: MetadataResult, rank: number): HeaderSearchEntity {
  return {
    id: result.type === 'album' ? albumEntityIdFromMetadata(result) : result.id,
    title: result.title,
    artworkUrl: result.coverUrl || '',
    type: result.type,
    creatorValue: result.creator,
    bio: result.provider || result.genre || '',
    explicit: result.explicit,
    preferWikipediaArtwork:
      result.type === 'game' && (
        Boolean(result.preferWikipediaArtwork) || /rawg|steam/i.test(result.gameMetadata?.metadataSource || '')
      ),
    source: 'metadata',
    rank,
    metadataResult: result,
  }
}

export function searchEntityMatchesQuery(entity: HeaderSearchEntity, normalizedQuery: string) {
  const searchableIdentity = [
    entity.title,
    entity.creatorValue.replace(/^[^:]+:\s*/, ''),
    searchResultYear(entity),
    entity.type,
    entity.bio,
  ].filter(Boolean).join(' ')
  return searchTokensMatch(searchableIdentity, normalizedQuery)
}

export function metadataResultMatchesQuery(result: MetadataResult, query: string) {
  return searchEntityMatchesQuery(
    metadataResultToSearchEntity(result, 0),
    normalizeSearchText(query),
  )
}

function universalEntityContext(entity: UniversalMediaEntity) {
  const chip = (pattern: RegExp) => entity.metadataChips.find((item) => pattern.test(item.label))?.value
  switch (entity.type) {
    case 'human':
      return undefined
    case 'movie':
    case 'tv':
      return chip(/year|release/i)?.match(/\b(?:18|19|20)\d{2}\b/)?.[0]
    case 'game':
      return entity.gameMetadata?.releaseDate?.match(/\b(?:18|19|20)\d{2}\b/)?.[0] ||
        chip(/year|release/i)?.match(/\b(?:18|19|20)\d{2}\b/)?.[0]
    case 'album':
    case 'song':
      return chip(/^artist$/i)
    case 'book':
      return chip(/^author$/i)
    default:
      return undefined
  }
}

export function buildEntityMetadataSearchQuery(entity: UniversalMediaEntity) {
  const context = universalEntityContext(entity)?.trim()
  if (!context || normalizeSearchText(entity.name).includes(normalizeSearchText(context))) return entity.name
  return `${entity.name} ${context}`
}

export function universalEntityToSearchEntity(entity: UniversalMediaEntity, rank: number): HeaderSearchEntity {
  const creatorChip = entity.metadataChips.find((chip) =>
    /artist|author|director|creator|developer|genre|known for/i.test(chip.label),
  )

  return {
    id: entity.id,
    title: entity.name,
    artworkUrl: entity.artworkUrl || '',
    type: entity.type,
    creatorValue: creatorChip ? `${creatorChip.label}: ${creatorChip.value}` : entity.categoryLabel,
    bio: entity.description || entity.categoryLabel,
    explicit: entity.explicit,
    preferWikipediaArtwork:
      entity.type === 'game' && (
        Boolean(entity.preferWikipediaArtwork) || /rawg|steam/i.test(entity.gameMetadata?.metadataSource || '')
      ),
    source: 'universal',
    rank,
    universalEntity: entity,
  }
}

export function artistRoleFromDescription(bio: string): string {
  const text = bio.toLowerCase()
  const patterns: Array<[RegExp, string]> = [
    [/singer[\s-]songwriter/, 'Singer-Songwriter'],
    [/songwriter/, 'Songwriter'],
    [/composer/, 'Composer'],
    [/rapper/, 'Rapper'],
    [/record producer|music producer/, 'Record Producer'],
    [/singer/, 'Singer'],
    [/duo/, 'Musical Duo'],
    [/band|group/, 'Musician'],
  ]
  for (const [re, label] of patterns) {
    if (re.test(text)) return label
  }
  return ''
}

export function isCollaborationCredit(value: string) {
  return /(?:\s&\s|\s\/\s|\s\+\s|\bfeat\.?\b|\bfeaturing\b|\bwith\b|,\s*)/i.test(value)
}

export function creatorEntityForMetadataType(type: MetadataType): {
  type: Extract<MediaEntityType, 'artist' | 'author' | 'director' | 'creator' | 'game_studio'>
  label: string
  bio: string
} {
  if (type === 'book') return { type: 'author', label: 'Author', bio: 'Author' }
  if (type === 'film') return { type: 'director', label: 'Director', bio: 'Film Director' }
  if (type === 'tv') return { type: 'creator', label: 'Creator', bio: 'Television Creator' }
  if (type === 'game') return { type: 'game_studio', label: 'Game Studio', bio: 'Game Studio' }
  return { type: 'artist', label: 'Artist', bio: 'Musician / Artist' }
}

export function shouldSuppressSynthesizedArtist(
  personType: MediaEntityType,
  competingTypes: Iterable<MediaEntityType>,
  hasKnownArtistProfile: boolean,
  artistEvidenceCount = 1,
) {
  if (personType !== 'artist' || hasKnownArtistProfile || artistEvidenceCount > 1) return false
  return Array.from(competingTypes).some((type) => type !== 'artist')
}

export function formatMediaSearchSubtitle(type: string, entity: { creatorValue: string; bio: string }) {
  const creator = entity.creatorValue.replace(/^[^:]+:\s*/, '').trim()
  if (type === 'artist') {
    const role = artistRoleFromDescription(entity.bio)
    return (role || creator).toUpperCase()
  }
  if (type === 'album') return creator.toUpperCase()
  const detail = entity.bio.replace(/\b(19|20)\d{2}\b/g, '').replace(/\s+/g, ' ').trim()
  return [creator, detail].filter(Boolean).join(' • ').toUpperCase()
}

// ── Header search result normalization ────────────────────────────────────────
// Media results are normalized into a category ("people", "books", ...) plus a
// distinct type ("artist", "author", ...) so the search UI can filter
// all creator types under a single "People" category while still showing each
// person's actual profession as its type badge.

export function searchCategoryAndType(entity: HeaderSearchEntity): {
  category: SearchMediaResult['category']
  type: SearchMediaResult['type']
} {
  switch (entity.type) {
    case 'human':
      return { category: 'people', type: 'human' }
    case 'artist':
      return { category: 'people', type: 'artist' }
    case 'author':
      return { category: 'people', type: 'author' }
    case 'director':
      return { category: 'people', type: 'director' }
    case 'creator':
      return { category: 'people', type: 'creator' }
    case 'actor':
      return { category: 'people', type: 'actor' }
    case 'game_studio':
      return { category: 'people', type: 'game_creator' }
    case 'album':
      return { category: 'albums', type: 'album' }
    case 'song':
      return { category: 'songs', type: 'song' }
    case 'book':
      return { category: 'books', type: 'book' }
    case 'movie':
    case 'film':
      return { category: 'films', type: 'film' }
    case 'tv':
    case 'show':
    case 'series':
      return { category: 'shows', type: 'show' }
    case 'game':
      return { category: 'games', type: 'game' }
    default: {
      const t = entity.type?.toLowerCase() || ''
      if (t.includes('film') || t.includes('movie')) return { category: 'films', type: 'film' }
      if (t.includes('album')) return { category: 'albums', type: 'album' }
      if (t.includes('song') || t.includes('track')) return { category: 'songs', type: 'song' }
      if (t.includes('book')) return { category: 'books', type: 'book' }
      if (t.includes('tv') || t.includes('show')) return { category: 'shows', type: 'show' }
      if (t.includes('game')) return { category: 'games', type: 'game' }
      return { category: 'albums', type: 'album' }
    }
  }
}

export function searchResultYear(entity: HeaderSearchEntity): string {
  if (entity.metadataResult?.year) return entity.metadataResult.year
  const yearChip = entity.universalEntity?.metadataChips.find((chip) =>
    /\b(19|20)\d{2}\b/.test(chip.value),
  )
  const yearMatch = yearChip?.value.match(/\b(19|20)\d{2}\b/)
  return yearMatch?.[0] || ''
}

export function searchResultSubtitle(entity: HeaderSearchEntity): string {
  const creator = entity.creatorValue.replace(/^[^:]+:\s*/, '').trim()
  const year = searchResultYear(entity)

  switch (entity.type) {
    case 'human':
      return creator || entity.universalEntity?.categoryLabel || 'Person'
    case 'artist': {
      const role = artistRoleFromDescription(entity.bio)
      return role || creator || 'Artist'
    }
    case 'author':
      return creator || 'Author'
    case 'director':
      return creator || 'Director'
    case 'creator':
      return creator || 'Creator'
    case 'actor':
      return creator || 'Actor'
    case 'game_studio':
      return creator || 'Game Studio'
    case 'album':
      return creator
    case 'song':
      return [creator, entity.bio].filter(Boolean).join(' · ')
    case 'book':
      return creator
    case 'movie':
    case 'film':
      return year || creator || 'Film'
    case 'tv':
    case 'show':
    case 'series': {
      const yearLabel = year ? `${year}–` : ''
      return yearLabel || creator || 'TV Show'
    }
    case 'game':
      return [creator, year].filter(Boolean).join(' · ')
    default:
      return creator
  }
}

export function toSearchMediaResult(entity: HeaderSearchEntity): SearchMediaResult {
  const { category, type } = searchCategoryAndType(entity)
  return {
    id: entity.id,
    name: entity.title,
    image: getSearchEntityArtwork(entity),
    category,
    type,
    subtitle: searchResultSubtitle(entity),
    explicit: entity.explicit,
    preferWikipediaArtwork: entity.preferWikipediaArtwork,
  }
}

export function getEntityPopularityScore(entity: HeaderSearchEntity): number {
  let score = 0
  if (entity.universalEntity) {
    const { count, average } = entity.universalEntity.communityRating
    score += count * average
  }

  if (entity.metadataResult?.gamePopularity) {
    score += entity.metadataResult.gamePopularity * 20
  }

  // Early API search ranks (rank 0, 1, 2) from iTunes / TMDB / IGDB reflect high global popularity
  const rankScore = Math.max(0, 12000 - entity.rank * 1000)
  score += rankScore

  // Keep first-class people discoverable without privileging a hardcoded list.
  if (entity.type === 'artist' || entity.type === 'author' || entity.type === 'director') {
    score += 5000
  }

  score += Math.min(entity.evidenceCount || 0, 20) * 250
  score += Math.min(entity.evidenceSourceCount || 0, 5) * 2500

  return score
}

export function getSearchEntityScore(entity: HeaderSearchEntity, normalizedQuery: string): number {
  const titleNorm = normalizeSearchText(entity.title)
  const rawCreator = entity.creatorValue.replace(/^[^:]+:\s*/, '')
  const creatorNorm = normalizeSearchText(rawCreator)

  const titleWords = titleNorm.split(' ').filter(Boolean)
  const creatorWords = creatorNorm.split(' ').filter(Boolean)

  const titleExact = titleNorm === normalizedQuery
  const creatorExact = creatorNorm === normalizedQuery

  const titleStartsWith = titleNorm.startsWith(normalizedQuery)
  const creatorStartsWith = creatorNorm.startsWith(normalizedQuery)

  const titleWordStartsWith = titleWords.some((w) => w.startsWith(normalizedQuery))
  const creatorWordStartsWith = creatorWords.some((w) => w.startsWith(normalizedQuery))

  const titleIncludes = titleNorm.includes(normalizedQuery)
  const creatorIncludes = creatorNorm.includes(normalizedQuery)
  const contextualIdentityMatch = searchEntityMatchesQuery(entity, normalizedQuery)

  let matchTier: number
  if (titleExact) {
    matchTier = 400000
  } else if (creatorExact) {
    matchTier = 370000
  } else if (contextualIdentityMatch) {
    matchTier = 350000
  } else if (titleStartsWith) {
    matchTier = 340000
  } else if (titleWordStartsWith) {
    matchTier = 320000
  } else if (creatorStartsWith) {
    matchTier = 300000
  } else if (creatorWordStartsWith) {
    matchTier = 280000
  } else if (titleIncludes) {
    matchTier = 220000
  } else if (creatorIncludes) {
    matchTier = 180000
  } else {
    matchTier = 100000
  }

  const popularity = getEntityPopularityScore(entity)
  const popularityBoost = Math.min(250000, popularity * 10)
  const artworkBonus = entity.artworkUrl ? 3000 : 0

  return matchTier + popularityBoost + artworkBonus
}

export function dedupeSearchEntities(entities: HeaderSearchEntity[]) {
  const seen = new Set<string>()
  return entities.filter((entity) => {
    const creatorKey = normalizeSearchText(entity.creatorValue.replace(/^[^:]+:\s*/, ''))
    const releaseYear = searchResultYear(entity)
    const usesReleaseIdentity = ['movie', 'film', 'tv', 'show', 'series', 'game'].includes(entity.type)
    const key = usesReleaseIdentity
      ? `${entity.type}:${normalizeSearchText(entity.title)}:${releaseYear || creatorKey}`
      : `${entity.type}:${normalizeSearchText(entity.title)}:${creatorKey}`
    const idKey = entity.id.toLowerCase()
    if (seen.has(idKey) || seen.has(key)) return false
    seen.add(idKey)
    seen.add(key)
    return true
  })
}
