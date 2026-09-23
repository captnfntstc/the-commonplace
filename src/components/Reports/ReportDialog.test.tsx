import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ReportDialog } from './ReportDialog'

describe('ReportDialog', () => {
  it('collects a profile report reason and optional context', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(
      <ReportDialog
        open
        targetType="profile"
        targetLabel="@unsafe_account"
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    )

    expect(screen.getByRole('radio', { name: 'Impersonation' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Impersonation' }))
    fireEvent.change(screen.getByLabelText(/Additional details/i), {
      target: { value: 'This account is copying another reader.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Submit report' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(
      'impersonation',
      'This account is copying another reader.',
    ))
  })

  it('offers post-specific safety reasons', () => {
    render(
      <ReportDialog
        open
        targetType="post"
        targetLabel="A reported post"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    )

    expect(screen.getByRole('radio', { name: 'Privacy violation or personal information' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Copyright or intellectual property concern' })).toBeInTheDocument()
  })

  it('supports reporting an individual comment', () => {
    render(
      <ReportDialog
        open
        targetType="comment"
        targetLabel="comment by @another_reader"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Report comment' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Harassment or bullying' })).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: 'Copyright or intellectual property concern' })).not.toBeInTheDocument()
  })

  it('asks for a specific reason when Other is selected', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(
      <ReportDialog
        open
        targetType="post"
        targetLabel="A reported post"
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    )

    expect(screen.queryByLabelText('Please specify')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Something else' }))

    const submitButton = screen.getByRole('button', { name: 'Submit report' })
    expect(screen.getByLabelText('Please specify')).toBeInTheDocument()
    expect(submitButton).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Please specify'), {
      target: { value: 'The post contains deliberately false credits.' },
    })
    fireEvent.change(screen.getByLabelText(/Additional details/i), {
      target: { value: 'The creator information was altered.' },
    })
    fireEvent.click(submitButton)

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(
      'other',
      'Other reason: The post contains deliberately false credits.\n\nThe creator information was altered.',
    ))
  })

  it('closes from the header action', () => {
    const onClose = vi.fn()
    render(
      <ReportDialog
        open
        targetType="post"
        targetLabel="A reported post"
        onClose={onClose}
        onSubmit={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Close report dialog' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
