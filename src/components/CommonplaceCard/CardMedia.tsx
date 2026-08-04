import React from 'react'
import type { LucideIcon } from 'lucide-react'
import { StarRating } from './CardHeader'

interface CardMediaProps {
  type: string
  title: string
  creator: string
  genre?: string
  provider?: string
  year?: string
  coverUrl?: string
  rating: number
  typeIcon: LucideIcon
  onToggle: () => void
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
  typeIcon: Icon,
  onToggle,
}) => {
  const tvYearDisplay = formatTvYear(year)
  const bookExtraDisplay = formatBookExtra(provider, year)

  return (
    <div className="card-body">
      <button
        className={
          usesSquareArtwork(type)
            ? 'card-artwork card-artwork--square'
            : 'card-artwork'
        }
        type="button"
        onClick={onToggle}
        aria-label={`View details for ${title}`}
        tabIndex={-1}
      >
        {coverUrl ? (
          <img src={coverUrl} alt="" />
        ) : (
          <Icon aria-hidden="true" className="artwork-icon" />
        )}
      </button>
      <div className="card-meta">
        {rating > 0 && <StarRating rating={rating} />}
        <h2 className="card-title">{title}</h2>

        {type === 'book' && (
          <>
            {creator && <p className="card-creator">{creator}</p>}
            {genre && <p className="card-genre">{genre}</p>}
            {bookExtraDisplay && <p className="card-provider">{bookExtraDisplay}</p>}
          </>
        )}

        {type === 'album' && (
          <>
            {creator && <p className="card-creator">{creator}</p>}
            {genre && <p className="card-genre">{genre}</p>}
            {year && <p className="card-provider">{year}</p>}
          </>
        )}

        {type === 'song' && (
          <>
            {creator && <p className="card-creator">{creator}</p>}
            {genre && <p className="card-genre">{genre}</p>}
            {provider && provider !== genre && provider !== year && (
              <p className="card-provider">{provider}</p>
            )}
          </>
        )}

        {type === 'film' && (
          <>
            {creator && <p className="card-creator">{creator}</p>}
            {genre && <p className="card-genre">{genre}</p>}
            {year && <p className="card-provider">{year}</p>}
          </>
        )}

        {type === 'game' && (
          <>
            {creator && <p className="card-creator">{creator}</p>}
            {genre && <p className="card-genre">{genre}</p>}
            {year && <p className="card-provider">{year}</p>}
          </>
        )}

        {type === 'tv' && (
          <>
            {creator && <p className="card-creator">{creator}</p>}
            {genre && <p className="card-genre">{genre}</p>}
            {tvYearDisplay && <p className="card-provider">{tvYearDisplay}</p>}
          </>
        )}
      </div>
    </div>
  )
}
