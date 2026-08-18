import { describe, expect, it } from 'vitest'
import { buildSongBiography, getSongReleaseKind, ordinalize } from './songBio'

describe('song biographies', () => {
  it('formats ordinal suffixes including the teen exceptions', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21].map(ordinalize)).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st',
    ])
  })

  it('uses the requested template for a confirmed studio-album track', () => {
    expect(buildSongBiography({
      songName: 'Cruel Summer',
      artistName: 'Taylor Swift',
      albumName: 'Lover',
      trackNumber: 2,
      trackCount: 18,
      studioAlbumNumber: 7,
      year: '2019',
    })).toBe("Cruel Summer is the 2nd track of Taylor Swift's 7th studio album Lover.")
  })

  it('does not infer album membership for a one-track release', () => {
    const input = {
      songName: 'All Of The Girls You Loved Before',
      artistName: 'Taylor Swift',
      albumName: 'All Of The Girls You Loved Before',
      trackNumber: 1,
      trackCount: 1,
      year: '2023',
    }

    expect(getSongReleaseKind(input)).toBe('standalone')
    expect(buildSongBiography(input)).toBe(
      'All Of The Girls You Loved Before is a standalone song by Taylor Swift, released in 2023.',
    )
  })

  it('does not treat a bonus edition as the standard studio-album lineup', () => {
    expect(getSongReleaseKind({
      songName: "You're Losing Me (From The Vault)",
      albumName: 'Midnights (The Late Night Edition)',
      trackCount: 23,
    })).toBe('standalone')
  })
})
