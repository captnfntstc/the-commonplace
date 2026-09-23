import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyDraft } from './model'
import { deleteEntryDraft, entryDraftsMatch, loadEntryDrafts, saveEntryDraft } from './draftStorage'

describe('entry draft storage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useRealTimers()
  })

  it('treats visually empty rich text and cleared metadata queries as pristine', () => {
    expect(entryDraftsMatch(
      { ...emptyDraft, provider: '', reflection: '<p><br></p>' },
      emptyDraft,
    )).toBe(true)
  })

  it('saves, updates, and deletes an account-scoped draft', () => {
    const first = saveEntryDraft('reader-one', { ...emptyDraft, type: 'book', reflection: 'First thought' })
    const draftId = first[0].id
    saveEntryDraft('reader-one', { ...emptyDraft, type: 'book', reflection: 'Updated thought' }, '', '', draftId)

    expect(loadEntryDrafts('reader-one')).toHaveLength(1)
    expect(loadEntryDrafts('reader-one')[0].draft.reflection).toBe('Updated thought')
    expect(loadEntryDrafts('reader-two')).toEqual([])

    deleteEntryDraft('reader-one', draftId)
    expect(loadEntryDrafts('reader-one')).toEqual([])
  })
})
