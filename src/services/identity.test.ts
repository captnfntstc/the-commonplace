import { describe, expect, it } from 'vitest'
import { identityToUniversalEntity, providerReferenceFromEntity } from './identity'
import type { IdentityCandidate } from '../types/mediaEntity'

const identity: IdentityCandidate = {
  canonicalId: 'human:Q123',
  kind: 'human',
  name: 'Multi Role Person',
  primaryProfession: 'actor',
  professions: ['actor', 'musician', 'director', 'producer'],
  occupationLabels: ['Actor', 'Musician', 'Film director', 'Producer'],
  description: 'A verified multi-role person.',
  portraitUrl: '',
  knownFor: ['Example Film'],
  providerIds: {
    wikidataId: 'Q123',
    tmdbPersonId: '456',
    musicBrainzId: '11111111-1111-4111-8111-111111111111',
    itunesArtistId: '789',
  },
}

describe('identity client model', () => {
  it('preserves all professions and provider identities on one Human profile', () => {
    const entity = identityToUniversalEntity(identity)

    expect(entity.type).toBe('human')
    expect(entity.humanProfile?.primaryProfession).toBe('actor')
    expect(entity.humanProfile?.professions).toEqual(['actor', 'musician', 'director', 'producer'])
    expect(entity.humanProfile?.providerIds).toEqual(identity.providerIds)
    expect(entity.metadataChips.some((chip) => /professions?/i.test(chip.label))).toBe(false)
  })

  it('resolves provider-scoped related artist references without using the name', () => {
    const entity = identityToUniversalEntity(identity)
    expect(providerReferenceFromEntity(entity)).toEqual({ provider: 'wikidata', id: 'Q123' })
    expect(providerReferenceFromEntity({
      ...entity,
      id: 'musicbrainz:artist:22222222-2222-4222-8222-222222222222',
      identity: undefined,
      humanProfile: undefined,
    })).toEqual({ provider: 'musicbrainz', id: '22222222-2222-4222-8222-222222222222' })
  })

  it('keeps the books catalog available for a verified poet', () => {
    const entity = identityToUniversalEntity({
      ...identity,
      canonicalId: 'human:QPOET',
      primaryProfession: 'poet',
      professions: ['poet'],
      occupationLabels: ['Poet'],
      providerIds: { wikidataId: 'QPOET' },
    })

    expect(entity.humanProfile?.capabilities.publishedWorks).toBe(true)
    expect(entity.humanProfile?.capabilities.writing).toBe(true)
  })

  it('does not expose music catalogs for a verified writer with the same name as music results', () => {
    const entity = identityToUniversalEntity({
      ...identity,
      canonicalId: 'human:Q36322',
      name: 'Jane Austen',
      primaryProfession: 'author',
      professions: ['author', 'novelist'],
      occupationLabels: ['Writer', 'Novelist'],
      providerIds: { wikidataId: 'Q36322', openLibraryAuthorId: 'OL21594A' },
    })

    expect(entity.humanProfile?.capabilities.topSongs).toBe(false)
    expect(entity.humanProfile?.capabilities.discography).toBe(false)
    expect(entity.humanProfile?.capabilities.publishedWorks).toBe(true)
  })
})
