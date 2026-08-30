import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatIdentityBirthday,
  mergeIdentityCandidates,
  normalizeIdentityRoles,
  resolveIdentity,
} from './identities.mjs'

function identity(overrides) {
  return {
    canonicalId: 'human:tmdb:1',
    kind: 'human',
    name: 'Example Person',
    primaryProfession: 'actor',
    professions: ['actor'],
    occupationLabels: ['Actor'],
    description: '',
    portraitUrl: '',
    birthYear: '',
    country: '',
    knownFor: [],
    providerIds: { tmdbPersonId: '1' },
    ...overrides,
  }
}

test('normalizes every supported role instead of selecting only one', () => {
  assert.deepEqual(
    normalizeIdentityRoles(['American voice actor, comedian, musician, director and producer']),
    ['voice_actor', 'musician', 'actor', 'comedian', 'director', 'producer'],
  )
  assert.deepEqual(normalizeIdentityRoles(['screenwriter']), ['screenwriter'])
  assert.deepEqual(normalizeIdentityRoles(['singer-songwriter']), ['singer_songwriter', 'songwriter', 'singer'])
  assert.deepEqual(normalizeIdentityRoles(['general practitioner', 'researcher']), [])
})

test('formats complete birthdays while retaining year-only provider values', () => {
  assert.equal(formatIdentityBirthday('+1989-12-13T00:00:00Z'), 'December 13, 1989')
  assert.equal(formatIdentityBirthday('1989'), '1989')
})

test('keeps same-name humans separate without a shared provider identity', () => {
  const candidates = mergeIdentityCandidates([
    identity({ canonicalId: 'human:tmdb:111', name: 'Tom Kenny', providerIds: { tmdbPersonId: '111' } }),
    identity({
      canonicalId: 'human:musicbrainz:22222222-2222-4222-8222-222222222222',
      name: 'Tom Kenny',
      primaryProfession: 'musician',
      professions: ['musician'],
      providerIds: { musicBrainzId: '22222222-2222-4222-8222-222222222222' },
    }),
  ])

  assert.equal(candidates.length, 2)
  assert.notEqual(candidates[0].canonicalId, candidates[1].canonicalId)
})

test('merges multi-role evidence only when candidates share a verified ID', () => {
  const candidates = mergeIdentityCandidates([
    identity({
      canonicalId: 'human:Q123',
      professions: ['actor'],
      providerIds: { wikidataId: 'Q123', tmdbPersonId: '1' },
    }),
    identity({
      canonicalId: 'human:Q123',
      primaryProfession: 'musician',
      professions: ['musician', 'composer'],
      providerIds: { wikidataId: 'Q123', musicBrainzId: '33333333-3333-4333-8333-333333333333' },
    }),
  ])

  assert.equal(candidates.length, 1)
  assert.deepEqual(candidates[0].professions, ['actor', 'musician', 'composer'])
  assert.equal(candidates[0].providerIds.tmdbPersonId, '1')
  assert.equal(candidates[0].providerIds.musicBrainzId, '33333333-3333-4333-8333-333333333333')
})

test('classifies MusicBrainz Person and Group identities separately', async () => {
  const personId = '11111111-1111-4111-8111-111111111111'
  const groupId = '22222222-2222-4222-8222-222222222222'
  const fetchImpl = async (url) => ({
    ok: true,
    status: 200,
    json: async () => ({
      id: String(url).includes(personId) ? personId : groupId,
      name: String(url).includes(personId) ? 'Solo Artist' : 'Example Band',
      type: String(url).includes(personId) ? 'Person' : 'Group',
      relations: [],
      genres: [],
    }),
  })

  const person = await resolveIdentity('musicbrainz', personId, {}, fetchImpl)
  const group = await resolveIdentity('musicbrainz', groupId, {}, fetchImpl)

  assert.equal(person.identity.kind, 'human')
  assert.match(person.identity.canonicalId, /^human:musicbrainz:/)
  assert.equal(group.identity.kind, 'music_group')
  assert.match(group.identity.canonicalId, /^music-group:musicbrainz:/)
})

test('keeps an Apple artist provider-scoped when Wikidata has no unique match', async () => {
  const fetchImpl = async (url) => {
    const value = String(url)
    if (value.includes('query.wikidata.org')) {
      return { ok: true, status: 200, json: async () => ({ results: { bindings: [] } }) }
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        results: [{
          wrapperType: 'artist',
          artistId: 12345,
          artistName: 'Verified Catalog Artist',
          primaryGenreName: 'Pop',
          country: 'GB',
        }],
      }),
    }
  }

  const result = await resolveIdentity('itunes', '12345', {}, fetchImpl)

  assert.equal(result.identity.canonicalId, 'human:itunes:12345')
  assert.deepEqual(result.identity.professions, ['musician'])
  assert.deepEqual(result.identity.providerIds, { itunesArtistId: '12345' })
})

test('does not force musician onto verified author or poet when Apple/MusicBrainz ID exists', async () => {
  const fetchImpl = async (url) => {
    const value = String(url)
    if (value.includes('query.wikidata.org')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          results: {
            bindings: [{ item: { value: 'http://www.wikidata.org/entity/Q185986' } }],
          },
        }),
      }
    }
    if (value.includes('action=wbgetentities')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          entities: {
            Q185986: {
              id: 'Q185986',
              labels: { en: { value: 'Henry David Thoreau' } },
              descriptions: { en: { value: 'American essayist, poet, and philosopher' } },
              claims: {
                P31: [{ mainsnak: { datavalue: { value: { id: 'Q5' } } } }],
                P106: [{ mainsnak: { datavalue: { value: { id: 'Q36180' } } } }],
                P2850: [{ mainsnak: { datavalue: { value: '123456' } } }],
              },
            },
            Q36180: {
              id: 'Q36180',
              labels: { en: { value: 'writer' } },
            },
          },
        }),
      }
    }
    return { ok: true, status: 200, json: async () => ({}) }
  }

  const result = await resolveIdentity('itunes', '123456', {}, fetchImpl)
  assert.equal(result.identity.name, 'Henry David Thoreau')
  assert.deepEqual(result.identity.professions, ['author', 'poet'])
  assert.ok(!result.identity.professions.includes('musician'), 'Should not contain musician')
})

