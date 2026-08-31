const LEGACY_SEED_HANDLES = new Set(['elena_r', 'marcus_v', 'aria_s', 'sophiac'])
const LEGACY_SEED_ENTRY_PREFIXES = ['ext-elena-', 'ext-marcus-', 'ext-aria-', 'ext-sophia-']
const LEGACY_SEED_COLLECTION_IDS = new Set(['collection-elena_r-highlights'])

export function isLegacySeedHandle(value?: string | null) {
  return LEGACY_SEED_HANDLES.has(String(value || '').replace(/^@/, '').trim().toLowerCase())
}

export function isLegacySeedEntry(value: { id?: string; authorHandle?: string } | null | undefined) {
  if (!value) return false
  const id = String(value.id || '').toLowerCase()
  return LEGACY_SEED_ENTRY_PREFIXES.some((prefix) => id.startsWith(prefix))
    || isLegacySeedHandle(value.authorHandle)
}

export function isLegacySeedEntryId(value?: string | null) {
  const id = String(value || '').toLowerCase()
  return LEGACY_SEED_ENTRY_PREFIXES.some((prefix) => id.startsWith(prefix))
}

export function isLegacySeedCollection(value: { id?: string; creatorHandle?: string } | null | undefined) {
  if (!value) return false
  return LEGACY_SEED_COLLECTION_IDS.has(String(value.id || '').toLowerCase())
    || isLegacySeedHandle(value.creatorHandle)
}

export function removeLegacySeedHandles(values: string[]) {
  return values.filter((value) => !isLegacySeedHandle(value))
}

export function removeLegacySeedEntryIds(values: string[]) {
  return values.filter((value) => !isLegacySeedEntryId(value))
}

export function purgeLegacySeedStorage() {
  LEGACY_SEED_HANDLES.forEach((handle) => {
    localStorage.removeItem(`the-commonplace.profile-collections.v1:${handle}`)
    localStorage.removeItem(`the-commonplace.saved-profile-collections.v1:${handle}`)
  })

  const rewriteArray = (key: string, keep: (value: unknown) => boolean) => {
    try {
      const raw = localStorage.getItem(key)
      if (raw === null) return
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return
      localStorage.setItem(key, JSON.stringify(parsed.filter(keep)))
    } catch {
      // Leave unrelated malformed local data untouched.
    }
  }

  rewriteArray('the-commonplace.entries', (value) =>
    !isLegacySeedEntry(value as { id?: string; authorHandle?: string }))
  rewriteArray('the-commonplace.likes', (value) => !isLegacySeedEntryId(String(value || '')))
  rewriteArray('the-commonplace.saves', (value) => !isLegacySeedEntryId(String(value || '')))
  rewriteArray('the-commonplace.disabled-comments', (value) => !isLegacySeedEntryId(String(value || '')))
  rewriteArray('the-commonplace.following-users', (value) => !isLegacySeedHandle(String(value || '')))
  rewriteArray('the-commonplace.follow-requests', (value) => !isLegacySeedHandle(String(value || '')))
  rewriteArray('the-commonplace.notifications', (value) =>
    !isLegacySeedHandle((value as { actorHandle?: string })?.actorHandle))
}
