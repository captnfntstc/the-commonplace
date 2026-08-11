export type MediaEntityType =
  | 'artist'
  | 'album'
  | 'song'
  | 'author'
  | 'book'
  | 'movie'
  | 'tv'
  | 'actor'
  | 'director'
  | 'game'
  | 'game_studio'

export interface MetadataChip {
  label: string
  value: string
}

export interface TopContentItem {
  id: string
  rank: number
  title: string
  subtitle: string
  artworkUrl?: string
  rating?: number
  explicit?: boolean
}

export interface CollectionItem {
  id: string
  title: string
  subtitle: string
  artworkUrl: string
  year?: string
  rating?: number
  genre?: string
  category?: 'album' | 'ep' | 'single'
  explicit?: boolean
}

export interface RelatedEntityItem {
  id: string
  title: string
  subtitle: string
  artworkUrl: string
  type: MediaEntityType
}

export type GamePlatformStatus = 'available' | 'upcoming' | 'announced' | 'discontinued'

export interface GamePlatformRelease {
  platform: string
  releaseDate?: string
  status?: GamePlatformStatus
  distribution?: Array<'Digital' | 'Physical'>
  notes?: string
}

export interface GameSystemRequirementSet {
  os?: string
  processor?: string
  memory?: string
  graphics?: string
  storage?: string
  directX?: string
  network?: string
  sound?: string
  additionalNotes?: string
}

export interface GameEdition {
  name: string
  description?: string
  includedContent?: string[]
  releaseDate?: string
  platforms?: string[]
}

export interface GameMetadata {
  developers?: string[]
  publishers?: string[]
  genres?: string[]
  franchise?: string
  gameModes?: string[]
  engine?: string
  ageRating?: string
  releaseDate?: string
  officialWebsite?: string
  platforms?: GamePlatformRelease[]
  pcRequirements?: {
    minimum?: GameSystemRequirementSet
    recommended?: GameSystemRequirementSet
  }
  features?: string[]
  editions?: GameEdition[]
  metadataSource?: string
  metadataUpdatedAt?: string
}

export interface UniversalMediaEntity {
  id: string
  name: string
  type: MediaEntityType
  categoryLabel: string // e.g. "Artist", "Movie", "Game Studio", "Author", etc.
  artworkUrl: string
  description: string // 2-5 sentence warm editorial description
  providerId?: string // provider track/album id so exact metadata can be refetched
  explicit?: boolean
  gameMetadata?: GameMetadata
  metadataChips: MetadataChip[]
  communityRating: {
    average: number
    count: number
    distribution: { [stars: number]: number } // percentages 1-5
  }
  primaryCollection?: {
    title: string
    items: TopContentItem[]
  }
  secondaryCollection?: {
    title: string
    items: CollectionItem[]
  }
  relatedEntities?: {
    title: string
    items: RelatedEntityItem[]
  }
}

export function getEntityTabs(type: MediaEntityType): { id: string; label: string }[] {
  switch (type) {
    case 'artist':
      return [
        { id: 'overview', label: 'Overview' },
        { id: 'top_content', label: 'Top Songs' },
        { id: 'collection', label: 'Discography' },
        { id: 'reviews', label: 'Community Reviews' },
        { id: 'related', label: 'Similar Artists' },
      ]
    case 'album':
      return [
        { id: 'overview', label: 'Overview' },
        { id: 'top_content', label: 'Tracks' },
        { id: 'reviews', label: 'Community Reviews' },
        { id: 'related', label: 'Related Albums' },
      ]
    case 'song':
      return [
        { id: 'overview', label: 'Overview' },
        { id: 'lyrics', label: 'Lyrics' },
        { id: 'reviews', label: 'Community Reviews' },
        { id: 'related', label: 'Appears In' },
      ]
    case 'author':
      return [
        { id: 'overview', label: 'Overview' },
        { id: 'top_content', label: 'Most Reviewed Books' },
        { id: 'collection', label: 'Published Works' },
        { id: 'reviews', label: 'Community Reviews' },
        { id: 'related', label: 'Similar Authors' },
      ]
    case 'book':
      return [
        { id: 'overview', label: 'Overview' },
        { id: 'top_content', label: 'Popular Quotes' },
        { id: 'collection', label: 'Editions' },
        { id: 'reviews', label: 'Community Reviews' },
        { id: 'related', label: 'Related Books' },
      ]
    case 'movie':
      return [
        { id: 'overview', label: 'Overview' },
        { id: 'top_content', label: 'Cast' },
        { id: 'reviews', label: 'Community Reviews' },
        { id: 'related', label: 'Related Movies' },
      ]
    case 'tv':
      return [
        { id: 'overview', label: 'Overview' },
        { id: 'top_content', label: 'Cast' },
        { id: 'collection', label: 'Seasons' },
        { id: 'reviews', label: 'Community Reviews' },
      ]
    case 'actor':
      return [
        { id: 'overview', label: 'Overview' },
        { id: 'collection', label: 'Filmography' },
        { id: 'reviews', label: 'Community Reviews' },
        { id: 'related', label: 'Related Actors' },
      ]
    case 'director':
      return [
        { id: 'overview', label: 'Overview' },
        { id: 'top_content', label: 'Best Movies' },
        { id: 'collection', label: 'Directed Works' },
        { id: 'reviews', label: 'Community Reviews' },
        { id: 'related', label: 'Related Directors' },
      ]
    case 'game':
      return [
        { id: 'overview', label: 'Overview' },
        { id: 'game_info', label: 'Game Info' },
        { id: 'platforms_releases', label: 'Platforms & Releases' },
        { id: 'reviews', label: 'Community Reviews' },
        { id: 'related', label: 'Similar Games' },
      ]
    case 'game_studio':
      return [
        { id: 'overview', label: 'Overview' },
        { id: 'top_content', label: 'Top Titles' },
        { id: 'collection', label: 'Published Games' },
        { id: 'reviews', label: 'Community Reviews' },
        { id: 'related', label: 'Similar Studios' },
      ]
    default:
      return [
        { id: 'overview', label: 'Overview' },
        { id: 'reviews', label: 'Community Reviews' },
        { id: 'related', label: 'Related' },
      ]
  }
}
