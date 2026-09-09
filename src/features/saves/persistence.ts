export type PendingSavedEntryChanges = Record<string, boolean>

export function applyPendingSavedEntryChanges(
  savedEntryIds: string[],
  pendingChanges: PendingSavedEntryChanges,
) {
  const next = new Set(savedEntryIds)
  Object.entries(pendingChanges).forEach(([entryId, saved]) => {
    if (saved) next.add(entryId)
    else next.delete(entryId)
  })
  return Array.from(next)
}

export function updatePendingSavedEntryChanges(
  pendingChanges: PendingSavedEntryChanges,
  entryId: string,
  saved: boolean,
) {
  return { ...pendingChanges, [entryId]: saved }
}
