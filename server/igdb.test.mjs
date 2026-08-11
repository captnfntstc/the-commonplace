import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchIgdbGames, groupIgdbGames, rankIgdbSearchResults } from './igdb.mjs'

test('fails clearly when server-only IGDB credentials are missing', async () => {
  await assert.rejects(
    fetchIgdbGames({ search: 'Resident Evil' }, {}),
    (error) => error instanceof Error && error.statusCode === 503 && /IGDB is not configured/.test(error.message),
  )
})

test('groups ports and remasters, keeps remakes related, and removes cancelled games', () => {
  const original = {
    id: 1,
    name: 'Resident Evil',
    first_release_date: 820454400,
    game_type: { type: 'Main Game' },
    game_status: { status: 'Released' },
    platforms: [{ name: 'PlayStation' }, { name: 'Windows' }],
    release_dates: [
      { date: 820454400, platform: { name: 'PlayStation' } },
      { date: 852076800, platform: { name: 'Windows' } },
    ],
    ports: [{
      id: 2,
      name: 'Resident Evil',
      first_release_date: 1719792000,
      game_type: { type: 'Port' },
      platforms: [{ name: 'Windows' }],
    }],
    remasters: [{
      id: 3,
      name: 'Resident Evil Remastered',
      first_release_date: 1735689600,
      game_type: { type: 'Remaster' },
      platforms: [{ name: 'PlayStation 5' }],
    }],
    remakes: [{ id: 4, name: 'Resident Evil', first_release_date: 1012521600 }],
  }
  const port = { ...original.ports[0], game_status: { status: 'Released' } }
  const remaster = { ...original.remasters[0], game_status: { status: 'Released' } }
  const cancelled = {
    id: 5,
    name: 'Resident Evil Cancelled Project',
    game_status: { status: 'Cancelled' },
  }

  const grouped = groupIgdbGames([original, port, remaster, cancelled])

  assert.equal(grouped.length, 1)
  assert.equal(grouped[0].id, 1)
  assert.deepEqual(grouped[0].platforms.map((release) => release.platform), ['PlayStation', 'Windows'])
  assert.deepEqual(grouped[0].editions.map((edition) => edition.type).sort(), ['Port', 'Remaster'])
  assert.deepEqual(grouped[0].relatedRemakes.map((game) => game.id), [4])
})

test('uses version_parent as the canonical record when only an edition matches', () => {
  const grouped = groupIgdbGames([{
    id: 12,
    name: 'Example Game: Gold Edition',
    version_title: 'Gold Edition',
    game_type: { type: 'Expanded Game' },
    game_status: { status: 'Released' },
    version_parent: {
      id: 10,
      name: 'Example Game',
      first_release_date: 1577836800,
      cover: { image_id: 'example' },
      platforms: [{ name: 'Windows' }],
    },
  }])

  assert.equal(grouped.length, 1)
  assert.equal(grouped[0].id, 10)
  assert.equal(grouped[0].name, 'Example Game')
  assert.deepEqual(grouped[0].editions.map((edition) => edition.name), ['Gold Edition'])
})

test('matches every query token, supports aliases, and sorts equally relevant games by popularity', () => {
  const games = [
    {
      id: 1,
      name: 'Resident Evil Requiem',
      alternativeNames: ['Resident Evil 9'],
      popularityScore: 250,
      editions: [],
    },
    {
      id: 2,
      name: 'Resident Evil Village',
      alternativeNames: [],
      popularityScore: 900,
      editions: [],
    },
    {
      id: 3,
      name: 'Multirotor Sim 2',
      alternativeNames: [],
      popularityScore: 10_000,
      editions: [],
    },
  ]

  assert.deepEqual(rankIgdbSearchResults(games, 'Resident Evil 9').map((game) => game.id), [1])
  assert.deepEqual(rankIgdbSearchResults(games, 'Resident Evil').map((game) => game.id), [2, 1])
  assert.deepEqual(rankIgdbSearchResults(games, 'Resident Evil Requiem').map((game) => game.id), [1])
  assert.deepEqual(rankIgdbSearchResults(games, 'resident evil req').map((game) => game.id), [1])
  assert.deepEqual(rankIgdbSearchResults(games, 'resident req').map((game) => game.id), [1])
})

test('supports prefix token matching on aliases when primary title is localized', () => {
  const games = [
    {
      id: 10,
      name: 'Biohazard Requiem',
      alternativeNames: ['Resident Evil Requiem', 'Resident Evil 9'],
      popularityScore: 500,
      editions: [],
    },
  ]

  assert.deepEqual(rankIgdbSearchResults(games, 'resident evil req').map((game) => game.id), [10])
})

