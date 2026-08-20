import { describe, expect, it } from 'vitest'
import { isPersonAuthoredBook } from './metadata'

function volume(overrides: Record<string, unknown>) {
  return {
    id: 'book-1',
    volumeInfo: {
      title: 'Lover',
      authors: ['Taylor Swift'],
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
})