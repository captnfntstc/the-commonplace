import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useMasonryLayout } from './useMasonryLayout'

function masonryContainer() {
  const container = document.createElement('section')
  const item = document.createElement('div')
  const card = document.createElement('article')

  item.className = 'masonry-item'
  item.dataset.id = 'entry-1'
  card.className = 'entry-card'
  item.append(card)
  container.append(item)

  Object.defineProperty(container, 'clientWidth', { configurable: true, value: 1200 })
  Object.defineProperty(card, 'offsetHeight', { configurable: true, value: 240 })

  return container
}

describe('useMasonryLayout', () => {
  it('withholds a stale layout while a changed dataset waits to be measured', async () => {
    const frameCallbacks: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frameCallbacks.push(callback)
      return frameCallbacks.length
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})

    const containerRef = { current: masonryContainer() }
    const { result, rerender } = renderHook(
      ({ signal }) => useMasonryLayout(containerRef, 1, '', signal),
      { initialProps: { signal: 'entry-1' } },
    )

    expect(result.current).toBeNull()
    act(() => frameCallbacks.shift()?.(0))
    await waitFor(() => expect(result.current?.positions.has('entry-1')).toBe(true))

    rerender({ signal: 'replacement-entry' })

    expect(result.current).toBeNull()
  })
})
