import type { MetadataChip, MediaEntityType } from '../../types/mediaEntity'
import type { CollectionItem } from '../../types/mediaEntity'

type HumanEntityType = Extract<MediaEntityType, 'artist' | 'author' | 'director' | 'creator' | 'actor'>

const nationalityPattern = /\b(American|Argentine|Australian|Belgian|Brazilian|British|Canadian|Chinese|Colombian|Danish|Dutch|English|Filipino|Finnish|French|German|Greek|Indian|Indonesian|Irish|Italian|Japanese|Korean|Mexican|New Zealand|Nigerian|Norwegian|Polish|Portuguese|Russian|Scottish|South African|Spanish|Swedish|Swiss|Thai|Turkish|Ukrainian|Vietnamese|Welsh)(?:-([A-Za-z]+))?\b/i

export function getDominantCatalogGenre(items: CollectionItem[]) {
  const genres = new Map<string, { label: string; count: number; firstIndex: number }>()
  items.forEach((item, index) => {
    const label = item.genre?.trim()
    if (!label || /^(?:music|unknown)$/i.test(label)) return
    const key = label.toLowerCase()
    const current = genres.get(key)
    genres.set(key, {
      label: current?.label || label,
      count: (current?.count || 0) + 1,
      firstIndex: current?.firstIndex ?? index,
    })
  })

  return [...genres.values()]
    .sort((left, right) => right.count - left.count || left.firstIndex - right.firstIndex)[0]?.label
}

function professionFromBiography(type: HumanEntityType, description: string, fallback: string) {
  const intro = description.slice(0, 320)
  const rules: Partial<Record<HumanEntityType, Array<[RegExp, string]>>> = {
    artist: [
      [/\bband\b/i, 'Band'],
      [/\bduo\b/i, 'Duo'],
      [/\bgroup\b/i, 'Group'],
      [/\bsinger-songwriter\b/i, 'Singer-songwriter'],
      [/\brapper\b/i, 'Rapper'],
      [/\bsinger\b/i, 'Singer'],
      [/\bmusician\b/i, 'Musician'],
    ],
    author: [
      [/\bnovelist\b/i, 'Novelist'],
      [/\bpoet\b/i, 'Poet'],
      [/\bwriter\b/i, 'Writer'],
      [/\bauthor\b/i, 'Author'],
    ],
    director: [
      [/\bfilmmaker\b/i, 'Filmmaker'],
      [/\bfilm director\b/i, 'Film Director'],
      [/\bdirector\b/i, 'Director'],
    ],
    creator: [
      [/\btelevision producer\b/i, 'Television Producer'],
      [/\bscreenwriter\b/i, 'Screenwriter'],
      [/\bproducer\b/i, 'Producer'],
      [/\bcreator\b/i, 'Creator'],
    ],
    actor: [
      [/\bactress\b/i, 'Actress'],
      [/\bactor\b/i, 'Actor'],
    ],
  }

  return rules[type]?.find(([pattern]) => pattern.test(intro))?.[1] || fallback
}

export function buildHumanMetadata(options: {
  type: HumanEntityType
  description: string
  fallbackProfession: string
  catalogGenre?: string
}): MetadataChip[] {
  const { type, description, fallbackProfession, catalogGenre } = options
  const chips: MetadataChip[] = [
    { label: 'Profession', value: professionFromBiography(type, description, fallbackProfession) },
  ]

  if (catalogGenre && !/^(book|genre match)$/i.test(catalogGenre.trim())) {
    chips.push({ label: 'Genre', value: catalogGenre.trim() })
  }

  const formedMatch = description.match(/\b(?:formed|founded|established)\b[^.]{0,90}?\b((?:18|19|20)\d{2})\b/i)
  const originMatch = description.match(/\b(?:formed|founded|established)\s+in\s+([^,.]+?)(?:\s+in\s+(?:18|19|20)\d{2}\b|[,.])/i)
  const nationalityMatch = description.match(nationalityPattern)
  const bornMatch = description.match(/\bborn\b[^.]{0,70}?\b((?:18|19|20)\d{2})\b/i)

  if (originMatch?.[1]) {
    chips.push({ label: 'Origin', value: originMatch[1].trim() })
  } else if (nationalityMatch?.[1]) {
    const nationality = [nationalityMatch[1], nationalityMatch[2]].filter(Boolean).join('-')
    chips.push({ label: type === 'artist' && /\b(?:band|duo|group)\b/i.test(description) ? 'Origin' : 'Nationality', value: nationality })
  }

  if (formedMatch?.[1]) chips.push({ label: 'Formed', value: formedMatch[1] })
  else if (bornMatch?.[1]) chips.push({ label: 'Born', value: bornMatch[1] })

  return chips.slice(0, 4)
}
