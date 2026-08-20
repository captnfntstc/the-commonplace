const MUSICBRAINZ_ARTIST_SEARCH_URL = 'https://musicbrainz.org/ws/2/artist'
const FANART_MUSIC_API_URL = 'https://webservice.fanart.tv/v3.2/music'
const REQUEST_TIMEOUT_MS = 10_000

function normalizeArtistNameForMatch(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^the\s+/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function escapeMusicBrainzQuery(value) {
  return String(value || '').replace(/([+\-&|!(){}\[\]^"~*?:\\/])/g, '\\$1')
}

export function selectMusicBrainzArtist(artists, requestedName) {
  const normRequested = normalizeArtistNameForMatch(requestedName)
  if (!normRequested) return undefined

  const candidates = [...(artists || [])]

  // 1. Direct name match (ignoring optional leading "The ")
  const directMatch = candidates
    .filter((artist) => normalizeArtistNameForMatch(artist?.name) === normRequested)
    .sort((left, right) => Number(right?.score || 0) - Number(left?.score || 0))[0]

  if (directMatch) return directMatch

  // 2. Alias match
  const aliasMatch = candidates
    .filter((artist) =>
      Array.isArray(artist?.aliases) &&
      artist.aliases.some((alias) => normalizeArtistNameForMatch(alias?.name) === normRequested),
    )
    .sort((left, right) => Number(right?.score || 0) - Number(left?.score || 0))[0]

  return aliasMatch || candidates.sort((left, right) => Number(right?.score || 0) - Number(left?.score || 0))[0]
}

function fanartUploadTime(image) {
  const value = image?.added
  const numeric = Number(value)
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric > 1_000_000_000_000 ? numeric : numeric * 1000
  }
  const parsed = Date.parse(String(value || ''))
  return Number.isFinite(parsed) ? parsed : 0
}

export function selectLatestArtistThumb(images) {
  return [...(images || [])]
    .filter((image) => typeof image?.url === 'string' && /^https:\/\//i.test(image.url))
    .sort((left, right) =>
      fanartUploadTime(right) - fanartUploadTime(left) ||
      Number(right?.id || 0) - Number(left?.id || 0),
    )[0]
}

function getFanartApiKey(env) {
  const apiKey = env.FANART_TV_API_KEY?.trim()
  if (!apiKey) {
    const error = new Error('Fanart.tv is not configured. Add FANART_TV_API_KEY to the server environment.')
    error.statusCode = 503
    throw error
  }
  return apiKey
}

async function fetchJson(url, options, fetchImpl) {
  try {
    const response = await fetchImpl(url, options)
    if (response.status === 404) {
      return null
    }
    if (!response.ok) {
      const error = new Error(`Artwork provider request failed with HTTP ${response.status}.`)
      error.statusCode = response.status === 429 ? 429 : 502
      throw error
    }
    return response.json()
  } catch (error) {
    if (error?.name === 'AbortError' || error?.statusCode) throw error
    return null
  }
}

export async function fetchFanartArtistPortrait(name, env = process.env, fetchImpl = fetch) {
  const cleanName = String(name || '').trim()
  if (!cleanName) {
    const error = new Error('An artist name is required.')
    error.statusCode = 400
    throw error
  }

  const apiKey = getFanartApiKey(env)
  const timeoutController = new AbortController()
  const timeout = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS)

  try {
    const musicBrainzUrl = new URL(MUSICBRAINZ_ARTIST_SEARCH_URL)
    const escaped = escapeMusicBrainzQuery(cleanName)
    const queryStr = cleanName.toLowerCase().startsWith('the ')
      ? `artist:"${escaped}"`
      : `artist:"${escaped}" OR artist:"The ${escaped}"`
    musicBrainzUrl.searchParams.set('query', queryStr)
    musicBrainzUrl.searchParams.set('fmt', 'json')
    musicBrainzUrl.searchParams.set('limit', '10')

    const musicBrainzData = await fetchJson(musicBrainzUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': `TheCommonplace/1.0 (${env.APP_CONTACT || env.VITE_APP_CONTACT || 'the-commonplace@example.com'})`,
      },
      signal: timeoutController.signal,
    }, fetchImpl)
    const artist = selectMusicBrainzArtist(musicBrainzData?.artists, cleanName)

    // MusicBrainz classifies duos and larger bands as Group. Person entries stay
    // entirely on the Wikipedia portrait path in the browser.
    if (!artist || artist.type !== 'Group') {
      return {
        artistType: artist?.type || 'Unknown',
        imageUrl: '',
        musicBrainzId: artist?.id || '',
      }
    }

    const fanartUrl = new URL(`${FANART_MUSIC_API_URL}/${encodeURIComponent(artist.id)}`)
    fanartUrl.searchParams.set('api_key', apiKey)
    const fanartData = await fetchJson(fanartUrl, {
      headers: { Accept: 'application/json' },
      signal: timeoutController.signal,
    }, fetchImpl)
    const latestImage = selectLatestArtistThumb(fanartData?.artistthumb)

    return {
      artistType: artist.type,
      imageUrl: latestImage?.url || '',
      musicBrainzId: artist.id,
      fanartId: latestImage?.id ? String(latestImage.id) : '',
      added: latestImage?.added || '',
    }
  } finally {
    clearTimeout(timeout)
  }
}

export async function handleFanartApiRequest(requestUrl, env = process.env) {
  const url = new URL(requestUrl, 'http://localhost')
  if (!/^\/api\/fanart\/artist\/?$/.test(url.pathname)) return undefined
  return fetchFanartArtistPortrait(url.searchParams.get('name') || '', env)
}
