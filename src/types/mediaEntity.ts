export type MediaEntityType =
  | 'human'
  | 'artist'
  | 'album'
  | 'song'
  | 'author'
  | 'book'
  | 'movie'
  | 'tv'
  | 'actor'
  | 'director'
  | 'creator'
  | 'game'
  | 'game_studio'

export type HumanProfession = 'artist' | 'actor' | 'director' | 'creator' | 'author'

export type HumanProfileContext = HumanProfession

export interface HumanProviderIds {
  wikipediaPageId?: string
  wikidataId?: string
  musicBrainzId?: string
  tmdbPersonId?: string
  itunesArtistId?: string
  googleBooksAuthorId?: string
}

export interface HumanCapabilities {
  topSongs: boolean
  discography: boolean
  filmography: boolean
  publishedWorks: boolean
  directing: boolean
  creating: boolean
}

export type HumanScreenCreditCategory =
  | 'acting'
  | 'concert'
  | 'documentary'
  | 'directing'

export interface HumanScreenCredit {
  id: string
  providerId: string
  mediaType: 'movie' | 'tv'
  title: string
  year?: string
  artworkUrl?: string
  role?: string
  category: HumanScreenCreditCategory
}

export interface HumanProfileMetadata {
  canonicalId?: string
  context: HumanProfileContext
  professions: HumanProfession[]
  occupationLabels: string[]
  providerIds: HumanProviderIds
  capabilities: HumanCapabilities
}

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
  artist?: string
  year?: string
  rating?: number
  genre?: string
  language?: string
  category?: 'album' | 'ep' | 'single'
  explicit?: boolean
}

export interface RelatedEntityItem {
  id: string
  title: string
  subtitle: string
  artworkUrl: string
  type: MediaEntityType
  genres?: string[]
  language?: string
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

export type GameRelatedContentKind = 'sequel' | 'expansion' | 'dlc'

export interface GameRelatedContentItem {
  providerId: string
  name: string
  kind: GameRelatedContentKind
  description?: string
  releaseDate?: string
  coverUrl?: string
}

export interface GameSimilarItem {
  providerId: string
  name: string
  genres: string[]
  gameplayTags?: string[]
  description?: string
  releaseDate?: string
  coverUrl?: string
}

export interface GameMetadata {
  developers?: string[]
  publishers?: string[]
  genres?: string[]
  franchise?: string
  gameModes?: string[]
  gameplayTags?: string[]
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
  relatedContent?: GameRelatedContentItem[]
  similarGames?: GameSimilarItem[]
  metadataSource?: string
  metadataUpdatedAt?: string
}

export interface TvEpisodeMetadata {
  id: number
  name: string
  seasonNumber: number
  episodeNumber: number
  overview?: string
  airDate?: string
  runtime?: number
  stillUrl?: string
}

export interface TvSeasonMetadata {
  id: number
  name: string
  seasonNumber: number
  episodeCount: number
  overview?: string
  airDate?: string
  posterUrl?: string
  episodes: TvEpisodeMetadata[]
}

export interface TvSeriesMetadata {
  seasons: TvSeasonMetadata[]
  source: 'design-review-fixture'
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
  preferWikipediaArtwork?: boolean
  gameMetadata?: GameMetadata
  tvMetadata?: TvSeriesMetadata
  humanProfile?: HumanProfileMetadata
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
    case 'human':
      return [
        { id: 'overview', label: 'Overview' },
        { id: 'reviews', label: 'Community Reviews' },
        { id: 'related', label: 'Similar' },
      ]
    case 'artist':
      return [
        { id: 'overview', label: 'Overview' },
        { id: 'top_content', label: 'Top Songs' },
        { id: 'collection', label: 'Discography' },
        { id: 'reviews', label: 'Community Reviews' },
        { id: 'related', label: 'Similar' },
      ]
    case 'album':
      return [
        { id: 'overview', label: 'Overview' },
        { id: 'top_content', label: 'Tracks' },
        { id: 'reviews', label: 'Community Reviews' },
        { id: 'versions', label: 'Other Versions' },
        { id: 'related', label: 'Similar' },
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
        { id: 'related', label: 'Similar' },
      ]
    case 'book':
      return [
        { id: 'overview', label: 'Overview' },
        { id: 'top_content', label: 'Popular Quotes' },
        { id: 'collection', label: 'Editions' },
        { id: 'reviews', label: 'Community Reviews' },
        { id: 'related', label: 'Similar' },
      ]
    case 'movie':
      return [
        { id: 'overview', label: 'Overview' },
        { id: 'top_content', label: 'Cast' },
        { id: 'reviews', label: 'Community Reviews' },
        { id: 'related', label: 'Similar' },
      ]
    case 'tv':
      return [
        { id: 'overview', label: 'Overview' },
        { id: 'top_content', label: 'Cast' },
        { id: 'collection', label: 'Seasons' },
        { id: 'reviews', label: 'Community Reviews' },
        { id: 'related', label: 'Similar' },
      ]
    case 'actor':
      return [
        { id: 'overview', label: 'Overview' },
        { id: 'collection', label: 'Filmography' },
        { id: 'reviews', label: 'Community Reviews' },
        { id: 'related', label: 'Similar' },
      ]
    case 'director':
      return [
        { id: 'overview', label: 'Overview' },
        { id: 'top_content', label: 'Best Movies' },
        { id: 'collection', label: 'Directed Works' },
        { id: 'reviews', label: 'Community Reviews' },
        { id: 'related', label: 'Similar' },
      ]
    case 'creator':
      return [
        { id: 'overview', label: 'Overview' },
        { id: 'top_content', label: 'Best Series' },
        { id: 'collection', label: 'Created Works' },
        { id: 'reviews', label: 'Community Reviews' },
        { id: 'related', label: 'Similar' },
      ]
    case 'game':
      return [
        { id: 'overview', label: 'Overview' },
        { id: 'game_info', label: 'Game Info' },
        { id: 'platforms_releases', label: 'Platforms & Releases' },
        { id: 'reviews', label: 'Community Reviews' },
        { id: 'more_from_game', label: 'More From This Game' },
        { id: 'related', label: 'Similar' },
      ]
    case 'game_studio':
      return [
        { id: 'overview', label: 'Overview' },
        { id: 'top_content', label: 'Top Titles' },
        { id: 'collection', label: 'Published Games' },
        { id: 'reviews', label: 'Community Reviews' },
        { id: 'related', label: 'Similar' },
      ]
    default:
      return [
        { id: 'overview', label: 'Overview' },
        { id: 'reviews', label: 'Community Reviews' },
        { id: 'related', label: 'Similar' },
      ]
  }
}
