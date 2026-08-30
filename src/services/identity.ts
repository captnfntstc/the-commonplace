import type {
  HumanCapabilities,
  HumanProfileMetadata,
  IdentityCandidate,
  MediaEntityType,
  UniversalMediaEntity,
} from '../types/mediaEntity'
import { isMusicProfession, isWritingProfession, professionLabel } from '../features/profiles/humanProfile'
import { cleanDisplayText, cleanMetadataChips } from '../utils/text'
import { logApiCall } from './apiTracker'

export type IdentityProvider = 'wikidata' | 'tmdb' | 'musicbrainz' | 'itunes' | 'openlibrary'

type IdentitySearchResponse = {
  query: string
  candidates: IdentityCandidate[]
  sources: string[]
  cacheStatus?: 'HIT' | 'MISS'
}

type IdentityResolveResponse = {
  identity: IdentityCandidate
  cacheStatus?: 'HIT' | 'MISS'
}

async function identityRequest<T>(url: URL, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal })
  const payload = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) throw new Error(payload.error || `Identity request failed with HTTP ${response.status}.`)
  return payload
}

export async function searchIdentities(query: string, signal?: AbortSignal, limit = 10) {
  const url = new URL('/api/identities/search', window.location.origin)
  url.searchParams.set('q', query.trim())
  url.searchParams.set('limit', String(limit))
  const startedAt = performance.now()
  try {
    const result = await identityRequest<IdentitySearchResponse>(url, signal)
    logApiCall({
      provider: 'Identity',
      queryOrUrl: query.trim(),
      status: result.cacheStatus === 'HIT' ? 'CACHE' : 200,
      latencyMs: Math.round(performance.now() - startedAt),
      resultCount: result.candidates.length,
      cacheStatus: result.cacheStatus || 'MISS',
      identitySource: result.sources.join(', ') || 'none',
      candidateCount: result.candidates.length,
    })
    return result
  } catch (error) {
    if ((error as Error)?.name !== 'AbortError') {
      logApiCall({
        provider: 'Identity',
        queryOrUrl: query.trim(),
        status: 'ERROR',
        latencyMs: Math.round(performance.now() - startedAt),
        resultCount: 0,
        cacheStatus: 'MISS',
        candidateCount: 0,
        error: (error as Error)?.message || 'Identity search failed.',
      })
    }
    throw error
  }
}

export async function resolveIdentity(provider: IdentityProvider, id: string, signal?: AbortSignal) {
  const url = new URL('/api/identities/resolve', window.location.origin)
  url.searchParams.set('provider', provider)
  url.searchParams.set('id', id.trim())
  const startedAt = performance.now()
  try {
    const result = await identityRequest<IdentityResolveResponse>(url, signal)
    const identity = { ...result.identity, resolved: true }
    logApiCall({
      provider: 'Identity',
      queryOrUrl: `${provider}:${id.trim()}`,
      status: result.cacheStatus === 'HIT' ? 'CACHE' : 200,
      latencyMs: Math.round(performance.now() - startedAt),
      resultCount: 1,
      cacheStatus: result.cacheStatus || 'MISS',
      identitySource: provider,
      candidateCount: 1,
      resolutionResult: identity.canonicalId,
    })
    return { ...result, identity }
  } catch (error) {
    if ((error as Error)?.name !== 'AbortError') {
      logApiCall({
        provider: 'Identity',
        queryOrUrl: `${provider}:${id.trim()}`,
        status: 'ERROR',
        latencyMs: Math.round(performance.now() - startedAt),
        resultCount: 0,
        cacheStatus: 'MISS',
        identitySource: provider,
        candidateCount: 0,
        resolutionResult: 'unresolved',
        error: (error as Error)?.message || 'Identity resolution failed.',
      })
    }
    throw error
  }
}

function emptyCapabilities(overrides: Partial<HumanCapabilities> = {}): HumanCapabilities {
  return {
    topSongs: false,
    discography: false,
    filmography: false,
    publishedWorks: false,
    directing: false,
    creating: false,
    producing: false,
    writing: false,
    ...overrides,
  }
}

export function identityToUniversalEntity(identity: IdentityCandidate): UniversalMediaEntity {
  const isHuman = identity.kind === 'human'
  const hasWritingProfession = identity.professions.some(isWritingProfession)
  const hasVerifiedMusicCatalog = identity.professions.some(isMusicProfession) && Boolean(identity.providerIds.itunesArtistId)
  const humanProfile: HumanProfileMetadata | undefined = isHuman
    ? {
        canonicalId: identity.canonicalId,
        primaryProfession: identity.primaryProfession,
        professions: identity.professions,
        occupationLabels: identity.occupationLabels,
        providerIds: identity.providerIds,
        capabilities: emptyCapabilities({
          topSongs: hasVerifiedMusicCatalog,
          discography: hasVerifiedMusicCatalog,
          publishedWorks: hasWritingProfession,
          writing: hasWritingProfession,
        }),
      }
    : undefined
  const primaryLabel = identity.kind === 'music_group'
    ? 'Music Group'
    : professionLabel(identity.primaryProfession)

  return {
    id: identity.canonicalId,
    name: cleanDisplayText(identity.name),
    type: identity.kind as MediaEntityType,
    categoryLabel: primaryLabel,
    artworkUrl: identity.portraitUrl,
    description: cleanDisplayText(identity.description),
    humanProfile,
    identity,
    metadataChips: cleanMetadataChips([
      ...(identity.birthday || identity.birthYear
        ? [{ label: 'Birthday', value: identity.birthday || identity.birthYear || '' }]
        : []),
      ...(identity.country ? [{ label: 'From', value: identity.country }] : []),
    ]),
    communityRating: {
      average: 0,
      count: 0,
      distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    },
  }
}

export function providerReferenceFromEntity(entity: UniversalMediaEntity): { provider: IdentityProvider; id: string } | undefined {
  const ids = entity.identity?.providerIds || entity.humanProfile?.providerIds
  if (ids?.wikidataId) return { provider: 'wikidata', id: ids.wikidataId }
  if (ids?.tmdbPersonId) return { provider: 'tmdb', id: ids.tmdbPersonId }
  if (ids?.musicBrainzId) return { provider: 'musicbrainz', id: ids.musicBrainzId }
  if (ids?.openLibraryAuthorId) return { provider: 'openlibrary', id: ids.openLibraryAuthorId }
  if (ids?.itunesArtistId) return { provider: 'itunes', id: ids.itunesArtistId }

  const match = entity.id.match(/^(?:human|music-group):(tmdb|musicbrainz|openlibrary|itunes):(.+)$/i)
    || entity.id.match(/^(musicbrainz):artist:(.+)$/i)
  if (!match) return undefined
  return { provider: match[1].toLowerCase() as IdentityProvider, id: match[2] }
}
