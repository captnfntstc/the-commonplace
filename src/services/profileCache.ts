import type { UniversalMediaEntity } from '../types/mediaEntity'
import { isMusicProfession, isWritingProfession, professionLabel } from '../features/profiles/humanProfile'
import { clearBrowserCacheNamespace, getBrowserCacheValue, setBrowserCacheValue } from './browserCache'

const PROFILE_CACHE_NAMESPACE = 'visited-profile-v3'
const IDENTITY_ALIAS_NAMESPACE = 'identity-alias-v1'
const PROFILE_CACHE_TTL = 90 * 24 * 60 * 60 * 1000
const MIGRATION_MARKER = 'the-commonplace.identity-cache-v1'

export function repairCachedProfileEntity(entity: UniversalMediaEntity): UniversalMediaEntity {
  if (entity.type !== 'human' || !entity.identity || !entity.humanProfile) return entity

  const professions = entity.identity.professions
  const providerIds = entity.identity.providerIds
  const primaryProfession = entity.identity.primaryProfession || professions[0]
  const hasWritingProfession = professions.some(isWritingProfession)
  const hasVerifiedMusicCatalog = professions.some(isMusicProfession) && Boolean(providerIds.itunesArtistId)

  return {
    ...entity,
    categoryLabel: professionLabel(primaryProfession),
    humanProfile: {
      ...entity.humanProfile,
      context: primaryProfession,
      primaryProfession,
      professions,
      occupationLabels: entity.identity.occupationLabels,
      providerIds,
      capabilities: {
        ...entity.humanProfile.capabilities,
        topSongs: hasVerifiedMusicCatalog,
        discography: hasVerifiedMusicCatalog,
        publishedWorks: hasWritingProfession || entity.humanProfile.capabilities.publishedWorks,
        writing: hasWritingProfession || entity.humanProfile.capabilities.writing,
      },
    },
  }
}

export async function getCachedProfileEntity(entityId: string) {
  const alias = await getBrowserCacheValue<string>(IDENTITY_ALIAS_NAMESPACE, entityId)
  const cachedEntity = await getBrowserCacheValue<UniversalMediaEntity>(PROFILE_CACHE_NAMESPACE, alias || entityId)
  if (!cachedEntity) return undefined
  const repairedEntity = repairCachedProfileEntity(cachedEntity)
  if (repairedEntity !== cachedEntity) void cacheProfileEntity(repairedEntity)
  return repairedEntity
}

export function cacheProfileEntity(entity: UniversalMediaEntity) {
  const writes = [setBrowserCacheValue(PROFILE_CACHE_NAMESPACE, entity.id, entity, PROFILE_CACHE_TTL)]
  const canonicalId = entity.humanProfile?.canonicalId
  if (canonicalId && canonicalId !== entity.id) {
    writes.push(setBrowserCacheValue(PROFILE_CACHE_NAMESPACE, canonicalId, entity, PROFILE_CACHE_TTL))
  }
  return Promise.all(writes)
}

export function cacheIdentityAlias(sourceId: string, canonicalId: string) {
  if (!sourceId || !canonicalId || sourceId === canonicalId) return Promise.resolve()
  return setBrowserCacheValue(IDENTITY_ALIAS_NAMESPACE, sourceId, canonicalId, PROFILE_CACHE_TTL)
}

export async function migrateUnsafeIdentityCaches() {
  if (typeof localStorage === 'undefined' || localStorage.getItem(MIGRATION_MARKER) === 'done') return
  await Promise.all([
    clearBrowserCacheNamespace('visited-profile-v1'),
    clearBrowserCacheNamespace('visited-profile-v2'),
    clearBrowserCacheNamespace('external-api-v7'),
    clearBrowserCacheNamespace('metadata-search-v9'),
  ])
  localStorage.setItem(MIGRATION_MARKER, 'done')
}
