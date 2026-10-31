import { useSyncExternalStore } from 'react'

export type AppearanceThemeMode = 'light' | 'dark'

/**
 * Theme identifiers double as CSS hooks (`data-theme="..."` on <html>/<body>).
 * `white*` ids are the light family, `dark*` ids the dark family; each variant
 * swaps the accent color on a shared look.
 */
export type AppearanceTheme =
  | 'white'
  | 'white-gold'
  | 'white-emerald'
  | 'white-cobalt'
  | 'dark'
  | 'dark-coral'
  | 'dark-emerald'
  | 'dark-cobalt'

export interface AppearanceThemeOption {
  id: AppearanceTheme
  mode: AppearanceThemeMode
  name: string
  accentName: string
  subtitle: string
  description: string
  palette: {
    baseSwatch: string
    bg: string
    surface: string
    card: string
    text: string
    accent: string
    accentHover: string
    accentFg: string
    accentRgb: string
    accentSurface: string
    border: string
  }
}

export const APPEARANCE_THEMES: AppearanceThemeOption[] = [
  // ─── 4 Light Pairings (white family ids) ────────────────────────────────
  {
    id: 'white',
    mode: 'light',
    name: 'Sunrise',
    accentName: 'Coral',
    subtitle: 'Bright Morning Light',
    description: 'A crisp white look with a lively coral accent. Bright and cheerful for everyday reading.',
    palette: {
      baseSwatch: '#ffffff',
      bg: '#f2f3f5',
      surface: '#ffffff',
      card: '#ffffff',
      text: '#09090b',
      accent: '#f05353',
      accentHover: '#dc3e3e',
      accentFg: '#ffffff',
      accentRgb: '240, 83, 83',
      accentSurface: '#fff5f5',
      border: '#e4e4e7',
    },
  },
  {
    id: 'white-gold',
    mode: 'light',
    name: 'Honey',
    accentName: 'Amber',
    subtitle: 'Warm Golden Glow',
    description: 'A crisp white look sweetened with honey-gold accents. Cozy without losing clarity.',
    palette: {
      baseSwatch: '#ffffff',
      bg: '#f2f3f5',
      surface: '#ffffff',
      card: '#ffffff',
      text: '#09090b',
      accent: '#c48a2c',
      accentHover: '#a9721e',
      accentFg: '#ffffff',
      accentRgb: '196, 138, 44',
      accentSurface: '#fdf8ef',
      border: '#e4e4e7',
    },
  },
  {
    id: 'white-emerald',
    mode: 'light',
    name: 'Matcha',
    accentName: 'Jade',
    subtitle: 'Fresh Green Calm',
    description: 'A crisp white look with a mellow matcha-green accent. Clean, calm, and easy on the eyes.',
    palette: {
      baseSwatch: '#ffffff',
      bg: '#f2f3f5',
      surface: '#ffffff',
      card: '#ffffff',
      text: '#09090b',
      accent: '#059669',
      accentHover: '#047857',
      accentFg: '#ffffff',
      accentRgb: '5, 150, 105',
      accentSurface: '#ecfdf5',
      border: '#e4e4e7',
    },
  },
  {
    id: 'white-cobalt',
    mode: 'light',
    name: 'Ocean',
    accentName: 'Azure',
    subtitle: 'Cool Blue Breeze',
    description: 'A crisp white look washed in deep ocean blue. Clean and refreshing.',
    palette: {
      baseSwatch: '#ffffff',
      bg: '#f2f3f5',
      surface: '#ffffff',
      card: '#ffffff',
      text: '#09090b',
      accent: '#2563eb',
      accentHover: '#1d4ed8',
      accentFg: '#ffffff',
      accentRgb: '37, 99, 235',
      accentSurface: '#eff6ff',
      border: '#e4e4e7',
    },
  },

  // ─── 4 Dark Pairings (dark family ids) ─────────────────────────────────
  {
    id: 'dark',
    mode: 'dark',
    name: 'Espresso',
    accentName: 'Sanctuary',
    subtitle: 'Cozy Dark Roast',
    description: 'A rich dark look with warm brass highlights. The go-to for late-night reading.',
    palette: {
      baseSwatch: '#15110c',
      bg: '#0c0a08',
      surface: '#15110c',
      card: '#1c1610',
      text: '#f2ece4',
      accent: '#c9a96e',
      accentHover: '#dfc088',
      accentFg: '#0e0b06',
      accentRgb: '201, 169, 110',
      accentSurface: 'rgba(201, 169, 110, 0.08)',
      border: 'rgba(201, 169, 110, 0.22)',
    },
  },
  {
    id: 'dark-coral',
    mode: 'dark',
    name: 'Bonfire',
    accentName: 'Ember',
    subtitle: 'Glowing Red Embers',
    description: 'A rich dark look lit by glowing bonfire-red highlights.',
    palette: {
      baseSwatch: '#15110c',
      bg: '#0c0a08',
      surface: '#15110c',
      card: '#1c1610',
      text: '#f2ece4',
      accent: '#f05353',
      accentHover: '#f56e6e',
      accentFg: '#ffffff',
      accentRgb: '240, 83, 83',
      accentSurface: 'rgba(240, 83, 83, 0.08)',
      border: 'rgba(240, 83, 83, 0.24)',
    },
  },
  {
    id: 'dark-emerald',
    mode: 'dark',
    name: 'Evergreen',
    accentName: 'Jade',
    subtitle: 'Deep Forest Calm',
    description: 'A rich dark look with luminous forest-green highlights. Quiet and grounding.',
    palette: {
      baseSwatch: '#15110c',
      bg: '#0c0a08',
      surface: '#15110c',
      card: '#1c1610',
      text: '#f2ece4',
      accent: '#34d399',
      accentHover: '#6ee7b7',
      accentFg: '#071710',
      accentRgb: '52, 211, 153',
      accentSurface: 'rgba(52, 211, 153, 0.08)',
      border: 'rgba(52, 211, 153, 0.22)',
    },
  },
  {
    id: 'dark-cobalt',
    mode: 'dark',
    name: 'Midnight',
    accentName: 'Azure',
    subtitle: 'Starlit Blue Night',
    description: 'A rich dark look under crisp midnight-blue highlights. Calm like the night sky.',
    palette: {
      baseSwatch: '#15110c',
      bg: '#0c0a08',
      surface: '#15110c',
      card: '#1c1610',
      text: '#f2ece4',
      accent: '#60a5fa',
      accentHover: '#93c5fd',
      accentFg: '#081120',
      accentRgb: '96, 165, 250',
      accentSurface: 'rgba(96, 165, 250, 0.08)',
      border: 'rgba(96, 165, 250, 0.24)',
    },
  },
]

export const LIGHT_THEMES: AppearanceThemeOption[] = APPEARANCE_THEMES.filter(
  (t) => t.mode === 'light',
)
export const DARK_THEMES: AppearanceThemeOption[] = APPEARANCE_THEMES.filter(
  (t) => t.mode === 'dark',
)

/**
 * Official sitewide typography. Fonts are fixed, so there is no font picker —
 * these families are always applied to the whole app.
 */
export const OFFICIAL_FONTS = {
  display: "'DM Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  body: "'Quicksand', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  tabs: "'Plus Jakarta Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
} as const

/** Quotes & passages are locked permanently to Source Serif 4. */
export const OFFICIAL_QUOTE_FONT = "'Source Serif 4', Georgia, serif"

export interface AppearanceSettings {
  theme: AppearanceTheme
}

// Legacy key (previously the developer settings store). Keeping it preserves
// every user's saved selection while the stored shape narrows to `theme` only.
export const APPEARANCE_SETTINGS_STORAGE_KEY = 'the-commonplace.dev-settings.v5'

// New accounts (and fresh browsers) start on the default dark look (Espresso).
export const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettings = {
  theme: 'dark',
}

const listeners = new Set<() => void>()

function isAppearanceTheme(value: unknown): value is AppearanceTheme {
  return typeof value === 'string' && APPEARANCE_THEMES.some((t) => t.id === value)
}

export function normalizeStoredTheme(value: unknown): AppearanceTheme {
  // Archival Parchment was retired as a public pairing; existing preferences
  // land on the light family instead of losing the look entirely.
  if (value === 'light') return 'white'
  return isAppearanceTheme(value) ? value : DEFAULT_APPEARANCE_SETTINGS.theme
}

export function getThemeOption(themeId?: unknown): AppearanceThemeOption {
  const normalized = normalizeStoredTheme(themeId)
  return APPEARANCE_THEMES.find((t) => t.id === normalized) || APPEARANCE_THEMES[4]
}

export function isLightTheme(themeId?: unknown): boolean {
  return getThemeOption(themeId).mode === 'light'
}

export function readStoredSettings(): AppearanceSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_APPEARANCE_SETTINGS }

  try {
    const stored = window.localStorage.getItem(APPEARANCE_SETTINGS_STORAGE_KEY)
    if (!stored) return { ...DEFAULT_APPEARANCE_SETTINGS }

    const parsed = JSON.parse(stored) as { theme?: unknown }
    return { theme: normalizeStoredTheme(parsed.theme) }
  } catch {
    return { ...DEFAULT_APPEARANCE_SETTINGS }
  }
}

let currentSettings = readStoredSettings()

export function applyToDocument(settings?: AppearanceSettings) {
  if (typeof document === 'undefined') return
  const activeSettings = settings || currentSettings

  const activeTheme = normalizeStoredTheme(activeSettings.theme)
  const themeObj = getThemeOption(activeTheme)
  const isLight = themeObj.mode === 'light'

  const root = document.documentElement

  // Official sitewide typography CSS custom properties (fonts are fixed)
  root.style.setProperty('--display', OFFICIAL_FONTS.display)
  root.style.setProperty('--body', OFFICIAL_FONTS.body)
  root.style.setProperty('--tabs', OFFICIAL_FONTS.tabs)
  root.style.setProperty('--font-main', OFFICIAL_FONTS.display)
  root.style.setProperty('--font-secondary', OFFICIAL_FONTS.body)
  root.style.setProperty('--font-tabs', OFFICIAL_FONTS.tabs)

  // Quotes are locked permanently to Source Serif 4
  root.style.setProperty('--font-quote', OFFICIAL_QUOTE_FONT)

  // Sitewide secondary accent & adaptive logo CSS custom properties
  root.style.setProperty('--accent', themeObj.palette.accent)
  root.style.setProperty('--accent-hover', themeObj.palette.accentHover)
  root.style.setProperty('--accent-fg', themeObj.palette.accentFg)
  root.style.setProperty('--accent-rgb', themeObj.palette.accentRgb)
  root.style.setProperty('--accent-surface', themeObj.palette.accentSurface)
  root.style.setProperty('--logo-ink', isLight ? '#09090b' : '#ffffff')

  if (document.body) {
    document.body.style.fontFamily = OFFICIAL_FONTS.body
  }

  // Theme application (light pairings share `.theme-white`,
  // dark pairings share `.theme-dark`)
  root.dataset.theme = activeTheme
  root.dataset.themeMode = themeObj.mode
  if (isLight) {
    root.classList.add('theme-white')
    root.classList.remove('theme-dark', 'theme-light')
    root.style.colorScheme = 'light'
  } else {
    root.classList.add('theme-dark')
    root.classList.remove('theme-white', 'theme-light')
    root.style.colorScheme = 'dark'
  }

  if (document.body) {
    document.body.dataset.theme = activeTheme
    document.body.dataset.themeMode = themeObj.mode
    if (isLight) {
      document.body.classList.add('theme-white')
      document.body.classList.remove('theme-dark', 'theme-light')
    } else {
      document.body.classList.add('theme-dark')
      document.body.classList.remove('theme-white', 'theme-light')
    }
  }

  // Keep the browser chrome (mobile URL bar) in sync with the canvas color
  let metaThemeColor = document.querySelector('meta[name="theme-color"]')
  if (!metaThemeColor) {
    metaThemeColor = document.createElement('meta')
    metaThemeColor.setAttribute('name', 'theme-color')
    document.head.appendChild(metaThemeColor)
  }
  metaThemeColor.setAttribute('content', themeObj.palette.bg)
}

function persist(settings: AppearanceSettings) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(APPEARANCE_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

function notify() {
  listeners.forEach((listener) => listener())
}

export function getAppearanceSettings(): AppearanceSettings {
  return currentSettings
}

export function updateAppearanceSettings(patch: Partial<AppearanceSettings>) {
  const normalizedPatch: Partial<AppearanceSettings> =
    patch.theme !== undefined ? { theme: normalizeStoredTheme(patch.theme) } : patch
  currentSettings = { ...currentSettings, ...normalizedPatch }
  applyToDocument(currentSettings)
  persist(currentSettings)
  notify()
}

export function resetAppearanceSettings() {
  currentSettings = { ...DEFAULT_APPEARANCE_SETTINGS }
  applyToDocument(currentSettings)

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(APPEARANCE_SETTINGS_STORAGE_KEY)
    } catch {
      // Ignore storage failures.
    }
  }

  notify()
}

function subscribeToAppearanceSettings(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useAppearanceSettings() {
  const settings = useSyncExternalStore(
    subscribeToAppearanceSettings,
    getAppearanceSettings,
    () => DEFAULT_APPEARANCE_SETTINGS,
  )

  return { settings, updateSettings: updateAppearanceSettings, resetSettings: resetAppearanceSettings }
}

applyToDocument(currentSettings)
