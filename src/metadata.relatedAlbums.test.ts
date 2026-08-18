import { describe, expect, it } from 'vitest'
import { isDerivativeRelatedAlbum, isSameAlbumVersionTitle } from './metadata'

describe('related album filtering', () => {
  it('rejects tribute, karaoke, lullaby, string-quartet, and cover releases', () => {
    expect(isDerivativeRelatedAlbum('A Tribute to the Artist', 'Various Artists')).toBe(true)
    expect(isDerivativeRelatedAlbum('Greatest Karaoke Hits', 'Sing-Along Crew')).toBe(true)
    expect(isDerivativeRelatedAlbum('Lullaby Versions of Billie Eilish', 'Bedtime Baby')).toBe(true)
    expect(isDerivativeRelatedAlbum('Songs of Billie Eilish', 'Midnite String Quartet')).toBe(true)
    expect(isDerivativeRelatedAlbum('Piano Covers of Lover', 'Quiet Keys')).toBe(true)
    expect(isDerivativeRelatedAlbum('Melodrama', 'Lorde')).toBe(false)
  })

  it('recognizes named editions by exact artist and normalized base title', () => {
    expect(isSameAlbumVersionTitle(
      'Midnights (The Til Dawn Edition)',
      'Taylor Swift',
      'Midnights',
      'Taylor Swift',
    )).toBe(true)
    expect(isSameAlbumVersionTitle('Midnights (3am Edition)', 'Cover Band', 'Midnights', 'Taylor Swift')).toBe(false)
    expect(isSameAlbumVersionTitle('Midnight Memories', 'Taylor Swift', 'Midnights', 'Taylor Swift')).toBe(false)
  })
})
