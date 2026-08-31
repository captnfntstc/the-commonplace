import { beforeEach, describe, expect, it } from 'vitest'
import {
  isLegacySeedCollection,
  isLegacySeedEntry,
  purgeLegacySeedStorage,
  removeLegacySeedEntryIds,
  removeLegacySeedHandles,
} from './legacySeedCleanup'

describe('legacy demo cleanup', () => {
  beforeEach(() => localStorage.clear())

  it('removes only known demo identities and content', () => {
    expect(removeLegacySeedHandles(['elena_r', 'real_reader'])).toEqual(['real_reader'])
    expect(removeLegacySeedEntryIds(['ext-marcus-film-1', 'entry-real'])).toEqual(['entry-real'])
    expect(isLegacySeedEntry({ id: 'entry-any', authorHandle: 'aria_s' })).toBe(true)
    expect(isLegacySeedEntry({ id: 'entry-real', authorHandle: 'real_reader' })).toBe(false)
    expect(isLegacySeedCollection({ id: 'collection-elena_r-highlights' })).toBe(true)
  })

  it('clears legacy profile collection stores without touching real accounts', () => {
    localStorage.setItem('the-commonplace.profile-collections.v1:elena_r', '[]')
    localStorage.setItem('the-commonplace.profile-collections.v1:real_reader', '[]')
    localStorage.setItem('the-commonplace.following-users', JSON.stringify(['elena_r', 'real_reader']))

    purgeLegacySeedStorage()

    expect(localStorage.getItem('the-commonplace.profile-collections.v1:elena_r')).toBeNull()
    expect(localStorage.getItem('the-commonplace.profile-collections.v1:real_reader')).toBe('[]')
    expect(JSON.parse(localStorage.getItem('the-commonplace.following-users') || '[]')).toEqual(['real_reader'])
  })
})
