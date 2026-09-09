import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canViewFeedCandidate,
  decayFeedPreferences,
  decodeFeedCursor,
  feedInternals,
  handleFeedApiRequest,
  rankFeedEntries,
  scoreFeedEntry,
} from './feed.mjs'

const now = Date.parse('2026-09-07T00:00:00.000Z')
const preferences = {
  typeWeights: { book: 10, film: 5 },
  genreWeights: { fantasy: 10 },
  creatorWeights: { 'ursula le guin': 10 },
  signalCount: 8,
  updatedAt: new Date(now).toISOString(),
}

function entry(id, ownerId, type = 'book', overrides = {}) {
  return {
    id,
    ownerId,
    type,
    title: id,
    creator: 'Ursula Le Guin',
    genre: 'Fantasy',
    createdAt: '2026-09-06T00:00:00.000Z',
    ...overrides,
  }
}

test('feed preferences lose half their weight after ninety days', () => {
  const decayed = decayFeedPreferences({
    ...preferences,
    updatedAt: new Date(now - 90 * 86_400_000).toISOString(),
  }, now)
  assert.equal(Math.round(decayed.typeWeights.book * 10) / 10, 5)
})

test('ranking rewards follows, ownership, and matching interests', () => {
  const context = { viewerId: 'viewer', followedIds: new Set(['followed']), preferences }
  const followedScore = scoreFeedEntry(entry('followed', 'followed'), context, now)
  const unrelatedScore = scoreFeedEntry(entry('unrelated', 'other', 'game', {
    creator: 'Someone Else',
    genre: 'Action',
  }), context, now)
  const ownScore = scoreFeedEntry(entry('own', 'viewer'), context, now)
  assert.ok(followedScore > unrelatedScore)
  assert.ok(ownScore > unrelatedScore)
})

test('cold-start ranking ignores affinities until five signals exist', () => {
  const coldPreferences = { ...preferences, signalCount: 4 }
  const context = { viewerId: 'viewer', followedIds: new Set(), preferences: coldPreferences }
  const matching = scoreFeedEntry(entry('same-id', 'author', 'book'), context, now)
  const unrelated = scoreFeedEntry(entry('same-id', 'author', 'game', {
    creator: 'Someone Else',
    genre: 'Action',
  }), context, now)
  assert.equal(matching, unrelated)
})

test('genre affinity recognizes individual genres in comma-separated entry metadata', () => {
  const context = { viewerId: 'viewer', followedIds: new Set(), preferences }
  const matching = scoreFeedEntry(entry('same-id', 'author', 'game', {
    creator: 'Someone Else',
    genre: 'Science Fiction, Fantasy',
  }), context, now)
  const unrelated = scoreFeedEntry(entry('same-id', 'author', 'game', {
    creator: 'Someone Else',
    genre: 'Science Fiction, Adventure',
  }), context, now)
  assert.ok(matching > unrelated)
})

test('ranking prevents three consecutive matching authors and types', () => {
  const context = { viewerId: 'viewer', followedIds: new Set(), preferences }
  const ranked = rankFeedEntries([
    entry('a1', 'author-a'),
    entry('a2', 'author-a'),
    entry('a3', 'author-a'),
    entry('b1', 'author-b', 'film'),
  ], context, 'all', now).items
  assert.notDeepEqual(ranked.slice(0, 3).map((item) => item.ownerId), ['author-a', 'author-a', 'author-a'])
  assert.notDeepEqual(ranked.slice(0, 3).map((item) => item.type), ['book', 'book', 'book'])
})

test('ranking is deterministic for the same viewer and day', () => {
  const context = { viewerId: 'viewer', followedIds: new Set(), preferences }
  const candidates = [entry('one', 'a'), entry('two', 'b'), entry('three', 'c')]
  assert.deepEqual(
    rankFeedEntries(candidates, context, 'all', now).items.map((item) => item.id),
    rankFeedEntries(candidates, context, 'all', now).items.map((item) => item.id),
  )
})

test('signals validate bounded supported media data', () => {
  assert.deepEqual(feedInternals.validateSignal({
    action: 'save',
    active: false,
    subject: { type: 'book', creator: ' Author ', genres: [' Fantasy '] },
  }), {
    action: 'save',
    direction: -1,
    subject: { type: 'book', creator: 'author', genres: ['fantasy'] },
  })
  assert.throws(() => feedInternals.validateSignal({ action: 'open', subject: { type: 'podcast' } }))
})

test('invalid or category-mismatched cursors are rejected', () => {
  assert.throws(() => decodeFeedCursor('not-a-cursor', 'all'), /Invalid feed cursor/)
  const mismatched = Buffer.from(JSON.stringify({
    v: 1,
    category: 'book',
    createdAt: '2026-09-01T00:00:00.000Z',
    path: 'users/a/entries/b',
  })).toString('base64url')
  assert.throws(() => decodeFeedCursor(mismatched, 'film'), /Invalid feed cursor/)
})

test('private entries require mutual following while own and public entries remain visible', () => {
  const mutualIds = new Set(['mutual-author'])
  assert.equal(canViewFeedCandidate({ isPrivate: false }, 'public-author', 'viewer', mutualIds, now), true)
  assert.equal(canViewFeedCandidate({ isPrivate: true }, 'viewer', 'viewer', mutualIds, now), true)
  assert.equal(canViewFeedCandidate({ isPrivate: true }, 'mutual-author', 'viewer', mutualIds, now), true)
  assert.equal(canViewFeedCandidate({ isPrivate: true }, 'one-way-author', 'viewer', mutualIds, now), false)
  assert.equal(canViewFeedCandidate({
    isPrivate: false,
    accountStatus: 'deactivated',
    reactivatesAt: null,
  }, 'deactivated-author', 'viewer', mutualIds, now), false)
})

test('feed API requires authentication and validates categories', async () => {
  await assert.rejects(
    () => handleFeedApiRequest({ url: '/api/feed', method: 'GET', headers: {} }, {}, {}),
    (error) => error.statusCode === 401,
  )
  const services = {
    adminAuth: { verifyIdToken: async () => ({ uid: 'viewer' }) },
    adminDb: {},
  }
  await assert.rejects(
    () => handleFeedApiRequest({
      url: '/api/feed?category=podcast',
      method: 'GET',
      headers: { authorization: 'Bearer valid' },
    }, {}, services),
    (error) => error.statusCode === 400,
  )
})

test('preference reset is account-scoped and service failures return 503', async () => {
  let deletedPath = ''
  const document = {
    collection(name) {
      deletedPath += `/${name}`
      return this
    },
    doc(name) {
      deletedPath += `/${name}`
      return this
    },
    async delete() {
      deletedPath += '/deleted'
    },
  }
  const request = {
    url: '/api/feed/preferences',
    method: 'DELETE',
    headers: { authorization: 'Bearer valid' },
  }
  const payload = await handleFeedApiRequest(request, {}, {
    adminAuth: { verifyIdToken: async () => ({ uid: 'viewer' }) },
    adminDb: document,
  })
  assert.deepEqual(payload, { reset: true })
  assert.equal(deletedPath, '/users/viewer/private/feed-preferences/deleted')

  await assert.rejects(
    () => handleFeedApiRequest(request, {}, {
      adminAuth: { verifyIdToken: async () => ({ uid: 'viewer' }) },
      adminDb: { ...document, delete: async () => { throw new Error('offline') } },
    }),
    (error) => error.statusCode === 503,
  )
})
