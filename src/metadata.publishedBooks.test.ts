import { describe, expect, it } from 'vitest'
import {
  consolidatePublishedBookVariants,
  canonicalAuthoredWorksToCollectionItems,
  isPersonAuthoredBook,
  isPeriodicalPublication,
  isSongbookPublication,
  openLibraryWorksToCollectionItems,
  openLibraryEditionsToCollectionItems,
  publishedBookWorkTitle,
} from './metadata'

function volume(overrides: Record<string, unknown>) {
  return {
    id: 'book-1',
    volumeInfo: {
      title: 'Lover',
      authors: ['Taylor Swift'],
      publisher: 'Example Press',
      ...overrides,
    },
  }
}

describe('isPersonAuthoredBook', () => {
  it('accepts a book genuinely authored by the person', () => {
    expect(isPersonAuthoredBook(volume({}), 'Taylor Swift')).toBe(true)
  })

  it('accepts catalog-style "Last, First" author credits', () => {
    expect(isPersonAuthoredBook(volume({ authors: ['Swift, Taylor'] }), 'Taylor Swift')).toBe(true)
  })

  it('rejects a biography authored by someone else', () => {
    expect(
      isPersonAuthoredBook(
        volume({ title: 'Taylor Swift: A Little Golden Book Biography', authors: ['Wendy Loggia'] }),
        'Taylor Swift',
      ),
    ).toBe(false)
  })

  it('rejects a biography even when Google lists the subject in the author field', () => {
    expect(
      isPersonAuthoredBook(
        volume({ title: 'Taylor Swift: The Unauthorized Biography', authors: ['Chas Newkey-Burden', 'Taylor Swift'] }),
        'Taylor Swift',
      ),
    ).toBe(false)
  })

  it('rejects "story of" / "life of" framed volumes about the person', () => {
    expect(
      isPersonAuthoredBook(
        volume({ title: 'The Story of Taylor Swift', authors: ['Taylor Swift'] }),
        'Taylor Swift',
      ),
    ).toBe(false)
    expect(
      isPersonAuthoredBook(
        volume({ title: 'The Life of Taylor Swift', authors: ['Taylor Swift'] }),
        'Taylor Swift',
      ),
    ).toBe(false)
  })

  it('rejects fan guides and WhoHQ-style titles', () => {
    expect(
      isPersonAuthoredBook(
        volume({ title: 'Who Is Taylor Swift?', authors: ['Kirsten Anderson', 'Taylor Swift'] }),
        'Taylor Swift',
      ),
    ).toBe(false)
    expect(
      isPersonAuthoredBook(
        volume({ title: '100 Facts About Taylor Swift', authors: ['Taylor Swift'] }),
        'Taylor Swift',
      ),
    ).toBe(false)
  })

  it('rejects books without author metadata', () => {
    expect(isPersonAuthoredBook(volume({ authors: [] }), 'Taylor Swift')).toBe(false)
  })

  it('rejects a different author who shares only a first name', () => {
    expect(
      isPersonAuthoredBook(volume({ authors: ['Taylor Jenkins Reid'] }), 'Taylor Swift'),
    ).toBe(false)
  })

  it('rejects artist songbooks and sheet-music formats globally', () => {
    expect(isPersonAuthoredBook(volume({
      title: 'folklore: Easy Piano Songbook',
      authors: ['Taylor Swift'],
    }), 'Taylor Swift')).toBe(false)

    expect(isPersonAuthoredBook(volume({
      title: '30: Piano/Vocal/Guitar',
      authors: ['Adele'],
    }), 'Adele')).toBe(false)

    expect(isSongbookPublication('The Essential Collection', ['Printed Music'])).toBe(true)
  })

  it('does not reject a genuine authored book merely because its category is Music', () => {
    expect(isPersonAuthoredBook(volume({
      title: 'Chronicles: Volume One',
      authors: ['Bob Dylan'],
      categories: ['Music', 'Biography & Autobiography'],
    }), 'Bob Dylan')).toBe(true)
  })

  it('rejects music folios even when their sparse titles omit the word songbook', () => {
    const folios = [
      volume({
        title: 'Taylor Swift - Midnights',
        publisher: 'Hal Leonard Corporation',
        categories: ['Music'],
        description: '(Piano/Vocal/Guitar Artist Songbook).',
      }),
      volume({
        title: "Taylor Swift - Fearless (Taylor's Version)",
        publisher: 'Hal Leonard',
        categories: ['Music'],
      }),
      volume({
        title: 'Taylor Swift - Really Easy Guitar',
        categories: ['Music'],
      }),
      volume({
        title: 'Taylor Swift - Strum & Sing Guitar',
        categories: ['Music'],
      }),
      volume({ title: 'Best of Taylor Swift' }),
      volume({
        title: 'Taylor Swift - Lover by Taylor Swift [spiral-Bound]',
        categories: ['Art'],
      }),
      volume({
        title: 'Taylor Swift',
        publisher: 'Hal Leonard Publishing Corporation',
        categories: ['Country music'],
      }),
    ]

    expect(folios.every((book) => !isPersonAuthoredBook(book, 'Taylor Swift'))).toBe(true)
  })

  it('rejects magazines and periodical records sitewide', () => {
    expect(isPersonAuthoredBook(volume({
      title: 'Taylor Swift Magazine',
      authors: ['Taylor Swift'],
    }), 'Taylor Swift')).toBe(false)
    expect(isPersonAuthoredBook(volume({
      title: "Taylor Swift: Collector's Edition",
      authors: ['Taylor Swift'],
      categories: ['Periodicals'],
    }), 'Taylor Swift')).toBe(false)
    expect(isPeriodicalPublication('Annual Collection', ['Magazine special issue'])).toBe(true)
  })

  it('rejects merchandise and contextless catalog placeholders despite an exact author string', () => {
    expect(isPersonAuthoredBook(volume({
      title: 'Olivia Rodrigo - Notebook and Journal',
      authors: ['Olivia Rodrigo'],
      publisher: undefined,
      description: 'Perfectly lined journal for fan club members.',
    }), 'Olivia Rodrigo')).toBe(false)
    expect(isPersonAuthoredBook(volume({
      title: 'Live from Glastonbury',
      authors: ['Olivia Rodrigo'],
      publisher: undefined,
      industryIdentifiers: [{ type: 'OTHER', identifier: 'OCLC:1550424218' }],
    }), 'Olivia Rodrigo')).toBe(false)
  })
})

describe('published book variant consolidation', () => {
  it('normalizes publisher and author wrappers to the canonical work title', () => {
    expect(publishedBookWorkTitle('Jane Austen: Pride & Prejudice', 'Jane Austen'))
      .toBe('Pride and Prejudice')
    expect(publishedBookWorkTitle('Pride and Prejudice by Jane Austen', 'Jane Austen'))
      .toBe('Pride and Prejudice')
    expect(publishedBookWorkTitle('Pride and Prejudice: Annotated Edition', 'Jane Austen'))
      .toBe('Pride and Prejudice')
  })

  it('merges editions into one work while retaining every provider ID', () => {
    const works = consolidatePublishedBookVariants([
      volume({ title: 'Jane Austen: Pride & Prejudice', authors: ['Jane Austen'], publishedDate: '2025' }),
      { ...volume({ title: 'Pride and Prejudice by Jane Austen', authors: ['Jane Austen'], publishedDate: '2021' }), id: 'book-2' },
      { ...volume({ title: 'Pride and Prejudice', subtitle: 'A Timeless Classic', authors: ['Jane Austen'], publishedDate: '2016' }), id: 'book-3' },
      { ...volume({ title: 'Persuasion', authors: ['Jane Austen'], publishedDate: '2020' }), id: 'book-4' },
    ], 'Jane Austen')

    expect(works).toHaveLength(2)
    const prideAndPrejudice = works.find((work) => work.title === 'Pride and Prejudice')
    expect(prideAndPrejudice?.variantCount).toBe(3)
    expect(prideAndPrejudice?.variantIds).toEqual([
      'googlebooks:book:book-1',
      'googlebooks:book:book-2',
      'googlebooks:book:book-3',
    ])
    expect(prideAndPrejudice?.subtitle).toBe('Jane Austen · Earliest cataloged 2016')
  })

  it('uses one Open Library work with its original publication year', () => {
    const works = openLibraryWorksToCollectionItems([
      {
        key: '/works/OL66554W',
        title: 'Pride and Prejudice',
        author_key: ['OL21594A'],
        author_name: ['Jane Austen'],
        first_publish_year: 1813,
        cover_i: 12345,
        edition_count: 812,
        language: ['eng'],
      },
      {
        key: '/works/OL99999W',
        title: 'Pride and Prejudice: Illustrated Edition',
        author_key: ['OL21594A'],
        author_name: ['Jane Austen'],
        first_publish_year: 2021,
        edition_count: 2,
      },
      {
        key: '/works/OL88888W',
        title: 'Pride & Prejudice',
        author_key: ['OL21594A'],
        author_name: ['Jane Austen'],
        first_publish_year: 1813,
        edition_count: 14,
      },
      {
        key: '/works/OL12345W',
        title: 'Jane Austen: A Biography',
        author_key: ['OL999A'],
        author_name: ['Someone Else'],
        first_publish_year: 1997,
      },
    ], 'Jane Austen', 'OL21594A')

    expect(works).toHaveLength(1)
    expect(works[0]).toMatchObject({
      id: 'openlibrary:book:OL66554W',
      providerId: 'OL66554W',
      title: 'Pride and Prejudice',
      subtitle: 'Jane Austen · First published 1813',
      year: '1813',
      variantCount: 812,
    })
    expect(works[0].artworkUrl).toBe('https://covers.openlibrary.org/b/id/12345-L.jpg')
  })

  it('rejects Open Library works when an author ID is cross-linked to another name', () => {
    const works = openLibraryWorksToCollectionItems([{
      key: '/works/OL999W',
      title: 'Casa de Pensão',
      author_key: ['OL123A'],
      author_name: ['Aluísio Azevedo'],
      first_publish_year: 1884,
    }], 'Taylor Swift', 'OL123A')

    expect(works).toEqual([])
  })

  it('rejects Open Library songbooks even when the artist attribution is exact', () => {
    const works = openLibraryWorksToCollectionItems([{
      key: '/works/OLSONGBOOKW',
      title: 'The Essential Collection',
      author_key: ['OLARTISTA'],
      author_name: ['Example Artist'],
      subject: ['Printed music', 'Piano music, arranged'],
      first_publish_year: 2020,
    }], 'Example Artist', 'OLARTISTA')

    expect(works).toEqual([])
  })

  it('rejects Olivia Rodrigo album folios and Good 4 U conductor scores using publisher context', () => {
    const works = openLibraryWorksToCollectionItems([
      {
        key: '/works/OL25519141W',
        title: 'Olivia Rodrigo - Sour',
        author_key: ['OL9643253A'],
        author_name: ['Olivia Rodrigo'],
        publisher: ['Leonard Corporation, Hal'],
        first_publish_year: 2021,
      },
      {
        key: '/works/OL36091687W',
        title: 'Good 4 U',
        author_key: ['OL9643253A', 'OL13013035A', 'OL13013036A'],
        author_name: ['Olivia Rodrigo', 'Daniel Leonard Nigro', 'Josh Farro'],
        publisher: ['Alfred Music'],
        first_publish_year: 2022,
      },
    ], 'Olivia Rodrigo')

    expect(works).toEqual([])
  })

  it('uses canonical Wikidata works and merges annotated records', () => {
    const works = canonicalAuthoredWorksToCollectionItems([
      { id: 'Q170583', title: 'Pride and Prejudice', publicationDate: '1813-01-28T00:00:00Z' },
      { id: 'Q999', title: 'The Annotated Pride and Prejudice' },
      { id: 'Q333179', title: 'Persuasion', publicationDate: '1817-01-01T00:00:00Z' },
      { id: 'Q123', title: 'Q123', publicationDate: '2020-01-01T00:00:00Z' },
    ], [
      {
        key: '/works/OL66554W', title: 'Pride and Prejudice', author_name: ['Jane Austen'],
        cover_i: 123, edition_count: 4040,
      },
      {
        key: '/works/OL333179W', title: 'Persuasion', author_name: ['Jane Austen'],
        edition_count: 1200,
      },
    ], 'Jane Austen')

    expect(works).toHaveLength(2)
    expect(works.find((work) => work.title === 'Pride and Prejudice')).toMatchObject({
      year: '1813',
      subtitle: 'Jane Austen · First published 1813',
      variantCount: 4040,
    })
    expect(works.find((work) => work.title === 'Persuasion')?.year).toBe('1817')
  })

  it('rejects a Wikidata author claim that another catalog credits to somebody else', () => {
    const works = canonicalAuthoredWorksToCollectionItems([{
      id: 'Q9698317',
      title: 'Casa de Pensão',
      publicationDate: '1884-01-01T00:00:00Z',
    }], [{
      key: '/works/OL123W',
      title: 'Casa de Pensão',
      author_name: ['Aluísio Azevedo'],
      first_publish_year: 1884,
    }], 'Taylor Swift')

    expect(works).toEqual([])
  })

  it('removes songbook-shaped Wikidata works and Open Library-confirmed music folios', () => {
    const works = canonicalAuthoredWorksToCollectionItems([
      { id: 'Q111', title: 'World Tour Songbook' },
      { id: 'Q222', title: 'The Essential Collection' },
      { id: 'Q333', title: 'My Life in Music' },
    ], [{
      key: '/works/OLMUSICW',
      title: 'The Essential Collection',
      author_name: ['Example Artist'],
      subject: ['Vocal scores with piano'],
    }, {
      key: '/works/OLLIFEW',
      title: 'My Life in Music',
      author_name: ['Example Artist'],
    }], 'Example Artist')

    expect(works.map((work) => work.title)).toEqual(['My Life in Music'])
  })

  it('keeps confirmed rereleases and languages inside Editions while removing exact duplicates', () => {
    const editions = openLibraryEditionsToCollectionItems([
      {
        key: '/books/OL1M', title: 'Pride and Prejudice', publish_date: '2003',
        publishers: ['Penguin'], languages: [{ key: '/languages/eng' }],
        isbn_13: ['9780000000001'], covers: [123], physical_format: 'Paperback',
      },
      {
        key: '/books/OL2M', title: 'Orgullo y prejuicio', publish_date: '2018',
        publishers: ['Editorial Example'], languages: [{ key: '/languages/spa' }],
        isbn_13: ['9780000000002'], physical_format: 'Hardcover',
      },
      {
        key: '/books/OL3M', title: 'Pride and Prejudice', publish_date: '2003',
        publishers: ['Penguin'], languages: [{ key: '/languages/eng' }],
        isbn_13: ['9780000000001'],
      },
      { key: '/books/OL4M', title: 'Unverified empty record' },
    ], 'Pride and Prejudice')

    expect(editions).toHaveLength(2)
    expect(editions[0]).toMatchObject({
      title: 'Orgullo y prejuicio',
      subtitle: 'Spanish · Editorial Example · 2018 · Hardcover',
    })
    expect(editions[1].artworkUrl).toBe('https://covers.openlibrary.org/b/id/123-L.jpg')
  })
})
