import type { UniversalMediaEntity } from '../types/mediaEntity'
import { getBrowserCacheValue, setBrowserCacheValue } from './browserCache'

const PROFILE_CACHE_NAMESPACE = 'visited-profile-v2'
const LEGACY_PROFILE_CACHE_NAMESPACE = 'visited-profile-v1'
const PROFILE_CACHE_TTL = 90 * 24 * 60 * 60 * 1000

export async function getCachedProfileEntity(entityId: string) {
  const current = await getBrowserCacheValue<UniversalMediaEntity>(PROFILE_CACHE_NAMESPACE, entityId)
  if (current) return current
  return getBrowserCacheValue<UniversalMediaEntity>(LEGACY_PROFILE_CACHE_NAMESPACE, entityId)
}

export function cacheProfileEntity(entity: UniversalMediaEntity) {
  const writes = [setBrowserCacheValue(PROFILE_CACHE_NAMESPACE, entity.id, entity, PROFILE_CACHE_TTL)]
  const canonicalId = entity.humanProfile?.canonicalId
  if (canonicalId && canonicalId !== entity.id) {
    writes.push(setBrowserCacheValue(PROFILE_CACHE_NAMESPACE, canonicalId, entity, PROFILE_CACHE_TTL))
  }
  return Promise.all(writes)
}
