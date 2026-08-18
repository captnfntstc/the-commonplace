import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HeaderSearch } from './HeaderSearch'
import type { HeaderSearchEntity } from './entitySearch'

const mediaResults: HeaderSearchEntity[] = Array.from({ length: 9 }, (_, index) => ({
  id: `book-${index + 1}`,
  title: `Result ${index + 1}`,
  artworkUrl: '',
  type: 'book',
  creatorValue: 'Test Author',
  bio: '',
  source: 'metadata',
  rank: index,
}))

describe('header search result limit', () => {
  it('shows the initial result set followed by Show More', () => {
    const onLoadMore = vi.fn()
    render(
      <HeaderSearch
        open
        query="Result"
        mode="media"
        mediaResults={mediaResults}
        mediaLoading={false}
        resultLimit={6}
        onOpenChange={vi.fn()}
        onQueryChange={vi.fn()}
        onModeChange={vi.fn()}
        onLoadMore={onLoadMore}
        onOpenEntity={vi.fn()}
        onOpenUser={vi.fn()}
      />,
    )

    expect(screen.getByText('Result 6')).toBeInTheDocument()
    expect(screen.queryByText('Result 7')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show More' }))
    expect(onLoadMore).toHaveBeenCalledOnce()
  })
})
