import { fetchMusicBrainz } from './musicbrainz.mjs'

const WIKIDATA_API_URL = 'https://www.wikidata.org/w/api.php'
const WIKIDATA_QUERY_URL = 'https://query.wikidata.org/sparql'
const MUSICBRAINZ_API_URL = 'https://musicbrainz.org/ws/2/artist'
const TMDB_API_URL = 'https://api.themoviedb.org/3'
const OPEN_LIBRARY_URL = 'https://openlibrary.org'
const SEARCH_TTL_MS = 15 * 60 * 1000
const IDENTITY_TTL_MS = 7 * 24 * 60 * 60 * 1000
const DEFAULT_LIMIT = 10
const MAX_LIMIT = 20

const searchCache = new Map()
const identityCache = new Map()

const roleRules = [
  ['voice_actor', /\bvoice act(?:or|ress|ing)\b/i],
  ['music_producer', /\b(?:music|record) producer\b/i],
  ['screenwriter', /\b(?:screenwriter|screenplay)\b/i],
  ['showrunner', /\b(?:showrunner|television creator|series creator)\b/i],
  ['singer_songwriter', /\bsinger[ -]songwriter\b/i],
  ['songwriter', /\b(?:songwriter|singer-songwriter)\b/i],
  ['singer', /\b(?:singer|vocalist|singer-songwriter)\b/i],
  ['rapper', /\brapper\b/i],
  ['composer', /\bcomposer\b/i],
  ['musician', /\b(?:musician|musical artist|instrumentalist)\b/i],
  ['actor', /\b(?:actor|actress|acting)\b/i],
  ['comedian', /\b(?:comedian|comedy)\b/i],
  ['director', /\b(?:director|filmmaker)\b/i],
  ['producer', /\b(?:producer|production)\b/i],
  ['novelist', /\bnovelist\b/i],
  ['poet', /\bpoet\b/i],
  ['author', /\b(?:author|writer|literature)\b/i],
]

function uniqueStrings(values) {
  return [...new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean))]
}

export function normalizeIdentityRoles(values) {
  const textValues = uniqueStrings(values)
  const roles = []
  for (const value of textValues) {
    for (const [role, pattern] of roleRules) {
      if (pattern.test(value) && !roles.includes(role)) roles.push(role)
    }
  }
  return roles
}

function requestedLimit(value) {
  const number = Number(value)
  if (!Number.isInteger(number) || number < 1) return DEFAULT_LIMIT
  return Math.min(number, MAX_LIMIT)
}

function cachedValue(cache, key) {
  const item = cache.get(key)
  if (!item) return undefined
  if (item.expiresAt <= Date.now()) {
    cache.delete(key)
    return undefined
  }
  return item.value
}

function setCachedValue(cache, key, value, ttl) {
  cache.set(key, { value, expiresAt: Date.now() + ttl })
  if (cache.size > 250) cache.delete(cache.keys().next().value)
}

export function clearIdentityCaches() {
  searchCache.clear()
  identityCache.clear()
}

async function fetchJson(url, options = {}) {
  const response = await (options.fetchImpl || fetch)(url, {
    headers: options.headers || { Accept: 'application/json' },
    signal: options.signal,
  })
  if (!response.ok) {
    const error = new Error(`Identity provider request failed with HTTP ${response.status}.`)
    error.statusCode = response.status === 429 ? 429 : 502
    throw error
  }
  return response.json()
}

function claimValues(entity, property) {
  return (entity?.claims?.[property] || []).map((claim) => claim?.mainsnak?.datavalue?.value).filter(Boolean)
}

function claimEntityIds(entity, property) {
  return claimValues(entity, property).map((value) => value?.id).filter(Boolean)
}

function firstStringClaim(entity, property) {
  const value = claimValues(entity, property)[0]
  return typeof value === 'string' ? value : ''
}

function wikimediaImageUrl(filename) {
  return filename
    ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=800`
    : ''
}

export function formatIdentityBirthday(value) {
  const match = String(value || '').match(/[+-]?(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return String(value || '').match(/\b(?:18|19|20)\d{2}\b/)?.[0] || ''
  const [, year, month, day] = match
  if (month === '00' || day === '00') return year
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  if (Number.isNaN(date.getTime())) return year
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function wikidataKind(entity) {
  const instances = new Set(claimEntityIds(entity, 'P31'))
  if (instances.has('Q5')) return 'human'
  const groupTypes = ['Q2088357', 'Q215380', 'Q16334295', 'Q216337']
  if (groupTypes.some((id) => instances.has(id))) return 'music_group'
  return undefined
}

function canonicalIdentityId(kind, providerIds) {
  if (providerIds.wikidataId) {
    return kind === 'music_group'
      ? `music-group:${providerIds.wikidataId.toUpperCase()}`
      : `human:${providerIds.wikidataId.toUpperCase()}`
  }
  if (kind === 'music_group' && providerIds.musicBrainzId) return `music-group:musicbrainz:${providerIds.musicBrainzId}`
  if (providerIds.tmdbPersonId) return `human:tmdb:${providerIds.tmdbPersonId}`
  if (providerIds.musicBrainzId) return `human:musicbrainz:${providerIds.musicBrainzId}`
  if (providerIds.openLibraryAuthorId) return `human:openlibrary:${providerIds.openLibraryAuthorId}`
  if (providerIds.itunesArtistId) return `human:itunes:${providerIds.itunesArtistId}`
  return ''
}

function identityKeys(candidate) {
  const keys = new Set([candidate.canonicalId].filter(Boolean))
  for (const [provider, id] of Object.entries(candidate.providerIds || {})) {
    if (id) keys.add(`${provider}:${String(id).toLowerCase()}`)
  }
  return keys
}

function mergeCandidate(left, right) {
  const providerIds = { ...(left.providerIds || {}) }
  for (const [provider, id] of Object.entries(right.providerIds || {})) {
    if (!providerIds[provider] && id) providerIds[provider] = id
  }
  const kind = left.kind === right.kind ? left.kind : (left.kind || right.kind)
  const professions = uniqueStrings([...(left.professions || []), ...(right.professions || [])])
  const canonicalId = providerIds.wikidataId
    ? canonicalIdentityId(kind, providerIds)
    : left.canonicalId || right.canonicalId
  return {
    ...right,
    ...left,
    canonicalId,
    kind,
    name: left.name || right.name,
    description: left.description || right.description,
    portraitUrl: left.portraitUrl || right.portraitUrl,
    birthday: left.birthday || right.birthday,
    primaryProfession: left.primaryProfession || right.primaryProfession || professions[0],
    professions,
    occupationLabels: uniqueStrings([...(left.occupationLabels || []), ...(right.occupationLabels || [])]),
    knownFor: uniqueStrings([...(left.knownFor || []), ...(right.knownFor || [])]).slice(0, 4),
    popularity: {
      ...(right.popularity || {}),
      ...(left.popularity || {}),
    },
    providerIds,
  }
}

export function mergeIdentityCandidates(candidates, limit = DEFAULT_LIMIT) {
  const merged = []
  for (const candidate of candidates || []) {
    if (!candidate?.canonicalId || !candidate?.kind || !candidate?.name) continue
    const candidateKeys = identityKeys(candidate)
    const existingIndex = merged.findIndex((item) => {
      const existingKeys = identityKeys(item)
      return [...candidateKeys].some((key) => existingKeys.has(key))
    })
    if (existingIndex < 0) merged.push(candidate)
    else merged[existingIndex] = mergeCandidate(merged[existingIndex], candidate)
  }
  return merged.slice(0, requestedLimit(limit))
}

async function wikidataEntities(ids, env, fetchImpl, signal) {
  const cleanIds = uniqueStrings(ids).filter((id) => /^Q\d+$/i.test(id)).map((id) => id.toUpperCase())
  if (cleanIds.length === 0) return {}
  const url = new URL(WIKIDATA_API_URL)
  url.searchParams.set('action', 'wbgetentities')
  url.searchParams.set('ids', cleanIds.join('|'))
  url.searchParams.set('props', 'labels|descriptions|claims|sitelinks')
  url.searchParams.set('languages', 'en')
  url.searchParams.set('format', 'json')
  const data = await fetchJson(url, {
    fetchImpl,
    signal,
    headers: {
      Accept: 'application/json',
      'User-Agent': `TheCommonplace/1.0 (${env.APP_CONTACT || env.VITE_APP_CONTACT || 'the-commonplace@example.com'})`,
    },
  })
  return data.entities || {}
}

async function wikidataCandidates(ids, env, fetchImpl, signal) {
  const entities = await wikidataEntities(ids, env, fetchImpl, signal)
  const relatedIds = uniqueStrings(Object.values(entities).flatMap((entity) => [
    ...claimEntityIds(entity, 'P106'),
    ...claimEntityIds(entity, 'P27'),
  ]))
  const related = await wikidataEntities(relatedIds, env, fetchImpl, signal)

  return Object.values(entities).map((entity) => {
    const kind = wikidataKind(entity)
    if (!kind) return undefined
    const occupationLabels = claimEntityIds(entity, 'P106')
      .map((id) => related[id]?.labels?.en?.value)
      .filter(Boolean)
    const description = entity.descriptions?.en?.value || ''
    const professions = normalizeIdentityRoles([...occupationLabels, description])
    if (kind === 'music_group' && professions.length === 0) professions.push('musician')
    const wikidataId = entity.id
    const providerIds = {
      wikidataId,
      musicBrainzId: firstStringClaim(entity, 'P434') || undefined,
      itunesArtistId: firstStringClaim(entity, 'P2850') || undefined,
      tmdbPersonId: firstStringClaim(entity, 'P4985') || undefined,
      openLibraryAuthorId: firstStringClaim(entity, 'P648') || undefined,
    }
    if ((providerIds.musicBrainzId || providerIds.itunesArtistId) && professions.length === 0) {
      professions.push('musician')
    }
    const birth = claimValues(entity, 'P569')[0]?.time || ''
    const countryId = claimEntityIds(entity, 'P27')[0]
    const wikipediaTitle = entity.sitelinks?.enwiki?.title || ''
    return {
      canonicalId: canonicalIdentityId(kind, providerIds),
      kind,
      name: entity.labels?.en?.value || wikipediaTitle,
      primaryProfession: professions[0],
      professions,
      occupationLabels,
      description,
      portraitUrl: wikimediaImageUrl(firstStringClaim(entity, 'P18')),
      birthday: formatIdentityBirthday(birth),
      birthYear: birth.match(/[+-](\d{4})/)?.[1] || '',
      country: countryId ? related[countryId]?.labels?.en?.value || '' : '',
      popularity: { wikidataSitelinks: Object.keys(entity.sitelinks || {}).length },
      knownFor: [],
      providerIds,
      wikipediaTitle,
    }
  }).filter(Boolean)
}

async function searchWikidata(query, limit, env, fetchImpl, signal) {
  const url = new URL(WIKIDATA_API_URL)
  url.searchParams.set('action', 'wbsearchentities')
  url.searchParams.set('search', query)
  url.searchParams.set('language', 'en')
  url.searchParams.set('uselang', 'en')
  url.searchParams.set('type', 'item')
  url.searchParams.set('limit', String(Math.min(limit * 2, 25)))
  url.searchParams.set('format', 'json')
  const data = await fetchJson(url, { fetchImpl, signal })
  return wikidataCandidates((data.search || []).map((item) => item.id), env, fetchImpl, signal)
}

function tmdbHeaders(env) {
  const token = String(env.TMDB_ACCESS_TOKEN || env.VITE_TMDB_ACCESS_TOKEN || '').trim()
  if (!token) return undefined
  return { Authorization: `Bearer ${token}`, Accept: 'application/json' }
}

function tmdbRoles(person, credits = {}) {
  const evidence = [person.known_for_department]
  for (const credit of credits.cast || []) evidence.push('acting')
  for (const credit of credits.crew || []) evidence.push(credit.job, credit.department)
  return normalizeIdentityRoles(evidence)
}

async function searchTmdbPeople(query, limit, env, fetchImpl, signal) {
  const headers = tmdbHeaders(env)
  if (!headers) return []
  const url = new URL(`${TMDB_API_URL}/search/person`)
  url.searchParams.set('query', query)
  url.searchParams.set('include_adult', 'false')
  url.searchParams.set('language', 'en-US')
  url.searchParams.set('page', '1')
  const data = await fetchJson(url, { fetchImpl, signal, headers })
  const people = (data.results || []).slice(0, Math.min(limit, 6))
  return Promise.all(people.map(async (person) => {
    let externalIds = {}
    try {
      externalIds = await fetchJson(`${TMDB_API_URL}/person/${person.id}/external_ids`, { fetchImpl, signal, headers })
    } catch {
      // A TMDB-scoped identity is still safe when external IDs are unavailable.
    }
    const wikidataId = /^Q\d+$/i.test(externalIds.wikidata_id || '') ? externalIds.wikidata_id.toUpperCase() : undefined
    const providerIds = { tmdbPersonId: String(person.id), wikidataId }
    const professions = tmdbRoles(person)
    return {
      canonicalId: canonicalIdentityId('human', providerIds),
      kind: 'human',
      name: person.name || '',
      primaryProfession: professions[0],
      professions,
      occupationLabels: uniqueStrings([person.known_for_department]),
      description: person.known_for_department || '',
      portraitUrl: person.profile_path ? `https://image.tmdb.org/t/p/w500${person.profile_path}` : '',
      birthYear: '',
      country: '',
      popularity: { tmdb: Number(person.popularity || 0) },
      knownFor: (person.known_for || []).map((item) => item.title || item.name).filter(Boolean).slice(0, 4),
      providerIds,
    }
  }))
}

async function searchMusicBrainz(query, limit, env, fetchImpl, signal) {
  const url = new URL(MUSICBRAINZ_API_URL)
  url.searchParams.set('query', `artist:"${String(query).replace(/["\\]/g, '\\$&')}"`)
  url.searchParams.set('fmt', 'json')
  url.searchParams.set('limit', String(Math.min(limit, 10)))
  const response = await fetchMusicBrainz(url, { env, fetchImpl, signal })
  if (!response.ok) return []
  const data = await response.json()
  return (data.artists || []).filter((artist) => artist.type === 'Person' || artist.type === 'Group').map((artist) => {
    const kind = artist.type === 'Group' ? 'music_group' : 'human'
    const providerIds = { musicBrainzId: artist.id }
    return {
      canonicalId: canonicalIdentityId(kind, providerIds),
      kind,
      name: artist.name || '',
      primaryProfession: 'musician',
      professions: ['musician'],
      occupationLabels: [artist.type === 'Group' ? 'Musical Group' : 'Musician'],
      description: [artist.type, artist.area?.name || artist.country].filter(Boolean).join(' from '),
      portraitUrl: '',
      birthYear: artist['life-span']?.begin?.match(/\d{4}/)?.[0] || '',
      country: artist.area?.name || artist.country || '',
      knownFor: (artist.genres || artist.tags || []).map((item) => item.name).filter(Boolean).slice(0, 4),
      providerIds,
    }
  })
}

async function resolveWikidata(id, env, fetchImpl, signal) {
  const candidates = await wikidataCandidates([id], env, fetchImpl, signal)
  return candidates[0]
}

async function resolveTmdb(id, env, fetchImpl, signal) {
  if (!/^\d+$/.test(id)) return undefined
  const headers = tmdbHeaders(env)
  if (!headers) {
    const error = new Error('TMDB identity resolution is not configured.')
    error.statusCode = 503
    throw error
  }
  const url = new URL(`${TMDB_API_URL}/person/${id}`)
  url.searchParams.set('append_to_response', 'external_ids,combined_credits')
  url.searchParams.set('language', 'en-US')
  const person = await fetchJson(url, { fetchImpl, signal, headers })
  const wikidataId = /^Q\d+$/i.test(person.external_ids?.wikidata_id || '')
    ? person.external_ids.wikidata_id.toUpperCase()
    : undefined
  const professions = tmdbRoles(person, person.combined_credits)
  const providerIds = { tmdbPersonId: String(person.id || id), wikidataId }
  const tmdbCandidate = {
    canonicalId: canonicalIdentityId('human', providerIds),
    kind: 'human',
    name: person.name || '',
    primaryProfession: professions[0],
    professions,
    occupationLabels: uniqueStrings([person.known_for_department]),
    description: person.biography || person.known_for_department || '',
    portraitUrl: person.profile_path ? `https://image.tmdb.org/t/p/w500${person.profile_path}` : '',
    birthday: formatIdentityBirthday(person.birthday),
    birthYear: String(person.birthday || '').match(/\d{4}/)?.[0] || '',
    country: person.place_of_birth || '',
    popularity: { tmdb: Number(person.popularity || 0) },
    knownFor: [],
    providerIds,
  }
  if (!wikidataId) return tmdbCandidate
  const wikidataCandidate = await resolveWikidata(wikidataId, env, fetchImpl, signal).catch(() => undefined)
  return wikidataCandidate ? mergeCandidate(wikidataCandidate, tmdbCandidate) : tmdbCandidate
}

async function resolveMusicBrainz(id, env, fetchImpl, signal) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined
  const url = new URL(`${MUSICBRAINZ_API_URL}/${encodeURIComponent(id)}`)
  url.searchParams.set('inc', 'url-rels+genres+tags')
  url.searchParams.set('fmt', 'json')
  const response = await fetchMusicBrainz(url, { env, fetchImpl, signal })
  if (!response.ok) return undefined
  const artist = await response.json()
  if (artist.type !== 'Person' && artist.type !== 'Group') return undefined
  const kind = artist.type === 'Group' ? 'music_group' : 'human'
  const wikidataId = (artist.relations || []).map((relation) => relation.url?.resource || '')
    .map((resource) => resource.match(/wikidata\.org\/wiki\/(Q\d+)/i)?.[1])
    .find(Boolean)?.toUpperCase()
  const itunesArtistId = (artist.relations || []).map((relation) => relation.url?.resource || '')
    .map((resource) => resource.match(/music\.apple\.com\/(?:[^/]+\/)?artist\/(?:[^/]+\/)?(\d+)/i)?.[1])
    .find(Boolean)
  const providerIds = { musicBrainzId: artist.id || id, wikidataId, itunesArtistId }
  const mbCandidate = {
    canonicalId: canonicalIdentityId(kind, providerIds),
    kind,
    name: artist.name || '',
    primaryProfession: 'musician',
    professions: ['musician'],
    occupationLabels: [artist.type === 'Group' ? 'Musical Group' : 'Musician'],
    description: [artist.type, artist.area?.name || artist.country].filter(Boolean).join(' from '),
    portraitUrl: '',
    birthday: formatIdentityBirthday(artist['life-span']?.begin),
    birthYear: artist['life-span']?.begin?.match(/\d{4}/)?.[0] || '',
    country: artist.area?.name || artist.country || '',
    knownFor: (artist.genres || artist.tags || []).map((item) => item.name).filter(Boolean).slice(0, 4),
    providerIds,
  }
  if (!wikidataId) return mbCandidate
  const wikidataCandidate = await resolveWikidata(wikidataId, env, fetchImpl, signal).catch(() => undefined)
  return wikidataCandidate ? mergeCandidate(wikidataCandidate, mbCandidate) : mbCandidate
}

async function resolveItunes(id, env, fetchImpl, signal) {
  if (!/^\d+$/.test(id)) return undefined
  const query = `SELECT ?item WHERE { ?item wdt:P2850 "${id}". } LIMIT 2`
  const url = new URL(WIKIDATA_QUERY_URL)
  url.searchParams.set('query', query)
  url.searchParams.set('format', 'json')
  const data = await fetchJson(url, {
    fetchImpl,
    signal,
    headers: {
      Accept: 'application/sparql-results+json',
      'User-Agent': `TheCommonplace/1.0 (${env.APP_CONTACT || env.VITE_APP_CONTACT || 'the-commonplace@example.com'})`,
    },
  })
  const ids = uniqueStrings((data.results?.bindings || []).map((binding) => binding.item?.value?.match(/(Q\d+)$/)?.[1]))
  if (ids.length === 1) {
    const candidate = await resolveWikidata(ids[0], env, fetchImpl, signal)
    if (candidate) {
      candidate.providerIds.itunesArtistId = id
      if (candidate.professions.length === 0 && !candidate.professions.includes('musician')) {
        candidate.professions.push('musician')
        candidate.occupationLabels = uniqueStrings([...candidate.occupationLabels, 'Musician'])
      }
      return candidate
    }
  }

  const lookupUrl = new URL('https://itunes.apple.com/lookup')
  lookupUrl.searchParams.set('id', id)
  lookupUrl.searchParams.set('entity', 'musicArtist')
  const lookup = await fetchJson(lookupUrl, { fetchImpl, signal })
  const artist = (lookup.results || []).find((item) => item.wrapperType === 'artist' && String(item.artistId) === id)
  if (!artist?.artistName) return undefined
  const providerIds = { itunesArtistId: id }
  return {
    canonicalId: canonicalIdentityId('human', providerIds),
    kind: 'human',
    name: artist.artistName,
    primaryProfession: 'musician',
    professions: ['musician'],
    occupationLabels: ['Musician'],
    description: artist.primaryGenreName || 'Music artist',
    portraitUrl: '',
    birthYear: '',
    country: artist.country || '',
    knownFor: [artist.primaryGenreName].filter(Boolean),
    providerIds,
  }
}

async function resolveOpenLibrary(id, env, fetchImpl, signal) {
  const cleanId = id.replace(/^\/authors\//, '')
  if (!/^OL\d+A$/i.test(cleanId)) return undefined
  const author = await fetchJson(`${OPEN_LIBRARY_URL}/authors/${encodeURIComponent(cleanId)}.json`, { fetchImpl, signal })
  const wikidataId = /^Q\d+$/i.test(author.remote_ids?.wikidata || '') ? author.remote_ids.wikidata.toUpperCase() : undefined
  const providerIds = { openLibraryAuthorId: cleanId.toUpperCase(), wikidataId }
  const openLibraryCandidate = {
    canonicalId: canonicalIdentityId('human', providerIds),
    kind: 'human',
    name: author.name || '',
    primaryProfession: 'author',
    professions: normalizeIdentityRoles(['author', author.bio?.value || author.bio || '']),
    occupationLabels: ['Author'],
    description: author.bio?.value || author.bio || '',
    portraitUrl: author.photos?.[0] ? `https://covers.openlibrary.org/a/id/${author.photos[0]}-L.jpg` : '',
    birthday: formatIdentityBirthday(author.birth_date),
    birthYear: String(author.birth_date || '').match(/\d{4}/)?.[0] || '',
    country: '',
    knownFor: [],
    providerIds,
  }
  if (!wikidataId) return openLibraryCandidate
  const wikidataCandidate = await resolveWikidata(wikidataId, env, fetchImpl, signal).catch(() => undefined)
  return wikidataCandidate ? mergeCandidate(wikidataCandidate, openLibraryCandidate) : openLibraryCandidate
}

export async function searchIdentities(query, limit = DEFAULT_LIMIT, env = process.env, fetchImpl = fetch, signal) {
  const cleanQuery = String(query || '').trim()
  if (cleanQuery.length < 2) return { query: cleanQuery, candidates: [], sources: [] }
  const safeLimit = requestedLimit(limit)
  const cacheKey = `${cleanQuery.toLowerCase()}:${safeLimit}`
  if (fetchImpl === fetch) {
    const cached = cachedValue(searchCache, cacheKey)
    if (cached) return { ...cached, cacheStatus: 'HIT' }
  }

  const requests = [
    ['Wikidata', searchWikidata(cleanQuery, safeLimit, env, fetchImpl, signal)],
    ['TMDB', searchTmdbPeople(cleanQuery, safeLimit, env, fetchImpl, signal)],
    ['MusicBrainz', searchMusicBrainz(cleanQuery, safeLimit, env, fetchImpl, signal)],
  ]
  const settled = await Promise.all(requests.map(async ([source, request]) => {
    try {
      return { source, candidates: await request }
    } catch {
      return { source, candidates: [] }
    }
  }))
  const result = {
    query: cleanQuery,
    candidates: mergeIdentityCandidates(settled.flatMap((item) => item.candidates), safeLimit),
    sources: settled.filter((item) => item.candidates.length > 0).map((item) => item.source),
    cacheStatus: 'MISS',
  }
  if (fetchImpl === fetch) setCachedValue(searchCache, cacheKey, result, SEARCH_TTL_MS)
  return result
}

export async function resolveIdentity(provider, id, env = process.env, fetchImpl = fetch, signal) {
  const cleanProvider = String(provider || '').trim().toLowerCase()
  const cleanId = String(id || '').trim()
  const cacheKey = `${cleanProvider}:${cleanId.toLowerCase()}`
  if (fetchImpl === fetch) {
    const cached = cachedValue(identityCache, cacheKey)
    if (cached) return { identity: cached, cacheStatus: 'HIT' }
  }

  let identity
  if (cleanProvider === 'wikidata') identity = await resolveWikidata(cleanId, env, fetchImpl, signal)
  else if (cleanProvider === 'tmdb') identity = await resolveTmdb(cleanId, env, fetchImpl, signal)
  else if (cleanProvider === 'musicbrainz') identity = await resolveMusicBrainz(cleanId, env, fetchImpl, signal)
  else if (cleanProvider === 'itunes') identity = await resolveItunes(cleanId, env, fetchImpl, signal)
  else if (cleanProvider === 'openlibrary') identity = await resolveOpenLibrary(cleanId, env, fetchImpl, signal)
  else {
    const error = new Error('Unsupported identity provider.')
    error.statusCode = 400
    throw error
  }
  if (!identity) {
    const error = new Error('A verified identity could not be resolved.')
    error.statusCode = 404
    throw error
  }
  if (fetchImpl === fetch) setCachedValue(identityCache, cacheKey, identity, IDENTITY_TTL_MS)
  return { identity, cacheStatus: 'MISS' }
}

export async function handleIdentityApiRequest(requestUrl, env = process.env) {
  const url = new URL(requestUrl, 'http://localhost')
  if (/^\/api\/identities\/search\/?$/.test(url.pathname)) {
    return searchIdentities(url.searchParams.get('q') || '', url.searchParams.get('limit') || DEFAULT_LIMIT, env)
  }
  if (/^\/api\/identities\/resolve\/?$/.test(url.pathname)) {
    return resolveIdentity(url.searchParams.get('provider') || '', url.searchParams.get('id') || '', env)
  }
  return undefined
}
