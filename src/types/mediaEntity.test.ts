import { describe, expect, it } from 'vitest'
import { getEntityTabs, type MediaEntityType } from './mediaEntity'

describe('related-profile tab labels', () => {
  it('uses Similar for every related tab except song appearances', () => {
    const types: MediaEntityType[] = [
      'human', 'artist', 'album', 'author', 'book', 'movie', 'tv',
      'actor', 'director', 'creator', 'game', 'game_studio',
    ]

    types.forEach((type) => {
      expect(getEntityTabs(type).find((tab) => tab.id === 'related')?.label).toBe('Similar')
    })
    expect(getEntityTabs('song').find((tab) => tab.id === 'related')?.label).toBe('Appears In')
  })
})
