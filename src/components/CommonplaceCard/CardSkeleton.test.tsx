import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CardSkeletonGrid } from './CardSkeleton'

describe('home card skeleton', () => {
  it('renders a stable eight-card loading grid by default', () => {
    const { container } = render(<CardSkeletonGrid />)

    expect(screen.getByRole('status', { name: 'Loading home entries' })).toBeInTheDocument()
    expect(container.querySelectorAll('.skeleton-card')).toHaveLength(8)
  })

  it('supports the same skeleton layout with a profile-specific loading label', () => {
    render(<CardSkeletonGrid count={4} label="Loading created catalog entries" />)

    expect(screen.getByRole('status', { name: 'Loading created catalog entries' })).toBeInTheDocument()
  })
})
