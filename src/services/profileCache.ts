import type { UniversalMediaEntity } from '../types/mediaEntity'
import { getBrowserCacheValue, setBrowserCacheValue } from './browserCache'

const PROFILE_CACHE_NAMESPACE = 'visited-profile-v1'
const PROFILE_CACHE_TTL = 90 * 24 * 60 * 60 * 1000

export function getCachedProfileEntity(entityId: string) {
  return getBrowserCacheValue<UniversalMediaEntity>(PROFILE_CACHE_NAMESPACE, entityId)
}

export function cacheProfileEntity(entity: UniversalMediaEntity) {
  return setBrowserCacheValue(PROFILE_CACHE_NAMESPACE, entity.id, entity, PROFILE_CACHE_TTL)
}
