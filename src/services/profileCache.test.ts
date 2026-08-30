import { describe, expect, it } from 'vitest'
import { identityToUniversalEntity } from './identity'
import { repairCachedProfileEntity } from './profileCache'

describe('cached human profile repair', () => {
  it('removes name-matched music catalogs from a verified author record', () => {
    const author = identityToUniversalEntity({
      canonicalId: 'human:Q36322',
      kind: 'human',
      name: 'Jane Austen',
      primaryProfession: 'author',
      professions: ['author', 'novelist'],
      occupationLabels: ['Writer', 'Novelist'],
      description: 'English novelist',
      portraitUrl: '',
      knownFor: ['Pride and Prejudice'],
      providerIds: { wikidataId: 'Q36322', openLibraryAuthorId: 'OL21594A' },
    })

    const polluted = {
      ...author,
      categoryLabel: 'Musician',
      humanProfile: {
        ...author.humanProfile!,
        context: 'artist' as const,
        primaryProfession: 'musician' as const,
        professions: ['musician' as const],
        providerIds: { ...author.humanProfile!.providerIds, itunesArtistId: 'wrong-name-match' },
        capabilities: {
          ...author.humanProfile!.capabilities,
          topSongs: true,
          discography: true,
        },
      },
    }

    const repaired = repairCachedProfileEntity(polluted)
    expect(repaired.categoryLabel).toBe('Author')
    expect(repaired.humanProfile?.professions).toEqual(['author', 'novelist'])
    expect(repaired.humanProfile?.capabilities.topSongs).toBe(false)
    expect(repaired.humanProfile?.capabilities.discography).toBe(false)
    expect(repaired.humanProfile?.capabilities.publishedWorks).toBe(true)
  })
})
