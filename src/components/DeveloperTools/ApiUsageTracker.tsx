import React, { useEffect, useState } from 'react'
import {
  Activity,
  Trash2,
  RefreshCw,
  Search,
  Database,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  ChevronDown,
  ChevronUp,
  Play,
} from 'lucide-react'
import {
  clearApiLogs,
  getApiLogs,
  getApiStats,
  subscribeApiTracker,
  type ApiLogItem,
  type ApiProvider,
} from '../../services/apiTracker'
import {
  clearMetadataCache,
  fetchLyrics,
  type MetadataType,
  searchMetadata,
} from '../../metadata'

export const ApiUsageTracker: React.FC = () => {
  const [logs, setLogs] = useState<ApiLogItem[]>(getApiLogs)
  const [stats, setStats] = useState(getApiStats)

  const [providerFilter, setProviderFilter] = useState<ApiProvider | 'ALL'>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'HIT' | 'MISS' | 'ERROR'>('ALL')
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)

  // Interactive Tester state
  const [testType, setTestType] = useState<MetadataType | 'lyrics'>('book')
  const [testQuery, setTestQuery] = useState('')
  const [isTesting, setIsTesting] = useState(false)

  useEffect(() => {
    const unsubscribe = subscribeApiTracker(() => {
      setLogs(getApiLogs())
      setStats(getApiStats())
    })
    return unsubscribe
  }, [])

  const handleClearLogs = () => {
    clearApiLogs()
  }

  const handleClearCache = () => {
    clearMetadataCache()
    setLogs(getApiLogs())
    setStats(getApiStats())
  }

  const handleRunTest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!testQuery.trim() || isTesting) return

    setIsTesting(true)
    try {
      if (testType === 'lyrics') {
        const parts = testQuery.split('-').map((s) => s.trim())
        const artist = parts[0] || 'Radiohead'
        const song = parts[1] || testQuery
        await fetchLyrics(artist, song)
      } else {
        await searchMetadata(testType, testQuery)
      }
    } catch {
      // Errors logged via tracker internally
    } finally {
      setIsTesting(false)
    }
  }

  const filteredLogs = logs.filter((log) => {
    if (providerFilter !== 'ALL' && log.provider !== providerFilter) return false
    if (statusFilter === 'HIT' && log.cacheStatus !== 'HIT') return false
    if (statusFilter === 'MISS' && (log.cacheStatus !== 'MISS' || log.status === 'ERROR')) return false
    if (statusFilter === 'ERROR' && log.status !== 'ERROR' && (typeof log.status !== 'number' || log.status < 400)) return false
    return true
  })

  return (
    <div className="api-tracker-container">
      {/* Metrics Summary Row */}
      <div className="api-metrics-grid">
        <div className="api-metric-card">
          <div className="metric-icon total">
            <Activity aria-hidden="true" />
          </div>
          <div className="metric-content">
            <span className="metric-value">{stats.totalRequests}</span>
            <span className="metric-label">Total Calls</span>
          </div>
        </div>

        <div className="api-metric-card">
          <div className="metric-icon cache">
            <Zap aria-hidden="true" />
          </div>
          <div className="metric-content">
            <span className="metric-value">{stats.cacheHitRate}%</span>
            <span className="metric-label">{stats.cacheHits} Cache Hits</span>
          </div>
        </div>

        <div className="api-metric-card">
          <div className="metric-icon latency">
            <Clock aria-hidden="true" />
          </div>
          <div className="metric-content">
            <span className="metric-value">{stats.avgLatencyMs}<small>ms</small></span>
            <span className="metric-label">Avg Network Latency</span>
          </div>
        </div>

        <div className="api-metric-card">
          <div className={`metric-icon ${stats.errorCount > 0 ? 'error' : 'success'}`}>
            {stats.errorCount > 0 ? <XCircle aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
          </div>
          <div className="metric-content">
            <span className="metric-value">{stats.errorCount}</span>
            <span className="metric-label">Failed Requests</span>
          </div>
        </div>
      </div>

      {/* Provider Pill Badges Bar */}
      <div className="api-provider-pills">
        {Object.entries(stats.byProvider).map(([provider, count]) => (
          <button
            key={provider}
            type="button"
            className={`provider-pill ${providerFilter === provider ? 'active' : ''}`}
            onClick={() => setProviderFilter(providerFilter === provider ? 'ALL' : (provider as ApiProvider))}
          >
            <span className="pill-name">{provider}</span>
            <span className="pill-count">{count}</span>
          </button>
        ))}
      </div>

      {/* Toolbar & Filter Bar */}
      <div className="api-toolbar">
        <div className="status-filters">
          {(['ALL', 'HIT', 'MISS', 'ERROR'] as const).map((st) => (
            <button
              key={st}
              type="button"
              className={`filter-btn ${statusFilter === st ? 'active' : ''}`}
              onClick={() => setStatusFilter(st)}
            >
              {st === 'ALL' && 'All Statuses'}
              {st === 'HIT' && '⚡ Hits'}
              {st === 'MISS' && '🌐 Network'}
              {st === 'ERROR' && '❌ Errors'}
            </button>
          ))}
        </div>

        <div className="action-buttons">
          <button
            type="button"
            className="api-action-btn"
            title="Clear metadata cache"
            onClick={handleClearCache}
          >
            <Database className="btn-icon" />
            <span>Clear Cache</span>
          </button>
          <button
            type="button"
            className="api-action-btn danger"
            title="Clear request history"
            onClick={handleClearLogs}
          >
            <Trash2 className="btn-icon" />
            <span>Clear Logs</span>
          </button>
        </div>
      </div>

      {/* Interactive Quick API Tester */}
      <form className="api-quick-tester" onSubmit={handleRunTest}>
        <div className="tester-label">
          <Play className="tester-icon" />
          <span>Quick Test</span>
        </div>
        <select
          className="tester-select"
          value={testType}
          onChange={(e) => setTestType(e.target.value as any)}
        >
          <option value="book">Books (Google Books)</option>
          <option value="film">Films (TMDB)</option>
          <option value="tv">TV Shows (TMDB)</option>
          <option value="song">Songs (iTunes)</option>
          <option value="album">Albums (iTunes)</option>
          <option value="game">Games (RAWG)</option>
          <option value="lyrics">Lyrics (LRCLIB)</option>
        </select>
        <input
          type="text"
          className="tester-input"
          placeholder={testType === 'lyrics' ? 'Artist - Song title…' : 'Enter search term…'}
          value={testQuery}
          onChange={(e) => setTestQuery(e.target.value)}
        />
        <button type="submit" className="tester-btn" disabled={isTesting || !testQuery.trim()}>
          {isTesting ? <RefreshCw className="spin-icon" /> : <Search />}
          <span>Send</span>
        </button>
      </form>

      {/* Live Stream Request Log */}
      <div className="api-logs-table-wrapper">
        {filteredLogs.length === 0 ? (
          <div className="api-empty-logs">
            <Activity className="empty-icon" />
            <p>No API requests logged yet.</p>
            <span>Perform a search in the app or use Quick Test above.</span>
          </div>
        ) : (
          <div className="api-logs-list">
            {filteredLogs.map((log) => {
              const isExpanded = expandedLogId === log.id
              const isError = log.status === 'ERROR' || (typeof log.status === 'number' && log.status >= 400)
              const isCache = log.cacheStatus === 'HIT'

              return (
                <div key={log.id} className={`api-log-item ${isError ? 'has-error' : ''} ${isCache ? 'is-cache-hit' : ''}`}>
                  <div
                    className="log-item-header"
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                  >
                    <span className="log-time">{log.timestamp}</span>

                    <span className={`provider-badge provider-${log.provider.toLowerCase().replace(/\s+/g, '-')}`}>
                      {log.provider}
                    </span>

                    <span className="log-query" title={log.queryOrUrl}>
                      {log.queryOrUrl}
                    </span>

                    <div className="log-meta">
                      <span className={`status-badge ${isCache ? 'status-cache' : isError ? 'status-error' : 'status-ok'}`}>
                        {isCache ? '⚡ CACHE' : typeof log.status === 'number' ? `HTTP ${log.status}` : log.status}
                      </span>

                      <span className="latency-badge">
                        {isCache ? '0ms' : `${log.latencyMs}ms`}
                      </span>

                      <span className="count-badge">
                        {log.resultCount} {log.resultCount === 1 ? 'item' : 'items'}
                      </span>

                      <button type="button" className="expand-btn">
                        {isExpanded ? <ChevronUp /> : <ChevronDown />}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="log-item-details">
                      <div className="detail-row">
                        <span className="detail-key">Query / URL:</span>
                        <code className="detail-value">{log.queryOrUrl}</code>
                      </div>
                      <div className="detail-row">
                        <span className="detail-key">Provider:</span>
                        <span className="detail-value">{log.provider}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-key">Cache Status:</span>
                        <span className="detail-value">{log.cacheStatus}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-key">Latency:</span>
                        <span className="detail-value">{log.latencyMs} ms</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-key">Results Returned:</span>
                        <span className="detail-value">{log.resultCount}</span>
                      </div>
                      {log.error && (
                        <div className="detail-row error-row">
                          <span className="detail-key">Error Message:</span>
                          <span className="detail-value error-text">{log.error}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
