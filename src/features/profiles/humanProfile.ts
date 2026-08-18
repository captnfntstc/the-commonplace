import type {
  HumanCapabilities,
  HumanProfession,
  HumanProfileContext,
  HumanProfileMetadata,
  HumanScreenCredit,
  MediaEntityType,
  UniversalMediaEntity,
} from '../../types/mediaEntity'

const professionRules: Array<{
  profession: HumanProfession
  label: string
  pattern: RegExp
}> = [
  { profession: 'artist', label: 'Singer-songwriter', pattern: /\bsinger[ -]songwriter\b/i },
  { profession: 'artist', label: 'Rapper', pattern: /\brapper\b/i },
  { profession: 'artist', label: 'Singer', pattern: /\bsinger\b/i },
  { profession: 'artist', label: 'Musician', pattern: /\bmusician\b/i },
  { profession: 'artist', label: 'Composer', pattern: /\bcomposer\b/i },
  { profession: 'actor', label: 'Actor', pattern: /\bactor\b/i },
  { profession: 'actor', label: 'Actress', pattern: /\bactress\b/i },
  { profession: 'director', label: 'Film Director', pattern: /\bfilm director\b/i },
  { profession: 'director', label: 'Director', pattern: /\bdirector\b/i },
  { profession: 'director', label: 'Filmmaker', pattern: /\bfilmmaker\b/i },
  { profession: 'author', label: 'Novelist', pattern: /\bnovelist\b/i },
  { profession: 'author', label: 'Poet', pattern: /\bpoet\b/i },
  { profession: 'author', label: 'Author', pattern: /\bauthor\b/i },
  { profession: 'author', label: 'Writer', pattern: /\bwriter\b/i },
  { profession: 'creator', label: 'Showrunner', pattern: /\bshowrunner\b/i },
  { profession: 'creator', label: 'Television Creator', pattern: /\btelevision creator\b/i },
  { profession: 'creator', label: 'Screenwriter', pattern: /\bscreenwriter\b/i },
]

const legacyHumanTypes = new Set<MediaEntityType>(['artist', 'actor', 'director', 'creator', 'author'])

export function isHumanEntityType(type: MediaEntityType) {
  return type === 'human' || legacyHumanTypes.has(type)
}

export function humanContextFromEntity(entity: UniversalMediaEntity): HumanProfileContext | undefined {
  if (entity.type === 'human') return entity.humanProfile?.context || entity.humanProfile?.professions[0]
  if (legacyHumanTypes.has(entity.type)) return entity.type as HumanProfileContext
  return undefined
}

export function verifiedProfessionsFromWikipedia(
  description: string,
  fallback?: HumanProfileContext,
) {
  const lead = description.split(/(?<=[.!?])\s+/)[0]?.slice(0, 500) || ''
  const matches = professionRules
    .map((rule) => ({ ...rule, index: lead.search(rule.pattern) }))
    .filter((rule) => rule.index >= 0)
    .sort((left, right) => left.index - right.index)

  const professions: HumanProfession[] = []
  const occupationLabels: string[] = []
  matches.forEach(({ profession, label }) => {
    if (professions.includes(profession)) return
    professions.push(profession)
    occupationLabels.push(label)
  })

  if (professions.length === 0 && fallback) professions.push(fallback)
  if (occupationLabels.length === 0 && fallback) {
    occupationLabels.push(fallback.charAt(0).toUpperCase() + fallback.slice(1))
  }

  return { professions, occupationLabels: occupationLabels.slice(0, 4) }
}

export function canonicalHumanId(ids: HumanProfileMetadata['providerIds'], fallbackId?: string) {
  if (ids.wikidataId) return `human:${ids.wikidataId.toUpperCase()}`
  if (ids.wikipediaPageId) return `human:wikipedia:${ids.wikipediaPageId}`
  if (ids.tmdbPersonId) return `human:tmdb:${ids.tmdbPersonId}`
  if (ids.musicBrainzId) return `human:musicbrainz:${ids.musicBrainzId}`
  if (ids.googleBooksAuthorId) return `human:googlebooks:${ids.googleBooksAuthorId}`
  return fallbackId
}

export function capabilitiesForHuman(options: {
  professions: HumanProfession[]
  hasTopSongs: boolean
  hasDiscography: boolean
  screenCredits: HumanScreenCredit[]
  hasPublishedWorks: boolean
}): HumanCapabilities {
  const { professions, hasTopSongs, hasDiscography, screenCredits, hasPublishedWorks } = options
  return {
    topSongs: hasTopSongs,
    discography: hasDiscography,
    filmography: screenCredits.length > 0,
    publishedWorks: hasPublishedWorks,
    directing: screenCredits.some((credit) => credit.category === 'directing') || professions.includes('director'),
    creating: professions.includes('creator'),
  }
}

export function contextualHumanLabel(
  context: HumanProfileContext | undefined,
  professions: HumanProfession[],
) {
  const verifiedContext = context && professions.includes(context) ? context : professions[0] || context || 'artist'
  const labels: Record<HumanProfession, string> = {
    artist: 'Artist',
    actor: 'Actor',
    director: 'Director',
    creator: 'Creator',
    author: 'Author',
  }
  return labels[verifiedContext]
}

export function getDynamicHumanTabs(options: {
  context?: HumanProfileContext
  capabilities: HumanCapabilities
}) {
  const { context, capabilities } = options
  const workTabs: Array<{ id: string; label: string }> = []
  if (capabilities.topSongs) {
    workTabs.push({ id: 'top_content', label: 'Top Songs' })
  }
  if (capabilities.discography) {
    workTabs.push({ id: 'discography', label: 'Discography' })
  }
  if (capabilities.filmography) workTabs.push({ id: 'filmography', label: 'Filmography' })
  if (capabilities.publishedWorks) workTabs.push({ id: 'published_works', label: 'Published Works' })

  const priority = context === 'artist'
    ? ['top_content', 'discography', 'filmography', 'published_works']
    : context === 'author'
      ? ['published_works', 'filmography', 'top_content', 'discography']
      : ['filmography', 'top_content', 'discography', 'published_works']
  workTabs.sort((left, right) => priority.indexOf(left.id) - priority.indexOf(right.id))

  return [
    { id: 'overview', label: 'Overview' },
    ...workTabs,
    { id: 'reviews', label: 'Community Reviews' },
    { id: 'related', label: 'Similar' },
  ]
}

export function humanReviewTypes(professions: HumanProfession[], capabilities: HumanCapabilities) {
  const types: Array<'song' | 'album' | 'film' | 'tv' | 'book'> = []
  if (capabilities.discography || professions.includes('artist')) types.push('song', 'album')
  if (capabilities.filmography || professions.some((role) => ['actor', 'director', 'creator'].includes(role))) {
    types.push('film', 'tv')
  }
  if (capabilities.publishedWorks || professions.includes('author')) types.push('book')
  return types
}
