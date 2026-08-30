const OPEN_LIBRARY_SEARCH_URL = 'https://openlibrary.org/search.json'
const WIKIDATA_QUERY_URL = 'https://query.wikidata.org/sparql'
const REQUEST_TIMEOUT_MS = 12_000
const DEFAULT_LIMIT = 100
const MAX_LIMIT = 100

function cleanAuthorId(value) {
  const id = String(value || '').replace(/^\/authors\//i, '').trim().toUpperCase()
  return /^OL\d+A$/.test(id) ? id : ''
}

function cleanWorkId(value) {
  const id = String(value || '').replace(/^\/works\//i, '').trim().toUpperCase()
  return /^OL\d+W$/.test(id) ? id : ''
}

function requestedLimit(value) {
  const numeric = Number(value)
  if (!Number.isInteger(numeric) || numeric <= 0) return DEFAULT_LIMIT
  return Math.min(numeric, MAX_LIMIT)
}

function cleanWikidataId(value) {
  const id = String(value || '').trim().toUpperCase()
  return /^Q\d+$/.test(id) ? id : ''
}

export async function fetchWikidataAuthoredWorks(wikidataId, fetchImpl = fetch) {
  const cleanId = cleanWikidataId(wikidataId)
  if (!cleanId) return []
  const query = `
    SELECT DISTINCT ?work ?workLabel ?publication ?image WHERE {
      ?work wdt:P50 wd:${cleanId}; wdt:P31/wdt:P279* ?class.
      VALUES ?class { wd:Q7725634 wd:Q47461344 }
      OPTIONAL { ?work wdt:P577 ?publication. }
      OPTIONAL { ?work wdt:P18 ?image. }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    LIMIT 250
  `
  const url = new URL(WIKIDATA_QUERY_URL)
  url.searchParams.set('format', 'json')
  url.searchParams.set('query', query)
  const response = await fetchImpl(url, {
    headers: {
      Accept: 'application/sparql-results+json',
      'User-Agent': 'TheCommonplace/1.0 (the-commonplace@example.com)',
    },
  })
  if (!response.ok) return []
  const data = await response.json()
  return (data?.results?.bindings || []).map((binding) => ({
    id: String(binding?.work?.value || '').replace(/^.*\//, ''),
    title: String(binding?.workLabel?.value || '').trim(),
    publicationDate: String(binding?.publication?.value || ''),
    imageUrl: String(binding?.image?.value || ''),
  })).filter((work) => /^Q\d+$/.test(work.id) && work.title && work.title !== work.id)
}

export async function fetchOpenLibraryAuthorWorks(
  authorName,
  authorId,
  limit = DEFAULT_LIMIT,
  fetchImpl = fetch,
  wikidataId = '',
  wikidataFetchImpl = fetch,
) {
  const cleanName = String(authorName || '').trim()
  const cleanId = cleanAuthorId(authorId)
  if (!cleanId && cleanName.length < 2) {
    const error = new Error('An Open Library author ID or author name is required.')
    error.statusCode = 400
    throw error
  }

  const url = new URL(OPEN_LIBRARY_SEARCH_URL)
  url.searchParams.set('q', cleanId ? `author_key:${cleanId}` : `author:"${cleanName}"`)
  url.searchParams.set(
    'fields',
    'key,title,subtitle,author_key,author_name,publisher,first_publish_year,cover_i,edition_count,language,subject',
  )
  url.searchParams.set('limit', String(requestedLimit(limit)))

  const timeoutController = new AbortController()
  const timeout = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetchImpl(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'TheCommonplace/1.0 (the-commonplace@example.com)',
      },
      signal: timeoutController.signal,
    })
    if (!response.ok) {
      const error = new Error(`Open Library request failed with HTTP ${response.status}.`)
      error.statusCode = response.status === 429 ? 429 : 502
      throw error
    }
    const data = await response.json()
    const canonicalWorks = await fetchWikidataAuthoredWorks(wikidataId, wikidataFetchImpl).catch(() => [])
    return {
      author: cleanName,
      authorId: cleanId,
      source: 'Open Library',
      docs: Array.isArray(data?.docs) ? data.docs : [],
      canonicalWorks,
    }
  } finally {
    clearTimeout(timeout)
  }
}

export async function fetchOpenLibraryWorkEditions(
  workId,
  limit = DEFAULT_LIMIT,
  fetchImpl = fetch,
) {
  const cleanId = cleanWorkId(workId)
  if (!cleanId) {
    const error = new Error('A valid Open Library work ID is required.')
    error.statusCode = 400
    throw error
  }

  const url = new URL(`https://openlibrary.org/works/${cleanId}/editions.json`)
  url.searchParams.set('limit', String(requestedLimit(limit)))
  const timeoutController = new AbortController()
  const timeout = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetchImpl(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'TheCommonplace/1.0 (the-commonplace@example.com)',
      },
      signal: timeoutController.signal,
    })
    if (!response.ok) {
      const error = new Error(`Open Library editions request failed with HTTP ${response.status}.`)
      error.statusCode = response.status === 429 ? 429 : 502
      throw error
    }
    const data = await response.json()
    return {
      workId: cleanId,
      source: 'Open Library',
      entries: Array.isArray(data?.entries) ? data.entries : [],
      size: Number(data?.size) || 0,
    }
  } finally {
    clearTimeout(timeout)
  }
}

export async function handleOpenLibraryApiRequest(requestUrl) {
  const url = new URL(requestUrl, 'http://localhost')
  if (/^\/api\/openlibrary\/author-works\/?$/.test(url.pathname)) {
    return fetchOpenLibraryAuthorWorks(
      url.searchParams.get('author') || '',
      url.searchParams.get('authorId') || '',
      url.searchParams.get('limit') || DEFAULT_LIMIT,
      undefined,
      url.searchParams.get('wikidataId') || '',
    )
  }
  if (/^\/api\/openlibrary\/work-editions\/?$/.test(url.pathname)) {
    return fetchOpenLibraryWorkEditions(
      url.searchParams.get('workId') || '',
      url.searchParams.get('limit') || DEFAULT_LIMIT,
    )
  }
  return undefined
}
