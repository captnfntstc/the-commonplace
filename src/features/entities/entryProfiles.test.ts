import { describe, expect, it } from 'vitest'
import type { Entry } from '../entries/model'
import { createAlbumEntityFromSongEntry, createCreatorEntityFromEntry, splitCreatorNames } from './entryProfiles'

const entry = (overrides: Partial<Entry>): Entry => ({
  id: 'entry-1',
  type: 'game',
  title: 'Resident Evil',
  creator: 'Capcom',
  provider: 'IGDB',
  providerId: '1',
  genre: 'Horror',
  rating: 5,
  favoritePassage: '',
  reflection: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  coverTone: 'rose',
  ...overrides,
})

describe('entry-linked profiles', () => {
  it('does not create publisher or developer profiles for games', () => {
    const capcom = entry({})
    const studio = createCreatorEntityFromEntry(capcom, 'Capcom', [capcom])

    expect(studio).toBeNull()
  })

  it('keeps legal company suffixes together and builds song album links', () => {
    expect(splitCreatorNames('Rockstar Games, Inc., Nintendo')).toEqual(['Rockstar Games, Inc.', 'Nintendo'])
    const album = createAlbumEntityFromSongEntry(entry({
      type: 'song',
      title: 'Song',
      creator: 'Artist',
      provider: 'Album Name',
    }))
    expect(album?.type).toBe('album')
    expect(album?.name).toBe('Album Name')
  })
})
