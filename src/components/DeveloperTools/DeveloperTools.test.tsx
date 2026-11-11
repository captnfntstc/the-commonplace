import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DeveloperToolsModal } from './DeveloperToolsModal'
import { DeveloperToolsDock } from './DeveloperToolsDock'

describe('DeveloperTools', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders DeveloperToolsDock and opens DeveloperToolsModal on click for tcpadmin', () => {
    const onOpen = vi.fn()
    render(<DeveloperToolsDock currentHandle="tcpadmin" onOpen={onOpen} />)

    const dockBtn = screen.getByRole('button', { name: /Open Developer Tools/i })
    expect(dockBtn).toBeDefined()
    fireEvent.click(dockBtn)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('does not render DeveloperToolsDock or Modal for non-admin handles', () => {
    const { container: dockContainer } = render(
      <DeveloperToolsDock currentHandle="randomuser" onOpen={vi.fn()} />
    )
    expect(dockContainer.firstChild).toBeNull()

    const { container: modalContainer } = render(
      <DeveloperToolsModal isOpen={true} onClose={vi.fn()} currentHandle="randomuser" />
    )
    expect(modalContainer.firstChild).toBeNull()
  })

  it('triggers test notifications and release events inside DeveloperToolsModal', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    const onClose = vi.fn()

    render(
      <DeveloperToolsModal
        isOpen={true}
        onClose={onClose}
        currentHandle="tcpadmin"
      />
    )

    expect(screen.getByRole('heading', { name: 'Developer Tools' })).toBeDefined()
    expect(screen.getByText(/Silence & Notification Testing/i)).toBeDefined()

    // Test +1 notification button
    const test1Btn = screen.getByRole('button', { name: /\+1 Test Notification/i })
    fireEvent.click(test1Btn)
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'commonplace:simulate-notification' }))

    // Test Flood 25 button
    const floodBtn = screen.getByRole('button', { name: /Flood 25/i })
    fireEvent.click(floodBtn)
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'commonplace:simulate-notification' }))

    // Close button
    const closeBtn = screen.getByRole('button', { name: 'Close Developer Tools' })
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalled()

    dispatchSpy.mockRestore()
  })
})
