import { describe, expect, it } from 'vitest'
import {
  generateCollectionGradientSvg,
  getCollectionCoverPalette,
  getGradientCoverStyle,
  getGradientHeroBannerStyle,
} from './collectionCovers'

const items = [
  { type: 'book' },
  { type: 'film' },
  { type: 'album' },
  { type: 'tv' },
  { type: 'game' },
]

describe('collection gradient palette', () => {
  it('derives all four palette colors from the first four items only', () => {
    expect(getCollectionCoverPalette(items)).toEqual({
      c1: '#3b82f6',
      c2: '#fb923c',
      c3: '#fef08a',
      c4: '#34d399',
      cDark: '#0b1938',
    })
  })

  it('keeps every variant and generated cover dependent on all four items', () => {
    const fourColors = ['#3b82f6', '#fb923c', '#fef08a', '#34d399']

    for (const variant of [1, 2, 3, 4] as const) {
      const coverStyle = getGradientCoverStyle(variant, items)
      const heroStyle = getGradientHeroBannerStyle(variant, items)
      const svg = decodeURIComponent(
        generateCollectionGradientSvg('Test Collection', variant, items).replace(
          'data:image/svg+xml;utf8,',
          '',
        ),
      )

      for (const color of fourColors) {
        expect(String(coverStyle.backgroundImage)).toContain(color)
        expect(String(heroStyle.backgroundImage)).toContain(color)
        expect(svg).toContain(color)
      }
    }
  })

  it('falls back to the existing palette when there are no items', () => {
    expect(getCollectionCoverPalette([])).toEqual({
      c1: '#e6b972',
      c2: '#c8a26a',
      c3: '#f59e0b',
      c4: '#92400e',
      cDark: '#14100c',
    })
  })
})
