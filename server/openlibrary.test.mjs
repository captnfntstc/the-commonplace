import assert from 'node:assert/strict'
import test from 'node:test'
import {
  fetchOpenLibraryAuthorWorks,
  fetchOpenLibraryWorkEditions,
  fetchWikidataAuthoredWorks,
  handleOpenLibraryApiRequest,
} from './openlibrary.mjs'

test('requests work-level fields using the verified author ID', async () => {
  let requestedUrl = ''
  const result = await fetchOpenLibraryAuthorWorks(
    'Jane Austen',
    '/authors/OL21594A',
    100,
    async (url) => {
      requestedUrl = String(url)
      return {
        ok: true,
        status: 200,
        json: async () => ({
          docs: [{ key: '/works/OL66554W', title: 'Pride and Prejudice', first_publish_year: 1813 }],
        }),
      }
    },
  )

  const url = new URL(requestedUrl)
  assert.equal(url.searchParams.get('q'), 'author_key:OL21594A')
  assert.match(url.searchParams.get('fields'), /first_publish_year/)
  assert.match(url.searchParams.get('fields'), /publisher/)
  assert.match(url.searchParams.get('fields'), /subtitle/)
  assert.equal(result.docs[0].first_publish_year, 1813)
})

test('rejects an empty author request', async () => {
  await assert.rejects(
    fetchOpenLibraryAuthorWorks('', '', 100, async () => assert.fail('fetch should not run')),
    (error) => error.statusCode === 400,
  )
})

test('keeps canonical authored works and excludes unlabeled Wikidata records', async () => {
  const works = await fetchWikidataAuthoredWorks('Q36322', async () => ({
    ok: true,
    json: async () => ({
      results: { bindings: [
        {
          work: { value: 'http://www.wikidata.org/entity/Q170583' },
          workLabel: { value: 'Pride and Prejudice' },
          publication: { value: '1813-01-28T00:00:00Z' },
        },
        {
          work: { value: 'http://www.wikidata.org/entity/Q999' },
          workLabel: { value: 'Q999' },
        },
      ] },
    }),
  }))
  assert.deepEqual(works, [{
    id: 'Q170583',
    title: 'Pride and Prejudice',
    publicationDate: '1813-01-28T00:00:00Z',
    imageUrl: '',
  }])
})

test('handles only the author works API route', async () => {
  assert.equal(await handleOpenLibraryApiRequest('/api/another-route'), undefined)
})

test('loads editions from a verified Open Library work relationship', async () => {
  let requestedUrl = ''
  const result = await fetchOpenLibraryWorkEditions('OL66554W', 50, async (url) => {
    requestedUrl = String(url)
    return {
      ok: true,
      status: 200,
      json: async () => ({
        size: 4040,
        entries: [{ key: '/books/OL1M', title: 'Pride and Prejudice', publish_date: '2003' }],
      }),
    }
  })

  assert.equal(new URL(requestedUrl).pathname, '/works/OL66554W/editions.json')
  assert.equal(new URL(requestedUrl).searchParams.get('limit'), '50')
  assert.equal(result.workId, 'OL66554W')
  assert.equal(result.size, 4040)
})
