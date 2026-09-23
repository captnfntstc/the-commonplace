import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PageLoadingSkeleton } from './PageLoadingSkeleton'
import { pageLoadingVariantForPath } from './pageLoadingRoute'

describe('route-aware page loading skeleton', () => {
  it.each([
    ['/', 'home'],
    ['/users/reader', 'profile'],
    ['/profile', 'profile'],
    ['/books/googlebooks%3Abook%3A123', 'entity'],
    ['/artists/artist-id', 'entity'],
    ['/settings', 'settings'],
    ['/activity', 'activity'],
    ['/help', 'help'],
    ['/login', 'auth'],
    ['/register', 'auth'],
  ] as const)('maps %s to the %s skeleton', (pathname, variant) => {
    expect(pageLoadingVariantForPath(pathname)).toBe(variant)
  })

  it('uses the real home card skeleton during the initial home load', () => {
    const { container } = render(<PageLoadingSkeleton pathname="/" />)

    expect(screen.getByRole('status', { name: 'Loading home' })).toBeInTheDocument()
    expect(container.querySelector('[data-loading-variant="home"]')).toBeInTheDocument()
    expect(container.querySelectorAll('.skeleton-card')).toHaveLength(8)
    expect(container.querySelector('.route-skeleton-type-tabs')).toBeInTheDocument()
  })

  it('renders profile geometry for user routes', () => {
    const { container } = render(<PageLoadingSkeleton pathname="/users/reader" />)

    expect(screen.getByRole('status', { name: 'Loading profile' })).toBeInTheDocument()
    expect(container.querySelector('.route-profile-banner')).toBeInTheDocument()
    expect(container.querySelector('.route-profile-avatar')).toBeInTheDocument()
    expect(container.querySelectorAll('.skeleton-card')).toHaveLength(4)
  })

  it('renders media-profile geometry for entity routes', () => {
    const { container } = render(<PageLoadingSkeleton pathname="/films/tmdb%3Amovie%3A1" />)

    expect(screen.getByRole('status', { name: 'Loading media profile' })).toBeInTheDocument()
    expect(container.querySelector('.route-entity-artwork')).toBeInTheDocument()
    expect(container.querySelector('.route-entity-tabs')).toBeInTheDocument()
  })

  it.each([
    ['/settings', '.route-settings-main'],
    ['/activity', '.route-activity-panel'],
    ['/help', '.route-help-grid'],
    ['/login', '.route-auth-form'],
  ] as const)('renders destination-specific content for %s', (pathname, selector) => {
    const { container } = render(<PageLoadingSkeleton pathname={pathname} />)
    expect(container.querySelector(selector)).toBeInTheDocument()
  })
})
