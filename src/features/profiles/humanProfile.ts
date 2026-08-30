import type {
  HumanCapabilities,
  IdentityCandidate,
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
  { profession: 'voice_actor', label: 'Voice Actor', pattern: /\bvoice act(?:or|ress)\b/i },
  { profession: 'singer_songwriter', label: 'Singer-songwriter', pattern: /\bsinger[ -]songwriter\b/i },
  { profession: 'music_producer', label: 'Music Producer', pattern: /\b(?:record|music) producer\b/i },
  { profession: 'singer', label: 'Singer', pattern: /\bsinger\b/i },
  { profession: 'songwriter', label: 'Songwriter', pattern: /\bsongwriter\b/i },
  { profession: 'rapper', label: 'Rapper', pattern: /\brapper\b/i },
  { profession: 'musician', label: 'Musician', pattern: /\bmusician\b/i },
  { profession: 'composer', label: 'Composer', pattern: /\bcomposer\b/i },
  { profession: 'actor', label: 'Actor', pattern: /\bactor\b/i },
  { profession: 'actor', label: 'Actress', pattern: /\bactress\b/i },
  { profession: 'comedian', label: 'Comedian', pattern: /\bcomedian\b/i },
  { profession: 'director', label: 'Film Director', pattern: /\bfilm director\b/i },
  { profession: 'director', label: 'Director', pattern: /\bdirector\b/i },
  { profession: 'producer', label: 'Producer', pattern: /\bproducer\b/i },
  { profession: 'author', label: 'Novelist', pattern: /\bnovelist\b/i },
  { profession: 'novelist', label: 'Novelist', pattern: /\bnovelist\b/i },
  { profession: 'author', label: 'Poet', pattern: /\bpoet\b/i },
  { profession: 'poet', label: 'Poet', pattern: /\bpoet\b/i },
  { profession: 'author', label: 'Author', pattern: /\bauthor\b/i },
  { profession: 'author', label: 'Writer', pattern: /\bwriter\b/i },
  { profession: 'showrunner', label: 'Showrunner', pattern: /\bshowrunner\b/i },
  { profession: 'showrunner', label: 'Television Creator', pattern: /\btelevision creator\b/i },
  { profession: 'screenwriter', label: 'Screenwriter', pattern: /\bscreenwriter\b/i },
]

const legacyHumanTypes = new Set<MediaEntityType>(['artist', 'actor', 'director', 'creator', 'author'])

export function isHumanEntityType(type: MediaEntityType) {
  return type === 'human' || legacyHumanTypes.has(type)
}

export function humanContextFromEntity(entity: UniversalMediaEntity): HumanProfileContext | undefined {
  if (entity.type === 'human') return entity.humanProfile?.primaryProfession || entity.humanProfile?.context || entity.humanProfile?.professions[0]
  if (legacyHumanTypes.has(entity.type)) return entity.type as HumanProfileContext
  return undefined
}

export function professionFromLegacyContext(context?: HumanProfileContext): HumanProfession | undefined {
  if (!context) return undefined
  if (context === 'artist') return 'musician'
  if (context === 'creator') return 'showrunner'
  return context
}

export function professionLabel(profession?: HumanProfileContext) {
  const normalized = professionFromLegacyContext(profession)
  if (!normalized) return 'Human'
  const labels: Record<HumanProfession, string> = {
    musician: 'Musician',
    singer_songwriter: 'Singer-songwriter',
    singer: 'Singer',
    songwriter: 'Songwriter',
    rapper: 'Rapper',
    composer: 'Composer',
    music_producer: 'Music Producer',
    actor: 'Actor',
    voice_actor: 'Voice Actor',
    comedian: 'Comedian',
    director: 'Director',
    producer: 'Producer',
    screenwriter: 'Screenwriter',
    showrunner: 'Showrunner',
    author: 'Author',
    novelist: 'Novelist',
    poet: 'Poet',
  }
  return labels[normalized]
}

export function normalizeHumanProfessions(values: Iterable<HumanProfileContext | undefined>) {
  const unique = new Set<HumanProfession>()
  for (const value of values) {
    const profession = professionFromLegacyContext(value)
    if (profession) unique.add(profession)
  }
  return [...unique]
}

export function isMusicProfession(profession: HumanProfession) {
  return ['musician', 'singer_songwriter', 'singer', 'songwriter', 'rapper', 'composer', 'music_producer'].includes(profession)
}

function normalizedHumanName(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function candidatesShareProviderId(left: IdentityCandidate, right: IdentityCandidate) {
  return Object.entries(left.providerIds).some(([provider, id]) => (
    Boolean(id) && String(right.providerIds[provider as keyof IdentityCandidate['providerIds']] || '').toLowerCase() === String(id).toLowerCase()
  ))
}

function hasComparablePopularity(left: IdentityCandidate, right: IdentityCandidate) {
  const metrics: Array<keyof NonNullable<IdentityCandidate['popularity']>> = ['wikidataSitelinks', 'tmdb']
  return metrics.some((metric) => {
    const leftValue = Number(left.popularity?.[metric] || 0)
    const rightValue = Number(right.popularity?.[metric] || 0)
    if (leftValue <= 0 || rightValue <= 0) return false
    return Math.min(leftValue, rightValue) / Math.max(leftValue, rightValue) >= 0.35
  })
}

export function areHumanIdentitiesComparableForDisambiguation(
  left: IdentityCandidate,
  right: IdentityCandidate,
) {
  return left.kind === right.kind &&
    normalizedHumanName(left.name) === normalizedHumanName(right.name) &&
    hasComparablePopularity(left, right)
}

export function shouldShowHumanDisambiguation(
  current: IdentityCandidate | undefined,
  candidates: IdentityCandidate[],
) {
  if (!current) return false
  const currentName = normalizedHumanName(current.name)
  if (!currentName) return false

  const enrichedCurrent = candidates.find((candidate) => (
    candidate.canonicalId === current.canonicalId || candidatesShareProviderId(candidate, current)
  )) || current

  return candidates.some((candidate) => {
    const isCurrent = candidate.canonicalId === current.canonicalId || candidatesShareProviderId(candidate, current)
    return !isCurrent && areHumanIdentitiesComparableForDisambiguation(enrichedCurrent, candidate)
  })
}

export function isScreenProfession(profession: HumanProfession) {
  return ['actor', 'voice_actor', 'director', 'producer', 'screenwriter', 'showrunner'].includes(profession)
}

export function isWritingProfession(profession: HumanProfession) {
  return ['author', 'novelist', 'poet'].includes(profession)
}

export function canShowHumanBooks(entity: UniversalMediaEntity) {
  const hasAuthorProvider = Boolean(
    entity.identity?.providerIds.openLibraryAuthorId || entity.humanProfile?.providerIds.openLibraryAuthorId,
  )
  if (!hasAuthorProvider) return false
  if (entity.type === 'author') return true
  const primary = entity.humanProfile?.primaryProfession || entity.identity?.primaryProfession
  if (primary && isWritingProfession(primary)) return true
  const professions = entity.humanProfile?.professions || entity.identity?.professions || []
  return professions.some(isWritingProfession)
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

  const fallbackProfession = professionFromLegacyContext(fallback)
  if (professions.length === 0 && fallbackProfession) professions.push(fallbackProfession)
  if (occupationLabels.length === 0 && fallback) {
    occupationLabels.push(professionLabel(fallback))
  }

  return { professions, occupationLabels: occupationLabels.slice(0, 4) }
}

export function canonicalHumanId(ids: HumanProfileMetadata['providerIds'], fallbackId?: string) {
  if (ids.wikidataId) return `human:${ids.wikidataId.toUpperCase()}`
  if (ids.tmdbPersonId) return `human:tmdb:${ids.tmdbPersonId}`
  if (ids.musicBrainzId) return `human:musicbrainz:${ids.musicBrainzId}`
  if (ids.openLibraryAuthorId) return `human:openlibrary:${ids.openLibraryAuthorId.toUpperCase()}`
  if (ids.itunesArtistId) return `human:itunes:${ids.itunesArtistId}`
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
    creating: professions.includes('showrunner'),
    producing: screenCredits.some((credit) => credit.category === 'producing') || professions.some((role) => role === 'producer' || role === 'music_producer'),
    writing: screenCredits.some((credit) => credit.category === 'writing') || professions.some((role) => role === 'screenwriter' || isWritingProfession(role)),
  }
}

export function contextualHumanLabel(
  context: HumanProfileContext | undefined,
  professions: HumanProfession[],
) {
  const requested = professionFromLegacyContext(context)
  const verifiedContext = requested && professions.includes(requested) ? requested : professions[0] || requested
  return professionLabel(verifiedContext)
}

export function getDynamicHumanTabs(options: {
  context?: HumanProfileContext
  capabilities: HumanCapabilities
}) {
  const { capabilities } = options
  const workTabs: Array<{ id: string; label: string }> = []
  if (capabilities.topSongs) {
    workTabs.push({ id: 'top_content', label: 'Top Songs' })
  }
  if (capabilities.discography) {
    workTabs.push({ id: 'discography', label: 'Discography' })
  }
  if (capabilities.filmography) workTabs.push({ id: 'filmography', label: 'Filmography' })
  if (capabilities.publishedWorks) workTabs.push({ id: 'published_works', label: 'Books' })

  return [
    { id: 'overview', label: 'Overview' },
    ...workTabs,
    { id: 'reviews', label: 'Community Reviews' },
    { id: 'related', label: 'Similar' },
  ]
}

export function humanReviewTypes(_professions: HumanProfession[], capabilities: HumanCapabilities) {
  const types: Array<'song' | 'album' | 'film' | 'tv' | 'book'> = []
  if (capabilities.discography) types.push('song', 'album')
  if (capabilities.filmography) {
    types.push('film', 'tv')
  }
  if (capabilities.publishedWorks) types.push('book')
  return types
}
