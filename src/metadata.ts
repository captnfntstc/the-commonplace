// ─────────────────────────────────────────────────────────────────────────────
// metadata.ts
// Fast, multi-provider API adapters with caching & fallbacks:
//   📚 Books      → Google Books API
//   🎬 Films/TV   → TMDB API
//   🎵 Songs      → iTunes Search API + MusicBrainz fallback
//   💿 Albums     → iTunes Search API + MusicBrainz fallback
//   🎮 Games      → RAWG
//   🎵 Lyrics     → lrclib.net
// ─────────────────────────────────────────────────────────────────────────────
import { logApiCall, type ApiProvider } from './services/apiTracker'
import { resolveArtworkUrl } from './utils/artwork'
import type { GameMetadata } from './types/mediaEntity'
import {
  clearBrowserCacheNamespace,
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
  coverUrl?: string
  year?: string
  summary?: string
  explicit?: boolean
  gameMetadata?: GameMetadata
  /** Only populated by fetchLyrics — not present in search results */
  lyrics?: string
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

export async function fetchWikipediaPortrait(name: string, signal?: AbortSignal): Promise<string> {
  const cleanName = name.trim().toLowerCase()
  const cacheKey = `wiki-portrait:${cleanName}`

  // Memory cache check first
  const existing =
    entityImageCacheMap.get(cacheKey) ||
    entityImageCacheMap.get(cleanName) ||
    entityImageCacheMap.get(`artist:${cleanName}`)
  if (existing) return existing

  const result = await cachedApiRequest(cacheKey, signal, async () => {
    try {
      const url = new URL('https://en.wikipedia.org/w/api.php')
      url.searchParams.set('action', 'query')
      url.searchParams.set('titles', name)
      url.searchParams.set('prop', 'pageimages')
      url.searchParams.set('piprop', 'thumbnail|original')
      url.searchParams.set('pithumbsize', '800')
      url.searchParams.set('redirects', '1')
      url.searchParams.set('format', 'json')
      url.searchParams.set('origin', '*')

      const res = await fetch(url, { signal })
      if (res.ok) {
        const data = (await res.json()) as any
        const pages = data.query?.pages
        if (pages) {
          const page = Object.values(pages)[0] as any
          const wikiUrl = page?.thumbnail?.source || page?.original?.source
          if (wikiUrl) {
            preloadImage(wikiUrl)
            entityImageCacheMap.set(cacheKey, wikiUrl)
            entityImageCacheMap.set(cleanName, wikiUrl)
            entityImageCacheMap.set(`artist:${cleanName}`, wikiUrl)
            return wikiUrl
          }
        }
      }
    } catch {
      // Ignore and try REST summary fallback.
    }

    try {
      const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`
      const res = await fetch(summaryUrl, { signal })
      if (res.ok) {
        const data = (await res.json()) as any
        const wikiUrl = data?.originalimage?.source || data?.thumbnail?.source
        if (wikiUrl) {
          preloadImage(wikiUrl)
          entityImageCacheMap.set(cacheKey, wikiUrl)
          entityImageCacheMap.set(cleanName, wikiUrl)
          entityImageCacheMap.set(`artist:${cleanName}`, wikiUrl)
          return wikiUrl
        }
      }
    } catch {
      // Ignore and fallback to iTunes search.
    }

    try {
      const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=album&limit=5`
      const res = await fetch(itunesUrl, { signal })
      if (res.ok) {
        const data = (await res.json()) as any
        const first = data?.results?.[0]
        if (first?.artworkUrl100) {
          const fallbackCover = resolveArtworkUrl(
            first.artworkUrl100.replace('100x100bb', '600x600bb'),
            name,
            'Apple Music',
          )
          entityImageCacheMap.set(cacheKey, fallbackCover)
          entityImageCacheMap.set(cleanName, fallbackCover)
          entityImageCacheMap.set(`artist:${cleanName}`, fallbackCover)
          return fallbackCover
        }
      }
    } catch {
      // Fallback failed
    }

    return ''
  })

  if (!result) {
    apiResponseCache.delete(cacheKey)
  } else {
    preloadImage(result)
    entityImageCacheMap.set(cacheKey, result)
    entityImageCacheMap.set(cleanName, result)
    entityImageCacheMap.set(`artist:${cleanName}`, result)
  }

  return result
}

export interface DiscographyItem {
  id: string
  title: string
  subtitle: string
  artworkUrl: string
  rating: number
  year: string
  genre?: string
  category: 'album' | 'ep' | 'single'
  explicit?: boolean
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
  ]

  for (const [signal, pattern] of checks) {
    if (pattern.test(normalized)) signals.add(signal)
  }

  return signals
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
  const match = id.match(/^album-(\d+)$/i)
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
): ITunesSearchResult | undefined {
  let bestAlbum: ITunesSearchResult | undefined
  let bestScore = -Infinity

  for (const album of albums) {
    if (!album.collectionId || !album.collectionName) continue
    if (!isOfficialArtistMatch(album.artistName || album.collectionArtistName, requestedArtist)) continue
    const officialArtistScore = requestedArtist ? 420 : 0
    const trackCount = Number(album.trackCount || 0)
    const expectedTrackScore =
      expectedTrackCount && trackCount === expectedTrackCount
        ? 1000
        : expectedTrackCount && trackCount > 0
          ? -Math.abs(expectedTrackCount - trackCount) * 120
          : 0
    const artworkScore = album.artworkUrl100 ? 40 : 0
    const score =
      scoreCatalogTitleMatch(album.collectionName, requestedAlbum) +
      officialArtistScore +
      expectedTrackScore +
      artworkScore

    if (score > bestScore) {
      bestScore = score
      bestAlbum = album
    }
  }

  return bestAlbum
}

async function fetchBestItunesAlbumCollection(
  albumName: string,
  artistName?: string,
  signal?: AbortSignal,
  expectedTrackCount?: number,
): Promise<ITunesSearchResult | undefined> {
  const query = artistName ? `${albumName} ${artistName}` : albumName
  const url = new URL('https://itunes.apple.com/search')
  url.searchParams.set('term', query)
  url.searchParams.set('entity', 'album')
  url.searchParams.set('limit', '25')

  const res = await fetch(url, { signal })
  if (!res.ok) return undefined

  const data = (await res.json()) as { results?: ITunesSearchResult[] }
  return selectBestAlbumCollection(data.results || [], albumName, artistName, expectedTrackCount)
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

const knownAlbumArtistBoosts: Record<string, number> = {
  'taylor swift': 520,
  'noah kahan': 470,
  'olivia rodrigo': 440,
  radiohead: 420,
  beyonce: 410,
  drake: 400,
  'billie eilish': 400,
  'lana del rey': 390,
  'the beatles': 380,
  'fleetwood mac': 360,
  'frank ocean': 350,
  'kendrick lamar': 350,
  'sabrina carpenter': 340,
  'ariana grande': 330,
  'chappell roan': 320,
  'hollow coves': 260,
}

export function knownArtistBoost(artistName?: string): number {
  const normalizedArtist = normalizeAlbumTitleForMatch(artistName || '')
  if (!normalizedArtist) return 0
  if (knownAlbumArtistBoosts[normalizedArtist] !== undefined) {
    return knownAlbumArtistBoosts[normalizedArtist]
  }
  for (const [known, boost] of Object.entries(knownAlbumArtistBoosts)) {
    if (normalizedArtist.includes(known) || known.includes(normalizedArtist)) {
      return Math.round(boost * 0.8)
    }
  }
  return 0
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
    normalizeAlbumTitleForMatch(title),
    normalizeAlbumTitleForMatch(artist),
    year || '',
  ].join(':')
}

function preferExplicitAlbumEditions(items: DiscographyItem[]): DiscographyItem[] {
  const byEdition = new Map<string, DiscographyItem>()
  const order: string[] = []

  for (const item of items) {
    const key = [
      normalizeAlbumTitleForMatch(item.title),
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

export async function fetchItunesDiscography(artistName: string, signal?: AbortSignal): Promise<DiscographyItem[]> {
  const cacheKey = `itunes-discography-v2:${normalizeAlbumTitleForMatch(artistName)}`
  return cachedApiRequest(cacheKey, signal, async () => {
    try {
    const artistId = await fetchItunesExactArtistId(artistName, signal)
    const url = artistId
      ? `https://itunes.apple.com/lookup?id=${encodeURIComponent(String(artistId))}&entity=album&limit=200`
      : `https://itunes.apple.com/search?term=${encodeURIComponent(artistName)}&entity=album&attribute=artistTerm&limit=200`
    const res = await fetch(url, { signal })
    if (!res.ok) return []
    const data = (await res.json()) as any
    let results = (data.results || []).filter((album: ITunesSearchResult) => album.wrapperType !== 'artist')

    // 1. Strict Primary Artist Filter: album.artistName must strictly match target artist
    results = results.filter((album: ITunesSearchResult) => {
      const albumArtist = (album.artistName || '').toLowerCase().trim()
      const title = (album.collectionName || '').toLowerCase().trim()
      if (!title) return false

      if (!isStrictDiscographyArtistMatch(album, artistName, artistId)) return false

      // Reject non-official titles / tributes / covers / instrumental / lullaby / commentary / karaoke / remix collections
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

    // Sort by releaseDate descending (newest first)
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
        const tc = album.trackCount || 10
        const lowerName = title.toLowerCase()
        let category: 'album' | 'ep' | 'single' = 'album'
        if (/\bsingle\b/i.test(lowerName) || tc <= 3) category = 'single'
        else if (/\bep\b/i.test(lowerName)) category = 'ep'

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
        albumEntityMap.set(lowerName, {
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

export async function fetchItunesAlbumDetails(
  albumName: string,
  artistName?: string,
  signal?: AbortSignal,
  expectedTrackCount?: number,
  providerCollectionId?: string,
) {
  const cacheKey = [
    'itunes-album-details-v3',
    normalizeAlbumTitleForMatch(albumName),
    normalizeAlbumTitleForMatch(artistName || ''),
    expectedTrackCount || 0,
    providerCollectionId || '',
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
      const bestAlbum = await fetchBestItunesAlbumCollection(cleanAlbum, artistName, signal, expectedTrackCount)
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

    const lookupUrl = resolvedCollectionId
      ? `https://itunes.apple.com/lookup?id=${encodeURIComponent(resolvedCollectionId)}&entity=song&limit=300`
      : ''
    const res = lookupUrl ? await fetch(lookupUrl, { signal }) : null
    if (!res || !res.ok) return null
    const data = (await res.json()) as any
    const collectionItem = (data.results || []).find(
      (item: ITunesSearchResult) => item.wrapperType === 'collection' && item.collectionId,
    )
    const albumCover = formatITunesArt(
      collectionItem?.artworkUrl100 || resolvedAlbum?.artworkUrl,
      collectionItem?.collectionName || resolvedAlbum?.name || cleanAlbum,
    ) || ''
    const songs = (data.results || []).filter(
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
    const genre = first.primaryGenreName || 'Pop'
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
        explicit: isExplicitItunesItem(song),
      })

      return {
        id: songId,
        rank: song.trackNumber || idx + 1,
        title: song.trackName,
        subtitle: `${mins}:${secs} · Track ${song.trackNumber || idx + 1}`,
        rating: 4.9,
        explicit: isExplicitItunesItem(song),
      }
    })

    return {
      title: collectionName,
      artist,
      coverUrl: cover,
      year,
      genre,
      explicit: tracksToUse.some((song: any) => isExplicitItunesItem(song)),
      trackCount: items.length,
      tracks: items,
    }
    } catch {
      return null
    }
  })
}

function mapItunesRelatedAlbum(item: ITunesSearchResult): DiscographyItem {
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
    rating: 4.8,
    year,
    category: 'album',
    explicit,
  }
}

export async function fetchRelatedAlbums(
  albumName: string,
  artistName?: string,
  genre?: string,
  albumKey?: string,
  signal?: AbortSignal,
  selectedExplicit?: boolean,
): Promise<DiscographyItem[]> {
  const cacheKey = [
    'itunes-related-albums-v4',
    normalizeAlbumTitleForMatch(albumName),
    normalizeAlbumTitleForMatch(artistName || ''),
    normalizeAlbumTitleForMatch(genre || ''),
    albumKey || '',
    selectedExplicit === undefined ? 'unknown' : selectedExplicit ? 'explicit' : 'clean',
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
            cleanGenre ? `${cleanGenre} music` : '',
            cleanArtist && cleanGenre ? `${cleanGenre} top albums` : '',
            cleanArtist ? `${cleanArtist}` : '',
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
      const currentIsExplicit = selectedExplicit ?? selectedAlbumEntity?.explicit ?? false
      const selectedTitle = normalizeAlbumTitleForMatch(albumName)
      const selectedGenre = normalizeAlbumTitleForMatch(cleanGenre)
      const selectedArtist = normalizeAlbumTitleForMatch(cleanArtist)
      const seen = new Set<string>()
      const artistCounts: Record<string, number> = {}
      const cleanAlternate = currentIsExplicit
        ? responses
            .flat()
            .filter((item) => {
              if (!item.collectionName) return false
              if (excludeCollectionId && String(item.collectionId || '') === excludeCollectionId) return false
              if (isExplicitItunesItem(item)) return false

              const resultTitle = normalizeAlbumTitleForMatch(item.collectionName)
              if (resultTitle !== selectedTitle) return false

              if (selectedArtist) {
                const itemArtist = normalizeAlbumTitleForMatch(item.artistName || '')
                const collectionArtist = normalizeAlbumTitleForMatch(item.collectionArtistName || '')
                if (itemArtist !== selectedArtist && collectionArtist !== selectedArtist) return false
              }

              const lowerName = item.collectionName.toLowerCase()
              const isEpOrSingle =
                /\b(ep|single|sngle)\b/i.test(lowerName) ||
                (item.trackCount !== undefined && item.trackCount < 6)
              return !isEpOrSingle
            })
            .sort((a, b) => {
              const aTrackCount = Number(a.trackCount || 0)
              const bTrackCount = Number(b.trackCount || 0)
              if (aTrackCount !== bTrackCount) return bTrackCount - aTrackCount
              return Number(Boolean(b.artworkUrl100)) - Number(Boolean(a.artworkUrl100))
            })[0]
        : undefined

      const filtered = responses
        .flat()
        .filter((item) => {
          if (!item.collectionName) return false
          if (excludeCollectionId && String(item.collectionId || '') === excludeCollectionId) return false

          const resultTitle = normalizeAlbumTitleForMatch(item.collectionName)
          if (resultTitle === selectedTitle) return false

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

      const seenAlbumVariants = new Set<string>()

      const related = filtered
        .map((item, index) => {
          const resultGenre = normalizeAlbumTitleForMatch(item.primaryGenreName || '')
          const resultArtist = normalizeAlbumTitleForMatch(item.artistName || '')
          const sameGenre =
            selectedGenre.length > 0 &&
            (resultGenre === selectedGenre || resultGenre.includes(selectedGenre) || selectedGenre.includes(resultGenre))
          const isDifferentArtist = selectedArtist.length > 0 && resultArtist !== selectedArtist
          const year = Number(yearFrom(item.releaseDate) || 0)

          const artistCount = artistCounts[resultArtist] || 0
          artistCounts[resultArtist] = artistCount + 1

          return {
            item,
            score:
              (sameGenre ? 300 : 0) +
              (isDifferentArtist ? 200 : 40) -
              (artistCount * 120) +
              knownArtistBoost(item.artistName) +
              Math.max(0, 50 - index) +
              (item.artworkUrl100 ? 10 : 0) +
              Math.min(year, 2100) / 1000,
          }
        })
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .filter(({ item }) => {
          const key = `${albumEditionBaseKey(
            item.collectionName || '',
            item.artistName || item.collectionArtistName || '',
            yearFrom(item.releaseDate) || '',
          )}:${isExplicitItunesItem(item) ? 'explicit' : 'clean'}`
          if (seenAlbumVariants.has(key)) return false
          seenAlbumVariants.add(key)
          return true
        })
        .slice(0, cleanAlternate ? 3 : 4)
        .map(({ item }) => mapItunesRelatedAlbum(item))

      return cleanAlternate
        ? [mapItunesRelatedAlbum(cleanAlternate), ...related]
        : related
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') throw err
      return []
    }
  })
}

function songSearchScore(item: ITunesSearchResult, songQuery: string, targetArtist?: string): number {
  const normTrack = normalizeAlbumTitleForMatch(item.trackName || '')
  const normArtist = normalizeAlbumTitleForMatch(item.artistName || '')
  const normTargetSong = normalizeAlbumTitleForMatch(songQuery)
  const normTargetArtist = targetArtist ? normalizeAlbumTitleForMatch(targetArtist) : ''

  let score = 0

  if (normTargetArtist) {
    if (normArtist !== normTargetArtist) return -50000
    score += 5000
  }

  const boost = knownArtistBoost(item.artistName)
  score += boost * 10

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

export async function fetchItunesSongDetails(songName: string, artistName?: string, trackId?: string, signal?: AbortSignal) {
  const cacheKey = [
    'itunes-song-details-v2',
    normalizeAlbumTitleForMatch(songName),
    normalizeAlbumTitleForMatch(artistName || ''),
    trackId || '',
  ].join(':')

  return cachedApiRequest(cacheKey, signal, async () => {
    try {
    const cleanSong = songName.replace(/^song-\d+/i, '').replace(/^song-/i, '').replace(/-/g, ' ')
    const exactTrack = await fetchItunesTrackById(trackId, signal)
    let song = exactTrack

    if (!song) {
      const query = artistName ? `${cleanSong} ${artistName}` : cleanSong
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=50`
      const res = await fetch(url, { signal })
      if (!res.ok) return null
      const data = (await res.json()) as { results?: ITunesSearchResult[] }
      const songs = data.results || []
      if (songs.length === 0) return null
      song = [...songs].sort(
        (a, b) => songSearchScore(b, cleanSong, artistName) - songSearchScore(a, cleanSong, artistName),
      )[0]
    }

    if (!song?.trackName) return null

    const cover = formatITunesArt(song.artworkUrl100, song.trackName) || ''
    const year = song.releaseDate ? song.releaseDate.slice(0, 4) : ''
    const millis = song.trackTimeMillis || 200000
    const mins = Math.floor(millis / 60000)
    const secs = Math.floor((millis % 60000) / 1000).toString().padStart(2, '0')

    const lyricsData = await fetchLyrics(song.artistName || artistName || '', song.trackName, signal).catch(() => null)

    return {
      id: `song-${song.trackId}`,
      name: song.trackName,
      artist: song.artistName,
      album: song.collectionName,
      artworkUrl: cover,
      year,
      duration: `${mins}:${secs}`,
      trackNumber: song.trackNumber || 1,
      genre: song.primaryGenreName || 'Pop',
      explicit: isExplicitItunesItem(song),
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
): Promise<DiscographyItem[]> {
  const cacheKey = [
    'itunes-song-appearances-v3',
    normalizeAlbumTitleForMatch(songName),
    normalizeAlbumTitleForMatch(artistName || ''),
    trackId || '',
  ].join(':')

  return cachedApiRequest(cacheKey, signal, async () => {
    try {
      const cleanSong = songName.replace(/^song-\d+/i, '').replace(/^song-/i, '').replace(/-/g, ' ')
      let exactSong: ITunesSearchResult | undefined

      exactSong = await fetchItunesTrackById(trackId, signal)

      const canonicalSongName = exactSong?.trackName || cleanSong
      const canonicalArtistName = exactSong?.artistName || artistName || ''
      const query = canonicalArtistName ? `${canonicalSongName} ${canonicalArtistName}` : canonicalSongName
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=60`
      const res = await fetch(url, { signal })
      if (!res.ok) return []

      const data = (await res.json()) as { results?: ITunesSearchResult[] }
      const normalizedSong = normalizeAlbumTitleForMatch(canonicalSongName)
      const normalizedArtist = normalizeAlbumTitleForMatch(canonicalArtistName)
      const seenCollectionIds = new Set<string>()
      const seenAlbumVariants = new Set<string>()

      return [exactSong, ...(data.results || [])]
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
        .slice(0, 4)
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
): Promise<string> {
  const cacheKey = [
    'itunes-song-artwork-v2',
    normalizeAlbumTitleForMatch(songName),
    normalizeAlbumTitleForMatch(artistName || ''),
    trackId || '',
  ].join(':')

  const result = await cachedApiRequest(cacheKey, signal, async () => {
    try {
      const exactTrack = await fetchItunesTrackById(trackId, signal)
      if (exactTrack) return formatITunesArt(exactTrack.artworkUrl100, exactTrack.trackName || songName) || ''

      const cleanSong = songName.replace(/^song-\d+/i, '').replace(/^song-/i, '').replace(/-/g, ' ')
      const query = artistName ? `${cleanSong} ${artistName}` : cleanSong
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=50`
      const res = await fetch(url, { signal })
      if (!res.ok) return ''
      const data = (await res.json()) as any
      const songs = data.results || []
      if (songs.length === 0) return ''
      const sortedSongs = [...songs].sort((a, b) => songSearchScore(b, cleanSong, artistName) - songSearchScore(a, cleanSong, artistName))
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
const rawgApiKey = import.meta.env.VITE_RAWG_API_KEY as string | undefined
const rawgApiBaseUrl =
  (import.meta.env.VITE_RAWG_API_BASE_URL as string | undefined) ??
  (import.meta.env.DEV ? '/rawg-api/games' : 'https://api.rawg.io/api/games')
const googleBooksApiKey = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY as string | undefined
const appContact =
  (import.meta.env.VITE_APP_CONTACT as string | undefined) ??
  'the-commonplace@example.com'

// ─── Cache & Utilities ────────────────────────────────────────────────────────

const searchCache = new Map<string, MetadataResult[]>()
const lyricsCache = new Map<string, string | undefined>()
const apiResponseCache = new Map<string, unknown>()
const pendingApiRequestCache = new Map<string, Promise<unknown>>()
const API_CACHE_NAMESPACE = 'external-api-v3'
const SEARCH_CACHE_NAMESPACE = 'metadata-search-v2'
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

const providerMap: Record<MetadataType, ApiProvider> = {
  book: 'Google Books',
  film: 'TMDB',
  tv: 'TMDB',
  song: 'iTunes',
  album: 'iTunes',
  game: 'RAWG',
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

// ─── MusicBrainz fallback helpers ─────────────────────────────────────────────

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
            explicit: isExplicitItunesItem(item),
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
    (artistNorm && (qNorm.includes(artistNorm) || artistNorm.includes(qNorm))) ||
    knownArtistBoost(result.creator) > 0

  const artistBoost = knownArtistBoost(result.creator)

  if (isPrimaryArtist) {
    score += 3500
  }

  score += artistBoost * 10

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
        const boost = knownArtistBoost(item.artistName)
        artistScores[normA] = (artistScores[normA] || 0) + 1 + boost
      }
      let topArtistNorm = ''
      let maxScore = 0
      for (const [normA, sc] of Object.entries(artistScores)) {
        if (sc > maxScore) {
          maxScore = sc
          topArtistNorm = normA
        }
      }

      const mapped = rawResults.map((item, index) => ({
        result: mapItunesAlbumResult(item),
        rawIndex: index,
      }))

      const seenKeys = new Set<string>()
      const uniqueResults = mapped.filter(({ result }) => {
        const key = result.providerId
          ? result.providerId
          : `${normalizeAlbumTitleForMatch(result.title)}:${normalizeAlbumTitleForMatch(result.creator)}`
        if (seenKeys.has(key)) return false
        seenKeys.add(key)
        return true
      })

      const sorted = uniqueResults
        .sort((a, b) => albumSearchScore(b.result, cleanQuery, b.rawIndex, topArtistNorm) - albumSearchScore(a.result, cleanQuery, a.rawIndex, topArtistNorm))
        .map(({ result }) => result)
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

export async function fetchLyrics(
  artist: string,
  title: string,
  signal?: AbortSignal,
): Promise<string | undefined> {
  const normArtist = artist.toLowerCase().trim()
  const normTitle = title.toLowerCase().trim()
  const cacheKey = `${normArtist}:${normTitle}`

  // Check curated lyrics dictionary first
  for (const [key, lyrics] of Object.entries(CURATED_SONG_LYRICS)) {
    const [cArtist, cTitle] = key.split(':')
    if (
      (normArtist.includes(cArtist) || cArtist.includes(normArtist) || !normArtist) &&
      (normTitle.includes(cTitle) || cTitle.includes(normTitle))
    ) {
      lyricsCache.set(cacheKey, lyrics)
      return lyrics
    }
  }

  if (lyricsCache.has(cacheKey)) {
    return lyricsCache.get(cacheKey)
  }

  const startTime = performance.now()
  try {
    const cleanedTitle = cleanTitleForLyrics(title)

    // Tier 1: LRCLIB search by track_name & artist_name
    const fetchFromLrclibParams = async (t: string, a: string) => {
      const url = new URL('https://lrclib.net/api/search')
      url.searchParams.set('track_name', t)
      if (a) url.searchParams.set('artist_name', a)
      const res = await fetch(url, { signal })
      if (!res.ok) return []
      return ((await res.json()) as LrclibResult[]) || []
    }

    let results = await fetchFromLrclibParams(cleanedTitle || title, artist)

    // Tier 2: LRCLIB general q query
    if (results.length === 0) {
      const url = new URL('https://lrclib.net/api/search')
      url.searchParams.set('q', `${artist} ${cleanedTitle || title}`.trim())
      const res = await fetch(url, { signal })
      if (res.ok) {
        results = ((await res.json()) as LrclibResult[]) || []
      }
    }

    const latencyMs = Math.round(performance.now() - startTime)

    const best = results.find((r) => r.plainLyrics?.trim() || r.syncedLyrics?.trim()) || results[0]
    let lyricsText: string | undefined

    if (best?.plainLyrics?.trim()) {
      lyricsText = best.plainLyrics.trim()
    } else if (best?.syncedLyrics) {
      lyricsText = best.syncedLyrics
        .split('\n')
        .map((line) => line.replace(/^\[\d+:\d+\.\d+\]\s*/, '').trim())
        .filter(Boolean)
        .join('\n')
    }

    // Tier 3: Lyrics.ovh API fallback
    if (!lyricsText && artist && (cleanedTitle || title)) {
      try {
        const ovhUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(cleanedTitle || title)}`
        const ovhRes = await fetch(ovhUrl, { signal })
        if (ovhRes.ok) {
          const ovhData = (await ovhRes.json()) as { lyrics?: string }
          if (ovhData.lyrics?.trim()) {
            lyricsText = ovhData.lyrics.trim()
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

// ─── Games (RAWG) ──────────────────────────────────────────────────────────

type RawgGameItem = {
  id: number
  name: string
  released?: string
  background_image?: string
  short_screenshots?: Array<{ image: string }>
  genres?: Array<{ name: string }>
  platforms?: Array<{ platform: { name: string } }>
}

async function searchGames(
  query: string,
  signal?: AbortSignal,
): Promise<MetadataResult[]> {
  const startTime = performance.now()
  if (!rawgApiKey) {
    const errorMsg = 'Please add VITE_RAWG_API_KEY to .env.local to search Video Games.'
    logApiCall({
      provider: 'RAWG',
      queryOrUrl: query,
      status: 'ERROR',
      latencyMs: 0,
      resultCount: 0,
      cacheStatus: 'MISS',
      error: errorMsg,
    })
    throw new Error(errorMsg)
  }

  const url = new URL(rawgApiBaseUrl, window.location.origin)
  url.searchParams.set('search', query)
  url.searchParams.set('key', rawgApiKey)
  url.searchParams.set('page_size', '8')

  try {
    const res = await fetch(url, { signal })
    const latencyMs = Math.round(performance.now() - startTime)

    if (!res.ok) {
      logApiCall({
        provider: 'RAWG',
        queryOrUrl: query,
        status: res.status,
        latencyMs,
        resultCount: 0,
        cacheStatus: 'MISS',
        error: `RAWG API HTTP ${res.status}`,
      })
      throw new Error('RAWG game search failed. Please check your RAWG API key in .env.local.')
    }
    const data = (await res.json()) as { results?: RawgGameItem[] }
    const results = (data.results ?? []).map((item) => {
      const platforms = item.platforms?.map((p) => p.platform.name).slice(0, 3).join(', ')
      const genreStr = item.genres?.map((g) => g.name).join(', ')
      const coverUrl = item.background_image || item.short_screenshots?.[0]?.image
      const safeCoverUrl = coverUrl ? resolveArtworkUrl(coverUrl, item.name, 'Game') : undefined
      return {
        id: `rawg:game:${item.id}`,
        type: 'game' as const,
        title: item.name,
        creator: platforms || 'PC / Console',
        provider: genreStr || 'Video Game',
        providerId: String(item.id),
        genre: genreStr || 'Video Game',
        coverUrl: safeCoverUrl,
        year: yearFrom(item.released),
        gameMetadata: {
          genres: item.genres?.map((genre) => genre.name).filter(Boolean),
          releaseDate: item.released,
          platforms: item.platforms?.map(({ platform }) => ({
            platform: platform.name,
            status: 'available' as const,
          })),
          metadataSource: 'RAWG',
          metadataUpdatedAt: new Date().toISOString(),
        },
      }
    })

    logApiCall({
      provider: 'RAWG',
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
      provider: 'RAWG',
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

// ─── Main export ──────────────────────────────────────────────────────────────

export async function searchMetadata(
  type: MetadataType,
  query: string,
  signal?: AbortSignal,
): Promise<MetadataResult[]> {
  const q = query.trim()
  if (q.length < 2) return []

  const cacheKey = `${type}:${q.toLowerCase()}`
  if (searchCache.has(cacheKey)) {
    const cached = searchCache.get(cacheKey)!
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

  const persisted = await getBrowserCacheValue<MetadataResult[]>(SEARCH_CACHE_NAMESPACE, cacheKey)
  signal?.throwIfAborted()
  if (persisted) {
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
  if (type === 'book') results = await searchBooks(q, signal)
  else if (type === 'film' || type === 'tv') results = await searchTmdb(type, q, signal)
  else if (type === 'song') results = await searchSongs(q, signal)
  else if (type === 'album') results = await searchAlbums(q, signal)
  else if (type === 'game') results = await searchGames(q, signal)

  searchCache.set(cacheKey, results)
  void setBrowserCacheValue(SEARCH_CACHE_NAMESPACE, cacheKey, results, SEARCH_METADATA_TTL)
  return results
}
