import React from 'react'
import type { LucideIcon } from 'lucide-react'

interface CardMediaProps {
  type: string
  title: string
  creator: string
  genre?: string
  provider?: string
  year?: string
  coverUrl?: string
  typeIcon: LucideIcon
  onToggle: () => void
}

function usesSquareArtwork(type: string) {
  return type === 'album' || type === 'song'
}

export const CardMedia: React.FC<CardMediaProps> = ({
  type,
  title,
  creator,
  genre,
  provider,
  year,
  coverUrl,
  typeIcon: Icon,
  onToggle,
}) => {
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
        <h2 className="card-title">{title}</h2>

        {type === 'book' && (
          <>
            {creator && <p className="card-creator">{creator}</p>}
            {genre && <p className="card-genre">{genre}</p>}
          </>
        )}

        {type === 'album' && (
          <>
            {creator && <p className="card-creator">{creator}</p>}
            {genre && <p className="card-genre">{genre}</p>}
          </>
        )}

        {type === 'song' && (
          <>
            {creator && <p className="card-creator">{creator}</p>}
            {genre && <p className="card-genre">{genre}</p>}
            {provider && provider !== genre && provider !== year && (
              <p className="card-album">{provider}</p>
            )}
          </>
        )}

        {type === 'film' && (
          <>
            {genre && <p className="card-genre">{genre}</p>}
            {(creator || year) && (
              <p className="card-creator">
                {creator || (year ? `Released ${year}` : '')}
              </p>
            )}
          </>
        )}

        {type === 'game' && (
          <>
            {genre && <p className="card-genre">{genre}</p>}
            {creator && <p className="card-creator">{creator}</p>}
          </>
        )}

        {type === 'tv' && (
          <>
            {genre && <p className="card-genre">{genre}</p>}
            {creator && (
              <p className="card-cast">
                <span className="meta-label">Cast:</span> {creator}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
