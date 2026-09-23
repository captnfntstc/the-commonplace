import React from 'react'
import type { LucideIcon } from 'lucide-react'
import { StarRating } from './CardHeader'
import { splitCreatorNames } from '../../features/entities/entryProfiles'
import { cleanDisplayText } from '../../utils/text'

interface CardMediaProps {
  type: string
  title: string
  creator: string
  genre?: string
  provider?: string
  year?: string
  coverUrl?: string
  rating: number
  explicit?: boolean
  typeIcon: LucideIcon
  onToggle?: () => void
  onOpenMedia?: () => void
  onOpenCreator?: (creatorName: string) => void
  onOpenAlbum?: () => void
}

function usesSquareArtwork(type: string) {
  return type === 'album' || type === 'song'
}

function formatTvYear(year?: string): string | undefined {
  if (!year) return undefined
  if (year.includes('-') || year.includes('–')) return year
  const numYear = parseInt(year, 10)
  if (!isNaN(numYear) && numYear > 1900 && numYear <= new Date().getFullYear()) {
    return `Since ${year}`
  }
  return year
}

function formatBookExtra(provider?: string, year?: string): string | undefined {
  if (!provider || provider === 'Manual') return year
  if (year && !provider.includes(year)) {
    return `${provider} (${year})`
  }
  return provider
}

export const CardMedia: React.FC<CardMediaProps> = ({
  type,
  title,
  creator,
  genre,
  provider,
  year,
  coverUrl,
  rating,
  explicit,
  typeIcon: Icon,
  onToggle,
  onOpenMedia,
  onOpenCreator,
  onOpenAlbum,
}) => {
  const displayTitle = cleanDisplayText(title)
  const displayGenre = cleanDisplayText(genre)
  const displayProvider = cleanDisplayText(provider)
  const tvYearDisplay = formatTvYear(year)
  const bookExtraDisplay = formatBookExtra(displayProvider, year)
  const showExplicitBadge = (type === 'song' || type === 'album') && explicit
  const hasArtworkAction = Boolean(onOpenMedia || onToggle)
  const creatorNames = splitCreatorNames(creator)
  const creatorContent = creatorNames.map((name, index) => (
    <React.Fragment key={`${name}-${index}`}>
      {index > 0 && <span aria-hidden="true">, </span>}
      {onOpenCreator ? (
        <button
          type="button"
          className="card-metadata-link"
          onClick={(event) => {
            event.stopPropagation()
            onOpenCreator(name)
          }}
        >
          {name}
        </button>
      ) : name}
    </React.Fragment>
  ))

  return (
    <div className="card-body">
      {hasArtworkAction ? (
        <button
          className={usesSquareArtwork(type) ? 'card-artwork card-artwork--square' : 'card-artwork'}
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            if (onOpenMedia) onOpenMedia()
            else onToggle?.()
          }}
          aria-label={onOpenMedia ? `Open media page for ${displayTitle}` : `View details for ${displayTitle}`}
        >
          {coverUrl ? (
            <img src={coverUrl} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async" />
          ) : (
            <Icon aria-hidden="true" className="artwork-icon" />
          )}
        </button>
      ) : (
        <div className={usesSquareArtwork(type) ? 'card-artwork card-artwork--square' : 'card-artwork'}>
          {coverUrl ? (
            <img src={coverUrl} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async" />
          ) : (
            <Icon aria-hidden="true" className="artwork-icon" />
          )}
        </div>
      )}
      <div className="card-meta">
        <StarRating rating={rating} />
        <h2 className="card-title">
          {onOpenMedia ? (
            <button
              type="button"
              className="card-metadata-link card-title-link"
              onClick={(event) => {
                event.stopPropagation()
                onOpenMedia()
              }}
            >
              {displayTitle}
            </button>
          ) : <span>{displayTitle}</span>}
          {showExplicitBadge && <span className="explicit-badge explicit-badge--inline" aria-label="Explicit">E</span>}
        </h2>

        {type === 'book' && (
          <>
            {creator && <p className="card-creator">{creatorContent}</p>}
            {displayGenre && <p className="card-genre">{displayGenre}</p>}
            {bookExtraDisplay && <p className="card-provider">{bookExtraDisplay}</p>}
          </>
        )}

        {type === 'album' && (
          <>
            {creator && <p className="card-creator">{creatorContent}</p>}
            {displayGenre && <p className="card-genre">{displayGenre}</p>}
            {year && <p className="card-provider">{year}</p>}
          </>
        )}

        {type === 'song' && (
          <>
            {creator && <p className="card-creator">{creatorContent}</p>}
            {displayGenre && <p className="card-genre">{displayGenre}</p>}
            {displayProvider && displayProvider !== displayGenre && displayProvider !== year && (
              <p className="card-provider">
                {onOpenAlbum ? (
                  <button
                    type="button"
                    className="card-metadata-link"
                    onClick={(event) => {
                      event.stopPropagation()
                      onOpenAlbum()
                    }}
                  >
                    {displayProvider}
                  </button>
                ) : displayProvider}
              </p>
            )}
          </>
        )}

        {type === 'film' && (
          <>
            {creator && <p className="card-creator">{creatorContent}</p>}
            {displayGenre && <p className="card-genre">{displayGenre}</p>}
            {year && <p className="card-provider">{year}</p>}
          </>
        )}

        {type === 'game' && (
          <>
            {creator && <p className="card-creator">{creatorContent}</p>}
            {displayGenre && <p className="card-genre">{displayGenre}</p>}
            {year && <p className="card-provider">{year}</p>}
          </>
        )}

        {type === 'tv' && (
          <>
            {creator && <p className="card-creator">{creatorContent}</p>}
            {displayGenre && <p className="card-genre">{displayGenre}</p>}
            {tvYearDisplay && <p className="card-provider">{tvYearDisplay}</p>}
          </>
        )}
      </div>
    </div>
  )
}
