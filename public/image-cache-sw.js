const IMAGE_CACHE = 'the-commonplace-images-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('the-commonplace-images-') && key !== IMAGE_CACHE)
            .map((key) => caches.delete(key)),
        ),
      ),
    ]),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || request.destination !== 'image') return

  event.respondWith(
    caches.open(IMAGE_CACHE).then(async (cache) => {
      const cached = await cache.match(request, { ignoreVary: true })
      if (cached) return cached

      try {
        const response = await fetch(request)
        if (response.ok || response.type === 'opaque') {
          void cache.put(request, response.clone()).then(async () => {
            const keys = await cache.keys()
            if (keys.length > 250) {
              await Promise.all(keys.slice(0, keys.length - 250).map((key) => cache.delete(key)))
            }
          }).catch(() => {})
        }
        return response
      } catch (error) {
        const fallback = await cache.match(request.url)
        if (fallback) return fallback
        throw error
      }
    }),
  )
})
