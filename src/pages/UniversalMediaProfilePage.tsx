import React, { useState, useMemo, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Home,
  Star,
  ChevronRight,
  Heart,
  MessageSquare,
  Bookmark,
  Layers,
  BookOpen,
  Disc3,
  Clapperboard,
  Tv,
  Gamepad2,
  Sparkles,
  Loader2,
  Plus,
  User,
  Users,
  Music4,
  Quote,
  Clock,
  X,
} from 'lucide-react'
import type { Entry as CardEntry } from '../features/entries/model'
import { buildCommunityQuoteRanking } from '../features/quotes/communityQuotes'
import { buildMostQuotedWorks, type MostQuotedWork } from '../features/quotes/quotedWorks'
import { StarRating } from '../components/CommonplaceCard/CardHeader'
import { FormattedText } from '../components/CommonplaceCard/FormattedText'
import { UNIVERSAL_MEDIA_ENTITIES } from '../data/universalMediaEntities'
import {
  type UniversalMediaEntity,
  type MediaEntityType,
  type RelatedEntityItem,
  type GameMetadata,
  type HumanCapabilities,
  type HumanProfileMetadata,
  getEntityTabs,
} from '../types/mediaEntity'
import {
  searchMetadata,
  fetchWikipediaPortrait,
  fetchWikipediaProfile,
  type WikipediaPersonType,
  fetchWikipediaStudioAlbumNumber,
  fetchArtistPortrait,
  getArtistPortraitCacheKey,
  fetchSimilarArtistsByGenreAndLocation,
  warmSimilarArtistPortraits,
  fetchItunesDiscography,
  fetchItunesAlbumDetails,
  fetchItunesAlbumVersionFamily,
  fetchRelatedAlbums,
  fetchItunesSongDetails,
  fetchItunesSongAppearances,
  fetchItunesSongArtwork,
  fetchItunesTopSongs,
  fetchHumanScreenCredits,
  fetchHumanPublishedBooks,
  entityImageCacheMap,
  albumEntityMap,
  scoreGameTitleMatch,
  fetchGameDetails,
  type MetadataType,
  type MetadataResult,
  type AlbumVersionFamily,
} from '../metadata'
import { ordinalize } from '../utils/songBio'
import {
  verifiedProfessionsFromWikipedia,
  getDynamicHumanTabs,
} from '../features/profiles/humanProfile'
import type { MetadataChip, CollectionItem, TopContentItem, HumanScreenCredit, HumanProfileContext } from '../types/mediaEntity'
import { useMasonryLayout } from '../hooks/useMasonryLayout'
import { formatFullDateTime, formatRelativeTime } from '../utils/dateUtils'
import { createArtworkPlaceholder, resolveArtworkUrl, buildSrcSet, getImageSizes } from '../utils/artwork'
import { normalizeGameMetadata } from '../utils/gameMetadata'
import {
  GameAvailableOnPreview,
  GameInfoTab,
  PlatformsReleasesTab,
} from '../components/GameProfile/GameProfileSections'
import { AdaptiveGameArtwork } from '../components/GameArtwork/AdaptiveGameArtwork'

type ScoredRelatedEntityItem = RelatedEntityItem & {
  sortScore?: number
  preferWikipediaArtwork?: boolean
}

interface UniversalMediaProfilePageProps {
  entity: UniversalMediaEntity
  onBack: () => void
  onHome?: () => void
  communityEntries: CardEntry[]
  onSelectEntry?: (entry: CardEntry) => void
  onOpenUserProfile?: (handle: string) => void
  onNavigateToEntity?: (
    entityId: string,
    entityType?: MediaEntityType,
    resolvedEntity?: UniversalMediaEntity,
  ) => void
  onCanonicalHumanResolved?: (
    sourceEntity: UniversalMediaEntity,
    humanProfile: HumanProfileMetadata,
  ) => void
  onQuickAddEntry?: (payload: {
    entity: UniversalMediaEntity
    favoritePassage: string
    lyrics: string
    artworkUrl: string
    metadataChips: MetadataChip[]
  }) => void
  likedEntryIds?: string[]
  savedEntryIds?: string[]
  disabledCommentEntryIds?: string[]
  onToggleLike?: (id: string) => void
  onToggleSave?: (id: string) => void
}

function getMediaIcon(type: MediaEntityType) {
  switch (type) {
    case 'artist':
    case 'album':
    case 'song':
      return Disc3
    case 'movie':
    case 'director':
    case 'actor':
      return Clapperboard
    case 'tv':
      return Tv
    case 'game':
    case 'game_studio':
      return Gamepad2
    case 'author':
    case 'book':
    default:
      return BookOpen
  }
}

function mapToMetaType(type: MediaEntityType): MetadataType {
  switch (type) {
    case 'artist':
    case 'album':
    case 'song':
      return 'album'
    case 'movie':
    case 'director':
    case 'actor':
      return 'film'
    case 'tv':
      return 'tv'
    case 'game':
    case 'game_studio':
      return 'game'
    case 'author':
    case 'book':
    default:
      return 'book'
  }
}

function sentenceCaseLyricLine(line: string) {
  const firstLetterIndex = line.search(/[a-z]/i)
  if (firstLetterIndex < 0) return line
  return `${line.slice(0, firstLetterIndex)}${line[firstLetterIndex].toUpperCase()}${line.slice(firstLetterIndex + 1)}`
}

function buildChipsFromMetadataResult(
  result: MetadataResult,
  type: MediaEntityType,
): MetadataChip[] {
  const chips: MetadataChip[] = []
  const creatorLabel = type === 'album' || type === 'song'
    ? 'Artist'
    : type === 'game'
      ? 'Studio'
      : type === 'book' || type === 'author'
        ? 'Author'
        : type === 'movie' || type === 'director'
          ? 'Director'
          : 'Creator'
  const genre = result.genres?.filter(Boolean).join(', ') || result.genre || ''

  if (result.creator) chips.push({ label: creatorLabel, value: result.creator })
  if (genre) chips.push({ label: 'Genre', value: genre })
  if (result.year) chips.push({ label: 'Release Year', value: result.year })
  if (result.language) chips.push({ label: 'Language', value: result.language })
  if (result.explicit) chips.push({ label: 'Explicit', value: 'Yes' })

  return chips
}

function isPortraitEntity(type: MediaEntityType) {
  return ['human', 'artist', 'author', 'director', 'actor'].includes(type)
}

function getReviewSubjectTypeLabel(type: CardEntry['type']) {
  switch (type) {
    case 'album':
      return 'Album'
    case 'song':
      return 'Song'
    case 'film':
      return 'Film'
    case 'tv':
      return 'TV'
    case 'game':
      return 'Game'
    case 'book':
    default:
      return 'Book'
  }
}

function getEntityImageCacheKey(entity: UniversalMediaEntity) {
  if (entity.type === 'album' || entity.type === 'song') {
    const artist = entity.metadataChips.find((chip) => /^artist$/i.test(chip.label))?.value || ''
    const release = entity.metadataChips.find((chip) => /^(?:album|detail)$/i.test(chip.label))?.value || ''
    const year = entity.metadataChips.find((chip) => /year|release/i.test(chip.label))?.value || ''
    return [
      'contextual-artwork-v2',
      entity.type,
      entity.providerId || entity.id,
      entity.name,
      artist,
      release,
      year,
    ].map((value) => normalizeReviewSubjectText(value)).join(':')
  }
  return `${entity.type}:${entity.id || entity.name}`.toLowerCase()
}

function normalizeReviewSubjectText(value?: string) {
  return (value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[â€™â€˜]/g, "'")
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function normalizeMusicEditionTitle(value?: string) {
  return normalizeReviewSubjectText(value)
    .replace(/\b(clean|edited|censored|explicit|non explicit|radio edit|clean version|explicit version|edited version)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getChipValue(chips: MetadataChip[] | undefined, pattern: RegExp) {
  return chips?.find((chip) => pattern.test(chip.label))?.value || ''
}

function entryTypeForEntity(type: MediaEntityType): CardEntry['type'] | null {
  if (type === 'movie') return 'film'
  if (type === 'album' || type === 'song' || type === 'book' || type === 'tv' || type === 'game') return type
  return null
}

function screenCreditToMediaEntity(credit: HumanScreenCredit, personName: string): UniversalMediaEntity {
  return {
    id: credit.providerId ? `tmdb:${credit.mediaType}:${credit.providerId}` : credit.id,
    name: credit.title,
    type: credit.mediaType,
    categoryLabel: credit.mediaType === 'movie' ? 'Film' : 'TV Series',
    artworkUrl: credit.artworkUrl || '',
    description: [
      `Filmography credit for ${personName}.`,
      credit.role ? `Role: ${credit.role}.` : '',
      credit.year ? `Released ${credit.year}.` : '',
    ].filter(Boolean).join(' '),
    metadataChips: [
      ...(credit.role ? [{ label: 'Role', value: credit.role }] : []),
      ...(credit.year ? [{ label: 'Release Year', value: credit.year }] : []),
    ],
    communityRating: {
      average: 0,
      count: 0,
      distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    },
  }
}

function humanCreditCategoryLabel(category: HumanScreenCredit['category']) {
  switch (category) {
    case 'acting':
      return 'Acting'
    case 'directing':
      return 'Directing'
    case 'concert':
      return 'Concert Films'
    case 'documentary':
      return 'Documentaries'
    default:
      return 'Screen Credits'
  }
}

function reviewMatchesEntity(entry: CardEntry, entity: UniversalMediaEntity, chips: MetadataChip[]) {
  const entityName = normalizeReviewSubjectText(entity.name)
  const entryTitle = normalizeReviewSubjectText(entry.title)
  const entityType = entryTypeForEntity(entity.type)

  if (entity.type === 'artist' || entity.type === 'author' || entity.type === 'director' || entity.type === 'creator' || entity.type === 'game_studio' || entity.type === 'human') {
    return normalizeReviewSubjectText(entry.creator) === entityName
  }

  if (entity.type === 'actor') {
    return false
  }

  if (!entityType || entry.type !== entityType) return false

  if (entity.type === 'album' || entity.type === 'song') {
    const entityArtist = normalizeReviewSubjectText(getChipValue(chips, /artist|creator/i))
    const entryArtist = normalizeReviewSubjectText(entry.creator)
    const sameTitle = normalizeMusicEditionTitle(entry.title) === normalizeMusicEditionTitle(entity.name)
    const sameArtist = !entityArtist || !entryArtist || entityArtist === entryArtist
    return sameTitle && sameArtist
  }

  return entryTitle === entityName
}

function formatCount(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000
    return (Number.isInteger(v) || v >= 100 ? Math.round(v) : parseFloat(v.toFixed(1))) + 'm'
  }
  if (n >= 1_000) {
    const v = n / 1_000
    return (Number.isInteger(v) || v >= 100 ? Math.round(v) : parseFloat(v.toFixed(1))) + 'k'
  }
  return String(n)
}

function getExpectedTrackCount(entity: UniversalMediaEntity) {
  const trackCountChip = entity.metadataChips.find((chip) => chip.label.toLowerCase() === 'track count')
  const count = Number.parseInt(trackCountChip?.value || '', 10)
  return Number.isFinite(count) && count > 0 ? count : undefined
}

function songEntityIdFromTopItem(item: TopContentItem | (CollectionItem & { rank?: number })) {
  if (/^song-\d+$/i.test(item.id)) return item.id
  const slug = item.title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `song-${slug || item.id}`
}

function scoreSongMetadataMatch(
  resultTitle: string,
  resultArtist: string,
  resultAlbum: string,
  item: TopContentItem | (CollectionItem & { rank?: number }),
  artistName?: string,
) {
  const targetTitle = normalizeMusicEditionTitle(item.title)
  const candidateTitle = normalizeMusicEditionTitle(resultTitle)
  const targetArtist = normalizeReviewSubjectText(artistName)
  const candidateArtist = normalizeReviewSubjectText(resultArtist)
  const targetAlbum = normalizeMusicEditionTitle(item.subtitle)
  const candidateAlbum = normalizeMusicEditionTitle(resultAlbum)

  let score = 0
  if (candidateTitle === targetTitle) score += 5000
  else if (candidateTitle.includes(targetTitle) || targetTitle.includes(candidateTitle)) score += 1200

  if (targetArtist && candidateArtist === targetArtist) score += 3500
  else if (targetArtist && (candidateArtist.includes(targetArtist) || targetArtist.includes(candidateArtist))) score += 600

  if (targetAlbum && candidateAlbum && (targetAlbum.includes(candidateAlbum) || candidateAlbum.includes(targetAlbum))) {
    score += 1800
  }

  return score
}

const TrackRow: React.FC<{
  item: TopContentItem | (CollectionItem & { rank?: number })
  artistName?: string
  parentArtworkUrl?: string
  onNavigateToEntity?: (id: string, entityType?: MediaEntityType) => void
  entityType?: MediaEntityType
  useParentArtwork?: boolean
}> = ({ item, artistName, parentArtworkUrl, onNavigateToEntity, entityType, useParentArtwork = false }) => {
  const fallbackUrl = parentArtworkUrl || createArtworkPlaceholder(item.title, item.subtitle)
  const initialArtworkUrl = item.artworkUrl ? resolveArtworkUrl(item.artworkUrl, item.title, item.subtitle) : (parentArtworkUrl || '')
  const [artworkUrl, setArtworkUrl] = useState(
    initialArtworkUrl || fallbackUrl,
  )
  const [isResolvingTarget, setIsResolvingTarget] = useState(false)

  useEffect(() => {
    const nextArtworkUrl = item.artworkUrl ? resolveArtworkUrl(item.artworkUrl, item.title, item.subtitle) : (parentArtworkUrl || '')
    setArtworkUrl(nextArtworkUrl || fallbackUrl)
  }, [fallbackUrl, item.artworkUrl, item.subtitle, item.title, parentArtworkUrl])

  useEffect(() => {
    if (!artistName || useParentArtwork) return

    const abortController = new AbortController()
    const providerTrackId =
      item.id.match(/^song-(?:itunes|chart)-(\d+)$/i)?.[1] ||
      item.id.match(/^song-(\d+)$/i)?.[1] ||
      undefined
    fetchItunesSongArtwork(item.title, artistName, abortController.signal, providerTrackId)
      .then((url) => {
        if (url) setArtworkUrl(resolveArtworkUrl(url, item.title, item.subtitle))
      })
      .catch(() => {})

    return () => abortController.abort()
  }, [artistName, item.artworkUrl, item.id, item.subtitle, item.title, useParentArtwork])

  const handleActivate = async () => {
    if (isResolvingTarget) return
    let targetId = entityType === 'song' ? songEntityIdFromTopItem(item) : item.id
    let resolvedTitle = item.title
    let resolvedArtist = artistName || ''
    let resolvedArtworkUrl = artworkUrl
    let resolvedYear = item.subtitle?.match(/\b(19|20)\d{2}\b/)?.[0] || ''
    let resolvedExplicit = item.explicit

    if (entityType === 'song') {
      if (!/^song-\d+$/i.test(targetId)) {
        setIsResolvingTarget(true)
        try {
          const query = artistName ? `${item.title} ${artistName}` : item.title
          const results = await searchMetadata('song', query)
          const best = [...results]
            .filter((result) => result.providerId)
            .sort(
              (a, b) =>
                scoreSongMetadataMatch(b.title, b.creator, b.provider, item, artistName) -
                scoreSongMetadataMatch(a.title, a.creator, a.provider, item, artistName),
            )[0]

          if (best?.providerId) {
            targetId = `song-${best.providerId}`
            resolvedTitle = best.title || resolvedTitle
            resolvedArtist = best.creator || resolvedArtist
            resolvedArtworkUrl = resolveArtworkUrl(best.coverUrl, best.title, best.type) || resolvedArtworkUrl
            resolvedYear = best.year || resolvedYear
            resolvedExplicit = best.explicit ?? resolvedExplicit
          }
        } catch {
          // Keep the local song route fallback if the provider lookup is unavailable.
        } finally {
          setIsResolvingTarget(false)
        }
      }

      albumEntityMap.set(targetId, {
        id: targetId,
        name: resolvedTitle,
        artist: resolvedArtist,
        artworkUrl: resolvedArtworkUrl,
        year: resolvedYear,
        category: 'single',
        explicit: resolvedExplicit,
      })
    }
    onNavigateToEntity?.(targetId, entityType)
  }

  return (
    <div
      className="top-content-row"
      onClick={handleActivate}
      style={{ cursor: isResolvingTarget ? 'progress' : 'pointer' }}
      role="button"
      tabIndex={0}
      aria-busy={isResolvingTarget}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          handleActivate()
        }
      }}
    >
      {'rank' in item && item.rank ? <span className="row-rank">#{item.rank}</span> : null}
      <img
        src={artworkUrl}
        alt={item.title}
        className="row-thumb"
        referrerPolicy="no-referrer"
        loading="eager"
        decoding="async"
        onError={() => setArtworkUrl(fallbackUrl)}
      />
      <div className="row-info">
        <span className="row-title">
          <span>{item.title}</span>
          {item.explicit && <span className="explicit-badge explicit-badge--inline" aria-label="Explicit">E</span>}
        </span>
        <span className="row-subtitle">{item.subtitle}</span>
      </div>
      {item.rating && (
        <div className="row-rating-pill">
          <Star size={12} fill="currentColor" />
          <span>{item.rating.toFixed(1)}</span>
        </div>
      )}
    </div>
  )
}

const CollectionItemThumb: React.FC<{ title: string; defaultUrl: string }> = ({ title, defaultUrl }) => {
  const [src, setSrc] = useState(resolveArtworkUrl(defaultUrl, title, 'Album'))
  const fallbackSrc = createArtworkPlaceholder(title, 'Album')

  useEffect(() => {
    setSrc(resolveArtworkUrl(defaultUrl, title, 'Album') || fallbackSrc)
  }, [defaultUrl, title])

  return (
    <img
      src={src || fallbackSrc}
      alt={title}
      className="collection-thumb"
      referrerPolicy="no-referrer"
      loading="eager"
      decoding="async"
      onError={() => {
        if (src === fallbackSrc) return
        setSrc(fallbackSrc)
      }}
    />
  )
}

const MostQuotedSongCard: React.FC<{
  item: MostQuotedWork
  rank: number
  onNavigate?: (entityId: string, entityType?: MediaEntityType) => void
}> = ({ item, rank, onNavigate }) => {
  const fallbackArtwork = useMemo(
    () => createArtworkPlaceholder(item.title, 'Song'),
    [item.title],
  )
  const [artworkUrl, setArtworkUrl] = useState(
    () => resolveArtworkUrl(item.coverUrl, item.title, 'Song') || fallbackArtwork,
  )

  useEffect(() => {
    setArtworkUrl(resolveArtworkUrl(item.coverUrl, item.title, 'Song') || fallbackArtwork)
  }, [fallbackArtwork, item.coverUrl, item.title])

  const openSong = () => {
    const providerId = item.providerId?.trim() || ''
    const id = /^song-/i.test(providerId)
      ? providerId
      : /^\d+$/.test(providerId)
        ? `song-${providerId}`
        : songEntityIdFromTopItem({
            id: item.id,
            rank,
            title: item.title,
            subtitle: item.album || item.creator,
          })
    onNavigate?.(id, 'song')
  }

  return (
    <button
      type="button"
      className="most-quoted-work-card is-song is-clickable"
      onClick={openSong}
      aria-label={`Open ${item.title}`}
    >
      <span className="most-quoted-work-cover is-square">
        <img
          src={artworkUrl}
          alt={item.title}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setArtworkUrl(fallbackArtwork)}
        />
      </span>
      <span className="most-quoted-work-copy">
        <span className="most-quoted-work-rank">#{rank} most quoted</span>
        <h3>{item.title}</h3>
        <span className="most-quoted-work-release">
          {[item.album, item.year].filter(Boolean).join(' · ') || item.creator}
        </span>
      </span>
    </button>
  )
}

function collectionItemToAlbumEntity(item: CollectionItem, fallbackArtist = ''): UniversalMediaEntity {
  const artist = item.artist?.trim() || fallbackArtist.trim()
  const providerId = item.id.match(/^album-(\d+)$/i)?.[1]
  const categoryLabel = item.category === 'single' ? 'Single' : item.category === 'ep' ? 'EP' : 'Album'

  return {
    id: item.id,
    name: item.title,
    type: 'album',
    categoryLabel,
    artworkUrl: resolveArtworkUrl(item.artworkUrl, item.title, [artist, item.year].filter(Boolean).join(' ')),
    providerId,
    explicit: item.explicit,
    description: `${categoryLabel} by ${artist || 'Unknown artist'}${item.year ? `, released in ${item.year}` : ''}.`,
    metadataChips: [
      ...(artist ? [{ label: 'Artist', value: artist }] : []),
      { label: 'Category', value: categoryLabel },
      ...(item.year ? [{ label: 'Release Year', value: item.year }] : []),
      ...(item.genre ? [{ label: 'Genre', value: item.genre }] : []),
      ...(item.explicit ? [{ label: 'Explicit', value: 'Yes' }] : []),
    ],
    communityRating: {
      average: item.rating || 0,
      count: 0,
      distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    },
  }
}

const CommunityReviewSkeleton: React.FC<{ compact?: boolean }> = ({ compact = false }) => (
  <div className={`community-review-card community-review-card--skeleton ${compact ? 'is-compact' : ''}`} aria-hidden="true">
    <div className="community-review-card-header">
      <div className="community-review-author">
        <span className="skeleton-box cr-skel-avatar" />
        <div className="cr-skel-meta">
          <span className="skeleton-box cr-skel-handle" />
          <span className="skeleton-box cr-skel-time" />
        </div>
      </div>
      <span className="skeleton-box cr-skel-bookmark" />
    </div>

    <div className="community-review-stars cr-skel-stars-row">
      <span className="skeleton-box cr-skel-stars" />
    </div>

    <div className="community-review-content cr-skel-content">
      <div className="cr-skel-pullquote">
        <span className="skeleton-box cr-skel-line" style={{ width: '92%' }} />
        <span className="skeleton-box cr-skel-line" style={{ width: '78%' }} />
        <span className="skeleton-box cr-skel-line" style={{ width: '85%' }} />
      </div>
      {!compact && (
        <div className="cr-skel-body">
          <span className="skeleton-box cr-skel-line" style={{ width: '100%' }} />
          <span className="skeleton-box cr-skel-line" style={{ width: '88%' }} />
          <span className="skeleton-box cr-skel-line" style={{ width: '60%' }} />
        </div>
      )}
    </div>

    <div className="community-review-footer cr-skel-footer">
      <div className="cr-skel-actions">
        <span className="skeleton-box cr-skel-action" />
        <span className="skeleton-box cr-skel-action" />
      </div>
      <span className="skeleton-box cr-skel-read-more" />
    </div>
  </div>
)

const CommunityReviewCard: React.FC<{
  entry: CardEntry
  isLiked: boolean
  isSaved: boolean
  commentsDisabled: boolean
  showReviewedSubject?: boolean
  onOpen: () => void
  onOpenProfile: () => void
  onToggleLike?: () => void
  onToggleSave?: () => void
}> = ({
  entry,
  isLiked,
  isSaved,
  commentsDisabled,
  showReviewedSubject = false,
  onOpen,
  onOpenProfile,
  onToggleLike,
  onToggleSave,
}) => {
  const displayHandle = (entry.authorHandle || 'jimboii').replace(/^@/, '')
  const reviewedSubjectType = getReviewSubjectTypeLabel(entry.type)

  return (
    <article className={`community-review-card tone-${entry.coverTone}`}>
      <header className="community-review-card-header">
        <button
          type="button"
          className="community-review-author"
          onClick={(event) => {
            event.stopPropagation()
            onOpenProfile()
          }}
          aria-label={`View @${displayHandle}'s profile`}
        >
          <span className="community-review-avatar" aria-hidden="true">
            {entry.authorAvatarUrl ? (
              <img src={entry.authorAvatarUrl} alt="" />
            ) : (
              <User size={16} />
            )}
          </span>
          <span className="community-review-handle">@{displayHandle}</span>
          <span className="community-review-time" title={formatFullDateTime(entry.createdAt)}>
            {formatRelativeTime(entry.createdAt)}
          </span>
        </button>

        <button
          type="button"
          className={`community-review-bookmark ${isSaved ? 'saved' : ''}`}
          onClick={(event) => {
            event.stopPropagation()
            onToggleSave?.()
          }}
          aria-label={isSaved ? 'Unsave review' : 'Save review'}
          title={isSaved ? 'Unsave review' : 'Save review'}
        >
          <Bookmark size={18} fill={isSaved ? 'currentColor' : 'none'} />
        </button>
      </header>

      {showReviewedSubject && (
        <button type="button" className="community-review-subject" onClick={onOpen}>
          <span>{entry.title}</span>
          {(entry.type === 'song' || entry.type === 'album') && entry.explicit && (
            <span className="explicit-badge explicit-badge--inline" aria-label="Explicit">E</span>
          )}
          <span>- {reviewedSubjectType}</span>
        </button>
      )}

      <div className="community-review-stars">
        <StarRating rating={entry.rating} />
      </div>

      <button type="button" className="community-review-content" onClick={onOpen}>
        {entry.favoritePassage && (
          <div className="community-review-pullquote">
            <FormattedText text={entry.favoritePassage} align={entry.passageAlign} />
          </div>
        )}
        {entry.reflection && (
          <div className="community-review-body">
            <FormattedText text={entry.reflection} align={entry.reflectionAlign} />
          </div>
        )}
      </button>

      <footer className="community-review-footer">
        <div className="community-review-actions">
          <button
            type="button"
            className={`community-review-action ${isLiked ? 'liked' : ''}`}
            onClick={(event) => {
              event.stopPropagation()
              onToggleLike?.()
            }}
            aria-label={isLiked ? 'Unlike review' : 'Like review'}
          >
            <Heart size={17} fill={isLiked ? 'currentColor' : 'none'} />
            <span>{12 + (isLiked ? 1 : 0)}</span>
          </button>

          {!commentsDisabled && (
            <button
              type="button"
              className="community-review-action"
              onClick={(event) => {
                event.stopPropagation()
                onOpen()
              }}
              aria-label="Open comments"
            >
              <MessageSquare size={17} />
              <span>3</span>
            </button>
          )}
        </div>

        <button type="button" className="community-review-read-more" onClick={onOpen}>
          <span>Read more</span>
          <ChevronRight size={14} />
        </button>
      </footer>
    </article>
  )
}

const SimilarArtistPortraitItem: React.FC<{
  artist: ScoredRelatedEntityItem
  isActive: boolean
  onNavigate?: (entityId: string) => void
}> = ({ artist, isActive, onNavigate }) => {
  const personType = artist.type === 'author' ? 'author' : 'artist'
  const personLabel = personType === 'author' ? 'Author' : 'Artist'
  const cleanTitle = artist.title.toLowerCase()
  const fallbackSvg = useMemo(
    () => createArtworkPlaceholder(artist.title, artist.subtitle || personLabel),
    [artist.title, artist.subtitle, personLabel],
  )

  const initialUrl = useMemo(() => {
    if (personType === 'artist') {
      const cachedFanart = entityImageCacheMap.get(getArtistPortraitCacheKey(artist.title))
      if (cachedFanart) return cachedFanart
    }
    const cachedWiki = entityImageCacheMap.get(`wiki-portrait-v6:${cleanTitle}`)
    if (cachedWiki) return cachedWiki

    const cachedArtist = entityImageCacheMap.get(`${personType}:${artist.id}`) || entityImageCacheMap.get(cleanTitle)
    if (cachedArtist) return cachedArtist

    if (artist.artworkUrl && artist.artworkUrl.length > 5) {
      return resolveArtworkUrl(artist.artworkUrl, artist.title, artist.subtitle)
    }

    return fallbackSvg
  }, [artist.artworkUrl, artist.id, artist.subtitle, artist.title, cleanTitle, fallbackSvg, personType])

  const [portraitUrl, setPortraitUrl] = useState<string>(initialUrl)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const frameRef = useRef<HTMLSpanElement>(null)
  const [isVisible, setIsVisible] = useState(() =>
    // If image is already cached, skip IntersectionObserver and load immediately
    initialUrl !== fallbackSvg,
  )

  // Delay portrait fetch until the frame enters the viewport (200px margin)
  useEffect(() => {
    if (isVisible) return
    if (!('IntersectionObserver' in window)) {
      setIsVisible(true)
      return
    }
    const el = frameRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [isVisible])

  useEffect(() => {
    if (!isVisible) return
    let isMounted = true

    const cachedFanart = personType === 'artist'
      ? entityImageCacheMap.get(getArtistPortraitCacheKey(artist.title))
      : null
    if (cachedFanart) {
      setPortraitUrl(cachedFanart)
      return () => { isMounted = false }
    }

    const cachedWiki = entityImageCacheMap.get(`wiki-portrait-v6:${cleanTitle}`)
    if (cachedWiki && personType !== 'artist') {
      setPortraitUrl(cachedWiki)
      return () => { isMounted = false }
    }

    const portraitRequest = personType === 'artist'
      ? fetchArtistPortrait(artist.title)
      : fetchWikipediaPortrait(artist.title, undefined, personType)
    portraitRequest
      .then((url) => {
        if (!isMounted) return
        if (url) {
          entityImageCacheMap.set(`wiki-portrait:${cleanTitle}`, url)
          entityImageCacheMap.set(`${personType}:${artist.id}`, url)
          setPortraitUrl(url)
          setImageFailed(false)
        }
      })
      .catch(() => {})

    return () => {
      isMounted = false
    }
  }, [artist.id, artist.title, cleanTitle, isVisible, personType])

  const displaySrc = imageFailed ? fallbackSvg : portraitUrl
  const isLoading = !isVisible || (!imageLoaded && displaySrc === fallbackSvg)

  return (
    <button
      type="button"
      className={`similar-artist-portrait-item ${isActive ? 'is-active' : ''}`}
      onClick={() => onNavigate?.(artist.id)}
      aria-label={`Open ${artist.title} ${personLabel.toLowerCase()} profile`}
    >
      <span className="similar-artist-portrait-frame" ref={frameRef}>
        {isLoading && <span className="similar-artist-portrait-skeleton" aria-hidden="true" />}
        <img
          src={displaySrc}
          alt={artist.title}
          className={`similar-artist-portrait ${imageLoaded ? 'is-loaded' : ''}`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setImageLoaded(true)}
          onError={() => {
            if (!imageFailed) setImageFailed(true)
          }}
        />
      </span>
      <span className="similar-artist-name">{artist.title}</span>
    </button>
  )
}

const RelatedAlbumTile: React.FC<{
  item: CollectionItem
  onNavigate?: (
    entityId: string,
    entityType?: MediaEntityType,
    resolvedEntity?: UniversalMediaEntity,
  ) => void
}> = ({ item, onNavigate }) => (
  <button
    type="button"
    className="related-album-tile"
    onClick={() => onNavigate?.(item.id, 'album', collectionItemToAlbumEntity(item))}
    aria-label={`Open ${item.title}`}
  >
    <span className="related-album-art-frame">
      <CollectionItemThumb title={item.title} defaultUrl={item.artworkUrl} />
    </span>
    <span className="related-album-title">
      <span>{item.title}</span>
      {item.explicit && <span className="explicit-badge explicit-badge--inline" aria-label="Explicit">E</span>}
    </span>
    <span className="related-album-subtitle">{item.subtitle}</span>
  </button>
)

const SimilarGameTile: React.FC<{
  item: ScoredRelatedEntityItem
  onNavigate?: (entityId: string, entityType?: MediaEntityType) => void
}> = ({ item, onNavigate }) => {
  return (
    <button
      type="button"
      className="related-album-tile similar-game-tile"
      onClick={() => onNavigate?.(item.id, 'game')}
      aria-label={`Open ${item.title} game profile`}
    >
      <span className="related-album-art-frame similar-game-art-frame">
        <AdaptiveGameArtwork
          src={item.artworkUrl}
          title={item.title}
          preferWikipedia={item.preferWikipediaArtwork}
          alt={item.title}
          className="collection-thumb"
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
        />
      </span>
      <span className="related-album-title">{item.title}</span>
      <span className="related-album-subtitle">{item.subtitle}</span>
    </button>
  )
}

const FilmographyTile: React.FC<{
  credit: HumanScreenCredit
  personName: string
  onNavigate?: (
    entityId: string,
    entityType?: MediaEntityType,
    resolvedEntity?: UniversalMediaEntity,
  ) => void
}> = ({ credit, personName, onNavigate }) => {
  const mediaEntity = screenCreditToMediaEntity(credit, personName)
  const isTv = credit.mediaType === 'tv'

  return (
    <button
      type="button"
      className="filmography-tile"
      onClick={() => onNavigate?.(mediaEntity.id, credit.mediaType, mediaEntity)}
      aria-label={`Open ${credit.title}`}
    >
      <span className="filmography-poster-frame">
        <CollectionItemThumb title={credit.title} defaultUrl={credit.artworkUrl || ''} />
        <span className="filmography-media-badge">
          {isTv ? 'TV' : 'Film'}
        </span>
      </span>
      <span className="filmography-tile-title">
        <span>{credit.title}</span>
      </span>
      <span className="filmography-tile-subtitle">
        {[credit.year, credit.role].filter(Boolean).join(' · ') || (isTv ? 'TV Series' : 'Feature Film')}
      </span>
    </button>
  )
}

function primaryArtistGenre(entity: UniversalMediaEntity | undefined, fallback?: string) {
  if (!entity) return fallback || ''

  const overrides: Record<string, string> = {
    'taylor-swift': 'Pop',
    'olivia-rodrigo': 'Pop',
    'noah-kahan': 'Indie Folk',
    'hollow-coves': 'Indie Folk',
  }

  if (overrides[entity.id]) return overrides[entity.id]

  const genreChip = entity?.metadataChips?.find((chip) => chip.label.toLowerCase() === 'genre')?.value
  const genreText = genreChip || fallback || ''
  if (/pop/i.test(genreText)) return 'Pop'
  if (/indie|folk|acoustic/i.test(genreText)) return 'Indie Folk'
  if (/country/i.test(genreText)) return 'Country'
  if (/rock/i.test(genreText)) return 'Rock'
  return genreText.split('/')[0]?.trim() || fallback || ''
}

function getArtistMonthlyListeners(
  name: string,
  _ratingCount = 0,
  _collectionCount = 0,
): { value: string; sub: string } {
  const normalized = name.toLowerCase().trim()
  const knownListeners: Record<string, string> = {
    'taylor swift': '104.5M',
    'olivia rodrigo': '62.8M',
    'noah kahan': '28.4M',
    'hollow coves': '5.2M',
    'drake': '84.1M',
    'the weeknd': '112.3M',
    'billie eilish': '99.4M',
    'ariana grande': '82.6M',
    'ed sheeran': '77.9M',
    'sabrina carpenter': '74.2M',
    'chappell roan': '45.8M',
    'kendrick lamar': '68.3M',
    'gracie abrams': '33.1M',
    'phoebe bridgers': '14.6M',
    'lana del rey': '58.2M',
    'bruno mars': '118.9M',
    'coldplay': '88.7M',
    'dua lipa': '71.5M',
    'post malone': '64.3M',
    'sza': '69.1M',
  }

  if (knownListeners[normalized]) {
    return {
      value: knownListeners[normalized],
      sub: 'Spotify & Apple Music',
    }
  }

  const baseSeed = Array.from(normalized).reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const multiplier = (baseSeed % 85) + 12
  const decimal = baseSeed % 9
  const estimatedMillions = (multiplier + decimal / 10).toFixed(1)

  return {
    value: `${estimatedMillions}M`,
    sub: 'Estimated Monthly Listeners',
  }
}

function extractYearsActive(
  description?: string,
  discographyYears?: string[],
): string {
  if (description) {
    const activeRangeMatch = description.match(/\b((?:19|20)\d{2})\s*[–\-\u2013\u2014]\s*(present|current)\b/i)
    if (activeRangeMatch) {
      return `${activeRangeMatch[1]}–present`
    }

    const activeStartMatch = description.match(/\b(?:active\s+(?:since|from)?|career\s+in|debuted\s+in|formed\s+in|started\s+in)\s+((?:19|20)\d{2})\b/i)
    if (activeStartMatch) {
      return `${activeStartMatch[1]}–present`
    }
  }

  if (discographyYears && discographyYears.length > 0) {
    const validYears = discographyYears
      .map((y) => parseInt(y, 10))
      .filter((y) => Number.isFinite(y) && y >= 1930 && y <= new Date().getFullYear())
    if (validYears.length > 0) {
      const earliest = Math.min(...validYears)
      return `${earliest}–present`
    }
  }

  return '2000s–present'
}

function getGenreTokens(genreText: string) {
  const normalized = genreText.toLowerCase()
  const tokens = new Set<string>()

  if (/indie|alternative|alt\b/.test(normalized)) tokens.add('alternative')
  if (/folk|acoustic/.test(normalized)) tokens.add('folk')
  if (/pop/.test(normalized)) tokens.add('pop')
  if (/country|americana/.test(normalized)) tokens.add('country')
  if (/rock|punk|emo/.test(normalized)) tokens.add('rock')
  if (/r&b|soul/.test(normalized)) tokens.add('r&b')
  if (/hip[-\s]?hop|rap/.test(normalized)) tokens.add('hip-hop')
  if (/singer|songwriter/.test(normalized)) tokens.add('singer-songwriter')
  if (/electronic|dance|edm/.test(normalized)) tokens.add('electronic')

  if (tokens.size === 0 && normalized.trim()) {
    tokens.add(normalized.split(/[\/,·&|]+/)[0]?.trim() || normalized.trim())
  }

  return tokens
}

function getGameGenreProfile(entity: UniversalMediaEntity) {
  const chipGenre = entity.metadataChips.find((chip) => /^genres?$/i.test(chip.label))?.value
  const labels = (entity.gameMetadata?.genres?.length ? entity.gameMetadata.genres : [chipGenre || ''])
    .map((label) => label.trim())
    .filter(Boolean)
  const genreText = labels.join(' ')
  const tokens = new Set<string>()
  const signals: Array<[string, RegExp]> = [
    ['open-world', /\bopen[ -]?world\b/i],
    ['western', /\bwestern\b/i],
    ['survival-horror', /\bsurvival[ -]?horror\b/i],
    ['horror', /\bhorror\b/i],
    ['survival', /\bsurvival\b/i],
    ['tactical-shooter', /\btactical[ -]?shooter\b/i],
    ['shooter', /\bshooter\b/i],
    ['moba', /\bmoba\b|multiplayer online battle arena/i],
    ['rpg', /\brpg\b|role[ -]?playing/i],
    ['simulation', /\bsimulation\b|\bsim\b/i],
    ['strategy', /\bstrategy\b/i],
    ['racing', /\bracing\b/i],
    ['puzzle', /\bpuzzle\b/i],
    ['platformer', /\bplatform(?:er|ing)\b/i],
    ['fighting', /\bfighting\b/i],
    ['sandbox', /\bsandbox\b/i],
    ['roguelike', /\brogue[ -]?like\b/i],
    ['soulslike', /\bsouls[ -]?like\b/i],
    ['battle-royale', /\bbattle royale\b/i],
    ['sports', /\bsports?\b/i],
  ]

  signals.forEach(([token, pattern]) => {
    if (pattern.test(genreText)) tokens.add(token)
  })

  const distinctiveLabels = new Set(
    labels
      .map((label) => label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim())
      .filter((label) => label && !['action', 'adventure', 'action adventure', 'indie'].includes(label)),
  )

  return {
    label: labels.join(' / ') || 'Genre match',
    labels: distinctiveLabels,
    tokens,
  }
}

function genreLabelFromCollectionItem(item: CollectionItem) {
  if (item.genre) return item.genre

  const subtitleGenre = item.subtitle.split(/[·-]/)[0]?.trim() || ''
  const cleanedSubtitleGenre = subtitleGenre.replace(/[^\w\s]/g, '').trim()
  if (/^(album|ep|single|deluxe album)$/i.test(cleanedSubtitleGenre)) return ''

  return subtitleGenre
}

function getLatestAlbumGenreProfile(
  artist: UniversalMediaEntity | undefined,
  discography?: CollectionItem[] | null,
) {
  const albumItems = (discography || artist?.secondaryCollection?.items || [])
    .filter((item) => item.category ? item.category === 'album' : !/ep|single/i.test(item.subtitle || ''))
    .sort((a, b) => Number(b.year || 0) - Number(a.year || 0))
    .slice(0, 2)

  const genreLabels = albumItems
    .map(genreLabelFromCollectionItem)
    .filter(Boolean)

  const fallbackGenre = primaryArtistGenre(artist, artist?.relatedEntities?.items?.[0]?.subtitle)
  const textForTokens = genreLabels.length > 0 ? genreLabels.join(' / ') : fallbackGenre

  return {
    label: Array.from(new Set(genreLabels)).slice(0, 2).join(' / ') || fallbackGenre || 'Genre match',
    tokens: getGenreTokens(textForTokens || fallbackGenre),
  }
}

export const UniversalMediaProfilePage: React.FC<UniversalMediaProfilePageProps> = ({
  entity,
  onBack,
  onHome,
  communityEntries,
  onSelectEntry,
  onOpenUserProfile,
  onNavigateToEntity,
  onCanonicalHumanResolved,
  onQuickAddEntry,
  likedEntryIds = [],
  savedEntryIds = [],
  disabledCommentEntryIds = [],
  onToggleLike,
  onToggleSave,
}) => {
  const IconComponent = getMediaIcon(entity.type)
  const [liveAlbumVersionFamily, setLiveAlbumVersionFamily] = useState<AlbumVersionFamily | null>(null)

  const [showAllTopContent, setShowAllTopContent] = useState(false)
  const [showAllCollection, setShowAllCollection] = useState(false)
  const [showAllAlbums, setShowAllAlbums] = useState(false)
  const [showAllEps, setShowAllEps] = useState(false)
  const [showAllSingles, setShowAllSingles] = useState(false)
  const [showAllLive, setShowAllLive] = useState(false)
  const [expandedFilmographyCategories, setExpandedFilmographyCategories] = useState<Record<string, boolean>>({})
  const [selectedLyricIndexes, setSelectedLyricIndexes] = useState<number[]>([])
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)

  useEffect(() => {
    setActiveTab('overview')
    setShowAllTopContent(false)
    setShowAllCollection(false)
    setShowAllAlbums(false)
    setShowAllEps(false)
    setShowAllSingles(false)
    setShowAllLive(false)
    setExpandedFilmographyCategories({})
    setSelectedLyricIndexes([])
    setIsDescriptionExpanded(false)
  }, [entity.id])

  // Live API Fetch for artwork, discography & tracklist details
  const isPortraitProfile = isPortraitEntity(entity.type)
  const imageCacheKey = getEntityImageCacheKey(entity)
  const cachedInitial =
    entityImageCacheMap.get(imageCacheKey) ||
    null
  const [apiCoverUrl, setApiCoverUrl] = useState<string | null>(cachedInitial)
  const [apiSummary, setApiSummary] = useState<string | null>(null)
  const [isLoadingApi, setIsLoadingApi] = useState(false)
  const [failedHeroArtworkUrl, setFailedHeroArtworkUrl] = useState<string | null>(null)

  const [liveCollectionItems, setLiveCollectionItems] = useState<CollectionItem[] | null>(null)
  const [liveTrackItems, setLiveTrackItems] = useState<TopContentItem[] | null>(null)
  const [liveScreenCredits, setLiveScreenCredits] = useState<HumanScreenCredit[] | null>(null)
  const [livePublishedWorks, setLivePublishedWorks] = useState<CollectionItem[] | null>(null)
  const [liveAlbumChips, setLiveAlbumChips] = useState<MetadataChip[] | null>(null)
  const [liveRelatedAlbums, setLiveRelatedAlbums] = useState<CollectionItem[] | null>(null)
  const [liveSongAppearances, setLiveSongAppearances] = useState<CollectionItem[] | null>(null)
  const [liveArtistDiscographies, setLiveArtistDiscographies] = useState<Record<string, CollectionItem[]>>({})
  const [liveSongLyrics, setLiveSongLyrics] = useState<string | null>(null)
  const [liveGameMetadata, setLiveGameMetadata] = useState<GameMetadata | null>(null)
  const [gameArtworkFallbackActive, setGameArtworkFallbackActive] = useState(false)
  const [liveRelatedArtists, setLiveRelatedArtists] = useState<ScoredRelatedEntityItem[] | null>(null)
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false)
  const warmAbortRef = useRef<AbortController | null>(null)

  const liveCapabilities = useMemo<HumanCapabilities>(() => {
    const base = entity.humanProfile?.capabilities
    const musicCatalogKnown = liveCollectionItems !== null || liveTrackItems !== null
    return {
      topSongs: musicCatalogKnown ? (liveTrackItems?.length || 0) > 0 : Boolean(base?.topSongs),
      discography: musicCatalogKnown ? (liveCollectionItems?.length || 0) > 0 : Boolean(base?.discography),
      filmography: Boolean(base?.filmography) || (liveScreenCredits?.length || 0) > 0,
      publishedWorks: Boolean(base?.publishedWorks) || (livePublishedWorks?.length || 0) > 0,
      directing: Boolean(base?.directing) || (liveScreenCredits?.some((credit) => credit.category === 'directing') || false),
      creating: Boolean(base?.creating),
    }
  }, [entity.humanProfile, liveCollectionItems, livePublishedWorks, liveScreenCredits, liveTrackItems])
  const isMusicianHumanProfile =
    entity.type === 'human' &&
    (entity.humanProfile?.context === 'artist' || liveCapabilities.topSongs || liveCapabilities.discography)
  const tabs = useMemo(() => {
    if (entity.type === 'human' && entity.humanProfile) {
      return getDynamicHumanTabs({
        context: entity.humanProfile.context,
        capabilities: liveCapabilities,
      })
    }
    return getEntityTabs(entity.type).filter((tab) =>
      tab.id !== 'versions' || Boolean(liveAlbumVersionFamily?.editions.length))
  }, [entity.type, entity.humanProfile, liveAlbumVersionFamily, liveCapabilities])
  const [activeTab, setActiveTab] = useState<string>(tabs[0]?.id || 'overview')

  useEffect(() => {
    let isMounted = true
    const albumController = new AbortController()
    setFailedHeroArtworkUrl(null)
    setLiveCollectionItems(null)
    setLiveTrackItems(null)
    setLiveScreenCredits(null)
    setLivePublishedWorks(null)
    setLiveAlbumChips(null)
    setLiveRelatedAlbums(null)
    setLiveAlbumVersionFamily(null)
    setLiveSongAppearances(null)
    setLiveArtistDiscographies({})
    setLiveSongLyrics(null)
    setLiveGameMetadata(null)
    setGameArtworkFallbackActive(false)
    setApiSummary(null)

    const cachedForEntity =
      entityImageCacheMap.get(imageCacheKey) ||
      null
    setApiCoverUrl(cachedForEntity)

    const gameMetadataSource = entity.gameMetadata?.metadataSource || ''
    const hasApiGameIdentity =
      entity.type === 'game' &&
      Boolean(entity.providerId) &&
      (entity.id.startsWith('igdb:game:') ||
        entity.id.startsWith('steam:game:') ||
        /igdb|steam/i.test(gameMetadataSource))

    if (hasApiGameIdentity && entity.providerId) {
      setIsLoadingApi(true)
      fetchGameDetails(entity.providerId, gameMetadataSource)
        .then((details) => {
          if (!isMounted) return
          if (!details) {
            if (/igdb/i.test(gameMetadataSource)) setGameArtworkFallbackActive(true)
            return
          }
          if (details.coverUrl) {
            const safeCoverUrl = resolveArtworkUrl(details.coverUrl, details.title, 'Game')
            entityImageCacheMap.set(imageCacheKey, safeCoverUrl)
            setApiCoverUrl(safeCoverUrl)
          }
          if (details.summary) setApiSummary(details.summary)
          if (details.gameMetadata) setLiveGameMetadata(details.gameMetadata)
        })
        .catch(() => {
          if (isMounted && /igdb/i.test(gameMetadataSource)) setGameArtworkFallbackActive(true)
        })
        .finally(() => {
          if (isMounted) setIsLoadingApi(false)
        })
    }

    if (entity.type === 'artist' || entity.type === 'human') {
      fetchItunesDiscography(entity.name)
        .then((items) => {
          if (!isMounted) return
          setLiveCollectionItems(items || [])
        })
        .catch(() => {})

      fetchItunesTopSongs(entity.name)
        .then((items) => {
          if (!isMounted) return
          setLiveTrackItems(items || [])
        })
        .catch(() => {})
    }

    if (entity.type === 'artist' || isMusicianHumanProfile) {

      // Fetch live similar artists via MusicBrainz/iTunes fallback
      const warmController = new AbortController()
      warmAbortRef.current = warmController
      const artistGenres = entity.metadataChips
        .filter((chip) => /^genres?$/i.test(chip.label))
        .flatMap((chip) => chip.value.split(/[,/|]+/))
        .map((genre) => genre.trim())
        .filter(Boolean)
      fetchSimilarArtistsByGenreAndLocation(entity.name, artistGenres, warmController.signal)
        .then((artists) => {
          if (!isMounted || warmController.signal.aborted) return
          if (artists && artists.length > 0) {
            const scored: ScoredRelatedEntityItem[] = artists.map((a, i) => ({
              id: a.id,
              title: a.name,
              subtitle: a.genres.join(' · ') || a.location || 'Artist',
              artworkUrl: '',
              type: 'artist' as const,
              sortScore: a.score || 100 - i,
            }))
            setLiveRelatedArtists(scored)
            // Staggered portrait pre-warm
            warmSimilarArtistPortraits(
              scored.map((s) => ({ id: s.id, name: s.title, type: 'artist' })),
              warmController.signal,
            )
          }
        })
        .catch(() => {})
    }

    if (entity.type === 'album') {
      const artistChip = entity?.metadataChips?.find((c) => c.label === 'Artist')?.value
      const releaseYearChip = entity.metadataChips.find((chip) => /year|release/i.test(chip.label))?.value
      fetchItunesAlbumDetails(
        entity.name,
        artistChip,
        albumController.signal,
        getExpectedTrackCount(entity),
        entity.providerId || entity.id,
        releaseYearChip,
      )
        .then((details) => {
          if (!isMounted) return
          if (details) {
            if (details.coverUrl) {
              const safeCoverUrl = resolveArtworkUrl(details.coverUrl, entity.name, entity.categoryLabel)
              entityImageCacheMap.set(imageCacheKey, safeCoverUrl)
              setApiCoverUrl(safeCoverUrl)
            }
            if (details.tracks && details.tracks.length > 0) {
              setLiveTrackItems(details.tracks)
            }
            setLiveAlbumChips([
              { label: 'Artist', value: details.artist || artistChip || 'Artist' },
              { label: 'Release Year', value: details.year || '2023' },
              { label: 'Genre', value: details.genre || 'Pop' },
              { label: 'Track Count', value: `${details.trackCount} Tracks` },
              ...(details.explicit ? [{ label: 'Explicit', value: 'Yes' }] : []),
            ])
            const albumArtist = details.artist || artistChip || ''
            if (albumArtist) {
              fetchWikipediaStudioAlbumNumber(entity.name, albumArtist, albumController.signal)
                .then((studioAlbumNumber) => {
                  if (!isMounted) return
                  const albumOrdinal = studioAlbumNumber ? ` ${ordinalize(studioAlbumNumber)}` : ''
                  const yearText = details.year ? `, released in ${details.year}` : ''
                  setApiSummary(`${entity.name} is the${albumOrdinal} studio album by ${albumArtist}${yearText}.`)
                })
                .catch(() => {
                  if (!isMounted) return
                  const yearText = details.year ? `, released in ${details.year}` : ''
                  setApiSummary(`${entity.name} is a studio album by ${albumArtist}${yearText}.`)
                })
            }
            const familyPromise = fetchItunesAlbumVersionFamily({
              albumName: details.title,
              artistName: details.artist || artistChip || '',
              year: details.year,
              collectionId: details.collectionId,
              trackCount: details.trackCount,
            }, albumController.signal).catch(() => null)

            familyPromise.then((family) => {
              if (!isMounted || albumController.signal.aborted) return
              setLiveAlbumVersionFamily(family)
            })

            fetchRelatedAlbums(
              details.title,
              details.artist || artistChip,
              details.genre,
              `album-${details.collectionId}`,
              albumController.signal,
              details.explicit,
              details.year,
            )
              .then((items) => {
                return familyPromise.then((family) => ({ items, family }))
              })
              .then(({ items, family }) => {
                if (!isMounted || albumController.signal.aborted) return
                const familyIds = new Set(family?.collectionIds || [])
                const filtered = items.filter((item) => {
                  const collectionId = item.id.match(/^album-(\d+)$/i)?.[1]
                  return !collectionId || !familyIds.has(collectionId)
                })
                setLiveRelatedAlbums(filtered.length > 0 ? filtered : null)
              })
              .catch(() => {})
          }
        })
        .catch(() => {})
    }

    if (entity.type === 'song') {
      const artistChip = entity?.metadataChips?.find((c) => c.label === 'Artist')?.value
      const albumChip = entity.metadataChips.find((chip) => chip.label.toLowerCase() === 'album')?.value ||
        entity.metadataChips.find((chip) => chip.label.toLowerCase() === 'detail')?.value
      const releaseYearChip = entity.metadataChips.find((chip) => /year|release/i.test(chip.label))?.value
      fetchItunesSongDetails(
        entity.name,
        artistChip,
        entity.providerId,
        albumController.signal,
        albumChip,
        releaseYearChip,
      )
        .then(async (details) => {
          if (!isMounted || albumController.signal.aborted) return
          if (details) {
            if (details.artworkUrl) {
              const safeArtworkUrl = resolveArtworkUrl(details.artworkUrl, entity.name, entity.categoryLabel)
              entityImageCacheMap.set(imageCacheKey, safeArtworkUrl)
              setApiCoverUrl(safeArtworkUrl)
            }
            if (details.lyrics) setLiveSongLyrics(details.lyrics)
            if (details.summary) setApiSummary(details.summary)
            const resolvedGenre = details.genre || primaryArtistGenre(entity) || 'Pop'
            setLiveAlbumChips([
              { label: 'Artist', value: details.artist || artistChip || 'Artist' },
              { label: 'Album', value: details.album || 'Single' },
              { label: 'Genre', value: resolvedGenre },
              { label: 'Duration', value: details.duration },
              { label: 'Track #', value: `#${details.trackNumber}` },
              { label: 'Release Year', value: details.year },
              ...(details.explicit ? [{ label: 'Explicit', value: 'Yes' }] : []),
            ])
          }

          const items = await fetchItunesSongAppearances(
            details?.name || entity.name,
            details?.artist || artistChip,
            entity.providerId,
            albumController.signal,
            details?.explicit ?? entity.explicit,
          )
          if (!isMounted || albumController.signal.aborted) return
          setLiveSongAppearances(items.length > 0 ? items : null)
        })
        .catch(() => {})
    }

    const existingCache =
      entityImageCacheMap.get(imageCacheKey) ||
      null

    if (existingCache) {
      setApiCoverUrl(resolveArtworkUrl(existingCache, entity.name, entity.categoryLabel))
    }

    if (isPortraitProfile) {
      if (!existingCache) setIsLoadingApi(true)
      const personType = (entity.type === 'human' ? 'artist' : entity.type) as WikipediaPersonType

      // For artist profiles, try Fanart.tv first (returns latest uploaded picture for BANDS ONLY).
      // Solo artists and missing band artwork fall back to Wikipedia.
      const portraitPromise = entity.type === 'artist'
        ? fetchArtistPortrait(entity.name, albumController.signal).then((fanartUrl) => fanartUrl || null).catch(() => null)
        : Promise.resolve<string | null>(null)

      Promise.all([
        portraitPromise,
        fetchWikipediaProfile(entity.name, personType, albumController.signal),
      ]).then(([bandFanartUrl, profile]) => {
        if (!isMounted) return
        const resolvedPortrait = bandFanartUrl || profile.portraitUrl || ''
        if (resolvedPortrait) {
          entityImageCacheMap.set(imageCacheKey, resolvedPortrait)
          setApiCoverUrl(resolvedPortrait)
        }

          if (profile.description) {
            setApiSummary(profile.description)
            const { occupationLabels } = verifiedProfessionsFromWikipedia(
              profile.description,
              personType as HumanProfileContext,
            )
            const bornMatch = profile.description.match(/\(born\s+([A-Za-z]+\s+\d{1,2},\s+\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})\)/i)
            const chips: MetadataChip[] = [
              { label: 'Profession', value: occupationLabels.join(', ') || entity.categoryLabel },
            ]
            if (bornMatch?.[1]) {
              chips.push({ label: 'Born', value: bornMatch[1] })
            }
            if (profile.pageUrl) {
              chips.push({ label: 'Source', value: 'Wikipedia' })
            }
            setLiveAlbumChips(chips)

            const hasFilmography = personType === 'actor' || personType === 'director' || occupationLabels.some(l => /actor|actress|director|filmmaker|screenwriter|producer/i.test(l))
            const hasPublishedWorks = personType === 'author' || occupationLabels.some(l => /author|writer|novelist|poet/i.test(l))
            const hasDirecting = personType === 'director' || occupationLabels.some(l => /director|filmmaker/i.test(l))
            const hasCreating = personType === 'creator' || occupationLabels.some(l => /creator|showrunner/i.test(l))

            if (onCanonicalHumanResolved && (profile.wikidataId || profile.pageId)) {
              onCanonicalHumanResolved(entity, {
                canonicalId: profile.wikidataId ? `human:${profile.wikidataId.toUpperCase()}` : `human:wikipedia:${profile.pageId}`,
                context: (personType as HumanProfileContext) || 'artist',
                professions: [personType as any],
                occupationLabels,
                providerIds: {
                  wikidataId: profile.wikidataId,
                  wikipediaPageId: profile.pageId,
                },
                capabilities: {
                  topSongs: true,
                  discography: true,
                  filmography: hasFilmography,
                  publishedWorks: hasPublishedWorks,
                  directing: hasDirecting,
                  creating: hasCreating,
                },
              })
            }

            fetchHumanScreenCredits(entity.name, profile.wikidataId, albumController.signal)
              .then((catalog) => {
                if (!isMounted || albumController.signal.aborted) return
                setLiveScreenCredits(catalog.credits)
              })
              .catch(() => {})

            fetchHumanPublishedBooks(entity.name, albumController.signal)
              .then((works) => {
                if (!isMounted || albumController.signal.aborted) return
                setLivePublishedWorks(works || [])
              })
              .catch(() => {})
          }
        })
        .catch(() => {})
        .finally(() => {
          if (isMounted) setIsLoadingApi(false)
        })
    }

    // Catalog items (books, movies, tv, games) call searchMetadata.
    // Albums, songs, and human/portrait profiles have dedicated resolvers above.
    if (entity.type !== 'album' && entity.type !== 'song' && !isPortraitProfile) {
      setIsLoadingApi(true)
      const metaType = mapToMetaType(entity.type)
      searchMetadata(metaType, entity.name)
        .then((results) => {
          if (!isMounted) return
          if (results && results.length > 0) {
            const match = entity.type === 'game'
              ? [...results]
                  .map((result) => ({ result, score: scoreGameTitleMatch(result.title, entity.name) }))
                  .sort((a, b) => b.score - a.score)
                  .find((item) => item.score > 1000)?.result || results[0]
              : results[0]

            if (match?.coverUrl) {
              const safeCoverUrl = resolveArtworkUrl(match.coverUrl, entity.name, entity.categoryLabel)
              entityImageCacheMap.set(imageCacheKey, safeCoverUrl)
              setApiCoverUrl(safeCoverUrl)
            }
            if (match?.summary) {
              setApiSummary(match.summary)
            }
            if (match?.gameMetadata) {
              setLiveGameMetadata(match.gameMetadata)
            }

            const newChips = buildChipsFromMetadataResult(match, entity.type)
            const acceptsCatalogChips = ['book', 'movie', 'tv', 'game'].includes(entity.type)
            if (acceptsCatalogChips && newChips.length > 0) {
              setLiveAlbumChips((prev) => prev || newChips)
            }
          }
        })
        .catch(() => {})
        .finally(() => {
          if (isMounted) setIsLoadingApi(false)
        })
    }

    return () => {
      isMounted = false
      albumController.abort()
      warmAbortRef.current?.abort()
    }
  }, [entity.id, entity.name, entity.type, imageCacheKey, isMusicianHumanProfile, isPortraitProfile])

  const fallbackArtwork = createArtworkPlaceholder(entity.name, entity.categoryLabel)
  const preferredArtworkUrl = entity.type === 'game'
    ? liveGameMetadata
      ? apiCoverUrl || entity.artworkUrl
      : entity.artworkUrl || apiCoverUrl
    : apiCoverUrl || entity.artworkUrl
  const displayArtwork = resolveArtworkUrl(preferredArtworkUrl, entity.name, entity.categoryLabel) || fallbackArtwork
  const heroArtworkSrc = failedHeroArtworkUrl === displayArtwork ? fallbackArtwork : displayArtwork
  const displayDescription = apiSummary || entity.description

  // Community Reviews Matching
  const matchingReviews = useMemo(() => {
    return communityEntries.filter((entry) => reviewMatchesEntity(entry, entity, liveAlbumChips || entity.metadataChips))
  }, [communityEntries, entity, liveAlbumChips])

  const topCommunityReviews = useMemo(() => {
    const scoreReview = (entry: CardEntry) => {
      const createdAt = new Date(entry.createdAt).getTime()
      const recencyScore = Number.isFinite(createdAt) ? createdAt / 100000000000 : 0
      const engagementScore =
        (likedEntryIds.includes(entry.id) ? 8 : 0) +
        (savedEntryIds.includes(entry.id) ? 5 : 0) +
        (disabledCommentEntryIds.includes(entry.id) ? 0 : 3)

      return entry.rating * 20 + engagementScore + recencyScore
    }

    return [...matchingReviews]
      .sort((a, b) => scoreReview(b) - scoreReview(a))
      .slice(0, 3)
  }, [disabledCommentEntryIds, likedEntryIds, matchingReviews, savedEntryIds])

  const mostQuotedSongs = useMemo(
    () => entity.type === 'artist'
      ? buildMostQuotedWorks(matchingReviews.filter((entry) => entry.type === 'song'))
      : [],
    [entity.type, matchingReviews],
  )

  const collectionItems = liveCollectionItems || entity.secondaryCollection?.items || []

  const livePerformancesGroup = useMemo(() => {
    return collectionItems.filter((i) => {
      const title = (i.title || '').toLowerCase()
      const sub = (i.subtitle || '').toLowerCase()
      const cat = i.category
      return cat === 'live' || title.includes('live') || sub.includes('live')
    })
  }, [collectionItems])

  const albumsGroup = useMemo(() => {
    return collectionItems.filter((i) => {
      const title = (i.title || '').toLowerCase()
      const sub = (i.subtitle || '').toLowerCase()
      const cat = i.category
      if (cat === 'live' || title.includes('live') || sub.includes('live')) return false

      if (cat) return cat === 'album'
      return !sub.includes('ep') && !sub.includes('single')
    })
  }, [collectionItems])

  const epsGroup = useMemo(() => {
    return collectionItems.filter((i) => {
      const title = (i.title || '').toLowerCase()
      const sub = (i.subtitle || '').toLowerCase()
      const cat = i.category
      if (cat === 'live' || title.includes('live') || sub.includes('live')) return false

      if (cat) return cat === 'ep'
      return sub.includes('ep')
    })
  }, [collectionItems])

  const singlesGroup = useMemo(() => {
    return collectionItems.filter((i) => {
      const title = (i.title || '').toLowerCase()
      const sub = (i.subtitle || '').toLowerCase()
      const cat = i.category
      if (cat === 'live' || title.includes('live') || sub.includes('live')) return false

      if (cat) return cat === 'single'
      return sub.includes('single')
    })
  }, [collectionItems])

  const screenCreditGroups = useMemo(() => {
    const order: HumanScreenCredit['category'][] = ['acting', 'directing', 'concert', 'documentary']
    const groups: Array<{ category: HumanScreenCredit['category']; credits: HumanScreenCredit[] }> = []
    for (const category of order) {
      const credits = (liveScreenCredits || []).filter((credit) => credit.category === category)
      if (credits.length > 0) groups.push({ category, credits })
    }
    return groups
  }, [liveScreenCredits])

  const songQuotes = useMemo(() => {
    if (entity.type !== 'song') return []
    const contributions = matchingReviews
      .filter((r) => r.favoritePassage || r.reflection)
      .map((r) => ({
        id: r.id,
        text: r.favoritePassage || `${r.reflection.slice(0, 150)}${r.reflection.length > 150 ? '…' : ''}`,
        contributorName: r.authorName,
        contributorHandle: r.authorHandle,
        createdAt: r.createdAt,
      }))

    const rankedLines = buildCommunityQuoteRanking(contributions, 1).allGroups
    if (rankedLines.length > 0) {
      return rankedLines.map((line) => ({
        id: line.id,
        text: line.text.replace(/^["“”]+|["“”]+$/g, '').trim(),
        entryCount: line.submissionCount,
      }))
    }

    return [
      {
        id: 'sq-1',
        text: "Cause baby, now we've got bad blood / You know it used to be mad love…",
        entryCount: 1,
      },
      {
        id: 'sq-2',
        text: "Say you'll remember me standing in a nice dress, staring at the sunset, babe…",
        entryCount: 1,
      },
    ]
  }, [entity.type, matchingReviews])

  const topItems = liveTrackItems || entity.primaryCollection?.items || []
  const lyricLines = useMemo(
    () =>
      (liveSongLyrics || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map(sentenceCaseLyricLine),
    [liveSongLyrics],
  )
  useEffect(() => {
    setSelectedLyricIndexes([])
  }, [liveSongLyrics])
  const selectedLyricsText = useMemo(
    () => selectedLyricIndexes.map((index) => lyricLines[index]).filter(Boolean).join('\n'),
    [lyricLines, selectedLyricIndexes],
  )
  const topContentEntityType: MediaEntityType | undefined =
    entity.type === 'artist' || entity.type === 'album' || entity.type === 'human'
      ? 'song'
      : entity.type === 'author'
        ? 'book'
        : entity.type === 'director'
          ? 'movie'
          : entity.type === 'movie' || entity.type === 'tv'
            ? 'actor'
            : entity.type === 'game_studio'
              ? 'game'
              : undefined
  const reviewItemsToDisplay = activeTab === 'overview' ? topCommunityReviews : matchingReviews
  const reviewGridRef = useRef<HTMLDivElement | null>(null)
  const reviewLayoutSignal = useMemo(
    () => `${activeTab}:${reviewItemsToDisplay.map((entry) => entry.id).join('|')}`,
    [activeTab, reviewItemsToDisplay],
  )
  const reviewMasonryLayout = useMasonryLayout(
    reviewGridRef,
    reviewItemsToDisplay.length,
    undefined,
    reviewLayoutSignal,
  )
  // Tracks whether we've done the first paint of the masonry layout.
  // While false, transform transitions are disabled so cards snap directly
  // into their computed positions rather than animating from a stacked state.
  const reviewLayoutReadyRef = useRef(false)
  const isFirstReviewLayout = !reviewLayoutReadyRef.current && !!reviewMasonryLayout
  if (isFirstReviewLayout) reviewLayoutReadyRef.current = true

  const relatedItemsToDisplay = useMemo<ScoredRelatedEntityItem[]>(() => {
    if (entity.type === 'game') {
      if (entity.relatedEntities?.items && entity.relatedEntities.items.length > 0) {
        return entity.relatedEntities.items
      }
      const currentGenreProfile = getGameGenreProfile(entity)

      const matches = Object.values(UNIVERSAL_MEDIA_ENTITIES)
        .filter((candidate) => candidate.type === 'game' && candidate.id !== entity.id)
        .map((candidate) => {
          const candidateGenreProfile = getGameGenreProfile(candidate)
          const sharedTokens = Array.from(candidateGenreProfile.tokens).filter((token) =>
            currentGenreProfile.tokens.has(token),
          ).length
          const sharedLabels = Array.from(candidateGenreProfile.labels).filter((label) =>
            currentGenreProfile.labels.has(label),
          ).length

          return {
            id: candidate.id,
            title: candidate.name,
            subtitle: candidateGenreProfile.label,
            artworkUrl: candidate.artworkUrl,
            type: candidate.type,
            preferWikipediaArtwork:
              Boolean(candidate.preferWikipediaArtwork) ||
              /steam/i.test(candidate.gameMetadata?.metadataSource || ''),
            sortScore:
              sharedLabels * 300 +
              sharedTokens * 100 +
              Math.min(candidate.communityRating.count, 10000) / 10000,
          }
        })
        .filter((item) => (item.sortScore || 0) >= 100)
        .sort((a, b) => (b.sortScore || 0) - (a.sortScore || 0))
        .slice(0, 4)

      return matches.length > 0 ? matches : (entity.relatedEntities?.items || [])
    }

    if (entity.type !== 'artist' && !isMusicianHumanProfile) {
      return entity.relatedEntities?.items || []
    }

    if (liveRelatedArtists && liveRelatedArtists.length > 0) {
      return liveRelatedArtists
    }

    const currentGenreProfile = getLatestAlbumGenreProfile(entity, collectionItems)
    const manualRelatedIds = new Set(entity.relatedEntities?.items?.map((item) => item.id) || [])
    const relatedCandidates = Object.values(UNIVERSAL_MEDIA_ENTITIES).filter(
      (candidate) => candidate.type === 'artist' && candidate.id !== entity.id,
    )

    return relatedCandidates
      .map((candidate, index) => {
        const candidateGenreProfile = getLatestAlbumGenreProfile(candidate, liveArtistDiscographies[candidate.id])
        const sharedGenreCount = Array.from(candidateGenreProfile.tokens).filter((token) =>
          currentGenreProfile.tokens.has(token),
        ).length
        const fallbackSameGenre =
          sharedGenreCount === 0 &&
          primaryArtistGenre(candidate, candidateGenreProfile.label) === primaryArtistGenre(entity, currentGenreProfile.label)

        const cachedCandidateUrl =
          entityImageCacheMap.get(`wiki-portrait:${candidate.name.toLowerCase()}`) ||
          entityImageCacheMap.get(`artist:${candidate.id}`) ||
          entityImageCacheMap.get(candidate.id) ||
          entityImageCacheMap.get(candidate.name)

        return {
          id: candidate.id,
          title: candidate.name,
          subtitle:
            sharedGenreCount > 0 || fallbackSameGenre
              ? `Similar: ${candidateGenreProfile.label}`
              : candidateGenreProfile.label,
          artworkUrl: cachedCandidateUrl || candidate.artworkUrl,
          type: candidate.type,
          sortScore:
            sharedGenreCount * 120 +
            (fallbackSameGenre ? 60 : 0) +
            (manualRelatedIds.has(candidate.id) ? 20 : 0) -
            index,
        }
      })
      .filter((item) => (item.sortScore || 0) > 0)
      .sort((a, b) => (b.sortScore || 0) - (a.sortScore || 0))
      .slice(0, 8)
  }, [activeTab, collectionItems, entity, isMusicianHumanProfile, liveArtistDiscographies, liveRelatedArtists])

  const visibleTopItems = useMemo(() => {
    if (entity.type === 'album') {
      if (activeTab === 'overview') return topItems.slice(0, 5)
      if (activeTab === 'top_content') return topItems
    }
    return showAllTopContent ? topItems : topItems.slice(0, 5)
  }, [entity.type, activeTab, topItems, showAllTopContent])

  const allCurrentChips = liveAlbumChips || entity.metadataChips || []
  const trackNumberChip = entity.type === 'song'
    ? allCurrentChips.find((c) => /track.?#|track.?number/i.test(c.label))
    : undefined

  const ratingAnalytics = useMemo(() => {
    if (matchingReviews.length > 0) {
      const total = matchingReviews.length
      const counts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
      let sum = 0
      matchingReviews.forEach((r) => {
        const rounded = Math.min(5, Math.max(1, Math.round(r.rating)))
        counts[rounded] = (counts[rounded] || 0) + 1
        sum += r.rating
      })
      const average = sum / total
      const distribution: Record<number, number> = {}
      for (let s = 5; s >= 1; s--) {
        distribution[s] = Math.round(((counts[s] || 0) / total) * 100)
      }
      return { average, count: total, distribution, counts }
    }

    const avg = entity.communityRating?.average || 4.7
    const count = entity.communityRating?.count || 0
    const defaultDist: Record<number, number> = entity.communityRating?.distribution || {
      5: 78,
      4: 16,
      3: 4,
      2: 1,
      1: 1,
    }
    return { average: avg, count, distribution: defaultDist, counts: undefined }
  }, [entity.communityRating, matchingReviews])
  const curatedStats = useMemo(() => {
    const findVal = (pattern: RegExp) => allCurrentChips.find((c) => pattern.test(c.label))?.value

    let box2Label = 'Genre'
    let box2Value = findVal(/^genres?$/i)
    let Box2Icon = Disc3

    let box3Label = 'Details'
    let box3Value: string | undefined = undefined
    let box3Sub: string | undefined = undefined
    let Box3Icon = Sparkles

    if (entity.type === 'artist') {
      box2Label = 'Genre'
      box2Value = box2Value || primaryArtistGenre(entity) || 'Pop'
      Box2Icon = Disc3

      const listenerData = getArtistMonthlyListeners(
        entity.name,
        ratingAnalytics.count,
        collectionItems.length,
      )
      box3Label = 'Monthly Listeners'
      box3Value = listenerData.value
      box3Sub = listenerData.sub
      Box3Icon = Users
    } else if (entity.type === 'album') {
      box2Label = 'Genre'
      box2Value = box2Value || primaryArtistGenre(entity) || 'Pop'
      Box2Icon = Disc3

      box3Label = 'Tracks'
      box3Value = findVal(/track.*count/i) || (liveTrackItems?.length ? `${liveTrackItems.length} Tracks` : 'Album')
      box3Sub = findVal(/release.*year/i) ? `Released ${findVal(/release.*year/i)}` : 'Studio Album'
      Box3Icon = Layers
    } else if (entity.type === 'song') {
      box2Label = 'Genre'
      box2Value = box2Value || primaryArtistGenre(entity) || 'Pop'
      Box2Icon = Music4

      box3Label = 'Duration'
      box3Value = findVal(/duration/i) || '—'
      box3Sub = 'Track length'
      Box3Icon = Clock
    } else if (entity.type === 'game') {
      box2Label = 'Genre'
      box2Value = box2Value || liveGameMetadata?.genres?.[0] || 'Game'
      Box2Icon = Gamepad2

      box3Label = 'Developer'
      box3Value = liveGameMetadata?.developers?.[0] || findVal(/developer/i) || 'Studio'
      box3Sub = findVal(/release/i) ? `Released ${findVal(/release/i)}` : 'Video Game'
      Box3Icon = Gamepad2
    } else if (entity.type === 'game_studio') {
      box2Label = 'Industry'
      box2Value = 'Game Development'
      Box2Icon = Gamepad2

      box3Label = 'Published Games'
      box3Value = collectionItems.length > 0 ? `${collectionItems.length} Titles` : 'Game Studio'
      box3Sub = 'Development Studio'
      Box3Icon = Layers
    } else if (entity.type === 'movie' || entity.type === 'tv') {
      box2Label = 'Genre'
      box2Value = box2Value || (entity.type === 'tv' ? 'TV Series' : 'Film')
      Box2Icon = entity.type === 'tv' ? Tv : Clapperboard

      box3Label = entity.type === 'tv' ? 'Seasons' : 'Director'
      box3Value = findVal(/seasons?|episodes?/i) || findVal(/director/i) || findVal(/year|release/i) || (entity.type === 'tv' ? 'Series' : 'Cinema')
      box3Sub = entity.type === 'tv' ? 'Television Show' : 'Feature Film'
      Box3Icon = entity.type === 'tv' ? Tv : Clapperboard
    } else if (entity.type === 'book') {
      box2Label = 'Genre'
      box2Value = box2Value || 'Literature'
      Box2Icon = BookOpen

      box3Label = 'Author / Release'
      box3Value = findVal(/author/i) || findVal(/year|published/i) || 'Book'
      box3Sub = 'Published Work'
      Box3Icon = BookOpen
    } else if (entity.type === 'author') {
      box2Label = 'Profession'
      box2Value = 'Author'
      Box2Icon = BookOpen

      const bookCount = livePublishedWorks?.length ?? 0
      box3Label = 'Published Works'
      box3Value = bookCount > 0 ? `${bookCount} Books` : collectionItems.length > 0 ? `${collectionItems.length} Books` : 'Published Works'
      box3Sub = 'Literary Catalog'
      Box3Icon = Layers
    } else if (entity.type === 'actor' || entity.type === 'director' || entity.type === 'creator' || entity.type === 'human') {
      if (isMusicianHumanProfile) {
        box2Label = 'Genre'
        box2Value = findVal(/^genres?$/i) || primaryArtistGenre(entity) || 'Pop'
        Box2Icon = Disc3

        const listenerData = getArtistMonthlyListeners(
          entity.name,
          ratingAnalytics.count,
          collectionItems.length,
        )
        box3Label = 'Monthly Listeners'
        box3Value = listenerData.value
        box3Sub = listenerData.sub
        Box3Icon = Users
      } else {
        box2Label = 'Profession'
        box2Value = findVal(/profession/i) || entity.categoryLabel
        Box2Icon = User

        const creditCount = liveScreenCredits?.length ?? 0
        box3Label = creditCount > 0 ? 'Filmography' : 'Discography'
        box3Value = creditCount > 0
          ? `${creditCount} Credits`
          : collectionItems.length > 0
            ? `${collectionItems.length} Releases`
            : entity.type === 'human'
              ? 'Music Catalog'
              : 'Filmography'
        box3Sub = creditCount > 0 ? 'Industry Credits' : 'Music Catalog'
        Box3Icon = creditCount > 0 ? Clapperboard : Disc3
      }
    } else {
      box2Label = 'Category'
      box2Value = entity.categoryLabel
      Box2Icon = Sparkles

      box3Label = 'Year'
      box3Value = findVal(/year|release/i) || '—'
      box3Sub = entity.categoryLabel
      Box3Icon = Sparkles
    }

    return {
      box2: { label: box2Label, value: box2Value || '—', Icon: Box2Icon },
      box3: { label: box3Label, value: box3Value || '—', sub: box3Sub, Icon: Box3Icon },
    }
  }, [allCurrentChips, collectionItems, entity, isMusicianHumanProfile, liveGameMetadata, livePublishedWorks, liveScreenCredits, liveTrackItems, ratingAnalytics.count])

  const chipsToDisplay = useMemo(() => {
    const base = allCurrentChips.filter((chip) => {
      const label = chip.label.toLowerCase()
      if (
        label === 'source' ||
        label === 'monthly listeners' ||
        label === 'albums released' ||
        label === 'explicit'
      ) return false
      if (entity.type === 'song' && (
        label === 'duration' || label === 'track #' || label === 'track number' || label === 'genre'
      )) return false
      return true
    })

    if (isPortraitProfile && !base.some((c) => /years active|active/i.test(c.label))) {
      const years = extractYearsActive(
        displayDescription,
        collectionItems.map((i) => i.year || '').filter(Boolean),
      )
      if (years) {
        base.push({ label: 'Years Active', value: years })
      }
    }
    return base
  }, [allCurrentChips, collectionItems, displayDescription, entity.type, isPortraitProfile])
  const explicitFromProfile = Boolean(entity.explicit) ||
    Boolean((liveAlbumChips || entity.metadataChips).some((chip) =>
      chip.label.toLowerCase() === 'explicit' && chip.value.toLowerCase() === 'yes',
    ))
  const isExplicitProfile =
    (entity.type === 'album' || entity.type === 'song') &&
    (entity.type === 'album' && liveAlbumVersionFamily
      ? liveAlbumVersionFamily.currentExplicit
      : explicitFromProfile)

  const gameMetadata = useMemo(
    () => normalizeGameMetadata(
      liveGameMetadata
        ? { ...entity, gameMetadata: { ...entity.gameMetadata, ...liveGameMetadata } }
        : entity,
    ),
    [entity, liveGameMetadata],
  )

  const renderCommunityReviewCard = (entry: CardEntry) => (
    <CommunityReviewCard
      entry={entry}
      isLiked={likedEntryIds.includes(entry.id)}
      isSaved={savedEntryIds.includes(entry.id)}
      commentsDisabled={disabledCommentEntryIds.includes(entry.id)}
      showReviewedSubject={entity.type === 'artist'}
      onOpen={() => onSelectEntry?.(entry)}
      onOpenProfile={() => onOpenUserProfile?.(entry.authorHandle || 'jimboii')}
      onToggleLike={() => onToggleLike?.(entry.id)}
      onToggleSave={() => onToggleSave?.(entry.id)}
    />
  )
  const shouldShowRelatedSection =
    activeTab === 'related' &&
    (entity.type === 'artist' || isMusicianHumanProfile || entity.type === 'game' || (entity.type !== 'album' && relatedItemsToDisplay.length > 0))

  const toggleLyricLine = (index: number) => {
    setSelectedLyricIndexes((current) =>
      current.includes(index)
        ? current.filter((item) => item !== index)
        : [...current, index].sort((a, b) => a - b),
    )
  }

  return (
    <motion.div
      className="universal-media-profile-page"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* ── Top Navigation Bar ── */}
      <div className="media-profile-topbar">
        <button
          type="button"
          className="profile-back-btn"
          onClick={onBack}
          aria-label="Back to previous page"
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>

        <div className="media-profile-topbar-actions">
          {onHome && (
            <button
              type="button"
              className="profile-home-btn"
              onClick={onHome}
              aria-label="Go home"
              title="Home"
            >
              <Home size={15} />
              <span>Home</span>
            </button>
          )}
          <span className="media-profile-type-badge">
            <IconComponent size={14} />
            <span>{entity.categoryLabel}</span>
          </span>
        </div>
      </div>

      <div className="editorial-divider" />

      {/* ── Two-Column Editorial Hero (No Cover Photo) ── */}
      <section className="media-hero-section">
        {/* Left Column: Artwork / Photo */}
        <div className="media-hero-left">
          <div className={`media-artwork-container ${entity.type === 'album' || entity.type === 'song' ? 'is-square-artwork' : ''}`}>
            {entity.type === 'game' ? (
              <AdaptiveGameArtwork
                src={heroArtworkSrc}
                title={entity.name}
                preferWikipedia={
                  gameArtworkFallbackActive ||
                  Boolean(entity.preferWikipediaArtwork) ||
                  /steam/i.test(gameMetadata.metadataSource || '')
                }
                alt={entity.name}
                className="media-artwork-img"
                referrerPolicy="no-referrer"
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
            ) : (
              <img
                src={heroArtworkSrc}
                srcSet={buildSrcSet(heroArtworkSrc)}
                sizes={getImageSizes('hero')}
                alt={entity.name}
                className="media-artwork-img"
                referrerPolicy="no-referrer"
                loading="eager"
                fetchPriority="high"
                decoding="async"
                onError={() => setFailedHeroArtworkUrl(displayArtwork)}
              />
            )}
            {isLoadingApi && (
              <div className="media-artwork-loader">
                <Loader2 size={20} className="spin-icon" />
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Textual Information & Rating */}
        <div className="media-hero-right">
          <div className="media-hero-meta-header">
            <span className="media-category-pill">{entity.categoryLabel}</span>
            <div className="media-title-row">
              <h1 className="media-hero-title">{entity.name}</h1>
              {isExplicitProfile && <span className="explicit-badge" aria-label="Explicit">E</span>}
              {trackNumberChip && (
                <span className="song-track-number-badge">
                  {trackNumberChip.value.startsWith('#') ? trackNumberChip.value : `#${trackNumberChip.value}`}
                </span>
              )}
            </div>
          </div>

          <p className={`media-hero-description media-biography-copy ${isDescriptionExpanded ? 'is-expanded' : ''}`}>
            {displayDescription.length > 200 ? (
              isDescriptionExpanded ? (
                <>
                  <span>{displayDescription}</span>
                  {isPortraitProfile && <span className="media-biography-source">{"—\u00A0Wikipedia"}</span>}
                  <button
                    type="button"
                    className="media-bio-toggle"
                    onClick={() => setIsDescriptionExpanded(false)}
                  >
                    Show less
                  </button>
                </>
              ) : (
                <>
                  <span>{`${displayDescription.slice(0, 200).trim()}…`}</span>
                  <button
                    type="button"
                    className="media-bio-toggle"
                    onClick={() => setIsDescriptionExpanded(true)}
                  >
                    Show more
                  </button>
                </>
              )
            ) : (
              <>
                <span>{displayDescription}</span>
                {isPortraitProfile && <span className="media-biography-source">{"—\u00A0Wikipedia"}</span>}
              </>
            )}
          </p>

          {/* Context-aware Metadata Chips */}
          <div className={`media-chips-row${entity.type === 'song' ? ' is-single-line' : ''}`}>
            {chipsToDisplay.map((chip, idx) => (
              <div key={idx} className="media-metadata-chip">
                <span className="chip-label">{chip.label}:</span>
                <span className="chip-value">{chip.value}</span>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── Dynamic Generated Navigation Tabs ── */}
      <div className="media-tabs-wrapper">
        <div className="media-tabs-row">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`media-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.label}</span>
              {tab.id === 'reviews' && (
                <span className="media-tab-badge">{matchingReviews.length}</span>
              )}
              {activeTab === tab.id && (
                <motion.span
                  className="media-tab-underline"
                  layoutId="media-tab-underline"
                  transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {entity.type === 'game' && activeTab === 'overview' && (
        <GameAvailableOnPreview
          metadata={gameMetadata}
          onViewAll={() => setActiveTab('platforms_releases')}
        />
      )}

      {entity.type === 'game' && activeTab === 'game_info' && (
        <GameInfoTab metadata={gameMetadata} />
      )}

      {entity.type === 'game' && activeTab === 'platforms_releases' && (
        <PlatformsReleasesTab metadata={gameMetadata} />
      )}

      {/* ── Tab Content Sections ── */}

      {/* Song Lyrics Section (For Song Profiles) */}
      {entity.type === 'song' && activeTab === 'lyrics' && (
        <section className="media-section song-lyrics-section">
          <div className="media-section-header">
            <div className="media-section-title-group">
              <Music4 size={16} className="title-icon" />
              <h2>Lyrics</h2>
            </div>
            {selectedLyricsText && (
              <button
                type="button"
                className="lyrics-quick-add-btn"
                onClick={() => {
                  onQuickAddEntry?.({
                    entity,
                    favoritePassage: selectedLyricsText,
                    lyrics: liveSongLyrics || selectedLyricsText,
                    artworkUrl: displayArtwork,
                    metadataChips: liveAlbumChips || entity.metadataChips,
                  })
                }}
              >
                <Plus size={14} aria-hidden="true" />
                <span>Add Entry</span>
              </button>
            )}
          </div>
          <div className="lyrics-card">
            {lyricLines.length > 0 ? (
              <div className="lyrics-select-list" aria-label={`Lyrics for ${entity.name}`}>
                {lyricLines.map((line, index) => {
                  const isSelected = selectedLyricIndexes.includes(index)
                  return (
                    <button
                      key={`${line}-${index}`}
                      type="button"
                      className={`lyrics-select-line ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleLyricLine(index)}
                      aria-pressed={isSelected}
                    >
                      <span>{line}</span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="lyrics-empty">Official lyrics for {entity.name} are archived in community reflections.</p>
            )}
          </div>
        </section>
      )}

      {/* Overview Stat Grid — Rating / Curated Metadata (Overview tab for ALL profile types) */}
      {activeTab === 'overview' && (
        <section className="song-stat-grid-section">
          <div
            className="song-stat-box is-clickable"
            onClick={() => setIsRatingModalOpen(true)}
            role="button"
            tabIndex={0}
            title="Click to view rating breakdown and distribution analytics"
          >
            <div className="song-stat-icon-wrap"><Star size={20} /></div>
            <div className="song-stat-content">
              <span className="song-stat-label">Rating</span>
              <span className="song-stat-value">
                {ratingAnalytics.average > 0
                  ? `${ratingAnalytics.average.toFixed(1)} / 5`
                  : '— / 5'}
              </span>
              <span className="song-stat-sub">
                {ratingAnalytics.count} rating{ratingAnalytics.count !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          <div className="song-stat-box">
            <div className="song-stat-icon-wrap">
              <curatedStats.box2.Icon size={20} />
            </div>
            <div className="song-stat-content">
              <span className="song-stat-label">{curatedStats.box2.label}</span>
              <span className="song-stat-value">{curatedStats.box2.value}</span>
            </div>
          </div>

          <div className="song-stat-box">
            <div className="song-stat-icon-wrap">
              <curatedStats.box3.Icon size={20} />
            </div>
            <div className="song-stat-content">
              <span className="song-stat-label">{curatedStats.box3.label}</span>
              <span className="song-stat-value">{curatedStats.box3.value}</span>
              {curatedStats.box3.sub && (
                <span className="song-stat-sub">{curatedStats.box3.sub}</span>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Lines That Stuck (For Songs Only) */}
      {entity.type === 'song' && (activeTab === 'overview' || activeTab === 'top_content') && (
        <section className="media-section song-quotes-section">
          <div className="media-section-header">
            <div className="media-section-title-group">
              <Quote size={16} className="title-icon" />
              <h2>Lines That Stuck ({songQuotes.length})</h2>
            </div>
          </div>
          <div className="song-quotes-grid">
            {songQuotes.map((q) => (
              <article key={q.id} className="song-quote-card">
                <span className="song-quote-mark" aria-hidden="true">“</span>
                <blockquote className="song-quote-text">“{q.text}”</blockquote>
                <footer className="song-quote-meta">
                  <Users size={16} aria-hidden="true" />
                  <span>Quoted in {q.entryCount} {q.entryCount === 1 ? 'entry' : 'entries'}</span>
                </footer>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Community-ranked songs replace catalog popularity for artist profiles. */}
      {entity.type === 'artist' && activeTab === 'overview' && (
        <section className="media-section most-quoted-songs-section">
          <div className="media-section-header">
            <div className="media-section-title-group">
              <Quote size={16} className="title-icon" />
              <h2>Most Quoted Songs ({mostQuotedSongs.length})</h2>
            </div>
          </div>

          {mostQuotedSongs.length > 0 ? (
            <div className="most-quoted-works-grid">
              {mostQuotedSongs.slice(0, 4).map((item, index) => (
                <MostQuotedSongCard
                  key={item.id}
                  item={item}
                  rank={index + 1}
                  onNavigate={onNavigateToEntity}
                />
              ))}
            </div>
          ) : (
            <div className="community-quotes-empty">
              <p>No song passages have been quoted for {entity.name} yet.</p>
            </div>
          )}
        </section>
      )}

      {/* 1. Primary Top Content Section (tracklists, books, cast, and other catalog lists). */}
      {entity.type !== 'song' && entity.type !== 'game' &&
        (activeTab === 'overview' || activeTab === 'top_content') &&
        (entity.type !== 'artist' || activeTab === 'top_content') &&
        topItems.length > 0 && (
        <section className="media-section top-content-section">
          <div className="media-section-header">
            <div className="media-section-title-group">
              <Sparkles size={16} className="title-icon" />
              <h2>
                {entity.type === 'album'
                  ? activeTab === 'overview'
                    ? 'Top Tracks'
                    : `Full Tracklist (${topItems.length} Tracks)`
                  : entity.type === 'human'
                    ? activeTab === 'overview' ? 'Top Songs' : `Top Songs (${topItems.length})`
                    : entity.primaryCollection?.title || 'Top Items'}
              </h2>
            </div>
            {entity.type === 'album' && activeTab === 'overview' && topItems.length > 5 ? (
              <button
                type="button"
                className="media-view-all-btn"
                onClick={() => setActiveTab('top_content')}
              >
                <span>View Full Tracklist ({topItems.length}) →</span>
              </button>
            ) : entity.type !== 'album' && topItems.length > 5 ? (
              <button
                type="button"
                className="media-view-all-btn"
                onClick={() => setShowAllTopContent((v) => !v)}
              >
                <span>{showAllTopContent ? 'Show Top 5' : 'View All →'}</span>
              </button>
            ) : null}
          </div>

          <div className="top-content-list">
            {visibleTopItems.map((item) => {
              const effectiveArtistName =
                entity.type === 'artist' || entity.type === 'human'
                  ? entity.name
                  : entity.metadataChips?.find((c) => /artist/i.test(c.label))?.value || ''
              return (
                <TrackRow
                  key={item.id}
                  item={item}
                  artistName={effectiveArtistName}
                  parentArtworkUrl={entity.type === 'album' ? displayArtwork : entity.artworkUrl}
                  onNavigateToEntity={onNavigateToEntity}
                  entityType={topContentEntityType}
                  useParentArtwork={entity.type === 'album'}
                />
              )
            })}
          </div>
        </section>
      )}

      {/* 2. Grouped Discography Sections for Artists (Albums, EPs, Singles) */}
      {(activeTab === 'collection' || activeTab === 'discography') && (entity.type === 'artist' || entity.type === 'human') && (
        <>
          {albumsGroup.length > 0 && (
            <section className="media-section collection-section">
              <div className="media-section-header">
                <div className="media-section-title-group">
                  <Layers size={16} className="title-icon" />
                  <h2>Studio Albums ({albumsGroup.length})</h2>
                </div>
                {albumsGroup.length > 10 && (
                  <button
                    type="button"
                    className="media-view-all-btn"
                    onClick={() => setShowAllAlbums((v) => !v)}
                  >
                    <span>{showAllAlbums ? 'Show Less' : 'Show More →'}</span>
                  </button>
                )}
              </div>
              <div className="related-album-tile-grid">
                {(showAllAlbums ? albumsGroup : albumsGroup.slice(0, 10)).map((item) => (
                  <RelatedAlbumTile key={item.id} item={item} onNavigate={onNavigateToEntity} />
                ))}
              </div>
            </section>
          )}

          {(activeTab === 'collection' || activeTab === 'discography') && epsGroup.length > 0 && (
            <section className="media-section collection-section">
              <div className="media-section-header">
                <div className="media-section-title-group">
                  <Layers size={16} className="title-icon" />
                  <h2>EPs ({epsGroup.length})</h2>
                </div>
                {epsGroup.length > 10 && (
                  <button
                    type="button"
                    className="media-view-all-btn"
                    onClick={() => setShowAllEps((v) => !v)}
                  >
                    <span>{showAllEps ? 'Show Less' : 'Show More →'}</span>
                  </button>
                )}
              </div>
              <div className="related-album-tile-grid">
                {(showAllEps ? epsGroup : epsGroup.slice(0, 10)).map((item) => (
                  <RelatedAlbumTile key={item.id} item={item} onNavigate={onNavigateToEntity} />
                ))}
              </div>
            </section>
          )}

          {(activeTab === 'collection' || activeTab === 'discography') && livePerformancesGroup.length > 0 && (
            <section className="media-section collection-section">
              <div className="media-section-header">
                <div className="media-section-title-group">
                  <Layers size={16} className="title-icon" />
                  <h2>Live Performances ({livePerformancesGroup.length})</h2>
                </div>
                {livePerformancesGroup.length > 10 && (
                  <button
                    type="button"
                    className="media-view-all-btn"
                    onClick={() => setShowAllLive((v) => !v)}
                  >
                    <span>{showAllLive ? 'Show Less' : 'Show More →'}</span>
                  </button>
                )}
              </div>
              <div className="related-album-tile-grid">
                {(showAllLive ? livePerformancesGroup : livePerformancesGroup.slice(0, 10)).map((item) => (
                  <RelatedAlbumTile key={item.id} item={item} onNavigate={onNavigateToEntity} />
                ))}
              </div>
            </section>
          )}

          {(activeTab === 'collection' || activeTab === 'discography') && singlesGroup.length > 0 && (
            <section className="media-section collection-section">
              <div className="media-section-header">
                <div className="media-section-title-group">
                  <Layers size={16} className="title-icon" />
                  <h2>Singles ({singlesGroup.length})</h2>
                </div>
                {singlesGroup.length > 10 && (
                  <button
                    type="button"
                    className="media-view-all-btn"
                    onClick={() => setShowAllSingles((v) => !v)}
                  >
                    <span>{showAllSingles ? 'Show Less' : 'Show More →'}</span>
                  </button>
                )}
              </div>
              <div className="related-album-tile-grid">
                {(showAllSingles ? singlesGroup : singlesGroup.slice(0, 10)).map((item) => (
                  <RelatedAlbumTile key={item.id} item={item} onNavigate={onNavigateToEntity} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* 2b. Filmography for Human Profiles (live TMDB screen credits) */}
      {liveScreenCredits && liveScreenCredits.length > 0 && (
        entity.type === 'human'
          ? activeTab === 'filmography'
          : activeTab === 'collection' && ['actor', 'director', 'creator'].includes(entity.type)
      ) && (
        <section className="media-section filmography-section">
          <div className="media-section-header">
            <div className="media-section-title-group">
              <Clapperboard size={16} className="title-icon" />
              <h2>Filmography ({liveScreenCredits.length})</h2>
            </div>
          </div>

          {screenCreditGroups.map((group) => {
            const isExpanded = Boolean(expandedFilmographyCategories[group.category])
            const itemsToDisplay = isExpanded ? group.credits : group.credits.slice(0, 10)

            return (
              <div key={group.category} className="filmography-group">
                <div className="filmography-group-header">
                  <h3 className="filmography-group-title">
                    {humanCreditCategoryLabel(group.category)} ({group.credits.length})
                  </h3>
                  {group.credits.length > 10 && (
                    <button
                      type="button"
                      className="media-view-all-btn"
                      onClick={() =>
                        setExpandedFilmographyCategories((prev) => ({
                          ...prev,
                          [group.category]: !prev[group.category],
                        }))
                      }
                    >
                      <span>{isExpanded ? 'Show Less' : 'Show More →'}</span>
                    </button>
                  )}
                </div>
                <div className="filmography-tile-grid">
                  {itemsToDisplay.map((credit) => (
                    <FilmographyTile
                      key={credit.id}
                      credit={credit}
                      personName={entity.name}
                      onNavigate={onNavigateToEntity}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </section>
      )}

      {/* 2c. Published Works for Human & Author Profiles (books authored by the person) */}
      {livePublishedWorks && livePublishedWorks.length > 0 && (
        entity.type === 'human'
          ? activeTab === 'published_works'
          : activeTab === 'collection' && entity.type === 'author'
      ) && (
        <section className="media-section collection-section">
          <div className="media-section-header">
            <div className="media-section-title-group">
              <BookOpen size={16} className="title-icon" />
              <h2>Published Works ({livePublishedWorks.length})</h2>
            </div>
            {livePublishedWorks.length > 10 && (
              <button
                type="button"
                className="media-view-all-btn"
                onClick={() => setShowAllCollection((v) => !v)}
              >
                <span>{showAllCollection ? 'Show Less' : 'Show More →'}</span>
              </button>
            )}
          </div>

          <div className="related-album-tile-grid">
            {(showAllCollection ? livePublishedWorks : livePublishedWorks.slice(0, 10)).map((item) => (
              <RelatedAlbumTile key={item.id} item={item} onNavigate={onNavigateToEntity} />
            ))}
          </div>
        </section>
      )}

      {/* 3. Generic Secondary Collection Section for non-artists */}
      {(activeTab === 'collection' || activeTab === 'filmography' || activeTab === 'published_works') && entity.type !== 'artist' && entity.type !== 'human' && entity.secondaryCollection && (
        <section className="media-section collection-section">
          <div className="media-section-header">
            <div className="media-section-title-group">
              <Layers size={16} className="title-icon" />
              <h2>{entity.secondaryCollection.title}</h2>
            </div>
          </div>

          <div className="collection-grid">
            {collectionItems.slice(0, showAllCollection ? undefined : 3).map((item) => (
              <div
                key={item.id}
                className="collection-card"
                onClick={() => onNavigateToEntity?.(item.id, topContentEntityType)}
                style={{ cursor: 'pointer' }}
                role="button"
                tabIndex={0}
              >
                <div className="collection-thumb-wrapper">
                  <CollectionItemThumb title={item.title} defaultUrl={item.artworkUrl} />
                </div>
                <div className="collection-info">
                  <span className="collection-title">
                    <span>{item.title}</span>
                    {item.explicit && <span className="explicit-badge explicit-badge--inline" aria-label="Explicit">E</span>}
                  </span>
                  <span className="collection-subtitle">{item.subtitle}</span>
                </div>
                {item.rating && (
                  <span className="collection-rating-badge">
                    <Star size={11} fill="currentColor" />
                    <span>{item.rating.toFixed(1)}</span>
                  </span>
                )}
              </div>
            ))}
          </div>

          {collectionItems.length > 3 && (
            <button
              type="button"
              className="media-show-more-btn"
              onClick={() => setShowAllCollection((v) => !v)}
            >
              <span>{showAllCollection ? 'Show Less' : `Show More (${collectionItems.length - 3} items)`}</span>
            </button>
          )}
        </section>
      )}

      {/* 3. Community Reviews Section (Reuses feed Card components) */}
      {(activeTab === 'overview' || activeTab === 'reviews') && (
        <section className={`media-section community-reviews-section ${activeTab === 'overview' ? 'is-overview' : ''} ${entity.type === 'game' ? 'is-game-reviews' : ''}`}>
          <div className="media-section-header reviews-header-row">
            <div className="media-section-title-group">
              <BookOpen size={16} className="title-icon" />
              <h2>Community Reviews ({formatCount(matchingReviews.length)})</h2>
            </div>

            {activeTab === 'overview' && (
              <button
                type="button"
                className="media-view-all-btn"
                onClick={() => setActiveTab('reviews')}
              >
                <span>
                  {entity.type === 'game'
                    ? `View All Reviews (${formatCount(matchingReviews.length)}) \u2192`
                    : 'View All Reviews'}
                </span>
              </button>
            )}
          </div>

          {reviewItemsToDisplay.length === 0 ? (
            <div className="media-empty-reviews">
              <BookOpen size={32} opacity={0.3} />
              <p>No community reflections recorded for {entity.name} yet.</p>
            </div>
          ) : activeTab === 'overview' ? (
            <div className="community-review-preview-grid">
              {reviewItemsToDisplay.slice(0, 3).map((entry) => (
                <div key={entry.id} className="community-review-preview-item">
                  {renderCommunityReviewCard(entry)}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              {/* Skeleton overlay — visible while masonry layout is computing */}
              {!reviewMasonryLayout && (
                <div
                  className="community-review-skeleton-grid"
                  aria-label="Loading reviews…"
                  aria-busy="true"
                  style={{ position: 'absolute', inset: 0, zIndex: 1 }}
                >
                  {Array.from({ length: Math.min(reviewItemsToDisplay.length || 6, 6) }, (_, i) => (
                    <CommunityReviewSkeleton key={i} />
                  ))}
                </div>
              )}
              {/* Real masonry grid — always in DOM so useMasonryLayout can measure it */}
              <div
                className="card-grid media-reviews-masonry"
                ref={reviewGridRef}
                style={{
                  position: 'relative',
                  height: reviewMasonryLayout ? reviewMasonryLayout.height : 'auto',
                  minHeight: 320,
                  opacity: reviewMasonryLayout ? 1 : 0,
                  transition: 'opacity 220ms ease-out',
                  pointerEvents: reviewMasonryLayout ? 'auto' : 'none',
                }}
              >
                {reviewItemsToDisplay.map((entry) => {
                  const pos = reviewMasonryLayout?.positions.get(entry.id)

                  return (
                    <div
                      key={entry.id}
                      data-id={entry.id}
                      className="masonry-item"
                      style={
                        pos
                          ? {
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: pos.width,
                              transform: `translate3d(${pos.left}px, ${pos.top}px, 0)`,
                              // Suppress transition on first layout so cards appear immediately in position
                              transition: isFirstReviewLayout ? 'none' : 'transform 320ms cubic-bezier(0.2, 0, 0, 1)',
                              willChange: 'transform',
                            }
                          : { width: '100%', marginBottom: 16 }
                      }
                    >
                      {renderCommunityReviewCard(entry)}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {activeTab === 'versions' && entity.type === 'album' && liveAlbumVersionFamily && liveAlbumVersionFamily.editions.length > 0 && (
        <section className="media-section related-albums-section">
          <div className="media-section-header">
            <div className="media-section-title-group">
              <Layers size={16} className="title-icon" />
              <h2>Other Versions</h2>
            </div>
          </div>

          <div className="related-album-tile-grid">
            {liveAlbumVersionFamily.editions.map((item) => (
              <RelatedAlbumTile key={item.collectionId} item={item} onNavigate={onNavigateToEntity} />
            ))}
          </div>
        </section>
      )}

      {/* 4. Similar Albums Grid */}
      {activeTab === 'related' && entity.type === 'album' && liveRelatedAlbums && liveRelatedAlbums.length > 0 && (
        <section className="media-section related-albums-section">
          <div className="media-section-header">
            <div className="media-section-title-group">
              <Sparkles size={16} className="title-icon" />
              <h2>Similar Albums</h2>
            </div>
          </div>

          <div className="related-album-tile-grid">
            {liveRelatedAlbums.slice(0, 4).map((item) => (
              <RelatedAlbumTile key={item.id} item={item} onNavigate={onNavigateToEntity} />
            ))}
          </div>
        </section>
      )}

      {/* 4b. Song Appearance Albums */}
      {activeTab === 'related' && entity.type === 'song' && (
        <section className="media-section related-albums-section">
          <div className="media-section-header">
            <div className="media-section-title-group">
              <Disc3 size={16} className="title-icon" />
              <h2>Appears In</h2>
            </div>
          </div>

          {liveSongAppearances && liveSongAppearances.length > 0 ? (
            <div className="related-album-tile-grid">
              {liveSongAppearances.map((item) => (
                <RelatedAlbumTile key={item.id} item={item} onNavigate={onNavigateToEntity} />
              ))}
            </div>
          ) : (
            <div className="media-empty-reviews">
              <Disc3 size={32} opacity={0.3} />
              <p>No album appearances found for {entity.name} yet.</p>
            </div>
          )}
        </section>
      )}

      {/* 5. Related Media Section */}
      {shouldShowRelatedSection && (
        <section className={`media-section related-entities-section ${entity.type === 'artist' || isMusicianHumanProfile ? 'similar-artists-section' : ''}`}>
          <div className="media-section-header">
            <div className="media-section-title-group">
              <Sparkles size={16} className="title-icon" />
              <h2>
                {entity.type === 'artist' || isMusicianHumanProfile
                  ? 'Similar Artists'
                  : entity.type === 'game'
                    ? 'Similar Games'
                    : entity.relatedEntities?.title || 'Related'}
              </h2>
            </div>
          </div>

          {entity.type === 'artist' || isMusicianHumanProfile ? (
            relatedItemsToDisplay.length === 0 ? (
              <div className="similar-artists-empty">
                <Sparkles size={18} />
                <span>No similar artists available.</span>
              </div>
            ) : (
              <div className="similar-artists-grid">
                {relatedItemsToDisplay.map((rel) => (
                  <SimilarArtistPortraitItem
                    key={rel.id}
                    artist={rel}
                    isActive={rel.id === entity.id}
                    onNavigate={(entityId) => onNavigateToEntity?.(entityId, rel.type)}
                  />
                ))}
              </div>
            )
          ) : relatedItemsToDisplay.length === 0 ? (
            <div className="similar-artists-empty">
              <Sparkles size={18} />
              <span>No similar {entity.type === 'game' ? 'games' : 'titles'} available.</span>
            </div>
          ) : entity.type === 'game' ? (
            <div className="related-album-tile-grid">
              {relatedItemsToDisplay.map((item) => (
                <SimilarGameTile key={item.id} item={item} onNavigate={onNavigateToEntity} />
              ))}
            </div>
          ) : (
            <div className="related-cards-scroll">
              {relatedItemsToDisplay.map((rel) => (
                <div
                  key={rel.id}
                  className="related-media-card"
                  onClick={() => onNavigateToEntity?.(rel.id, rel.type)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="related-thumb-wrapper">
                    <img
                      src={resolveArtworkUrl(rel.artworkUrl, rel.title, rel.subtitle) || createArtworkPlaceholder(rel.title, rel.subtitle)}
                      alt={rel.title}
                      className="related-thumb"
                      loading="eager"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      onError={(event) => {
                        event.currentTarget.src = createArtworkPlaceholder(rel.title, rel.subtitle)
                      }}
                    />
                  </div>
                  <div className="related-info">
                    <span className="related-title">{rel.title}</span>
                    <span className="related-subtitle">{rel.subtitle}</span>
                  </div>
                  <ChevronRight size={14} className="related-arrow" />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Rating Breakdown Modal ── */}
      {isRatingModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsRatingModalOpen(false)}>
          <motion.div
            className="rating-breakdown-modal"
            initial={{ opacity: 0, scale: 0.94, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 15 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rating-breakdown-header">
              <div>
                <h3 className="rating-breakdown-title">Rating Analytics</h3>
                <span className="rating-breakdown-subtitle">{entity.name}</span>
              </div>
              <button
                type="button"
                className="profile-modal-close"
                onClick={() => setIsRatingModalOpen(false)}
                aria-label="Close rating modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="rating-breakdown-summary">
              <span className="rating-overall-label">OVERALL</span>
              <div className="rating-score-hero">
                {ratingAnalytics.average > 0 ? ratingAnalytics.average.toFixed(1) : '—'}
              </div>
              <div className="rating-stars-wrap">
                <StarRating rating={ratingAnalytics.average} />
              </div>
              <span className="rating-summary-count">
                Based on {ratingAnalytics.count} community rating{ratingAnalytics.count !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="rating-distribution-header">
              <span>RATING DISTRIBUTION</span>
            </div>

            <div className="rating-bars-list">
              {[5, 4, 3, 2, 1].map((stars) => {
                const pct = ratingAnalytics.distribution[stars] || 0
                return (
                  <div key={stars} className="rating-bar-row">
                    <div className="rating-bar-star-icons" aria-label={`${stars} stars`}>
                      {Array.from({ length: stars }).map((_, i) => (
                        <Star key={i} size={11} fill="#f5c518" color="#f5c518" />
                      ))}
                    </div>
                    <div className="rating-bar-track">
                      <motion.div
                        className="rating-bar-fill"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </div>
                    <span className="rating-bar-percent">
                      {pct}%
                    </span>
                  </div>
                )
              })}
            </div>
          </motion.div>
        </div>
      )}

    </motion.div>
  )
}
