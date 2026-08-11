const PROXIED_IMAGE_HOSTS = [
  /^is\d+-ssl\.mzstatic\.com$/i,
  /^upload\.wikimedia\.org$/i,
  /^image\.tmdb\.org$/i,
  /^media\.rawg\.io$/i,
]

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function hashText(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 360
  }
  return hash
}

export function isBlockedArtworkUrl(url?: string | null) {
  if (!url || url.startsWith('data:') || url.startsWith('/')) return false

  try {
    const parsed = new URL(url)
    return PROXIED_IMAGE_HOSTS.some((pattern) => pattern.test(parsed.hostname))
  } catch {
    return false
  }
}

export function createArtworkPlaceholder(title = 'Artwork', label = 'Album') {
  const cleanTitle = title.trim() || 'Artwork'
  const cleanLabel = label.trim() || 'Album'
  const hue = hashText(`${cleanTitle}:${cleanLabel}`)
  const initials = cleanTitle
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('')
    .slice(0, 3) || 'A'
  const titleLine = cleanTitle.length > 34 ? `${cleanTitle.slice(0, 31)}...` : cleanTitle
  const labelLine = cleanLabel.length > 28 ? `${cleanLabel.slice(0, 25)}...` : cleanLabel
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue}, 48%, 28%)"/>
      <stop offset="1" stop-color="hsl(${(hue + 52) % 360}, 42%, 13%)"/>
    </linearGradient>
  </defs>
  <rect width="800" height="800" fill="url(#g)"/>
  <rect x="58" y="58" width="684" height="684" rx="46" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
  <circle cx="400" cy="328" r="138" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.22)" stroke-width="2"/>
  <text x="400" y="358" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="92" font-weight="800" fill="#fff">${escapeSvgText(initials)}</text>
  <text x="400" y="548" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="38" font-weight="700" fill="#fff">${escapeSvgText(titleLine)}</text>
  <text x="400" y="604" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="600" fill="rgba(255,255,255,0.76)">${escapeSvgText(labelLine)}</text>
</svg>`.trim()

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

export function resolveArtworkUrl(url?: string | null, _title?: string, _label?: string) {
  if (!url) return ''
  // Return the direct URL. Direct CDN loading from Apple, TMDB, RAWG, and Unsplash works instantly.
  return url
}
