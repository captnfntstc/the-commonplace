// ─────────────────────────────────────────────────────────────────────────────
// metadata.ts
// Fast, multi-provider API adapters with caching & fallbacks:
//   📚 Books      → Google Books API (no key needed)
//   🎬 Films/TV   → TMDB API (if token provided) + iTunes fallback (no key needed)
//   🎵 Songs      → iTunes Search API (lightning fast, high-res art) + MusicBrainz fallback
//   💿 Albums     → iTunes Search API (lightning fast, high-res art) + MusicBrainz fallback
//   🎮 Games      → IGDB proxy + iTunes software fallback (no key needed)
//   🎵 Lyrics     → lrclib.net (no key needed)
// ─────────────────────────────────────────────────────────────────────────────

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

export function clearMetadataCache() {
  searchCache.clear()
  lyricsCache.clear()
}

export function getCachedMetadata(
  type: MetadataType,
  query: string,
): MetadataResult[] | undefined {
  const cacheKey = `${type}:${query.trim().toLowerCase()}`
  return searchCache.get(cacheKey)
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

function formatITunesArt(url?: string): string | undefined {
  if (!url) return undefined
  return url.replace(/\/\d+x\d+bb\.jpg$/, '/600x600bb.jpg')
}

// ─── Google Books API ─────────────────────────────────────────────────────────

async function searchBooks(
  query: string,
  signal?: AbortSignal,
): Promise<MetadataResult[]> {
  if (!googleBooksApiKey) {
    throw new Error('Please add VITE_GOOGLE_BOOKS_API_KEY to .env.local to search Books.')
  }

  const url = new URL('https://www.googleapis.com/books/v1/volumes')
  url.searchParams.set('q', query)
  url.searchParams.set('maxResults', '8')
  url.searchParams.set('key', googleBooksApiKey)

  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error('Google Books API search failed. Please check your Google Books API key in .env.local.')
  const data = (await res.json()) as { items?: GoogleBooksVolume[] }

  return (data.items ?? []).map((book) => {
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
}

// ─── TMDB (Movies & TV) ────────────────────────────────────────────────────────

async function searchTmdb(
  type: 'film' | 'tv',
  query: string,
  signal?: AbortSignal,
): Promise<MetadataResult[]> {
  if (!tmdbToken) {
    throw new Error('Please add VITE_TMDB_ACCESS_TOKEN to .env.local to search Films & TV.')
  }

  const endpoint = type === 'film' ? 'movie' : 'tv'
  const url = new URL(`https://api.themoviedb.org/3/search/${endpoint}`)
  url.searchParams.set('query', query)
  url.searchParams.set('include_adult', 'false')
  url.searchParams.set('language', 'en-US')
  url.searchParams.set('page', '1')

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${tmdbToken}`, accept: 'application/json' },
    signal,
  })

  if (!res.ok) throw new Error('TMDB API search failed. Please check your TMDB Access Token.')
  const data = (await res.json()) as { results?: TmdbItem[] }

  return (data.results ?? []).slice(0, 8).map((item) => {
    const date = type === 'film' ? item.release_date : item.first_air_date
    const title = (type === 'film' ? item.title : item.name) ?? 'Untitled'
    return {
      id: `tmdb:${type}:${item.id}`,
      type,
      title,
      creator: '',
      provider: yearFrom(date) ?? '',
      providerId: String(item.id),
      genre: type === 'film' ? 'Film' : 'TV Show',
      coverUrl: item.poster_path
        ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
        : undefined,
      year: yearFrom(date),
      summary: item.overview,
    }
  })
}

// ─── MusicBrainz fallback helpers ─────────────────────────────────────────────

async function mbGet<T>(
  path: string,
  params: Record<string, string>,
  signal?: AbortSignal,
): Promise<T> {
  const url = new URL(`https://musicbrainz.org/ws/2/${path}`)
  url.searchParams.set('fmt', 'json')
  url.searchParams.set('limit', '8')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  const res = await fetch(url, {
    headers: {
      'User-Agent': `TheCommonplace/1.0 ( ${appContact} )`,
    },
    signal,
  })
  if (res.status === 503)
    throw new Error(
      'MusicBrainz rate limit reached — please wait a moment and try again.',
    )
  if (!res.ok) throw new Error('MusicBrainz search failed.')
  return res.json() as Promise<T>
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
  try {
    const url = new URL('https://itunes.apple.com/search')
    url.searchParams.set('term', query)
    url.searchParams.set('entity', 'song')
    url.searchParams.set('limit', '8')

    const res = await fetch(url, { signal })
    if (res.ok) {
      const data = (await res.json()) as { results?: ITunesSearchResult[] }
      if (data.results && data.results.length > 0) {
        return data.results.map((item) => ({
          id: `itunes:song:${item.trackId || item.collectionId}`,
          type: 'song' as const,
          title: item.trackName ?? 'Untitled',
          creator: item.artistName ?? '',
          provider: item.collectionName ?? '',
          providerId: String(item.trackId || ''),
          genre: item.primaryGenreName,
          coverUrl: formatITunesArt(item.artworkUrl100),
          year: yearFrom(item.releaseDate),
        }))
      }
    }
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err
  }

  return searchSongsMusicBrainz(query, signal)
}

// ─── Albums (iTunes primary + MusicBrainz fallback) ──────────────────────────

async function searchAlbums(
  query: string,
  signal?: AbortSignal,
): Promise<MetadataResult[]> {
  try {
    const url = new URL('https://itunes.apple.com/search')
    url.searchParams.set('term', query)
    url.searchParams.set('entity', 'album')
    url.searchParams.set('limit', '8')

    const res = await fetch(url, { signal })
    if (res.ok) {
      const data = (await res.json()) as { results?: ITunesSearchResult[] }
      if (data.results && data.results.length > 0) {
        return data.results.map((item) => ({
          id: `itunes:album:${item.collectionId}`,
          type: 'album' as const,
          title: item.collectionName ?? 'Untitled',
          creator: item.artistName ?? '',
          provider: item.primaryGenreName ?? '',
          providerId: String(item.collectionId || ''),
          genre: item.primaryGenreName,
          coverUrl: formatITunesArt(item.artworkUrl100),
          year: yearFrom(item.releaseDate),
        }))
      }
    }
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err
  }

  return searchAlbumsMusicBrainz(query, signal)
}

// ─── Lyrics via lrclib.net ─────────────────────────────────────────────────────

/**
 * Fetch plain lyrics for a song. Returns undefined if not found.
 * lrclib.net is free, open-source, and requires no API key.
 */
export async function fetchLyrics(
  artist: string,
  title: string,
  signal?: AbortSignal,
): Promise<string | undefined> {
  const cacheKey = `${artist.toLowerCase().trim()}:${title.toLowerCase().trim()}`
  if (lyricsCache.has(cacheKey)) {
    return lyricsCache.get(cacheKey)
  }

  try {
    const url = new URL('https://lrclib.net/api/search')
    url.searchParams.set('track_name', title)
    url.searchParams.set('artist_name', artist)

    const res = await fetch(url, { signal })
    if (!res.ok) return undefined

    const results = (await res.json()) as LrclibResult[]
    if (!results.length) {
      lyricsCache.set(cacheKey, undefined)
      return undefined
    }

    const best = results[0]
    let lyricsText: string | undefined

    if (best.plainLyrics?.trim()) {
      lyricsText = best.plainLyrics.trim()
    } else if (best.syncedLyrics) {
      // Strip [mm:ss.xx] timestamp prefixes from synced lyrics
      lyricsText = best.syncedLyrics
        .split('\n')
        .map((line) => line.replace(/^\[\d+:\d+\.\d+\]\s*/, '').trim())
        .filter(Boolean)
        .join('\n')
    }

    lyricsCache.set(cacheKey, lyricsText)
    return lyricsText
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error
    return undefined
  }
}

// ─── Games (RAWG + Wikipedia Video Games + Steam Store) ─────────────────────

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
  try {
    // 1. Try pageimages first
    const url = new URL('https://en.wikipedia.org/w/api.php')
    url.searchParams.set('action', 'query')
    url.searchParams.set('titles', `${title} (video game)|${title}`)
    url.searchParams.set('prop', 'pageimages')
    url.searchParams.set('piprop', 'thumbnail')
    url.searchParams.set('pithumbsize', '600')
    url.searchParams.set('format', 'json')
    url.searchParams.set('origin', '*')

    const res = await fetch(url, { signal })
    if (res.ok) {
      const data = (await res.json()) as {
        query?: { pages?: Record<string, { thumbnail?: { source: string } }> }
      }
      if (data.query?.pages) {
        for (const page of Object.values(data.query.pages)) {
          if (page.thumbnail?.source) return page.thumbnail.source
        }
      }
    }

    // 2. Fallback: Query page images list for cover / box / poster art files
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
                    if (ip.imageinfo?.[0]?.thumburl) return ip.imageinfo[0].thumburl
                    if (ip.imageinfo?.[0]?.url) return ip.imageinfo[0].url
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
  return undefined
}

async function searchGames(
  query: string,
  signal?: AbortSignal,
): Promise<MetadataResult[]> {
  if (!rawgApiKey) {
    throw new Error('Please add VITE_RAWG_API_KEY to .env.local to search Video Games.')
  }

  const url = new URL('https://api.rawg.io/api/games')
  url.searchParams.set('search', query)
  url.searchParams.set('key', rawgApiKey)
  url.searchParams.set('page_size', '8')

  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error('RAWG game search failed. Please check your RAWG API key in .env.local.')
  const data = (await res.json()) as { results?: RawgGameItem[] }

  return await Promise.all(
    (data.results ?? []).map(async (item) => {
      const platforms = item.platforms?.map((p) => p.platform.name).slice(0, 3).join(', ')
      const genreStr = item.genres?.map((g) => g.name).join(', ')
      let coverUrl = item.background_image || item.short_screenshots?.[0]?.image
      if (!coverUrl) {
        coverUrl = await fetchWikiImageByTitle(item.name, signal)
      }
      return {
        id: `rawg:game:${item.id}`,
        type: 'game' as const,
        title: item.name,
        creator: platforms || 'PC / Console',
        provider: genreStr || 'Video Game',
        providerId: String(item.id),
        genre: genreStr || 'Video Game',
        coverUrl,
        year: yearFrom(item.released),
      }
    })
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

  const cacheKey = `${type}:${q.toLowerCase()}`
  if (searchCache.has(cacheKey)) {
    return searchCache.get(cacheKey)!
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
