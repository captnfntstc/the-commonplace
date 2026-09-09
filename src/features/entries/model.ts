import { BookOpen } from 'lucide-react'
import type { Alignment } from '../../components/CommonplaceCard/FormattedText'
import { stripHtmlAlignment } from '../../components/CommonplaceCard/FormattedText'
import type { MetadataResult, MetadataType } from '../../metadata'
import { resolveArtworkUrl } from '../../utils/artwork'
import { getEntryTypeIcon } from '../../utils/mediaIcons'
import { isLegacySeedEntry } from '../../utils/legacySeedCleanup'

export type EntryType = MetadataType
export type CoverTone = 'gold' | 'rose' | 'sage' | 'blue' | 'violet' | 'ember'

export type Entry = {
  id: string
  ownerId?: string
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
  visibility?: 'public' | 'mutual'
}

export type EntryDraft = Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>

export const ENTRY_STORAGE_KEY = 'the-commonplace.entries'
const PENDING_ENTRY_SYNC_STORAGE_PREFIX = 'the-commonplace.pending-entry-sync.'

export type PendingEntrySync = {
  token: string
  disabledCommentEntryIds: string[]
}

export const entryTypes: Array<{
  id: EntryType
  label: string
  Icon: typeof BookOpen
}> = [
  { id: 'album', label: 'Albums', Icon: getEntryTypeIcon('album') },
  { id: 'book', label: 'Books', Icon: getEntryTypeIcon('book') },
  { id: 'film', label: 'Films', Icon: getEntryTypeIcon('film') },
  { id: 'game', label: 'Games', Icon: getEntryTypeIcon('game') },
  { id: 'song', label: 'Songs', Icon: getEntryTypeIcon('song') },
  { id: 'tv', label: 'Shows', Icon: getEntryTypeIcon('tv') },
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

export function entryStorageKey(userId?: string | null) {
  return userId ? `${ENTRY_STORAGE_KEY}.${userId}` : ENTRY_STORAGE_KEY
}

export function hasAccountEntryStorage(userId: string) {
  return localStorage.getItem(entryStorageKey(userId)) !== null
}

export function loadEntries(userId?: string | null): Entry[] {
  const stored = localStorage.getItem(entryStorageKey(userId))
  if (!stored) return []

  try {
    const parsed = JSON.parse(stored) as Entry[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((entry) => !sampleEntryIds.has(entry.id) && !isLegacySeedEntry(entry))
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

export function saveEntriesToStorage(entries: Entry[], userId?: string | null) {
  localStorage.setItem(entryStorageKey(userId), JSON.stringify(entries))
}

function pendingEntrySyncStorageKey(userId: string) {
  return `${PENDING_ENTRY_SYNC_STORAGE_PREFIX}${userId}`
}

export function markEntriesPendingSync(userId: string, disabledCommentEntryIds: string[]) {
  const pending: PendingEntrySync = {
    token: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    disabledCommentEntryIds,
  }
  localStorage.setItem(pendingEntrySyncStorageKey(userId), JSON.stringify(pending))
  return pending
}

export function loadPendingEntrySync(userId: string): PendingEntrySync | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(pendingEntrySyncStorageKey(userId)) || 'null')
    if (!parsed || typeof parsed.token !== 'string') return null
    return {
      token: parsed.token,
      disabledCommentEntryIds: Array.isArray(parsed.disabledCommentEntryIds)
        ? parsed.disabledCommentEntryIds.filter((value: unknown): value is string => typeof value === 'string')
        : [],
    }
  } catch {
    return null
  }
}

export function clearPendingEntrySync(userId: string, token: string) {
  if (loadPendingEntrySync(userId)?.token !== token) return
  localStorage.removeItem(pendingEntrySyncStorageKey(userId))
}

export function reconcileEntrySnapshots(cloudEntries: Entry[], localEntries: Entry[]) {
  const reconciled = new Map(cloudEntries.map((entry) => [entry.id, entry]))
  localEntries.forEach((localEntry) => {
    const cloudEntry = reconciled.get(localEntry.id)
    if (!cloudEntry || localEntry.updatedAt >= cloudEntry.updatedAt) {
      reconciled.set(localEntry.id, localEntry)
    }
  })
  return Array.from(reconciled.values())
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

export function entrySnapshotsMatch(left: Entry[], right: Entry[]) {
  if (left.length !== right.length) return false
  const rightVersions = new Map(right.map((entry) => [entry.id, entry.updatedAt]))
  return left.every((entry) => rightVersions.get(entry.id) === entry.updatedAt)
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
