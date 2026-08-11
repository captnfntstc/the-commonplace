const IGDB_API_BASE = 'https://api.igdb.com/v4'
const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token'
const REQUEST_TIMEOUT_MS = 10_000
const RESPONSE_CACHE_TTL_MS = 15 * 60 * 1000

let tokenCache
const responseCache = new Map()

const gameFields = [
  'id',
  'name',
  'slug',
  'summary',
  'storyline',
  'first_release_date',
  'alternative_names.name',
  'total_rating_count',
  'rating_count',
  'follows',
  'hypes',
  'version_title',
  'game_type.type',
  'game_status.status',
  'cover.image_id',
  'platforms.name',
  'genres.name',
  'game_modes.name',
  'franchises.name',
  'release_dates.date',
  'release_dates.human',
  'release_dates.platform.name',
  'involved_companies.developer',
  'involved_companies.publisher',
  'involved_companies.company.name',
  'age_ratings.organization.name',
  'age_ratings.rating_category.rating',
  'websites.url',
  'version_parent.id',
  'version_parent.name',
  'version_parent.first_release_date',
  'version_parent.cover.image_id',
  'version_parent.platforms.name',
  'parent_game.id',
  'parent_game.name',
  'ports.id',
  'ports.name',
  'ports.first_release_date',
  'ports.game_type.type',
  'ports.cover.image_id',
  'ports.platforms.name',
  'ports.release_dates.date',
  'ports.release_dates.platform.name',
  'remasters.id',
  'remasters.name',
  'remasters.first_release_date',
  'remasters.game_type.type',
  'remasters.cover.image_id',
  'remasters.platforms.name',
  'remasters.release_dates.date',
  'remasters.release_dates.platform.name',
  'remakes.id',
  'remakes.name',
  'remakes.first_release_date',
  'remakes.cover.image_id',
].join(',')

function escapeApicalypseString(value) {
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\\/g, '\\\\').replace(/"/g, '\\"').trim()
}

function isoDate(timestamp) {
  if (!Number.isFinite(timestamp)) return undefined
  return new Date(timestamp * 1000).toISOString().slice(0, 10)
}

function imageUrl(imageId, size = 't_cover_big') {
  return imageId ? `https://images.igdb.com/igdb/image/upload/${size}/${imageId}.jpg` : undefined
}

function uniqueStrings(values) {
  return Array.from(new Set(values.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim())))
}

function normalizeSearchText(value) {
  return String(value || '')
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

function tokensMatch(value, queryTokens) {
  const valueTokens = normalizeSearchText(value).split(' ').filter(Boolean)
  if (queryTokens.length === 0 || valueTokens.length === 0) return false
  return queryTokens.every((qToken) =>
    valueTokens.some((vToken) => vToken === qToken || vToken.startsWith(qToken)),
  )
}

function searchRelevance(game, query) {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return 1
  const queryTokens = normalizedQuery.split(' ').filter(Boolean)
  const title = normalizeSearchText(game.name)
  const aliases = (game.alternativeNames || []).map((alias) => normalizeSearchText(alias))
  const editions = (game.editions || []).map((edition) => normalizeSearchText(edition.name))

  if (title === normalizedQuery) return 600
  if (aliases.some((alias) => alias === normalizedQuery)) return 550
  if (title.startsWith(normalizedQuery)) return 500
  if (aliases.some((alias) => alias.startsWith(normalizedQuery))) return 480
  if (title.includes(normalizedQuery)) return 450
  if (aliases.some((alias) => alias.includes(normalizedQuery))) return 430
  if (tokensMatch(title, queryTokens)) return 400
  if (aliases.some((alias) => tokensMatch(alias, queryTokens))) return 350
  if (editions.some((edition) => tokensMatch(edition, queryTokens))) return 300
  return 0
}

export function rankIgdbSearchResults(games, query) {
  return games
    .map((game) => ({ ...game, searchRelevance: searchRelevance(game, query) }))
    .filter((game) => game.searchRelevance > 0)
    .sort((left, right) =>
      right.searchRelevance - left.searchRelevance ||
      (right.popularityScore || 0) - (left.popularityScore || 0) ||
      (left.firstReleaseDate || '9999').localeCompare(right.firstReleaseDate || '9999') ||
      left.name.localeCompare(right.name),
    )
}

function getCredentials(env) {
  const clientId = env.IGDB_CLIENT_ID?.trim()
  const clientSecret = env.IGDB_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) {
    const error = new Error('IGDB is not configured. Add IGDB_CLIENT_ID and IGDB_CLIENT_SECRET to the server environment.')
    error.statusCode = 503
    throw error
  }
  return { clientId, clientSecret }
}

async function getAccessToken(env, signal) {
  const { clientId, clientSecret } = getCredentials(env)
  if (tokenCache?.clientId === clientId && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.value

  const url = new URL(TWITCH_TOKEN_URL)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('client_secret', clientSecret)
  url.searchParams.set('grant_type', 'client_credentials')
  const response = await fetch(url, { method: 'POST', signal })
  if (!response.ok) {
    const error = new Error(`IGDB authentication failed with HTTP ${response.status}.`)
    error.statusCode = 502
    throw error
  }

  const payload = await response.json()
  tokenCache = {
    clientId,
    value: payload.access_token,
    expiresAt: Date.now() + Math.max(60, Number(payload.expires_in) || 3600) * 1000,
  }
  return tokenCache.value
}

async function igdbRequest(endpoint, body, env, signal) {
  const { clientId } = getCredentials(env)
  const accessToken = await getAccessToken(env, signal)
  const response = await fetch(`${IGDB_API_BASE}/${endpoint}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Client-ID': clientId,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'text/plain',
    },
    body,
    signal,
  })
  if (!response.ok) {
    const message = (await response.text()).slice(0, 300)
    const error = new Error(`IGDB request failed with HTTP ${response.status}${message ? `: ${message}` : '.'}`)
    error.statusCode = response.status === 429 ? 429 : 502
    throw error
  }
  return response.json()
}

function normalizeReleaseDates(raw) {
  const byPlatform = new Map()
  for (const release of raw.release_dates || []) {
    const platform = release.platform?.name
    if (!platform) continue
    const releaseDate = isoDate(release.date) || release.human
    const existing = byPlatform.get(platform)
    if (!existing || (releaseDate && (!existing.releaseDate || releaseDate < existing.releaseDate))) {
      byPlatform.set(platform, { platform, releaseDate, status: 'available' })
    }
  }
  for (const platform of raw.platforms || []) {
    if (platform?.name && !byPlatform.has(platform.name)) {
      byPlatform.set(platform.name, { platform: platform.name, status: 'available' })
    }
  }
  return Array.from(byPlatform.values())
}

function normalizeBaseGame(raw, relationshipType) {
  const developers = []
  const publishers = []
  for (const involvement of raw.involved_companies || []) {
    const company = involvement.company?.name
    if (!company) continue
    if (involvement.developer) developers.push(company)
    if (involvement.publisher) publishers.push(company)
  }

  const ageRating = (raw.age_ratings || []).map((rating) => {
    const organization = rating.organization?.name
    const value = rating.rating_category?.rating
    return [organization, value].filter(Boolean).join(' ')
  }).find(Boolean)

  return {
    id: Number(raw.id),
    name: raw.name || 'Untitled Game',
    slug: raw.slug,
    summary: raw.summary || raw.storyline,
    firstReleaseDate: isoDate(raw.first_release_date),
    gameType: relationshipType || raw.game_type?.type || 'Main Game',
    gameStatus: raw.game_status?.status,
    coverUrl: imageUrl(raw.cover?.image_id),
    alternativeNames: uniqueStrings((raw.alternative_names || []).map((alternative) => alternative.name)),
    popularityScore:
      (Number(raw.total_rating_count) || 0) * 1000 +
      (Number(raw.rating_count) || 0) * 100 +
      (Number(raw.follows) || 0) * 10 +
      (Number(raw.hypes) || 0),
    platforms: normalizeReleaseDates(raw),
    developers: uniqueStrings(developers),
    publishers: uniqueStrings(publishers),
    genres: uniqueStrings((raw.genres || []).map((genre) => genre.name)),
    gameModes: uniqueStrings((raw.game_modes || []).map((mode) => mode.name)),
    franchises: uniqueStrings((raw.franchises || []).map((franchise) => franchise.name)),
    ageRating,
    officialWebsite: (raw.websites || []).map((website) => website.url).find((url) => /^https?:\/\//i.test(url || '')),
    versionTitle: raw.version_title,
    raw,
  }
}

function typeLabel(value) {
  return String(value || 'Edition')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function editionFromGame(game) {
  return {
    providerId: String(game.id),
    name: game.versionTitle || game.name,
    type: game.gameType,
    description: typeLabel(game.gameType),
    releaseDate: game.firstReleaseDate,
    platforms: uniqueStrings(game.platforms.map((release) => release.platform)),
    coverUrl: game.coverUrl,
  }
}

function relationGames(raw, key, type) {
  return (raw[key] || []).filter((game) => game?.id).map((game) => normalizeBaseGame(game, type))
}

export function groupIgdbGames(rawGames) {
  const usable = rawGames.filter((game) => game?.id && !/^cancelled$/i.test(game.game_status?.status || ''))
  const games = new Map(usable.map((raw) => [Number(raw.id), normalizeBaseGame(raw)]))

  // A parent can be returned only as an expanded object when a version itself matches the search.
  for (const raw of usable) {
    if (raw.version_parent?.id && !games.has(Number(raw.version_parent.id))) {
      games.set(Number(raw.version_parent.id), normalizeBaseGame(raw.version_parent, 'Main Game'))
    }
  }

  const variantToCanonical = new Map()
  for (const raw of usable) {
    const sourceId = Number(raw.id)
    if (raw.version_parent?.id) variantToCanonical.set(sourceId, Number(raw.version_parent.id))
    for (const port of raw.ports || []) variantToCanonical.set(Number(port.id), sourceId)
    for (const remaster of raw.remasters || []) variantToCanonical.set(Number(remaster.id), sourceId)
  }

  function canonicalIdFor(id) {
    const visited = new Set()
    let current = id
    while (variantToCanonical.has(current) && !visited.has(current)) {
      visited.add(current)
      current = variantToCanonical.get(current)
    }
    return current
  }

  const groups = new Map()
  for (const game of games.values()) {
    const canonicalId = canonicalIdFor(game.id)
    const group = groups.get(canonicalId) || []
    group.push(game)
    groups.set(canonicalId, group)
  }

  const results = []
  for (const [canonicalId, members] of groups) {
    const canonical = games.get(canonicalId) || members.slice().sort((a, b) => (a.firstReleaseDate || '9999').localeCompare(b.firstReleaseDate || '9999'))[0]
    const relatedPorts = relationGames(canonical.raw, 'ports', 'Port')
    const relatedRemasters = relationGames(canonical.raw, 'remasters', 'Remaster')
    const variants = [...members.filter((member) => member.id !== canonical.id), ...relatedPorts, ...relatedRemasters]
    const uniqueVariants = Array.from(new Map(variants.map((variant) => [variant.id, variant])).values())
    const remakes = relationGames(canonical.raw, 'remakes', 'Remake').map((game) => ({
      id: game.id,
      name: game.name,
      releaseDate: game.firstReleaseDate,
      coverUrl: game.coverUrl,
    }))

    results.push({
      id: canonical.id,
      name: canonical.name,
      slug: canonical.slug,
      summary: canonical.summary,
      firstReleaseDate: canonical.firstReleaseDate,
      gameType: canonical.gameType,
      coverUrl: canonical.coverUrl || uniqueVariants.find((variant) => variant.coverUrl)?.coverUrl,
      alternativeNames: canonical.alternativeNames,
      popularityScore: canonical.popularityScore,
      platforms: canonical.platforms,
      developers: canonical.developers,
      publishers: canonical.publishers,
      genres: canonical.genres,
      gameModes: canonical.gameModes,
      franchise: canonical.franchises[0],
      ageRating: canonical.ageRating,
      officialWebsite: canonical.officialWebsite,
      editions: uniqueVariants.map(editionFromGame),
      relatedRemakes: remakes,
    })
  }

  return results
}

function orderingClause(ordering) {
  switch (ordering) {
    case 'name': return 'sort name asc;'
    case '-released': return 'sort first_release_date desc;'
    case 'released': return 'sort first_release_date asc;'
    case '-rating': return 'sort total_rating_count desc;'
    default: return 'sort total_rating_count desc;'
  }
}

export async function fetchIgdbGames(params, env = process.env) {
  const page = Math.max(1, Number(params.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 40))
  const search = typeof params.search === 'string' ? escapeApicalypseString(params.search) : ''
  const id = Number(params.id)
  const cacheKey = JSON.stringify({ page, pageSize, search, id: Number.isFinite(id) ? id : undefined, ordering: params.ordering })
  const cached = responseCache.get(cacheKey)
  if (cached?.expiresAt > Date.now() && cached.value?.results?.length > 0) return cached.value

  const timeoutController = new AbortController()
  const timeout = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS)
  try {
    const filters = []
    if (Number.isFinite(id) && id > 0) filters.push(`id = ${id}`)
    const body = [
      `fields ${gameFields};`,
      search ? `search "${search}";` : orderingClause(params.ordering),
      filters.length ? `where ${filters.join(' & ')};` : '',
      `limit ${Number.isFinite(id) && id > 0 ? 1 : pageSize};`,
      Number.isFinite(id) && id > 0 ? '' : `offset ${(page - 1) * pageSize};`,
    ].filter(Boolean).join(' ')
    const rawGames = await igdbRequest('games', body, env, timeoutController.signal)
    const groupedGames = groupIgdbGames(rawGames)
    let results = search
      ? rankIgdbSearchResults(groupedGames, search)
      : groupedGames.sort((left, right) => (right.popularityScore || 0) - (left.popularityScore || 0))

    if (search && results.length === 0) {
      const searchWords = search.trim().split(/\s+/)
      if (searchWords.length >= 2) {
        const prefixQuery = searchWords.slice(0, -1).join(' ')
        const fallbackValue = await fetchIgdbGames({ search: prefixQuery, pageSize: Math.max(60, pageSize) }, env)
        const rankedFallback = rankIgdbSearchResults(fallbackValue.results, search)
        if (rankedFallback.length > 0) {
          results = rankedFallback
        }
      }
    }

    const value = {
      results,
      page,
      hasNextPage: !(Number.isFinite(id) && id > 0) && rawGames.length === pageSize,
    }
    if (results.length > 0) {
      responseCache.set(cacheKey, { value, expiresAt: Date.now() + RESPONSE_CACHE_TTL_MS })
    }
    return value
  } finally {
    clearTimeout(timeout)
  }
}

export async function handleIgdbApiRequest(requestUrl, env = process.env) {
  const url = new URL(requestUrl, 'http://localhost')
  const match = url.pathname.match(/^\/api\/igdb\/games(?:\/(\d+))?\/?$/)
  if (!match) return undefined
  return fetchIgdbGames({
    id: match[1],
    search: url.searchParams.get('search') || undefined,
    page: url.searchParams.get('page') || undefined,
    pageSize: url.searchParams.get('page_size') || undefined,
    ordering: url.searchParams.get('ordering') || undefined,
  }, env)
}
