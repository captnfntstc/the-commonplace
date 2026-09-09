import { describe, expect, it } from 'vitest'
import { applyPendingSavedEntryChanges, updatePendingSavedEntryChanges } from './persistence'

describe('pending saved entries', () => {
  it('replays saves and unsaves over the last cloud snapshot', () => {
    expect(applyPendingSavedEntryChanges(
      ['already-saved', 'remove-me'],
      { 'new-save': true, 'remove-me': false },
    )).toEqual(['already-saved', 'new-save'])
  })

  it('keeps only the latest pending intent for an entry', () => {
    const first = updatePendingSavedEntryChanges({}, 'entry-1', true)
    expect(updatePendingSavedEntryChanges(first, 'entry-1', false)).toEqual({ 'entry-1': false })
  })
})
