import { emptyDraft, type EntryDraft } from './model'

const ENTRY_DRAFTS_STORAGE_PREFIX = 'the-commonplace.entry-drafts.v1'

export type SavedEntryDraft = {
  id: string
  createdAt: string
  updatedAt: string
  draft: EntryDraft
  lyrics: string
  metadataQuery: string
}

function storageKey(ownerId: string) {
  return `${ENTRY_DRAFTS_STORAGE_PREFIX}.${encodeURIComponent(ownerId || 'local')}`
}

function normalizeRichText(value?: string) {
  const source = value || ''
  const visibleText = source
    .replace(/<br\s*\/?>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
  return visibleText ? source.trim() : ''
}

function comparableDraft(draft: EntryDraft) {
  const title = draft.title.trim()
  const providerId = draft.providerId.trim()
  const hasSelectedMedia = Boolean(title || providerId)

  return {
    type: draft.type,
    title,
    creator: hasSelectedMedia ? draft.creator.trim() : '',
    provider: hasSelectedMedia ? draft.provider.trim() : '',
    providerId,
    genre: hasSelectedMedia ? (draft.genre || '').trim() : '',
    rating: draft.rating,
    favoritePassage: normalizeRichText(draft.favoritePassage),
    reflection: normalizeRichText(draft.reflection),
    reflectionAlign: draft.reflectionAlign || 'left',
    passageAlign: draft.passageAlign || 'left',
    enableDropCap: Boolean(draft.enableDropCap),
    year: hasSelectedMedia ? (draft.year || '').trim() : '',
    coverUrl: hasSelectedMedia ? (draft.coverUrl || '').trim() : '',
    summary: hasSelectedMedia ? (draft.summary || '').trim() : '',
    explicit: hasSelectedMedia && Boolean(draft.explicit),
    preferWikipediaArtwork: hasSelectedMedia && Boolean(draft.preferWikipediaArtwork),
    coverTone: draft.coverTone,
    ownerId: draft.ownerId || '',
    authorHandle: draft.authorHandle || '',
    authorName: draft.authorName || '',
    authorAvatarUrl: draft.authorAvatarUrl || '',
    visibility: draft.visibility || 'public',
  }
}

export function entryDraftsMatch(left: EntryDraft, right: EntryDraft) {
  return JSON.stringify(comparableDraft(left)) === JSON.stringify(comparableDraft(right))
}

export function loadEntryDrafts(ownerId: string): SavedEntryDraft[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(ownerId)) || '[]') as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item): item is SavedEntryDraft => Boolean(
        item && typeof item === 'object' && 'id' in item && 'draft' in item && 'updatedAt' in item,
      ))
      .map((item) => ({
        ...item,
        lyrics: typeof item.lyrics === 'string' ? item.lyrics : '',
        metadataQuery: typeof item.metadataQuery === 'string' ? item.metadataQuery : item.draft.title || '',
        draft: { ...emptyDraft, ...item.draft },
      }))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  } catch {
    return []
  }
}

export function saveEntryDraft(
  ownerId: string,
  draft: EntryDraft,
  lyrics = '',
  metadataQuery = draft.title,
  existingId?: string | null,
) {
  const current = loadEntryDrafts(ownerId)
  const now = new Date().toISOString()
  const existing = current.find((item) => item.id === existingId)
  const saved: SavedEntryDraft = {
    id: existing?.id || `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    draft: { ...draft },
    lyrics,
    metadataQuery,
  }
  const next = [saved, ...current.filter((item) => item.id !== saved.id)]
  localStorage.setItem(storageKey(ownerId), JSON.stringify(next))
  return next
}

export function deleteEntryDraft(ownerId: string, draftId: string) {
  const next = loadEntryDrafts(ownerId).filter((item) => item.id !== draftId)
  localStorage.setItem(storageKey(ownerId), JSON.stringify(next))
  return next
}
