import type { CSSProperties } from 'react'

export type GradientPalette = {
  primary: string
  secondary: string
  accent: string
  dark: string
}

export const TONE_PALETTE: Record<string, GradientPalette> = {
  gold: { primary: '#e6b972', secondary: '#f59e0b', accent: '#fef08a', dark: '#241708' },
  rose: { primary: '#f43f5e', secondary: '#fb7185', accent: '#fecdd3', dark: '#3b0713' },
  sage: { primary: '#10b981', secondary: '#34d399', accent: '#a7f3d0', dark: '#032118' },
  blue: { primary: '#3b82f6', secondary: '#60a5fa', accent: '#bfdbfe', dark: '#0b1938' },
  violet: { primary: '#8b5cf6', secondary: '#a78bfa', accent: '#ddd6fe', dark: '#1f0b42' },
  ember: { primary: '#f97316', secondary: '#fb923c', accent: '#fed7aa', dark: '#351105' },
}

export const TYPE_DEFAULT_TONES: Record<string, string> = {
  album: 'gold',
  book: 'blue',
  film: 'ember',
  game: 'rose',
  song: 'violet',
  tv: 'sage',
}

const DEFAULT_PALETTE: GradientPalette = {
  primary: '#e6b972',
  secondary: '#c8a26a',
  accent: '#f59e0b',
  dark: '#14100c',
}

export function getCollectionCoverPalette(
  items: Array<{ type?: string; coverTone?: string }>,
): { c1: string; c2: string; c3: string; c4: string; cDark: string } {
  const first4 = items.slice(0, 4)
  if (first4.length === 0) {
    return {
      c1: DEFAULT_PALETTE.primary,
      c2: DEFAULT_PALETTE.secondary,
      c3: DEFAULT_PALETTE.accent,
      c4: '#92400e',
      cDark: DEFAULT_PALETTE.dark,
    }
  }

  const palettes = first4.map((item) => {
    const tone = item.coverTone || (item.type ? TYPE_DEFAULT_TONES[item.type] : undefined) || 'gold'
    return TONE_PALETTE[tone] || DEFAULT_PALETTE
  })

  const p0 = palettes[0]
  const p1 = palettes[1] || palettes[0]
  const p2 = palettes[2] || palettes[0]
  const p3 = palettes[3] || palettes[1] || palettes[0]

  return {
    c1: p0.primary,
    c2: p1.secondary,
    c3: p2.accent || p2.primary,
    c4: p3.secondary,
    cDark: p0.dark,
  }
}

export const GRADIENT_NAMES: Record<1 | 2 | 3 | 4, string> = {
  1: 'Obsidian Wave (Dark)',
  2: 'Midnight Aura (Dark)',
  3: 'Daylight Glow (Bright)',
  4: 'Solar Prism (Bright)',
}

export function getGradientCoverStyle(
  variant: 1 | 2 | 3 | 4,
  items: Array<{ type?: string; coverTone?: string }>,
): CSSProperties {
  if (items.length === 0) {
    return {
      backgroundColor: '#151310',
      backgroundImage: 'none',
      color: 'rgba(237, 229, 216, 0.45)',
    }
  }

  const { c1, c2, c3, cDark } = getCollectionCoverPalette(items)

  if (variant === 1) {
    // Dot 3: Obsidian Wave (Dark -> White Title)
    return {
      backgroundColor: cDark,
      backgroundImage: `
        radial-gradient(circle at 85% 18%, ${c2}66 0%, transparent 60%),
        linear-gradient(145deg, #0e0b08 0%, ${cDark} 35%, ${c1}88 75%, #080605 100%)
      `,
      color: '#ffffff',
    }
  }

  if (variant === 2) {
    // Dot 4: Midnight Aura (Dark -> White Title)
    return {
      backgroundColor: '#0a0806',
      backgroundImage: `
        radial-gradient(circle at 18% 85%, ${c1}cc 0%, transparent 62%),
        radial-gradient(circle at 85% 18%, ${c2}aa 0%, transparent 60%),
        radial-gradient(circle at 50% 50%, ${c3}44 0%, #0a0806 100%)
      `,
      color: '#ffffff',
    }
  }

  if (variant === 3) {
    // Dot 5: Daylight Glow (Bright -> Black Title)
    return {
      backgroundColor: '#fefefe',
      backgroundImage: `
        radial-gradient(circle at 15% 15%, rgba(255, 255, 255, 0.75) 0%, transparent 55%),
        linear-gradient(135deg, ${c3} 0%, ${c1} 48%, ${c2} 100%)
      `,
      color: '#0e0d0b',
    }
  }

  // Dot 6: Solar Prism (Bright -> Black Title)
  return {
    backgroundColor: '#ffffff',
    backgroundImage: `
      radial-gradient(circle at 85% 85%, rgba(255, 255, 255, 0.65) 0%, transparent 55%),
      linear-gradient(215deg, ${c2} 0%, ${c3} 40%, ${c1} 85%, #ffffff 100%)
    `,
    color: '#0e0d0b',
  }
}

/**
 * Widescreen-balanced hero banner gradient.
 * Uses soft ambient ellipses across both sides so wide banners don't have harsh or lopsided edge blooms.
 */
export function getGradientHeroBannerStyle(
  variant: 1 | 2 | 3 | 4,
  items: Array<{ type?: string; coverTone?: string }>,
): CSSProperties {
  if (items.length === 0) {
    return {
      backgroundColor: '#151310',
      backgroundImage: 'none',
      color: 'rgba(237, 229, 216, 0.45)',
    }
  }

  const { c1, c2, c3, cDark } = getCollectionCoverPalette(items)

  if (variant === 1) {
    return {
      backgroundColor: cDark,
      backgroundImage: `
        radial-gradient(ellipse at 80% 40%, ${c2}50 0%, transparent 65%),
        radial-gradient(ellipse at 20% 60%, ${c1}30 0%, transparent 65%),
        linear-gradient(135deg, rgba(14, 11, 8, 0.95) 0%, ${cDark} 50%, rgba(10, 8, 7, 0.95) 100%)
      `,
      color: '#ffffff',
    }
  }

  if (variant === 2) {
    return {
      backgroundColor: '#0a0806',
      backgroundImage: `
        radial-gradient(ellipse at 25% 50%, ${c1}55 0%, transparent 65%),
        radial-gradient(ellipse at 75% 50%, ${c2}55 0%, transparent 65%),
        radial-gradient(ellipse at 50% 50%, ${c3}26 0%, #0a0806 100%)
      `,
      color: '#ffffff',
    }
  }

  if (variant === 3) {
    return {
      backgroundColor: '#fefefe',
      backgroundImage: `
        radial-gradient(ellipse at 20% 35%, rgba(255, 255, 255, 0.6) 0%, transparent 60%),
        linear-gradient(135deg, ${c3}cc 0%, ${c1}cc 50%, ${c2}cc 100%)
      `,
      color: '#0e0d0b',
    }
  }

  return {
    backgroundColor: '#ffffff',
    backgroundImage: `
      radial-gradient(ellipse at 80% 65%, rgba(255, 255, 255, 0.5) 0%, transparent 60%),
      linear-gradient(215deg, ${c2}cc 0%, ${c3}cc 50%, ${c1}cc 100%)
    `,
    color: '#0e0d0b',
  }
}

function escapeSvgXml(unsafe: string) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function generateCollectionGradientSvg(
  name: string,
  variant: 1 | 2 | 3 | 4,
  items: Array<{ type?: string; coverTone?: string }>,
): string {
  const safeTitle = escapeSvgXml(name.trim() || 'Untitled Collection')

  const words = safeTitle.split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    if ((cur + ' ' + w).trim().length <= 16) {
      cur = (cur + ' ' + w).trim()
    } else {
      if (cur) lines.push(cur)
      cur = w
      if (lines.length === 2) break
    }
  }
  if (cur && lines.length < 3) lines.push(cur)

  const textTspans = lines
    .map((line, idx) => `<tspan x="36" dy="${idx === 0 ? 0 : 42}">${line}</tspan>`)
    .join('')

  if (items.length === 0) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="100%" height="100%">
      <rect width="500" height="500" fill="#151310" />
      <text x="36" y="70" fill="#c7b8a2" fill-opacity="0.55" font-family="'Cinzel', 'Playfair Display', Georgia, serif" font-weight="800" font-size="34" letter-spacing="-0.02em">
        ${textTspans}
      </text>
    </svg>`
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
  }

  const { c1, c2, c3, cDark } = getCollectionCoverPalette(items)

  let defs = ''
  let rects = ''
  let textColor = '#ffffff'
  let textFilter = 'filter="url(#shadow)"'

  if (variant === 1) {
    // Dark 1: Obsidian Wave -> White Title
    defs = `
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0e0b08" />
        <stop offset="35%" stop-color="${cDark}" />
        <stop offset="75%" stop-color="${c1}" stop-opacity="0.88" />
        <stop offset="100%" stop-color="#080605" />
      </linearGradient>
      <radialGradient id="glow" cx="85%" cy="18%" r="60%">
        <stop offset="0%" stop-color="${c2}" stop-opacity="0.4" />
        <stop offset="100%" stop-color="${c2}" stop-opacity="0" />
      </radialGradient>`
    rects = `
      <rect width="500" height="500" fill="url(#bg)" />
      <rect width="500" height="500" fill="url(#glow)" />`
    textColor = '#ffffff'
    textFilter = 'filter="url(#shadow)"'
  } else if (variant === 2) {
    // Dark 2: Midnight Aura -> White Title
    defs = `
      <radialGradient id="g1" cx="18%" cy="85%" r="62%">
        <stop offset="0%" stop-color="${c1}" stop-opacity="0.8" />
        <stop offset="100%" stop-color="${c1}" stop-opacity="0" />
      </radialGradient>
      <radialGradient id="g2" cx="85%" cy="18%" r="60%">
        <stop offset="0%" stop-color="${c2}" stop-opacity="0.67" />
        <stop offset="100%" stop-color="${c2}" stop-opacity="0" />
      </radialGradient>
      <radialGradient id="g3" cx="50%" cy="50%" r="65%">
        <stop offset="0%" stop-color="${c3}" stop-opacity="0.27" />
        <stop offset="100%" stop-color="#0a0806" />
      </radialGradient>`
    rects = `
      <rect width="500" height="500" fill="#0a0806" />
      <rect width="500" height="500" fill="url(#g3)" />
      <rect width="500" height="500" fill="url(#g1)" />
      <rect width="500" height="500" fill="url(#g2)" />`
    textColor = '#ffffff'
    textFilter = 'filter="url(#shadow)"'
  } else if (variant === 3) {
    // Bright 1: Daylight Glow -> Black Title
    defs = `
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${c3}" />
        <stop offset="48%" stop-color="${c1}" />
        <stop offset="100%" stop-color="${c2}" />
      </linearGradient>
      <radialGradient id="glow" cx="15%" cy="15%" r="55%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.75" />
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
      </radialGradient>`
    rects = `
      <rect width="500" height="500" fill="url(#bg)" />
      <rect width="500" height="500" fill="url(#glow)" />`
    textColor = '#0e0d0b'
    textFilter = ''
  } else {
    // Bright 2: Solar Prism -> Black Title
    defs = `
      <linearGradient id="bg" x1="100%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stop-color="${c2}" />
        <stop offset="40%" stop-color="${c3}" />
        <stop offset="85%" stop-color="${c1}" />
        <stop offset="100%" stop-color="#ffffff" />
      </linearGradient>
      <radialGradient id="glow" cx="85%" cy="85%" r="55%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.65" />
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
      </radialGradient>`
    rects = `
      <rect width="500" height="500" fill="url(#bg)" />
      <rect width="500" height="500" fill="url(#glow)" />`
    textColor = '#0e0d0b'
    textFilter = ''
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="100%" height="100%">
    <defs>
      ${defs}
      <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
        <feDropShadow dx="0" dy="2" stdDeviation="5" flood-color="#000000" flood-opacity="0.55"/>
      </filter>
    </defs>
    ${rects}
    <text x="36" y="70" fill="${textColor}" font-family="'Cinzel', 'Playfair Display', Georgia, serif" font-weight="800" font-size="34" letter-spacing="-0.02em" ${textFilter}>
      ${textTspans}
    </text>
  </svg>`

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
