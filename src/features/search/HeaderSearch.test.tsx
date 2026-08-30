import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
  it('expands on the first click and activates search on the second click', () => {
    const onOpenChange = vi.fn()
    const { container } = render(
      <HeaderSearch
        open={false} query="" mode="media" mediaResults={[]} mediaLoading={false} resultLimit={6}
        onOpenChange={onOpenChange} onQueryChange={vi.fn()} onModeChange={vi.fn()} onLoadMore={vi.fn()}
        onOpenEntity={vi.fn()} onOpenUser={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(container.querySelector('.alt-search')).toHaveClass('expanded')
    expect(onOpenChange).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('textbox', { name: 'Search' }))
    expect(onOpenChange).toHaveBeenCalledWith(true)
  })

  it('opens and focuses search with the platform keyboard shortcut', () => {
    const onOpenChange = vi.fn()
    render(
      <HeaderSearch
        open={false} query="" mode="media" mediaResults={[]} mediaLoading={false} resultLimit={6}
        onOpenChange={onOpenChange} onQueryChange={vi.fn()} onModeChange={vi.fn()} onLoadMore={vi.fn()}
        onOpenEntity={vi.fn()} onOpenUser={vi.fn()}
      />,
    )

    fireEvent.keyDown(window, { key: 'k', metaKey: true })

    expect(onOpenChange).toHaveBeenCalledWith(true)
    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveAttribute(
      'placeholder',
      'Search media, people, thoughts…',
    )
  })

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

  it('uses a person main profession as the badge without a subtitle', () => {
    const person: HeaderSearchEntity = {
      id: 'human:Q1',
      title: 'Tom Kenny',
      artworkUrl: '',
      type: 'human',
      creatorValue: 'Human',
      bio: 'American voice actor and comedian',
      source: 'universal',
      rank: 0,
      universalEntity: {
        id: 'human:Q1', name: 'Tom Kenny', type: 'human', categoryLabel: 'Voice Actor', artworkUrl: '',
        description: '', metadataChips: [], communityRating: { average: 0, count: 0, distribution: {} },
        identity: {
          canonicalId: 'human:Q1', kind: 'human', name: 'Tom Kenny', primaryProfession: 'voice_actor',
          professions: ['voice_actor', 'actor', 'comedian'], occupationLabels: ['Voice actor', 'Actor', 'Comedian'],
          description: '', portraitUrl: '', knownFor: [], providerIds: { wikidataId: 'Q1' },
        },
      },
    }
    render(
      <HeaderSearch
        open query="Tom Kenny" mode="media" mediaResults={[person]} mediaLoading={false} resultLimit={6}
        onOpenChange={vi.fn()} onQueryChange={vi.fn()} onModeChange={vi.fn()} onLoadMore={vi.fn()}
        onOpenEntity={vi.fn()} onOpenUser={vi.fn()}
      />,
    )

    expect(screen.getByText('Voice Actor')).toBeInTheDocument()
    expect(screen.queryByText('Person')).not.toBeInTheDocument()
    expect(screen.queryByText(/Actor · Comedian/)).not.toBeInTheDocument()
  })
})

describe('recent search functionality', () => {
  const RECENT_KEY = 'the_commonplace_recent_searches_v2'

  beforeEach(() => {
    localStorage.clear()
  })

  it('renders only media recent searches in the Media tab', () => {
    const mockRecent = [
      { id: 'book-1', name: 'Dune', subtitle: 'Frank Herbert', type: 'book', timestamp: Date.now() },
      { id: 'user:elena_r', name: '@elena_r', subtitle: 'Elena Rostova', type: 'user', handle: 'elena_r', timestamp: Date.now() },
    ]
    localStorage.setItem(RECENT_KEY, JSON.stringify(mockRecent))

    render(
      <HeaderSearch
        open
        query=""
        mode="media"
        mediaResults={[]}
        mediaLoading={false}
        resultLimit={6}
        onOpenChange={vi.fn()}
        onQueryChange={vi.fn()}
        onModeChange={vi.fn()}
        onLoadMore={vi.fn()}
        onOpenEntity={vi.fn()}
        onOpenUser={vi.fn()}
      />,
    )

    expect(screen.getByText('Recent Searches')).toBeInTheDocument()
    expect(screen.getByText('Dune')).toBeInTheDocument()
    expect(screen.queryByText('@elena_r')).not.toBeInTheDocument()
  })

  it('renders only user recent searches in the Users tab', () => {
    const mockRecent = [
      { id: 'book-1', name: 'Dune', subtitle: 'Frank Herbert', type: 'book', timestamp: Date.now() },
      { id: 'user:elena_r', name: '@elena_r', subtitle: 'Elena Rostova', type: 'user', handle: 'elena_r', timestamp: Date.now() },
    ]
    localStorage.setItem(RECENT_KEY, JSON.stringify(mockRecent))

    render(
      <HeaderSearch
        open
        query=""
        mode="users"
        mediaResults={[]}
        mediaLoading={false}
        resultLimit={6}
        onOpenChange={vi.fn()}
        onQueryChange={vi.fn()}
        onModeChange={vi.fn()}
        onLoadMore={vi.fn()}
        onOpenEntity={vi.fn()}
        onOpenUser={vi.fn()}
      />,
    )

    expect(screen.getByText('Recent Searches')).toBeInTheDocument()
    expect(screen.getByText('@elena_r')).toBeInTheDocument()
    expect(screen.queryByText('Dune')).not.toBeInTheDocument()
  })

  it('opens a recent entity when clicked', () => {
    const onOpenEntity = vi.fn()
    const mockRecent = [
      { id: 'book-1', name: 'Dune', subtitle: 'Frank Herbert', type: 'book', timestamp: Date.now() },
    ]
    localStorage.setItem(RECENT_KEY, JSON.stringify(mockRecent))

    render(
      <HeaderSearch
        open
        query=""
        mode="media"
        mediaResults={[]}
        mediaLoading={false}
        resultLimit={6}
        onOpenChange={vi.fn()}
        onQueryChange={vi.fn()}
        onModeChange={vi.fn()}
        onLoadMore={vi.fn()}
        onOpenEntity={onOpenEntity}
        onOpenUser={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByText('Dune'))
    expect(onOpenEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'book-1',
        title: 'Dune',
      }),
    )
  })

  it('removes an individual item when X is clicked', () => {
    const mockRecent = [
      { id: 'book-1', name: 'Dune', subtitle: 'Frank Herbert', type: 'book', timestamp: Date.now() },
      { id: 'book-2', name: '1984', subtitle: 'George Orwell', type: 'book', timestamp: Date.now() },
    ]
    localStorage.setItem(RECENT_KEY, JSON.stringify(mockRecent))

    render(
      <HeaderSearch
        open
        query=""
        mode="media"
        mediaResults={[]}
        mediaLoading={false}
        resultLimit={6}
        onOpenChange={vi.fn()}
        onQueryChange={vi.fn()}
        onModeChange={vi.fn()}
        onLoadMore={vi.fn()}
        onOpenEntity={vi.fn()}
        onOpenUser={vi.fn()}
      />,
    )

    expect(screen.getByText('Dune')).toBeInTheDocument()
    expect(screen.getByText('1984')).toBeInTheDocument()

    const removeDuneBtn = screen.getByRole('button', { name: 'Remove Dune from recent searches' })
    fireEvent.click(removeDuneBtn)

    expect(screen.queryByText('Dune')).not.toBeInTheDocument()
    expect(screen.getByText('1984')).toBeInTheDocument()
  })

  it('clears all recent searches when Clear all is clicked', () => {
    const mockRecent = [
      { id: 'book-1', name: 'Dune', subtitle: 'Frank Herbert', type: 'book', timestamp: Date.now() },
      { id: 'book-2', name: '1984', subtitle: 'George Orwell', type: 'book', timestamp: Date.now() },
    ]
    localStorage.setItem(RECENT_KEY, JSON.stringify(mockRecent))

    render(
      <HeaderSearch
        open
        query=""
        mode="media"
        mediaResults={[]}
        mediaLoading={false}
        resultLimit={6}
        onOpenChange={vi.fn()}
        onQueryChange={vi.fn()}
        onModeChange={vi.fn()}
        onLoadMore={vi.fn()}
        onOpenEntity={vi.fn()}
        onOpenUser={vi.fn()}
      />,
    )

    expect(screen.getByText('Recent Searches')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Clear all'))

    expect(screen.queryByText('Recent Searches')).not.toBeInTheDocument()
    expect(screen.queryByText('Dune')).not.toBeInTheDocument()
    expect(screen.queryByText('1984')).not.toBeInTheDocument()
  })
})
