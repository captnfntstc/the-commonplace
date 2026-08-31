import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleFanartApiRequest } from './server/fanart.mjs'
import { handleIgdbApiRequest } from './server/igdb.mjs'
import { handleLastFmApiRequest } from './server/lastfm.mjs'
import { handleIdentityApiRequest } from './server/identities.mjs'
import { handleOpenLibraryApiRequest } from './server/openlibrary.mjs'
import { handleAuthApiRequest } from './server/auth-links.mjs'

const root = fileURLToPath(new URL('.', import.meta.url))
const distRoot = join(root, 'dist')
const port = Number(process.env.PORT) || 10000

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function sendJson(response, status, payload, cacheControl) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': cacheControl || (status === 200 ? 'private, max-age=300' : 'no-store'),
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(JSON.stringify(payload))
}

function serveFile(response, filePath) {
  response.writeHead(200, {
    'Content-Type': mimeTypes[extname(filePath).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': extname(filePath) === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
  })
  createReadStream(filePath).pipe(response)
}

createServer(async (request, response) => {
  try {
    if (request.url?.startsWith('/api/auth/')) {
      const payload = await handleAuthApiRequest(request)
      if (!payload) return sendJson(response, 404, { error: 'API route not found.' })
      return sendJson(response, 200, payload, 'no-store')
    }

    if (request.method === 'GET' && request.url?.startsWith('/api/igdb/')) {
      const payload = await handleIgdbApiRequest(request.url)
      if (!payload) return sendJson(response, 404, { error: 'API route not found.' })
      return sendJson(response, 200, payload)
    }

    if (request.method === 'GET' && request.url?.startsWith('/api/fanart/')) {
      const payload = await handleFanartApiRequest(request.url)
      if (!payload) return sendJson(response, 404, { error: 'API route not found.' })
      return sendJson(response, 200, payload)
    }

    if (request.method === 'GET' && request.url?.startsWith('/api/lastfm/')) {
      const payload = await handleLastFmApiRequest(request.url)
      if (!payload) return sendJson(response, 404, { error: 'API route not found.' })
      return sendJson(response, 200, payload)
    }

    if (request.method === 'GET' && request.url?.startsWith('/api/identities/')) {
      const payload = await handleIdentityApiRequest(request.url)
      if (!payload) return sendJson(response, 404, { error: 'API route not found.' })
      return sendJson(response, 200, payload)
    }

    if (request.method === 'GET' && request.url?.startsWith('/api/openlibrary/')) {
      const payload = await handleOpenLibraryApiRequest(request.url)
      if (!payload) return sendJson(response, 404, { error: 'API route not found.' })
      return sendJson(response, 200, payload)
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return sendJson(response, 405, { error: 'Method not allowed.' })
    }

    const requestPath = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname)
    const relativePath = normalize(requestPath).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '')
    const candidate = join(distRoot, relativePath || 'index.html')
    const safeCandidate = candidate.startsWith(distRoot) ? candidate : join(distRoot, 'index.html')
    const filePath = existsSync(safeCandidate) && statSync(safeCandidate).isFile()
      ? safeCandidate
      : join(distRoot, 'index.html')
    return serveFile(response, filePath)
  } catch (error) {
    const status = Number(error?.statusCode) || (error?.name === 'AbortError' ? 504 : 500)
    return sendJson(response, status, { error: error instanceof Error ? error.message : 'Unexpected server error.' })
  }
}).listen(port, '0.0.0.0', () => {
  console.log(`The Commonplace is listening on port ${port}`)
})
