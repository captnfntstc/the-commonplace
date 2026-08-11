import { AnimatePresence, motion } from 'framer-motion'
import {
  User,
  Trash2,
  BookOpen,
  ChevronUp,
  Clapperboard,
  Disc3,
  Gamepad2,
  Loader2,
  Music4,
  Plus,
  Quote,
  Save,
  Search,
  Settings,
  LogOut,
  Star,
  Tv,
  Wrench,
  X,
  AlertCircle,
  Lock,
  MessageSquareOff,
} from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import {
  fetchLyrics,
  getCachedMetadata,
  type MetadataResult,
  type MetadataType,
  searchMetadata,
  fetchWikipediaPortrait,
  entityImageCacheMap,
  albumEntityMap,
} from './metadata'
import { ExpansionProvider, useCardExpansion } from './context/ExpansionContext'
import { Card } from './components/CommonplaceCard/Card'
import { CardOverlayModal } from './components/CommonplaceCard/CardOverlayModal'
import { FormattingToolbar } from './components/FormattingToolbar/FormattingToolbar'
import { RichTextEditor } from './components/RichTextEditor/RichTextEditor'
import { stripHtmlAlignment, type Alignment } from './components/CommonplaceCard/FormattedText'
import { CardSkeletonGrid } from './components/CommonplaceCard/CardSkeleton'
import { UserProfilePage, USER_DIRECTORY } from './pages/UserProfilePage'
import { SettingsPage, type UserProfileState } from './pages/SettingsPage'
import { useMasonryLayout } from './hooks/useMasonryLayout'
import { NotificationBell, type Notification as AppNotification } from './components/Notifications/NotificationPanel'
import { MOCK_ENTITY_PROFILES } from './data/entityProfiles'
import { UniversalMediaProfilePage } from './pages/UniversalMediaProfilePage'
import { UNIVERSAL_MEDIA_ENTITIES } from './data/universalMediaEntities'
import type { MediaEntityType, UniversalMediaEntity } from './types/mediaEntity'
import { resolveArtworkUrl, createArtworkPlaceholder } from './utils/artwork'
import { ApiUsageTracker } from './components/DeveloperTools/ApiUsageTracker'

const WARN_UNRATED_KEY = 'the-commonplace.warn-unrated'
const DEV_ALT_SEARCH_ENABLED_KEY = 'the-commonplace.dev.alternate-search-enabled'
const DEV_ALT_SEARCH_TYPES_KEY = 'the-commonplace.dev.alternate-search-types'
const DEV_ALT_SEARCH_PEOPLE_KEY = 'the-commonplace.dev.alternate-search-people'

function getWarnUnratedPreference(): boolean {
  const stored = localStorage.getItem(WARN_UNRATED_KEY)
  return stored === null ? true : stored !== 'false'
}

function setWarnUnratedPreference(val: boolean) {
  localStorage.setItem(WARN_UNRATED_KEY, String(val))
}

function getMatchingLyricIndexes(lyricsText: string, favoritePassageText: string): number[] {
  if (!lyricsText || !favoritePassageText) return []

  const lyricLines = lyricsText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const cleanedPassage = favoritePassageText
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')

  const passageLines = cleanedPassage
    .split(/\r?\n/)
    .map((line) => line.trim().toLowerCase())
    .filter(Boolean)

  if (passageLines.length === 0) return []

  const matched: number[] = []
  lyricLines.forEach((line, index) => {
    const normLine = line.toLowerCase()
    const isMatch = passageLines.some((pLine) => {
      if (pLine === normLine) return true
      if (pLine.length > 4 && normLine.length > 4) {
        return pLine.includes(normLine) || normLine.includes(pLine)
      }
      return false
    })
    if (isMatch) {
      matched.push(index)
    }
  })

  return matched
}

function isDraftDirty(current: EntryDraft, base: EntryDraft): boolean {
  return (
    current.type !== base.type ||
    current.title.trim() !== base.title.trim() ||
    current.creator.trim() !== base.creator.trim() ||
    current.rating !== base.rating ||
    current.favoritePassage.trim() !== base.favoritePassage.trim() ||
    current.reflection.trim() !== base.reflection.trim() ||
    current.coverTone !== base.coverTone ||
    current.enableDropCap !== base.enableDropCap
  )
}

type EntryType = MetadataType
type CoverTone = 'gold' | 'rose' | 'sage' | 'blue' | 'violet' | 'ember'

type Entry = {
  id: string
  type: EntryType
  title: string
  creator: string
  provider: string
  providerId: string
  genre?: string
  rating: number
  favoritePassage: string
  reflection: string
  reflectionAlign?: Alignment
  passageAlign?: Alignment
  enableDropCap?: boolean
  year?: string
  coverUrl?: string
  summary?: string
  createdAt: string
  updatedAt: string
  coverTone: CoverTone
  authorHandle?: string
  authorName?: string
  authorAvatarUrl?: string
}

type EntryDraft = Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>

const storageKey = 'the-commonplace.entries'

const entryTypes: Array<{
  id: EntryType
  label: string
  Icon: typeof BookOpen
}> = [
  { id: 'album', label: 'Albums', Icon: Disc3 },
  { id: 'book', label: 'Books', Icon: BookOpen },
  { id: 'film', label: 'Films', Icon: Clapperboard },
  { id: 'game', label: 'Games', Icon: Gamepad2 },
  { id: 'song', label: 'Songs', Icon: Music4 },
  { id: 'tv', label: 'Shows', Icon: Tv },
]

const peopleEntityTypes = new Set<MediaEntityType>([
  'artist',
  'author',
  'director',
  'actor',
  'game_studio',
])

const defaultCoverToneByType: Record<EntryType, CoverTone> = {
  album: 'gold',
  book: 'blue',
  film: 'ember',
  game: 'rose',
  song: 'violet',
  tv: 'sage',
}

const sampleEntryIds = new Set([
  'entry-1',
  'entry-2',
  'entry-3',
  'entry-4',
  'entry-5',
  'entry-6',
  'entry-7',
  'entry-8',
  'entry-9',
])

const emptyDraft: EntryDraft = {
  type: 'album',
  title: '',
  creator: '',
  provider: 'Manual',
  providerId: '',
  genre: '',
  rating: 0,
  favoritePassage: '',
  reflection: '',
  reflectionAlign: 'left',
  passageAlign: 'left',
  enableDropCap: false,
  coverTone: 'gold',
}

function loadEntries(): Entry[] {
  const stored = localStorage.getItem(storageKey)

  if (!stored) {
    return []
  }

  try {
    const parsed = JSON.parse(stored) as Entry[]
    if (!Array.isArray(parsed)) return []
    // Filter out initial sample entries and clean legacy HTML alignment tags
    return parsed
      .filter((entry) => !sampleEntryIds.has(entry.id))
      .map((entry) => {
        const { cleanText: cleanRef, align: refAlign } = stripHtmlAlignment(entry.reflection || '')
        const { cleanText: cleanPas, align: pasAlign } = stripHtmlAlignment(entry.favoritePassage || '')
        return {
          ...entry,
          reflection: cleanRef,
          favoritePassage: cleanPas,
          reflectionAlign: entry.reflectionAlign || refAlign || 'left',
          passageAlign: entry.passageAlign || pasAlign || 'left',
        }
      })
  } catch {
    return []
  }
}

function makeId() {
  return `entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function getDefaultCoverTone(type: EntryType) {
  return defaultCoverToneByType[type]
}

function usesSquareArtwork(type: EntryType) {
  return type === 'album' || type === 'song'
}

function getTypeMeta(type: EntryType) {
  return entryTypes.find((entryType) => entryType.id === type) ?? entryTypes[0]
}

const portraitEntityTypes = new Set(['artist', 'author', 'director', 'actor', 'game_studio'])

function getSearchEntityArtwork(entity: {
  id: string
  title: string
  artworkUrl: string
  type: string
}) {
  const cleanTitle = entity.title.toLowerCase()
  const mockProfile = MOCK_ENTITY_PROFILES[entity.id]
  const universalEntity = UNIVERSAL_MEDIA_ENTITIES[entity.id]

  return (
    entityImageCacheMap.get(`${entity.type}:${entity.id}`) ||
    entityImageCacheMap.get(`${entity.type}:${cleanTitle}`) ||
    entityImageCacheMap.get(`artist:${entity.id}`) ||
    entityImageCacheMap.get(`artist:${cleanTitle}`) ||
    entityImageCacheMap.get(`wiki-portrait:${cleanTitle}`) ||
    entityImageCacheMap.get(entity.id) ||
    entityImageCacheMap.get(cleanTitle) ||
    universalEntity?.artworkUrl ||
    mockProfile?.coverUrl ||
    entity.artworkUrl ||
    createArtworkPlaceholder(entity.title, entity.type)
  )
}

const EntitySearchItem: React.FC<{
  entity: {
    id: string
    title: string
    artworkUrl: string
    type: string
    creatorValue: string
    bio: string
  }
  onSelect: () => void
}> = ({ entity, onSelect }) => {
  const [photo, setPhoto] = useState(() => getSearchEntityArtwork(entity))
  const isSquareThumb = ['artist', 'author', 'director', 'actor', 'game_studio', 'album', 'song'].includes(entity.type)

  useEffect(() => {
    let cancelled = false
    setPhoto(getSearchEntityArtwork(entity))

    if (portraitEntityTypes.has(entity.type)) {
      fetchWikipediaPortrait(entity.title)
        .then((portraitUrl) => {
          if (!cancelled && portraitUrl) setPhoto(resolveArtworkUrl(portraitUrl, entity.title, entity.type))
        })
        .catch(() => {
          if (!cancelled) setPhoto((current) => current || createArtworkPlaceholder(entity.title, entity.type))
        })
    }

    return () => {
      cancelled = true
    }
  }, [entity])

  return (
    <button
      type="button"
      className="metadata-option search-entity-item"
      onClick={onSelect}
    >
      <span className={isSquareThumb ? 'metadata-thumb metadata-thumb--square' : 'metadata-thumb'}>
        {photo ? (
          <img
            src={photo}
            alt={entity.title}
            referrerPolicy="no-referrer"
            loading="eager"
            decoding="async"
            onError={() => {
              const fallback = createArtworkPlaceholder(entity.title, entity.type)
              setPhoto(fallback)
            }}
          />
        ) : (
          <Search aria-hidden="true" />
        )}
      </span>
      <span className="metadata-option-copy">
        <strong>{entity.title}</strong>
        <span className="metadata-type-line">
          <span>{formatMediaSearchSubtitle(entity)}</span>
        </span>
      </span>
      <span className="search-entity-type-badge">{entity.type.replace('_', ' ').toUpperCase()}</span>
    </button>
  )
}

type HeaderSearchEntity = {
  id: string
  title: string
  artworkUrl: string
  type: string
  creatorValue: string
  bio: string
  source: 'metadata' | 'universal'
  rank: number
  metadataResult?: MetadataResult
  universalEntity?: UniversalMediaEntity
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function albumEntityIdFromMetadata(result: MetadataResult) {
  return result.providerId
    ? `album-${result.providerId}`
    : `album-${normalizeSearchText(result.title).replace(/\s+/g, '-')}`
}

function metadataResultToSearchEntity(result: MetadataResult, rank: number): HeaderSearchEntity {
  return {
    id: result.type === 'album' ? albumEntityIdFromMetadata(result) : result.id,
    title: result.title,
    artworkUrl: result.coverUrl || '',
    type: result.type,
    creatorValue: result.creator,
    bio: result.provider || result.genre || '',
    source: 'metadata',
    rank,
    metadataResult: result,
  }
}

function universalEntityToSearchEntity(entity: UniversalMediaEntity, rank: number): HeaderSearchEntity {
  const creatorChip = entity.metadataChips.find((chip) =>
    /artist|author|director|creator|developer|genre|known for/i.test(chip.label),
  )

  return {
    id: entity.id,
    title: entity.name,
    artworkUrl: entity.artworkUrl || '',
    type: entity.type,
    creatorValue: creatorChip ? `${creatorChip.label}: ${creatorChip.value}` : entity.categoryLabel,
    bio: entity.description || entity.categoryLabel,
    source: 'universal',
    rank,
    universalEntity: entity,
  }
}

function formatMediaSearchSubtitle(entity: { creatorValue: string; bio: string }) {
  const creator = entity.creatorValue.replace(/^[^:]+:\s*/, '').trim()
  const detail = entity.bio.replace(/\b(19|20)\d{2}\b/g, '').replace(/\s+/g, ' ').trim()
  return [creator, detail].filter(Boolean).join(' • ').toUpperCase()
}

function getEntityPopularityScore(entity: UniversalMediaEntity) {
  return entity.communityRating.count * entity.communityRating.average
}
void getEntityPopularityScore

function dedupeSearchEntities(entities: HeaderSearchEntity[]) {
  const seen = new Set<string>()
  return entities.filter((entity) => {
    const key = `${entity.type}:${normalizeSearchText(entity.title)}:${normalizeSearchText(entity.creatorValue)}`
    const idKey = entity.id.toLowerCase()
    if (seen.has(idKey) || seen.has(key)) return false
    seen.add(idKey)
    seen.add(key)
    return true
  })
}

function metadataTypeToEntityType(type: MetadataType): MediaEntityType {
  if (type === 'film') return 'movie'
  return type
}

function entityTypeToMetadataFilter(type: MediaEntityType): MetadataType | null {
  if (type === 'movie') return 'film'
  if (type === 'album' || type === 'song' || type === 'book' || type === 'tv' || type === 'game') return type
  return null
}

function metadataTypeLabel(type: MetadataType) {
  if (type === 'film') return 'Film'
  if (type === 'tv') return 'Show'
  return type.charAt(0).toUpperCase() + type.slice(1)
}

function creatorLabelForMetadata(type: MetadataType) {
  if (type === 'book') return 'Author'
  if (type === 'film') return 'Director'
  if (type === 'tv') return 'Creator'
  if (type === 'game') return 'Studio'
  return 'Artist'
}

function metadataResultToUniversalEntity(entity: { id: string; metadataResult: MetadataResult }): UniversalMediaEntity {
  const result = entity.metadataResult
  const categoryLabel = metadataTypeLabel(result.type)
  const detail = result.provider || result.genre || result.year || categoryLabel

  return {
    id: entity.id,
    name: result.title,
    type: metadataTypeToEntityType(result.type),
    categoryLabel,
    artworkUrl: resolveArtworkUrl(result.coverUrl || '', result.title, result.type),
    description:
      result.summary ||
      `Catalog entry for ${result.title}${result.creator ? ` by ${result.creator}` : ''} in The Commonplace community archive.`,
    metadataChips: [
      { label: creatorLabelForMetadata(result.type), value: result.creator || 'Unknown' },
      { label: 'Category', value: categoryLabel },
      ...(detail ? [{ label: result.year && detail === result.year ? 'Year' : 'Detail', value: detail }] : []),
      ...(result.year && detail !== result.year ? [{ label: 'Year', value: result.year }] : []),
    ],
    communityRating: {
      average: 4.7,
      count: 0,
      distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    },
  }
}

function draftFromMetadata(
  result: MetadataResult,
  current: EntryDraft,
): EntryDraft {
  const provider =
    result.provider && result.provider !== result.year
      ? result.provider
      : (result.genre || '')

  return {
    ...current,
    type: result.type,
    title: result.title,
    creator: result.creator,
    provider,
    providerId: result.providerId,
    year: result.year,
    genre: result.genre,
    coverUrl: resolveArtworkUrl(result.coverUrl, result.title, result.type),
    summary: result.summary,
    coverTone: getDefaultCoverTone(result.type),
  }
}

const MOCK_EXTERNAL_PROFILES: Record<string, { profile: UserProfileState; entries: Entry[] }> = {
  elena_r: {
    profile: {
      firstName: 'Elena',
      lastName: 'Rostova',
      showFullName: true,
      handle: 'elena_r',
      email: 'elena.rostova@commonplace.app',
      bio: 'Lit, classical music, and architecture enthusiast. Archiving thoughts on Tolstoy, Dostoevsky, and Rachmaninoff.',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop',
      coverUrl: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=1200&auto=format&fit=crop',
      showFollowLists: true,
      allowComments: true,
    },
    entries: [
      {
        id: 'ext-elena-1',
        type: 'book',
        title: 'War and Peace',
        creator: 'Leo Tolstoy',
        provider: 'The Russian Messenger, 1869',
        providerId: 'gb-war-peace',
        genre: 'Classics',
        rating: 5,
        favoritePassage: 'A refined simplicity is the first condition of all grace and nobility of soul.',
        reflection: 'Reading Tolstoy during quiet evenings is a meditation on the human condition. His capacity to capture both grand historical movements and subtle interior shifts remains unmatched.',
        createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
        coverTone: 'gold',
        coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop',
        authorHandle: 'elena_r',
        authorName: 'Elena Rostova',
        authorAvatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop',
      },
      {
        id: 'ext-elena-2',
        type: 'album',
        title: 'Rachmaninoff: Piano Concerto No. 2',
        creator: 'Sergei Rachmaninoff / London Symphony',
        provider: 'Classical',
        providerId: 'itunes-rach2',
        genre: 'Classical',
        rating: 5,
        favoritePassage: 'The second movement is an unbearable beauty—every chord feels weighted with melancholic grace.',
        reflection: 'The opening chords build like an ocean wave breaking against stone. No piece of music speaks to longing quite like this concerto.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
        coverTone: 'blue',
        coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop',
        authorHandle: 'elena_r',
        authorName: 'Elena Rostova',
        authorAvatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop',
      },
      {
        id: 'ext-elena-3',
        type: 'film',
        title: 'Stalker',
        creator: 'Andrei Tarkovsky',
        provider: 'Mosfilm (1979)',
        providerId: 'tmdb-stalker',
        genre: 'Sci-Fi / Drama',
        rating: 5,
        favoritePassage: 'Weakness is a great thing, and strength is nothing. When a man is born, he is weak and supple; when he dies, he is strong and hard.',
        reflection: 'Tarkovsky treats cinema as poetic time-sculpting. The Room inside the Zone is not a physical place; it is a mirror reflecting our deepest unstated desires.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
        coverTone: 'sage',
        coverUrl: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=600&auto=format&fit=crop',
        authorHandle: 'elena_r',
        authorName: 'Elena Rostova',
        authorAvatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop',
      },
    ],
  },
  marcus_v: {
    profile: {
      firstName: 'Marcus',
      lastName: 'Vance',
      showFullName: true,
      handle: 'marcus_v',
      email: 'marcus.vance@commonplace.app',
      bio: 'Film critic, indie gamer, and vinyl collector. Passionate about atmospheric storytelling.',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop',
      coverUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&auto=format&fit=crop',
      showFollowLists: true,
      allowComments: true,
    },
    entries: [
      {
        id: 'ext-marcus-1',
        type: 'film',
        title: 'Blade Runner 2049',
        creator: 'Denis Villeneuve',
        provider: 'Warner Bros (2017)',
        providerId: 'tmdb-br2049',
        genre: 'Sci-Fi',
        rating: 5,
        favoritePassage: 'All the best memories are hers.',
        reflection: 'Deakins’ cinematography coupled with Zimmer & Wallfisch’s synth score creates an oppressive yet mesmerizing future. A masterclass in world-building.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(),
        coverTone: 'ember',
        coverUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop',
        authorHandle: 'marcus_v',
        authorName: 'Marcus Vance',
        authorAvatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop',
      },
      {
        id: 'ext-marcus-2',
        type: 'album',
        title: 'In Rainbows',
        creator: 'Radiohead',
        provider: 'XL Recordings (2007)',
        providerId: 'itunes-inrainbows',
        genre: 'Alternative / Rock',
        rating: 5,
        favoritePassage: 'You are all I need. You are all I need. I’m in the middle of your picture.',
        reflection: 'Warm, organic, and perfectly paced. Reckoner is one of the most transcendent tracks ever recorded.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 120).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 120).toISOString(),
        coverTone: 'rose',
        coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/8b/ef/07/8bef075b-e48f-3617-e854-3c8297b830d1/634904032429.png/1000x1000bb.jpg',
        authorHandle: 'marcus_v',
        authorName: 'Marcus Vance',
        authorAvatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop',
      },
    ],
  },
  aria_s: {
    profile: {
      firstName: 'Aria',
      lastName: 'Sterling',
      showFullName: true,
      handle: 'aria_s',
      email: 'aria.sterling@commonplace.app',
      bio: 'Archivist of rare books, private reflections, and quiet nocturnal notes.',
      avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop',
      coverUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=1200&auto=format&fit=crop',
      showFollowLists: false,
      allowComments: false,
      isPrivate: true,
    },
    entries: [
      {
        id: 'ext-aria-1',
        type: 'book',
        title: 'The Book of Disquiet',
        creator: 'Fernando Pessoa',
        provider: 'Tinta da China, 1982',
        providerId: 'gb-disquiet',
        genre: 'Poetry / Prose',
        rating: 5,
        favoritePassage: 'My past is everything I failed to be.',
        reflection: 'Pessoa writes with an exquisite solitude. A private record of interior landscapes.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        coverTone: 'violet',
        coverUrl: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=600&auto=format&fit=crop',
        authorHandle: 'aria_s',
        authorName: 'Aria Sterling',
        authorAvatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop',
      },
    ],
  },
}

function AppContent() {
  const [entries, setEntries] = useState<Entry[]>(loadEntries)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<EntryType | 'all'>('all')
  const { expandedCardId, setExpandedCardId, toggleCardExpanded } = useCardExpansion()

  const [activeView, setActiveView] = useState<'feed' | 'profile' | 'settings' | 'entity'>('feed')
  const [selectedProfileHandle, setSelectedProfileHandle] = useState<string | null>(null)
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null)
  const [, setEntityBreadcrumb] = useState<string[]>([])
  const [searchTab, setSearchTab] = useState<'media' | 'users'>('media')
  const [headerMediaResults, setHeaderMediaResults] = useState<MetadataResult[]>([])
  const [headerMediaSearchLoading, setHeaderMediaSearchLoading] = useState(false)
  const headerAlbumResults = headerMediaResults
  const headerAlbumSearchLoading = headerMediaSearchLoading
  void headerAlbumResults
  void headerAlbumSearchLoading
  const [profileCategoryFilter, setProfileCategoryFilter] = useState<string>('all')
  const searchEntityCacheRef = useRef(new Map<string, UniversalMediaEntity>())

  const handleOpenEntity = (entityId: string) => {
    setEntityBreadcrumb((prev) =>
      activeView === 'entity' && selectedEntityId && selectedEntityId !== entityId
        ? [...prev, selectedEntityId]
        : [],
    )
    setSelectedEntityId(entityId)
    setActiveView('entity')
    setSearchOpen(false)
  }

  const handleOpenSearchEntity = (entity: HeaderSearchEntity) => {
    const universalEntity = entity.universalEntity || (
      entity.metadataResult ? metadataResultToUniversalEntity({
        id: entity.id,
        metadataResult: entity.metadataResult,
      }) : null
    )

    if (universalEntity) {
      searchEntityCacheRef.current.set(entity.id, universalEntity)
    }
    handleOpenEntity(entity.id)
  }

  const handleNavigateEntityBreadcrumb = (entityId: string) => {
    setEntityBreadcrumb((prev) =>
      selectedEntityId && selectedEntityId !== entityId ? [...prev, selectedEntityId] : prev,
    )
    setSelectedEntityId(entityId)
    setActiveView('entity')
  }

  const handleEntityBack = () => {
    setEntityBreadcrumb((prev) => {
      const next = [...prev]
      const previousEntityId = next.pop()
      if (previousEntityId) {
        setSelectedEntityId(previousEntityId)
        setActiveView('entity')
        return next
      }

      setSelectedEntityId(null)
      setActiveView('feed')
      return []
    })
  }

  const handleHome = () => {
    setEntityBreadcrumb([])
    setSelectedEntityId(null)
    setSelectedProfileHandle(null)
    setActiveView('feed')
  }

  const [userProfile, setUserProfile] = useState<UserProfileState>({
    firstName: 'Jimmy',
    lastName: 'Boy',
    showFullName: true,
    handle: 'jimboii',
    email: 'jimboii@commonplace.app',
    bio: 'Collector of timeless passages, album impressions, cinematic notes, and personal reflections in one quiet place.',
    avatarUrl: '',
    coverUrl: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?q=80&w=1200&auto=format&fit=crop',
    lastUsernameChangeDate: '2026-07-01T00:00:00.000Z',
    showFollowLists: true,
    allowComments: true,
  })

  // Social Interaction States (Likes, Saves, Comments Disabled per entry)
  const [likedEntryIds, setLikedEntryIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('the-commonplace.likes') || '[]')
    } catch {
      return []
    }
  })
  const [savedEntryIds, setSavedEntryIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('the-commonplace.saves') || '[]')
    } catch {
      return []
    }
  })
  const [disabledCommentEntryIds, setDisabledCommentEntryIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('the-commonplace.disabled-comments') || '[]')
    } catch {
      return []
    }
  })

  const toggleLikeEntry = (id: string) => {
    setLikedEntryIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
      localStorage.setItem('the-commonplace.likes', JSON.stringify(next))
      return next
    })
  }

  const toggleSaveEntry = (id: string) => {
    setSavedEntryIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
      localStorage.setItem('the-commonplace.saves', JSON.stringify(next))
      return next
    })
  }

  const toggleCommentsDisabled = (id: string) => {
    setDisabledCommentEntryIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
      localStorage.setItem('the-commonplace.disabled-comments', JSON.stringify(next))
      return next
    })
  }

  const [composerOpen, setComposerOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null)
  const [overlayEntry, setOverlayEntry] = useState<Entry | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [isLoggedOut, setIsLoggedOut] = useState(false)
  const [quickDevToolsOpen, setQuickDevToolsOpen] = useState(false)
  const [alternateSearchEnabled, setAlternateSearchEnabledState] = useState(() => {
    return localStorage.getItem(DEV_ALT_SEARCH_ENABLED_KEY) === 'true'
  })
  const [alternateSearchTypes, setAlternateSearchTypesState] = useState<MetadataType[]>(() => {
    const allTypes = entryTypes.map((entryType) => entryType.id)
    const storedTypes = localStorage.getItem(DEV_ALT_SEARCH_TYPES_KEY)
    if (storedTypes === null) return allTypes

    try {
      const parsed = JSON.parse(storedTypes) as MetadataType[]
      return parsed.filter((type) => allTypes.includes(type))
    } catch {
      return allTypes
    }
  })
  const [alternateSearchIncludesPeople, setAlternateSearchIncludesPeopleState] = useState(() => {
    return localStorage.getItem(DEV_ALT_SEARCH_PEOPLE_KEY) !== 'false'
  })
  const gridRef = useRef<HTMLElement>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const [searchLimit, setSearchLimit] = useState(8)

  const setAlternateSearchEnabled = (enabled: boolean) => {
    setAlternateSearchEnabledState(enabled)
    localStorage.setItem(DEV_ALT_SEARCH_ENABLED_KEY, String(enabled))
    if (enabled) {
      setSearchOpen(true)
      setSearchTab('media')
    }
  }

  const setAlternateSearchTypes = (types: MetadataType[]) => {
    const allTypes = entryTypes.map((entryType) => entryType.id)
    const validTypes = types.filter((type) => allTypes.includes(type))
    const nextTypes = validTypes
    setAlternateSearchTypesState(nextTypes)
    localStorage.setItem(DEV_ALT_SEARCH_TYPES_KEY, JSON.stringify(nextTypes))
  }

  const setAlternateSearchIncludesPeople = (enabled: boolean) => {
    setAlternateSearchIncludesPeopleState(enabled)
    localStorage.setItem(DEV_ALT_SEARCH_PEOPLE_KEY, String(enabled))
  }

  const toggleAlternateSearchPeople = () => {
    const nextPeopleState = !alternateSearchIncludesPeople
    if (!nextPeopleState && alternateSearchTypes.length === 0) {
      setAlternateSearchTypes(entryTypes.map((entryType) => entryType.id))
    }
    setAlternateSearchIncludesPeople(nextPeopleState)
  }

  const toggleAlternateSearchType = (type: MetadataType) => {
    const nextTypes = alternateSearchTypes.includes(type)
      ? alternateSearchTypes.filter((item) => item !== type)
      : [...alternateSearchTypes, type]

    if (nextTypes.length === 0 && !alternateSearchIncludesPeople) {
      setAlternateSearchIncludesPeople(true)
    }

    setAlternateSearchTypes(nextTypes)
  }

  useEffect(() => {
    setSearchLimit(8)
  }, [alternateSearchIncludesPeople, alternateSearchTypes, query, searchOpen, searchTab])

  // Pre-warm entity image URL cache and fetch live Wikipedia portraits for artists/authors/directors.
  useEffect(() => {
    Object.values(UNIVERSAL_MEDIA_ENTITIES).forEach((entity) => {
      if (['artist', 'author', 'director', 'actor'].includes(entity.type)) {
        fetchWikipediaPortrait(entity.name).catch(() => {})
      }
      if (entity.artworkUrl) {
        const safeArtworkUrl = resolveArtworkUrl(entity.artworkUrl, entity.name, entity.categoryLabel)
        entityImageCacheMap.set(entity.id, safeArtworkUrl)
        entityImageCacheMap.set(entity.name.toLowerCase(), safeArtworkUrl)
        entityImageCacheMap.set(`artist:${entity.id}`, safeArtworkUrl)
        entityImageCacheMap.set(`artist:${entity.name.toLowerCase()}`, safeArtworkUrl)
      }
      if (entity.secondaryCollection?.items) {
        entity.secondaryCollection.items.forEach((item) => {
          if (item.artworkUrl) {
            const safeArtworkUrl = resolveArtworkUrl(item.artworkUrl, item.title, item.subtitle)
            entityImageCacheMap.set(item.id, safeArtworkUrl)
            entityImageCacheMap.set(item.title.toLowerCase(), safeArtworkUrl)
            entityImageCacheMap.set(`artist:${item.id}`, safeArtworkUrl)
            entityImageCacheMap.set(`artist:${item.title.toLowerCase()}`, safeArtworkUrl)
          }
        })
      }
      if (entity.relatedEntities?.items) {
        entity.relatedEntities.items.forEach((item) => {
          if (['artist', 'author', 'director', 'actor'].includes(item.type || '')) {
            fetchWikipediaPortrait(item.title).catch(() => {})
          }
          if (item.artworkUrl) {
            const safeArtworkUrl = resolveArtworkUrl(item.artworkUrl, item.title, item.subtitle)
            entityImageCacheMap.set(item.id, safeArtworkUrl)
            entityImageCacheMap.set(item.title.toLowerCase(), safeArtworkUrl)
            entityImageCacheMap.set(`artist:${item.id}`, safeArtworkUrl)
            entityImageCacheMap.set(`artist:${item.title.toLowerCase()}`, safeArtworkUrl)
          }
        })
      }
    })

    Object.values(MOCK_ENTITY_PROFILES).forEach((profile) => {
      if (profile.coverUrl) {
        entityImageCacheMap.set(profile.id, profile.coverUrl)
        entityImageCacheMap.set(profile.title.toLowerCase(), profile.coverUrl)
      }
    })
  }, [])

  useEffect(() => {
    const normalizedQuery = query.trim()
    const shouldSearchMedia = alternateSearchEnabled
      ? alternateSearchTypes.length > 0
      : searchTab === 'media'

    if (!searchOpen || !shouldSearchMedia || normalizedQuery.length < 2) {
      setHeaderMediaResults([])
      setHeaderMediaSearchLoading(false)
      return
    }

    const abortController = new AbortController()
    const timer = window.setTimeout(() => {
      const fallbackTypes = entryTypes.map((entryType) => entryType.id)
      const filteredTypes = entryTypes
        .filter((entryType) => alternateSearchTypes.includes(entryType.id))
        .map((entryType) => entryType.id)
      const typesToSearch = alternateSearchEnabled ? filteredTypes : fallbackTypes
      setHeaderMediaSearchLoading(true)

      let pendingSearches = typesToSearch.length
      setHeaderMediaResults([])

      typesToSearch.forEach((type) => {
        searchMetadata(type, normalizedQuery, abortController.signal)
          .then((results) => {
            if (!abortController.signal.aborted) {
              setHeaderMediaResults((current) => [...current, ...results])
            }
          })
          .catch((err) => {
            if ((err as Error)?.name === 'AbortError') return
          })
          .finally(() => {
            pendingSearches -= 1
            if (pendingSearches === 0 && !abortController.signal.aborted) {
              setHeaderMediaSearchLoading(false)
            }
        })
      })
    }, 250)

    return () => {
      abortController.abort()
      window.clearTimeout(timer)
    }
  }, [alternateSearchEnabled, alternateSearchTypes, query, searchOpen, searchTab])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const userProfileName = userProfile.showFullName
    ? `${userProfile.firstName} ${userProfile.lastName}`.trim()
    : userProfile.firstName

  const handleOpenUserProfile = (handle?: string) => {
    const cleanHandle = (handle || userProfile.handle).replace(/^@/, '')
    if (cleanHandle === userProfile.handle) {
      setSelectedProfileHandle(null)
    } else if (MOCK_EXTERNAL_PROFILES[cleanHandle]) {
      setSelectedProfileHandle(cleanHandle)
    }
    setActiveView('profile')
  }

  const userSearchResults = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query)
    if (!normalizedQuery) return []

    return USER_DIRECTORY.filter((user) => {
      return (
        normalizeSearchText(user.name).includes(normalizedQuery) ||
        normalizeSearchText(user.handle).includes(normalizedQuery)
      )
    })
  }, [query])

  const mediaSearchResults = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query)
    if (!normalizedQuery) return []

    const localProfileResults = Object.values(UNIVERSAL_MEDIA_ENTITIES)
      .filter((entity) => {
        const metadataFilter = entityTypeToMetadataFilter(entity.type)
        const isPeopleEntity = peopleEntityTypes.has(entity.type)
        const allowedByAlternateFilters = !alternateSearchEnabled || (
          (isPeopleEntity && alternateSearchIncludesPeople) ||
          (metadataFilter !== null && alternateSearchTypes.includes(metadataFilter))
        )

        if (!allowedByAlternateFilters) return false

        const searchableText = normalizeSearchText([
          entity.name,
          entity.categoryLabel,
          entity.description,
          ...entity.metadataChips.flatMap((chip) => [chip.label, chip.value]),
        ].join(' '))

        return searchableText.includes(normalizedQuery)
      })
      .sort((a, b) => {
        const aTitle = normalizeSearchText(a.name)
        const bTitle = normalizeSearchText(b.name)
        const aExact = aTitle === normalizedQuery ? 0 : 1
        const bExact = bTitle === normalizedQuery ? 0 : 1
        if (aExact !== bExact) return aExact - bExact

        const aPerson = peopleEntityTypes.has(a.type) ? 0 : 1
        const bPerson = peopleEntityTypes.has(b.type) ? 0 : 1
        if (aPerson !== bPerson) return aPerson - bPerson

        return getEntityPopularityScore(b) - getEntityPopularityScore(a)
      })
      .map((entity, index) => universalEntityToSearchEntity(entity, index))

    const metadataResults = headerMediaResults.map((result, index) =>
      metadataResultToSearchEntity(result, localProfileResults.length + index),
    )
    return dedupeSearchEntities([...localProfileResults, ...metadataResults])
  }, [alternateSearchEnabled, alternateSearchIncludesPeople, alternateSearchTypes, headerMediaResults, query])

  const [followedUserHandles, setFollowedUserHandles] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('the-commonplace.following-users') || '["elena_r"]')
    } catch {
      return ['elena_r']
    }
  })

  const toggleFollowUser = (handle: string) => {
    const clean = handle.replace(/^@/, '')
    setFollowedUserHandles((prev) => {
      const next = prev.includes(clean) ? prev.filter((h) => h !== clean) : [...prev, clean]
      localStorage.setItem('the-commonplace.following-users', JSON.stringify(next))
      return next
    })
  }

  const [followRequestedHandles, setFollowRequestedHandles] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('the-commonplace.follow-requests') || '[]')
    } catch {
      return []
    }
  })

  const toggleFollowRequest = (handle: string) => {
    const clean = handle.replace(/^@/, '')
    setFollowRequestedHandles((prev) => {
      const next = prev.includes(clean) ? prev.filter((h) => h !== clean) : [...prev, clean]
      localStorage.setItem('the-commonplace.follow-requests', JSON.stringify(next))
      return next
    })
  }

  // ── Notifications ────────────────────────────────────────────────────────────
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('the-commonplace.notifications') || '[]')
    } catch {
      return []
    }
  })

  const addNotification = (n: AppNotification) => {
    setNotifications((prev) => {
      const next = [n, ...prev]
      localStorage.setItem('the-commonplace.notifications', JSON.stringify(next))
      return next
    })
  }

  const markAllNotificationsRead = () => {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }))
      localStorage.setItem('the-commonplace.notifications', JSON.stringify(next))
      return next
    })
  }

  const dismissNotification = (id: string) => {
    setNotifications((prev) => {
      const next = prev.filter((n) => n.id !== id)
      localStorage.setItem('the-commonplace.notifications', JSON.stringify(next))
      return next
    })
  }

  const clearAllNotifications = () => {
    setNotifications([])
    localStorage.removeItem('the-commonplace.notifications')
  }

  const allHomepageEntries = useMemo(() => {
    const ownWithAuthor = entries.map((e) => ({
      ...e,
      authorHandle: e.authorHandle || userProfile.handle,
      authorName: e.authorName || userProfileName,
      authorAvatarUrl: e.authorAvatarUrl || userProfile.avatarUrl,
    }))
    // Only include external profile entries if the profile is public OR the user follows them
    const externalEntries = Object.entries(MOCK_EXTERNAL_PROFILES).flatMap(([handle, p]) => {
      if (p.profile.isPrivate && !followedUserHandles.includes(handle)) return []
      return p.entries
    })
    const combined = [...ownWithAuthor, ...externalEntries]
    return combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [entries, userProfile.handle, userProfile.avatarUrl, userProfileName, followedUserHandles])

  const filteredEntries = useMemo(() => {
    if (typeFilter !== 'all') {
      return allHomepageEntries.filter((entry) => entry.type === typeFilter)
    }
    return allHomepageEntries
  }, [allHomepageEntries, typeFilter])

  const masonryLayout = useMasonryLayout(gridRef, filteredEntries.length, expandedCardId, activeView)
  const [isInitialRender, setIsInitialRender] = useState(true)
  const [isFilterSwitching, setIsFilterSwitching] = useState(false)

  const handleTypeFilterChange = (nextFilter: EntryType | 'all') => {
    if (nextFilter === typeFilter) return
    setIsFilterSwitching(true)
    setTypeFilter(nextFilter)
  }

  const handleQueryChange = (val: string) => {
    setIsFilterSwitching(true)
    setQuery(val)
  }

  useEffect(() => {
    if (masonryLayout) {
      const timer = setTimeout(() => {
        setIsInitialRender(false)
        setIsFilterSwitching(false)
      }, 120)
      return () => clearTimeout(timer)
    }
  }, [masonryLayout, typeFilter, query])

  const saveEntries = (nextEntries: Entry[]) => {
    setEntries(nextEntries)
    localStorage.setItem(storageKey, JSON.stringify(nextEntries))
  }

  const handleLogout = () => {
    if (window.confirm(`Log out of ${userProfileName} session?`)) {
      setIsLoggedOut(true)
      setProfileMenuOpen(false)
    }
  }

  const renderNotificationsGroup = () => (
    <NotificationBell
      notifications={notifications}
      onMarkAllRead={markAllNotificationsRead}
      onClearAll={clearAllNotifications}
      onDismiss={dismissNotification}
    />
  )

  const renderQuickDevTools = () => (
    <div className="quick-devtools">
      {quickDevToolsOpen && (
        <div className="quick-devtools-panel">
          <div className="quick-devtools-panel-header">
            <div className="quick-devtools-title">
              <Wrench aria-hidden="true" />
              <span>Developer Tools</span>
            </div>
            <button
              type="button"
              className="quick-devtools-close"
              onClick={() => setQuickDevToolsOpen(false)}
              aria-label="Close developer tools"
              title="Close"
            >
              <X aria-hidden="true" />
            </button>
          </div>
          <ApiUsageTracker
            onAddNotification={addNotification}
            alternateSearchEnabled={alternateSearchEnabled}
            onAlternateSearchEnabledChange={setAlternateSearchEnabled}
          />
        </div>
      )}

      <div className="quick-devtools-dock" aria-label="Developer quick access">
        <button
          type="button"
          className={`quick-devtools-btn ${quickDevToolsOpen ? 'active' : ''}`}
          onClick={() => setQuickDevToolsOpen((open) => !open)}
          title="Open developer tools"
        >
          <Wrench aria-hidden="true" />
          <span>Developer Tools</span>
        </button>
      </div>
    </div>
  )

  const renderHeaderSearchFilters = () => (
    <div className="search-filter-row" role="group" aria-label="Search filters">
      <button
        type="button"
        className={`search-filter-chip ${alternateSearchIncludesPeople ? 'active selected' : ''}`}
        onClick={() => {
          toggleAlternateSearchPeople()
          setSearchTab('media')
        }}
      >
        <User aria-hidden="true" />
        <span>People</span>
      </button>
      {entryTypes.map(({ id, label, Icon }) => {
        const active = alternateSearchTypes.includes(id)
        return (
          <button
            key={id}
            type="button"
            className={`search-filter-chip ${active ? 'active' : ''} ${searchTab === 'media' && active ? 'selected' : ''}`}
            onClick={() => {
              const removingLastMediaType = active && alternateSearchTypes.length === 1
              toggleAlternateSearchType(id)
              setSearchTab(removingLastMediaType && alternateSearchIncludesPeople ? 'users' : 'media')
            }}
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </button>
        )
      })}
    </div>
  )

  const renderHeaderSearchTabs = () => (
    <div className="search-tabs-row">
      <button
        type="button"
        className={`search-tab-btn ${searchTab === 'media' ? 'active' : ''}`}
        onClick={() => setSearchTab('media')}
      >
        Media Profiles
      </button>
      <button
        type="button"
        className={`search-tab-btn ${searchTab === 'users' ? 'active' : ''}`}
        onClick={() => setSearchTab('users')}
      >
        Users
      </button>
    </div>
  )

  const renderFloatingHeaderActions = () => (
    <div className="floating-header-actions">
      <div className={`hdr-search-box ${searchOpen ? 'open' : ''}`}>
        <button
          className="hdr-icon-btn"
          type="button"
          aria-label="Search"
          onClick={() => setSearchOpen((v) => !v)}
          title="Search entries and users"
        >
          <Search aria-hidden="true" />
        </button>
        {searchOpen && (
          <>
            <input
              type="text"
              className="hdr-search-input"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search title, user, author..."
              aria-label="Search entries and users"
              autoFocus
            />
            <button
              type="button"
              className="hdr-search-close"
              title="Close search"
              aria-label="Close search"
              onClick={() => {
                setQuery('')
                setSearchOpen(false)
              }}
            >
              <X aria-hidden="true" />
            </button>
          </>
        )}

        {searchOpen && (query.trim().length > 0 || alternateSearchEnabled) && (
          <div className="search-results-dropdown">
            {alternateSearchEnabled ? renderHeaderSearchFilters() : renderHeaderSearchTabs()}

            <div className="search-dropdown-section">
              {!alternateSearchEnabled && searchTab === 'users' ? (
                query.trim().length === 0 ? (
                  <div className="search-no-results">Start typing to search people.</div>
                ) : userSearchResults.length === 0 ? (
                  <div className="search-no-results">No people matching "{query}"</div>
                ) : (
                  userSearchResults.map((u) => {
                    const isOwn = u.handle === userProfile.handle
                    return (
                      <button
                        key={u.handle}
                        type="button"
                        className="search-user-item"
                        onClick={() => {
                          setSelectedProfileHandle(isOwn ? null : u.handle)
                          setActiveView('profile')
                          setSearchOpen(false)
                        }}
                      >
                        <div className="search-user-left">
                          <div className="search-user-avatar">
                            {u.avatar ? (
                              <img src={u.avatar} alt={u.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                              <User aria-hidden="true" />
                            )}
                          </div>
                          <div className="search-user-info">
                            <span className="search-user-name">
                              {u.name}
                              {u.isPrivate && <Lock size={12} style={{ marginLeft: 5, verticalAlign: 'middle', color: 'var(--secondary)' }} />}
                            </span>
                            <span className="search-user-handle">@{u.handle} &bull; {u.reviews} reviews</span>
                          </div>
                        </div>
                        <span className="search-user-action">{isOwn ? 'My Profile' : 'View Profile'}</span>
                      </button>
                    )
                  })
                )
              ) : (
                <>
                  {query.trim().length === 0 ? (
                    <div className="search-no-results">Start typing to search media.</div>
                  ) : mediaSearchResults.length === 0 ? (
                    <div className="search-no-results">
                      {headerMediaSearchLoading ? 'Searching' : `No media profiles matching "${query}"`}
                    </div>
                  ) : (
                    <>
                      {mediaSearchResults.slice(0, searchLimit).map((entity) => (
                        <EntitySearchItem
                          key={entity.id}
                          entity={entity}
                          onSelect={() => handleOpenSearchEntity(entity)}
                        />
                      ))}
                      {mediaSearchResults.length > searchLimit && (
                        <div className="search-load-more-container">
                          <button
                            type="button"
                            className="search-load-more-btn"
                            onClick={() => setSearchLimit((prev) => prev + 8)}
                          >
                            <span>Load more</span>
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {renderNotificationsGroup()}

      <div className="profile-menu-wrapper" ref={profileMenuRef}>
        <button
          className="profile-avatar-btn"
          type="button"
          aria-label="User Profile & Settings"
          title="User Profile & Settings"
          onClick={() => setProfileMenuOpen((v) => !v)}
        >
          {userProfile.avatarUrl ? (
            <img src={userProfile.avatarUrl} alt="Avatar" className="profile-avatar-img-sm" />
          ) : (
            <User aria-hidden="true" />
          )}
        </button>

        {profileMenuOpen && (
          <div className="profile-dropdown-menu">
            <div className="menu-identity-block">
              <div className="menu-identity-avatar">
                {userProfile.avatarUrl ? (
                  <img src={userProfile.avatarUrl} alt="Avatar" className="menu-identity-avatar-img" />
                ) : (
                  <User aria-hidden="true" />
                )}
              </div>
              <div className="menu-identity-info">
                <span className="menu-user-name">
                  {userProfile.showFullName ? `${userProfile.firstName} ${userProfile.lastName}` : userProfile.firstName}
                </span>
                <button
                  type="button"
                  className="menu-view-profile-link"
                  onClick={() => {
                    setSelectedProfileHandle(null)
                    setActiveView('profile')
                    setProfileMenuOpen(false)
                  }}
                >
                  View Profile
                </button>
              </div>
            </div>
            <div className="menu-divider" />
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                setActiveView('settings')
                setProfileMenuOpen(false)
              }}
            >
              <Settings aria-hidden="true" />
              <span>Settings</span>
            </button>
            <div className="menu-divider" />
            <button type="button" className="menu-item" onClick={handleLogout}>
              <LogOut aria-hidden="true" />
              <span>Logout</span>
            </button>
            <button
              type="button"
              className="menu-item danger"
              onClick={() => {
                if (window.confirm('Clear all entries from local storage?')) {
                  setEntries([])
                  localStorage.removeItem('the-commonplace.entries')
                  setProfileMenuOpen(false)
                }
              }}
            >
              <Trash2 aria-hidden="true" />
              <span>Clear All Data</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )

  const [showScrollTop, setShowScrollTop] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY || document.documentElement.scrollTop
      setShowScrollTop(scrollPos > 350)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openComposer = (entry: Entry | null = null) => {
    setEditingEntry(entry)
    setComposerOpen(true)
  }

  const closeComposer = () => {
    setComposerOpen(false)
    setEditingEntry(null)
  }

  const handleSave = (draft: EntryDraft, disableComments?: boolean) => {
    const timestamp = new Date().toISOString()

    if (editingEntry) {
      const nextEntries = entries.map((entry) =>
        entry.id === editingEntry.id
          ? { ...entry, ...draft, updatedAt: timestamp }
          : entry,
      )
      saveEntries(nextEntries)
      if (disableComments !== undefined) {
        setDisabledCommentEntryIds((prev) => {
          const has = prev.includes(editingEntry.id)
          if (disableComments && !has) {
            const next = [...prev, editingEntry.id]
            localStorage.setItem('the-commonplace.disabled-comments', JSON.stringify(next))
            return next
          }
          if (!disableComments && has) {
            const next = prev.filter((id) => id !== editingEntry.id)
            localStorage.setItem('the-commonplace.disabled-comments', JSON.stringify(next))
            return next
          }
          return prev
        })
      }
      setExpandedCardId(editingEntry.id)
    } else {
      const newId = makeId()
      const newEntry: Entry = {
        ...draft,
        id: newId,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      saveEntries([newEntry, ...entries])
      if (disableComments) {
        setDisabledCommentEntryIds((prev) => {
          const next = [...prev, newId]
          localStorage.setItem('the-commonplace.disabled-comments', JSON.stringify(next))
          return next
        })
      }
      setExpandedCardId('')
    }

    closeComposer()
  }

  const [deletingEntry, setDeletingEntry] = useState<Entry | null>(null)

  const promptDeleteEntry = (entryId: string) => {
    const target = entries.find((e) => e.id === entryId)
    if (target) {
      setDeletingEntry(target)
    }
  }

  const deleteEntry = (entryId: string) => {
    const nextEntries = entries.filter((entry) => entry.id !== entryId)
    saveEntries(nextEntries)
    if (expandedCardId === entryId) setExpandedCardId('')
  }

  // Render Standalone Pages
  if (activeView === 'profile') {
    const isViewingOwn = selectedProfileHandle === null || selectedProfileHandle === userProfile.handle
    const currentProfileData = isViewingOwn
      ? { profile: userProfile, entries: entries }
      : MOCK_EXTERNAL_PROFILES[selectedProfileHandle || ''] || { profile: userProfile, entries: entries }

    return (
      <>
        {renderFloatingHeaderActions()}
        <UserProfilePage
          onBack={() => {
            setSelectedProfileHandle(null)
            setActiveView('feed')
          }}
          entries={currentProfileData.entries}
          savedEntryIds={savedEntryIds}
          likedEntryIds={likedEntryIds}
          disabledCommentEntryIds={disabledCommentEntryIds}
          onSelectEntry={(entry) => setOverlayEntry(entry)}
          onToggleLike={toggleLikeEntry}
          onToggleSave={toggleSaveEntry}
          onToggleCommentsDisabled={toggleCommentsDisabled}
          userProfile={currentProfileData.profile}
          onNavigateToSettings={() => setActiveView('settings')}
          onDeleteEntry={(id) => promptDeleteEntry(id)}
          onEditEntry={(entry) => openComposer(entry)}
          categoryFilter={profileCategoryFilter}
          onCategoryFilterChange={setProfileCategoryFilter}
          isOwnProfile={isViewingOwn}
          onSelectUserProfile={(handle) => {
            const cleanHandle = handle.replace(/^@/, '')
            if (cleanHandle === userProfile.handle) {
              setSelectedProfileHandle(null)
            } else if (MOCK_EXTERNAL_PROFILES[cleanHandle]) {
              setSelectedProfileHandle(cleanHandle)
            }
          }}
          followedUserHandles={followedUserHandles}
          onToggleFollowUser={toggleFollowUser}
          currentUserProfile={userProfile}
          followRequestedHandles={followRequestedHandles}
          onToggleFollowRequest={toggleFollowRequest}
        />
        <CardOverlayModal
          entry={overlayEntry}
          onClose={() => setOverlayEntry(null)}
          isLiked={overlayEntry ? likedEntryIds.includes(overlayEntry.id) : false}
          isSaved={overlayEntry ? savedEntryIds.includes(overlayEntry.id) : false}
          onToggleLike={() => overlayEntry && toggleLikeEntry(overlayEntry.id)}
          onToggleSave={() => overlayEntry && toggleSaveEntry(overlayEntry.id)}
        />
        <AnimatePresence>
          {deletingEntry && (
            <div className="modal-backdrop" style={{ zIndex: 120 }} onClick={() => setDeletingEntry(null)}>
              <motion.div
                className="settings-modal"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="settings-header">
                  <div className="settings-header-title">
                    <Trash2 style={{ color: '#e57373' }} aria-hidden="true" />
                    <h2>Delete Entry?</h2>
                  </div>
                </div>
                <p style={{ color: 'var(--secondary)', lineHeight: 1.6, marginBottom: 20 }}>
                  Are you sure you want to delete <strong>"{deletingEntry.title}"</strong>? This action cannot be undone.
                </p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button type="button" className="ghost-btn" onClick={() => setDeletingEntry(null)}>Cancel</button>
                  <button
                    type="button"
                    className="action-btn danger"
                    onClick={() => { if (deletingEntry) { deleteEntry(deletingEntry.id); setDeletingEntry(null) } }}
                  >
                    Delete Entry
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {composerOpen ? (
            <EntryComposer
              entry={editingEntry}
              onClose={closeComposer}
              onSave={handleSave}
              commentsDisabled={editingEntry ? disabledCommentEntryIds.includes(editingEntry.id) : false}
            />
          ) : null}
        </AnimatePresence>
        {renderQuickDevTools()}
      </>
    )
  }

  if (activeView === 'entity' && selectedEntityId) {
    let universalEntity: UniversalMediaEntity | null =
      searchEntityCacheRef.current.get(selectedEntityId) ||
      UNIVERSAL_MEDIA_ENTITIES[selectedEntityId] ||
      (MOCK_ENTITY_PROFILES[selectedEntityId]
        ? {
            id: MOCK_ENTITY_PROFILES[selectedEntityId].id,
            name: MOCK_ENTITY_PROFILES[selectedEntityId].title,
            type: MOCK_ENTITY_PROFILES[selectedEntityId].type as any,
            categoryLabel: MOCK_ENTITY_PROFILES[selectedEntityId].type.toUpperCase(),
            artworkUrl: MOCK_ENTITY_PROFILES[selectedEntityId].coverUrl,
            description: MOCK_ENTITY_PROFILES[selectedEntityId].bio,
            metadataChips: [
              {
                label: MOCK_ENTITY_PROFILES[selectedEntityId].creatorLabel,
                value: MOCK_ENTITY_PROFILES[selectedEntityId].creatorValue,
              },
            ],
            communityRating: {
              average: 4.8,
              count: 2413,
              distribution: { 5: 85, 4: 11, 3: 3, 2: 1, 1: 0 },
            },
            primaryCollection: {
              title: MOCK_ENTITY_PROFILES[selectedEntityId].topItemsTitle,
              items: MOCK_ENTITY_PROFILES[selectedEntityId].topItems.map((item, idx) => ({
                id: item.id,
                rank: idx + 1,
                title: item.name,
                subtitle: item.detail,
                rating: item.rating,
              })),
            },
          }
        : null)

    if (!universalEntity) {
      const mapItem = albumEntityMap.get(selectedEntityId) || albumEntityMap.get(selectedEntityId.toLowerCase())
      const cleanName = mapItem
        ? mapItem.name
        : selectedEntityId
            .replace(/^album-\d+/i, '')
            .replace(/^album-/i, '')
            .replace(/^song-\d+/i, '')
            .replace(/^song-/i, '')
            .replace(/-/g, ' ')
            .replace(/\b\w/g, (l) => l.toUpperCase())

      const isSong = selectedEntityId.startsWith('song-')
      const isAlbum = selectedEntityId.startsWith('album-') || selectedEntityId.includes('ep')

      universalEntity = {
        id: selectedEntityId,
        name: cleanName,
        type: isSong ? 'song' : isAlbum ? 'album' : 'artist',
        categoryLabel: isSong ? 'Song' : isAlbum ? 'Album' : 'Artist',
        artworkUrl: resolveArtworkUrl(
          mapItem?.artworkUrl ||
          entityImageCacheMap.get(cleanName) ||
          '',
          cleanName,
          isSong ? 'Song' : isAlbum ? 'Album' : 'Artist',
        ),
        description: `Official catalog entry for ${cleanName} in The Commonplace community reflections archive.`,
        metadataChips: [
          { label: 'Artist', value: mapItem?.artist || 'Artist' },
          { label: 'Category', value: isSong ? 'Song' : isAlbum ? 'Album' : 'Artist' },
          { label: 'Release Year', value: mapItem?.year || '2023' },
        ],
        communityRating: {
          average: 4.9,
          count: 1250,
          distribution: { 5: 88, 4: 10, 3: 2, 2: 0, 1: 0 },
        },
      }
    }

    if (universalEntity) {
      return (
        <>
          {renderFloatingHeaderActions()}
          <UniversalMediaProfilePage
            entity={universalEntity}
            onBack={handleEntityBack}
            onHome={handleHome}
            communityEntries={allHomepageEntries}
            onSelectEntry={setOverlayEntry}
            onOpenUserProfile={handleOpenUserProfile}
            onNavigateToEntity={handleNavigateEntityBreadcrumb}
            likedEntryIds={likedEntryIds}
            savedEntryIds={savedEntryIds}
            disabledCommentEntryIds={disabledCommentEntryIds}
            onToggleLike={toggleLikeEntry}
            onToggleSave={toggleSaveEntry}
          />
          <CardOverlayModal
            entry={overlayEntry}
            onClose={() => setOverlayEntry(null)}
            isLiked={overlayEntry ? likedEntryIds.includes(overlayEntry.id) : false}
            isSaved={overlayEntry ? savedEntryIds.includes(overlayEntry.id) : false}
            onToggleLike={() => overlayEntry && toggleLikeEntry(overlayEntry.id)}
            onToggleSave={() => overlayEntry && toggleSaveEntry(overlayEntry.id)}
          />
          {renderQuickDevTools()}
        </>
      )
    }
  }

  if (activeView === 'settings') {
    return (
      <>
        <SettingsPage
          onBack={() => setActiveView('feed')}
          onClearAllData={() => {
            setEntries([])
            localStorage.removeItem(storageKey)
            localStorage.removeItem('the-commonplace.likes')
            localStorage.removeItem('the-commonplace.saves')
          }}
          userProfile={userProfile}
          onSaveProfile={(updated) => setUserProfile(updated)}
          onAddNotification={addNotification}
        />
        {renderQuickDevTools()}
      </>
    )
  }

  return (
    <div className="app-shell">
      {/* Main content */}
      <main className="main-content">
        {/* Header */}
        <header className="commonplace-header">
          <div className="header-title-row">
            <div className="header-title-block">
              <h1 className="commonplace-title">The Commonplace.</h1>
            </div>
            <div className="header-actions">
              <div className={`hdr-search-box ${searchOpen ? 'open' : ''}`}>
                <button
                  className="hdr-icon-btn"
                  type="button"
                  aria-label="Search"
                  onClick={() => setSearchOpen((v) => !v)}
                  title="Search entries and users"
                >
                  <Search aria-hidden="true" />
                </button>
                {searchOpen && (
                  <>
                    <input
                      type="text"
                      className="hdr-search-input"
                      value={query}
                      onChange={(e) => handleQueryChange(e.target.value)}
                      placeholder="Search title, user, author…"
                      aria-label="Search entries and users"
                      autoFocus
                    />
                    <button
                      type="button"
                      className="hdr-search-close"
                      title="Close search"
                      aria-label="Close search"
                      onClick={() => {
                        setQuery('')
                        setSearchOpen(false)
                      }}
                    >
                      <X aria-hidden="true" />
                    </button>
                  </>
                )}

                {/* Search Dropdown with Tabs for Users vs Media/Entities */}
                {searchOpen && (query.trim().length > 0 || alternateSearchEnabled) && (
                  <div className="search-results-dropdown">
                    {alternateSearchEnabled ? renderHeaderSearchFilters() : renderHeaderSearchTabs()}

                    <div className="search-dropdown-section">
                      {!alternateSearchEnabled && searchTab === 'users' ? (
                        query.trim().length === 0 ? (
                          <div className="search-no-results">
                            Start typing to search people.
                          </div>
                        ) : userSearchResults.length === 0 ? (
                          <div className="search-no-results">
                            No people matching "{query}"
                          </div>
                        ) : (
                          userSearchResults.map((u) => {
                            const isOwn = u.handle === userProfile.handle
                            return (
                              <button
                                key={u.handle}
                                type="button"
                                className="search-user-item"
                                onClick={() => {
                                  setSelectedProfileHandle(isOwn ? null : u.handle)
                                  setActiveView('profile')
                                  setSearchOpen(false)
                                }}
                              >
                                <div className="search-user-left">
                                  <div className="search-user-avatar">
                                    {u.avatar ? (
                                      <img src={u.avatar} alt={u.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                    ) : (
                                      <User aria-hidden="true" />
                                    )}
                                  </div>
                                  <div className="search-user-info">
                                    <span className="search-user-name">
                                      {u.name}
                                      {u.isPrivate && <Lock size={12} style={{ marginLeft: 5, verticalAlign: 'middle', color: 'var(--secondary)' }} />}
                                    </span>
                                    <span className="search-user-handle">@{u.handle} &bull; {u.reviews} reviews</span>
                                  </div>
                                </div>
                                <span className="search-user-action">{isOwn ? 'My Profile' : 'View Profile'}</span>
                              </button>
                            )
                          })
                        )
                      ) : (
                        <>
                          {query.trim().length === 0 ? (
                            <div className="search-no-results">
                              Start typing to search media.
                            </div>
                          ) : mediaSearchResults.length === 0 ? (
                            <div className="search-no-results">
                              {headerMediaSearchLoading ? 'Searching' : `No media profiles matching "${query}"`}
                            </div>
                          ) : (
                            <>
                              {mediaSearchResults.slice(0, searchLimit).map((entity) => (
                                <EntitySearchItem
                                  key={entity.id}
                                  entity={entity}
                                  onSelect={() => handleOpenSearchEntity(entity)}
                                />
                              ))}
                              {mediaSearchResults.length > searchLimit && (
                                <div className="search-load-more-container">
                                  <button
                                    type="button"
                                    className="search-load-more-btn"
                                    onClick={() => setSearchLimit((prev) => prev + 8)}
                                  >
                                    <span>Load more</span>
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {renderNotificationsGroup()}

              <div className="profile-menu-wrapper" ref={profileMenuRef}>
                <button
                  className="profile-avatar-btn"
                  type="button"
                  aria-label="User Profile & Settings"
                  title="User Profile & Settings"
                  onClick={() => setProfileMenuOpen((v) => !v)}
                >
                  {userProfile.avatarUrl ? (
                    <img src={userProfile.avatarUrl} alt="Avatar" className="profile-avatar-img-sm" />
                  ) : (
                    <User aria-hidden="true" />
                  )}
                </button>

                {profileMenuOpen && (
                  <div className="profile-dropdown-menu">
                    {/* Identity block at the top */}
                    <div className="menu-identity-block">
                      <div className="menu-identity-avatar">
                        {userProfile.avatarUrl ? (
                          <img src={userProfile.avatarUrl} alt="Avatar" className="menu-identity-avatar-img" />
                        ) : (
                          <User aria-hidden="true" />
                        )}
                      </div>
                      <div className="menu-identity-info">
                        <span className="menu-user-name">
                          {userProfile.showFullName ? `${userProfile.firstName} ${userProfile.lastName}` : userProfile.firstName}
                        </span>
                        <button
                          type="button"
                          className="menu-view-profile-link"
                          onClick={() => {
                            setSelectedProfileHandle(null)
                            setActiveView('profile')
                            setProfileMenuOpen(false)
                          }}
                        >
                          View Profile
                        </button>
                      </div>
                    </div>
                    <div className="menu-divider" />
                    <button
                      type="button"
                      className="menu-item"
                      onClick={() => {
                        setActiveView('settings')
                        setProfileMenuOpen(false)
                      }}
                    >
                      <Settings aria-hidden="true" />
                      <span>Settings</span>
                    </button>
                    <div className="menu-divider" />
                    <button
                      type="button"
                      className="menu-item"
                      onClick={handleLogout}
                    >
                      <LogOut aria-hidden="true" />
                      <span>Logout</span>
                    </button>
                    <button
                      type="button"
                      className="menu-item danger"
                      onClick={() => {
                        if (window.confirm('Clear all entries from local storage?')) {
                          setEntries([])
                          localStorage.removeItem('the-commonplace.entries')
                          setProfileMenuOpen(false)
                        }
                      }}
                    >
                      <Trash2 aria-hidden="true" />
                      <span>Clear All Data</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="header-rule" />

          {/* Type filter tabs with animated pill */}
          <div className="filter-row">
            <nav className="type-tabs" aria-label="Filter by type">
              {/* Always render the pill inside every tab button — visibility is toggled via opacity
                  so Framer Motion's layoutId can animate it correctly without a double-render glitch */}
              <button
                className={`tab ${typeFilter === 'all' ? 'active' : ''}`}
                type="button"
                onClick={() => handleTypeFilterChange('all')}
              >
                {typeFilter === 'all' && (
                  <motion.div
                    layoutId="activeFilterPill"
                    className="active-tab-pill"
                    transition={{ type: 'spring', stiffness: 380, damping: 36 }}
                  />
                )}
                <span>All</span>
              </button>
              {entryTypes.map(({ id, label, Icon }) => {
                const isActive = typeFilter === id
                return (
                  <button
                    key={id}
                    className={`tab ${isActive ? 'active' : ''}`}
                    type="button"
                    onClick={() => handleTypeFilterChange(id)}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeFilterPill"
                        className="active-tab-pill"
                        transition={{ type: 'spring', stiffness: 380, damping: 36 }}
                      />
                    )}
                    <Icon aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                )
              })}
            </nav>
          </div>
        </header>

        {/* Skeleton loading grid during filter switching or initialization */}
        {(!masonryLayout || isFilterSwitching) && filteredEntries.length > 0 ? (
          <CardSkeletonGrid count={filteredEntries.length > 6 ? 6 : Math.max(2, filteredEntries.length)} />
        ) : null}

        {/* Card grid — JS absolute-position masonry, newest top-left */}
        <section
          className="card-grid"
          ref={gridRef as React.RefObject<HTMLElement>}
          style={{
            position: 'relative',
            height: masonryLayout ? masonryLayout.height : 'auto',
            minHeight: filteredEntries.length === 0 ? 320 : undefined,
            visibility: masonryLayout && !isFilterSwitching ? 'visible' : 'hidden',
            opacity: masonryLayout && !isFilterSwitching ? 1 : 0,
            transition: masonryLayout && !isFilterSwitching
              ? 'opacity 140ms ease-out'
              : 'none',
          }}
          aria-label="Saved entries"
        >
          {filteredEntries.map((entry) => {
            const pos = masonryLayout?.positions.get(entry.id)
            const typeMeta = getTypeMeta(entry.type)
            return (
              <div
                key={entry.id}
                data-id={entry.id}
                className="masonry-item"
                style={pos ? {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: pos.width,
                  transform: `translate3d(${pos.left}px, ${pos.top}px, 0)`,
                  transition: (isInitialRender || isFilterSwitching)
                    ? 'none'
                    : 'transform 320ms cubic-bezier(0.2, 0, 0, 1)',
                  willChange: 'transform',
                } : { width: '100%', marginBottom: 14 }}
              >
                <Card
                  entry={entry}
                  expanded={expandedCardId === entry.id}
                  onDelete={() => promptDeleteEntry(entry.id)}
                  onEdit={() => openComposer(entry)}
                  onToggle={() => toggleCardExpanded(entry.id)}
                  onExpandOverlay={() => setOverlayEntry(entry)}
                  onOpenProfile={() => handleOpenUserProfile(entry.authorHandle)}
                  typeIcon={typeMeta.Icon}
                  typeLabel={typeMeta.label}
                  isLiked={likedEntryIds.includes(entry.id)}
                  isSaved={savedEntryIds.includes(entry.id)}
                  onToggleLike={() => toggleLikeEntry(entry.id)}
                  onToggleSave={() => toggleSaveEntry(entry.id)}
                  commentsDisabled={disabledCommentEntryIds.includes(entry.id)}
                  onToggleCommentsDisabled={() => toggleCommentsDisabled(entry.id)}
                />
              </div>
            )
          })}
          {filteredEntries.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">
                <BookOpen aria-hidden="true" />
              </div>
              {entries.length === 0 ? (
                <>
                  <h3 className="empty-state-title">Your commonplace is waiting.</h3>
                  <p className="empty-state-subtitle">
                    Catalog your favorite quotes, books, albums, films, songs, games, and personal reflections in one quiet place.
                  </p>
                  <button
                    className="primary-btn"
                    type="button"
                    onClick={() => openComposer()}
                  >
                    <Plus aria-hidden="true" />
                    <span>Add your first entry</span>
                  </button>
                </>
              ) : (
                <>
                  <h3 className="empty-state-title">No entries found.</h3>
                  <p className="empty-state-subtitle">
                    No items match your search query or selected filter tab.
                  </p>
                  <button
                    className="ghost-btn"
                    type="button"
                    onClick={() => {
                      setQuery('')
                      setTypeFilter('all')
                    }}
                  >
                    <span>Reset Filters</span>
                  </button>
                </>
              )}
            </div>
          )}
        </section>

        {/* Reading Overlay Modal */}
        <CardOverlayModal
          entry={overlayEntry}
          onClose={() => setOverlayEntry(null)}
          isLiked={overlayEntry ? likedEntryIds.includes(overlayEntry.id) : false}
          isSaved={overlayEntry ? savedEntryIds.includes(overlayEntry.id) : false}
          onToggleLike={() => overlayEntry && toggleLikeEntry(overlayEntry.id)}
          onToggleSave={() => overlayEntry && toggleSaveEntry(overlayEntry.id)}
        />

        {/* Confirm Delete Card Modal */}
        <AnimatePresence>
          {deletingEntry && (
            <div className="modal-backdrop" style={{ zIndex: 120 }} onClick={() => setDeletingEntry(null)}>
              <motion.div
                className="settings-modal"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="settings-header">
                  <div className="settings-header-title">
                    <Trash2 style={{ color: '#e57373' }} aria-hidden="true" />
                    <h2>Delete Entry?</h2>
                  </div>
                </div>
                <p style={{ color: 'var(--secondary)', lineHeight: 1.6, marginBottom: 20 }}>
                  Are you sure you want to delete <strong>"{deletingEntry.title}"</strong>? This action cannot be undone.
                </p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => setDeletingEntry(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="action-btn danger"
                    onClick={() => {
                      if (deletingEntry) {
                        deleteEntry(deletingEntry.id)
                        setDeletingEntry(null)
                      }
                    }}
                  >
                    Delete Entry
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Logged Out Dialog */}
        <AnimatePresence>
          {isLoggedOut && (
            <div className="modal-backdrop" onClick={() => setIsLoggedOut(false)}>
              <motion.div
                className="settings-modal"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="settings-header">
                  <div className="settings-header-title">
                    <LogOut aria-hidden="true" />
                    <h2>Signed Out</h2>
                  </div>
                </div>
                <p style={{ color: 'var(--secondary)', lineHeight: 1.6, marginBottom: 20 }}>
                  You have logged out of your session. Your local catalog entries remain safely preserved.
                </p>
                <button
                  type="button"
                  className="primary-btn"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => setIsLoggedOut(false)}
                >
                  Log back in as jimboii
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* Floating action buttons stack */}
      <div className="fab-stack">
        <AnimatePresence>
          {showScrollTop && (
            <motion.button
              className="fab fab-scroll-top"
              type="button"
              aria-label="Scroll back to top"
              title="Scroll back to top"
              initial={{ opacity: 0, scale: 0.7, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.7, y: 10 }}
              transition={{ duration: 0.18 }}
              onClick={scrollToTop}
            >
              <ChevronUp aria-hidden="true" />
            </motion.button>
          )}
        </AnimatePresence>

        <button
          className="fab"
          type="button"
          aria-label="Add new entry"
          title="Add new entry"
          onClick={() => openComposer()}
        >
          <Plus aria-hidden="true" />
        </button>
      </div>

      {/* Entry composer modal */}
      <AnimatePresence>
        {composerOpen ? (
          <EntryComposer
            entry={editingEntry}
            onClose={closeComposer}
            onSave={handleSave}
            commentsDisabled={editingEntry ? disabledCommentEntryIds.includes(editingEntry.id) : false}
          />
        ) : null}
      </AnimatePresence>
      {renderQuickDevTools()}
    </div>
  )
}

function App() {
  return (
    <ExpansionProvider>
      <AppContent />
    </ExpansionProvider>
  )
}

function TypeIconBar({
  value,
  onChange,
  disabled,
}: {
  value: EntryType
  onChange: (type: EntryType) => void
  disabled?: boolean
}) {
  return (
    <div className="type-icon-bar">
      {entryTypes.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className={`type-icon-btn ${value === id ? 'active' : ''}`}
          onClick={() => !disabled && onChange(id)}
          disabled={disabled}
          aria-label={label}
        >
          <Icon aria-hidden="true" style={{ width: 18, height: 18 }} />
          <span className="type-icon-tooltip">{label}</span>
        </button>
      ))}
    </div>
  )
}

function EntryComposer({
  entry,
  onClose,
  onSave,
  commentsDisabled = false,
}: {
  entry: Entry | null
  onClose: () => void
  onSave: (draft: EntryDraft, disableComments?: boolean) => void
  commentsDisabled?: boolean
}) {
  const [isCommentsDisabled, setIsCommentsDisabled] = useState(commentsDisabled)
  const initialDraft = entry
    ? {
        type: entry.type,
        title: entry.title,
        creator: entry.creator,
        provider: entry.provider,
        providerId: entry.providerId,
        genre: entry.genre,
        year: entry.year,
        rating: entry.rating,
        favoritePassage: entry.favoritePassage,
        reflection: entry.reflection,
        reflectionAlign: entry.reflectionAlign || 'left',
        passageAlign: entry.passageAlign || 'left',
        enableDropCap: entry.enableDropCap ?? false,
        coverUrl: entry.coverUrl,
        summary: entry.summary,
        coverTone: entry.coverTone,
      }
    : emptyDraft
  const [draft, setDraft] = useState<EntryDraft>(
    initialDraft,
  )
  const [metadataQuery, setMetadataQuery] = useState(initialDraft.title)
  const [metadataResults, setMetadataResults] = useState<MetadataResult[]>([])
  const [searchStatus, setSearchStatus] = useState<
    'idle' | 'searching' | 'ready' | 'error'
  >('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [selectedLyricIndexes, setSelectedLyricIndexes] = useState<number[]>([])
  const [showPassage, setShowPassage] = useState(() => Boolean(entry?.favoritePassage?.trim()))
  const [lyricsStatus, setLyricsStatus] = useState<
    'idle' | 'loading' | 'ready' | 'not-found'
  >(entry ? 'idle' : 'idle') // on edit, we skip auto-fetch; set to 'loaded-skip' sentinel
  const isEditMode = Boolean(entry)
  const [lyrics, setLyrics] = useState('')
  const [showUnratedConfirm, setShowUnratedConfirm] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [dontShowAgain, setDontShowAgain] = useState(false)
  const [pendingDraft, setPendingDraft] = useState<EntryDraft | null>(null)
  const lyricsFetchId = useRef(0)
  const reflectionRef = useRef<HTMLDivElement>(null)
  const passageRef = useRef<HTMLDivElement>(null)
  const [activeTarget, setActiveTarget] = useState<'reflection' | 'favoritePassage'>('reflection')

  const activeRef = activeTarget === 'favoritePassage' ? passageRef : reflectionRef
  const activeValue = activeTarget === 'favoritePassage' ? draft.favoritePassage : draft.reflection
  const setActiveValue = (val: string) => setDraft((cur) => ({ ...cur, [activeTarget]: val }))

  const handleRequestClose = () => {
    if (isDraftDirty(draft, initialDraft)) {
      setShowDiscardConfirm(true)
    } else {
      onClose()
    }
  }

  const isMusicEntry = draft.type === 'song' || draft.type === 'album'
  const lyricLines = lyrics
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  useEffect(() => {
    if (draft.type !== 'song' || !draft.title || !draft.creator) return
    if (lyricsStatus !== 'idle') return

    const fetchId = ++lyricsFetchId.current
    setLyricsStatus('loading')
    const abortController = new AbortController()

    fetchLyrics(draft.creator, draft.title, abortController.signal)
      .then((fetched) => {
        if (lyricsFetchId.current !== fetchId) return
        if (fetched) {
          setLyrics(fetched)
          setLyricsStatus('ready')

          if (draft.favoritePassage) {
            const matched = getMatchingLyricIndexes(fetched, draft.favoritePassage)
            if (matched.length > 0) {
              setSelectedLyricIndexes(matched)
            }
          }
        } else {
          setLyricsStatus('not-found')
        }
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        if (lyricsFetchId.current === fetchId) setLyricsStatus('not-found')
      })

    return () => abortController.abort()
  }, [isEditMode, draft.type, draft.title, draft.creator, lyricsStatus, draft.favoritePassage])

  useEffect(() => {
    const normalizedQuery = metadataQuery.trim()
    const isSelectedValue =
      draft.providerId && normalizedQuery === draft.title.trim()

    if (normalizedQuery.length < 2 || isSelectedValue) {
      setSearchStatus('idle')
      setStatusMessage('')
      if (normalizedQuery.length < 2) setMetadataResults([])
      return
    }

    // Instant return if result is already cached
    const cached = getCachedMetadata(draft.type, normalizedQuery)
    if (cached) {
      setMetadataResults(cached)
      setSearchStatus('ready')
      setStatusMessage('')
      return
    }

    setSearchStatus('searching')
    setStatusMessage('Searching')

    let cancelled = false
    const abortController = new AbortController()

    const timeout = window.setTimeout(() => {
      searchMetadata(draft.type, normalizedQuery, abortController.signal)
        .then((results) => {
          if (cancelled) return
          setMetadataResults(results)
          setSearchStatus('ready')
          setStatusMessage(
            results.length > 0 ? '' : 'No results found. You can still fill details manually.',
          )
        })
        .catch((err: unknown) => {
          if (cancelled || (err instanceof Error && err.name === 'AbortError')) return
          setSearchStatus('error')
          setStatusMessage(
            err instanceof Error ? err.message : 'Failed to search metadata API.',
          )
        })
    }, 120)

    return () => {
      cancelled = true
      abortController.abort()
      window.clearTimeout(timeout)
    }
  }, [draft.providerId, draft.title, draft.type, metadataQuery])

  const changeType = (type: EntryType) => {
    setDraft((cur) => ({
      ...emptyDraft,
      rating: cur.rating,
      reflection: cur.reflection,
      type,
      coverTone: getDefaultCoverTone(type),
    }))
    setMetadataQuery('')
    setMetadataResults([])
    setSelectedLyricIndexes([])
    setLyricsStatus('idle')
    setLyrics('')
    setSearchStatus('idle')
    setStatusMessage('')
    setShowPassage(false)
  }

  const updateMetadataQuery = (value: string) => {
    setMetadataQuery(value)
    setDraft((cur) => ({
      ...cur,
      title: '',
      creator: '',
      provider: '',
      providerId: '',
      coverUrl: undefined,
      summary: undefined,
      favoritePassage: isMusicEntry ? '' : cur.favoritePassage,
    }))
    setSelectedLyricIndexes([])
    setLyricsStatus('idle')
    setLyrics('')
  }

  const selectMetadata = async (result: MetadataResult) => {
    const fetchId = ++lyricsFetchId.current
    setDraft((cur) => draftFromMetadata(result, cur))
    setMetadataQuery(result.title)
    setMetadataResults([])
    setSearchStatus('idle')
    setStatusMessage('')
    setSelectedLyricIndexes([])

    if (result.type === 'song') {
      setLyricsStatus('loading')
      setLyrics('')
      const abortController = new AbortController()
      try {
        const fetched = await fetchLyrics(result.creator, result.title, abortController.signal)
        if (lyricsFetchId.current !== fetchId) return // stale — user picked another item
        if (fetched) {
          setLyrics(fetched)
          setLyricsStatus('ready')
          if (draft.favoritePassage) {
            const matched = getMatchingLyricIndexes(fetched, draft.favoritePassage)
            if (matched.length > 0) {
              setSelectedLyricIndexes(matched)
            }
          }
        } else {
          setLyricsStatus('not-found')
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return
        if (lyricsFetchId.current === fetchId) setLyricsStatus('not-found')
      }
    } else {
      setLyricsStatus('idle')
      setLyrics('')
    }
  }

  const toggleLyricLine = (index: number) => {
    const nextIndexes = selectedLyricIndexes.includes(index)
      ? selectedLyricIndexes.filter((selectedIndex) => selectedIndex !== index)
      : [...selectedLyricIndexes, index].sort((a, b) => a - b)

    setSelectedLyricIndexes(nextIndexes)
    setShowPassage(true)
    setDraft((cur) => ({
      ...cur,
      favoritePassage: nextIndexes.map((lineIndex) => lyricLines[lineIndex]).join('\n'),
    }))
  }

  const submitDraft = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!draft.title.trim()) {
      setSearchStatus('error')
      setStatusMessage('Choose an API result before saving.')
      return
    }

    const finalDraft: EntryDraft = {
      ...draft,
      title: draft.title.trim(),
      creator: draft.creator.trim(),
      provider: draft.provider.trim(),
      providerId: draft.providerId.trim(),
      favoritePassage: draft.favoritePassage.trim(),
      reflection: draft.reflection.trim(),
    }

    if (draft.rating === 0 && getWarnUnratedPreference()) {
      setPendingDraft(finalDraft)
      setShowUnratedConfirm(true)
      return
    }

    onSave(finalDraft, isCommentsDisabled)
  }

  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => { if (e.target === e.currentTarget) handleRequestClose() }}
    >
      <motion.form
        className="composer"
        onSubmit={submitDraft}
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ duration: 0.2 }}
      >
        <div className="composer-header composer-header--landscape">
          <div className="composer-header-spacer" />
          <div className="composer-title">
            <p className="composer-eyebrow">{entry ? 'Edit entry' : 'New entry'}</p>
            <h2>{entry ? entry.title : 'New Margin'}</h2>
            <div className="composer-title-rule" />
          </div>
          <button
            className="composer-close-icon"
            type="button"
            onClick={handleRequestClose}
            aria-label="Close modal"
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <div className="composer-landscape">
          <section className="composer-left">
            <div className="form-grid">
              <label>
                <span>Type</span>
                <TypeIconBar
                  value={draft.type}
                  onChange={changeType}
                  disabled={Boolean(entry)}
                />
              </label>

              {!entry && (
                <label className="metadata-search-field">
                  <span>Select {draft.type === 'tv' ? 'a show' : `a ${draft.type}`}</span>
                  <input
                    value={metadataQuery}
                    onChange={(event) => updateMetadataQuery(event.target.value)}
                    placeholder={`Search ${getTypeMeta(draft.type).label.toLowerCase()}`}
                  />
                  {metadataQuery.trim().length >= 2 && (
                    <div className="metadata-dropdown">
                      {searchStatus === 'searching' && metadataResults.length === 0 && (
                        <p className="metadata-status searching">
                          <Loader2 className="spin-icon" aria-hidden="true" />
                          <span>Searching</span>
                        </p>
                      )}
                      {searchStatus !== 'searching' && statusMessage && (
                        <p className="metadata-status">{statusMessage}</p>
                      )}
                      {searchStatus === 'ready' && metadataResults.map((result) => (
                        <button
                          className={
                            result.providerId === draft.providerId
                              ? 'metadata-option selected'
                              : 'metadata-option'
                          }
                          key={result.id}
                          type="button"
                          onClick={() => selectMetadata(result)}
                        >
                          <span
                            className={
                              usesSquareArtwork(result.type)
                                ? 'metadata-thumb metadata-thumb--square'
                                : 'metadata-thumb'
                            }
                          >
                            {result.coverUrl ? (
                              <img src={resolveArtworkUrl(result.coverUrl, result.title, result.type)} alt="" />
                            ) : (
                              <Search aria-hidden="true" />
                            )}
                          </span>
                          <span className="metadata-option-copy">
                            <strong>{result.title}</strong>
                            <span className="metadata-type-line">
                              <span>{[result.creator, result.provider || result.genre].filter(Boolean).join(' • ')}</span>
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </label>
              )}
            </div>

            {draft.title ? (
              <div className="selected-metadata">
                <div
                  className={
                    usesSquareArtwork(draft.type)
                      ? 'selected-cover selected-cover--square'
                      : 'selected-cover'
                  }
                >
                  {draft.coverUrl ? (
                    <img src={resolveArtworkUrl(draft.coverUrl, draft.title, draft.type)} alt="" />
                  ) : (
                    <BookOpen aria-hidden="true" />
                  )}
                </div>
                <div className="selected-metadata-info">
                  <h3>{draft.title}</h3>
                  {draft.type === 'book' && (
                    <>
                      {draft.creator && <p>Author: {draft.creator}</p>}
                      {draft.genre && <p className="selected-genre">{draft.genre}</p>}
                    </>
                  )}
                  {draft.type === 'album' && (
                    <>
                      {draft.creator && <p>Artist: {draft.creator}</p>}
                      {draft.genre && <p className="selected-genre">{draft.genre}</p>}
                    </>
                  )}
                  {draft.type === 'song' && (
                    <>
                      {draft.creator && <p>Artist: {draft.creator}</p>}
                      {draft.genre && <p className="selected-genre">{draft.genre}</p>}
                      {draft.provider && draft.provider !== draft.genre && draft.provider !== draft.year && (
                        <p>{draft.provider}</p>
                      )}
                    </>
                  )}
                  {draft.type === 'film' && (
                    <>
                      {draft.genre && <p className="selected-genre">{draft.genre}</p>}
                      {(draft.creator || draft.year) && (
                        <p>{draft.creator || (draft.year ? `Released ${draft.year}` : '')}</p>
                      )}
                    </>
                  )}
                  {draft.type === 'game' && (
                    <>
                      {draft.genre && <p className="selected-genre">{draft.genre}</p>}
                      {draft.creator && <p>Developer: {draft.creator}</p>}
                    </>
                  )}
                  {draft.type === 'tv' && (
                    <>
                      {draft.genre && <p className="selected-genre">{draft.genre}</p>}
                      {draft.creator && <p>Cast: {draft.creator}</p>}
                    </>
                  )}
                  {draft.summary && <p className="selected-summary">{draft.summary}</p>}
                </div>
              </div>
            ) : (
              <div className="selected-metadata selected-metadata--empty">
                <div className="selected-cover">
                  <BookOpen aria-hidden="true" />
                </div>
                <div className="selected-metadata-info">
                  <h3>Choose something to keep</h3>
                  <p>Search results will auto-fill the title, creator, year, source, and artwork.</p>
                </div>
              </div>
            )}

            <div className="full-label">
              <span>Rating ({draft.rating} / 5)</span>
              <RatingPicker
                value={draft.rating}
                onChange={(rating) => setDraft((cur) => ({ ...cur, rating }))}
              />
            </div>
          </section>

          <section className="composer-right">
            {draft.type === 'song' ? (
              <div className="full-label lyrics-section">
                <div className="passage-header">
                  <span>Favorite lyrics</span>
                </div>
                <div className="lyrics-box">
                  {lyricsStatus === 'idle' && (
                    <div className="lyrics-placeholder">
                      <Music4 aria-hidden="true" />
                      <p>Select a song to load lyrics and tap the lines you love.</p>
                    </div>
                  )}
                  {lyricsStatus === 'loading' && (
                    <div className="lyrics-placeholder">
                      <Loader2 className="spin-icon" aria-hidden="true" />
                      <p>Fetching lyrics…</p>
                    </div>
                  )}
                  {lyricsStatus === 'not-found' && (
                    <div className="lyrics-placeholder">
                      <p>No lyrics found automatically for this track.</p>
                    </div>
                  )}
                  {lyricsStatus === 'ready' && lyricLines.length > 0 && (
                    <div className="lyrics-selector">
                      {lyricLines.map((line, index) => (
                        <button
                          className={
                            selectedLyricIndexes.includes(index)
                              ? 'lyric-line selected'
                              : 'lyric-line'
                          }
                          key={`${line}-${index}`}
                          type="button"
                          onClick={() => toggleLyricLine(index)}
                        >
                          {line}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : showPassage ? (
              <div className="full-label passage-container">
                <div className="passage-header">
                  <span>
                    {draft.type === 'album'
                      ? 'Favorite lyrics / passage'
                      : 'Favorite passage'}
                  </span>
                  <button
                    type="button"
                    className="collapse-passage-btn"
                    onClick={() => {
                      setShowPassage(false)
                      setDraft((cur) => ({ ...cur, favoritePassage: '' }))
                    }}
                    title="Remove favorite passage"
                  >
                    <X aria-hidden="true" />
                  </button>
                </div>
                <RichTextEditor
                  editorRef={passageRef}
                  value={draft.favoritePassage}
                  onFocus={() => setActiveTarget('favoritePassage')}
                  onChange={(html) =>
                    setDraft((cur) => ({ ...cur, favoritePassage: html }))
                  }
                  minHeight={100}
                  placeholder={
                    draft.type === 'album'
                      ? 'A lyric or line from this album that stayed with you…'
                      : 'A line, a scene, a quote, or a moment…'
                  }
                />
              </div>
            ) : (
              <button
                type="button"
                className="toggle-passage-btn"
                onClick={() => setShowPassage(true)}
              >
                <Quote aria-hidden="true" />
                <span>+ Add favorite passage / quote</span>
              </button>
            )}

            <div className="full-label composer-review">
              <div className="passage-header">
                <span>Review / Reflection</span>
              </div>
              <RichTextEditor
                editorRef={reflectionRef}
                value={draft.reflection}
                onFocus={() => setActiveTarget('reflection')}
                onChange={(html) =>
                  setDraft((cur) => ({ ...cur, reflection: html }))
                }
                minHeight={180}
                placeholder="What stayed with you?"
              />
            </div>

            <div className="composer-actions">
              <div className="composer-toolbar-row">
                <FormattingToolbar
                  editorRef={activeRef}
                  value={activeValue}
                  onChange={setActiveValue}
                  enableDropCap={Boolean(draft.enableDropCap)}
                  onToggleDropCap={() =>
                    setDraft((cur) => ({
                      ...cur,
                      enableDropCap: !cur.enableDropCap,
                    }))
                  }
                />
                <button
                  type="button"
                  className={`disable-comments-square-btn ${isCommentsDisabled ? 'active' : ''}`}
                  title={isCommentsDisabled ? 'Comments disabled for this entry' : 'Disable comments for this entry'}
                  onClick={() => setIsCommentsDisabled((v) => !v)}
                >
                  <MessageSquareOff size={15} />
                </button>
              </div>
              <div className="composer-action-btns">
                <button className="ghost-btn" type="button" onClick={handleRequestClose}>
                  Cancel
                </button>
                <button className="primary-btn" type="submit">
                  <Save aria-hidden="true" />
                  <span>Publish</span>
                </button>
              </div>
            </div>
          </section>
        </div>
      </motion.form>

      {/* Confirmation modal when discarding unsaved changes */}
      <AnimatePresence>
        {showDiscardConfirm && (
          <div
            className="modal-backdrop"
            style={{ zIndex: 110 }}
            onClick={() => setShowDiscardConfirm(false)}
          >
            <motion.div
              className="settings-modal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="settings-header">
                <div className="settings-header-title">
                  <AlertCircle style={{ color: '#e57373' }} aria-hidden="true" />
                  <h2>Discard Unsaved Changes?</h2>
                </div>
              </div>
              <p style={{ color: 'var(--secondary)', lineHeight: 1.6, marginBottom: 20 }}>
                You have unsaved changes in this entry. Are you sure you want to discard them?
              </p>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => setShowDiscardConfirm(false)}
                >
                  Keep Editing
                </button>
                <button
                  type="button"
                  className="action-btn danger"
                  onClick={() => {
                    setShowDiscardConfirm(false)
                    onClose()
                  }}
                >
                  Discard Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation modal when publishing an unrated entry */}
      <AnimatePresence>
        {showUnratedConfirm && (
          <div
            className="modal-backdrop"
            style={{ zIndex: 100 }}
            onClick={() => setShowUnratedConfirm(false)}
          >
            <motion.div
              className="settings-modal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="settings-header">
                <div className="settings-header-title">
                  <AlertCircle style={{ color: '#f5b74c' }} aria-hidden="true" />
                  <h2>Publish Without Rating?</h2>
                </div>
              </div>
              <p style={{ color: 'var(--secondary)', lineHeight: 1.6, marginBottom: 16 }}>
                You have not assigned a star rating to this entry. Are you sure you want to publish it without a rating?
              </p>

              <label className="dont-show-again-label">
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                />
                <span>Don't show this warning again</span>
              </label>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => setShowUnratedConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => {
                    if (dontShowAgain) {
                      setWarnUnratedPreference(false)
                    }
                    setShowUnratedConfirm(false)
                    if (pendingDraft) {
                      onSave(pendingDraft)
                    }
                  }}
                >
                  Publish Anyway
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function RatingPicker({
  value,
  onChange,
}: {
  value: number
  onChange: (rating: number) => void
}) {
  const [hoverValue, setHoverValue] = useState<number | null>(null)
  const isHovering = hoverValue !== null
  const activeRating = isHovering ? hoverValue : value

  return (
    <div
      className={isHovering ? 'rating-picker is-hovering' : 'rating-picker'}
      aria-label={`${value} out of 5 stars`}
      onMouseLeave={() => setHoverValue(null)}
    >
      {Array.from({ length: 5 }, (_, index) => {
        const fillPercent = Math.max(0, Math.min(1, activeRating - index)) * 100

        return (
          <span className="rating-star-control" key={index}>
            <Star aria-hidden="true" className="rating-star-outline" />
            <span className="rating-star-fill" style={{ width: `${fillPercent}%` }}>
              <Star aria-hidden="true" />
            </span>
            <button
              type="button"
              className="rating-hit rating-hit-left"
              aria-label={`${index + 0.5} stars`}
              onMouseEnter={() => setHoverValue(index + 0.5)}
              onClick={() => onChange(index + 0.5)}
            />
            <button
              type="button"
              className="rating-hit rating-hit-right"
              aria-label={`${index + 1} stars`}
              onMouseEnter={() => setHoverValue(index + 1)}
              onClick={() => onChange(index + 1)}
            />
          </span>
        )
      })}
    </div>
  )
}

export default App
