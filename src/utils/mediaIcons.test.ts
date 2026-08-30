import { describe, expect, it } from 'vitest'
import {
  BookOpen,
  Clapperboard,
  Disc3,
  Drama,
  Film,
  MicVocal,
  Music2,
  Pencil,
} from 'lucide-react'
import {
  getEntryTypeIcon,
  getMediaEntityIcon,
  getProfessionIcon,
  getScreenCreditIcon,
} from './mediaIcons'

describe('semantic media and role icons', () => {
  it('keeps creators distinct from the works they create', () => {
    expect(getProfessionIcon('singer_songwriter')).toBe(MicVocal)
    expect(getProfessionIcon('singer')).toBe(MicVocal)
    expect(getProfessionIcon('songwriter')).toBe(MicVocal)
    expect(getProfessionIcon('author')).toBe(Pencil)
    expect(getMediaEntityIcon('book')).toBe(BookOpen)
    expect(getMediaEntityIcon('song')).toBe(Music2)
    expect(getMediaEntityIcon('album')).toBe(Disc3)
    expect(getMediaEntityIcon('movie')).toBe(Film)
    expect(getMediaEntityIcon('director')).toBe(Clapperboard)
  })

  it('uses the same media vocabulary for entries and filmography roles', () => {
    expect(getEntryTypeIcon('book')).toBe(BookOpen)
    expect(getEntryTypeIcon('song')).toBe(Music2)
    expect(getEntryTypeIcon('album')).toBe(Disc3)
    expect(getEntryTypeIcon('film')).toBe(Film)
    expect(getScreenCreditIcon('acting')).toBe(Drama)
    expect(getScreenCreditIcon('directing')).toBe(Clapperboard)
    expect(getScreenCreditIcon('writing')).toBe(Pencil)
  })
})
