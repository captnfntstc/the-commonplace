import { useState, useLayoutEffect } from 'react'

const M_GAP = 20
const M_PAD_X = 12
const M_PAD_TOP = 20

function getColumnCount(width: number, fourColumnBreakpoint: number): number {
  if (width < 640) return 1
  if (width < 960) return 2
  if (width < fourColumnBreakpoint) return 3
  return 4
}

export type MasonryPos = { left: number; top: number; width: number }
export type MasonryLayout = { positions: Map<string, MasonryPos>; height: number } | null

type MeasuredMasonryLayout = NonNullable<MasonryLayout> & {
  itemCount: number
  activeSignal: unknown
  fourColumnBreakpoint: number
}

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
  activeSignal?: unknown,
  fourColumnBreakpoint = 1280,
): MasonryLayout {
  const [layout, setLayout] = useState<MeasuredMasonryLayout | null>(null)

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

        const numCols = getColumnCount(w, fourColumnBreakpoint)
        const colWidth = (w - M_PAD_X * 2 - M_GAP * (numCols - 1)) / numCols
        const heights = Array<number>(numCols).fill(M_PAD_TOP)
        const positions = new Map<string, MasonryPos>()

        // Apply every width before reading any height. Interleaving a width write
        // with offsetHeight reads forces the browser to recalculate layout once
        // per card and is noticeably sticky on larger feeds.
        items.forEach((item) => {
          item.style.width = `${colWidth}px`
        })

        const itemHeights = items.map((item) => {
          const id = item.dataset.id
          return getItemTargetHeight(item, id === expandedId)
        })

        items.forEach((item, index) => {
          const id = item.dataset.id
          if (!id) return

          // Fixed column assignment: card remains in its column when cards above expand/collapse
          const col = index % numCols
          const itemHeight = itemHeights[index]

          positions.set(id, {
            left: M_PAD_X + col * (colWidth + M_GAP),
            top: heights[col],
            width: colWidth,
          })
          heights[col] += itemHeight + M_GAP
        })

        setLayout({
          positions,
          height: Math.max(...heights) + 60,
          itemCount,
          activeSignal,
          fourColumnBreakpoint,
        })
      })
    }

    const ro = new ResizeObserver(recalculate)
    ro.observe(container)

    container.addEventListener('load', recalculate, true)

    recalculate()
    const settleFrame = setTimeout(recalculate, 120)

    return () => {
      ro.disconnect()
      container.removeEventListener('load', recalculate, true)
      cancelAnimationFrame(frameId)
      clearTimeout(settleFrame)
    }
  }, [containerRef, itemCount, expandedId, activeSignal, fourColumnBreakpoint])

  // A dataset change is committed before its next animation-frame measurement.
  // Suppress coordinates from the previous dataset during that frame so new
  // cards cannot paint full-width and then jump outward into their columns.
  if (
    !layout
    || layout.itemCount !== itemCount
    || !Object.is(layout.activeSignal, activeSignal)
    || layout.fourColumnBreakpoint !== fourColumnBreakpoint
  ) {
    return null
  }

  return layout
}
