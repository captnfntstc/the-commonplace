import { describe, expect, it } from 'vitest'
import { metadataForPath } from './RouteMetadata'

describe('route metadata', () => {
  it('provides distinct titles for core pages', () => {
    expect(metadataForPath('/').title).toBe('The Commonplace')
    expect(metadataForPath('/settings').title).toBe('Settings | The Commonplace')
    expect(metadataForPath('/users/jimmy').title).toBe('@jimmy | The Commonplace')
    expect(metadataForPath('/entries/post-123').title).toBe('Reading | The Commonplace')
  })

  it('uses a not-found title for unknown routes', () => {
    expect(metadataForPath('/missing-page').title).toBe('Page Not Found | The Commonplace')
  })
})
