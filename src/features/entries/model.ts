import { BookOpen, Clapperboard, Disc3, Gamepad2, Music4, Tv } from 'lucide-react'
import type { Alignment } from '../../components/CommonplaceCard/FormattedText'
import { stripHtmlAlignment } from '../../components/CommonplaceCard/FormattedText'
import type { MetadataResult, MetadataType } from '../../metadata'
import { resolveArtworkUrl } from '../../utils/artwork'

export type EntryType = MetadataType
export type CoverTone = 'gold' | 'rose' | 'sage' | 'blue' | 'violet' | 'ember'

export type Entry = {
  id: string
  type: EntryType
  title: string
  creator: string
  provider: string
  providerId: string
  genre?: string
  rating: number
  favoritePassage: string
  reflection: string
  reflectionAlign?: Alignment
  passageAlign?: Alignment
  enableDropCap?: boolean
  year?: string
  coverUrl?: string
  summary?: string
  explicit?: boolean
  preferWikipediaArtwork?: boolean
  createdAt: string
  updatedAt: string
  coverTone: CoverTone
  authorHandle?: string
  authorName?: string
  authorAvatarUrl?: string
}

export type EntryDraft = Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>

export const ENTRY_STORAGE_KEY = 'the-commonplace.entries'

export const entryTypes: Array<{
  id: EntryType
  label: string
  Icon: typeof BookOpen
}> = [
  { id: 'album', label: 'Albums', Icon: Disc3 },
  { id: 'book', label: 'Books', Icon: BookOpen },
  { id: 'film', label: 'Films', Icon: Clapperboard },
  { id: 'game', label: 'Games', Icon: Gamepad2 },
  { id: 'song', label: 'Songs', Icon: Music4 },
  { id: 'tv', label: 'Shows', Icon: Tv },
]

const defaultCoverToneByType: Record<EntryType, CoverTone> = {
  album: 'gold',
  book: 'blue',
  film: 'ember',
  game: 'rose',
  song: 'violet',
  tv: 'sage',
}

const sampleEntryIds = new Set([
  'entry-1', 'entry-2', 'entry-3', 'entry-4', 'entry-5',
  'entry-6', 'entry-7', 'entry-8', 'entry-9',
])

export const emptyDraft: EntryDraft = {
  type: 'album',
  title: '',
  creator: '',
  provider: 'Manual',
  providerId: '',
  genre: '',
  rating: 0,
  favoritePassage: '',
  reflection: '',
  reflectionAlign: 'left',
  passageAlign: 'left',
  enableDropCap: false,
  coverTone: 'gold',
}

export function loadEntries(): Entry[] {
  const stored = localStorage.getItem(ENTRY_STORAGE_KEY)
  if (!stored) return []

  try {
    const parsed = JSON.parse(stored) as Entry[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((entry) => !sampleEntryIds.has(entry.id))
      .map((entry) => {
        const { cleanText: cleanRef, align: refAlign } = stripHtmlAlignment(entry.reflection || '')
        const { cleanText: cleanPas, align: pasAlign } = stripHtmlAlignment(entry.favoritePassage || '')
        return {
          ...entry,
          reflection: cleanRef,
          favoritePassage: cleanPas,
          reflectionAlign: entry.reflectionAlign || refAlign || 'left',
          passageAlign: entry.passageAlign || pasAlign || 'left',
        }
      })
  } catch {
    return []
  }
}

export function saveEntriesToStorage(entries: Entry[]) {
  localStorage.setItem(ENTRY_STORAGE_KEY, JSON.stringify(entries))
}

export function makeEntryId() {
  return `entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function getDefaultCoverTone(type: EntryType) {
  return defaultCoverToneByType[type]
}

export function usesSquareArtwork(type: EntryType) {
  return type === 'album' || type === 'song'
}

export function getTypeMeta(type: EntryType) {
  return entryTypes.find((entryType) => entryType.id === type) ?? entryTypes[0]
}

export function draftFromMetadata(result: MetadataResult, current: EntryDraft): EntryDraft {
  const provider = result.provider && result.provider !== result.year
    ? result.provider
    : (result.genre || '')

  return {
    ...current,
    type: result.type,
    title: result.title,
    creator: result.creator,
    provider,
    providerId: result.providerId,
    year: result.year,
    genre: result.genre,
    coverUrl: resolveArtworkUrl(result.coverUrl, result.title, result.type),
    summary: result.summary,
    explicit: result.explicit,
    preferWikipediaArtwork:
      result.type === 'game' && (
        Boolean(result.preferWikipediaArtwork) || /rawg|steam/i.test(result.gameMetadata?.metadataSource || '')
      ),
    coverTone: getDefaultCoverTone(result.type),
  }
}
