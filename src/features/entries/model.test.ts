import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearPendingEntrySync,
  entryStorageKey,
  hasAccountEntryStorage,
  entrySnapshotsMatch,
  loadEntries,
  loadPendingEntrySync,
  markEntriesPendingSync,
  reconcileEntrySnapshots,
  saveEntriesToStorage,
  type Entry,
} from './model'

function entry(id: string, updatedAt: string, title = id): Entry {
  return {
    id,
    type: 'book',
    title,
    creator: 'Author',
    provider: 'Manual',
    providerId: id,
    rating: 4,
    favoritePassage: '',
    reflection: '',
    createdAt: updatedAt,
    updatedAt,
    coverTone: 'blue',
  }
}

describe('entry persistence recovery', () => {
  beforeEach(() => localStorage.clear())

  it('keeps local-only records and the newest version of shared records', () => {
    const cloud = [
      entry('shared', '2026-09-04T08:00:00.000Z', 'Old cloud title'),
      entry('cloud-only', '2026-09-04T07:00:00.000Z'),
    ]
    const local = [
      entry('local-only', '2026-09-04T10:00:00.000Z'),
      entry('shared', '2026-09-04T09:00:00.000Z', 'New local title'),
    ]

    const reconciled = reconcileEntrySnapshots(cloud, local)

    expect(reconciled.map(({ id }) => id)).toEqual(['local-only', 'shared', 'cloud-only'])
    expect(reconciled.find(({ id }) => id === 'shared')?.title).toBe('New local title')
    expect(entrySnapshotsMatch(reconciled, cloud)).toBe(false)
  })

  it('only clears the pending marker for the completed revision', () => {
    const first = markEntriesPendingSync('user-1', ['entry-1'])
    const latest = markEntriesPendingSync('user-1', ['entry-2'])

    clearPendingEntrySync('user-1', first.token)
    expect(loadPendingEntrySync('user-1')).toEqual(latest)

    clearPendingEntrySync('user-1', latest.token)
    expect(loadPendingEntrySync('user-1')).toBeNull()
  })

  it('isolates fallback entries by Firebase account', () => {
    saveEntriesToStorage([entry('account-a-entry', '2026-09-04T10:00:00.000Z')], 'account-a')
    saveEntriesToStorage([entry('account-b-entry', '2026-09-04T11:00:00.000Z')], 'account-b')

    expect(entryStorageKey('account-a')).toBe('the-commonplace.entries.account-a')
    expect(hasAccountEntryStorage('account-a')).toBe(true)
    expect(loadEntries('account-a').map(({ id }) => id)).toEqual(['account-a-entry'])
    expect(loadEntries('account-b').map(({ id }) => id)).toEqual(['account-b-entry'])
    expect(loadEntries()).toEqual([])
  })
})
