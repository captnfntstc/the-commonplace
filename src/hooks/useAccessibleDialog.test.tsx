import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { useAccessibleDialog } from './useAccessibleDialog'

function DialogHarness() {
  const [open, setOpen] = useState(false)
  const dialogRef = useAccessibleDialog<HTMLDivElement>({
    open,
    onClose: () => setOpen(false),
  })

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open dialog</button>
      {open && (
        <div ref={dialogRef} role="dialog" aria-modal="true" tabIndex={-1}>
          <button type="button">First action</button>
          <button type="button" onClick={() => setOpen(false)}>Close dialog</button>
        </div>
      )}
    </>
  )
}

describe('useAccessibleDialog', () => {
  it('moves focus into the dialog, traps tab navigation, and restores focus', async () => {
    render(<DialogHarness />)
    const trigger = screen.getByRole('button', { name: 'Open dialog' })
    trigger.focus()
    fireEvent.click(trigger)

    const firstAction = await screen.findByRole('button', { name: 'First action' })
    await waitFor(() => expect(firstAction).toHaveFocus())
    expect(document.documentElement.style.overflow).toBe('hidden')
    expect(document.documentElement.style.overscrollBehavior).toBe('none')
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.body.style.overscrollBehavior).toBe('none')

    const closeButton = screen.getByRole('button', { name: 'Close dialog' })
    closeButton.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(firstAction).toHaveFocus()

    fireEvent.click(closeButton)
    await waitFor(() => expect(trigger).toHaveFocus())
    expect(document.documentElement.style.overflow).toBe('')
    expect(document.documentElement.style.overscrollBehavior).toBe('')
    expect(document.body.style.overflow).toBe('')
    expect(document.body.style.overscrollBehavior).toBe('')
  })

  it('closes on Escape', async () => {
    render(<DialogHarness />)
    fireEvent.click(screen.getByRole('button', { name: 'Open dialog' }))
    await screen.findByRole('dialog')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
