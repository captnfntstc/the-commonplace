import { handleIgdbApiRequest } from './igdb.mjs'

export function createIgdbDevPlugin(env) {
  return {
    name: 'the-commonplace-igdb-api',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (request.method !== 'GET' || !request.url?.startsWith('/api/igdb/')) return next()
        try {
          const payload = await handleIgdbApiRequest(request.url, env)
          if (!payload) return next()
          response.statusCode = 200
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.setHeader('Cache-Control', 'private, max-age=300')
          response.end(JSON.stringify(payload))
        } catch (error) {
          response.statusCode = Number(error?.statusCode) || (error?.name === 'AbortError' ? 504 : 500)
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.setHeader('Cache-Control', 'no-store')
          response.end(JSON.stringify({
            error: error instanceof Error ? error.message : 'Unexpected IGDB proxy error.',
          }))
        }
      })
    },
  }
}
