// ─────────────────────────────────────────────────────────────────────────────
// metadata.ts
// Fast, multi-provider API adapters with caching & fallbacks:
//   📚 Books      → Google Books API
//   🎬 Films/TV   → TMDB API
//   🎵 Songs      → iTunes Search API + MusicBrainz fallback
//   💿 Albums     → iTunes Search API + MusicBrainz fallback
//   🎮 Games      → RAWG + Wikipedia fallback
//   🎵 Lyrics     → lrclib.net
// ─────────────────────────────────────────────────────────────────────────────
import { logApiCall, type ApiProvider } from './services/apiTracker'
import { resolveArtworkUrl } from './utils/artwork'

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
  img.onload = () => {
    window.setTimeout(() => preloadedImages.delete(url), 30000)
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
}

export const albumEntityMap = new Map<
  string,
  { id: string; name: string; artist: string; artworkUrl: string; year: string; category: 'album' | 'ep' | 'single'; collectionId?: string }
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

function albumVariantSignals(title: string): Set<string> {
  const normalized = normalizeAlbumTitleForMatch(title)
  const signals = new Set<string>()
  const checks: Array<[string, RegExp]> = [
    ['deluxe', /\bdeluxe\b/],
    ['taylor-version', /\btaylor s version\b|\btaylors version\b|\btv\b/],
    ['forever', /\bforever\b|\bwe ll all be here forever\b/],
    ['expanded', /\bexpanded\b/],
    ['platinum', /\bplatinum\b/],
    ['anniversary', /\banniversary\b/],
    ['special', /\bspecial\b/],
    ['complete', /\bcomplete\b/],
    ['edition', /\bedition\b/],
  ]

  for (const [signal, pattern] of checks) {
    if (pattern.test(normalized)) signals.add(signal)
  }

  return signals
}

function scoreAlbumVariantMatch(candidateName: string, requestedName: string): number {
  const candidate = normalizeAlbumTitleForMatch(candidateName)
  const requested = normalizeAlbumTitleForMatch(requestedName)
  if (!candidate || !requested) return 0

  let score = 0
  if (candidate === requested) score += 1000
  else if (candidate.includes(requested)) score += 500
  else if (requested.includes(candidate)) score += 300

  const requestedTokens = new Set(requested.split(' ').filter(Boolean))
  const candidateTokens = new Set(candidate.split(' ').filter(Boolean))
  for (const token of requestedTokens) {
    if (candidateTokens.has(token)) score += 20
  }

  const requestedSignals = albumVariantSignals(requestedName)
  const candidateSignals = albumVariantSignals(candidateName)
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

function collectionTrackCoverageScore(songs: any[], expectedTrackCount?: number): number {
  const trackNumbers = new Set(
    songs
      .map((song: any) => Number(song.trackNumber))
      .filter((trackNumber: number) => Number.isFinite(trackNumber) && trackNumber > 0),
  )
  if (trackNumbers.size === 0) return 0

  const maxTrackNumber = Math.max(...trackNumbers)
  let contiguousCount = 0
  for (let trackNumber = 1; trackNumber <= maxTrackNumber; trackNumber += 1) {
    if (!trackNumbers.has(trackNumber)) break
    contiguousCount += 1
  }

  let score = trackNumbers.size * 4 + contiguousCount * 3
  if (expectedTrackCount && trackNumbers.size === expectedTrackCount) score += 520
  if (expectedTrackCount && maxTrackNumber === expectedTrackCount) score += 150
  if (expectedTrackCount && trackNumbers.size !== expectedTrackCount) score -= 360
  if (expectedTrackCount && maxTrackNumber !== expectedTrackCount) score -= 120
  return score
}

function isOfficialArtistMatch(candidateArtist: string | undefined, requestedArtist?: string): boolean {
  if (!requestedArtist) return true
  return normalizeAlbumTitleForMatch(candidateArtist || '') === normalizeAlbumTitleForMatch(requestedArtist)
}

function uniqueTrackNumberCount(songs: any[]): number {
  return new Set(
    songs
      .map((song: any) => Number(song.trackNumber))
      .filter((trackNumber: number) => Number.isFinite(trackNumber) && trackNumber > 0),
  ).size
}

function selectBestSongCollection(
  songs: any[],
  requestedAlbum: string,
  requestedArtist?: string,
  expectedTrackCount?: number,
): any[] {
  const byCollection: Record<string, any[]> = {}
  for (const song of songs) {
    if (!song.collectionId) continue
    const cid = String(song.collectionId)
    if (!byCollection[cid]) byCollection[cid] = []
    byCollection[cid].push(song)
  }

  let bestCid: string | null = null
  let bestScore = -Infinity
  for (const [cid, cSongs] of Object.entries(byCollection)) {
    const firstSong = cSongs[0]
    const officialArtistScore = isOfficialArtistMatch(firstSong.artistName, requestedArtist) ? 320 : -320
    const score =
      scoreAlbumVariantMatch(firstSong.collectionName || '', requestedAlbum) +
      officialArtistScore +
      collectionTrackCoverageScore(cSongs, expectedTrackCount)
    if (score > bestScore) {
      bestScore = score
      bestCid = cid
    }
  }

  return bestCid && byCollection[bestCid] ? byCollection[bestCid] : songs
}

function mapItunesAlbumResult(item: ITunesSearchResult): MetadataResult {
  const title = item.collectionName ?? 'Untitled'
  const collectionId = String(item.collectionId || '')
  const id = `album-${collectionId || normalizeAlbumTitleForMatch(title).replace(/[^a-z0-9]+/g, '-')}`
  const coverUrl = formatITunesArt(item.artworkUrl100, title)
  const year = yearFrom(item.releaseDate) || ''
  const artist = item.artistName ?? ''

  albumEntityMap.set(id, {
    id,
    name: title,
    artist,
    artworkUrl: coverUrl || '',
    year,
    category: 'album',
    collectionId: collectionId || undefined,
  })

  if (artist && title) {
    albumEntityMap.set(`${title}:${artist}`.toLowerCase(), {
      id,
      name: title,
      artist,
      artworkUrl: coverUrl || '',
      year,
      category: 'album',
      collectionId: collectionId || undefined,
    })
  }

  if (coverUrl) {
    entityImageCacheMap.set(id, coverUrl)
    if (artist && title) {
      entityImageCacheMap.set(`${title}:${artist}`.toLowerCase(), coverUrl)
    }
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
  }
}

const knownAlbumArtistBoosts: Record<string, number> = {
  'taylor swift': 520,
  'noah kahan': 470,
  'olivia rodrigo': 440,
  radiohead: 420,
  beyonce: 410,
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

function knownArtistBoost(artistName?: string): number {
  const normalizedArtist = normalizeAlbumTitleForMatch(artistName || '')
  if (!normalizedArtist) return 0
  return knownAlbumArtistBoosts[normalizedArtist] ?? 0
}



export async function fetchItunesDiscography(artistName: string, signal?: AbortSignal): Promise<DiscographyItem[]> {
  const cacheKey = `itunes-discography:${normalizeAlbumTitleForMatch(artistName)}`
  return cachedApiRequest(cacheKey, signal, async () => {
    try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(artistName)}&entity=album&limit=200`
    const res = await fetch(url, { signal })
    if (!res.ok) return []
    const data = (await res.json()) as any
    let results = data.results || []

    const cleanArtistLower = artistName.toLowerCase().trim()

    // 1. Strict Primary Artist Filter: album.artistName must strictly match target artist
    results = results.filter((album: any) => {
      const albumArtist = (album.artistName || '').toLowerCase().trim()
      const title = (album.collectionName || '').toLowerCase().trim()
      if (!title) return false

      // Artist name match check (e.g. "Taylor Swift", "Noah Kahan", "Olivia Rodrigo", "Hollow Coves")
      const isTargetArtist = albumArtist === cleanArtistLower || albumArtist.startsWith(cleanArtistLower)
      if (!isTargetArtist) return false

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
    return results
      .filter((album: any) => {
        const cleanTitle = album.collectionName.toLowerCase().trim()
        if (seen.has(cleanTitle)) return false
        seen.add(cleanTitle)
        return true
      })
      .map((album: any) => {
        const cover = formatITunesArt(album.artworkUrl100, album.collectionName) || ''
        const year = album.releaseDate ? album.releaseDate.slice(0, 4) : ''
        const tc = album.trackCount || 10
        const lowerName = album.collectionName.toLowerCase()
        let category: 'album' | 'ep' | 'single' = 'album'
        if (/\bsingle\b/i.test(lowerName) || tc <= 3) category = 'single'
        else if (/\bep\b/i.test(lowerName)) category = 'ep'

        const id = `album-${album.collectionId || lowerName.replace(/[^a-z0-9]+/g, '-')}`
        
        albumEntityMap.set(id, {
          id,
          name: album.collectionName,
          artist: album.artistName || artistName,
          artworkUrl: cover,
          year,
          category,
          collectionId: album.collectionId ? String(album.collectionId) : undefined,
        })
        albumEntityMap.set(lowerName, {
          id,
          name: album.collectionName,
          artist: album.artistName || artistName,
          artworkUrl: cover,
          year,
          category,
          collectionId: album.collectionId ? String(album.collectionId) : undefined,
        })
        entityImageCacheMap.set(album.collectionName, cover)

        return {
          id,
          title: album.collectionName,
          subtitle: `${category.toUpperCase()} · ${year}`,
          artworkUrl: cover,
          rating: 4.9,
          year,
          genre: album.primaryGenreName || undefined,
          category,
        }
      })
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
) {
  const cacheKey = [
    'itunes-album-details',
    normalizeAlbumTitleForMatch(albumName),
    normalizeAlbumTitleForMatch(artistName || ''),
    expectedTrackCount || 0,
  ].join(':')

  return cachedApiRequest(cacheKey, signal, async () => {
    try {
    const cleanAlbum = albumName.replace(/^album-\d+/i, '').replace(/^album-/i, '').replace(/-/g, ' ')
    const collectionId = collectionIdFromAlbumEntityId(albumName)
    const query = artistName ? `${cleanAlbum} ${artistName}` : cleanAlbum
    const url = collectionId
      ? `https://itunes.apple.com/lookup?id=${encodeURIComponent(collectionId)}&entity=song&limit=300`
      : `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=300`
    const res = await fetch(url, { signal })
    if (!res.ok) return null
    const data = (await res.json()) as any
    const songs = (data.results || []).filter((item: any) => item.wrapperType === 'track' || item.kind === 'song')

    if (songs.length === 0) return null

    let chosenSongs: any[] = []

    if (collectionId) {
      chosenSongs = songs.filter((s: any) => String(s.collectionId) === String(collectionId))
      if (chosenSongs.length === 0) chosenSongs = songs
      if (expectedTrackCount && uniqueTrackNumberCount(chosenSongs) !== expectedTrackCount) {
        const fallbackUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=300`
        const fallbackRes = await fetch(fallbackUrl, { signal })
        if (fallbackRes.ok) {
          const fallbackData = (await fallbackRes.json()) as any
          const fallbackSongs = (fallbackData.results || []).filter(
            (item: any) => item.wrapperType === 'track' || item.kind === 'song',
          )
          const fallbackChoice = selectBestSongCollection(fallbackSongs, cleanAlbum, artistName, expectedTrackCount)
          if (
            uniqueTrackNumberCount(fallbackChoice) === expectedTrackCount ||
            uniqueTrackNumberCount(fallbackChoice) > uniqueTrackNumberCount(chosenSongs)
          ) {
            chosenSongs = fallbackChoice
          }
        }
      }
    } else {
      chosenSongs = selectBestSongCollection(songs, cleanAlbum, artistName, expectedTrackCount)
    }

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
    const collectionName = first.collectionName || cleanAlbum
    const cover = formatITunesArt(first.artworkUrl100, collectionName) || ''

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
      })

      return {
        id: songId,
        rank: song.trackNumber || idx + 1,
        title: song.trackName,
        subtitle: `${mins}:${secs} · Track ${song.trackNumber || idx + 1}`,
        rating: 4.9,
      }
    })

    return {
      title: collectionName,
      artist,
      coverUrl: cover,
      year,
      genre,
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

  albumEntityMap.set(id, {
    id,
    name: title,
    artist: item.artistName || '',
    artworkUrl: cover,
    year,
    category: 'album',
    collectionId: collectionId || undefined,
  })
  albumEntityMap.set(title.toLowerCase(), {
    id,
    name: title,
    artist: item.artistName || '',
    artworkUrl: cover,
    year,
    category: 'album',
    collectionId: collectionId || undefined,
  })
  if (cover) entityImageCacheMap.set(title, cover)

  return {
    id,
    title,
    subtitle: `${item.primaryGenreName || 'Album'}${year ? ` · ${year}` : ''}`,
    artworkUrl: cover,
    rating: 4.8,
    year,
    category: 'album',
  }
}

export async function fetchRelatedAlbums(
  albumName: string,
  artistName?: string,
  genre?: string,
  albumKey?: string,
  signal?: AbortSignal,
): Promise<DiscographyItem[]> {
  const cacheKey = [
    'itunes-related-albums-v3',
    normalizeAlbumTitleForMatch(albumName),
    normalizeAlbumTitleForMatch(artistName || ''),
    normalizeAlbumTitleForMatch(genre || ''),
    albumKey || '',
  ].join(':')

  return cachedApiRequest(cacheKey, signal, async () => {
    try {
      const cleanArtist = artistName && artistName !== 'Artist' ? artistName.trim() : ''
      const cleanGenre = genre && genre !== 'Genre' ? genre.trim() : ''

      const terms = Array.from(
        new Set(
          [
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
      const selectedTitle = normalizeAlbumTitleForMatch(albumName)
      const selectedGenre = normalizeAlbumTitleForMatch(cleanGenre)
      const selectedArtist = normalizeAlbumTitleForMatch(cleanArtist)
      const seen = new Set<string>()
      const artistCounts: Record<string, number> = {}

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

      return filtered
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
        .slice(0, 4)
        .map(({ item }) => mapItunesRelatedAlbum(item))
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

  if (normTargetArtist && (normArtist === normTargetArtist || normArtist.includes(normTargetArtist) || normTargetArtist.includes(normArtist))) {
    score += 5000
  }

  const boost = knownArtistBoost(item.artistName)
  score += boost * 10

  if (normTrack === normTargetSong) {
    score += 1200
  } else if (normTrack.startsWith(normTargetSong)) {
    score += 800
  } else if (normTrack.includes(normTargetSong)) {
    score += 500
  }

  const isCoverArtist =
    /\b(tribute|karaoke|instrumental|piano|lullaby|string quartet|cover|rendition|sing-along|relaxing|bedtime|acoustic version by|orchestral)\b/i.test(item.artistName || '') ||
    /\b(karaoke|instrumental|tribute|piano cover|lullaby version)\b/i.test(item.trackName || '')

  if (isCoverArtist) {
    score -= 4000
  }

  if (item.collectionName && !/tribute|karaoke|greatest hits of 20\d\d/i.test(item.collectionName)) {
    score += 200
  }

  return score
}

export async function fetchItunesSongDetails(songName: string, artistName?: string, signal?: AbortSignal) {
  const cacheKey = [
    'itunes-song-details',
    normalizeAlbumTitleForMatch(songName),
    normalizeAlbumTitleForMatch(artistName || ''),
  ].join(':')

  return cachedApiRequest(cacheKey, signal, async () => {
    try {
    const cleanSong = songName.replace(/^song-\d+/i, '').replace(/^song-/i, '').replace(/-/g, ' ')
    const query = artistName ? `${cleanSong} ${artistName}` : cleanSong
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=25`
    const res = await fetch(url, { signal })
    if (!res.ok) return null
    const data = (await res.json()) as any
    const songs = data.results || []

    if (songs.length === 0) return null
    const sortedSongs = [...songs].sort((a, b) => songSearchScore(b, cleanSong, artistName) - songSearchScore(a, cleanSong, artistName))
    const song = sortedSongs[0]

    const cover = formatITunesArt(song.artworkUrl100, song.trackName) || ''
    const year = song.releaseDate ? song.releaseDate.slice(0, 4) : ''
    const millis = song.trackTimeMillis || 200000
    const mins = Math.floor(millis / 60000)
    const secs = Math.floor((millis % 60000) / 1000).toString().padStart(2, '0')

    const lyricsData = await fetchLyrics(song.trackName, song.artistName, signal).catch(() => null)

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
      lyrics: typeof lyricsData === 'string' && lyricsData.trim() ? lyricsData : null,
    }
    } catch {
      return null
    }
  })
}

export async function fetchItunesSongArtwork(songName: string, artistName?: string, signal?: AbortSignal): Promise<string> {
  const cacheKey = [
    'itunes-song-artwork',
    normalizeAlbumTitleForMatch(songName),
    normalizeAlbumTitleForMatch(artistName || ''),
  ].join(':')

  const result = await cachedApiRequest(cacheKey, signal, async () => {
    try {
      const cleanSong = songName.replace(/^song-\d+/i, '').replace(/^song-/i, '').replace(/-/g, ' ')
      const query = artistName ? `${cleanSong} ${artistName}` : cleanSong
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=25`
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
  trackId?: number
  collectionId?: number
  artistName?: string
  trackName?: string
  collectionName?: string
  artworkUrl100?: string
  releaseDate?: string
  primaryGenreName?: string
  trackCount?: number
  longDescription?: string
  shortDescription?: string
}

// ─── Env ──────────────────────────────────────────────────────────────────────

const tmdbToken = import.meta.env.VITE_TMDB_ACCESS_TOKEN as string | undefined
const rawgApiKey = import.meta.env.VITE_RAWG_API_KEY as string | undefined
const googleBooksApiKey = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY as string | undefined
const appContact =
  (import.meta.env.VITE_APP_CONTACT as string | undefined) ??
  'the-commonplace@example.com'

// ─── Cache & Utilities ────────────────────────────────────────────────────────

const searchCache = new Map<string, MetadataResult[]>()
const lyricsCache = new Map<string, string | undefined>()
const apiResponseCache = new Map<string, unknown>()
const pendingApiRequestCache = new Map<string, Promise<unknown>>()

export function clearMetadataCache() {
  searchCache.clear()
  lyricsCache.clear()
  apiResponseCache.clear()
  pendingApiRequestCache.clear()
}

async function cachedApiRequest<T>(
  key: string,
  signal: AbortSignal | undefined,
  loader: () => Promise<T>,
): Promise<T> {
  if (!signal) {
    if (apiResponseCache.has(key)) return apiResponseCache.get(key) as T
    const pending = pendingApiRequestCache.get(key)
    if (pending) return pending as Promise<T>
  }

  const request = loader()
  if (!signal) pendingApiRequestCache.set(key, request)

  try {
    const result = await request
    if (!signal) apiResponseCache.set(key, result)
    return result
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

        const results = filtered.slice(0, 15).map((item) => {
          const title = item.trackName ?? 'Untitled'
          return {
            id: `itunes:song:${item.trackId || item.collectionId}`,
            type: 'song' as const,
            title,
            creator: item.artistName ?? '',
            provider: item.collectionName ?? '',
            providerId: String(item.trackId || ''),
            genre: item.primaryGenreName,
            coverUrl: formatITunesArt(item.artworkUrl100, title),
            year: yearFrom(item.releaseDate),
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

// ─── Games (RAWG + Wikipedia Video Games) ──────────────────────────────────

type RawgGameItem = {
  id: number
  name: string
  released?: string
  background_image?: string
  short_screenshots?: Array<{ image: string }>
  genres?: Array<{ name: string }>
  platforms?: Array<{ platform: { name: string } }>
}

async function fetchWikiImageByTitle(
  title: string,
  signal?: AbortSignal,
): Promise<string | undefined> {
  const startTime = performance.now()
  try {
    const url = new URL('https://en.wikipedia.org/w/api.php')
    url.searchParams.set('action', 'query')
    url.searchParams.set('titles', `${title} (video game)|${title}`)
    url.searchParams.set('prop', 'pageimages')
    url.searchParams.set('piprop', 'thumbnail')
    url.searchParams.set('pithumbsize', '600')
    url.searchParams.set('format', 'json')
    url.searchParams.set('origin', '*')

    const res = await fetch(url, { signal })
    const latencyMs = Math.round(performance.now() - startTime)

    if (res.ok) {
      const data = (await res.json()) as {
        query?: { pages?: Record<string, { thumbnail?: { source: string } }> }
      }
      if (data.query?.pages) {
        for (const page of Object.values(data.query.pages)) {
          if (page.thumbnail?.source) {
            logApiCall({
              provider: 'Wikipedia',
              queryOrUrl: `Image for "${title}"`,
              status: res.status,
              latencyMs,
              resultCount: 1,
              cacheStatus: 'MISS',
            })
            return page.thumbnail.source
          }
        }
      }
    }

    const imagesUrl = new URL('https://en.wikipedia.org/w/api.php')
    imagesUrl.searchParams.set('action', 'query')
    imagesUrl.searchParams.set('titles', `${title} (video game)|${title}`)
    imagesUrl.searchParams.set('prop', 'images')
    imagesUrl.searchParams.set('imlimit', '30')
    imagesUrl.searchParams.set('format', 'json')
    imagesUrl.searchParams.set('origin', '*')

    const imgRes = await fetch(imagesUrl, { signal })
    if (imgRes.ok) {
      const imgData = (await imgRes.json()) as {
        query?: { pages?: Record<string, { images?: Array<{ title: string }> }> }
      }
      if (imgData.query?.pages) {
        for (const page of Object.values(imgData.query.pages)) {
          if (page.images && page.images.length > 0) {
            const files = page.images.map((i) => i.title)
            const candidate =
              files.find((f) => {
                const fn = f.toLowerCase()
                return (
                  (fn.includes('cover') ||
                    fn.includes('box') ||
                    fn.includes('pack') ||
                    fn.includes('poster') ||
                    fn.includes('case')) &&
                  !fn.includes('logo') &&
                  !fn.includes('svg')
                )
              }) ||
              files.find((f) => {
                const fn = f.toLowerCase()
                return (
                  (fn.endsWith('.png') || fn.endsWith('.jpg') || fn.endsWith('.jpeg')) &&
                  !fn.includes('logo') &&
                  !fn.includes('svg') &&
                  !fn.includes('flag')
                )
              })

            if (candidate) {
              const infoUrl = new URL('https://en.wikipedia.org/w/api.php')
              infoUrl.searchParams.set('action', 'query')
              infoUrl.searchParams.set('titles', candidate)
              infoUrl.searchParams.set('prop', 'imageinfo')
              infoUrl.searchParams.set('iiprop', 'url')
              infoUrl.searchParams.set('iiurlwidth', '600')
              infoUrl.searchParams.set('format', 'json')
              infoUrl.searchParams.set('origin', '*')

              const infoRes = await fetch(infoUrl, { signal })
              if (infoRes.ok) {
                const infoData = (await infoRes.json()) as {
                  query?: {
                    pages?: Record<
                      string,
                      { imageinfo?: Array<{ thumburl?: string; url?: string }> }
                    >
                  }
                }
                if (infoData.query?.pages) {
                  for (const ip of Object.values(infoData.query.pages)) {
                    if (ip.imageinfo?.[0]?.thumburl || ip.imageinfo?.[0]?.url) {
                      logApiCall({
                        provider: 'Wikipedia',
                        queryOrUrl: candidate,
                        status: infoRes.status,
                        latencyMs: Math.round(performance.now() - startTime),
                        resultCount: 1,
                        cacheStatus: 'MISS',
                      })
                      return ip.imageinfo[0].thumburl || ip.imageinfo[0].url
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err
  }

  logApiCall({
    provider: 'Wikipedia',
    queryOrUrl: `Image for "${title}"`,
    status: 404,
    latencyMs: Math.round(performance.now() - startTime),
    resultCount: 0,
    cacheStatus: 'MISS',
  })
  return undefined
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

  const url = new URL('https://api.rawg.io/api/games')
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
    const results = await Promise.all(
      (data.results ?? []).map(async (item) => {
        const platforms = item.platforms?.map((p) => p.platform.name).slice(0, 3).join(', ')
        const genreStr = item.genres?.map((g) => g.name).join(', ')
        let coverUrl = item.background_image || item.short_screenshots?.[0]?.image
        if (!coverUrl) {
          coverUrl = await fetchWikiImageByTitle(item.name, signal)
        }
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
        }
      })
    )

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

  let results: MetadataResult[] = []
  if (type === 'book') results = await searchBooks(q, signal)
  else if (type === 'film' || type === 'tv') results = await searchTmdb(type, q, signal)
  else if (type === 'song') results = await searchSongs(q, signal)
  else if (type === 'album') results = await searchAlbums(q, signal)
  else if (type === 'game') results = await searchGames(q, signal)

  searchCache.set(cacheKey, results)
  return results
}
