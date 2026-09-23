import type { KeyboardEvent } from 'react'

export function handleTabListKeyDown(event: KeyboardEvent<HTMLElement>) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return

  const tabs = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]:not([disabled])'),
  )
  if (tabs.length === 0) return

  const currentIndex = Math.max(0, tabs.indexOf(document.activeElement as HTMLElement))
  let nextIndex: number
  if (event.key === 'Home') nextIndex = 0
  else if (event.key === 'End') nextIndex = tabs.length - 1
  else if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length
  else nextIndex = (currentIndex - 1 + tabs.length) % tabs.length

  event.preventDefault()
  tabs[nextIndex].focus()
  tabs[nextIndex].click()
}
