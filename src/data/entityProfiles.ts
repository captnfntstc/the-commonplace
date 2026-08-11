import type { EntityProfile } from '../types/mediaEntity'

/**
 * Entity Profiles Registry.
 * All hardcoded entity profiles have been removed in favor of dynamic live API metadata resolution.
 */
export const MOCK_ENTITY_PROFILES: Record<string, EntityProfile> = {}
