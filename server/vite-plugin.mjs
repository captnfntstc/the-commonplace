import { handleFanartApiRequest } from './fanart.mjs'
import { handleIgdbApiRequest } from './igdb.mjs'
import { handleLastFmApiRequest } from './lastfm.mjs'

export function createIgdbDevPlugin(env) {
  return {
    name: 'the-commonplace-igdb-api',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const isIgdbRequest = request.url?.startsWith('/api/igdb/')
        const isFanartRequest = request.url?.startsWith('/api/fanart/')
        const isLastFmRequest = request.url?.startsWith('/api/lastfm/')
        if (request.method !== 'GET' || (!isIgdbRequest && !isFanartRequest && !isLastFmRequest)) return next()
        try {
          const payload = isFanartRequest
            ? await handleFanartApiRequest(request.url, env)
            : isLastFmRequest
              ? await handleLastFmApiRequest(request.url, env)
              : await handleIgdbApiRequest(request.url, env)
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
            error: error instanceof Error ? error.message : 'Unexpected API proxy error.',
          }))
        }
      })
    },
  }
}
