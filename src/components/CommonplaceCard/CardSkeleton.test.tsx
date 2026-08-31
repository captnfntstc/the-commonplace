import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CardSkeletonGrid } from './CardSkeleton'

describe('home card skeleton', () => {
  it('renders a stable eight-card loading grid by default', () => {
    const { container } = render(<CardSkeletonGrid />)

    expect(screen.getByRole('status', { name: 'Loading home entries' })).toBeInTheDocument()
    expect(container.querySelectorAll('.skeleton-card')).toHaveLength(8)
  })
})
