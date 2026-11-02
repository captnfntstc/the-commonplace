import { afterEach, beforeEach, describe, it, expect } from 'vitest'
import {
  APPEARANCE_SETTINGS_STORAGE_KEY,
  APPEARANCE_THEMES,
  DARK_THEMES,
  DEFAULT_APPEARANCE_SETTINGS,
  LIGHT_THEMES,
  getAppearanceSettings,
  getThemeOption,
  isLightTheme,
  normalizeStoredTheme,
  readStoredSettings,
  resetAppearanceSettings,
  updateAppearanceSettings,
} from './appearanceSettings'

describe('Appearance settings store', () => {
  beforeEach(() => {
    window.localStorage.clear()
    resetAppearanceSettings()
  })

  afterEach(() => {
    window.localStorage.clear()
    resetAppearanceSettings()
  })

  it('defaults new accounts to the default Sunrise look', () => {
    expect(DEFAULT_APPEARANCE_SETTINGS.theme).toBe('white')
    expect(getAppearanceSettings().theme).toBe('white')
    expect(getThemeOption('white').name).toBe('Sunrise')
  })

  it('applies the official fixed typography sitewide with quotes locked to Source Serif 4', () => {
    updateAppearanceSettings({ theme: 'white-emerald' })

    const root = document.documentElement
    expect(root.style.getPropertyValue('--display')).toContain('DM Sans')
    expect(root.style.getPropertyValue('--body')).toContain('Quicksand')
    expect(root.style.getPropertyValue('--tabs')).toContain('Plus Jakarta Sans')
    expect(root.style.getPropertyValue('--font-main')).toContain('DM Sans')
    expect(root.style.getPropertyValue('--font-secondary')).toContain('Quicksand')
    expect(root.style.getPropertyValue('--font-tabs')).toContain('Plus Jakarta Sans')
    expect(root.style.getPropertyValue('--font-quote')).toContain('Source Serif 4')
    expect(document.body.style.fontFamily).toContain('Quicksand')

    // Font selection is no longer stored — only the look pairing is persisted
    const stored = JSON.parse(
      window.localStorage.getItem(APPEARANCE_SETTINGS_STORAGE_KEY) || '{}',
    )
    expect(Object.keys(stored)).toEqual(['theme'])
  })

  it('overrides legacy stored font preferences with the official fonts', () => {
    window.localStorage.setItem(
      APPEARANCE_SETTINGS_STORAGE_KEY,
      JSON.stringify({ mainFont: 'quicksand', secondaryFont: 'nunito', tabsFont: 'outfit', theme: 'white' }),
    )

    const hydrated = readStoredSettings()
    expect(Object.keys(hydrated)).toEqual(['theme'])
    expect(document.documentElement.style.getPropertyValue('--display')).toContain('DM Sans')
    expect(document.documentElement.style.getPropertyValue('--display')).not.toContain('Quicksand')
  })

  it('provides the 8-pairing lineup: 4 light and 4 dark with everyday names', () => {
    expect(APPEARANCE_THEMES.length).toBe(8)
    expect(LIGHT_THEMES.length).toBe(4)
    expect(DARK_THEMES.length).toBe(4)

    expect(LIGHT_THEMES.map((t) => t.id)).toEqual([
      'white',
      'white-gold',
      'white-emerald',
      'white-cobalt',
    ])
    expect(LIGHT_THEMES.map((t) => t.name)).toEqual([
      'Sunrise',
      'Honey',
      'Matcha',
      'Ocean',
    ])
    expect(DARK_THEMES.map((t) => t.id)).toEqual([
      'dark',
      'dark-coral',
      'dark-emerald',
      'dark-cobalt',
    ])
    expect(DARK_THEMES.map((t) => t.name)).toEqual([
      'Espresso',
      'Bonfire',
      'Evergreen',
      'Midnight',
    ])
  })

  it('applies the light shell (.theme-white) for light pairings and dark shell (.theme-dark) for dark pairings with adaptive CSS variables', () => {
    const root = document.documentElement

    for (const light of LIGHT_THEMES) {
      updateAppearanceSettings({ theme: light.id })
      expect(isLightTheme(light.id)).toBe(true)
      expect(root.dataset.theme).toBe(light.id)
      expect(root.dataset.themeMode).toBe('light')
      expect(root.classList.contains('theme-white')).toBe(true)
      expect(root.classList.contains('theme-dark')).toBe(false)
      expect(root.style.getPropertyValue('--accent')).toBe(light.palette.accent)
      expect(root.style.getPropertyValue('--accent-rgb')).toBe(light.palette.accentRgb)
      expect(root.style.getPropertyValue('--logo-ink')).toBe('#09090b')
      expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#f2f3f5')
    }

    for (const dark of DARK_THEMES) {
      updateAppearanceSettings({ theme: dark.id })
      expect(isLightTheme(dark.id)).toBe(false)
      expect(root.dataset.theme).toBe(dark.id)
      expect(root.dataset.themeMode).toBe('dark')
      expect(root.classList.contains('theme-dark')).toBe(true)
      expect(root.classList.contains('theme-white')).toBe(false)
      expect(root.style.getPropertyValue('--accent')).toBe(dark.palette.accent)
      expect(root.style.getPropertyValue('--accent-rgb')).toBe(dark.palette.accentRgb)
      expect(root.style.getPropertyValue('--logo-ink')).toBe('#ffffff')
      expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#0c0a08')
    }
  })

  it('migrates legacy stored light preferences and normalizes unknown values', () => {
    expect(normalizeStoredTheme('light')).toBe('white')
    expect(normalizeStoredTheme('white')).toBe('white')
    expect(normalizeStoredTheme('dark')).toBe('dark')
    expect(normalizeStoredTheme('unknown')).toBe('white')

    window.localStorage.setItem(
      APPEARANCE_SETTINGS_STORAGE_KEY,
      JSON.stringify({ theme: 'light' }),
    )

    expect(readStoredSettings()).toEqual({ theme: 'white' })
  })

  it('persists selections without leaking theme-light classes', () => {
    updateAppearanceSettings({ theme: 'white-gold' })

    const root = document.documentElement
    expect(root.dataset.theme).toBe('white-gold')
    expect(root.classList.contains('theme-white')).toBe(true)
    expect(root.classList.contains('theme-light')).toBe(false)
    expect(root.classList.contains('theme-dark')).toBe(false)
    expect(document.body.dataset.theme).toBe('white-gold')
    expect(document.body.classList.contains('theme-white')).toBe(true)

    const stored = JSON.parse(
      window.localStorage.getItem(APPEARANCE_SETTINGS_STORAGE_KEY) || '{}',
    )
    expect(stored.theme).toBe('white-gold')
  })

  it('resets to the default Sunrise look and clears storage', () => {
    updateAppearanceSettings({ theme: 'white-cobalt' })
    resetAppearanceSettings()

    expect(getAppearanceSettings().theme).toBe('white')
    expect(document.documentElement.dataset.theme).toBe('white')
    expect(document.documentElement.classList.contains('theme-white')).toBe(true)
    expect(window.localStorage.getItem(APPEARANCE_SETTINGS_STORAGE_KEY)).toBeNull()
  })
})
