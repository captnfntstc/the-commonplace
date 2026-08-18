const LASTFM_API_URL = 'https://ws.audioscrobbler.com/2.0/'
const REQUEST_TIMEOUT_MS = 10_000
const DEFAULT_RESULT_LIMIT = 20
const MAX_RESULT_LIMIT = 50

function normalizeArtistName(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function getLastFmApiKey(env) {
  const apiKey = env.LASTFM_API_KEY?.trim()
  if (!apiKey) {
    const error = new Error('Last.fm is not configured. Add LASTFM_API_KEY to the server environment.')
    error.statusCode = 503
    throw error
  }
  return apiKey
}

function requestedLimit(value) {
  const numeric = Number(value)
  if (!Number.isInteger(numeric) || numeric <= 0) return DEFAULT_RESULT_LIMIT
  return Math.min(numeric, MAX_RESULT_LIMIT)
}

export function normalizeLastFmSimilarArtists(artists, requestedArtist, limit = DEFAULT_RESULT_LIMIT) {
  const normalizedTarget = normalizeArtistName(requestedArtist)
  const unique = new Map()

  for (const artist of artists || []) {
    const name = String(artist?.name || '').trim()
    const normalizedName = normalizeArtistName(name)
    const musicBrainzId = String(artist?.mbid || '').trim()
    const match = Math.max(0, Math.min(1, Number(artist?.match || 0)))
    if (!name || !normalizedName || normalizedName === normalizedTarget || match <= 0) continue

    const key = musicBrainzId || `name:${normalizedName}`
    const candidate = {
      name,
      musicBrainzId,
      match,
      url: typeof artist?.url === 'string' ? artist.url : '',
    }
    const existing = unique.get(key)
    if (!existing || candidate.match > existing.match) unique.set(key, candidate)
  }

  return [...unique.values()]
    .sort((left, right) => right.match - left.match || left.name.localeCompare(right.name))
    .slice(0, requestedLimit(limit))
}

export async function fetchLastFmSimilarArtists(
  artistName,
  limit = DEFAULT_RESULT_LIMIT,
  env = process.env,
  fetchImpl = fetch,
) {
  const cleanName = String(artistName || '').trim()
  if (!cleanName) {
    const error = new Error('An artist name is required.')
    error.statusCode = 400
    throw error
  }

  const apiKey = getLastFmApiKey(env)
  const safeLimit = requestedLimit(limit)
  const timeoutController = new AbortController()
  const timeout = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS)

  try {
    const url = new URL(LASTFM_API_URL)
    url.searchParams.set('method', 'artist.getsimilar')
    url.searchParams.set('artist', cleanName)
    url.searchParams.set('api_key', apiKey)
    url.searchParams.set('format', 'json')
    url.searchParams.set('autocorrect', '1')
    url.searchParams.set('limit', String(safeLimit))

    const response = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
      signal: timeoutController.signal,
    })
    if (!response.ok) {
      const error = new Error(`Last.fm request failed with HTTP ${response.status}.`)
      error.statusCode = response.status === 429 ? 429 : 502
      throw error
    }

    const data = await response.json()
    if (data?.error) {
      const error = new Error(data.message || 'Last.fm could not return similar artists.')
      error.statusCode = Number(data.error) === 29 ? 429 : 502
      throw error
    }

    const artists = normalizeLastFmSimilarArtists(
      data?.similarartists?.artist,
      cleanName,
      safeLimit,
    )
    return {
      artist: String(data?.similarartists?.['@attr']?.artist || cleanName),
      source: 'Last.fm',
      artists,
    }
  } finally {
    clearTimeout(timeout)
  }
}

export async function handleLastFmApiRequest(requestUrl, env = process.env) {
  const url = new URL(requestUrl, 'http://localhost')
  if (!/^\/api\/lastfm\/similar-artists\/?$/.test(url.pathname)) return undefined
  return fetchLastFmSimilarArtists(
    url.searchParams.get('artist') || '',
    url.searchParams.get('limit') || DEFAULT_RESULT_LIMIT,
    env,
  )
}
