export type SongReleaseKind = 'album' | 'ep' | 'standalone'

export type SongBiographyInput = {
  songName: string
  artistName: string
  albumName?: string
  trackNumber?: number
  trackCount?: number
  studioAlbumNumber?: number | null
  year?: string
}

export function ordinalize(value: number): string {
  const whole = Math.max(1, Math.trunc(value))
  const lastTwo = whole % 100
  const suffix = lastTwo >= 11 && lastTwo <= 13
    ? 'th'
    : whole % 10 === 1
      ? 'st'
      : whole % 10 === 2
        ? 'nd'
        : whole % 10 === 3
          ? 'rd'
          : 'th'

  return `${whole}${suffix}`
}

function normalizeReleaseTitle(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function getSongReleaseKind({
  songName,
  albumName,
  trackCount,
}: Pick<SongBiographyInput, 'songName' | 'albumName' | 'trackCount'>): SongReleaseKind {
  const normalizedSong = normalizeReleaseTitle(songName)
  const normalizedAlbum = normalizeReleaseTitle(albumName || '')
  const count = Number(trackCount || 0)

  if (!normalizedAlbum || normalizedAlbum === normalizedSong || count <= 1) return 'standalone'
  const isAlternateOrNonStudioCollection =
    /\b(ep|single|deluxe|edition|expanded|anniversary|bonus|live|soundtrack|compilation|greatest hits|taylor s version|from the vault|3am|til dawn|late night)\b/.test(normalizedAlbum)
  if (count >= 6 && !isAlternateOrNonStudioCollection) return 'album'
  if (count >= 6) return 'standalone'
  return 'ep'
}

export function buildSongBiography(input: SongBiographyInput): string {
  const {
    songName,
    artistName,
    albumName,
    trackNumber = 1,
    studioAlbumNumber,
    year,
  } = input
  const releaseKind = getSongReleaseKind(input)
  const possessiveArtist = /s$/i.test(artistName.trim())
    ? `${artistName.trim()}'`
    : `${artistName.trim()}'s`

  if (releaseKind === 'album' && albumName) {
    const albumOrdinal = studioAlbumNumber ? `${ordinalize(studioAlbumNumber)} ` : ''
    return `${songName} is the ${ordinalize(trackNumber)} track on ${possessiveArtist} ${albumOrdinal}studio album, ${albumName}.`
  }

  if (releaseKind === 'ep' && albumName) {
    return `${songName} is the ${ordinalize(trackNumber)} track on ${possessiveArtist} EP, ${albumName}.`
  }

  const releaseYear = year ? `, released in ${year}` : ''
  return `${songName} is a single by ${artistName}${releaseYear}.`
}
