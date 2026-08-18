import { describe, expect, it } from 'vitest'
import { selectLyricsVariant } from './metadata'

const variants = [
  {
    id: 1,
    trackName: 'Advisory Song',
    artistName: 'Variant Artist',
    albumName: 'Variant Album',
    duration: 201,
    plainLyrics: 'The clean opening\nYou changed the story for the fun of it',
  },
  {
    id: 2,
    trackName: 'Advisory Song',
    artistName: 'Variant Artist',
    albumName: 'Variant Album',
    duration: 201,
    plainLyrics: 'The explicit opening\nYou started shit for the fun of it',
  },
]

describe('lyrics advisory variants', () => {
  it('selects the explicit lyrics for an individually explicit track', () => {
    expect(selectLyricsVariant(variants, 'Variant Artist', 'Advisory Song', {
      explicit: true,
      albumName: 'Variant Album',
      durationSeconds: 201,
    })).toContain('started shit')
  })

  it('selects the clean lyrics for a clean track', () => {
    expect(selectLyricsVariant(variants, 'Variant Artist', 'Advisory Song', {
      explicit: false,
      albumName: 'Variant Album',
      durationSeconds: 201,
    })).toContain('changed the story')
  })

  it('keeps lyrics available and masks explicit words when no clean transcription exists', () => {
    const lyrics = selectLyricsVariant([variants[1]], 'Variant Artist', 'Advisory Song', {
      explicit: false,
    })

    expect(lyrics).toContain('The explicit opening')
    expect(lyrics).not.toContain('shit')
    expect(lyrics).toContain('••••')
  })

  it('applies known song-specific clean edits when the provider only has explicit lyrics', () => {
    const lyrics = selectLyricsVariant([{
      id: 3,
      trackName: 'Karma',
      artistName: 'Taylor Swift',
      albumName: 'Midnights',
      plainLyrics: "You're talking shit for the hell of it\ngoddamn",
    }], 'Taylor Swift', 'Karma', { explicit: false, albumName: 'Midnights' })

    expect(lyrics).toContain('flip the script')
    expect(lyrics).toContain('Vegas')
    expect(lyrics).not.toMatch(/shit|goddamn/i)
  })
})
