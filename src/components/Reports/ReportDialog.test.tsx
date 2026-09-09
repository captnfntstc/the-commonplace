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

    expect(screen.getByRole('option', { name: 'Impersonation' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'impersonation' } })
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

    expect(screen.getByRole('option', { name: 'Privacy violation or personal information' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Copyright or intellectual property concern' })).toBeInTheDocument()
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
    expect(screen.getByRole('option', { name: 'Harassment or bullying' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Copyright or intellectual property concern' })).not.toBeInTheDocument()
  })
})
