export type ApiProvider =
  | 'Google Books'
  | 'TMDB'
  | 'iTunes'
  | 'MusicBrainz'
  | 'LRCLIB'
  | 'IGDB'
  | 'Steam Store'
  | 'Wikipedia'

export type CacheStatus = 'HIT' | 'MISS'

export type ApiLogItem = {
  id: string
  timestamp: string
  provider: ApiProvider
  queryOrUrl: string
  status: number | 'CACHE' | 'ERROR'
  latencyMs: number
  resultCount: number
  cacheStatus: CacheStatus
  error?: string
}

export type ApiTrackerStats = {
  totalRequests: number
  cacheHits: number
  cacheMisses: number
  cacheHitRate: number
  avgLatencyMs: number
  errorCount: number
  byProvider: Record<ApiProvider, number>
}

export const ALL_PROVIDERS: ApiProvider[] = [
  'Google Books',
  'TMDB',
  'iTunes',
  'MusicBrainz',
  'LRCLIB',
  'IGDB',
  'Steam Store',
  'Wikipedia',
]

const MAX_LOGS = 100

let logs: ApiLogItem[] = []
const listeners = new Set<() => void>()

function notifyListeners() {
  listeners.forEach((listener) => listener())
}

export function subscribeApiTracker(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function logApiCall(
  entry: Omit<ApiLogItem, 'id' | 'timestamp'>
): ApiLogItem {
  const item: ApiLogItem = {
    ...entry,
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
  }

  logs = [item, ...logs.slice(0, MAX_LOGS - 1)]
  notifyListeners()
  return item
}

export function getApiLogs(): ApiLogItem[] {
  return logs
}

export function clearApiLogs(): void {
  logs = []
  notifyListeners()
}

export function getApiStats(): ApiTrackerStats {
  const total = logs.length
  let cacheHits = 0
  let cacheMisses = 0
  let totalLatency = 0
  let errorCount = 0

  const byProvider: Record<ApiProvider, number> = {
    'Google Books': 0,
    TMDB: 0,
    iTunes: 0,
    MusicBrainz: 0,
    LRCLIB: 0,
    IGDB: 0,
    'Steam Store': 0,
    Wikipedia: 0,
  }

  logs.forEach((log) => {
    if (log.cacheStatus === 'HIT') {
      cacheHits++
    } else {
      cacheMisses++
      totalLatency += log.latencyMs
    }

    if (log.status === 'ERROR' || (typeof log.status === 'number' && log.status >= 400)) {
      errorCount++
    }

    if (byProvider[log.provider] !== undefined) {
      byProvider[log.provider]++
    }
  })

  const cacheHitRate = total > 0 ? Math.round((cacheHits / total) * 1000) / 10 : 0
  const avgLatencyMs = cacheMisses > 0 ? Math.round(totalLatency / cacheMisses) : 0

  return {
    totalRequests: total,
    cacheHits,
    cacheMisses,
    cacheHitRate,
    avgLatencyMs,
    errorCount,
    byProvider,
  }
}
