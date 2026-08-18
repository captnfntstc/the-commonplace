import type { Entry, EntryType } from '../entries/model'
import { buildCommunityQuoteRanking, type CommunityQuoteGroup, type QuoteContribution } from './communityQuotes'

export interface MostQuotedWork {
  id: string
  title: string
  creator: string
  type: EntryType
  providerId?: string
  album?: string
  year?: string
  coverUrl?: string
  quoteCount: number
  uniqueContributorCount: number
  topQuote?: CommunityQuoteGroup
  score: number
}

function contributorId(entry: Entry) {
  const handle = entry.authorHandle?.replace(/^@/, '').trim().toLowerCase()
  if (handle) return `handle:${handle}`
  const name = entry.authorName?.trim().toLowerCase()
  return name ? `name:${name}` : `entry:${entry.id}`
}

function workKey(entry: Entry) {
  if (entry.providerId) return `${entry.type}:${entry.providerId}`
  return [entry.type, entry.title, entry.creator, entry.year]
    .map((value) => (value || '').trim().toLowerCase())
    .join(':')
}

function passagesForEntry(entry: Entry) {
  if (!entry.favoritePassage?.trim()) return []
  if (entry.type !== 'song') return [entry.favoritePassage.trim()]
  return entry.favoritePassage.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
}

function albumForSong(entry: Entry) {
  if (entry.type !== 'song') return undefined
  const album = entry.provider?.trim()
  if (!album || /^(?:apple music|itunes|manual|musicbrainz)$/i.test(album)) return undefined
  return album
}

export function buildMostQuotedWorks(entries: Entry[]): MostQuotedWork[] {
  const workGroups = new Map<string, {
    representative: Entry
    contributors: Set<string>
    quotes: QuoteContribution[]
  }>()

  entries.forEach((entry) => {
    const passages = passagesForEntry(entry)
    if (passages.length === 0) return
    const key = workKey(entry)
    const group = workGroups.get(key) || {
      representative: entry,
      contributors: new Set<string>(),
      quotes: [],
    }
    group.contributors.add(contributorId(entry))
    passages.forEach((text, index) => group.quotes.push({
      id: `${entry.id}-work-quote-${index}`,
      text,
      contributorHandle: entry.authorHandle,
      contributorName: entry.authorName,
      createdAt: entry.createdAt,
    }))
    workGroups.set(key, group)
  })

  return Array.from(workGroups.entries())
    .map(([id, group]) => {
      const quoteRanking = buildCommunityQuoteRanking(group.quotes, 1)
      const quoteCount = group.quotes.length
      const uniqueContributorCount = group.contributors.size
      return {
        id,
        title: group.representative.title,
        creator: group.representative.creator,
        type: group.representative.type,
        providerId: group.representative.providerId,
        album: albumForSong(group.representative),
        year: group.representative.year,
        coverUrl: group.representative.coverUrl,
        quoteCount,
        uniqueContributorCount,
        topQuote: quoteRanking.ranked[0],
        score: uniqueContributorCount * 100 + quoteCount,
      }
    })
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
}
