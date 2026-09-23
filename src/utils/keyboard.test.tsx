import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { handleTabListKeyDown } from './keyboard'

function TabsHarness() {
  const [active, setActive] = useState('one')
  return (
    <div role="tablist" aria-label="Sections" onKeyDown={handleTabListKeyDown}>
      {['one', 'two', 'three'].map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={active === tab}
          tabIndex={active === tab ? 0 : -1}
          onClick={() => setActive(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}

describe('handleTabListKeyDown', () => {
  it('supports arrows, Home, and End with wraparound', () => {
    render(<TabsHarness />)
    const first = screen.getByRole('tab', { name: 'one' })
    first.focus()

    fireEvent.keyDown(first, { key: 'ArrowLeft' })
    expect(screen.getByRole('tab', { name: 'three' })).toHaveFocus()
    expect(screen.getByRole('tab', { name: 'three' })).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Home' })
    expect(first).toHaveFocus()

    fireEvent.keyDown(first, { key: 'End' })
    expect(screen.getByRole('tab', { name: 'three' })).toHaveFocus()
  })
})
