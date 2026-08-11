import React, { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Home,
  Star,
  X,
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
  BarChart2,
  Loader2,
  Plus,
  User,
  Music4,
  Quote,
} from 'lucide-react'
import type { CardEntry } from '../components/CommonplaceCard/Card'
import { StarRating } from '../components/CommonplaceCard/CardHeader'
import { FormattedText } from '../components/CommonplaceCard/FormattedText'
import { UNIVERSAL_MEDIA_ENTITIES } from '../data/universalMediaEntities'
import {
  type UniversalMediaEntity,
  type MediaEntityType,
  type RelatedEntityItem,
  getEntityTabs,
} from '../types/mediaEntity'
import {
  searchMetadata,
  fetchWikipediaPortrait,
  fetchItunesDiscography,
  fetchItunesAlbumDetails,
  fetchRelatedAlbums,
  fetchItunesSongDetails,
  fetchItunesSongAppearances,
  fetchItunesSongArtwork,
  entityImageCacheMap,
  albumEntityMap,
  type MetadataType,
} from '../metadata'
import type { MetadataChip, CollectionItem, TopContentItem } from '../types/mediaEntity'
import { useMasonryLayout } from '../hooks/useMasonryLayout'
import { formatFullDateTime, formatRelativeTime } from '../utils/dateUtils'
import { createArtworkPlaceholder, resolveArtworkUrl } from '../utils/artwork'
import { normalizeGameMetadata, primaryGameCreator } from '../utils/gameMetadata'
import {
  GameAvailableOnPreview,
  GameInfoTab,
  PlatformsReleasesTab,
} from '../components/GameProfile/GameProfileSections'

type ScoredRelatedEntityItem = RelatedEntityItem & {
  sortScore?: number
}

interface UniversalMediaProfilePageProps {
  entity: UniversalMediaEntity
  onBack: () => void
  onHome?: () => void
  communityEntries: CardEntry[]
  onSelectEntry?: (entry: CardEntry) => void
  onOpenUserProfile?: (handle: string) => void
  onNavigateToEntity?: (entityId: string, entityType?: MediaEntityType) => void
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

function isPortraitEntity(type: MediaEntityType) {
  return ['artist', 'author', 'director', 'actor'].includes(type)
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

function reviewMatchesEntity(entry: CardEntry, entity: UniversalMediaEntity, chips: MetadataChip[]) {
  const entityName = normalizeReviewSubjectText(entity.name)
  const entryTitle = normalizeReviewSubjectText(entry.title)
  const entityType = entryTypeForEntity(entity.type)

  if (entity.type === 'artist' || entity.type === 'author' || entity.type === 'director' || entity.type === 'game_studio') {
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
    const providerTrackId = item.id.match(/^song-(\d+)$/i)?.[1]
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
  const cleanTitle = artist.title.toLowerCase()
  const fallbackSvg = useMemo(
    () => createArtworkPlaceholder(artist.title, artist.subtitle || 'Artist'),
    [artist.title, artist.subtitle],
  )

  const initialUrl = useMemo(() => {
    const cachedWiki = entityImageCacheMap.get(`wiki-portrait:${cleanTitle}`)
    if (cachedWiki) return cachedWiki

    const cachedArtist = entityImageCacheMap.get(`artist:${artist.id}`) || entityImageCacheMap.get(cleanTitle)
    if (cachedArtist) return cachedArtist

    if (artist.artworkUrl && artist.artworkUrl.length > 5) {
      return resolveArtworkUrl(artist.artworkUrl, artist.title, artist.subtitle)
    }

    return fallbackSvg
  }, [artist.artworkUrl, artist.id, artist.subtitle, artist.title, cleanTitle, fallbackSvg])

  const [portraitUrl, setPortraitUrl] = useState<string>(initialUrl)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    let isMounted = true

    const cachedWiki = entityImageCacheMap.get(`wiki-portrait:${cleanTitle}`)
    if (cachedWiki) {
      setPortraitUrl(cachedWiki)
      return () => {
        isMounted = false
      }
    }

    fetchWikipediaPortrait(artist.title)
      .then((url) => {
        if (!isMounted) return
        if (url) {
          entityImageCacheMap.set(`wiki-portrait:${cleanTitle}`, url)
          entityImageCacheMap.set(`artist:${artist.id}`, url)
          setPortraitUrl(url)
          setImageFailed(false)
        }
      })
      .catch(() => {})

    return () => {
      isMounted = false
    }
  }, [artist.id, artist.title, cleanTitle])

  const displaySrc = imageFailed ? fallbackSvg : portraitUrl

  return (
    <button
      type="button"
      className={`similar-artist-portrait-item ${isActive ? 'is-active' : ''}`}
      onClick={() => onNavigate?.(artist.id)}
      aria-label={`Open ${artist.title} artist profile`}
    >
      <span className="similar-artist-portrait-frame">
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
  onNavigate?: (entityId: string, entityType?: MediaEntityType) => void
}> = ({ item, onNavigate }) => (
  <button
    type="button"
    className="related-album-tile"
    onClick={() => onNavigate?.(item.id, 'album')}
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
  const fallbackArtwork = createArtworkPlaceholder(item.title, 'Game')
  const [artwork, setArtwork] = useState(
    resolveArtworkUrl(item.artworkUrl, item.title, 'Game') || fallbackArtwork,
  )

  useEffect(() => {
    setArtwork(resolveArtworkUrl(item.artworkUrl, item.title, 'Game') || fallbackArtwork)
  }, [fallbackArtwork, item.artworkUrl, item.title])

  return (
    <button
      type="button"
      className="related-album-tile similar-game-tile"
      onClick={() => onNavigate?.(item.id, 'game')}
      aria-label={`Open ${item.title} game profile`}
    >
      <span className="related-album-art-frame similar-game-art-frame">
        <img
          src={artwork}
          alt={item.title}
          className="collection-thumb"
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setArtwork(fallbackArtwork)}
        />
      </span>
      <span className="related-album-title">{item.title}</span>
      <span className="related-album-subtitle">{item.subtitle}</span>
    </button>
  )
}

const CountUpNumber: React.FC<{
  value: number
  decimals?: number
  durationMs?: number
  format?: (value: number) => string
}> = ({ value, decimals = 0, durationMs = 760, format }) => {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    let frameId = 0
    const start = performance.now()

    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayValue(value * eased)
      if (progress < 1) frameId = requestAnimationFrame(tick)
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [durationMs, value])

  if (format) return <>{format(displayValue)}</>
  return <>{displayValue.toFixed(decimals)}</>
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
  onQuickAddEntry,
  likedEntryIds = [],
  savedEntryIds = [],
  disabledCommentEntryIds = [],
  onToggleLike,
  onToggleSave,
}) => {
  const IconComponent = getMediaIcon(entity.type)
  const tabs = useMemo(() => getEntityTabs(entity.type), [entity.type])
  const [activeTab, setActiveTab] = useState<string>(tabs[0]?.id || 'overview')

  const [showRatingModal, setShowRatingModal] = useState(false)
  const [showAllTopContent, setShowAllTopContent] = useState(false)
  const [showAllCollection, setShowAllCollection] = useState(false)
  const [showAllAlbums, setShowAllAlbums] = useState(false)
  const [showAllEps, setShowAllEps] = useState(false)
  const [showAllSingles, setShowAllSingles] = useState(false)
  const [selectedLyricIndexes, setSelectedLyricIndexes] = useState<number[]>([])

  useEffect(() => {
    setActiveTab('overview')
    setShowAllTopContent(false)
    setShowAllCollection(false)
    setShowAllAlbums(false)
    setShowAllEps(false)
    setShowAllSingles(false)
    setSelectedLyricIndexes([])
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
  const [liveAlbumChips, setLiveAlbumChips] = useState<MetadataChip[] | null>(null)
  const [liveRelatedAlbums, setLiveRelatedAlbums] = useState<CollectionItem[] | null>(null)
  const [liveSongAppearances, setLiveSongAppearances] = useState<CollectionItem[] | null>(null)
  const [liveArtistDiscographies, setLiveArtistDiscographies] = useState<Record<string, CollectionItem[]>>({})
  const [liveSongLyrics, setLiveSongLyrics] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    setFailedHeroArtworkUrl(null)
    setLiveCollectionItems(null)
    setLiveTrackItems(null)
    setLiveAlbumChips(null)
    setLiveRelatedAlbums(null)
    setLiveSongAppearances(null)
    setLiveArtistDiscographies({})
    setLiveSongLyrics(null)
    setApiSummary(null)

    const cachedForEntity =
      entityImageCacheMap.get(imageCacheKey) ||
      null
    setApiCoverUrl(cachedForEntity)

    if (entity.type === 'artist') {
      fetchItunesDiscography(entity.name)
        .then((items) => {
          if (!isMounted) return
          if (items && items.length > 0) setLiveCollectionItems(items)
        })
        .catch(() => {})

    }

    if (entity.type === 'album') {
      const artistChip = entity?.metadataChips?.find((c) => c.label === 'Artist')?.value
      fetchItunesAlbumDetails(
        entity.name,
        artistChip,
        undefined,
        getExpectedTrackCount(entity),
        entity.providerId || entity.id,
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
            fetchRelatedAlbums(entity.name, details.artist || artistChip, details.genre, entity.id, undefined, details.explicit)
              .then((items) => {
                if (!isMounted) return
                setLiveRelatedAlbums(items.length > 0 ? items : null)
              })
              .catch(() => {})
          }
        })
        .catch(() => {})
    }

    if (entity.type === 'song') {
      const artistChip = entity?.metadataChips?.find((c) => c.label === 'Artist')?.value
      fetchItunesSongDetails(entity.name, artistChip, entity.providerId)
        .then((details) => {
          if (!isMounted) return
          if (details) {
            if (details.artworkUrl) {
              const safeArtworkUrl = resolveArtworkUrl(details.artworkUrl, entity.name, entity.categoryLabel)
              entityImageCacheMap.set(imageCacheKey, safeArtworkUrl)
              setApiCoverUrl(safeArtworkUrl)
            }
            if (details.lyrics) setLiveSongLyrics(details.lyrics)
            setLiveAlbumChips([
              { label: 'Artist', value: details.artist || artistChip || 'Artist' },
              { label: 'Album', value: details.album || 'Single' },
              { label: 'Duration', value: details.duration },
              { label: 'Track #', value: `#${details.trackNumber}` },
              { label: 'Release Year', value: details.year },
              ...(details.explicit ? [{ label: 'Explicit', value: 'Yes' }] : []),
            ])
          }
        })
        .catch(() => {})

      fetchItunesSongAppearances(entity.name, artistChip, entity.providerId)
        .then((items) => {
          if (!isMounted) return
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
      fetchWikipediaPortrait(entity.name)
        .then((url) => {
          if (!isMounted) return
          if (url) {
            entityImageCacheMap.set(imageCacheKey, url)
            setApiCoverUrl(url)
          }
        })
        .catch(() => {})
        .finally(() => {
          if (isMounted) setIsLoadingApi(false)
        })
    } else if (!existingCache && !(entity.type === 'game' && entity.gameMetadata && entity.artworkUrl)) {
      setIsLoadingApi(true)
      const metaType = mapToMetaType(entity.type)
      searchMetadata(metaType, entity.name)
        .then((results) => {
          if (!isMounted) return
          if (results && results.length > 0) {
            const match = entity.type === 'game'
              ? results.find((result) => result.title.localeCompare(entity.name, undefined, { sensitivity: 'base' }) === 0) || results[0]
              : results[0]
            if (match.coverUrl) {
              const safeCoverUrl = resolveArtworkUrl(match.coverUrl, entity.name, entity.categoryLabel)
              entityImageCacheMap.set(imageCacheKey, safeCoverUrl)
              setApiCoverUrl(safeCoverUrl)
            }
            if (match.summary) setApiSummary(match.summary)
          }
        })
        .catch(() => {})
        .finally(() => {
          if (isMounted) setIsLoadingApi(false)
        })
    }

    return () => {
      isMounted = false
    }
  }, [entity.id, entity.name, entity.type, imageCacheKey, isPortraitProfile])

  const fallbackArtwork = createArtworkPlaceholder(entity.name, entity.categoryLabel)
  const preferredArtworkUrl = entity.type === 'game'
    ? entity.artworkUrl || apiCoverUrl
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
      .slice(0, 4)
  }, [disabledCommentEntryIds, likedEntryIds, matchingReviews, savedEntryIds])

  const collectionItems = liveCollectionItems || entity.secondaryCollection?.items || []

  const albumsGroup = useMemo(() => {
    return collectionItems.filter((i) => {
      const cat = i.category
      if (cat) return cat === 'album'
      const sub = (i.subtitle || '').toLowerCase()
      return !sub.includes('ep') && !sub.includes('single')
    })
  }, [collectionItems])

  const epsGroup = useMemo(() => {
    return collectionItems.filter((i) => {
      const cat = i.category
      if (cat) return cat === 'ep'
      const sub = (i.subtitle || '').toLowerCase()
      return sub.includes('ep')
    })
  }, [collectionItems])

  const singlesGroup = useMemo(() => {
    return collectionItems.filter((i) => {
      const cat = i.category
      if (cat) return cat === 'single'
      const sub = (i.subtitle || '').toLowerCase()
      return sub.includes('single')
    })
  }, [collectionItems])

  const songQuotes = useMemo(() => {
    if (entity.type !== 'song') return []
    const extracted = matchingReviews
      .filter((r) => r.favoritePassage || r.reflection)
      .map((r) => ({
        id: r.id,
        text: r.favoritePassage ? `“${r.favoritePassage}”` : `“${r.reflection.slice(0, 150)}${r.reflection.length > 150 ? '…' : ''}”`,
        author: r.authorName || 'Community Member',
        authorHandle: r.authorHandle || '@reflector',
      }))

    if (extracted.length > 0) return extracted

    return [
      {
        id: 'sq-1',
        text: `“Cause baby, now we've got bad blood / You know it used to be mad love…”`,
        author: 'Community Reflection',
        authorHandle: '@taylorswift_archive',
      },
      {
        id: 'sq-2',
        text: `“Say you'll remember me standing in a nice dress, staring at the sunset, babe…”`,
        author: 'Music Journal',
        authorHandle: '@wildest_notes',
      },
    ]
  }, [entity.type, matchingReviews])

  const topItems = liveTrackItems || entity.primaryCollection?.items || []
  const lyricLines = useMemo(
    () =>
      (liveSongLyrics || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
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
    entity.type === 'artist' || entity.type === 'album'
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

  const relatedItemsToDisplay = useMemo<ScoredRelatedEntityItem[]>(() => {
    if (entity.type === 'game') {
      const currentGenreProfile = getGameGenreProfile(entity)

      return Object.values(UNIVERSAL_MEDIA_ENTITIES)
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
            sortScore:
              sharedLabels * 300 +
              sharedTokens * 100 +
              Math.min(candidate.communityRating.count, 10000) / 10000,
          }
        })
        .filter((item) => (item.sortScore || 0) >= 100)
        .sort((a, b) => (b.sortScore || 0) - (a.sortScore || 0))
        .slice(0, 4)
    }

    if (entity.type !== 'artist') {
      return entity.relatedEntities?.items || []
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
  }, [activeTab, collectionItems, entity, liveArtistDiscographies])

  const visibleTopItems = useMemo(() => {
    if (entity.type === 'album') {
      if (activeTab === 'overview') return topItems.slice(0, 5)
      if (activeTab === 'top_content') return topItems
    }
    return showAllTopContent ? topItems : topItems.slice(0, 5)
  }, [entity.type, activeTab, topItems, showAllTopContent])

  const chipsToDisplay = (liveAlbumChips || entity?.metadataChips || []).filter((chip) => {
    const label = chip.label.toLowerCase()
    return label !== 'monthly listeners' && label !== 'albums released' && label !== 'explicit'
  })
  const isExplicitProfile =
    (entity.type === 'album' || entity.type === 'song') &&
    (Boolean(entity.explicit) ||
      Boolean((liveAlbumChips || entity.metadataChips).some((chip) =>
        chip.label.toLowerCase() === 'explicit' && chip.value.toLowerCase() === 'yes',
      )))

  const ratingAverage = entity.communityRating?.average ?? 4.8
  const ratingCount = entity.communityRating?.count ?? 1200
  const ratingDistribution = entity.communityRating?.distribution ?? { 5: 85, 4: 11, 3: 3, 2: 1, 1: 0 }
  const gameMetadata = useMemo(() => normalizeGameMetadata(entity), [entity])

  const glanceItems = useMemo(() => {
    const yearChip = chipsToDisplay.find((chip) => /year|since|release/i.test(chip.label))
    const creatorChip = chipsToDisplay.find((chip) => /artist|author|director|creator|developer/i.test(chip.label))
    const gameCreator = entity.type === 'game' ? primaryGameCreator(gameMetadata) : undefined
    const gameCreatorLabel = gameMetadata.developers?.length
      ? 'Developer'
      : gameMetadata.publishers?.length
        ? 'Publisher'
        : 'Type'
    return [
      {
        label: 'Rating',
        value: ratingAverage.toFixed(1),
        detail: `${ratingCount.toLocaleString()} ratings`,
      },
      {
        label: 'Reviews',
        value: matchingReviews.length.toLocaleString(),
        detail: entity.type === 'game' ? 'community reviews' : 'community notes',
      },
      {
        label: entity.type === 'game' ? gameCreatorLabel : creatorChip?.label || yearChip?.label || 'Type',
        value: entity.type === 'game' ? gameCreator || entity.categoryLabel : creatorChip?.value || yearChip?.value || entity.categoryLabel,
        detail: entity.type === 'game' ? gameCreatorLabel : entity.categoryLabel,
      },
    ]
  }, [chipsToDisplay, entity.categoryLabel, entity.type, gameMetadata, ratingAverage, ratingCount, matchingReviews.length])

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
    (entity.type === 'artist' || entity.type === 'game' || (entity.type !== 'album' && relatedItemsToDisplay.length > 0))

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
            <img
              src={heroArtworkSrc}
              alt={entity.name}
              className="media-artwork-img"
              referrerPolicy="no-referrer"
              loading="eager"
              fetchPriority="high"
              decoding="async"
              onError={() => setFailedHeroArtworkUrl(displayArtwork)}
            />
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
            </div>
          </div>

          <p className="media-hero-description">{displayDescription}</p>

          {/* Context-aware Metadata Chips */}
          <div className="media-chips-row">
            {chipsToDisplay.map((chip, idx) => (
              <div key={idx} className="media-metadata-chip">
                <span className="chip-label">{chip.label}:</span>
                <span className="chip-value">{chip.value}</span>
              </div>
            ))}
          </div>

          {/* Interactive Community Rating Block */}
          <div
            className="media-community-rating-card"
            onClick={() => setShowRatingModal(true)}
            title="Click to view rating breakdown"
            role="button"
            tabIndex={0}
          >
            <div className="rating-left-stars">
              <div className="rating-star-icon-row">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    size={16}
                    className={i < Math.floor(ratingAverage) ? 'star-gold' : 'star-muted'}
                    fill="currentColor"
                  />
                ))}
              </div>
              <span className="rating-number">{ratingAverage.toFixed(1)}</span>
            </div>
            <div className="rating-right-info">
              <span className="rating-count-text">
                {ratingCount.toLocaleString()} Community Ratings
              </span>
              <span className="rating-subtext">Click for rating distribution & analytics →</span>
            </div>
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
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'overview' && (
        <section className="media-section overview-glance-section">
          <div className="overview-glance-grid">
            {glanceItems.map((item) => (
              <div key={item.label} className="overview-glance-card">
                <span className="overview-glance-label">{item.label}</span>
                <strong>{item.value}</strong>
                <span>{item.detail}</span>
              </div>
            ))}
          </div>
        </section>
      )}

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

      {/* Most Quoted Lines Section (For Songs Only) */}
      {entity.type === 'song' && (activeTab === 'overview' || activeTab === 'top_content') && (
        <section className="media-section song-quotes-section">
          <div className="media-section-header">
            <div className="media-section-title-group">
              <Quote size={16} className="title-icon" />
              <h2>Most Quoted Lines ({songQuotes.length})</h2>
            </div>
          </div>
          <div className="song-quotes-grid">
            {songQuotes.map((q) => (
              <div key={q.id} className="song-quote-card">
                <Quote size={20} className="quote-watermark" />
                <p className="song-quote-text">{q.text}</p>
                <div className="song-quote-meta">
                  <span className="song-quote-author">{q.author}</span>
                  <span className="song-quote-handle">{q.authorHandle}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 1. Primary Top Content Section (Tracklist for Albums, Top Songs for Artists, Cast for Movies) */}
      {entity.type !== 'song' && entity.type !== 'game' && (activeTab === 'overview' || activeTab === 'top_content') && topItems.length > 0 && (
        <section className="media-section top-content-section">
          <div className="media-section-header">
            <div className="media-section-title-group">
              <Sparkles size={16} className="title-icon" />
              <h2>
                {entity.type === 'album'
                  ? activeTab === 'overview'
                    ? 'Top Tracks'
                    : `Full Tracklist (${topItems.length} Tracks)`
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
                entity.type === 'artist'
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
      {activeTab === 'collection' && entity.type === 'artist' && (
        <>
          {albumsGroup.length > 0 && (
            <section className="media-section collection-section">
              <div className="media-section-header">
                <div className="media-section-title-group">
                  <Layers size={16} className="title-icon" />
                  <h2>Studio Albums ({albumsGroup.length})</h2>
                </div>
                {albumsGroup.length > 12 && (
                  <button
                    type="button"
                    className="media-view-all-btn"
                    onClick={() => setShowAllAlbums((v) => !v)}
                  >
                    <span>{showAllAlbums ? 'Show 12' : `View All (${albumsGroup.length}) →`}</span>
                  </button>
                )}
              </div>
              <div className="collection-grid">
                {(showAllAlbums ? albumsGroup : albumsGroup.slice(0, 12)).map((item) => (
                  <div
                    key={item.id}
                    className="collection-card"
                    onClick={() => onNavigateToEntity?.(item.id, 'album')}
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
            </section>
          )}

          {activeTab === 'collection' && epsGroup.length > 0 && (
            <section className="media-section collection-section">
              <div className="media-section-header">
                <div className="media-section-title-group">
                  <Layers size={16} className="title-icon" />
                  <h2>EPs ({epsGroup.length})</h2>
                </div>
                {epsGroup.length > 12 && (
                  <button
                    type="button"
                    className="media-view-all-btn"
                    onClick={() => setShowAllEps((v) => !v)}
                  >
                    <span>{showAllEps ? 'Show 12' : `View All (${epsGroup.length}) →`}</span>
                  </button>
                )}
              </div>
              <div className="collection-grid">
                {(showAllEps ? epsGroup : epsGroup.slice(0, 12)).map((item) => (
                  <div
                    key={item.id}
                    className="collection-card"
                    onClick={() => onNavigateToEntity?.(item.id, 'album')}
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
            </section>
          )}

          {activeTab === 'collection' && singlesGroup.length > 0 && (
            <section className="media-section collection-section">
              <div className="media-section-header">
                <div className="media-section-title-group">
                  <Layers size={16} className="title-icon" />
                  <h2>Singles ({singlesGroup.length})</h2>
                </div>
                {singlesGroup.length > 12 && (
                  <button
                    type="button"
                    className="media-view-all-btn"
                    onClick={() => setShowAllSingles((v) => !v)}
                  >
                    <span>{showAllSingles ? 'Show 12' : `View All (${singlesGroup.length}) →`}</span>
                  </button>
                )}
              </div>
              <div className="collection-grid">
                {(showAllSingles ? singlesGroup : singlesGroup.slice(0, 12)).map((item) => (
                  <div
                    key={item.id}
                    className="collection-card"
                    onClick={() => onNavigateToEntity?.(item.id, 'album')}
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
            </section>
          )}
        </>
      )}

      {/* 3. Generic Secondary Collection Section for non-artists */}
      {activeTab === 'collection' && entity.type !== 'artist' && entity.secondaryCollection && (
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
              <h2>Community Reviews ({matchingReviews.length})</h2>
            </div>

            {activeTab === 'overview' && (
              <button
                type="button"
                className="media-view-all-btn"
                onClick={() => setActiveTab('reviews')}
              >
                <span>
                  {entity.type === 'game'
                    ? `View All Reviews (${matchingReviews.length}) \u2192`
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
              {reviewItemsToDisplay.slice(0, entity.type === 'game' ? 3 : 4).map((entry) => (
                <div key={entry.id} className="community-review-preview-item">
                  {renderCommunityReviewCard(entry)}
                </div>
              ))}
            </div>
          ) : (
            <div
              className="card-grid media-reviews-masonry"
              ref={reviewGridRef}
              style={{
                position: 'relative',
                height: reviewMasonryLayout ? reviewMasonryLayout.height : 'auto',
                minHeight: 320,
                opacity: reviewMasonryLayout ? 1 : 0,
                transition: 'opacity 220ms ease-out',
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
                            transition: 'transform 320ms cubic-bezier(0.2, 0, 0, 1)',
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
          )}
        </section>
      )}

      {/* 4. Related Albums Grid */}
      {activeTab === 'related' && entity.type === 'album' && liveRelatedAlbums && liveRelatedAlbums.length > 0 && (
        <section className="media-section related-albums-section">
          <div className="media-section-header">
            <div className="media-section-title-group">
              <Sparkles size={16} className="title-icon" />
              <h2>Related Albums</h2>
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
              {liveSongAppearances.slice(0, 4).map((item) => (
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
        <section className={`media-section related-entities-section ${entity.type === 'artist' ? 'similar-artists-section' : ''}`}>
          <div className="media-section-header">
            <div className="media-section-title-group">
              <Sparkles size={16} className="title-icon" />
              <h2>
                {entity.type === 'artist'
                  ? 'Similar Artists'
                  : entity.type === 'game'
                    ? 'Similar Games'
                    : entity.relatedEntities?.title || 'Related'}
              </h2>
            </div>
          </div>

          {entity.type === 'artist' ? (
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

      {/* ── Rating Distribution & Analytics Modal ── */}
      <AnimatePresence>
        {showRatingModal && (
          <div className="modal-backdrop" onClick={() => setShowRatingModal(false)}>
            <motion.div
              className="rating-analytics-modal"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header-row">
                <div className="modal-title-group">
                  <BarChart2 size={18} className="icon-gold" />
                  <h2>Rating Analytics & Breakdown</h2>
                </div>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setShowRatingModal(false)}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="rating-modal-body">
                <div className="rating-modal-score-block">
                  <span className="large-score">
                    <CountUpNumber value={ratingAverage} decimals={1} />
                  </span>
                  <div className="stars-wrapper">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        size={18}
                        className={i < Math.floor(ratingAverage) ? 'star-gold' : 'star-muted'}
                        fill="currentColor"
                      />
                    ))}
                  </div>
                  <span className="total-ratings">
                    Based on{' '}
                    <CountUpNumber
                      value={ratingCount}
                      format={(value) => Math.round(value).toLocaleString()}
                    />{' '}
                    Commonplace ratings
                  </span>
                </div>

                <div className="rating-distribution-bars">
                  {[5, 4, 3, 2, 1].map((stars) => {
                    const pct = ratingDistribution[stars] || 0
                    return (
                      <div key={stars} className="dist-row">
                        <span className="dist-star-label">{stars} ★</span>
                        <div className="dist-bar-track">
                          <motion.div
                            className="dist-bar-fill"
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: (5 - stars) * 0.05 }}
                          />
                        </div>
                        <span className="dist-pct-text">
                          <CountUpNumber value={pct} format={(value) => `${Math.round(value)}%`} />
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
