// ─────────────────────────────────────────────────────────────────────────────
// metadata.ts
// Fast, multi-provider API adapters with caching & fallbacks:
//   📚 Books      → Google Books API
//   🎬 Films/TV   → TMDB API
//   🎵 Songs      → iTunes Search API + MusicBrainz fallback
//   💿 Albums     → iTunes Search API + MusicBrainz fallback
//   🎮 Games      → IGDB + Steam fallback
//   🎵 Lyrics     → lrclib.net
// ─────────────────────────────────────────────────────────────────────────────
import { logApiCall, type ApiProvider } from './services/apiTracker'
import { resolveArtworkUrl } from './utils/artwork'
import { buildSongBiography, getSongReleaseKind } from './utils/songBio'
import type { GameMetadata, GameSystemRequirementSet, HumanScreenCredit, TopContentItem } from './types/mediaEntity'
import {
  clearBrowserCacheNamespace,
  deleteBrowserCacheValue,
  getBrowserCacheValue,
  setBrowserCacheValue,
} from './services/browserCache'

export type MetadataType = 'book' | 'album' | 'song' | 'film' | 'tv' | 'game'

export type MetadataResult = {
  id: string
  type: MetadataType
  title: string
  creator: string
  /** Publisher, label, year, studio, or genre */
  provider: string
  providerId: string
  genre?: string
  genres?: string[]
  language?: string
  coverUrl?: string
  year?: string
  summary?: string
  explicit?: boolean
  preferWikipediaArtwork?: boolean
  /** Game-only relevance returned by the IGDB query matcher. */
  gameSearchRelevance?: number
  /** Game-only popularity score derived from IGDB ratings, follows, and hype. */
  gamePopularity?: number
  gameMetadata?: GameMetadata
  /** Only populated by fetchLyrics — not present in search results */
  lyrics?: string
}

export function getMetadataProviderQuery(query: string, currentYear = new Date().getUTCFullYear()) {
  const trimmed = query.trim()
  const match = trimmed.match(/^(.+?)\s+((?:18|19|20)\d{2})$/)
  if (!match) return trimmed
  const year = Number(match[2])
  return year <= currentYear + 2 ? match[1].trim() : trimmed
}

// ─── Raw API shape types ──────────────────────────────────────────────────────

type GoogleBooksVolume = {
  id: string
  volumeInfo?: {
    title?: string
    subtitle?: string
    authors?: string[]
    publisher?: string
    publishedDate?: string
    description?: string
    imageLinks?: {
      extraLarge?: string
      large?: string
      medium?: string
      thumbnail?: string
      smallThumbnail?: string
    }
    categories?: string[]
    language?: string
  }
}

type TmdbItem = {
  id: number
  title?: string
  name?: string
  release_date?: string
  first_air_date?: string
  overview?: string
  poster_path?: string
  genre_ids?: number[]
  original_language?: string
}

export type TmdbTvSeason = {
  id: number
  name: string
  seasonNumber: number
  episodeCount: number
  overview?: string
  airDate?: string
  posterUrl?: string
}

export type TmdbTvEpisode = {
  id: number
  name: string
  seasonNumber: number
  episodeNumber: number
  overview?: string
  airDate?: string
  runtime?: number
  stillUrl?: string
}

const tmdbGenreMap: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
  10759: 'Action & Adventure',
  10762: 'Kids',
  10765: 'Sci-Fi & Fantasy',
}

async function fetchWikiCreator(
  title: string,
  type: 'film' | 'tv',
  signal?: AbortSignal,
): Promise<string> {
  try {
    const url = new URL('https://en.wikipedia.org/w/api.php')
    url.searchParams.set('action', 'query')
    url.searchParams.set(
      'titles',
      type === 'film' ? `${title} (film)|${title}` : `${title} (TV series)|${title}`,
    )
    url.searchParams.set('prop', 'extracts')
    url.searchParams.set('exintro', '1')
    url.searchParams.set('explaintext', '1')
    url.searchParams.set('format', 'json')
    url.searchParams.set('origin', '*')

    const res = await fetch(url, { signal })
    if (!res.ok) return ''
    const data = (await res.json()) as any
    const pages = data.query?.pages
    if (!pages) return ''
    const page = Object.values(pages)[0] as { extract?: string }
    const text = page?.extract || ''

    if (type === 'film') {
      const directorMatch = text.match(/directed by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i)
      if (directorMatch?.[1]) return directorMatch[1]
    } else {
      const creatorMatch = text.match(/created by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i)
      if (creatorMatch?.[1]) return creatorMatch[1]
    }
  } catch {
    // fallback empty
  }
  return ''
}

export const entityImageCacheMap = new Map<string, string>()
const preloadedImages = new Map<string, HTMLImageElement>()

export function preloadImage(url: string) {
  if (!url || typeof window === 'undefined') return
  if (url.startsWith('data:')) return
  if (preloadedImages.has(url)) return
  const img = new Image()
  img.referrerPolicy = 'no-referrer'
  img.fetchPriority = 'high'
  img.decoding = 'async'
  img.onload = () => {
    window.setTimeout(() => preloadedImages.delete(url), 120000)
  }
  img.onerror = () => {
    preloadedImages.delete(url)
  }
  preloadedImages.set(url, img)
  img.src = url
}

/**
 * Preloads an array of image URLs concurrently, skipping any already in cache.
 */
export function preloadImages(urls: string[]) {
  for (const url of urls) preloadImage(url)
}

/**
 * Staggered portrait pre-warm for similar artists.
 * Fires portrait fetches with a 80ms jitter between each artist so they all
 * begin resolving before the user scrolls to the section, without hammering
 * external APIs in a simultaneous burst.
 */
export function warmSimilarArtistPortraits(
  artists: Array<{ id: string; name: string; type?: string }>,
  signal?: AbortSignal,
) {
  artists.forEach((artist, i) => {
    const delay = i * 80
    const timer = window.setTimeout(async () => {
      if (signal?.aborted) return
      const cacheKey = `fanart-v2:${artist.name.toLowerCase().trim()}`
      const wikiKey = `wiki-portrait-v5:${artist.name.toLowerCase().trim()}`
      if (entityImageCacheMap.has(cacheKey) || entityImageCacheMap.has(wikiKey)) return
      try {
        const personType = artist.type === 'author' ? 'author' : 'artist'
        const url = personType === 'artist'
          ? await fetchArtistPortrait(artist.name, signal)
          : await fetchWikipediaPortrait(artist.name, signal, personType as WikipediaPersonType)
        if (url) preloadImage(url)
      } catch {
        // Ignore — this is a best-effort pre-warm
      }
    }, delay)
    signal?.addEventListener('abort', () => clearTimeout(timer), { once: true })
  })
}

export type WikipediaPersonType = 'artist' | 'author' | 'director' | 'creator' | 'actor'

export interface WikipediaProfile {
  title?: string
  portraitUrl: string
  description: string
  pageUrl: string
  pageId?: string
  wikidataId?: string
}

function wikipediaRoleHint(type?: WikipediaPersonType) {
  if (type === 'artist') return '(singer OR musician OR rapper OR band OR songwriter)'
  if (type === 'author') return '(author OR writer)'
  if (type === 'director') return 'film director'
  if (type === 'creator') return 'television creator'
  if (type === 'actor') return 'actor actress'
  return 'person'
}

function normalizeWikipediaTitle(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function wikipediaIdentityMatches(name: string, title: string, extract = '') {
  const requestedName = normalizeWikipediaTitle(name)
  const pageTitle = normalizeWikipediaTitle(title)
  if (!requestedName || !pageTitle) return false
  if (requestedName === pageTitle) return true

  const normalizedExtract = ` ${normalizeWikipediaTitle(extract)} `
  const aliasPhrases = [
    ` known professionally as ${requestedName} `,
    ` better known as ${requestedName} `,
    ` known as ${requestedName} `,
    ` stage name ${requestedName} `,
    ` stylized as ${requestedName} `,
  ]
  return requestedName.length >= 3 && aliasPhrases.some((phrase) => normalizedExtract.includes(phrase))
}

export function isWikipediaDisambiguationPage(page: {
  title?: string
  extract?: string
  pageprops?: Record<string, unknown>
}) {
  const pageProps = page.pageprops || {}
  return (
    Object.prototype.hasOwnProperty.call(pageProps, 'disambiguation') ||
    /\(disambiguation\)\s*$/i.test(page.title || '') ||
    /\bmay (?:also )?refer to\b/i.test((page.extract || '').slice(0, 500))
  )
}

export async function fetchWikipediaProfile(
  name: string,
  type?: WikipediaPersonType,
  signal?: AbortSignal,
): Promise<WikipediaProfile> {
  const cleanName = name.trim().toLowerCase()
  let queryName = name.trim()
  const wikidataMatch = queryName.match(/^(?:human:)?(Q\d+)$/i)
  if (wikidataMatch) {
    try {
      const wikidataUrl = new URL('https://www.wikidata.org/w/api.php')
      wikidataUrl.searchParams.set('action', 'wbgetentities')
      wikidataUrl.searchParams.set('ids', wikidataMatch[1].toUpperCase())
      wikidataUrl.searchParams.set('props', 'sitelinks')
      wikidataUrl.searchParams.set('sitefilter', 'enwiki')
      wikidataUrl.searchParams.set('format', 'json')
      wikidataUrl.searchParams.set('origin', '*')
      const response = await fetch(wikidataUrl, { signal })
      if (response.ok) {
        const data = await response.json() as {
          entities?: Record<string, { sitelinks?: { enwiki?: { title?: string } } }>
        }
        queryName = data.entities?.[wikidataMatch[1].toUpperCase()]?.sitelinks?.enwiki?.title || queryName
      }
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') throw error
    }
  }
  const role = type || 'person'
  const profileCacheKey = `wiki-profile-v5:${role}:${cleanName}`
  const portraitCacheKey = `wiki-portrait-v5:${cleanName}`
  const legacyPortraitCacheKey = `wiki-portrait:${cleanName}`

  const profile = await cachedApiRequest(profileCacheKey, signal, async () => {
    try {
      const url = new URL('https://en.wikipedia.org/w/api.php')
      url.searchParams.set('action', 'query')
      url.searchParams.set('generator', 'search')
      url.searchParams.set('gsrsearch', `intitle:"${queryName}" ${wikipediaRoleHint(type)}`)
      url.searchParams.set('gsrnamespace', '0')
      url.searchParams.set('gsrlimit', '10')
      url.searchParams.set('prop', 'pageimages|extracts|info|pageprops')
      url.searchParams.set('piprop', 'thumbnail|original')
      url.searchParams.set('pithumbsize', '800')
      url.searchParams.set('pilimit', '10')
      url.searchParams.set('exintro', '1')
      url.searchParams.set('explaintext', '1')
      url.searchParams.set('exlimit', '10')
      url.searchParams.set('inprop', 'url')
      url.searchParams.set('redirects', '1')
      url.searchParams.set('format', 'json')
      url.searchParams.set('origin', '*')

      const response = await fetch(url, { signal })
      if (!response.ok) return { portraitUrl: '', description: '', pageUrl: '' }

      const data = (await response.json()) as any
      const pages = Object.values(data.query?.pages || {}) as any[]
      const candidates = pages
        .filter((page) => !isWikipediaDisambiguationPage(page))
        .sort((left, right) => Number(left?.index || 999) - Number(right?.index || 999))
      const requestedTitle = normalizeWikipediaTitle(queryName)
      const page = candidates.find((candidate) =>
        normalizeWikipediaTitle(candidate?.title || '') === requestedTitle,
      ) || candidates.find((candidate) =>
        wikipediaIdentityMatches(queryName, candidate?.title || '', candidate?.extract || ''),
      )
      if (!page) return { portraitUrl: '', description: '', pageUrl: '' }

      return {
        title: page.title || queryName,
        portraitUrl: page.thumbnail?.source || page.original?.source || '',
        description: String(page.extract || '').trim(),
        pageUrl: page.canonicalurl || page.fullurl || '',
        pageId: page.pageid ? String(page.pageid) : undefined,
        wikidataId: typeof page.pageprops?.wikibase_item === 'string'
          ? page.pageprops.wikibase_item
          : undefined,
      }
    } catch {
      return { portraitUrl: '', description: '', pageUrl: '' }
    }
  })

  if (!profile.portraitUrl && !profile.description) {
    apiResponseCache.delete(profileCacheKey)
    void deleteBrowserCacheValue(API_CACHE_NAMESPACE, profileCacheKey)
    return profile
  }

  if (profile.portraitUrl) {
    preloadImage(profile.portraitUrl)
    entityImageCacheMap.set(portraitCacheKey, profile.portraitUrl)
    entityImageCacheMap.set(legacyPortraitCacheKey, profile.portraitUrl)
    entityImageCacheMap.set(cleanName, profile.portraitUrl)
  }

  return profile
}

export async function fetchWikipediaPortrait(
  name: string,
  signal?: AbortSignal,
  type?: WikipediaPersonType,
): Promise<string> {
  const cleanName = name.trim().toLowerCase()
  const existing = entityImageCacheMap.get(`wiki-portrait-v5:${cleanName}`)
  if (existing) return existing
  const profile = await fetchWikipediaProfile(name, type, signal)
  return profile.portraitUrl
}

type ArtistPortraitResponse = {
  artistType?: string
  imageUrl?: string
  musicBrainzId?: string
}

export function getArtistPortraitCacheKey(name: string) {
  return `fanart-artist-portrait-v1:${name.trim().toLowerCase()}`
}

/**
 * Uses Fanart.tv only when MusicBrainz identifies the artist as a Group.
 * Person/unknown results and missing band artwork fall back to Wikipedia.
 */
export async function fetchArtistPortrait(
  name: string,
  signal?: AbortSignal,
): Promise<string> {
  const cacheKey = getArtistPortraitCacheKey(name)
  const existing = entityImageCacheMap.get(cacheKey)
  if (existing) return existing

  try {
    // Keep this session-cached rather than in the 30-day metadata cache so a
    // newer Fanart.tv upload can be picked up on the user's next visit.
    const result = await sessionCachedApiRequest<ArtistPortraitResponse>(cacheKey, signal, async () => {
      const startTime = performance.now()
      const requestUrl = `/api/fanart/artist?name=${encodeURIComponent(name.trim())}`
      const response = await fetch(requestUrl, { signal })
      const latencyMs = Math.round(performance.now() - startTime)
      const payload = await response.json().catch(() => ({})) as ArtistPortraitResponse & { error?: string }

      logApiCall({
        provider: 'Fanart.tv',
        queryOrUrl: name,
        status: response.status,
        latencyMs,
        resultCount: payload.imageUrl ? 1 : 0,
        cacheStatus: 'MISS',
        error: response.ok ? undefined : payload.error || `Fanart.tv proxy HTTP ${response.status}`,
      })

      if (!response.ok) throw new Error(payload.error || 'Fanart.tv portrait request failed.')
      return payload
    })

    if (result.imageUrl) {
      entityImageCacheMap.set(cacheKey, result.imageUrl)
      preloadImage(result.imageUrl)
      return result.imageUrl
    }
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error
  }

  return fetchWikipediaPortrait(name, signal, 'artist')
}

export interface DiscographyItem {
  id: string
  title: string
  subtitle: string
  artworkUrl: string
  rating?: number
  year: string
  genre?: string
  language?: string
  artist?: string
  category: 'album' | 'ep' | 'single'
  explicit?: boolean
}

export type AlbumVersionKind =
  | 'standard'
  | 'deluxe'
  | 'expanded'
  | 'anniversary'
  | 'remaster'
  | 'rerecording'
  | 'named'

export interface AlbumVersionItem extends DiscographyItem {
  collectionId: string
  versionKind: AlbumVersionKind
  versionLabel: string
  trackCount: number
}

export interface AlbumVersionFamily {
  current: AlbumVersionItem
  canonical: AlbumVersionItem
  currentCollectionId: string
  canonicalCollectionId: string
  currentExplicit: boolean
  editions: AlbumVersionItem[]
  collectionIds: string[]
}

export interface AlbumVersionContext {
  albumName: string
  artistName: string
  year?: string
  collectionId: string
  trackCount?: number
}

export const albumEntityMap = new Map<
  string,
  { id: string; name: string; artist: string; artworkUrl: string; year: string; category: 'album' | 'ep' | 'single'; collectionId?: string; explicit?: boolean }
>()

function normalizeAlbumTitleForMatch(title: string): string {
  if (!title) return ''
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘]/g, "'")
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function catalogVariantSignals(title: string): Set<string> {
  const normalized = normalizeAlbumTitleForMatch(title)
  const signals = new Set<string>()
  const checks: Array<[string, RegExp]> = [
    ['anthology', /\banthology\b/],
    ['deluxe', /\bdeluxe\b/],
    ['taylor-version', /\btaylor s version\b|\btaylors version\b|\btv\b/],
    ['3am', /\b3am\b/],
    ['til-dawn', /\btil dawn\b|\btill dawn\b/],
    ['bonus', /\bbonus(?: track)?\b/],
    ['forever', /\bforever\b|\bwe ll all be here forever\b/],
    ['expanded', /\bexpanded\b/],
    ['platinum', /\bplatinum\b/],
    ['anniversary', /\banniversary\b/],
    ['special', /\bspecial\b/],
    ['complete', /\bcomplete\b/],
    ['remaster', /\bremaster(?:ed)?\b/],
    ['reissue', /\breissue\b/],
    ['acoustic', /\bacoustic\b/],
    ['live', /\blive\b/],
    ['remix', /\bremix\b/],
    ['radio-edit', /\bradio edit\b/],
    ['extended', /\bextended\b/],
    ['demo', /\bdemo\b/],
    ['from-vault', /\bfrom (?:the )?vault\b/],
    ['instrumental', /\binstrumental\b/],
    ['minute-version', /\b\d+ minute version\b/],
    ['edition', /\bedition\b/],
    ['spilled', /\bspilled\b/],
    ['clean', /\bclean\b/],
    ['explicit', /\bexplicit\b/],
  ]

  for (const [signal, pattern] of checks) {
    if (pattern.test(normalized)) signals.add(signal)
  }

  return signals
}

const albumEditionQualifierPattern = /\b(?:deluxe|expanded|anniversary|remaster(?:ed)?|reissue|bonus|special|complete|platinum|3am|til dawn|till dawn|spilled|forever|last of the bugs|clean|explicit|standard|edition|taylor'?s version|from (?:the )?vault|live|acoustic)\b/i

export function albumVersionBaseTitle(title: string): string {
  let value = String(title || '').trim()
  let previous = ''

  while (value && value !== previous) {
    previous = value
    value = value
      .replace(/\s*[([]([^\])]+)[\])]\s*$/i, (match, qualifier: string) =>
        albumEditionQualifierPattern.test(qualifier) ? '' : match)
      .replace(/\s*(?:-|:|–|—)\s*([^:–—-]+)$/i, (match, qualifier: string) =>
        albumEditionQualifierPattern.test(qualifier) ? '' : match)
      .trim()
  }

  return normalizeAlbumTitleForMatch(value || title)
}

function albumContentRatingTitle(title: string): string {
  return normalizeAlbumTitleForMatch(String(title || '')
    .replace(/\s*\((?:clean|explicit)(?: version| edition)?\)\s*$/i, '')
    .replace(/\s*\[(?:clean|explicit)(?: version| edition)?\]\s*$/i, '')
    .replace(/\s*(?:-|:)\s*(?:clean|explicit)(?: version| edition)?\s*$/i, ''))
}

function normalizedVersionTrackTitle(title: string) {
  return normalizeAlbumTitleForMatch(title
    .replace(/\s*[([](?:taylor'?s version|remaster(?:ed)?(?: \d{4})?|live|acoustic|clean|explicit)[\])]\s*$/i, '')
    .replace(/\s*(?:-|:)\s*(?:remaster(?:ed)?(?: \d{4})?|live|acoustic|clean|explicit)\s*$/i, ''))
}

function albumVersionKind(title: string): AlbumVersionKind {
  const normalized = normalizeAlbumTitleForMatch(title)
  if (/\btaylor s version\b|\btaylors version\b/.test(normalized)) return 'rerecording'
  if (/\bdeluxe\b/.test(normalized)) return 'deluxe'
  if (/\bexpanded\b|\bcomplete\b/.test(normalized)) return 'expanded'
  if (/\banniversary\b/.test(normalized)) return 'anniversary'
  if (/\bremaster(?:ed)?\b|\breissue\b/.test(normalized)) return 'remaster'
  return normalized === albumVersionBaseTitle(title) || albumContentRatingTitle(title) === albumVersionBaseTitle(title)
    ? 'standard'
    : 'named'
}

function albumVersionLabel(title: string, kind = albumVersionKind(title)) {
  const parenthetical = title.match(/[([]([^\])]+)[\])]\s*$/)?.[1]?.trim()
  const suffix = title.match(/\s*(?:-|:|–|—)\s*([^:–—-]+)$/)?.[1]?.trim()
  const namedLabel = parenthetical || (suffix && albumEditionQualifierPattern.test(suffix) ? suffix : '')
  if (namedLabel) return namedLabel
  if (kind === 'standard') return 'Standard Edition'
  if (kind === 'deluxe') return 'Deluxe Edition'
  if (kind === 'expanded') return 'Expanded Edition'
  if (kind === 'anniversary') return 'Anniversary Edition'
  if (kind === 'remaster') return 'Remastered Edition'
  if (kind === 'rerecording') return "Taylor's Version"
  return 'Other Edition'
}

function scoreCatalogTitleMatch(candidateName: string, requestedName: string): number {
  const candidate = normalizeAlbumTitleForMatch(candidateName)
  const requested = normalizeAlbumTitleForMatch(requestedName)
  if (!candidate || !requested) return 0

  let score = 0
  // A full normalized title is the release identity. Track counts and artwork
  // are only tie-breakers and must never turn a deluxe/expanded edition into
  // the requested standard album (or vice versa).
  if (candidate === requested) score += 12000
  else if (candidate.includes(requested)) score += 1500
  else if (requested.includes(candidate)) score += 900

  const requestedTokens = new Set(requested.split(' ').filter(Boolean))
  const candidateTokens = new Set(candidate.split(' ').filter(Boolean))
  for (const token of requestedTokens) {
    if (candidateTokens.has(token)) score += 20
  }
  const extraCandidateTokens = [...candidateTokens].filter((token) => !requestedTokens.has(token)).length
  const missingRequestedTokens = [...requestedTokens].filter((token) => !candidateTokens.has(token)).length
  score -= extraCandidateTokens * 90
  score -= missingRequestedTokens * 180

  const requestedSignals = catalogVariantSignals(requestedName)
  const candidateSignals = catalogVariantSignals(candidateName)
  for (const signal of requestedSignals) {
    if (signal === 'taylor-version') {
      score += candidateSignals.has(signal) ? 3000 : -3000
    } else {
      score += candidateSignals.has(signal) ? 120 : -180
    }
  }
  for (const signal of candidateSignals) {
    if (!requestedSignals.has(signal)) {
      if (signal === 'taylor-version') {
        score -= 2500
      } else {
        score -= requestedSignals.size === 0 ? 70 : 35
      }
    }
  }

  return score
}

function collectionIdFromAlbumEntityId(id: string): string | undefined {
  const match = id.match(/^(?:(?:itunes:)?album[-:]?)?(\d+)$/i)
  return match?.[1]
}

function isOfficialArtistMatch(candidateArtist: string | undefined, requestedArtist?: string): boolean {
  if (!requestedArtist) return true
  return normalizeAlbumTitleForMatch(candidateArtist || '') === normalizeAlbumTitleForMatch(requestedArtist)
}

function selectBestAlbumCollection(
  albums: ITunesSearchResult[],
  requestedAlbum: string,
  requestedArtist?: string,
  expectedTrackCount?: number,
  expectedYear?: string,
): ITunesSearchResult | undefined {
  let bestAlbum: ITunesSearchResult | undefined
  let bestScore = -Infinity

  for (const album of albums) {
    if (!album.collectionId || !album.collectionName) continue
    if (!isOfficialArtistMatch(album.artistName || album.collectionArtistName, requestedArtist)) continue
    if (normalizeAlbumTitleForMatch(album.collectionName) !== normalizeAlbumTitleForMatch(requestedAlbum)) continue
    const officialArtistScore = requestedArtist ? 420 : 0
    const trackCount = Number(album.trackCount || 0)
    const expectedTrackScore =
      expectedTrackCount && trackCount === expectedTrackCount
        ? 1000
        : expectedTrackCount && trackCount > 0
          ? -Math.abs(expectedTrackCount - trackCount) * 120
          : 0
    const artworkScore = album.artworkUrl100 ? 40 : 0
    const candidateYear = yearFrom(album.releaseDate) || ''
    if (expectedYear && candidateYear !== expectedYear) continue
    const releaseYearScore = expectedYear
      ? candidateYear === expectedYear
        ? 1200
        : candidateYear
          ? -Math.min(1800, Math.abs(Number(candidateYear) - Number(expectedYear)) * 300)
          : -600
      : 0
    const score =
      scoreCatalogTitleMatch(album.collectionName, requestedAlbum) +
      officialArtistScore +
      expectedTrackScore +
      releaseYearScore +
      artworkScore

    if (score > bestScore) {
      bestScore = score
      bestAlbum = album
    }
  }

  return bestAlbum
}

function albumLookupMatchesContext(
  items: ITunesSearchResult[],
  requestedAlbum: string,
  requestedArtist?: string,
  expectedYear?: string,
) {
  const collection = items.find((item) => item.wrapperType === 'collection')
  const firstTrack = items.find((item) => item.wrapperType === 'track' || item.kind === 'song')
  const title = collection?.collectionName || firstTrack?.collectionName || ''
  const artist = collection?.artistName || collection?.collectionArtistName || firstTrack?.artistName || ''
  const releaseYear = yearFrom(collection?.releaseDate || firstTrack?.releaseDate) || ''

  if (normalizeAlbumTitleForMatch(title) !== normalizeAlbumTitleForMatch(requestedAlbum)) return false
  if (requestedArtist && !isOfficialArtistMatch(artist, requestedArtist)) return false
  if (expectedYear && releaseYear !== expectedYear) return false
  return true
}

async function fetchItunesAlbumLookup(collectionId: string, signal?: AbortSignal) {
  const url = `https://itunes.apple.com/lookup?id=${encodeURIComponent(collectionId)}&entity=song&limit=300`
  const response = await fetch(url, { signal })
  if (!response.ok) return []
  const data = (await response.json()) as { results?: ITunesSearchResult[] }
  return data.results || []
}

type HydratedAlbumVersion = {
  item: AlbumVersionItem
  normalizedTitle: string
  trackTitles: Set<string>
  overlap: number
}

function albumTrackOverlap(left: Set<string>, right: Set<string>) {
  const smallerSize = Math.min(left.size, right.size)
  if (smallerSize === 0) return { count: 0, ratio: 0 }
  let count = 0
  for (const title of left) {
    if (right.has(title)) count += 1
  }
  return { count, ratio: count / smallerSize }
}

function albumVersionTitleRelationship(leftTitle: string, rightTitle: string) {
  const left = normalizeAlbumTitleForMatch(leftTitle)
  const right = normalizeAlbumTitleForMatch(rightTitle)
  if (!left || !right) return 0
  if (albumVersionBaseTitle(leftTitle) === albumVersionBaseTitle(rightTitle)) return 1000
  if (albumContentRatingTitle(leftTitle) === albumContentRatingTitle(rightTitle)) return 900
  if (left.startsWith(`${right} `) || right.startsWith(`${left} `)) return 800
  return 0
}

function mapAlbumVersionItem(
  collection: ITunesSearchResult,
  tracks: ITunesSearchResult[],
): AlbumVersionItem | undefined {
  if (!collection.collectionId || !collection.collectionName) return undefined
  const title = collection.collectionName
  const year = yearFrom(collection.releaseDate || tracks[0]?.releaseDate) || ''
  const artist = collection.artistName || collection.collectionArtistName || tracks[0]?.artistName || ''
  const explicit = isExplicitItunesItem(collection) || tracks.some((track) => isExplicitItunesTrack(track))
  const trackCount = Number(collection.trackCount || tracks[0]?.trackCount || tracks.length || 0)
  const versionKind = albumVersionKind(title)
  return {
    id: `album-${collection.collectionId}`,
    collectionId: String(collection.collectionId),
    title,
    subtitle: `${albumVersionLabel(title, versionKind)}${year ? ` · ${year}` : ''}${trackCount ? ` · ${trackCount} tracks` : ''}`,
    artworkUrl: formatITunesArt(collection.artworkUrl100 || tracks[0]?.artworkUrl100, title) || '',
    artist,
    year,
    genre: collection.primaryGenreName || tracks[0]?.primaryGenreName,
    category: classifyItunesDiscographyRelease(title, trackCount),
    explicit,
    versionKind,
    versionLabel: albumVersionLabel(title, versionKind),
    trackCount,
  }
}

export async function fetchItunesAlbumVersionFamily(
  context: AlbumVersionContext,
  signal?: AbortSignal,
): Promise<AlbumVersionFamily | null> {
  const cleanAlbum = context.albumName.trim()
  const cleanArtist = context.artistName.trim()
  const collectionId = collectionIdFromAlbumEntityId(context.collectionId) || context.collectionId
  if (!cleanAlbum || !cleanArtist || !/^\d+$/.test(collectionId)) return null

  const cacheKey = [
    'itunes-album-version-family-v3',
    normalizeAlbumTitleForMatch(cleanAlbum),
    normalizeAlbumTitleForMatch(cleanArtist),
    context.year || '',
    collectionId,
    context.trackCount || 0,
  ].join(':')

  return cachedApiRequest(cacheKey, signal, async () => {
    try {
      const currentLookup = await fetchItunesAlbumLookup(collectionId, signal)
      const currentCollection = currentLookup.find(
        (item) => item.wrapperType === 'collection' && String(item.collectionId || '') === collectionId,
      )
      const currentTracks = currentLookup.filter(
        (item) => (item.wrapperType === 'track' || item.kind === 'song') &&
          String(item.collectionId || '') === collectionId,
      )
      const currentItem = currentCollection ? mapAlbumVersionItem(currentCollection, currentTracks) : undefined
      if (!currentCollection || !currentItem || currentTracks.length === 0) return null

      const currentTrackTitles = new Set(currentTracks
        .map((track) => normalizedVersionTrackTitle(track.trackName || ''))
        .filter(Boolean))
      if (currentTrackTitles.size === 0) return null

      const artistId = await fetchItunesExactArtistId(cleanArtist, signal)
      const searchUrl = new URL('https://itunes.apple.com/search')
      searchUrl.searchParams.set('term', `${albumVersionBaseTitle(cleanAlbum)} ${cleanArtist}`)
      searchUrl.searchParams.set('entity', 'album')
      searchUrl.searchParams.set('limit', '50')
      const artistUrl = artistId
        ? `https://itunes.apple.com/lookup?id=${encodeURIComponent(String(artistId))}&entity=album&limit=200`
        : ''

      const [searchResponse, artistResponse] = await Promise.all([
        fetch(searchUrl, { signal }),
        artistUrl ? fetch(artistUrl, { signal }) : Promise.resolve(null),
      ])
      const searchData = searchResponse.ok
        ? await searchResponse.json() as { results?: ITunesSearchResult[] }
        : { results: [] }
      const artistData = artistResponse?.ok
        ? await artistResponse.json() as { results?: ITunesSearchResult[] }
        : { results: [] }

      const currentArtistId = Number(currentCollection.artistId || 0)
      const currentYear = Number(currentItem.year || context.year || 0)
      const currentTrackCount = currentTrackTitles.size
      const candidatesById = new Map<string, ITunesSearchResult>()
      for (const candidate of [currentCollection, ...(searchData.results || []), ...(artistData.results || [])]) {
        const candidateId = String(candidate.collectionId || '')
        if (!candidateId || !candidate.collectionName) continue
        if (currentArtistId && candidate.artistId && Number(candidate.artistId) !== currentArtistId) continue
        if (!isOfficialArtistMatch(candidate.artistName || candidate.collectionArtistName, cleanArtist)) continue
        const titleRelationship = albumVersionTitleRelationship(candidate.collectionName, cleanAlbum)
        const candidateYear = Number(yearFrom(candidate.releaseDate) || 0)
        const candidateTrackCount = Number(candidate.trackCount || 0)
        const trackCountRatio = candidateTrackCount && currentTrackCount
          ? Math.min(candidateTrackCount, currentTrackCount) / Math.max(candidateTrackCount, currentTrackCount)
          : 0
        const plausibleByReleaseContext =
          candidateId === collectionId ||
          (currentYear > 0 && candidateYear > 0 && Math.abs(currentYear - candidateYear) <= 2 && trackCountRatio >= 0.55)
        if (titleRelationship === 0 && !plausibleByReleaseContext) continue
        if (!candidatesById.has(candidateId)) candidatesById.set(candidateId, candidate)
      }

      const candidates = [...candidatesById.values()]
        .sort((left, right) => {
          const leftCurrent = String(left.collectionId) === collectionId ? 1 : 0
          const rightCurrent = String(right.collectionId) === collectionId ? 1 : 0
          if (leftCurrent !== rightCurrent) return rightCurrent - leftCurrent
          const leftExact = normalizeAlbumTitleForMatch(left.collectionName || '') === normalizeAlbumTitleForMatch(cleanAlbum) ? 1 : 0
          const rightExact = normalizeAlbumTitleForMatch(right.collectionName || '') === normalizeAlbumTitleForMatch(cleanAlbum) ? 1 : 0
          if (leftExact !== rightExact) return rightExact - leftExact
          const relationshipDifference =
            albumVersionTitleRelationship(right.collectionName || '', cleanAlbum) -
            albumVersionTitleRelationship(left.collectionName || '', cleanAlbum)
          if (relationshipDifference !== 0) return relationshipDifference
          const leftYear = Number(yearFrom(left.releaseDate) || 0)
          const rightYear = Number(yearFrom(right.releaseDate) || 0)
          return Math.abs(leftYear - currentYear) - Math.abs(rightYear - currentYear)
        })

      const hydrated = (await Promise.all(candidates.map(async (candidate) => {
        const candidateId = String(candidate.collectionId || '')
        const lookup = candidateId === collectionId
          ? currentLookup
          : await fetchItunesAlbumLookup(candidateId, signal)
        const collection = lookup.find(
          (item) => item.wrapperType === 'collection' && String(item.collectionId || '') === candidateId,
        ) || candidate
        const tracks = lookup.filter(
          (item) => (item.wrapperType === 'track' || item.kind === 'song') &&
            String(item.collectionId || '') === candidateId,
        )
        const item = mapAlbumVersionItem(collection, tracks)
        if (!item || tracks.length === 0) return undefined
        const trackTitles = new Set(tracks
          .map((track) => normalizedVersionTrackTitle(track.trackName || ''))
          .filter(Boolean))
        const overlap = candidateId === collectionId
          ? { count: currentTrackTitles.size, ratio: 1 }
          : albumTrackOverlap(currentTrackTitles, trackTitles)
        const minimumOverlap = Math.min(3, Math.min(currentTrackTitles.size, trackTitles.size))
        if (overlap.count < minimumOverlap || overlap.ratio < 0.6) return undefined
        return {
          item,
          normalizedTitle: albumContentRatingTitle(item.title),
          trackTitles,
          overlap: overlap.ratio,
        } satisfies HydratedAlbumVersion
      }))).filter((item): item is HydratedAlbumVersion => Boolean(item))

      const current = hydrated.find((candidate) => candidate.item.collectionId === collectionId)
      if (!current) return null

      const canonical = [...hydrated]
        .sort((left, right) => {
          const score = (candidate: HydratedAlbumVersion) =>
            (candidate.item.versionKind === 'standard' ? 1000 : 0) +
            (candidate.item.explicit ? 200 : 0) +
            Math.max(0, 100 - Math.abs(Number(candidate.item.year || context.year || 0) - Number(context.year || candidate.item.year || 0)))
          return score(right) - score(left) || left.item.title.localeCompare(right.item.title)
        })[0]?.item || current.item

      const editionGroups = new Map<string, HydratedAlbumVersion[]>()
      hydrated
        .filter((candidate) => {
          if (candidate.item.collectionId === collectionId) return false
          if (
            candidate.normalizedTitle === current.normalizedTitle &&
            candidate.item.explicit === current.item.explicit
          ) {
            const identityOverlap = albumTrackOverlap(current.trackTitles, candidate.trackTitles)
            const identityRatio = identityOverlap.count / Math.max(current.trackTitles.size, candidate.trackTitles.size)
            if (identityRatio >= 0.9) return false
          }
          return true
        })
        .forEach((candidate) => {
          const key = `${candidate.normalizedTitle}:${candidate.item.explicit ? 'explicit' : 'clean'}`
          const group = editionGroups.get(key) || []
          group.push(candidate)
          editionGroups.set(key, group)
        })
      const editions = [...editionGroups.values()]
        .map((group) => [...group].sort((left, right) =>
          right.overlap - left.overlap ||
          Number(right.item.year === current.item.year) - Number(left.item.year === current.item.year),
        )[0])
        .map((candidate) => {
          const isCleanCounterpart = !candidate.item.explicit && hydrated.some((sibling) => {
            if (!sibling.item.explicit || sibling.normalizedTitle !== candidate.normalizedTitle) return false
            if (sibling.trackTitles.size !== candidate.trackTitles.size) return false
            return albumTrackOverlap(sibling.trackTitles, candidate.trackTitles).ratio >= 0.9
          })
          if (!isCleanCounterpart) return candidate.item
          return {
            ...candidate.item,
            versionLabel: 'Clean Edition',
            subtitle: `Clean Edition${candidate.item.year ? ` · ${candidate.item.year}` : ''}${candidate.item.trackCount ? ` · ${candidate.item.trackCount} tracks` : ''}`,
          }
        })
        .sort((left, right) => {
          if (left.collectionId === canonical.collectionId) return -1
          if (right.collectionId === canonical.collectionId) return 1
          if (left.versionKind === 'standard' && right.versionKind !== 'standard') return -1
          if (right.versionKind === 'standard' && left.versionKind !== 'standard') return 1
          return Number(left.year || 0) - Number(right.year || 0) || left.title.localeCompare(right.title)
        })

      for (const candidate of hydrated) {
        albumEntityMap.set(candidate.item.id, {
          id: candidate.item.id,
          name: candidate.item.title,
          artist: candidate.item.artist || cleanArtist,
          artworkUrl: candidate.item.artworkUrl,
          year: candidate.item.year,
          category: candidate.item.category,
          collectionId: candidate.item.collectionId,
          explicit: candidate.item.explicit,
        })
      }

      return {
        current: current.item,
        canonical,
        currentCollectionId: collectionId,
        canonicalCollectionId: canonical.collectionId,
        currentExplicit: Boolean(current.item.explicit),
        editions,
        collectionIds: hydrated.map((candidate) => candidate.item.collectionId),
      }
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') throw error
      return null
    }
  })
}

async function fetchBestItunesAlbumCollection(
  albumName: string,
  artistName?: string,
  signal?: AbortSignal,
  expectedTrackCount?: number,
  expectedYear?: string,
): Promise<ITunesSearchResult | undefined> {
  const query = artistName ? `${albumName} ${artistName}` : albumName
  const url = new URL('https://itunes.apple.com/search')
  url.searchParams.set('term', query)
  url.searchParams.set('entity', 'album')
  url.searchParams.set('limit', '25')

  const res = await fetch(url, { signal })
  if (!res.ok) return undefined

  const data = (await res.json()) as { results?: ITunesSearchResult[] }
  return selectBestAlbumCollection(data.results || [], albumName, artistName, expectedTrackCount, expectedYear)
}

async function fetchItunesCollectionArtwork(collectionId?: number, signal?: AbortSignal): Promise<string> {
  if (!collectionId) return ''
  const cacheKey = `itunes-collection-artwork:${collectionId}`

  return cachedApiRequest(cacheKey, signal, async () => {
    try {
      const url = `https://itunes.apple.com/lookup?id=${encodeURIComponent(String(collectionId))}`
      const res = await fetch(url, { signal })
      if (!res.ok) return ''

      const data = (await res.json()) as { results?: ITunesSearchResult[] }
      const collection = (data.results || []).find(
        (item) => item.wrapperType === 'collection' && String(item.collectionId || '') === String(collectionId),
      )

      return formatITunesArt(collection?.artworkUrl100, collection?.collectionName || 'Album') || ''
    } catch {
      return ''
    }
  })
}

function mapItunesAlbumResult(item: ITunesSearchResult): MetadataResult {
  const title = item.collectionName ?? 'Untitled'
  const collectionId = String(item.collectionId || '')
  const id = `album-${collectionId || normalizeAlbumTitleForMatch(title).replace(/[^a-z0-9]+/g, '-')}`
  const coverUrl = formatITunesArt(item.artworkUrl100, title)
  const year = yearFrom(item.releaseDate) || ''
  const artist = item.artistName ?? ''
  const explicit = isExplicitItunesItem(item)

  albumEntityMap.set(id, {
    id,
    name: title,
    artist,
    artworkUrl: coverUrl || '',
    year,
    category: 'album',
    collectionId: collectionId || undefined,
    explicit,
  })

  if (artist && title) {
    albumEntityMap.set(`${normalizeAlbumTitleForMatch(title)}:${normalizeAlbumTitleForMatch(artist)}`, {
      id,
      name: title,
      artist,
      artworkUrl: coverUrl || '',
      year,
      category: 'album',
      collectionId: collectionId || undefined,
      explicit,
    })
  }

  if (coverUrl) {
    entityImageCacheMap.set(id, coverUrl)
  }

  return {
    id,
    type: 'album' as const,
    title,
    creator: artist,
    provider: item.primaryGenreName ?? 'Album',
    providerId: collectionId,
    genre: item.primaryGenreName,
    coverUrl,
    year,
    explicit,
  }
}

async function fetchItunesExactArtistId(artistName: string, signal?: AbortSignal): Promise<number | null> {
  const requestedArtist = normalizeAlbumTitleForMatch(artistName)
  if (!requestedArtist) return null

  const cacheKey = `itunes-artist-id:${requestedArtist}`
  return cachedApiRequest(cacheKey, signal, async () => {
    try {
      const url = new URL('https://itunes.apple.com/search')
      url.searchParams.set('term', artistName)
      url.searchParams.set('entity', 'musicArtist')
      url.searchParams.set('attribute', 'artistTerm')
      url.searchParams.set('limit', '10')

      const res = await fetch(url, { signal })
      if (!res.ok) return null

      const data = (await res.json()) as { results?: ITunesSearchResult[] }
      const exactMatch = (data.results || []).find((artist) => {
        return (
          artist.wrapperType === 'artist' &&
          typeof artist.artistId === 'number' &&
          normalizeAlbumTitleForMatch(artist.artistName || '') === requestedArtist
        )
      })

      return exactMatch?.artistId ?? null
    } catch {
      return null
    }
  })
}

function isStrictDiscographyArtistMatch(album: ITunesSearchResult, requestedArtist: string, artistId?: number | null) {
  if (artistId && Number(album.artistId || 0) === artistId) return true

  const requested = normalizeAlbumTitleForMatch(requestedArtist)
  if (!requested) return false

  const albumArtist = normalizeAlbumTitleForMatch(album.artistName || '')
  const collectionArtist = normalizeAlbumTitleForMatch(album.collectionArtistName || '')
  return albumArtist === requested || collectionArtist === requested
}

function albumEditionBaseKey(title: string, artist: string, year?: string) {
  return [
    albumContentRatingTitle(title),
    normalizeAlbumTitleForMatch(artist),
    year || '',
  ].join(':')
}

export function preferExplicitAlbumEditions(items: DiscographyItem[]): DiscographyItem[] {
  const byEdition = new Map<string, DiscographyItem>()
  const order: string[] = []

  for (const item of items) {
    const key = [
      albumContentRatingTitle(item.title),
      item.year || '',
      item.category,
    ].join(':')
    const existing = byEdition.get(key)
    if (!existing) {
      byEdition.set(key, item)
      order.push(key)
      continue
    }
    if (!existing.explicit && item.explicit) {
      byEdition.set(key, item)
    }
  }

  return order.map((key) => byEdition.get(key)).filter(Boolean) as DiscographyItem[]
}

export function classifyItunesDiscographyRelease(
  title: string,
  trackCount?: number,
): DiscographyItem['category'] {
  const normalizedTitle = normalizeAlbumTitleForMatch(title)
  const count = Number(trackCount || 0)

  // Explicit catalog labels take precedence over track-count heuristics.
  if (/\bep\b/i.test(normalizedTitle)) return 'ep'
  if (/\b(?:single|maxi single)\b/i.test(normalizedTitle)) return 'single'

  // iTunes frequently exposes multi-version single bundles as four-track
  // "albums". Short unlabelled releases belong with singles, not studio LPs.
  if (count > 0 && count <= 4) return 'single'
  if (count >= 5 && count <= 7) return 'ep'
  return 'album'
}

function extractItunesSingleCollections(
  tracks: ITunesSearchResult[],
  artistName: string,
  artistId?: number | null,
): ITunesSearchResult[] {
  const seen = new Set<string>()

  return tracks
    .filter((track) => {
      if (track.wrapperType !== 'track' || track.kind !== 'song') return false
      if (!track.collectionName || !isStrictDiscographyArtistMatch(track, artistName, artistId)) return false
      return classifyItunesDiscographyRelease(track.collectionName, track.trackCount) === 'single'
    })
    .filter((track) => {
      const key = track.collectionId
        ? String(track.collectionId)
        : [
            normalizeAlbumTitleForMatch(track.collectionName || ''),
            yearFrom(track.releaseDate) || '',
          ].join(':')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}


export async function fetchItunesDiscography(artistName: string, signal?: AbortSignal): Promise<DiscographyItem[]> {
  const cacheKey = `itunes-discography-v4:${normalizeAlbumTitleForMatch(artistName)}`
  return cachedApiRequest(cacheKey, signal, async () => {
    try {
      const artistId = await fetchItunesExactArtistId(artistName, signal)
      const albumsUrl = artistId
        ? `https://itunes.apple.com/lookup?id=${encodeURIComponent(String(artistId))}&entity=album&limit=200`
        : `https://itunes.apple.com/search?term=${encodeURIComponent(artistName)}&entity=album&attribute=artistTerm&limit=200`
      const songsUrl = artistId
        ? `https://itunes.apple.com/lookup?id=${encodeURIComponent(String(artistId))}&entity=song&limit=200`
        : `https://itunes.apple.com/search?term=${encodeURIComponent(artistName)}&entity=song&attribute=artistTerm&limit=200`

      // The album entity is reliable for LPs and EPs, but Apple's catalog does
      // not consistently return standalone singles there. Merge the parent
      // collections from song results so Singles receives the same complete
      // discography treatment as the other release groups.
      const [albumsResponse, songsResponse] = await Promise.all([
        fetch(albumsUrl, { signal }),
        fetch(songsUrl, { signal }).catch(() => null),
      ])
      if (!albumsResponse.ok) return []

      const albumsData = (await albumsResponse.json()) as { results?: ITunesSearchResult[] }
      const songsData = songsResponse?.ok
        ? await songsResponse.json() as { results?: ITunesSearchResult[] }
        : { results: [] }
      const albumResults = (albumsData.results || []).filter((album) => album.wrapperType !== 'artist')
      const singleResults = extractItunesSingleCollections(songsData.results || [], artistName, artistId)
      let results = [...albumResults, ...singleResults]

      results = results.filter((album: ITunesSearchResult) => {
        const albumArtist = (album.artistName || '').toLowerCase().trim()
        const title = (album.collectionName || '').toLowerCase().trim()
        if (!title) return false
        if (!isStrictDiscographyArtistMatch(album, artistName, artistId)) return false
        const junkKeywords = [
          'tribute',
          'karaoke',
          'instrumental',
          'lullaby',
          'string quartet',
          'piano cover',
          'piano tribute',
          'relaxing',
          'sleep music',
          'workout mix',
          'soundalike',
          'various artists',
          'party mix',
          'ringtone',
          'commentary',
          'audiobook',
          'podcasts',
          'guided meditation',
        ]
        if (junkKeywords.some((kw) => title.includes(kw) || albumArtist.includes(kw))) {
          return false
        }
        return true
      })

      results.sort((a: any, b: any) => {
        const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0
        const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0
        return dateB - dateA
      })

      const seen = new Set<string>()
      const items = results
        .filter((album: ITunesSearchResult) => {
          const cleanTitle = normalizeAlbumTitleForMatch(album.collectionName || '')
          const cleanArtist = normalizeAlbumTitleForMatch(album.artistName || artistName)
          const explicit = isExplicitItunesItem(album)
          const cleanYear = yearFrom(album.releaseDate) || ''
          const key = `${cleanTitle}:${cleanArtist}:${cleanYear}:${explicit ? 'explicit' : 'clean'}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        .map((album: ITunesSearchResult) => {
          const title = album.collectionName || 'Untitled'
          const cover = formatITunesArt(album.artworkUrl100, title) || ''
          const year = album.releaseDate ? album.releaseDate.slice(0, 4) : ''
          const lowerName = title.toLowerCase()
          const category = classifyItunesDiscographyRelease(title, album.trackCount)

          const id = `album-${album.collectionId || lowerName.replace(/[^a-z0-9]+/g, '-')}`
          const explicit = isExplicitItunesItem(album)

          albumEntityMap.set(id, {
            id,
            name: title,
            artist: album.artistName || artistName,
            artworkUrl: cover,
            year,
            category,
            collectionId: album.collectionId ? String(album.collectionId) : undefined,
            explicit,
          })
          return {
            id,
            title,
            subtitle: `${category.toUpperCase()} · ${year}`,
            artworkUrl: cover,
            artist: album.artistName || artistName,
            rating: 4.9,
            year,
            genre: album.primaryGenreName || undefined,
            category,
            explicit,
          }
        })

      return preferExplicitAlbumEditions(items)
    } catch {
      return []
    }
  })
}

export async function fetchItunesTopSongs(artistName: string, signal?: AbortSignal): Promise<TopContentItem[]> {
  const normalizedArtist = normalizeAlbumTitleForMatch(artistName)
  const cacheKey = `itunes-top-songs-v4:${normalizedArtist}`
  return cachedApiRequest(cacheKey, signal, async () => {
    try {
      // ── Step 1: Try the iTunes Charts RSS feed (top 200 most popular songs globally) ──
      // Filter to songs by this artist — gives us genuinely most-streamed results.
      const chartsUrl = `https://itunes.apple.com/us/rss/topsongs/limit=200/json`
      const chartsRes = await fetch(chartsUrl, { signal })
      if (chartsRes.ok) {
        const chartsData = (await chartsRes.json()) as any
        const chartEntries: any[] = chartsData?.feed?.entry || []
        const artistMatches = chartEntries.filter((entry: any) => {
          const artist = normalizeAlbumTitleForMatch(
            entry?.['im:artist']?.label || entry?.['im:name']?.label || ''
          )
          return artist === normalizedArtist || artist.includes(normalizedArtist) || normalizedArtist.includes(artist)
        })
        if (artistMatches.length >= 3) {
          const seen = new Set<string>()
          const mapped = artistMatches
            .filter((entry: any) => {
              const name = normalizeAlbumTitleForMatch(entry?.['im:name']?.label || '')
              if (!name || seen.has(name)) return false
              seen.add(name)
              return true
            })
            .slice(0, 10)
            .map((entry: any, idx: number) => {
              const trackId = entry?.id?.attributes?.['im:id'] || ''
              const rawArt = entry?.['im:image']?.[2]?.label || entry?.['im:image']?.[0]?.label || ''
              const art = rawArt ? rawArt.replace(/\/\d+x\d+bb\./, '/600x600bb.') : ''
              return {
                id: `song-chart-${trackId || idx}`,
                rank: idx + 1,
                title: entry?.['im:name']?.label || '',
                subtitle: entry?.['im:collection']?.['im:name']?.label || artistName,
                artworkUrl: art,
                explicit: (entry?.category?.attributes?.label || '').toLowerCase().includes('explicit'),
              }
            })
          if (mapped.length > 0) return mapped
        }
      }

      // ── Step 2: Fallback — use artistId lookup, sorted by popularity (iTunes default) ──
      const artistId = await fetchItunesExactArtistId(artistName, signal)
      const lookupUrl = artistId
        ? `https://itunes.apple.com/lookup?id=${encodeURIComponent(String(artistId))}&entity=song&limit=50`
        : `https://itunes.apple.com/search?term=${encodeURIComponent(artistName)}&entity=song&attribute=artistTerm&limit=50`
      const res = await fetch(lookupUrl, { signal })
      if (!res.ok) return []
      const data = (await res.json()) as any

      // Strictly filter to this artist only
      const tracks = (data.results || [])
        .filter((item: any) => {
          if (item.wrapperType !== 'track' || item.kind !== 'song') return false
          const trackArtist = normalizeAlbumTitleForMatch(item.artistName || '')
          if (artistId && Number(item.artistId) === artistId) return true
          return trackArtist === normalizedArtist
        })

      const seen = new Set<string>()
      return tracks
        .filter((track: any) => {
          const name = normalizeAlbumTitleForMatch(track.trackName || '')
          if (!name || seen.has(name)) return false
          seen.add(name)
          return true
        })
        .slice(0, 10)
        .map((track: any, idx: number) => ({
          id: `song-itunes-${track.trackId}`,
          rank: idx + 1,
          title: track.trackName || '',
          subtitle: track.collectionName || artistName,
          artworkUrl: formatITunesArt(track.artworkUrl100, track.trackName),
          explicit: isExplicitItunesTrack(track),
        }))
    } catch {
      return []
    }
  })
}

export async function fetchItunesAlbumDetails(
  albumName: string,
  artistName?: string,
  signal?: AbortSignal,
  expectedTrackCount?: number,
  providerCollectionId?: string,
  expectedYear?: string,
) {
  const cacheKey = [
    'itunes-album-details-v6',
    normalizeAlbumTitleForMatch(albumName),
    normalizeAlbumTitleForMatch(artistName || ''),
    expectedTrackCount || 0,
    providerCollectionId || '',
    expectedYear || '',
  ].join(':')

  return cachedApiRequest(cacheKey, signal, async () => {
    try {
    const cleanAlbum = albumName.replace(/^album-\d+/i, '').replace(/^album-/i, '').replace(/-/g, ' ')
    const requestedCollectionId = /^\d+$/.test(providerCollectionId || '')
      ? providerCollectionId
      : collectionIdFromAlbumEntityId(providerCollectionId || albumName)
    let resolvedAlbum = requestedCollectionId
      ? albumEntityMap.get(`album-${requestedCollectionId}`)
      : undefined
    let resolvedCollectionId = requestedCollectionId || resolvedAlbum?.collectionId

    if (!resolvedCollectionId) {
      const bestAlbum = await fetchBestItunesAlbumCollection(
        cleanAlbum,
        artistName,
        signal,
        expectedTrackCount,
        expectedYear,
      )
      resolvedCollectionId = bestAlbum?.collectionId ? String(bestAlbum.collectionId) : undefined
      if (bestAlbum?.collectionId) {
        resolvedAlbum = {
          id: `album-${bestAlbum.collectionId}`,
          name: bestAlbum.collectionName || cleanAlbum,
          artist: bestAlbum.artistName || bestAlbum.collectionArtistName || artistName || '',
          artworkUrl: formatITunesArt(bestAlbum.artworkUrl100, bestAlbum.collectionName || cleanAlbum) || '',
          year: yearFrom(bestAlbum.releaseDate) || '',
          category: 'album',
          collectionId: String(bestAlbum.collectionId),
          explicit: isExplicitItunesItem(bestAlbum),
        }
      }
    }

    let lookupItems = resolvedCollectionId
      ? await fetchItunesAlbumLookup(String(resolvedCollectionId), signal)
      : []

    if (!albumLookupMatchesContext(lookupItems, cleanAlbum, artistName, expectedYear)) {
      const bestAlbum = await fetchBestItunesAlbumCollection(
        cleanAlbum,
        artistName,
        signal,
        expectedTrackCount,
        expectedYear,
      )
      if (!bestAlbum?.collectionId) return null
      resolvedCollectionId = String(bestAlbum.collectionId)
      resolvedAlbum = {
        id: `album-${bestAlbum.collectionId}`,
        name: bestAlbum.collectionName || cleanAlbum,
        artist: bestAlbum.artistName || bestAlbum.collectionArtistName || artistName || '',
        artworkUrl: formatITunesArt(bestAlbum.artworkUrl100, bestAlbum.collectionName || cleanAlbum) || '',
        year: yearFrom(bestAlbum.releaseDate) || '',
        category: 'album',
        collectionId: String(bestAlbum.collectionId),
        explicit: isExplicitItunesItem(bestAlbum),
      }
      lookupItems = await fetchItunesAlbumLookup(resolvedCollectionId, signal)
    }

    if (!albumLookupMatchesContext(lookupItems, cleanAlbum, artistName, expectedYear)) return null
    const collectionItem = lookupItems.find(
      (item: ITunesSearchResult) => item.wrapperType === 'collection' && item.collectionId,
    )
    const albumCover = formatITunesArt(
      collectionItem?.artworkUrl100 || resolvedAlbum?.artworkUrl,
      collectionItem?.collectionName || resolvedAlbum?.name || cleanAlbum,
    ) || ''
    const songs = lookupItems.filter(
      (item: any) =>
        (item.wrapperType === 'track' || item.kind === 'song') &&
        (!resolvedCollectionId || String(item.collectionId || '') === String(resolvedCollectionId)),
    )

    if (songs.length === 0) return null

    let chosenSongs: any[] = songs

    const seenTracks = new Set<string>()
    const tracksToUse = chosenSongs
      .filter((song: any) => {
        const key = `${song.trackNumber || 0}:${(song.trackName || '').toLowerCase()}`
        if (seenTracks.has(key)) return false
        seenTracks.add(key)
        return true
      })
      .sort((a: any, b: any) => (a.trackNumber || 0) - (b.trackNumber || 0))

    if (tracksToUse.length === 0) return null

    const first = tracksToUse[0]
    const year = first.releaseDate ? first.releaseDate.slice(0, 4) : ''
    const genre = first.primaryGenreName || ''
    const artist = first.artistName || artistName || ''
    const collectionName = collectionItem?.collectionName || first.collectionName || resolvedAlbum?.name || cleanAlbum
    const cover = albumCover || formatITunesArt(first.artworkUrl100, collectionName) || ''

    const items = tracksToUse.map((song: any, idx: number) => {
      const millis = song.trackTimeMillis || 200000
      const mins = Math.floor(millis / 60000)
      const secs = Math.floor((millis % 60000) / 1000).toString().padStart(2, '0')
      const songId = `song-${song.trackId || song.trackName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

      albumEntityMap.set(songId, {
        id: songId,
        name: song.trackName,
        artist,
        artworkUrl: cover,
        year,
        category: 'single',
        explicit: isExplicitItunesTrack(song),
      })

      return {
        id: songId,
        rank: song.trackNumber || idx + 1,
        title: song.trackName,
        subtitle: `${mins}:${secs} · Track ${song.trackNumber || idx + 1}`,
        rating: 4.9,
        explicit: isExplicitItunesTrack(song),
      }
    })

    return {
      collectionId: String(resolvedCollectionId),
      title: collectionName,
      artist,
      coverUrl: cover,
      year,
      genre,
      explicit: isExplicitItunesItem(collectionItem || {}) || tracksToUse.some((song: any) => isExplicitItunesTrack(song)),
      trackCount: items.length,
      tracks: items,
    }
    } catch {
      return null
    }
  })
}

function mapItunesRelatedAlbum(item: ITunesSearchResult, language?: string): DiscographyItem {
  const title = item.collectionName ?? 'Untitled'
  const collectionId = String(item.collectionId || '')
  const cover = formatITunesArt(item.artworkUrl100, title) || ''
  const year = yearFrom(item.releaseDate) || ''
  const id = `album-${collectionId || normalizeAlbumTitleForMatch(title).replace(/[^a-z0-9]+/g, '-')}`
  const explicit = isExplicitItunesItem(item)

  albumEntityMap.set(id, {
    id,
    name: title,
    artist: item.artistName || '',
    artworkUrl: cover,
    year,
    category: 'album',
    collectionId: collectionId || undefined,
    explicit,
  })
  albumEntityMap.set(title.toLowerCase(), {
    id,
    name: title,
    artist: item.artistName || '',
    artworkUrl: cover,
    year,
    category: 'album',
    collectionId: collectionId || undefined,
    explicit,
  })
  return {
    id,
    title,
    subtitle: `${item.primaryGenreName || 'Album'}${year ? ` · ${year}` : ''}`,
    artworkUrl: cover,
    year,
    genre: item.primaryGenreName,
    language,
    artist: item.artistName || item.collectionArtistName || '',
    category: 'album',
    explicit,
  }
}

type MusicBrainzReleaseLanguage = {
  title?: string
  'artist-credit'?: MBArtistCredit
  'text-representation'?: { language?: string }
}

async function fetchAlbumLanguageMap(
  albums: Array<{ title: string; artist?: string }>,
  signal?: AbortSignal,
) {
  const uniqueAlbums = Array.from(new Map(
    albums
      .filter((album) => album.title.trim())
      .map((album) => [
        `${normalizeAlbumTitleForMatch(album.title)}:${normalizeAlbumTitleForMatch(album.artist || '')}`,
        album,
      ]),
  ).values()).slice(0, 8)
  if (uniqueAlbums.length === 0) return new Map<string, string>()

  const cacheKey = `musicbrainz-album-languages-v1:${uniqueAlbums
    .map((album) => `${normalizeAlbumTitleForMatch(album.title)}:${normalizeAlbumTitleForMatch(album.artist || '')}`)
    .join('|')}`
  return cachedApiRequest(cacheKey, signal, async () => {
    try {
      const query = uniqueAlbums.map((album) => {
        const release = `release:"${escapeMusicBrainzSearchValue(album.title)}"`
        const artist = album.artist?.trim()
          ? ` AND artist:"${escapeMusicBrainzSearchValue(album.artist)}"`
          : ''
        return `(${release}${artist})`
      }).join(' OR ')
      const data = await mbGet<{ releases?: MusicBrainzReleaseLanguage[] }>(
        'release',
        { query, limit: '100' },
        signal,
      )
      const languages = new Map<string, string>()
      ;(data.releases || []).forEach((release) => {
        const language = release['text-representation']?.language?.trim().toLowerCase()
        if (!language || !release.title) return
        const artist = artistsFrom(release['artist-credit'])
        const key = `${normalizeAlbumTitleForMatch(release.title)}:${normalizeAlbumTitleForMatch(artist)}`
        if (!languages.has(key)) languages.set(key, language)
      })
      return languages
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') throw error
      return new Map<string, string>()
    }
  })
}

export function isDerivativeRelatedAlbum(name: string, artist: string) {
  return /\b(?:tribute|karaoke|lullab(?:y|ies)|music box|string quartet|instrumental (?:cover|version)|piano (?:cover|tribute)|covers? of|performs?|renditions?)\b/i
    .test(`${name} ${artist}`)
}

export function isSameAlbumVersionTitle(
  candidateName: string,
  candidateArtist: string,
  albumName: string,
  artistName: string,
) {
  return Boolean(
    albumVersionBaseTitle(candidateName) &&
    albumVersionBaseTitle(candidateName) === albumVersionBaseTitle(albumName) &&
    normalizeAlbumTitleForMatch(candidateArtist) === normalizeAlbumTitleForMatch(artistName),
  )
}

export async function fetchRelatedAlbums(
  albumName: string,
  artistName?: string,
  genre?: string,
  albumKey?: string,
  signal?: AbortSignal,
  selectedExplicit?: boolean,
  selectedYear?: string,
): Promise<DiscographyItem[]> {
  const cacheKey = [
    'itunes-related-albums-v8',
    normalizeAlbumTitleForMatch(albumName),
    normalizeAlbumTitleForMatch(artistName || ''),
    normalizeAlbumTitleForMatch(genre || ''),
    albumKey || '',
    selectedExplicit === undefined ? 'unknown' : selectedExplicit ? 'explicit' : 'clean',
    selectedYear || '',
  ].join(':')

  return cachedApiRequest(cacheKey, signal, async () => {
    try {
      const cleanArtist = artistName && artistName !== 'Artist' ? artistName.trim() : ''
      const cleanGenre = genre && genre !== 'Genre' ? genre.trim() : ''

      const terms = Array.from(
        new Set(
          [
            cleanArtist ? `${albumName} ${cleanArtist}` : albumName,
            cleanGenre ? `${cleanGenre} album` : '',
            cleanArtist ? `${cleanArtist} albums` : '',
            cleanArtist && cleanGenre ? `${cleanArtist} ${cleanGenre}` : '',
          ].filter((term) => term.length >= 2),
        ),
      ).slice(0, 4)

      if (terms.length === 0) return []

      const responses = await Promise.all(
        terms.map(async (term) => {
          const url = new URL('https://itunes.apple.com/search')
          url.searchParams.set('term', term)
          url.searchParams.set('entity', 'album')
          url.searchParams.set('limit', '40')
          const res = await fetch(url, { signal })
          if (!res.ok) return []
          const data = (await res.json()) as { results?: ITunesSearchResult[] }
          return data.results ?? []
        }),
      )

      const excludeCollectionId = albumKey ? collectionIdFromAlbumEntityId(albumKey) : undefined
      const selectedAlbumEntity = albumKey
        ? albumEntityMap.get(albumKey) || albumEntityMap.get(albumKey.toLowerCase())
        : undefined
      const selectedTitle = normalizeAlbumTitleForMatch(albumName)
      const selectedGenre = normalizeAlbumTitleForMatch(cleanGenre)
      const selectedArtist = normalizeAlbumTitleForMatch(cleanArtist)
      const selectedReleaseYear = Number(selectedYear || selectedAlbumEntity?.year || 0)
      const seen = new Set<string>()
      const artistCounts: Record<string, number> = {}
      const filtered = responses
        .flat()
        .filter((item) => {
          if (!item.collectionName) return false
          if (excludeCollectionId && String(item.collectionId || '') === excludeCollectionId) return false

          const resultTitle = normalizeAlbumTitleForMatch(item.collectionName)
          if (resultTitle === selectedTitle) return false
          if (isDerivativeRelatedAlbum(item.collectionName, item.artistName || item.collectionArtistName || '')) return false

          const resultArtist = normalizeAlbumTitleForMatch(item.artistName || item.collectionArtistName || '')
          if (selectedArtist && isSameAlbumVersionTitle(item.collectionName, resultArtist, albumName, selectedArtist)) {
            return false
          }

          // EXCLUDE EPs AND SINGLES STRICTLY (MUST BE ALBUMS ONLY)
          const lowerName = item.collectionName.toLowerCase()
          const isEpOrSingle =
            /\b(ep|single|sngle)\b/i.test(lowerName) ||
            (item.trackCount !== undefined && item.trackCount < 6)
          if (isEpOrSingle) return false

          const key = item.collectionId
            ? String(item.collectionId)
            : `${resultTitle}:${normalizeAlbumTitleForMatch(item.artistName || '')}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })

      const preferredAlbumVariants = new Map<string, ITunesSearchResult>()
      for (const item of filtered) {
        const key = albumEditionBaseKey(
          item.collectionName || '',
          item.artistName || item.collectionArtistName || '',
          yearFrom(item.releaseDate) || '',
        )
        const existing = preferredAlbumVariants.get(key)
        if (!existing || (!isExplicitItunesItem(existing) && isExplicitItunesItem(item))) {
          preferredAlbumVariants.set(key, item)
        }
      }

      const rankedRelatedItems = [...preferredAlbumVariants.values()]
        .map((item, index) => {
          const resultGenre = normalizeAlbumTitleForMatch(item.primaryGenreName || '')
          const resultArtist = normalizeAlbumTitleForMatch(item.artistName || '')
          const sameGenre =
            selectedGenre.length > 0 &&
            (resultGenre === selectedGenre || resultGenre.includes(selectedGenre) || selectedGenre.includes(resultGenre))
          const sameArtist = selectedArtist.length > 0 && resultArtist === selectedArtist
          const year = Number(yearFrom(item.releaseDate) || 0)
          const yearProximity = selectedReleaseYear > 0 && year > 0
            ? Math.max(0, 80 - Math.abs(selectedReleaseYear - year) * 4)
            : 0

          const artistCount = artistCounts[resultArtist] || 0
          artistCounts[resultArtist] = artistCount + 1

          return {
            item,
            score:
              (sameGenre ? 320 : 0) +
              (sameArtist ? 240 : 0) +
              yearProximity -
              (artistCount * 120) +
              Math.max(0, 60 - index) +
              (item.artworkUrl100 ? 10 : 0) +
              Math.min(year, 2100) / 1000,
            relevant: selectedGenre
              ? sameGenre
              : selectedArtist
                ? sameArtist
                : true,
          }
        })
        .filter(({ score, relevant }) => relevant && score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4)
        .map(({ item }) => item)

      const languageLookup = await fetchAlbumLanguageMap([
        { title: albumName, artist: cleanArtist },
        ...rankedRelatedItems.map((item) => ({
          title: item.collectionName || '',
          artist: item.artistName || item.collectionArtistName,
        })),
      ], signal)
      const albumLanguageKey = (title: string, artist?: string) =>
        `${normalizeAlbumTitleForMatch(title)}:${normalizeAlbumTitleForMatch(artist || '')}`
      const sourceLanguage = languageLookup.get(albumLanguageKey(albumName, cleanArtist))
      const hasCandidateLanguage = rankedRelatedItems.some((item) =>
        languageLookup.has(albumLanguageKey(item.collectionName || '', item.artistName || item.collectionArtistName)),
      )
      const languageMatchedItems = sourceLanguage && hasCandidateLanguage
        ? rankedRelatedItems.filter((item) =>
            languageLookup.get(albumLanguageKey(item.collectionName || '', item.artistName || item.collectionArtistName)) === sourceLanguage,
          )
        : rankedRelatedItems
      const related = languageMatchedItems.map((item) =>
        mapItunesRelatedAlbum(
          item,
          languageLookup.get(albumLanguageKey(item.collectionName || '', item.artistName || item.collectionArtistName)),
        ),
      )

      return related
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') throw err
      return []
    }
  })
}

function songSearchScore(
  item: ITunesSearchResult,
  songQuery: string,
  targetArtist?: string,
  targetAlbum?: string,
  targetYear?: string,
): number {
  const normTrack = normalizeAlbumTitleForMatch(item.trackName || '')
  const normArtist = normalizeAlbumTitleForMatch(item.artistName || '')
  const normTargetSong = normalizeAlbumTitleForMatch(songQuery)
  const normTargetArtist = targetArtist ? normalizeAlbumTitleForMatch(targetArtist) : ''

  let score = 0

  if (normTargetArtist) {
    if (normArtist !== normTargetArtist) return -50000
    score += 5000
  }

  if (targetAlbum) {
    const normAlbum = normalizeAlbumTitleForMatch(item.collectionName || '')
    const normTargetAlbum = normalizeAlbumTitleForMatch(targetAlbum)
    if (!normAlbum || (!normAlbum.includes(normTargetAlbum) && !normTargetAlbum.includes(normAlbum))) return -50000
    score += normAlbum === normTargetAlbum ? 3200 : 1800
  }

  if (targetYear) {
    const candidateYear = yearFrom(item.releaseDate) || ''
    if (candidateYear === targetYear) score += 1200
    else if (candidateYear) score -= Math.min(1800, Math.abs(Number(candidateYear) - Number(targetYear)) * 300)
    else score -= 600
  }

  score += scoreCatalogTitleMatch(normTrack, normTargetSong)

  const isCoverArtist =
    /\b(tribute|karaoke|instrumental|piano|lullaby|string quartet|cover|rendition|sing-along|relaxing|bedtime|acoustic version by|orchestral)\b/i.test(item.artistName || '') ||
    /\b(karaoke|instrumental|tribute|piano cover|lullaby version)\b/i.test(item.trackName || '')

  if (isCoverArtist) {
    score -= 4000
  }

  if (item.collectionName && !/tribute|karaoke|greatest hits of 20\d\d/i.test(item.collectionName)) {
    score += 200
  }

  // Prefer a proper album release of a track over a standalone single so the
  // album artwork is used and dedupe keeps the album version.
  if (item.collectionName) {
    const isStandaloneSingle =
      item.wrapperType === 'track' &&
      item.trackName &&
      normalizeAlbumTitleForMatch(item.collectionName) === normTrack
    score += isStandaloneSingle ? -50 : 80
  }

  return score
}

function isCompilationLikeCollection(title?: string) {
  const normalized = normalizeAlbumTitleForMatch(title || '')
  if (!normalized) return true
  return /\b(dj|mix|megamix|remix|throwback|radio|today s hits|hits|playlist|valentine|karaoke|tribute|cover|instrumental|workout|party|ringtone)\b/.test(normalized)
}

function isOfficialSongAppearanceCollection(item: ITunesSearchResult, normalizedArtist: string) {
  if (!item.collectionName) return false
  if (isCompilationLikeCollection(item.collectionName)) return false
  if (normalizeAlbumTitleForMatch(item.collectionName) === normalizeAlbumTitleForMatch(item.trackName || '')) return false

  const collectionArtist = normalizeAlbumTitleForMatch(item.collectionArtistName || '')
  if (collectionArtist && normalizedArtist && collectionArtist !== normalizedArtist) return false

  return true
}

const studioAlbumOrdinals: Record<string, number> = {
  debut: 1,
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
  eighteenth: 18,
  nineteenth: 19,
  twentieth: 20,
}

function studioAlbumNumberFromExtract(extract: string): number | null {
  const numeric = extract.match(/\b(\d{1,2})(?:st|nd|rd|th) studio album\b/i)
  if (numeric?.[1]) return Number(numeric[1])

  const word = extract.match(
    /\b(debut|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth) studio album\b/i,
  )
  return word?.[1] ? studioAlbumOrdinals[word[1].toLowerCase()] || null : null
}

async function fetchWikipediaStudioAlbumNumber(albumName: string, artistName: string, signal?: AbortSignal) {
  const cacheKey = `wiki-studio-album-number:${normalizeAlbumTitleForMatch(albumName)}:${normalizeAlbumTitleForMatch(artistName)}`
  return cachedApiRequest(cacheKey, signal, async () => {
    try {
      const url = new URL('https://en.wikipedia.org/w/api.php')
      url.searchParams.set('action', 'query')
      url.searchParams.set('titles', `${albumName} (${artistName} album)|${albumName} (album)|${albumName}`)
      url.searchParams.set('prop', 'extracts')
      url.searchParams.set('exintro', '1')
      url.searchParams.set('explaintext', '1')
      url.searchParams.set('redirects', '1')
      url.searchParams.set('format', 'json')
      url.searchParams.set('origin', '*')

      const response = await fetch(url, { signal })
      if (!response.ok) return null
      const data = (await response.json()) as {
        query?: { pages?: Record<string, { extract?: string; missing?: string }> }
      }
      const normalizedArtist = normalizeAlbumTitleForMatch(artistName)
      const extracts = Object.values(data.query?.pages || {})
        .filter((page) => !page.missing && page.extract)
        .map((page) => page.extract || '')
        .sort((left, right) => {
          const mentionsArtist = (text: string) => normalizeAlbumTitleForMatch(text).includes(normalizedArtist)
          return Number(mentionsArtist(right)) - Number(mentionsArtist(left))
        })

      for (const extract of extracts) {
        const albumNumber = studioAlbumNumberFromExtract(extract)
        if (albumNumber) return albumNumber
      }
      return null
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') throw error
      return null
    }
  })
}

export async function fetchWikipediaArtwork(
  name: string,
  context: 'game' = 'game',
  signal?: AbortSignal,
): Promise<string> {
  const cleanName = name.trim().toLowerCase()
  if (!cleanName) return ''

  const cacheKey = `wiki-artwork-v2:${context}:${cleanName}`
  const existing = entityImageCacheMap.get(cacheKey)
  if (existing) return existing

  const result = await cachedApiRequest(cacheKey, signal, async () => {
    try {
      const url = new URL('https://en.wikipedia.org/w/api.php')
      const titleCandidates = context === 'game'
        ? `${name} (video game)|${name}`
        : name
      url.searchParams.set('action', 'query')
      url.searchParams.set('titles', titleCandidates)
      url.searchParams.set('prop', 'pageimages')
      url.searchParams.set('piprop', 'thumbnail|original')
      url.searchParams.set('pithumbsize', '1000')
      url.searchParams.set('redirects', '1')
      url.searchParams.set('format', 'json')
      url.searchParams.set('origin', '*')

      const res = await fetch(url, { signal })
      if (!res.ok) return ''

      const data = (await res.json()) as {
        query?: {
          pages?: Record<string, {
            title?: string
            missing?: string
            thumbnail?: { source?: string }
            original?: { source?: string }
          }>
        }
      }
      const normalizedName = normalizeGameTitle(name)
      const pages = Object.values(data.query?.pages || {})
        .filter((page) => !page.missing && (page.original?.source || page.thumbnail?.source))
        .sort((left, right) => {
          const score = (title?: string) => {
            const normalizedTitle = normalizeGameTitle(title || '')
            if (normalizedTitle === normalizedName) return 3
            if (normalizedTitle.startsWith(normalizedName)) return 2
            if (normalizedTitle.includes(normalizedName)) return 1
            return 0
          }
          return score(right.title) - score(left.title)
        })
      const artworkUrl = pages[0]?.original?.source || pages[0]?.thumbnail?.source || ''
      if (artworkUrl) {
        entityImageCacheMap.set(cacheKey, artworkUrl)
        preloadImage(artworkUrl)
      }
      return artworkUrl
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') throw error
      return ''
    }
  })

  if (!result) {
    apiResponseCache.delete(cacheKey)
    void deleteBrowserCacheValue(API_CACHE_NAMESPACE, cacheKey)
  }
  return result
}

async function fetchItunesTrackById(trackId?: string, signal?: AbortSignal): Promise<ITunesSearchResult | undefined> {
  if (!/^\d+$/.test(trackId || '')) return undefined

  return cachedApiRequest(`itunes-track:${trackId}`, signal, async () => {
    const url = `https://itunes.apple.com/lookup?id=${encodeURIComponent(trackId as string)}`
    const res = await fetch(url, { signal })
    if (!res.ok) return undefined

    const data = (await res.json()) as { results?: ITunesSearchResult[] }
    return (data.results || []).find((item) => String(item.trackId || '') === String(trackId))
  })
}

export async function fetchItunesSongDetails(
  songName: string,
  artistName?: string,
  trackId?: string,
  signal?: AbortSignal,
  albumName?: string,
  expectedYear?: string,
) {
  const cacheKey = [
    'itunes-song-details-v8',
    normalizeAlbumTitleForMatch(songName),
    normalizeAlbumTitleForMatch(artistName || ''),
    trackId || '',
    normalizeAlbumTitleForMatch(albumName || ''),
    expectedYear || '',
  ].join(':')

  return cachedApiRequest(cacheKey, signal, async () => {
    try {
    const cleanSong = songName.replace(/^song-\d+/i, '').replace(/^song-/i, '').replace(/-/g, ' ')
    const exactTrack = await fetchItunesTrackById(trackId, signal)
    let song = exactTrack

    if (!song) {
      const query = [cleanSong, artistName, albumName, expectedYear].filter(Boolean).join(' ')
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=50`
      const res = await fetch(url, { signal })
      if (!res.ok) return null
      const data = (await res.json()) as { results?: ITunesSearchResult[] }
      const songs = (data.results || []) as ITunesSearchResult[]
      if (songs.length === 0) return null
      const contextualSongs = albumName
        ? songs.filter((candidate) => songSearchScore(candidate, cleanSong, artistName, albumName, expectedYear) > -50000)
        : songs
      if (albumName && contextualSongs.length === 0) return null
      song = [...contextualSongs].sort(
        (a, b) => songSearchScore(b, cleanSong, artistName, albumName, expectedYear) - songSearchScore(a, cleanSong, artistName, albumName, expectedYear),
      )[0]
    }

    if (!song?.trackName) return null

    const year = song.releaseDate ? song.releaseDate.slice(0, 4) : ''
    const millis = song.trackTimeMillis || 200000
    const mins = Math.floor(millis / 60000)
    const secs = Math.floor((millis % 60000) / 1000).toString().padStart(2, '0')
    const songIsExplicit = isExplicitItunesTrack(song)

    const resolvedArtist = song.artistName || artistName || 'Unknown artist'
    const trackCount = Number(song.trackCount || 0)
    const releaseKind = getSongReleaseKind({
      songName: song.trackName,
      albumName: song.collectionName,
      trackCount,
    })
    const [lyricsData, studioAlbumNumber, collectionArtwork] = await Promise.all([
      fetchLyrics(resolvedArtist, song.trackName, signal, {
        explicit: songIsExplicit,
        albumName: song.collectionName,
        durationSeconds: millis / 1000,
      }).catch(() => null),
      releaseKind === 'album' && song.collectionName
        ? fetchWikipediaStudioAlbumNumber(song.collectionName, resolvedArtist, signal)
        : Promise.resolve(null),
      fetchItunesCollectionArtwork(song.collectionId, signal),
    ])
    const cover = collectionArtwork || formatITunesArt(song.artworkUrl100, song.trackName) || ''
    const summary = buildSongBiography({
      songName: song.trackName,
      artistName: resolvedArtist,
      albumName: song.collectionName,
      trackNumber: song.trackNumber || 1,
      trackCount,
      studioAlbumNumber,
      year,
    })

    return {
      id: `song-${song.trackId}`,
      name: song.trackName,
      artist: resolvedArtist,
      album: song.collectionName,
      artworkUrl: cover,
      year,
      duration: `${mins}:${secs}`,
      trackNumber: song.trackNumber || 1,
      trackCount,
      releaseKind,
      studioAlbumNumber,
      summary,
      genre: song.primaryGenreName || 'Pop',
      explicit: songIsExplicit,
      lyrics: typeof lyricsData === 'string' && lyricsData.trim() ? lyricsData : null,
    }
    } catch {
      return null
    }
  })
}

export async function fetchItunesSongAppearances(
  songName: string,
  artistName?: string,
  trackId?: string,
  signal?: AbortSignal,
  selectedExplicit?: boolean,
): Promise<DiscographyItem[]> {
  const cacheKey = [
    'itunes-song-appearances-v6',
    normalizeAlbumTitleForMatch(songName),
    normalizeAlbumTitleForMatch(artistName || ''),
    trackId || '',
    selectedExplicit === undefined ? 'unknown' : selectedExplicit ? 'explicit' : 'clean',
  ].join(':')

  return cachedApiRequest(cacheKey, signal, async () => {
    try {
      const cleanSong = songName.replace(/^song-\d+/i, '').replace(/^song-/i, '').replace(/-/g, ' ')
      const exactSong = await fetchItunesTrackById(trackId, signal)
      const requestedExplicit = selectedExplicit ?? (exactSong ? isExplicitItunesTrack(exactSong) : undefined)

      const canonicalSongName = exactSong?.trackName || cleanSong
      const canonicalArtistName = exactSong?.artistName || artistName || ''
      const query = canonicalArtistName ? `${canonicalSongName} ${canonicalArtistName}` : canonicalSongName
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=200`
      const res = await fetch(url, { signal })
      if (!res.ok) return []

      const data = (await res.json()) as { results?: ITunesSearchResult[] }
      const normalizedSong = normalizeAlbumTitleForMatch(canonicalSongName)
      const normalizedArtist = normalizeAlbumTitleForMatch(canonicalArtistName)
      const familyTracks: ITunesSearchResult[] = []

      if (exactSong?.collectionId && exactSong.collectionName) {
        const family = await fetchItunesAlbumVersionFamily({
          albumName: exactSong.collectionName,
          artistName: canonicalArtistName,
          year: yearFrom(exactSong.releaseDate),
          collectionId: String(exactSong.collectionId),
          trackCount: Number(exactSong.trackCount || 0),
        }, signal).catch((error) => {
          if ((error as Error)?.name === 'AbortError') throw error
          return null
        })

        if (family) {
          const familyLookups = await Promise.all(family.collectionIds.map(async (familyCollectionId) => {
            try {
              return {
                familyCollectionId,
                items: await fetchItunesAlbumLookup(familyCollectionId, signal),
              }
            } catch (error) {
              if ((error as Error)?.name === 'AbortError') throw error
              return { familyCollectionId, items: [] as ITunesSearchResult[] }
            }
          }))
          for (const { familyCollectionId, items } of familyLookups) {
            const collection = items.find((item) =>
              item.wrapperType === 'collection' && String(item.collectionId || '') === familyCollectionId)
            const matchingTrack = items.find((item) =>
              (item.wrapperType === 'track' || item.kind === 'song') &&
              String(item.collectionId || '') === familyCollectionId &&
              normalizeAlbumTitleForMatch(item.trackName || '') === normalizedSong &&
              (!normalizedArtist || normalizeAlbumTitleForMatch(item.artistName || '') === normalizedArtist) &&
              (requestedExplicit === undefined || isExplicitItunesTrack(item) === requestedExplicit))
            if (!matchingTrack) continue
            familyTracks.push({
              ...matchingTrack,
              collectionName: collection?.collectionName || matchingTrack.collectionName,
              artworkUrl100: collection?.artworkUrl100 || matchingTrack.artworkUrl100,
              releaseDate: collection?.releaseDate || matchingTrack.releaseDate,
              trackCount: collection?.trackCount || matchingTrack.trackCount,
              collectionExplicitness: collection?.collectionExplicitness || matchingTrack.collectionExplicitness,
              primaryGenreName: collection?.primaryGenreName || matchingTrack.primaryGenreName,
            })
          }
        }
      }
      const seenCollectionIds = new Set<string>()
      const seenAlbumVariants = new Set<string>()

      return [exactSong, ...(data.results || []), ...familyTracks]
        .filter(Boolean)
        .filter((item): item is ITunesSearchResult => Boolean(item))
        .filter((item) => {
          if (!item.collectionId || !item.collectionName || !item.trackName) return false
          const itemSong = normalizeAlbumTitleForMatch(item.trackName)
          const songMatches =
            (trackId && String(item.trackId || '') === String(trackId)) ||
            itemSong === normalizedSong
          const artistMatches =
            !normalizedArtist ||
            normalizeAlbumTitleForMatch(item.artistName || '') === normalizedArtist
          if (!songMatches || !artistMatches) return false
          if (requestedExplicit !== undefined && isExplicitItunesTrack(item) !== requestedExplicit) return false
          if (!isOfficialSongAppearanceCollection(item, normalizedArtist)) return false

          const collectionId = String(item.collectionId)
          if (seenCollectionIds.has(collectionId)) return false
          seenCollectionIds.add(collectionId)
          return true
        })
        .sort((a, b) => {
          const aIsSingle = normalizeAlbumTitleForMatch(a.collectionName || '') === normalizedSong
          const bIsSingle = normalizeAlbumTitleForMatch(b.collectionName || '') === normalizedSong
          if (aIsSingle !== bIsSingle) return aIsSingle ? 1 : -1
          return Number(b.trackCount || 0) - Number(a.trackCount || 0)
        })
        .filter((item) => {
          const key = [
            normalizeAlbumTitleForMatch(item.collectionName || ''),
            normalizeAlbumTitleForMatch(item.artistName || artistName || ''),
            yearFrom(item.releaseDate) || '',
            isExplicitItunesItem(item) ? 'explicit' : 'clean',
          ].join(':')
          if (seenAlbumVariants.has(key)) return false
          seenAlbumVariants.add(key)
          return true
        })
        .map((item) => {
          const id = `album-${item.collectionId}`
          const artworkUrl = formatITunesArt(item.artworkUrl100, item.collectionName) || ''
          const year = yearFrom(item.releaseDate) || ''
          const title = item.collectionName || 'Untitled'
          const artist = item.artistName || artistName || ''
          const trackCount = Number(item.trackCount || 0)
          const category: 'album' | 'ep' | 'single' = trackCount <= 3 ? 'single' : 'album'
          const explicit = isExplicitItunesItem(item)

          albumEntityMap.set(id, {
            id,
            name: title,
            artist,
            artworkUrl,
            year,
            category,
            collectionId: item.collectionId ? String(item.collectionId) : undefined,
            explicit,
          })

          return {
            id,
            title,
            subtitle: [artist, year].filter(Boolean).join(' · ') || 'Album',
            artworkUrl,
            artist,
            rating: 4.8,
            year,
            genre: item.primaryGenreName,
            category,
            explicit,
          }
        })
    } catch {
      return []
    }
  })
}

export async function fetchItunesSongArtwork(
  songName: string,
  artistName?: string,
  signal?: AbortSignal,
  trackId?: string,
  albumName?: string,
): Promise<string> {
  const cacheKey = [
    'itunes-song-artwork-v3',
    normalizeAlbumTitleForMatch(songName),
    normalizeAlbumTitleForMatch(artistName || ''),
    trackId || '',
    normalizeAlbumTitleForMatch(albumName || ''),
  ].join(':')

  const result = await cachedApiRequest(cacheKey, signal, async () => {
    try {
      const exactTrack = await fetchItunesTrackById(trackId, signal)
      if (exactTrack) return formatITunesArt(exactTrack.artworkUrl100, exactTrack.trackName || songName) || ''

      const cleanSong = songName.replace(/^song-\d+/i, '').replace(/^song-/i, '').replace(/-/g, ' ')
      const query = [cleanSong, artistName, albumName].filter(Boolean).join(' ')
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=50`
      const res = await fetch(url, { signal })
      if (!res.ok) return ''
      const data = (await res.json()) as any
      const songs = (data.results || []) as ITunesSearchResult[]
      if (songs.length === 0) return ''
      const contextualSongs = albumName
        ? songs.filter((candidate) => songSearchScore(candidate, cleanSong, artistName, albumName) > -50000)
        : songs
      if (albumName && contextualSongs.length === 0) return ''
      const sortedSongs = [...contextualSongs].sort((a, b) => songSearchScore(b, cleanSong, artistName, albumName) - songSearchScore(a, cleanSong, artistName, albumName))
      const song = sortedSongs[0]
      return formatITunesArt(song.artworkUrl100, song.trackName) || ''
    } catch {
      return ''
    }
  })

  if (!result) {
    apiResponseCache.delete(cacheKey)
  }

  return result
}

export async function fetchTmdbCreator(
  type: 'film' | 'tv',
  id: number,
  title?: string,
  signal?: AbortSignal,
): Promise<string> {
  if (tmdbToken) {
    try {
      if (type === 'film') {
        const url = `https://api.themoviedb.org/3/movie/${id}/credits`
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${tmdbToken}`, accept: 'application/json' },
          signal,
        })
        if (res.ok) {
          const data = await res.json()
          const director = (data.crew ?? []).find((c: any) => c.job === 'Director')?.name
          if (director) return director
        }
      } else {
        const url = `https://api.themoviedb.org/3/tv/${id}`
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${tmdbToken}`, accept: 'application/json' },
          signal,
        })
        if (res.ok) {
          const data = await res.json()
          const creators = (data.created_by ?? []).map((c: any) => c.name).filter(Boolean)
          if (creators.length > 0) return creators.join(', ')
        }
      }
    } catch {
      // fallback to wiki
    }
  }
  if (title) {
    return fetchWikiCreator(title, type, signal)
  }
  return ''
}

type MBArtistCredit = Array<{ name?: string; artist?: { name?: string } }>

type MBRecording = {
  id: string
  title: string
  'artist-credit'?: MBArtistCredit
  releases?: Array<{ id: string; title?: string; date?: string }>
}

type MBReleaseGroup = {
  id: string
  title: string
  'artist-credit'?: MBArtistCredit
  'first-release-date'?: string
}

type LrclibResult = {
  id: number
  trackName: string
  artistName: string
  albumName?: string
  duration?: number
  plainLyrics?: string
  syncedLyrics?: string
}

type ITunesSearchResult = {
  artistId?: number
  trackId?: number
  collectionId?: number
  wrapperType?: string
  artistName?: string
  trackName?: string
  collectionName?: string
  collectionArtistName?: string
  artworkUrl100?: string
  releaseDate?: string
  primaryGenreName?: string
  trackCount?: number
  trackNumber?: number
  trackTimeMillis?: number
  kind?: string
  longDescription?: string
  shortDescription?: string
  collectionExplicitness?: string
  trackExplicitness?: string
  contentAdvisoryRating?: string
}

// ─── Env ──────────────────────────────────────────────────────────────────────

const tmdbToken = import.meta.env.VITE_TMDB_ACCESS_TOKEN as string | undefined
const igdbApiBaseUrl =
  (import.meta.env.VITE_IGDB_API_BASE_URL as string | undefined) ??
  '/api/igdb/games'
const steamStoreApiBaseUrl =
  (import.meta.env.VITE_STEAM_STORE_API_BASE_URL as string | undefined) ??
  (import.meta.env.DEV ? '/steam-store-api' : 'https://store.steampowered.com/api')
const steamStoreSearchBaseUrl =
  (import.meta.env.VITE_STEAM_STORE_SEARCH_BASE_URL as string | undefined) ??
  (import.meta.env.DEV ? '/steam-store-search' : 'https://store.steampowered.com')
const googleBooksApiKey = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY as string | undefined
const appContact =
  (import.meta.env.VITE_APP_CONTACT as string | undefined) ??
  'the-commonplace@example.com'

// ─── Cache & Utilities ────────────────────────────────────────────────────────

const searchCache = new Map<string, MetadataResult[]>()
const lyricsCache = new Map<string, string | undefined>()
const apiResponseCache = new Map<string, unknown>()
const pendingApiRequestCache = new Map<string, Promise<unknown>>()
const API_CACHE_NAMESPACE = 'external-api-v7'
const SEARCH_CACHE_NAMESPACE = 'metadata-search-v9'
const STATIC_METADATA_TTL = 30 * 24 * 60 * 60 * 1000
const SEARCH_METADATA_TTL = 14 * 24 * 60 * 60 * 1000

export function clearMetadataCache() {
  searchCache.clear()
  lyricsCache.clear()
  apiResponseCache.clear()
  pendingApiRequestCache.clear()
  void clearBrowserCacheNamespace(API_CACHE_NAMESPACE)
  void clearBrowserCacheNamespace(SEARCH_CACHE_NAMESPACE)
}

async function cachedApiRequest<T>(
  key: string,
  signal: AbortSignal | undefined,
  loader: () => Promise<T>,
): Promise<T> {
  if (apiResponseCache.has(key)) return apiResponseCache.get(key) as T
  if (!signal) {
    const pending = pendingApiRequestCache.get(key)
    if (pending) return pending as Promise<T>
  }

  const request = (async () => {
    const persisted = await getBrowserCacheValue<T>(API_CACHE_NAMESPACE, key)
    signal?.throwIfAborted()
    if (persisted !== undefined) {
      apiResponseCache.set(key, persisted)
      return persisted
    }

    const result = await loader()
    apiResponseCache.set(key, result)
    void setBrowserCacheValue(API_CACHE_NAMESPACE, key, result, STATIC_METADATA_TTL)
    return result
  })()
  if (!signal) pendingApiRequestCache.set(key, request)

  try {
    return await request
  } finally {
    if (!signal) pendingApiRequestCache.delete(key)
  }
}

async function sessionCachedApiRequest<T>(
  key: string,
  signal: AbortSignal | undefined,
  loader: () => Promise<T>,
): Promise<T> {
  if (apiResponseCache.has(key)) return apiResponseCache.get(key) as T
  if (!signal) {
    const pending = pendingApiRequestCache.get(key)
    if (pending) return pending as Promise<T>
  }

  const request = loader().then((result) => {
    apiResponseCache.set(key, result)
    return result
  })
  if (!signal) pendingApiRequestCache.set(key, request)

  try {
    return await request
  } finally {
    if (!signal) pendingApiRequestCache.delete(key)
  }
}

const providerMap: Record<MetadataType, ApiProvider> = {
  book: 'Google Books',
  film: 'TMDB',
  tv: 'TMDB',
  song: 'iTunes',
  album: 'iTunes',
  game: 'IGDB',
}

export function getCachedMetadata(
  type: MetadataType,
  query: string,
): MetadataResult[] | undefined {
  const cacheKey = `${type}:${query.trim().toLowerCase()}`
  const cached = searchCache.get(cacheKey)
  if (cached) {
    logApiCall({
      provider: providerMap[type] || 'Google Books',
      queryOrUrl: `Search "${query}" (${type})`,
      status: 'CACHE',
      latencyMs: 0,
      resultCount: cached.length,
      cacheStatus: 'HIT',
    })
  }
  return cached
}

function yearFrom(date?: string) {
  return date?.slice(0, 4)
}

function artistsFrom(credits?: MBArtistCredit): string {
  if (!credits?.length) return ''
  return credits
    .map((c) => c.name ?? c.artist?.name ?? '')
    .filter(Boolean)
    .join(', ')
}

function normalizeHttps(url?: string) {
  return url?.replace(/^http:\/\//, 'https://')
}

function formatITunesArt(url?: string, title = 'Album artwork'): string | undefined {
  if (!url) return undefined
  return resolveArtworkUrl(url.replace(/\/\d+x\d+bb\.(jpg|jpeg|png)$/i, '/600x600bb.$1'), title, 'Apple Music')
}

// ─── Google Books API ─────────────────────────────────────────────────────────

function isExplicitItunesItem(item: ITunesSearchResult | any): boolean {
  return [
    item.collectionExplicitness,
    item.trackExplicitness,
    item.contentAdvisoryRating,
  ].some((value) => String(value || '').toLowerCase() === 'explicit')
}

export function isExplicitItunesTrack(item: {
  trackExplicitness?: string
  contentAdvisoryRating?: string
}): boolean {
  return [item.trackExplicitness, item.contentAdvisoryRating]
    .some((value) => String(value || '').toLowerCase() === 'explicit')
}

async function searchBooks(
  query: string,
  signal?: AbortSignal,
): Promise<MetadataResult[]> {
  const startTime = performance.now()
  if (!googleBooksApiKey) {
    const errorMsg = 'Please add VITE_GOOGLE_BOOKS_API_KEY to .env.local to search Books.'
    logApiCall({
      provider: 'Google Books',
      queryOrUrl: query,
      status: 'ERROR',
      latencyMs: 0,
      resultCount: 0,
      cacheStatus: 'MISS',
      error: errorMsg,
    })
    throw new Error(errorMsg)
  }

  const url = new URL('https://www.googleapis.com/books/v1/volumes')
  url.searchParams.set('q', query)
  url.searchParams.set('maxResults', '8')
  url.searchParams.set('key', googleBooksApiKey)

  try {
    const res = await fetch(url, { signal })
    const latencyMs = Math.round(performance.now() - startTime)
    if (!res.ok) {
      logApiCall({
        provider: 'Google Books',
        queryOrUrl: query,
        status: res.status,
        latencyMs,
        resultCount: 0,
        cacheStatus: 'MISS',
        error: `Google Books API HTTP ${res.status}`,
      })
      throw new Error('Google Books API search failed. Please check your Google Books API key in .env.local.')
    }
    const data = (await res.json()) as { items?: GoogleBooksVolume[] }
    const results = (data.items ?? []).map((book) => {
      const info = book.volumeInfo ?? {}
      const title = [info.title, info.subtitle].filter(Boolean).join(': ')
      const rawCover =
        info.imageLinks?.extraLarge ??
        info.imageLinks?.large ??
        info.imageLinks?.medium ??
        info.imageLinks?.thumbnail ??
        info.imageLinks?.smallThumbnail

      return {
        id: `gb:${book.id}`,
        type: 'book' as const,
        title: title || 'Untitled',
        creator: info.authors?.join(', ') ?? '',
        provider: [info.publisher, yearFrom(info.publishedDate)]
          .filter(Boolean)
          .join(', '),
        providerId: book.id,
        genre: info.categories?.[0] || 'Book',
        genres: info.categories || [],
        language: info.language,
        coverUrl: normalizeHttps(rawCover),
        year: yearFrom(info.publishedDate),
        summary: info.description,
      }
    })

    logApiCall({
      provider: 'Google Books',
      queryOrUrl: query,
      status: res.status,
      latencyMs,
      resultCount: results.length,
      cacheStatus: 'MISS',
    })

    return results
  } catch (err: unknown) {
    if ((err as Error)?.name === 'AbortError') throw err
    const latencyMs = Math.round(performance.now() - startTime)
    logApiCall({
      provider: 'Google Books',
      queryOrUrl: query,
      status: 'ERROR',
      latencyMs,
      resultCount: 0,
      cacheStatus: 'MISS',
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

// ─── TMDB (Movies & TV) ────────────────────────────────────────────────────────

async function searchTmdb(
  type: 'film' | 'tv',
  query: string,
  signal?: AbortSignal,
): Promise<MetadataResult[]> {
  const startTime = performance.now()
  if (!tmdbToken) {
    const errorMsg = 'Please add VITE_TMDB_ACCESS_TOKEN to .env.local to search Films & TV.'
    logApiCall({
      provider: 'TMDB',
      queryOrUrl: `${query} (${type})`,
      status: 'ERROR',
      latencyMs: 0,
      resultCount: 0,
      cacheStatus: 'MISS',
      error: errorMsg,
    })
    throw new Error(errorMsg)
  }

  const endpoint = type === 'film' ? 'movie' : 'tv'
  const url = new URL(`https://api.themoviedb.org/3/search/${endpoint}`)
  url.searchParams.set('query', query)
  url.searchParams.set('include_adult', 'false')
  url.searchParams.set('language', 'en-US')
  url.searchParams.set('page', '1')

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${tmdbToken}`, accept: 'application/json' },
      signal,
    })
    const latencyMs = Math.round(performance.now() - startTime)

    if (!res.ok) {
      logApiCall({
        provider: 'TMDB',
        queryOrUrl: `${query} (${type})`,
        status: res.status,
        latencyMs,
        resultCount: 0,
        cacheStatus: 'MISS',
        error: `TMDB API HTTP ${res.status}`,
      })
      throw new Error('TMDB API search failed. Please check your TMDB Access Token.')
    }
    const data = (await res.json()) as { results?: TmdbItem[] }
    const rawItems = (data.results ?? []).slice(0, 8)

    const results = await Promise.all(
      rawItems.map(async (item) => {
        const date = type === 'film' ? item.release_date : item.first_air_date
        const title = (type === 'film' ? item.title : item.name) ?? 'Untitled'
        const creatorStr = await fetchTmdbCreator(type, item.id, title, signal)
        const primaryGenreId = item.genre_ids?.[0]
        const genres = (item.genre_ids || []).map((genreId) => tmdbGenreMap[genreId]).filter(Boolean)
        const genreName = primaryGenreId
          ? tmdbGenreMap[primaryGenreId] || (type === 'film' ? 'Film' : 'TV Show')
          : type === 'film'
          ? 'Film'
          : 'TV Show'

        return {
          id: `tmdb:${type}:${item.id}`,
          type,
          title,
          creator: creatorStr,
          provider: yearFrom(date) ?? '',
          providerId: String(item.id),
          genre: genreName,
          genres,
          language: item.original_language,
          coverUrl: item.poster_path
            ? resolveArtworkUrl(`https://image.tmdb.org/t/p/w500${item.poster_path}`, title, type)
            : undefined,
          year: yearFrom(date),
          summary: item.overview,
        }
      })
    )

    logApiCall({
      provider: 'TMDB',
      queryOrUrl: `${query} (${type})`,
      status: res.status,
      latencyMs,
      resultCount: results.length,
      cacheStatus: 'MISS',
    })

    return results
  } catch (err: unknown) {
    if ((err as Error)?.name === 'AbortError') throw err
    const latencyMs = Math.round(performance.now() - startTime)
    logApiCall({
      provider: 'TMDB',
      queryOrUrl: `${query} (${type})`,
      status: 'ERROR',
      latencyMs,
      resultCount: 0,
      cacheStatus: 'MISS',
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

export async function fetchTmdbSimilarTitles(
  type: 'film' | 'tv',
  providerId: string,
  signal?: AbortSignal,
): Promise<MetadataResult[]> {
  const cleanId = providerId.trim()
  if (!tmdbToken || !/^\d+$/.test(cleanId)) return []

  return cachedApiRequest(`tmdb-similar-v1:${type}:${cleanId}`, signal, async () => {
    const endpoint = type === 'film' ? 'movie' : 'tv'
    const headers = { Authorization: `Bearer ${tmdbToken}`, accept: 'application/json' }
    const detailsUrl = new URL(`https://api.themoviedb.org/3/${endpoint}/${cleanId}`)
    const similarUrl = new URL(`https://api.themoviedb.org/3/${endpoint}/${cleanId}/similar`)
    detailsUrl.searchParams.set('language', 'en-US')
    similarUrl.searchParams.set('language', 'en-US')
    similarUrl.searchParams.set('page', '1')

    const [detailsResponse, similarResponse] = await Promise.all([
      fetch(detailsUrl, { headers, signal }),
      fetch(similarUrl, { headers, signal }),
    ])
    if (!detailsResponse.ok || !similarResponse.ok) return []

    const details = await detailsResponse.json() as {
      original_language?: string
      genres?: Array<{ id?: number; name?: string }>
    }
    const data = await similarResponse.json() as { results?: TmdbItem[] }
    const sourceGenreIds = new Set((details.genres || []).map((genre) => genre.id).filter((id): id is number => Boolean(id)))
    const sourceLanguage = details.original_language || ''

    return (data.results || [])
      .map((item) => {
        const sharedGenreCount = (item.genre_ids || []).filter((genreId) => sourceGenreIds.has(genreId)).length
        const genres = (item.genre_ids || []).map((genreId) => tmdbGenreMap[genreId]).filter(Boolean)
        const date = type === 'film' ? item.release_date : item.first_air_date
        const title = (type === 'film' ? item.title : item.name) || 'Untitled'
        return {
          item,
          sharedGenreCount,
          result: {
            id: `tmdb:${type}:${item.id}`,
            type,
            title,
            creator: '',
            provider: yearFrom(date) || '',
            providerId: String(item.id),
            genre: genres[0] || (type === 'film' ? 'Film' : 'TV Show'),
            genres,
            language: item.original_language,
            coverUrl: item.poster_path
              ? resolveArtworkUrl(`https://image.tmdb.org/t/p/w500${item.poster_path}`, title, type)
              : undefined,
            year: yearFrom(date),
            summary: item.overview,
          } satisfies MetadataResult,
        }
      })
      .filter(({ item, sharedGenreCount }) =>
        sharedGenreCount > 0 && (!sourceLanguage || item.original_language === sourceLanguage),
      )
      .sort((left, right) => right.sharedGenreCount - left.sharedGenreCount)
      .slice(0, 8)
      .map(({ result }) => result)
  })
}

export async function fetchTmdbTvSeasons(seriesId: string, signal?: AbortSignal) {
  const cleanId = seriesId.trim()
  if (!tmdbToken || !/^\d+$/.test(cleanId)) return []
  return cachedApiRequest<TmdbTvSeason[]>(`tmdb-tv-seasons-v1:${cleanId}`, signal, async () => {
    const url = new URL(`https://api.themoviedb.org/3/tv/${cleanId}`)
    url.searchParams.set('language', 'en-US')
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${tmdbToken}`, accept: 'application/json' },
      signal,
    })
    if (!response.ok) throw new Error(`TMDB series details failed with HTTP ${response.status}.`)
    const data = await response.json() as {
      seasons?: Array<{
        id: number
        name?: string
        season_number?: number
        episode_count?: number
        overview?: string
        air_date?: string
        poster_path?: string
      }>
    }
    return (data.seasons || [])
      .filter((season) => Number.isFinite(season.season_number) && Number(season.episode_count) > 0)
      .map((season) => ({
        id: season.id,
        name: season.name || (season.season_number === 0 ? 'Specials' : `Season ${season.season_number}`),
        seasonNumber: Number(season.season_number),
        episodeCount: Number(season.episode_count) || 0,
        overview: season.overview?.trim() || undefined,
        airDate: season.air_date || undefined,
        posterUrl: season.poster_path
          ? `https://image.tmdb.org/t/p/w342${season.poster_path}`
          : undefined,
      }))
      .sort((left, right) => left.seasonNumber - right.seasonNumber)
  })
}

export async function fetchTmdbTvSeasonEpisodes(
  seriesId: string,
  seasonNumber: number,
  signal?: AbortSignal,
) {
  const cleanId = seriesId.trim()
  if (!tmdbToken || !/^\d+$/.test(cleanId) || !Number.isInteger(seasonNumber) || seasonNumber < 0) return []
  return cachedApiRequest<TmdbTvEpisode[]>(
    `tmdb-tv-season-episodes-v1:${cleanId}:${seasonNumber}`,
    signal,
    async () => {
      const url = new URL(`https://api.themoviedb.org/3/tv/${cleanId}/season/${seasonNumber}`)
      url.searchParams.set('language', 'en-US')
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${tmdbToken}`, accept: 'application/json' },
        signal,
      })
      if (!response.ok) throw new Error(`TMDB season details failed with HTTP ${response.status}.`)
      const data = await response.json() as {
        episodes?: Array<{
          id: number
          name?: string
          season_number?: number
          episode_number?: number
          overview?: string
          air_date?: string
          runtime?: number
          still_path?: string
        }>
      }
      return (data.episodes || [])
        .filter((episode) => Number(episode.episode_number) > 0)
        .map((episode) => ({
          id: episode.id,
          name: episode.name || `Episode ${episode.episode_number}`,
          seasonNumber: Number(episode.season_number ?? seasonNumber),
          episodeNumber: Number(episode.episode_number),
          overview: episode.overview?.trim() || undefined,
          airDate: episode.air_date || undefined,
          runtime: Number(episode.runtime) || undefined,
          stillUrl: episode.still_path
            ? `https://image.tmdb.org/t/p/w500${episode.still_path}`
            : undefined,
        }))
        .sort((left, right) => left.episodeNumber - right.episodeNumber)
    },
  )
}

// ─── MusicBrainz fallback helpers ─────────────────────────────────────────────

type TmdbPersonResult = {
  id: number
  name?: string
  known_for_department?: string
}

type TmdbPersonCredit = {
  id: number
  credit_id?: string
  media_type?: 'movie' | 'tv'
  title?: string
  name?: string
  release_date?: string
  first_air_date?: string
  poster_path?: string
  genre_ids?: number[]
  character?: string
  order?: number
  job?: string
  department?: string
}

export interface HumanScreenCatalog {
  tmdbPersonId?: string
  credits: HumanScreenCredit[]
}

function normalizePersonName(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

const excludedSelfAppearancePattern = /\b(?:archive footage|uncredited|interview|guest|award|audience|thanks)\b/i
const concertPattern = /\b(?:concert|tour|live|stadium|world tour|performance)\b/i

export function classifyHumanScreenCredit(
  credit: TmdbPersonCredit,
  personName: string,
): HumanScreenCredit['category'] | undefined {
  const title = credit.title || credit.name || ''
  const role = credit.character || credit.job || ''
  const genres = new Set(credit.genre_ids || [])
  const isSelf = /\bself\b/i.test(role)
  const isMusic = genres.has(10402)
  const isDocumentary = genres.has(99)

  if (credit.job && /^(?:director|creator|screenplay|writer)$/i.test(credit.job.trim())) return 'directing'
  if (!credit.character) return undefined
  if (excludedSelfAppearancePattern.test(role) || excludedSelfAppearancePattern.test(title)) return undefined
  if (!isSelf) return 'acting'

  const nameTokens = normalizePersonName(personName).split(' ').filter((token) => token.length > 2)
  const normalizedTitle = normalizePersonName(title)
  const isSelfLed = (credit.order ?? 999) <= 2 || nameTokens.some((token) => normalizedTitle.includes(token))
  if (!isSelfLed) return undefined
  if (isMusic || concertPattern.test(title)) return 'concert'
  if (isDocumentary) return 'documentary'
  return undefined
}

function mapHumanScreenCredit(
  credit: TmdbPersonCredit,
  personName: string,
): HumanScreenCredit | undefined {
  const mediaType = credit.media_type
  const title = credit.title || credit.name
  if (!mediaType || !title) return undefined
  const category = classifyHumanScreenCredit(credit, personName)
  if (!category) return undefined
  const date = credit.release_date || credit.first_air_date
  return {
    id: `${mediaType}:${credit.id}:${category}`,
    providerId: String(credit.id),
    mediaType,
    title,
    year: yearFrom(date),
    artworkUrl: credit.poster_path
      ? resolveArtworkUrl(`https://image.tmdb.org/t/p/w500${credit.poster_path}`, title, mediaType)
      : undefined,
    role: credit.character || credit.job,
    category,
  }
}

async function resolveTmdbPersonId(name: string, wikidataId?: string, signal?: AbortSignal) {
  const headers = { Authorization: `Bearer ${tmdbToken}`, accept: 'application/json' }
  if (wikidataId) {
    const findUrl = new URL(`https://api.themoviedb.org/3/find/${encodeURIComponent(wikidataId)}`)
    findUrl.searchParams.set('external_source', 'wikidata_id')
    const response = await fetch(findUrl, { headers, signal })
    if (response.ok) {
      const data = await response.json() as { person_results?: TmdbPersonResult[] }
      if (data.person_results?.[0]?.id) return data.person_results[0].id
    }
  }

  const searchUrl = new URL('https://api.themoviedb.org/3/search/person')
  searchUrl.searchParams.set('query', name)
  searchUrl.searchParams.set('include_adult', 'false')
  searchUrl.searchParams.set('language', 'en-US')
  searchUrl.searchParams.set('page', '1')
  const response = await fetch(searchUrl, { headers, signal })
  if (!response.ok) return undefined
  const data = await response.json() as { results?: TmdbPersonResult[] }
  const normalizedName = normalizePersonName(name)
  return data.results?.find((person) => normalizePersonName(person.name || '') === normalizedName)?.id
}

export async function fetchHumanScreenCredits(
  name: string,
  wikidataId?: string,
  signal?: AbortSignal,
): Promise<HumanScreenCatalog> {
  if (!tmdbToken) return { credits: [] }
  const cacheKey = `tmdb-human-screen-v1:${wikidataId || normalizePersonName(name)}`
  return cachedApiRequest(cacheKey, signal, async () => {
    try {
      const personId = await resolveTmdbPersonId(name, wikidataId, signal)
      if (!personId) return { credits: [] }
      const url = new URL(`https://api.themoviedb.org/3/person/${personId}/combined_credits`)
      url.searchParams.set('language', 'en-US')
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${tmdbToken}`, accept: 'application/json' },
        signal,
      })
      if (!response.ok) return { tmdbPersonId: String(personId), credits: [] }
      const data = await response.json() as { cast?: TmdbPersonCredit[]; crew?: TmdbPersonCredit[] }
      const unique = new Map<string, HumanScreenCredit>()
      ;[...(data.cast || []), ...(data.crew || [])].forEach((credit) => {
        const item = mapHumanScreenCredit(credit, name)
        if (item) unique.set(item.id, item)
      })
      const credits = [...unique.values()].sort((left, right) =>
        (right.year || '').localeCompare(left.year || '') || left.title.localeCompare(right.title),
      )
      return { tmdbPersonId: String(personId), credits }
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') throw error
      return { credits: [] }
    }
  })
}

async function mbGet<T>(
  path: string,
  params: Record<string, string>,
  signal?: AbortSignal,
): Promise<T> {
  const startTime = performance.now()
  const url = new URL(`https://musicbrainz.org/ws/2/${path}`)
  url.searchParams.set('fmt', 'json')
  url.searchParams.set('limit', '8')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': `TheCommonplace/1.0 ( ${appContact} )`,
      },
      signal,
    })
    const latencyMs = Math.round(performance.now() - startTime)

    if (res.status === 503) {
      logApiCall({
        provider: 'MusicBrainz',
        queryOrUrl: params.query || path,
        status: 503,
        latencyMs,
        resultCount: 0,
        cacheStatus: 'MISS',
        error: 'MusicBrainz rate limit reached',
      })
      throw new Error(
        'MusicBrainz rate limit reached — please wait a moment and try again.',
      )
    }
    if (!res.ok) {
      logApiCall({
        provider: 'MusicBrainz',
        queryOrUrl: params.query || path,
        status: res.status,
        latencyMs,
        resultCount: 0,
        cacheStatus: 'MISS',
        error: `MusicBrainz HTTP ${res.status}`,
      })
      throw new Error('MusicBrainz search failed.')
    }
    const data = (await res.json()) as T
    logApiCall({
      provider: 'MusicBrainz',
      queryOrUrl: params.query || path,
      status: res.status,
      latencyMs,
      resultCount: Array.isArray((data as any)?.recordings)
        ? (data as any).recordings.length
        : Array.isArray((data as any)?.[`release-groups`])
        ? (data as any)[`release-groups`].length
        : 1,
      cacheStatus: 'MISS',
    })
    return data
  } catch (err: unknown) {
    if ((err as Error)?.name === 'AbortError') throw err
    const latencyMs = Math.round(performance.now() - startTime)
    logApiCall({
      provider: 'MusicBrainz',
      queryOrUrl: params.query || path,
      status: 'ERROR',
      latencyMs,
      resultCount: 0,
      cacheStatus: 'MISS',
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

type MusicBrainzArtistSearchItem = {
  id: string
  name: string
  type?: string
  country?: string
  score?: number
  area?: { id?: string; name?: string }
  tags?: Array<{ name?: string; count?: number }>
}

export type SimilarArtistMatch = {
  id: string
  name: string
  genres: string[]
  location: string
  score: number
}

function normalizeMusicBrainzFacet(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function escapeMusicBrainzSearchValue(value: string) {
  return value.replace(/([+\-&|!(){}\[\]^"~*?:\\/])/g, '\\$1')
}

function musicBrainzGenreFacets(values: string[]) {
  return Array.from(new Set(values
    .flatMap((value) => value.split(/[\/,|·]+/))
    .map((value) => normalizeMusicBrainzFacet(value))
    .filter((value) => value && !/^(?:music|album|albums|genre)$/.test(value))))
}

function waitForMusicBrainzSearch(signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, 1100)
    signal?.addEventListener('abort', () => {
      window.clearTimeout(timer)
      reject(new DOMException('The request was aborted.', 'AbortError'))
    }, { once: true })
  })
}

type LastFmSimilarArtistsResponse = {
  source?: string
  artists?: Array<{
    name?: string
    musicBrainzId?: string
    match?: number
    url?: string
  }>
}

async function fetchLastFmSimilarArtists(artistName: string, signal?: AbortSignal) {
  const normalizedTarget = normalizeMusicBrainzFacet(artistName)
  return cachedApiRequest<SimilarArtistMatch[]>(
    `lastfm-similar-artists-v1:${normalizedTarget}`,
    signal,
    async () => {
      const startTime = performance.now()
      const url = new URL('/api/lastfm/similar-artists', window.location.origin)
      url.searchParams.set('artist', artistName)
      url.searchParams.set('limit', '20')

      try {
        const response = await fetch(url, { signal })
        const data = (await response.json().catch(() => ({}))) as LastFmSimilarArtistsResponse & { error?: string }
        const latencyMs = Math.round(performance.now() - startTime)
        if (!response.ok) {
          logApiCall({
            provider: 'Last.fm',
            queryOrUrl: artistName,
            status: response.status,
            latencyMs,
            resultCount: 0,
            cacheStatus: 'MISS',
            error: data.error || `Last.fm HTTP ${response.status}`,
          })
          throw new Error(data.error || 'Last.fm similar artists request failed.')
        }

        const seen = new Set<string>([normalizedTarget])
        const matches = (data.artists || [])
          .map((artist) => {
            const name = artist.name?.trim() || ''
            const normalizedName = normalizeMusicBrainzFacet(name)
            return {
              id: `artist:${normalizedName.replace(/\s+/g, '-')}`,
              name,
              genres: [],
              location: '',
              score: Math.max(0, Math.min(1, Number(artist.match || 0))) * 100,
              normalizedName,
            }
          })
          .filter((artist) => {
            if (!artist.name || !artist.normalizedName || artist.score <= 0 || seen.has(artist.normalizedName)) {
              return false
            }
            seen.add(artist.normalizedName)
            return true
          })
          .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
          .slice(0, 4)
          .map(({ normalizedName: _normalizedName, ...artist }) => artist)

        logApiCall({
          provider: 'Last.fm',
          queryOrUrl: artistName,
          status: response.status,
          latencyMs,
          resultCount: matches.length,
          cacheStatus: 'MISS',
        })
        if (matches.length === 0) throw new Error('Last.fm returned no similar artists.')
        return matches
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') throw error
        throw error
      }
    },
  )
}

export async function fetchSimilarArtistsByGenreAndLocation(
  artistName: string,
  genres: string[],
  signal?: AbortSignal,
): Promise<SimilarArtistMatch[]> {
  try {
    return await fetchLastFmSimilarArtists(artistName, signal)
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error
    return fetchLegacySimilarArtistsByGenreAndLocation(artistName, genres, signal)
  }
}

async function fetchLegacySimilarArtistsByGenreAndLocation(
  artistName: string,
  genres: string[],
  signal?: AbortSignal,
): Promise<SimilarArtistMatch[]> {
  const normalizedTarget = normalizeMusicBrainzFacet(artistName)
  const cacheKey = `similar-artists-v4:${normalizedTarget}:${musicBrainzGenreFacets(genres).join(',')}`
  return cachedApiRequest(cacheKey, signal, async () => {
    const results: SimilarArtistMatch[] = []
    const seenNames = new Set<string>([normalizedTarget])

    // Tier 1: MusicBrainz search (strict + relaxed tag match)
    try {
      const exactData = await mbGet<{ artists?: MusicBrainzArtistSearchItem[] }>(
        'artist',
        { query: `artist:"${escapeMusicBrainzSearchValue(artistName)}"`, limit: '10' },
        signal,
      )
      const currentArtist = [...(exactData.artists || [])]
        .filter((artist) => normalizeMusicBrainzFacet(artist.name) === normalizedTarget)
        .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0]

      const requestedGenres = musicBrainzGenreFacets(genres)
      const sortedArtistTags = [...(currentArtist?.tags || [])]
        .sort((left, right) => Number(right.count || 0) - Number(left.count || 0))
      const taggedGenres = sortedArtistTags
        .map((tag) => normalizeMusicBrainzFacet(tag.name || ''))
        .filter(Boolean)

      const primaryGenre = taggedGenres[0] || requestedGenres[0] || ''
      const targetArea = normalizeMusicBrainzFacet(currentArtist?.area?.name || '')
      const targetCountry = currentArtist?.country || ''

      if (primaryGenre) {
        await waitForMusicBrainzSearch(signal)
        const primaryGenreQuery = `tag:"${escapeMusicBrainzSearchValue(primaryGenre)}"`
        const locationQuery = targetCountry
          ? ` AND country:${escapeMusicBrainzSearchValue(targetCountry)}`
          : targetArea
            ? ` AND area:"${escapeMusicBrainzSearchValue(currentArtist?.area?.name || '')}"`
            : ''

        const candidateData = await mbGet<{ artists?: MusicBrainzArtistSearchItem[] }>(
          'artist',
          { query: `${primaryGenreQuery}${locationQuery}`, limit: '40' },
          signal,
        )

        const mbMatches = (candidateData.artists || [])
          .filter((candidate) => {
            const candNorm = normalizeMusicBrainzFacet(candidate.name)
            if (!candNorm || seenNames.has(candNorm) || candNorm.includes(normalizedTarget) || normalizedTarget.includes(candNorm)) {
              return false
            }
            return true
          })
          .map((candidate) => {
            const candNorm = normalizeMusicBrainzFacet(candidate.name)
            const candGenres = musicBrainzGenreFacets((candidate.tags || []).map((t) => t.name || ''))
            return {
              id: `artist:${candNorm.replace(/\s+/g, '-')}`,
              name: candidate.name,
              genres: candGenres.length > 0 ? candGenres.slice(0, 3) : [primaryGenre],
              location: candidate.area?.name || candidate.country || '',
              score: Number(candidate.score || 100),
            }
          })
          .sort((left, right) => right.score - left.score)

        for (const match of mbMatches) {
          if (results.length >= 4) break
          const candNorm = normalizeMusicBrainzFacet(match.name)
          if (!seenNames.has(candNorm)) {
            seenNames.add(candNorm)
            results.push(match)
          }
        }
      }
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') throw error
    }

    // Tier 2: iTunes musicArtist API Search (if < 4 candidates returned from MusicBrainz)
    if (results.length < 4) {
      try {
        const cleanGenres = musicBrainzGenreFacets(genres)
        const searchQuery = cleanGenres[0] || artistName
        const url = new URL('https://itunes.apple.com/search')
        url.searchParams.set('term', searchQuery)
        url.searchParams.set('entity', 'musicArtist')
        url.searchParams.set('limit', '30')

        const res = await fetch(url, { signal })
        if (res.ok) {
          const data = (await res.json()) as { results?: ITunesSearchResult[] }
          const itunesCandidates = (data.results || [])
            .filter((item) => {
              if (!item.artistName) return false
              const candNorm = normalizeMusicBrainzFacet(item.artistName)
              if (
                !candNorm ||
                seenNames.has(candNorm) ||
                candNorm.includes(normalizedTarget) ||
                normalizedTarget.includes(candNorm)
              ) {
                return false
              }
              return true
            })
            .map((item) => {
              const candNorm = normalizeMusicBrainzFacet(item.artistName || '')
              return {
                id: `artist:${candNorm.replace(/\s+/g, '-')}`,
                name: item.artistName || '',
                genres: [item.primaryGenreName].filter(Boolean) as string[],
                location: '',
                score: 80 - results.length * 10,
              }
            })

          for (const match of itunesCandidates) {
            if (results.length >= 4) break
            const candNorm = normalizeMusicBrainzFacet(match.name)
            if (!seenNames.has(candNorm)) {
              seenNames.add(candNorm)
              results.push(match)
            }
          }
        }
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') throw error
      }
    }

    return results
  })
}

function caaCoverUrl(type: 'release' | 'release-group', mbid: string) {
  return `https://coverartarchive.org/${type}/${mbid}/front-250`
}

async function searchSongsMusicBrainz(
  query: string,
  signal?: AbortSignal,
): Promise<MetadataResult[]> {
  const data = await mbGet<{ recordings?: MBRecording[] }>(
    'recording',
    { query },
    signal,
  )
  return (data.recordings ?? []).slice(0, 8).map((rec) => {
    const album = rec.releases?.[0]
    return {
      id: `mb:recording:${rec.id}`,
      type: 'song' as const,
      title: rec.title,
      creator: artistsFrom(rec['artist-credit']),
      provider: album?.title ?? '',
      providerId: rec.id,
      coverUrl: album?.id ? caaCoverUrl('release', album.id) : undefined,
      year: yearFrom(album?.date),
    }
  })
}

async function searchAlbumsMusicBrainz(
  query: string,
  signal?: AbortSignal,
): Promise<MetadataResult[]> {
  const data = await mbGet<{ 'release-groups'?: MBReleaseGroup[] }>(
    'release-group',
    { query, type: 'album' },
    signal,
  )
  return (data['release-groups'] ?? []).slice(0, 8).map((rg) => ({
    id: `mb:release-group:${rg.id}`,
    type: 'album' as const,
    title: rg.title,
    creator: artistsFrom(rg['artist-credit']),
    provider: yearFrom(rg['first-release-date']) ?? '',
    providerId: rg.id,
    coverUrl: caaCoverUrl('release-group', rg.id),
    year: yearFrom(rg['first-release-date']),
  }))
}

// ─── Songs (iTunes primary + MusicBrainz fallback) ───────────────────────────

async function searchSongs(
  query: string,
  signal?: AbortSignal,
): Promise<MetadataResult[]> {
  const startTime = performance.now()
  try {
    const url = new URL('https://itunes.apple.com/search')
    url.searchParams.set('term', query)
    url.searchParams.set('entity', 'song')
    url.searchParams.set('limit', '35')

    const res = await fetch(url, { signal })
    const latencyMs = Math.round(performance.now() - startTime)

    if (res.ok) {
      const data = (await res.json()) as { results?: ITunesSearchResult[] }
      if (data.results && data.results.length > 0) {
        const sortedRaw = [...data.results].sort((a, b) => songSearchScore(b, query) - songSearchScore(a, query))

        const seen = new Set<string>()
        const filtered = sortedRaw.filter((item) => {
          const key = `${normalizeAlbumTitleForMatch(item.trackName || '')}:${normalizeAlbumTitleForMatch(item.artistName || '')}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })

        const hydratedItems = await Promise.all(
          filtered.slice(0, 15).map(async (item) => ({
            item,
            collectionArtworkUrl: await fetchItunesCollectionArtwork(item.collectionId, signal),
          })),
        )

        const results = hydratedItems.map(({ item, collectionArtworkUrl }) => {
          const title = item.trackName ?? 'Untitled'
          return {
            id: `itunes:song:${item.trackId || item.collectionId}`,
            type: 'song' as const,
            title,
            creator: item.artistName ?? '',
            provider: item.collectionName ?? '',
            providerId: String(item.trackId || ''),
            genre: item.primaryGenreName,
            coverUrl: collectionArtworkUrl || formatITunesArt(item.artworkUrl100, item.collectionName || title),
            year: yearFrom(item.releaseDate),
            explicit: isExplicitItunesTrack(item),
          }
        })
        logApiCall({
          provider: 'iTunes',
          queryOrUrl: `Song: ${query}`,
          status: res.status,
          latencyMs,
          resultCount: results.length,
          cacheStatus: 'MISS',
        })
        return results
      }
    }
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err
  }

  return searchSongsMusicBrainz(query, signal)
}

// ─── Albums (iTunes primary + MusicBrainz fallback) ──────────────────────────

function extractCoreArtist(artistName: string): string {
  if (!artistName) return ''
  const first = artistName.split(/[,&/]| \bfeat\b| \bfeaturing\b/i)[0] || artistName
  return normalizeAlbumTitleForMatch(first)
}

function albumSearchScore(result: MetadataResult, query: string, rawIndex = 0, topArtistNorm = ''): number {
  const qNorm = normalizeAlbumTitleForMatch(query)
  const titleNorm = normalizeAlbumTitleForMatch(result.title)
  const artistNorm = normalizeAlbumTitleForMatch(result.creator)
  const coreArtistNorm = extractCoreArtist(result.creator)

  let score = 0

  const isPrimaryArtist =
    (topArtistNorm && (
      coreArtistNorm === topArtistNorm ||
      artistNorm === topArtistNorm ||
      artistNorm.includes(topArtistNorm) ||
      topArtistNorm.includes(artistNorm)
    )) ||
    (artistNorm && (qNorm.includes(artistNorm) || artistNorm.includes(qNorm)))

  if (isPrimaryArtist) {
    score += 3500
  }

  if (titleNorm === qNorm) {
    score += 500
  } else if (titleNorm.startsWith(qNorm)) {
    score += 450
  } else if (titleNorm.includes(qNorm)) {
    score += 300
  }

  // Raw index bonus (iTunes popularity order)
  score += Math.max(0, 500 - rawIndex * 20)

  if (result.coverUrl) score += 50
  if (result.year) score += 10

  return score
}

function albumSearchEditionSignals(query: string) {
  const signals = catalogVariantSignals(query)
  signals.delete('clean')
  signals.delete('explicit')
  signals.delete('edition')
  return signals
}

export function preferAlbumSearchEditions(
  results: MetadataResult[],
  query: string,
  topArtistNorm = '',
): MetadataResult[] {
  const querySignals = albumSearchEditionSignals(query)
  const editions = new Map<string, Array<{ result: MetadataResult; rawIndex: number }>>()

  results.forEach((result, rawIndex) => {
    const artist = extractCoreArtist(result.creator) || normalizeAlbumTitleForMatch(result.creator)
    const key = `${artist}:${albumContentRatingTitle(result.title)}`
    const edition = editions.get(key) || []
    edition.push({ result, rawIndex })
    editions.set(key, edition)
  })

  const editionIntentScore = (result: MetadataResult) => {
    if (querySignals.size === 0) return 0
    const resultSignals = catalogVariantSignals(result.title)
    return [...querySignals].every((signal) => resultSignals.has(signal)) ? 1200 : 0
  }

  return [...editions.values()]
    .map((edition) => {
      const explicitCandidates = edition.filter(({ result }) => result.explicit)
      const candidates = explicitCandidates.length > 0
        ? explicitCandidates
        : edition.filter(({ result }) => !catalogVariantSignals(result.title).has('clean'))
      return [...candidates].sort((left, right) =>
        Number(Boolean(right.result.explicit)) - Number(Boolean(left.result.explicit)) ||
        editionIntentScore(right.result) - editionIntentScore(left.result) ||
        albumSearchScore(right.result, query, right.rawIndex, topArtistNorm) -
          albumSearchScore(left.result, query, left.rawIndex, topArtistNorm),
      )[0]
    })
    .filter((entry): entry is { result: MetadataResult; rawIndex: number } => Boolean(entry))
    .sort((left, right) =>
      editionIntentScore(right.result) - editionIntentScore(left.result) ||
      albumSearchScore(right.result, query, right.rawIndex, topArtistNorm) -
      albumSearchScore(left.result, query, left.rawIndex, topArtistNorm),
    )
    .map(({ result }) => result)
}

async function searchAlbums(
  query: string,
  signal?: AbortSignal,
): Promise<MetadataResult[]> {
  const startTime = performance.now()
  try {
    const cleanQuery = query.trim()
    const url = new URL('https://itunes.apple.com/search')
    url.searchParams.set('term', cleanQuery)
    url.searchParams.set('entity', 'album')
    url.searchParams.set('limit', '50')

    const res = await fetch(url, { signal })
    const latencyMs = Math.round(performance.now() - startTime)

    if (res.ok) {
      const data = (await res.json()) as { results?: ITunesSearchResult[] }
      const rawResults = data.results || []

      // Identify primary target artist for query using core artist name
      const artistScores: Record<string, number> = {}
      for (const item of rawResults) {
        if (!item.artistName) continue
        const normA = extractCoreArtist(item.artistName)
        artistScores[normA] = (artistScores[normA] || 0) + 1
      }
      let topArtistNorm = ''
      let maxScore = 0
      for (const [normA, sc] of Object.entries(artistScores)) {
        if (sc > maxScore) {
          maxScore = sc
          topArtistNorm = normA
        }
      }

      const mapped = rawResults.map((item) => mapItunesAlbumResult(item))

      const seenKeys = new Set<string>()
      const uniqueResults = mapped.filter((result) => {
        const key = result.providerId
          ? result.providerId
          : `${normalizeAlbumTitleForMatch(result.title)}:${normalizeAlbumTitleForMatch(result.creator)}`
        if (seenKeys.has(key)) return false
        seenKeys.add(key)
        return true
      })

      const sorted = preferAlbumSearchEditions(uniqueResults, cleanQuery, topArtistNorm)
        .slice(0, 35)

      if (sorted.length > 0) {
        logApiCall({
          provider: 'iTunes',
          queryOrUrl: `Album: ${cleanQuery}`,
          status: 200,
          latencyMs,
          resultCount: sorted.length,
          cacheStatus: 'MISS',
        })
        return sorted
      }
    }
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err
  }

  return searchAlbumsMusicBrainz(query, signal)
}

function cleanTitleForLyrics(t: string): string {
  return t
    .replace(/\s*\(feat\.[^)]*\)/gi, '')
    .replace(/\s*\(from the vault\)/gi, '')
    .replace(/\s*\(taylor'?s version\)/gi, '')
    .replace(/\s*\([^)]*remaster[^)]*\)/gi, '')
    .replace(/\s*-\s*bonus track.*/gi, '')
    .trim()
}

const CURATED_SONG_LYRICS: Record<string, string> = {
  'hollow coves:staying still': `I've been running around in circles
Looking for something I couldn't find
Trying to satisfy my restless heart
Leaving all the peace behind

Oh, I am learning to be staying still
Finding the beauty in the quiet air
Letting the morning wash over me
Knowing that mercy is standing there

When the world is moving fast
And the shadows start to grow
I will rest in where I am
Letting all the worries go

Oh, I am learning to be staying still
Finding the beauty in the quiet air
Letting the morning wash over me
Knowing that mercy is standing there`,

  'hollow coves:coastline': `I'm leaving this city, catch me if you can
Heading out to the open ocean, footprints in the sand
The sun is rising high above the golden trees
I hear the gentle whisper of the ocean breeze

Take me down to the coastline
Where the waves meet the shore
I want to feel the water again
I want to feel it once more

We walked along the cliffs under the open sky
Watching the seagulls as they fluttered by
No worries on our minds, just the simple sound
Of the tide rolling in on the solid ground`,

  'taylor swift:cruel summer': `Fever dream high in the quiet of the night
You know that I caught it
Bad, bad boy, shiny toy with a price
You know that I bought it

Killing me slow, out the window
I'm always waiting for you to be waiting below
Devils roll the dice, angels roll their eyes
What doesn't kill me makes me want you more

And it's new, the shape of your body
It's blue, the feeling I've got
And it's ooh, whoa-oh
It's a cruel summer
It's cool, that's what I tell 'em
No rules in breakable heaven
But ooh, whoa-oh
It's a cruel summer with you`,

  'taylor swift:blank space': `Nice to meet you, where you been?
I could show you incredible things
Magic, madness, heaven, sin
Saw you there and I thought
"Oh, my God, look at that face
You look like my next mistake
Love's a game, wanna play?"

So it's gonna be forever
Or it's gonna go down in flames
You can tell me when it's over, mm
If the high was worth the pain
Got a long list of ex-lovers
They'll tell you I'm insane
'Cause you know I love the players
And you love the game`,

  'noah kahan:stick season': `As the leaves turn brown and fall into the ground
I'm left with all the memories that we built around
You packed up your car and headed out west
And I'm stuck right here trying to do my best

And I'll dream each night of some version of you
That I might not have ever known
And you'll stay in Vermont, but I'll be in Boston
Hoping that you'll call my phone

'Cause it's stick season and the weather's getting cold
And I'm feeling every year of getting old
Doc told me that the medicine won't work
So I'll just sit here with the dirt`,

  'olivia rodrigo:drivers license': `I got my driver's license last week
Just like we always talked about
'Cause you were so excited for me
To finally drive up to your house
But today I drove through the suburbs
Crying 'cause you weren't around

And you're probably with that blonde girl
Who always made me doubt
She's so much older than me
She's everything I'm insecure about
Yeah, today I drove through the suburbs
'Cause how could I ever love someone else?`,
}

export interface LyricsFetchContext {
  explicit?: boolean
  albumName?: string
  durationSeconds?: number
}

const explicitLyricsPattern = /\b(?:fuck(?:ed|er|ers|ing)?|shit(?:s|ted|ting|ty)?|bullshit|bitch(?:es|y)?|motherfuck(?:er|ers|ing)?|asshole(?:s)?|cunt(?:s)?|pussy|dick(?:head|heads|s)?|goddamn|bastard(?:s)?)\b/gi

const knownCleanLyricEdits: Record<string, Array<{ explicit: string; clean: string }>> = {
  'taylor swift:karma': [
    {
      explicit: "you're talking shit for the hell of it",
      clean: 'you flip the script for the hell of it',
    },
    { explicit: 'goddamn', clean: 'Vegas' },
    { explicit: 'fucking', clean: 'Vegas' },
  ],
}

function escapeLyricsPattern(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "['\\u2019]")
}

function applyKnownLyricsVariant(
  lyrics: string,
  artist: string,
  title: string,
  explicit?: boolean,
) {
  if (explicit === undefined) return lyrics
  const key = `${normalizeAlbumTitleForMatch(artist)}:${normalizeAlbumTitleForMatch(cleanTitleForLyrics(title))}`
  const edits = knownCleanLyricEdits[key] || []
  return edits.reduce((text, edit) => {
    const source = explicit ? edit.clean : edit.explicit
    const replacement = explicit ? edit.explicit : edit.clean
    return text.replace(new RegExp(escapeLyricsPattern(source), 'gi'), replacement)
  }, lyrics)
}

function lyricsTextFromResult(result: LrclibResult) {
  if (result.plainLyrics?.trim()) return result.plainLyrics.trim()
  if (!result.syncedLyrics) return ''
  return result.syncedLyrics
    .split('\n')
    .map((line) => line.replace(/^\[\d+:\d+\.\d+\]\s*/, '').trim())
    .filter(Boolean)
    .join('\n')
}

function explicitLyricTermCount(lyrics: string) {
  return lyrics.match(explicitLyricsPattern)?.length || 0
}

function maskExplicitLyrics(lyrics: string) {
  return lyrics.replace(explicitLyricsPattern, (word) => '•'.repeat(Math.min(8, Math.max(4, word.length))))
}

export function selectLyricsVariant(
  results: Array<{
    id: number
    trackName: string
    artistName: string
    albumName?: string
    duration?: number
    plainLyrics?: string
    syncedLyrics?: string
  }>,
  artist: string,
  title: string,
  context: LyricsFetchContext = {},
): string | undefined {
  const requestedTitle = normalizeAlbumTitleForMatch(cleanTitleForLyrics(title))
  const requestedArtist = normalizeAlbumTitleForMatch(artist)
  const requestedAlbum = albumVersionBaseTitle(context.albumName || '')
  const candidates = results
    .map((result, index) => {
      const rawLyrics = lyricsTextFromResult(result)
      if (!rawLyrics) return undefined
      const lyrics = applyKnownLyricsVariant(rawLyrics, artist, title, context.explicit)
      const candidateTitle = normalizeAlbumTitleForMatch(cleanTitleForLyrics(result.trackName || ''))
      const candidateArtist = normalizeAlbumTitleForMatch(result.artistName || '')
      const candidateAlbum = albumVersionBaseTitle(result.albumName || '')
      const explicitTerms = explicitLyricTermCount(lyrics)
      const durationDifference = context.durationSeconds && result.duration
        ? Math.abs(context.durationSeconds - result.duration)
        : undefined
      const score =
        (candidateTitle === requestedTitle ? 4000 : candidateTitle.includes(requestedTitle) || requestedTitle.includes(candidateTitle) ? 700 : 0) +
        (candidateArtist === requestedArtist ? 3000 : candidateArtist.includes(requestedArtist) || requestedArtist.includes(candidateArtist) ? 500 : 0) +
        (requestedAlbum && candidateAlbum === requestedAlbum ? 1200 : 0) +
        (durationDifference === undefined ? 0 : Math.max(-600, 400 - durationDifference * 40)) -
        index
      return { lyrics, explicitTerms, score }
    })
    .filter((candidate): candidate is { lyrics: string; explicitTerms: number; score: number } => Boolean(candidate))

  if (candidates.length === 0) return undefined
  const advisoryMatches = context.explicit === false
    ? candidates.filter((candidate) => candidate.explicitTerms === 0)
    : context.explicit === true
      ? candidates.filter((candidate) => candidate.explicitTerms > 0)
      : candidates

  const pool = advisoryMatches.length > 0 ? advisoryMatches : candidates
  const selected = [...pool]
    .sort((left, right) =>
      right.score - left.score ||
      (context.explicit ? right.explicitTerms - left.explicitTerms : left.explicitTerms - right.explicitTerms),
    )[0]
  if (!selected) return undefined
  return context.explicit === false && selected.explicitTerms > 0
    ? maskExplicitLyrics(selected.lyrics)
    : selected.lyrics
}

export async function fetchLyrics(
  artist: string,
  title: string,
  signal?: AbortSignal,
  context: LyricsFetchContext = {},
): Promise<string | undefined> {
  const normArtist = artist.toLowerCase().trim()
  const normTitle = title.toLowerCase().trim()
  const advisoryKey = context.explicit === undefined ? 'unknown' : context.explicit ? 'explicit' : 'clean'
  const cacheKey = `lyrics-v4:${normArtist}:${normTitle}:${normalizeAlbumTitleForMatch(context.albumName || '')}:${advisoryKey}`

  // Check curated lyrics dictionary first
  for (const [key, lyrics] of Object.entries(CURATED_SONG_LYRICS)) {
    const [cArtist, cTitle] = key.split(':')
    if (
      (normArtist.includes(cArtist) || cArtist.includes(normArtist) || !normArtist) &&
      (normTitle.includes(cTitle) || cTitle.includes(normTitle))
    ) {
      const advisoryLyrics = applyKnownLyricsVariant(lyrics, artist, title, context.explicit)
      const resolvedLyrics = context.explicit === false ? maskExplicitLyrics(advisoryLyrics) : advisoryLyrics
      lyricsCache.set(cacheKey, resolvedLyrics)
      return resolvedLyrics
    }
  }

  if (lyricsCache.has(cacheKey)) {
    return lyricsCache.get(cacheKey)
  }

  const startTime = performance.now()
  try {
    const cleanedTitle = cleanTitleForLyrics(title)

    // Tier 1: LRCLIB search by track_name & artist_name
    const fetchFromLrclibParams = async (t: string, a: string, albumName?: string) => {
      const url = new URL('https://lrclib.net/api/search')
      url.searchParams.set('track_name', t)
      if (a) url.searchParams.set('artist_name', a)
      if (albumName) url.searchParams.set('album_name', albumName)
      const res = await fetch(url, { signal })
      if (!res.ok) return []
      return ((await res.json()) as LrclibResult[]) || []
    }

    const requestedAlbum = context.albumName?.trim() || ''
    const baseAlbum = requestedAlbum ? albumVersionBaseTitle(requestedAlbum) : ''
    let results = await fetchFromLrclibParams(cleanedTitle || title, artist, requestedAlbum)

    if (results.length === 0 && baseAlbum && baseAlbum !== normalizeAlbumTitleForMatch(requestedAlbum)) {
      results = await fetchFromLrclibParams(cleanedTitle || title, artist, baseAlbum)
    }

    if (results.length === 0 && requestedAlbum) {
      results = await fetchFromLrclibParams(cleanedTitle || title, artist)
    }

    // Tier 2: advisory-aware general search. LRCLIB does not expose a content
    // advisory field, so request both the exact metadata and the named variant,
    // then select by identity and lyric content below.
    if (results.length === 0 || context.explicit !== undefined) {
      const url = new URL('https://lrclib.net/api/search')
      const advisoryTerm = context.explicit === undefined ? '' : context.explicit ? 'explicit version' : 'clean version'
      url.searchParams.set('q', `${artist} ${cleanedTitle || title} ${advisoryTerm}`.trim())
      const res = await fetch(url, { signal })
      if (res.ok) {
        const extraResults = ((await res.json()) as LrclibResult[]) || []
        const byId = new Map(results.map((result) => [result.id, result]))
        extraResults.forEach((result) => byId.set(result.id, result))
        results = [...byId.values()]
      }
    }

    const latencyMs = Math.round(performance.now() - startTime)

    let lyricsText = selectLyricsVariant(results, artist, cleanedTitle || title, context)

    // Tier 3: Lyrics.ovh API fallback
    if (!lyricsText && artist && (cleanedTitle || title)) {
      try {
        const ovhUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(cleanedTitle || title)}`
        const ovhRes = await fetch(ovhUrl, { signal })
        if (ovhRes.ok) {
          const ovhData = (await ovhRes.json()) as { lyrics?: string }
          if (ovhData.lyrics?.trim()) {
            const fallbackLyrics = applyKnownLyricsVariant(ovhData.lyrics.trim(), artist, title, context.explicit)
            lyricsText = context.explicit === false ? maskExplicitLyrics(fallbackLyrics) : fallbackLyrics
          }
        }
      } catch {}
    }

    if (lyricsText) {
      lyricsCache.set(cacheKey, lyricsText)
      logApiCall({
        provider: 'LRCLIB',
        queryOrUrl: `${artist} - ${title}`,
        status: 200,
        latencyMs,
        resultCount: 1,
        cacheStatus: 'MISS',
      })
      return lyricsText
    }
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error
  }

  return undefined
}

// ─── Games (IGDB + Steam fallback) ─────────────────────────────────────────

type IgdbGameEdition = {
  providerId: string
  name: string
  type?: string
  description?: string
  releaseDate?: string
  platforms?: string[]
  coverUrl?: string
}

type IgdbRelatedContent = {
  providerId: string
  name: string
  kind: 'sequel' | 'expansion' | 'dlc'
  description?: string
  releaseDate?: string
  coverUrl?: string
}

type IgdbSimilarGame = {
  providerId: string
  name: string
  genres: string[]
  description?: string
  releaseDate?: string
  coverUrl?: string
}

type IgdbGameItem = {
  id: number
  name: string
  summary?: string
  firstReleaseDate?: string
  gameType?: string
  coverUrl?: string
  alternativeNames?: string[]
  popularityScore?: number
  searchRelevance?: number
  platforms?: Array<{ platform: string; releaseDate?: string; status?: string }>
  developers?: string[]
  publishers?: string[]
  genres?: string[]
  gameModes?: string[]
  gameplayTags?: string[]
  franchise?: string
  ageRating?: string
  officialWebsite?: string
  steamAppId?: string
  editions?: IgdbGameEdition[]
  relatedContent?: IgdbRelatedContent[]
  similarGames?: IgdbSimilarGame[]
  relatedRemakes?: Array<{ id: number; name: string; releaseDate?: string; coverUrl?: string }>
}

type IgdbGamePage = {
  results?: IgdbGameItem[]
  page?: number
  hasNextPage?: boolean
}

type StoreRequirements = {
  minimum?: string
  recommended?: string
}

type SteamStoreSearchItem = {
  id: number
  name: string
  tiny_image?: string
  platforms?: { windows?: boolean; mac?: boolean; linux?: boolean }
}

type SteamStoreGameDetails = {
  name: string
  short_description?: string
  header_image?: string
  developers?: string[]
  publishers?: string[]
  website?: string
  required_age?: number | string
  release_date?: { date?: string }
  genres?: Array<{ description: string }>
  categories?: Array<{ description: string }>
  platforms?: { windows?: boolean; mac?: boolean; linux?: boolean }
  pc_requirements?: StoreRequirements
}

export type GameCatalogSearchOptions = {
  /** Number of IGDB records requested per page. */
  pageSize?: number
  /** Maximum pages for an automatically detected series/franchise query. */
  maxSeriesPages?: number
  /** Force or disable series expansion. The default detects it from exact title-phrase matches. */
  seriesMode?: 'auto' | 'always' | 'never'
}

export type GameCatalogPageRequest = {
  /** Omit the query to browse the wider IGDB catalog. */
  query?: string
  page?: number
  pageSize?: number
  ordering?: string
}

export type GameCatalogPageResult = {
  results: MetadataResult[]
  page: number
  hasNextPage: boolean
}

const gameEditionSignals = [
  'part 1',
  'part 2',
  'part 3',
  'left behind',
  'remastered',
  'remaster',
  'remake',
  'definitive',
  'complete',
  'ultimate',
  'deluxe',
  'gold',
  'standard',
  'director s cut',
  'directors cut',
  'goty',
  'game of the year',
  'anniversary',
  'collection',
  'standalone',
]

function normalizeGameTitle(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/['’]/g, '')
    .replace(/\biii\b/g, '3')
    .replace(/\bii\b/g, '2')
    .replace(/\bi\b/g, '1')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function gameTitleTokens(value: string) {
  return new Set(normalizeGameTitle(value).split(' ').filter(Boolean))
}

function gameEditionTokens(value: string) {
  const normalized = normalizeGameTitle(value)
  return gameEditionSignals.filter((signal) => normalized.includes(signal))
}

export function scoreGameTitleMatch(resultTitle: string, query: string, rawIndex = 0) {
  const resultNorm = normalizeGameTitle(resultTitle)
  const queryNorm = normalizeGameTitle(query)
  const resultTokens = gameTitleTokens(resultTitle)
  const queryTokens = gameTitleTokens(query)
  const queryEditionTokens = gameEditionTokens(query)
  const resultEditionTokens = gameEditionTokens(resultTitle)
  const queryNumberTokens = Array.from(queryTokens).filter((token) => /^\d+$/.test(token))
  const resultNumberTokens = Array.from(resultTokens).filter((token) => /^\d+$/.test(token))
  const missingQueryEdition = queryEditionTokens.filter((token) => !resultEditionTokens.includes(token))
  const extraResultEdition = resultEditionTokens.filter((token) => !queryEditionTokens.includes(token))
  const missingQueryNumbers = queryNumberTokens.filter((token) => !resultNumberTokens.includes(token))
  const extraResultNumbers = resultNumberTokens.filter((token) => !queryNumberTokens.includes(token))
  const resultTokenList = Array.from(resultTokens)
  const sharedTokenCount = Array.from(queryTokens).filter((qToken) =>
    resultTokenList.some((rToken) => rToken === qToken || rToken.startsWith(qToken)),
  ).length
  const tokenCoverage = queryTokens.size > 0 ? sharedTokenCount / queryTokens.size : 0

  let score = Math.max(0, 500 - rawIndex * 12)

  if (resultNorm === queryNorm) {
    score += 7000
  } else if (resultNorm.startsWith(queryNorm) || queryNorm.startsWith(resultNorm)) {
    score += 3600
  } else if (resultNorm.includes(queryNorm) || queryNorm.includes(resultNorm)) {
    score += 2400
  }

  score += Math.round(tokenCoverage * 1400)
  score += sharedTokenCount * 80
  score += queryEditionTokens.length * 240
  score += queryNumberTokens.length * 200

  if (missingQueryEdition.length > 0) score -= 2200 * missingQueryEdition.length
  if (extraResultEdition.length > 0) score -= 650 * extraResultEdition.length
  if (missingQueryNumbers.length > 0) score -= 1200 * missingQueryNumbers.length
  if (extraResultNumbers.length > 0) score -= 450 * extraResultNumbers.length
  if (queryEditionTokens.length > 0 && resultEditionTokens.length === 0) score -= 1600

  return score
}

function igdbUrl(pathSuffix = '') {
  return new URL(`${igdbApiBaseUrl.replace(/\/$/, '')}${pathSuffix}`, window.location.origin)
}

function steamStoreUrl(path: string) {
  return new URL(`${steamStoreApiBaseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`, window.location.origin)
}

function steamStoreSearchUrl(path: string) {
  return new URL(`${steamStoreSearchBaseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`, window.location.origin)
}

function gameTitleContainsPhrase(title: string, query: string) {
  const normalizedTitle = normalizeGameTitle(title)
  const normalizedQuery = normalizeGameTitle(query)
  return Boolean(normalizedQuery && (` ${normalizedTitle} `).includes(` ${normalizedQuery} `))
}

function parseGameRequirements(value?: string) {
  if (!value) return undefined

  const fields: Record<string, keyof GameSystemRequirementSet> = {
    os: 'os',
    processor: 'processor',
    memory: 'memory',
    graphics: 'graphics',
    storage: 'storage',
    directx: 'directX',
    network: 'network',
    'sound card': 'sound',
    notes: 'additionalNotes',
    'additional notes': 'additionalNotes',
  }
  const parsed: GameSystemRequirementSet = {}
  const plainText = value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')

  plainText.split(/\r?\n/).forEach((line) => {
    const match = line.trim().match(/^([^:]{2,24}):\s*(.+)$/)
    if (!match) return
    const field = fields[match[1].trim().toLowerCase()]
    if (field) parsed[field] = match[2].trim()
  })

  return Object.keys(parsed).length > 0 ? parsed : { additionalNotes: plainText.trim() }
}

function steamPlatformNames(platforms?: SteamStoreSearchItem['platforms']) {
  if (!platforms) return []
  return [
    platforms.windows ? 'PC' : undefined,
    platforms.mac ? 'macOS' : undefined,
    platforms.linux ? 'Linux' : undefined,
  ].filter((platform): platform is string => Boolean(platform))
}

function steamGameToMetadataResult(item: SteamStoreSearchItem): MetadataResult {
  const platforms = steamPlatformNames(item.platforms)
  return {
    id: `steam:game:${item.id}`,
    type: 'game',
    title: item.name,
    creator: platforms.join(', ') || 'PC',
    provider: 'Steam',
    providerId: String(item.id),
    genre: 'Video Game',
    coverUrl: item.tiny_image ? resolveArtworkUrl(item.tiny_image, item.name, 'Game') : undefined,
    preferWikipediaArtwork: true,
    gameMetadata: {
      platforms: platforms.map((platform) => ({ platform, status: 'available' as const })),
      metadataSource: 'Steam Store',
      metadataUpdatedAt: new Date().toISOString(),
    },
  }
}

async function searchSteamGameCatalog(query: string, signal?: AbortSignal) {
  const startTime = performance.now()
  let allItems: SteamStoreSearchItem[] = []
  let responseStatus = 200

  try {
    const url = steamStoreSearchUrl('search/results/')
    url.searchParams.set('term', query)
    url.searchParams.set('l', 'english')
    url.searchParams.set('cc', 'US')
    url.searchParams.set('start', '0')
    url.searchParams.set('count', '100')
    url.searchParams.set('infinite', '1')
    url.searchParams.set('category1', '998')

    const res = await fetch(url, { signal })
    responseStatus = res.status
    if (!res.ok) throw new Error(`Steam catalog search failed with HTTP ${res.status}.`)

    const data = (await res.json()) as { results_html?: string }
    const document = new DOMParser().parseFromString(`<main>${data.results_html || ''}</main>`, 'text/html')
    allItems = Array.from(document.querySelectorAll<HTMLAnchorElement>('a.search_result_row'))
      .map((row): SteamStoreSearchItem | null => {
        const appId = Number(row.dataset.dsAppid || row.href.match(/\/app\/(\d+)/)?.[1])
        const name = row.querySelector<HTMLElement>('.title')?.textContent?.trim()
        if (!Number.isFinite(appId) || !name) return null

        const platformText = Array.from(row.querySelectorAll<HTMLElement>('.platform_img'))
          .map((platform) => platform.className)
          .join(' ')
        return {
          id: appId,
          name,
          tiny_image: row.querySelector<HTMLImageElement>('img')?.src,
          platforms: {
            windows: /\bwin\b/i.test(platformText),
            mac: /\bmac\b/i.test(platformText),
            linux: /\blinux\b/i.test(platformText),
          },
        }
      })
      .filter((item): item is SteamStoreSearchItem => Boolean(item))
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error

    const fallbackUrl = steamStoreUrl('storesearch')
    fallbackUrl.searchParams.set('term', query)
    fallbackUrl.searchParams.set('l', 'english')
    fallbackUrl.searchParams.set('cc', 'US')
    const fallbackResponse = await fetch(fallbackUrl, { signal })
    responseStatus = fallbackResponse.status
    if (!fallbackResponse.ok) {
      throw new Error(`Steam Store game search failed with HTTP ${fallbackResponse.status}.`)
    }
    const fallbackData = (await fallbackResponse.json()) as { items?: SteamStoreSearchItem[] }
    allItems = fallbackData.items ?? []
  }

  const latencyMs = Math.round(performance.now() - startTime)
  const exactPhraseItems = allItems.filter((item) => gameTitleContainsPhrase(item.name, query))
  const catalogItems = exactPhraseItems.length >= 3 ? exactPhraseItems : allItems
  const results = catalogItems
    .map((item, index) => ({ item, index }))
    .sort((a, b) => scoreGameTitleMatch(b.item.name, query, b.index) - scoreGameTitleMatch(a.item.name, query, a.index))
    .map(({ item }) => steamGameToMetadataResult(item))

  logApiCall({
    provider: 'Steam Store',
    queryOrUrl: query,
    status: responseStatus,
    latencyMs,
    resultCount: results.length,
    cacheStatus: 'MISS',
  })
  return results
}

function igdbPlatformStatus(releaseDate?: string) {
  if (!releaseDate) return 'available' as const
  const timestamp = new Date(releaseDate).getTime()
  return Number.isFinite(timestamp) && timestamp > Date.now() ? 'upcoming' as const : 'available' as const
}

function igdbGameToMetadataResult(item: IgdbGameItem): MetadataResult {
  const platformNames = item.platforms?.map((release) => release.platform).filter(Boolean)
  const genres = item.genres?.filter(Boolean)
  const providerLabel = item.publishers?.join(', ') || 'IGDB'

  return {
    id: `igdb:game:${item.id}`,
    type: 'game',
    title: item.name,
    creator: item.developers?.join(', ') || platformNames?.slice(0, 3).join(', ') || 'PC / Console',
    provider: providerLabel,
    providerId: String(item.id),
    genre: genres?.join(', ') || 'Video Game',
    coverUrl: item.coverUrl ? resolveArtworkUrl(item.coverUrl, item.name, 'Game') : undefined,
    year: yearFrom(item.firstReleaseDate),
    summary: item.summary?.trim() || undefined,
    gameSearchRelevance: item.searchRelevance,
    gamePopularity: item.popularityScore,
    gameMetadata: {
      developers: item.developers,
      publishers: item.publishers,
      genres,
      gameModes: item.gameModes,
      gameplayTags: item.gameplayTags,
      franchise: item.franchise,
      ageRating: item.ageRating,
      releaseDate: item.firstReleaseDate,
      officialWebsite: item.officialWebsite,
      platforms: item.platforms?.map((release) => ({
        platform: release.platform,
        releaseDate: release.releaseDate,
        status: igdbPlatformStatus(release.releaseDate),
      })),
      editions: item.editions?.map((edition) => ({
        name: edition.name,
        description: edition.description || edition.type,
        releaseDate: edition.releaseDate,
        platforms: edition.platforms,
      })),
      relatedContent: item.relatedContent,
      similarGames: item.similarGames,
      metadataSource: 'IGDB',
      metadataUpdatedAt: new Date().toISOString(),
    },
  }
}

export async function fetchGameCatalogPage(
  request: GameCatalogPageRequest = {},
  signal?: AbortSignal,
): Promise<GameCatalogPageResult> {
  const page = Math.max(1, request.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, request.pageSize ?? 40))
  const url = igdbUrl()
  if (request.query?.trim()) url.searchParams.set('search', request.query.trim())
  if (request.ordering?.trim()) url.searchParams.set('ordering', request.ordering.trim())
  url.searchParams.set('page_size', String(pageSize))
  url.searchParams.set('page', String(page))

  const timeoutSignal = AbortSignal.timeout(8000)
  const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal
  const res = await fetch(url, { signal: requestSignal })
  if (!res.ok) {
    const payload = await res.json().catch(() => undefined) as { error?: string } | undefined
    throw new Error(payload?.error || `IGDB game catalog failed with HTTP ${res.status}.`)
  }

  const data = (await res.json()) as IgdbGamePage
  return {
    results: (data.results ?? []).map((item) => igdbGameToMetadataResult(item)),
    page,
    hasNextPage: Boolean(data.hasNextPage),
  }
}

export async function searchGameCatalog(
  query: string,
  signal?: AbortSignal,
  options: GameCatalogSearchOptions = {},
): Promise<MetadataResult[]> {
  const startTime = performance.now()
  try {
    const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 40))
    const maxSeriesPages = Math.min(8, Math.max(1, options.maxSeriesPages ?? 5))
    const allResults: MetadataResult[] = []
    let page = 1
    let hasNextPage = true
    let expandSeries = options.seriesMode === 'always'

    while (hasNextPage && page <= (expandSeries ? maxSeriesPages : 1)) {
      const catalogPage = await fetchGameCatalogPage({ query, pageSize, page }, signal)
      allResults.push(...catalogPage.results)
      hasNextPage = catalogPage.hasNextPage

      if (page === 1 && (options.seriesMode === 'auto' || options.seriesMode === undefined)) {
        const phraseMatches = allResults.filter((item) => gameTitleContainsPhrase(item.title, query)).length
        const queryWordCount = normalizeGameTitle(query).split(' ').filter(Boolean).length
        expandSeries = queryWordCount >= 2 && phraseMatches >= Math.min(8, Math.ceil(allResults.length / 3))
      }

      if (options.seriesMode === 'never') expandSeries = false
      page += 1
    }

    const latencyMs = Math.round(performance.now() - startTime)
    const uniqueResults = Array.from(new Map(allResults.map((result) => [result.id, result])).values())
    const results = uniqueResults
      .map((result, index) => ({ result, index }))
      .sort((a, b) =>
        (b.result.gameSearchRelevance ?? 0) - (a.result.gameSearchRelevance ?? 0) ||
        (b.result.gamePopularity ?? 0) - (a.result.gamePopularity ?? 0) ||
        scoreGameTitleMatch(b.result.title, query, b.index) - scoreGameTitleMatch(a.result.title, query, a.index),
      )
      .map(({ result }) => result)

    logApiCall({
      provider: 'IGDB',
      queryOrUrl: query,
      status: 200,
      latencyMs,
      resultCount: results.length,
      cacheStatus: 'MISS',
    })

    return results
  } catch (err: unknown) {
    if ((err as Error)?.name === 'AbortError') throw err
    const latencyMs = Math.round(performance.now() - startTime)
    logApiCall({
      provider: 'IGDB',
      queryOrUrl: query,
      status: 'ERROR',
      latencyMs,
      resultCount: 0,
      cacheStatus: 'MISS',
      error: err instanceof Error ? err.message : String(err),
    })
    try {
      return await searchSteamGameCatalog(query, signal)
    } catch (fallbackError) {
      if ((fallbackError as Error)?.name === 'AbortError') throw fallbackError
      throw err
    }
  }
}

async function searchGames(query: string, signal?: AbortSignal) {
  return searchGameCatalog(query, signal)
}

async function fetchSteamGameDetails(providerId: string, signal?: AbortSignal) {
  return cachedApiRequest<MetadataResult | undefined>(
    `steam-game-details:${providerId}`,
    signal,
    async () => {
      const startTime = performance.now()
      const url = steamStoreUrl('appdetails')
      url.searchParams.set('appids', providerId)
      url.searchParams.set('l', 'english')
      url.searchParams.set('cc', 'US')
      const res = await fetch(url, { signal })
      const latencyMs = Math.round(performance.now() - startTime)
      if (!res.ok) return undefined

      const payload = (await res.json()) as Record<string, { success?: boolean; data?: SteamStoreGameDetails }>
      const details = payload[providerId]?.data
      if (!payload[providerId]?.success || !details) return undefined

      const platforms = steamPlatformNames(details.platforms)
      const requirements = details.pc_requirements
      const result: MetadataResult = {
        id: `steam:game:${providerId}`,
        type: 'game',
        title: details.name,
        creator: details.developers?.join(', ') || platforms.join(', ') || 'PC',
        provider: details.genres?.map((genre) => genre.description).join(', ') || 'Video Game',
        providerId,
        genre: details.genres?.map((genre) => genre.description).join(', ') || 'Video Game',
        coverUrl: details.header_image
          ? resolveArtworkUrl(details.header_image, details.name, 'Game')
          : undefined,
        preferWikipediaArtwork: true,
        year: details.release_date?.date?.match(/\b\d{4}\b/)?.[0],
        summary: details.short_description?.trim() || undefined,
        gameMetadata: {
          developers: details.developers,
          publishers: details.publishers,
          genres: details.genres?.map((genre) => genre.description),
          gameModes: details.categories
            ?.map((category) => category.description)
            .filter((name) => /single.?player|multi.?player|co.?op|pvp|online/i.test(name))
            .slice(0, 6),
          ageRating: details.required_age ? `${details.required_age}+` : undefined,
          releaseDate: details.release_date?.date,
          officialWebsite: details.website || undefined,
          platforms: platforms.map((platform) => ({
            platform,
            releaseDate: details.release_date?.date,
            status: 'available' as const,
          })),
          pcRequirements: requirements
            ? {
                minimum: parseGameRequirements(requirements.minimum),
                recommended: parseGameRequirements(requirements.recommended),
              }
            : undefined,
          features: details.categories?.map((category) => category.description).slice(0, 10),
          metadataSource: 'Steam Store',
          metadataUpdatedAt: new Date().toISOString(),
        },
      }

      logApiCall({
        provider: 'Steam Store',
        queryOrUrl: `Game details ${providerId}`,
        status: res.status,
        latencyMs,
        resultCount: 1,
        cacheStatus: 'MISS',
      })
      return result
    },
  )
}

export async function fetchGameDetails(
  providerId: string,
  metadataSource = 'IGDB',
  signal?: AbortSignal,
) {
  const cleanProviderId = providerId.trim()
  if (!cleanProviderId) return undefined
  if (/steam/i.test(metadataSource)) return fetchSteamGameDetails(cleanProviderId, signal)
  if (/rawg/i.test(metadataSource)) return undefined

  return cachedApiRequest<MetadataResult | undefined>(
    `igdb-game-details:v4:${cleanProviderId}`,
    signal,
    async () => {
      const startTime = performance.now()
      const url = igdbUrl(`/${encodeURIComponent(cleanProviderId)}`)
      const res = await fetch(url, { signal })
      const latencyMs = Math.round(performance.now() - startTime)

      if (!res.ok) {
        const payload = await res.json().catch(() => undefined) as { error?: string } | undefined
        logApiCall({
          provider: 'IGDB',
          queryOrUrl: `Game details ${cleanProviderId}`,
          status: res.status,
          latencyMs,
          resultCount: 0,
          cacheStatus: 'MISS',
          error: payload?.error || `IGDB game details HTTP ${res.status}`,
        })
        return undefined
      }

      const payload = (await res.json()) as IgdbGamePage
      const details = payload.results?.[0]
      if (!details) return undefined
      const result = igdbGameToMetadataResult(details)
      if (details.steamAppId) {
        const steamResult = await fetchSteamGameDetails(details.steamAppId, signal).catch(() => undefined)
        const titlesMatch = steamResult && normalizeGameTitle(steamResult.title) === normalizeGameTitle(result.title)
        if (titlesMatch && steamResult.gameMetadata?.pcRequirements) {
          result.gameMetadata = {
            ...result.gameMetadata,
            pcRequirements: steamResult.gameMetadata.pcRequirements,
            metadataSource: 'IGDB + Steam Store',
          }
        }
      }
      logApiCall({
        provider: 'IGDB',
        queryOrUrl: `Game details ${cleanProviderId}`,
        status: res.status,
        latencyMs,
        resultCount: 1,
        cacheStatus: 'MISS',
      })
      return result
    },
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function searchMetadata(
  type: MetadataType,
  query: string,
  signal?: AbortSignal,
): Promise<MetadataResult[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const providerQuery = getMetadataProviderQuery(q)

  const cacheKey = `${type}:${q.toLowerCase()}`
  if (searchCache.has(cacheKey)) {
    const cached = searchCache.get(cacheKey)!
    if (cached.length > 0) {
      logApiCall({
        provider: providerMap[type] || 'Google Books',
        queryOrUrl: `Search "${q}" (${type})`,
        status: 'CACHE',
        latencyMs: 0,
        resultCount: cached.length,
        cacheStatus: 'HIT',
      })
      return cached
    }
    searchCache.delete(cacheKey)
  }

  const persisted = await getBrowserCacheValue<MetadataResult[]>(SEARCH_CACHE_NAMESPACE, cacheKey)
  signal?.throwIfAborted()
  if (persisted && persisted.length > 0) {
    searchCache.set(cacheKey, persisted)
    logApiCall({
      provider: providerMap[type] || 'Google Books',
      queryOrUrl: `Search "${q}" (${type})`,
      status: 'CACHE',
      latencyMs: 0,
      resultCount: persisted.length,
      cacheStatus: 'HIT',
    })
    return persisted
  }

  let results: MetadataResult[] = []
  if (type === 'book') results = await searchBooks(providerQuery, signal)
  else if (type === 'film' || type === 'tv') results = await searchTmdb(type, providerQuery, signal)
  else if (type === 'song') results = await searchSongs(providerQuery, signal)
  else if (type === 'album') results = await searchAlbums(providerQuery, signal)
  else if (type === 'game') results = await searchGames(providerQuery, signal)

  if (results.length > 0) {
    searchCache.set(cacheKey, results)
    void setBrowserCacheValue(SEARCH_CACHE_NAMESPACE, cacheKey, results, SEARCH_METADATA_TTL)
  }
  return results
}
