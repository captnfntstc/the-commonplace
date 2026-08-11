import type { UniversalMediaEntity } from '../types/mediaEntity'

/**
 * Universal Media Entities Registry.
 * All hardcoded media entities (songs, albums, artists, films, TV shows, books, games)
 * have been removed. Entities are fetched and resolved dynamically from live APIs
 * (iTunes/Apple Music, TMDB, Google Books, RAWG, IGDB, Steam).
 */
export const UNIVERSAL_MEDIA_ENTITIES: Record<string, UniversalMediaEntity> = {}
