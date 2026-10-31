import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BrandLogo } from './BrandLogo'
import {
  DARK_THEMES,
  LIGHT_THEMES,
  resetAppearanceSettings,
  updateAppearanceSettings,
} from '../features/appearance/appearanceSettings'

describe('BrandLogo adaptive SVG wordmark', () => {
  beforeEach(() => {
    window.localStorage.clear()
    resetAppearanceSettings()
  })

  afterEach(() => {
    window.localStorage.clear()
    resetAppearanceSettings()
  })

  it('renders exact vector paths for the 12 primary letters, 2 elongated pill O’s, and 1 trailing period', () => {
    const { container } = render(<BrandLogo className="global-header-wordmark-logo" />)

    // Screen-reader accessible label preserved for assistive tech & queries
    expect(screen.getByText('The Commonplace.')).toBeDefined()

    const root = container.querySelector('.tcp-brand-logo.global-header-wordmark-logo')
    expect(root).not.toBeNull()

    const svg = container.querySelector('svg.tcp-brand-logo-svg')
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute('viewBox')).toBe('52 420 1829 195')

    // 12 primary letters (T h e C m m n p l a c e), 2 rounded-rectangle O's, 1 period next to 'e'
    expect(container.querySelectorAll('path.tcp-brand-logo-ink').length).toBe(12)
    expect(container.querySelectorAll('path.tcp-brand-logo-pill').length).toBe(2)
    expect(container.querySelectorAll('path.tcp-brand-logo-period').length).toBe(1)
  })

  it('adapts primary ink to black (#09090b) in all 4 light themes and white (#ffffff) in all 4 dark themes while syncing secondary accent', () => {
    for (const lightTheme of LIGHT_THEMES) {
      updateAppearanceSettings({ theme: lightTheme.id })
      expect(document.documentElement.style.getPropertyValue('--logo-ink')).toBe('#09090b')
      expect(document.documentElement.style.getPropertyValue('--accent')).toBe(lightTheme.palette.accent)
    }

    for (const darkTheme of DARK_THEMES) {
      updateAppearanceSettings({ theme: darkTheme.id })
      expect(document.documentElement.style.getPropertyValue('--logo-ink')).toBe('#ffffff')
      expect(document.documentElement.style.getPropertyValue('--accent')).toBe(darkTheme.palette.accent)
    }
  })

  it('supports forceMode="dark" override so fixed-dark Auth headers stay white even when a light theme is stored', () => {
    updateAppearanceSettings({ theme: 'white-cobalt' })
    expect(document.documentElement.style.getPropertyValue('--logo-ink')).toBe('#09090b')

    const { container } = render(<BrandLogo forceMode="dark" srText="" />)
    expect(container.querySelector('.tcp-brand-sr-only')).toBeNull()

    const logoSpan = container.querySelector('.tcp-brand-logo') as HTMLElement
    expect(logoSpan.style.getPropertyValue('--brand-logo-ink-override')).toBe('#ffffff')
  })
})
