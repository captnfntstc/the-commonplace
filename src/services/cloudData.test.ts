import { describe, expect, it } from 'vitest'
import type { Entry } from '../features/entries/model'
import type { UserProfileState } from '../types/userProfile'
import {
  isAccountCurrentlyDeactivated,
  mergeMigrationSnapshots,
  resolveSavedEntryIds,
  type UserCloudSnapshot,
} from './cloudData'

const profile: UserProfileState = {
  firstName: 'Pat',
  lastName: '',
  showFullName: false,
  handle: 'pat',
  email: 'pat@example.com',
  bio: '',
  avatarUrl: '',
  coverUrl: '',
  showFollowLists: true,
  allowComments: true,
  showSavedActivity: false,
}

function entry(id: string, updatedAt: string): Entry {
  return {
    id,
    type: 'book',
    title: id,
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

function snapshot(entries: Entry[]): UserCloudSnapshot {
  return {
    profile,
    entries,
    state: {
      likedEntryIds: [],
      savedEntryIds: [],
      disabledCommentEntryIds: [],
      followedUserHandles: [],
      followRequestedHandles: [],
      notifications: [],
    },
  }
}

describe('account visibility', () => {
  const now = Date.parse('2026-09-01T00:00:00.000Z')

  it('keeps accounts unavailable until a scheduled return date', () => {
    expect(isAccountCurrentlyDeactivated({
      accountStatus: 'deactivated',
      reactivatesAt: { toMillis: () => now + 60_000 },
    }, now)).toBe(true)

    expect(isAccountCurrentlyDeactivated({
      accountStatus: 'deactivated',
      reactivatesAt: { toMillis: () => now - 1 },
    }, now)).toBe(false)
  })

  it('disables automatic reactivation when no return date exists', () => {
    expect(isAccountCurrentlyDeactivated({
      accountStatus: 'deactivated',
      reactivatesAt: null,
    }, now)).toBe(true)
    expect(isAccountCurrentlyDeactivated({ accountStatus: 'active' }, now)).toBe(false)
  })
})

describe('saved entry recovery', () => {
  it('uses the newest redundant saved-entry document', () => {
    expect(resolveSavedEntryIds(
      { savedEntryIds: ['old-save'], updatedAt: '2026-09-03T01:00:00.000Z' },
      { entryIds: ['new-save'], updatedAt: '2026-09-03T01:00:01.000Z' },
    )).toEqual(['new-save'])

    expect(resolveSavedEntryIds(
      { savedEntryIds: ['new-save'], updatedAt: '2026-09-03T01:00:02.000Z' },
      { entryIds: ['old-save'], updatedAt: '2026-09-03T01:00:01.000Z' },
    )).toEqual(['new-save'])
  })
})

describe('account migration recovery', () => {
  it('never replaces existing cloud entries with an empty local snapshot', () => {
    const merged = mergeMigrationSnapshots(
      snapshot([entry('cloud-entry', '2026-09-04T10:00:00.000Z')]),
      snapshot([]),
    )

    expect(merged.entries.map(({ id }) => id)).toEqual(['cloud-entry'])
  })

  it('merges local-only and cloud-only entries during migration', () => {
    const merged = mergeMigrationSnapshots(
      snapshot([entry('cloud-entry', '2026-09-04T10:00:00.000Z')]),
      snapshot([entry('local-entry', '2026-09-04T11:00:00.000Z')]),
    )

    expect(merged.entries.map(({ id }) => id)).toEqual(['local-entry', 'cloud-entry'])
  })
})
