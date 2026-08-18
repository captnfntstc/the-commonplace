import assert from 'node:assert/strict'
import test from 'node:test'
import {
  fetchIgdbGames,
  groupIgdbGames,
  isCostumeOnlyGameContent,
  rankIgdbSearchResults,
} from './igdb.mjs'

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

test('returns sequels, expansions, and DLC while excluding costume content', () => {
  const grouped = groupIgdbGames([{
    id: 100,
    name: 'Example Game',
    first_release_date: 1577836800,
    game_type: { type: 'Main Game' },
    collections: [{
      name: 'Example Series',
      games: [
        { id: 100, name: 'Example Game', first_release_date: 1577836800, game_type: { type: 'Main Game' } },
        { id: 101, name: 'Example Game 2', first_release_date: 1735689600, game_type: { type: 'Main Game' } },
        { id: 106, name: 'Example Game Stories', first_release_date: 1704067200, game_type: { type: 'Main Game' } },
        { id: 99, name: 'Example Origins', first_release_date: 1420070400, game_type: { type: 'Main Game' } },
      ],
    }],
    expansions: [{ id: 102, name: 'Example Game: New Lands', first_release_date: 1609459200 }],
    standalone_expansions: [{ id: 103, name: 'Example Game: Aftermath', first_release_date: 1640995200 }],
    dlcs: [
      { id: 104, name: 'Example Game: Story Pack', first_release_date: 1672531200 },
      { id: 105, name: 'Example Game: Summer Costume Pack', first_release_date: 1672531200 },
    ],
  }])

  assert.deepEqual(
    grouped[0].relatedContent.map(({ name, kind }) => ({ name, kind })),
    [
      { name: 'Example Game: New Lands', kind: 'expansion' },
      { name: 'Example Game: Aftermath', kind: 'expansion' },
      { name: 'Example Game: Story Pack', kind: 'dlc' },
      { name: 'Example Game 2', kind: 'sequel' },
    ],
  )
  assert.equal(isCostumeOnlyGameContent({ name: 'Formal Outfit DLC' }), true)
  assert.equal(isCostumeOnlyGameContent({ name: 'The Adventure Pack' }), false)
})

test('preserves the exact Steam app identity linked by IGDB', () => {
  const grouped = groupIgdbGames([{
    id: 200,
    name: 'Example PC Game',
    websites: [
      { url: 'https://example.com/game' },
      { url: 'https://store.steampowered.com/app/123456/Example_PC_Game/' },
    ],
  }])

  assert.equal(grouped[0].steamAppId, '123456')
})

test('keeps only IGDB similar games that share genre and gameplay tags', () => {
  const grouped = groupIgdbGames([{
    id: 300,
    name: 'Example Role-Playing Game',
    genres: [{ name: 'Role-playing (RPG)' }, { name: 'Adventure' }],
    game_modes: [{ name: 'Single player' }],
    dlcs: [{ id: 303, name: 'Example Story DLC', genres: [{ name: 'Role-playing (RPG)' }] }],
    similar_games: [
      {
        id: 301,
        name: 'Another RPG',
        genres: [{ name: 'Role-playing (RPG)' }, { name: 'Strategy' }],
        game_modes: [{ name: 'Single player' }],
      },
      {
        id: 304,
        name: 'Online RPG',
        genres: [{ name: 'Role-playing (RPG)' }],
        game_modes: [{ name: 'Massively Multiplayer Online (MMO)' }],
      },
      {
        id: 302,
        name: 'Unrelated Racer',
        genres: [{ name: 'Racing' }],
      },
      {
        id: 303,
        name: 'Example Story DLC',
        genres: [{ name: 'Role-playing (RPG)' }],
      },
    ],
  }])

  assert.deepEqual(grouped[0].similarGames.map((game) => game.name), ['Another RPG'])
  assert.deepEqual(grouped[0].similarGames[0].genres, ['Role-playing (RPG)', 'Strategy'])
  assert.deepEqual(grouped[0].similarGames[0].gameplayTags, ['Single player'])
})
