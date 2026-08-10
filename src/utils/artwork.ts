const PROXIED_IMAGE_HOSTS = [
  /^is\d+-ssl\.mzstatic\.com$/i,
  /^upload\.wikimedia\.org$/i,
  /^image\.tmdb\.org$/i,
  /^media\.rawg\.io$/i,
]

const DEV_IMAGE_PROXY_HOSTS: Array<{ pattern: RegExp; prefix: string }> = [
  { pattern: /^cdn\.cloudflare\.steamstatic\.com$/i, prefix: '/steam-images' },
  { pattern: /^www\.ireddead\.com$/i, prefix: '/ireddead-images' },
  { pattern: /^image\.api\.playstation\.com$/i, prefix: '/playstation-store-images' },
  { pattern: /^gmedia\.playstation\.com$/i, prefix: '/playstation-media-images' },
  { pattern: /^media\.valorant-api\.com$/i, prefix: '/valorant-images' },
  { pattern: /^ddragon\.leagueoflegends\.com$/i, prefix: '/league-images' },
  { pattern: /^media\.rawg\.io$/i, prefix: '/rawg-images' },
]

export function isBlockedArtworkUrl(url?: string | null) {
  if (!url || url.startsWith('data:') || url.startsWith('/')) return false

  try {
    const parsed = new URL(url)
    return PROXIED_IMAGE_HOSTS.some((pattern) => pattern.test(parsed.hostname))
  } catch {
    return false
  }
}

function placeholderIcon(label: string) {
  const normalized = label.toLowerCase()
  if (/(song|track|music|single)/.test(normalized)) {
    return `
      <path d="M9 18V5l10-2v13"/>
      <circle cx="6" cy="18" r="3"/>
      <circle cx="16" cy="16" r="3"/>
    `
  }
  if (/(album|ep|disc|record)/.test(normalized)) {
    return `
      <circle cx="12" cy="12" r="8.5"/>
      <circle cx="12" cy="12" r="2.3"/>
      <path d="M12 3.5v3"/>
    `
  }
  if (/(film|movie|director|actor)/.test(normalized)) {
    return `
      <rect x="4" y="4" width="16" height="16" rx="2"/>
      <path d="M8 4v16M16 4v16M4 8h4M4 16h4M16 8h4M16 16h4"/>
    `
  }
  if (/(tv|show|series)/.test(normalized)) {
    return `
      <rect x="4" y="5" width="16" height="12" rx="2"/>
      <path d="M9 21h6M12 17v4"/>
    `
  }
  if (/(game|studio)/.test(normalized)) {
    return `
      <path d="M7 15h-.6A3.4 3.4 0 0 1 3 11.6v-.2A3.4 3.4 0 0 1 6.4 8h11.2A3.4 3.4 0 0 1 21 11.4v.2a3.4 3.4 0 0 1-3.4 3.4H17l-2-2H9l-2 2z"/>
      <path d="M8 10v4M6 12h4M16 11h.01M18 13h.01"/>
    `
  }
  if (/(artist|author|user|person|people)/.test(normalized)) {
    return `
      <circle cx="12" cy="8" r="3.5"/>
      <path d="M5 20a7 7 0 0 1 14 0"/>
    `
  }
  return `
    <path d="M6 4h8l4 4v12H6z"/>
    <path d="M14 4v4h4"/>
  `
}

export function createArtworkPlaceholder(title = 'Artwork', label = 'Album') {
  const cleanLabel = label.trim() || 'Album'
  void title
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <rect width="800" height="800" fill="#100d09"/>
  <svg x="300" y="300" width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="#d6ae73" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round">
    ${placeholderIcon(cleanLabel)}
  </svg>
</svg>`.trim()

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

export function resolveArtworkUrl(url?: string | null, _title?: string, _label?: string) {
  if (!url) return ''

  if (import.meta.env.DEV && !url.startsWith('data:') && !url.startsWith('/')) {
    try {
      const parsed = new URL(url)
      const proxy = DEV_IMAGE_PROXY_HOSTS.find((host) => host.pattern.test(parsed.hostname))
      if (proxy) return `${proxy.prefix}${parsed.pathname}${parsed.search}`
    } catch {
      return url
    }
  }

  return url
}
