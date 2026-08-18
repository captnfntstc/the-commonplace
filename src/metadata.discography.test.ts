import { describe, expect, it } from 'vitest'
import { classifyItunesDiscographyRelease } from './metadata'

describe('iTunes discography release classification', () => {
  it('classifies four-track single bundles as singles', () => {
    expect(classifyItunesDiscographyRelease('Elizabeth Taylor', 4)).toBe('single')
    expect(classifyItunesDiscographyRelease('Example Song', 1)).toBe('single')
  })

  it('honors explicit EP and single catalog labels', () => {
    expect(classifyItunesDiscographyRelease('A Short Collection - EP', 4)).toBe('ep')
    expect(classifyItunesDiscographyRelease('Example Release - Single', 6)).toBe('single')
  })

  it('keeps medium-length releases with EPs and full-length releases with albums', () => {
    expect(classifyItunesDiscographyRelease('Untitled Release', 6)).toBe('ep')
    expect(classifyItunesDiscographyRelease('Studio Record', 12)).toBe('album')
  })

  it('does not guess that a release with missing track data is a single', () => {
    expect(classifyItunesDiscographyRelease('Unknown Release')).toBe('album')
  })
})
