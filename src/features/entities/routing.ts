import type { MetadataResult, MetadataType } from '../../metadata'
import type { MediaEntityType, UniversalMediaEntity } from '../../types/mediaEntity'
import { resolveArtworkUrl } from '../../utils/artwork'

export function metadataTypeToEntityType(type: MetadataType): MediaEntityType {
  if (type === 'film') return 'movie'
  return type
}

const entityRouteSegmentByType: Record<MediaEntityType, string> = {
  human: 'people',
  artist: 'artists',
  album: 'albums',
  song: 'songs',
  author: 'authors',
  book: 'books',
  movie: 'films',
  tv: 'shows',
  actor: 'actors',
  director: 'directors',
  creator: 'creators',
  game: 'games',
  game_studio: 'game-studios',
}

export const entityTypeByRouteSegment: Record<string, MediaEntityType> = {
  people: 'human',
  artists: 'artist',
  albums: 'album',
  songs: 'song',
  authors: 'author',
  books: 'book',
  films: 'movie',
  movies: 'movie',
  shows: 'tv',
  tv: 'tv',
  actors: 'actor',
  directors: 'director',
  creators: 'creator',
  games: 'game',
  studios: 'game_studio',
  'game-studios': 'game_studio',
}

export function routeSegment(value: string) {
  return encodeURIComponent(value.replace(/^@/, ''))
}

export function decodeRouteSegment(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function inferEntityTypeFromId(entityId: string): MediaEntityType {
  const normalizedId = entityId.toLowerCase()
  if (normalizedId.startsWith('human:')) return 'human'
  if (normalizedId.startsWith('itunes:song:') || normalizedId.startsWith('song-')) return 'song'
  if (normalizedId.startsWith('itunes:album:') || normalizedId.startsWith('album-') || normalizedId.includes('ep')) return 'album'
  if (normalizedId.startsWith('itunes:artist:')) return 'artist'
  if (normalizedId.startsWith('googlebooks:book:') || normalizedId.startsWith('book-')) return 'book'
  if (normalizedId.startsWith('tmdb:movie:') || normalizedId.startsWith('movie-') || normalizedId.startsWith('film-')) return 'movie'
  if (normalizedId.startsWith('tmdb:tv:') || normalizedId.startsWith('tv-') || normalizedId.startsWith('show-')) return 'tv'
  if (
    normalizedId.startsWith('game-') ||
    normalizedId.startsWith('igdb:game:') ||
    normalizedId.startsWith('rawg:game:') ||
    normalizedId.startsWith('steam:game:')
  ) return 'game'
  if (/^author[-:]/i.test(entityId)) return 'author'
  if (/^director[-:]/i.test(entityId)) return 'director'
  if (/^creator[-:]/i.test(entityId)) return 'creator'
  if (/^actor[-:]/i.test(entityId)) return 'actor'
  if (/^(?:studio|game-studio)[-:]/i.test(entityId)) return 'game_studio'
  return 'artist'
}

export function getEntityRoutePath(entityId: string, type: MediaEntityType) {
  return `/${entityRouteSegmentByType[type]}/${routeSegment(entityId)}`
}

export function metadataTypeLabel(type: MetadataType) {
  if (type === 'film') return 'Film'
  if (type === 'tv') return 'Show'
  return type.charAt(0).toUpperCase() + type.slice(1)
}

export function creatorLabelForMetadata(type: MetadataType) {
  if (type === 'book') return 'Author'
  if (type === 'film') return 'Director'
  if (type === 'tv') return 'Creator'
  if (type === 'game') return 'Studio'
  return 'Artist'
}

export function metadataResultToUniversalEntity(entity: { id: string; metadataResult: MetadataResult }): UniversalMediaEntity {
  const result = entity.metadataResult
  const categoryLabel = metadataTypeLabel(result.type)
  const detail = result.provider || result.genre || result.year || categoryLabel

  return {
    id: entity.id,
    name: result.title,
    type: metadataTypeToEntityType(result.type),
    categoryLabel,
    artworkUrl: resolveArtworkUrl(result.coverUrl || '', result.title, result.type),
    providerId: result.providerId,
    explicit: result.explicit,
    preferWikipediaArtwork:
      result.type === 'game' && (
        Boolean(result.preferWikipediaArtwork) || /rawg|steam/i.test(result.gameMetadata?.metadataSource || '')
      ),
    gameMetadata: result.gameMetadata,
    description:
      result.summary ||
      `Catalog entry for ${result.title}${result.creator ? ` by ${result.creator}` : ''} in The Commonplace community archive.`,
    metadataChips: [
      { label: creatorLabelForMetadata(result.type), value: result.creator || 'Unknown' },
      { label: 'Category', value: categoryLabel },
      ...(result.genres?.length || result.genre
        ? [{ label: 'Genre', value: (result.genres?.length ? result.genres : [result.genre]).filter(Boolean).join(', ') }]
        : []),
      ...(result.language ? [{ label: 'Language', value: result.language.toUpperCase() }] : []),
      ...(detail ? [{ label: result.year && detail === result.year ? 'Year' : 'Detail', value: detail }] : []),
      ...(result.year && detail !== result.year ? [{ label: 'Year', value: result.year }] : []),
      ...(result.explicit ? [{ label: 'Explicit', value: 'Yes' }] : []),
    ],
    communityRating: {
      average: 4.7,
      count: 0,
      distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    },
  }
}
