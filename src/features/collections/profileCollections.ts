import type { MetadataResult } from '../../metadata'
import { getDefaultCoverTone, type Entry, type EntryType } from '../entries/model'
import { isLegacySeedCollection } from '../../utils/legacySeedCleanup'

export type ProfileCollectionItem = {
  id: string
  entryId?: string
  type: EntryType
  title: string
  creator: string
  provider: string
  providerId: string
  coverUrl?: string
  year?: string
  genre?: string
}

export type ProfileCollection = {
  id: string
  name: string
  creatorName?: string
  creatorHandle?: string
  types: EntryType[]
  description?: string
  entryIds?: string[]
  items?: ProfileCollectionItem[]
  coverMode?: 'auto' | 'custom'
  customCoverUrl?: string
}

function normalizeProfileHandle(handle: string) {
  return handle.replace(/^@/, '').trim().toLowerCase()
}

export function collectionsCreatedByProfile(
  collections: ProfileCollection[],
  profileHandle: string,
) {
  const ownerHandle = normalizeProfileHandle(profileHandle)
  return collections.filter((collection) => {
    const creatorHandle = normalizeProfileHandle(collection.creatorHandle || '')
    // Older collections did not store creatorHandle; their profile-scoped
    // storage location remains the ownership source for those records.
    return !creatorHandle || creatorHandle === ownerHandle
  })
}

function normalizeCollectionItemText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * A provider-independent media identity. Reviews of the same work can arrive
 * with different entry/provider IDs, so title + creator is the reliable key
 * for keeping collection pickers and saved collections duplicate-free.
 */
export function profileCollectionItemIdentity(item: Pick<ProfileCollectionItem, 'type' | 'title' | 'creator'>) {
  return [
    item.type,
    normalizeCollectionItemText(item.title),
    normalizeCollectionItemText(item.creator),
  ].join(':')
}

export function uniqueProfileCollectionItems(items: ProfileCollectionItem[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    const identity = profileCollectionItemIdentity(item)
    if (seen.has(identity)) return false
    seen.add(identity)
    return true
  })
}

/**
 * Builds a shuffled, popularity-weighted recommendation list from community
 * demand. Multiple reviews increase a work's chance of appearing near the
 * top, but every work is returned at most once.
 */
export function buildPopularCollectionRecommendations(
  entries: Entry[],
  random: () => number = Math.random,
) {
  const grouped = new Map<string, { item: ProfileCollectionItem; demand: number }>()

  entries.forEach((entry) => {
    const item = profileCollectionItemFromEntry(entry)
    const identity = profileCollectionItemIdentity(item)
    const current = grouped.get(identity)
    if (!current) {
      grouped.set(identity, { item, demand: 1 })
      return
    }

    current.demand += 1
    if (!current.item.coverUrl && item.coverUrl) current.item = item
  })

  const recommendations = [...grouped.values()]
    .map(({ item, demand }) => {
      const popularityWeight = Math.max(1, demand * 3)
      const draw = Math.max(Number.EPSILON, Math.min(1 - Number.EPSILON, random()))
      return { item, rank: Math.pow(draw, 1 / popularityWeight) }
    })
    .sort((left, right) => right.rank - left.rank)
    .map(({ item }) => item)
    .slice(0, 20)

  return recommendations.length > 1 && recommendations.length % 2 !== 0
    ? recommendations.slice(0, -1)
    : recommendations
}

const STORAGE_PREFIX = 'the-commonplace.profile-collections.v1'
const SAVED_STORAGE_PREFIX = 'the-commonplace.saved-profile-collections.v1'

function storageKey(handle: string) {
  return `${STORAGE_PREFIX}:${handle.replace(/^@/, '').toLowerCase()}`
}

function readCollections(key: string, fallback: ProfileCollection[] = []): ProfileCollection[] {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    const parsed = JSON.parse(raw) as ProfileCollection[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (collection) =>
        collection &&
        !isLegacySeedCollection(collection) &&
        typeof collection.id === 'string' &&
        typeof collection.name === 'string' &&
        Array.isArray(collection.types) &&
        (collection.items === undefined || Array.isArray(collection.items)),
    )
  } catch {
    return []
  }
}

export function loadProfileCollections(handle: string, fallback: ProfileCollection[] = []): ProfileCollection[] {
  return readCollections(storageKey(handle), fallback)
}

export function saveProfileCollections(handle: string, collections: ProfileCollection[]) {
  localStorage.setItem(storageKey(handle), JSON.stringify(collections))
}

export function loadSavedProfileCollections(handle: string): ProfileCollection[] {
  return readCollections(`${SAVED_STORAGE_PREFIX}:${handle.replace(/^@/, '').toLowerCase()}`)
}

export function saveSavedProfileCollections(handle: string, collections: ProfileCollection[]) {
  localStorage.setItem(
    `${SAVED_STORAGE_PREFIX}:${handle.replace(/^@/, '').toLowerCase()}`,
    JSON.stringify(collections),
  )
}

export function createProfileCollection(
  name: string,
  types: EntryType[] = [],
  options: Pick<ProfileCollection, 'creatorName' | 'creatorHandle' | 'description' | 'entryIds' | 'items' | 'coverMode' | 'customCoverUrl'> = {},
): ProfileCollection {
  return {
    id: `collection-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim(),
    types: [...new Set(types)],
    ...options,
  }
}

export function profileCollectionItemFromEntry(entry: Entry): ProfileCollectionItem {
  return {
    id: `entry:${entry.id}`,
    entryId: entry.id,
    type: entry.type,
    title: entry.title,
    creator: entry.creator,
    provider: entry.provider,
    providerId: entry.providerId,
    coverUrl: entry.coverUrl,
    year: entry.year,
    genre: entry.genre,
  }
}

export function profileCollectionItemFromMetadata(result: MetadataResult): ProfileCollectionItem {
  const providerId = result.providerId || result.id
  return {
    id: `media:${result.type}:${providerId}`,
    type: result.type,
    title: result.title,
    creator: result.creator,
    provider: result.provider,
    providerId,
    coverUrl: result.coverUrl,
    year: result.year,
    genre: result.genre,
  }
}

export function profileCollectionHasItem(collection: ProfileCollection, item: ProfileCollectionItem) {
  const identity = profileCollectionItemIdentity(item)
  return Boolean(collection.items?.some((current) =>
    current.id === item.id || profileCollectionItemIdentity(current) === identity,
  ))
}

export function addItemToProfileCollection(
  collection: ProfileCollection,
  item: ProfileCollectionItem,
  options: { allowDuplicate?: boolean } = {},
): ProfileCollection {
  const alreadyExists = profileCollectionHasItem(collection, item)
  if (alreadyExists && !options.allowDuplicate) return collection
  const itemToAdd = alreadyExists
    ? duplicateProfileCollectionItem(item)
    : item
  const items = [itemToAdd, ...(collection.items ?? [])]
  return {
    ...collection,
    items,
    entryIds: [...new Set([...(collection.entryIds ?? []), ...(itemToAdd.entryId ? [itemToAdd.entryId] : [])])],
    types: [...new Set([...collection.types, item.type])],
  }
}

export function duplicateProfileCollectionItem(item: ProfileCollectionItem): ProfileCollectionItem {
  return {
    ...item,
    id: `${item.id}:copy:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  }
}

export function entriesForProfileCollection(entries: Entry[], collection?: ProfileCollection | null) {
  if (!collection) return []
  if (collection.items) {
    const entriesById = new Map(entries.map((entry) => [entry.id, entry]))
    return collection.items.map((item) => {
      const catalogEntry = item.entryId ? entriesById.get(item.entryId) : undefined
      if (catalogEntry) {
        return item.id === `entry:${catalogEntry.id}`
          ? catalogEntry
          : { ...catalogEntry, id: item.id }
      }
      return {
        id: item.id,
        type: item.type,
        title: item.title,
        creator: item.creator,
        provider: item.provider,
        providerId: item.providerId,
        genre: item.genre,
        rating: 0,
        favoritePassage: '',
        reflection: '',
        year: item.year,
        coverUrl: item.coverUrl,
        createdAt: '1970-01-01T00:00:00.000Z',
        updatedAt: '1970-01-01T00:00:00.000Z',
        coverTone: getDefaultCoverTone(item.type),
      } satisfies Entry
    })
  }
  if (collection.entryIds) {
    const entriesById = new Map(entries.map((entry) => [entry.id, entry]))
    return collection.entryIds
      .map((entryId) => entriesById.get(entryId))
      .filter((entry): entry is Entry => entry !== undefined)
  }
  const allowedTypes = new Set(collection.types)
  return entries.filter((entry) => allowedTypes.has(entry.type))
}
