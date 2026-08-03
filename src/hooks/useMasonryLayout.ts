import { useState, useLayoutEffect } from 'react'

const M_GAP = 20
const M_PAD_X = 12
const M_PAD_TOP = 20

function getColumnCount(width: number): number {
  if (width < 640) return 1
  if (width < 960) return 2
  if (width < 1280) return 3
  return 4
}

export type MasonryPos = { left: number; top: number; width: number }
export type MasonryLayout = { positions: Map<string, MasonryPos>; height: number } | null

function getItemTargetHeight(item: HTMLElement, isExpanded: boolean): number {
  const card = item.querySelector('.entry-card') as HTMLElement | null
  if (!card) return item.offsetHeight

  const reflection = card.querySelector('.card-reflection') as HTMLElement | null
  const reflectionInner = card.querySelector('.reflection-inner') as HTMLElement | null

  const currentReflectionH = reflection ? reflection.offsetHeight : 0
  const collapsedH = card.offsetHeight > 0 ? card.offsetHeight - currentReflectionH : item.offsetHeight

  if (isExpanded) {
    const reflectionH = reflectionInner ? reflectionInner.scrollHeight + 4 : 0
    return collapsedH + reflectionH
  }

  return collapsedH
}

export function useMasonryLayout(
  containerRef: React.RefObject<HTMLElement | null>,
  itemCount: number,
  expandedId?: string,
  activeSignal?: any,
): MasonryLayout {
  const [layout, setLayout] = useState<MasonryLayout>(null)

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    let frameId = 0
    const recalculate = () => {
      cancelAnimationFrame(frameId)
      frameId = requestAnimationFrame(() => {
        const items = Array.from(container.children).filter(
          (el) => el.classList.contains('masonry-item'),
        ) as HTMLElement[]
        if (items.length === 0) {
          setLayout(null)
          return
        }

        const w = container.clientWidth
        if (w === 0) return

        const numCols = getColumnCount(w)
        const colWidth = (w - M_PAD_X * 2 - M_GAP * (numCols - 1)) / numCols
        const heights = Array<number>(numCols).fill(M_PAD_TOP)
        const positions = new Map<string, MasonryPos>()

        items.forEach((item) => {
          const id = item.dataset.id
          if (!id) return

          // Shortest-column algorithm: place item in column with lowest height
          let minCol = 0
          let minHeight = heights[0]
          for (let c = 1; c < numCols; c++) {
            if (heights[c] < minHeight) {
              minHeight = heights[c]
              minCol = c
            }
          }

          const isExpanded = id === expandedId
          item.style.width = `${colWidth}px`
          const itemHeight = getItemTargetHeight(item, isExpanded)

          positions.set(id, {
            left: M_PAD_X + minCol * (colWidth + M_GAP),
            top: heights[minCol],
            width: colWidth,
          })
          heights[minCol] += itemHeight + M_GAP
        })

        setLayout({ positions, height: Math.max(...heights) + 60 })
      })
    }

    const ro = new ResizeObserver(recalculate)
    ro.observe(container)

    container.addEventListener('load', recalculate, true)

    recalculate()
    const timer = setTimeout(recalculate, 60)

    return () => {
      ro.disconnect()
      container.removeEventListener('load', recalculate, true)
      cancelAnimationFrame(frameId)
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, itemCount, expandedId, activeSignal])

  return layout
}
