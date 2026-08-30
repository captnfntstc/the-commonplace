const DEFAULT_MIN_INTERVAL_MS = 1_050

let requestQueue = Promise.resolve()
let lastRequestAt = 0

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

export function musicBrainzHeaders(env = process.env) {
  return {
    Accept: 'application/json',
    'User-Agent': `TheCommonplace/1.0 (${env.APP_CONTACT || env.VITE_APP_CONTACT || 'the-commonplace@example.com'})`,
  }
}

export function fetchMusicBrainz(url, options = {}) {
  const {
    env = process.env,
    fetchImpl = fetch,
    signal,
  } = options

  // Injected fetch functions are deterministic test doubles and do not share
  // MusicBrainz's production rate limit.
  if (fetchImpl !== fetch) {
    return fetchImpl(url, { headers: musicBrainzHeaders(env), signal })
  }

  const interval = Number(env.MUSICBRAINZ_MIN_INTERVAL_MS || DEFAULT_MIN_INTERVAL_MS)
  const request = requestQueue.then(async () => {
    const remaining = Math.max(0, lastRequestAt + interval - Date.now())
    if (remaining > 0) await wait(remaining)
    signal?.throwIfAborted()
    lastRequestAt = Date.now()
    return fetchImpl(url, { headers: musicBrainzHeaders(env), signal })
  })
  requestQueue = request.catch(() => undefined)
  return request
}
