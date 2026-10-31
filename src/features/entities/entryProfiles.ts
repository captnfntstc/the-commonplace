import type { Entry, EntryType } from '../entries/model'
import type { MediaEntityType, UniversalMediaEntity, HumanProfileContext } from '../../types/mediaEntity'
import {
  emptyHumanCapabilities,
  normalizeHumanProfessions,
  professionFromLegacyContext,
} from '../profiles/humanProfile'
import { cleanDisplayText } from '../../utils/text'

const zeroDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }

function normalized(value?: string) {
  return cleanDisplayText(value).toLocaleLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim()
}

export function slug(value: string) {
  return normalized(value).replace(/\s+/g, '-') || 'unknown'
}

export function splitCreatorNames(value?: string) {
  const parts = cleanDisplayText(value)
    .split(/\s*(?:;|\s\/\s|\s&\s|,)\s*/)
    .filter(Boolean)
  const names: string[] = []
  for (const part of parts) {
    if (/^(?:inc\.?|llc|ltd\.?|co\.?|corp\.?|corporation)$/i.test(part) && names.length > 0) {
      names[names.length - 1] = `${names[names.length - 1]}, ${part}`
    } else {
      names.push(part)
    }
  }
  return names.length > 0 ? names : []
}

export function creatorEntityTypeForEntry(type: EntryType): MediaEntityType | null {
  if (type === 'game') return null
  if (type === 'book') return 'author'
  if (type === 'film') return 'director'
  if (type === 'tv') return 'creator'
  return 'artist'
}

const creatorCategory: Record<MediaEntityType, string> = {
  human: 'Person',
  music_group: 'Music Group',
  artist: 'Artist',
  album: 'Album',
  song: 'Song',
  author: 'Author',
  book: 'Book',
  movie: 'Film',
  tv: 'TV Series',
  actor: 'Actor',
  director: 'Director',
  creator: 'Creator',
  game: 'Game',
  game_studio: 'Game Studio',
}

function entryCollectionItem(entry: Entry) {
  return {
    id: `collection:${entry.type}:${entry.providerId || entry.id}`,
    providerId: entry.providerId || undefined,
    title: cleanDisplayText(entry.title),
    subtitle: [cleanDisplayText(entry.genre), entry.year].filter(Boolean).join(' · ') || creatorCategory[entry.type === 'film' ? 'movie' : entry.type],
    artworkUrl: entry.coverUrl || '',
    year: entry.year,
    rating: entry.rating,
    genre: cleanDisplayText(entry.genre),
  }
}

function entryTopItem(entry: Entry, rank: number) {
  const item = entryCollectionItem(entry)
  return { ...item, rank, subtitle: item.subtitle }
}

function creatorMatches(entry: Entry, creatorName: string) {
  const target = normalized(creatorName)
  return splitCreatorNames(entry.creator).some((name) => normalized(name) === target)
    || normalized(entry.creator) === target
}

export function createCreatorEntityFromEntry(entry: Entry, creatorName: string, allEntries: Entry[]): UniversalMediaEntity | null {
  const name = cleanDisplayText(creatorName)
  const type = creatorEntityTypeForEntry(entry.type)
  if (!type) return null
  const matchingEntries = allEntries
    .filter((candidate) => candidate.type === entry.type && creatorMatches(candidate, name))
    .sort((left, right) => right.rating - left.rating || right.createdAt.localeCompare(left.createdAt))
  const average = matchingEntries.length
    ? matchingEntries.reduce((sum, candidate) => sum + candidate.rating, 0) / matchingEntries.length
    : entry.rating

  const entitySlug = slug(name)
  const canonicalId = `human:${entitySlug}`
  const isMusic = entry.type === 'album' || entry.type === 'song'
  const isScreen = entry.type === 'film' || entry.type === 'tv'
  const isBook = entry.type === 'book'
  const legacyContext = type as HumanProfileContext
  const primaryProf = professionFromLegacyContext(legacyContext)

  return {
    id: canonicalId,
    name,
    type: 'human',
    categoryLabel: creatorCategory[type],
    artworkUrl: '',
    description: `${creatorCategory[type]} profile for ${name}, with works and reviews collected by The Commonplace community.`,
    metadataChips: [{ label: 'Profession', value: creatorCategory[type] }],
    humanProfile: {
      canonicalId,
      context: legacyContext,
      primaryProfession: primaryProf,
      professions: normalizeHumanProfessions([legacyContext]),
      occupationLabels: [creatorCategory[type]],
      providerIds: {},
      capabilities: emptyHumanCapabilities({
        topSongs: isMusic,
        discography: isMusic,
        filmography: isScreen,
        publishedWorks: isBook,
        directing: type === 'director',
        creating: type === 'creator',
        writing: isBook,
      }),
    },
    communityRating: { average, count: matchingEntries.length, distribution: zeroDistribution },
    primaryCollection: matchingEntries.length > 0
      ? { title: 'Top Works', items: matchingEntries.slice(0, 10).map(entryTopItem) }
      : undefined,
    secondaryCollection: matchingEntries.length > 0
      ? { title: 'Works', items: matchingEntries.map(entryCollectionItem) }
      : undefined,
  }
}

export function createAlbumEntityFromSongEntry(entry: Entry): UniversalMediaEntity | null {
  if (entry.type !== 'song' || !entry.provider || /^manual$/i.test(entry.provider)) return null
  const albumName = cleanDisplayText(entry.provider)
  const artist = cleanDisplayText(entry.creator)
  return {
    id: `album:linked:${slug(`${artist}-${albumName}`)}`,
    name: albumName,
    type: 'album',
    categoryLabel: 'Album',
    artworkUrl: entry.coverUrl || '',
    description: `${albumName}${artist ? ` by ${artist}` : ''}.`,
    metadataChips: [
      ...(artist ? [{ label: 'Artist', value: artist }] : []),
      ...(entry.genre ? [{ label: 'Genre', value: cleanDisplayText(entry.genre) }] : []),
      ...(entry.year ? [{ label: 'Release Year', value: entry.year }] : []),
    ],
    communityRating: { average: entry.rating, count: 1, distribution: zeroDistribution },
  }
}
