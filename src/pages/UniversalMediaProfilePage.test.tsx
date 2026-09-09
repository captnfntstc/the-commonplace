import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Entry } from '../features/entries/model'
import type { UniversalMediaEntity } from '../types/mediaEntity'
import { UniversalMediaProfilePage } from './UniversalMediaProfilePage'

const gameEntity: UniversalMediaEntity = {
  id: 'game:fixture',
  name: 'Source Game',
  type: 'game',
  categoryLabel: 'Game',
  artworkUrl: '',
  description: 'A fixture game used to verify live related media rendering.',
  metadataChips: [{ label: 'Genre', value: 'Role-playing (RPG)' }],
  gameMetadata: {
    genres: ['Role-playing (RPG)'],
    metadataSource: 'IGDB',
    similarGames: [
      {
        providerId: '42',
        name: 'Actually Similar Game',
        genres: ['Role-playing (RPG)'],
        gameplayTags: ['Single player'],
        description: 'A provider-backed recommendation.',
        releaseDate: '2025-05-01',
        coverUrl: '',
      },
      ...['Second', 'Third', 'Fourth', 'Fifth'].map((position, index) => ({
        providerId: String(43 + index),
        name: `${position} Similar Game`,
        genres: ['Role-playing (RPG)'],
        gameplayTags: ['Single player'],
        description: 'Another provider-backed recommendation.',
        releaseDate: '2025-05-01',
        coverUrl: '',
      })),
    ],
  },
  communityRating: {
    average: 0,
    count: 0,
    distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  },
}

const movieEntity: UniversalMediaEntity = {
  id: 'tmdb:film:100',
  providerId: '100',
  name: 'Fixture Film',
  type: 'movie',
  categoryLabel: 'Film',
  artworkUrl: '',
  description: 'A fixture film used to verify cast rendering.',
  metadataChips: [{ label: 'Genre', value: 'Drama' }],
  communityRating: {
    average: 0,
    count: 0,
    distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  },
  primaryCollection: {
    title: 'Cast',
    items: [
      { id: 'tmdb:person:11', rank: 1, title: 'Mina Vale', subtitle: 'Dr. Elian Reyes', artworkUrl: '' },
      { id: 'tmdb:person:12', rank: 2, title: 'Jon Bell', subtitle: 'Noah Mercer', artworkUrl: '' },
    ],
  },
}

const artistEntity: UniversalMediaEntity = {
  id: 'artist:fixture',
  name: 'The Fixture Artist',
  type: 'artist',
  categoryLabel: 'Artist',
  artworkUrl: '',
  description: 'An artist fixture.',
  metadataChips: [{ label: 'Genre', value: 'Pop' }],
  communityRating: {
    average: 0,
    count: 0,
    distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  },
}

const humanEntity: UniversalMediaEntity = {
  id: 'human:fixture',
  name: 'Fixture Person',
  type: 'human',
  categoryLabel: 'Actor',
  artworkUrl: '',
  description: 'A human fixture.',
  metadataChips: [],
  relatedEntities: {
    title: 'Similar People',
    items: [
      {
        id: 'tmdb:person:22',
        title: 'Related Performer',
        subtitle: 'Actor',
        artworkUrl: '',
        type: 'actor',
      },
    ],
  },
  communityRating: {
    average: 0,
    count: 0,
    distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  },
}

const artistWorkEntries: Entry[] = [
  {
    id: 'entry-song-1', ownerId: 'reader-1', type: 'song', title: 'First Song', creator: 'The Fixture Artist',
    provider: 'First Album', providerId: '501', rating: 5, favoritePassage: 'A line', reflection: 'A reflection',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', coverTone: 'gold',
  },
  {
    id: 'entry-song-2', ownerId: 'reader-2', type: 'song', title: 'First Song', creator: 'The Fixture Artist',
    provider: 'First Album', providerId: '501', rating: 4, favoritePassage: 'Another line', reflection: 'Another reflection',
    createdAt: '2026-01-02T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z', coverTone: 'blue',
  },
  {
    id: 'entry-album-1', ownerId: 'reader-3', type: 'album', title: 'Only Album', creator: 'The Fixture Artist',
    provider: 'Apple Music', providerId: '601', rating: 5, favoritePassage: 'Track three', reflection: 'Album thoughts',
    createdAt: '2026-01-03T00:00:00.000Z', updatedAt: '2026-01-03T00:00:00.000Z', coverTone: 'sage',
  },
]

describe('universal media profile related content', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: vi.fn().mockResolvedValue({}),
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows similar games returned by the live game provider', () => {
    render(
      <UniversalMediaProfilePage
        entity={gameEntity}
        communityEntries={[]}
        onBack={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Similar' }))

    expect(screen.getByRole('heading', { name: 'Similar Games' })).toBeInTheDocument()
    const firstSimilarGame = screen.getByRole('button', { name: 'Open Actually Similar Game game profile' })
    expect(firstSimilarGame).toBeInTheDocument()
    expect(firstSimilarGame).toHaveClass('filmography-tile', 'similar-media-tile')
    expect(screen.getAllByRole('button', { name: /game profile$/ })).toHaveLength(4)
    expect(screen.queryByRole('button', { name: 'Open Fifth Similar Game game profile' })).not.toBeInTheDocument()
    expect(screen.queryByText('No similar games available.')).not.toBeInTheDocument()
  })

  it('shows a film cast as clickable cast cards', () => {
    render(
      <UniversalMediaProfilePage
        entity={movieEntity}
        communityEntries={[]}
        onBack={vi.fn()}
      />,
    )

    expect(screen.queryByRole('heading', { name: 'Cast' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cast' }))

    expect(screen.getByRole('heading', { name: 'Cast' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Mina Vale as Dr. Elian Reyes' })).toHaveClass(
      'filmography-tile',
      'cast-member-tile',
    )
    expect(screen.getByText('Dr. Elian Reyes')).toBeInTheDocument()
  })

  it('shows similar people on human profiles as circular portraits with names below', () => {
    render(
      <UniversalMediaProfilePage
        entity={humanEntity}
        communityEntries={[]}
        onBack={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Similar' }))

    expect(screen.getByRole('heading', { name: 'Similar People' })).toBeInTheDocument()
    const relatedPerson = screen.getByRole('button', { name: 'Open Related Performer actor profile' })
    expect(relatedPerson).toHaveClass('cast-member-tile', 'similar-person-tile')
    expect(relatedPerson.querySelector('.cast-portrait-frame')).toBeInTheDocument()
    expect(screen.getByText('Related Performer')).toHaveClass('filmography-tile-title')
  })

  it('ranks reviewed works on artist profiles instead of presenting reviews of the artist', () => {
    render(
      <UniversalMediaProfilePage
        entity={artistEntity}
        communityEntries={artistWorkEntries}
        onBack={vi.fn()}
      />,
    )

    expect(screen.queryByRole('heading', { name: /Community Reviews/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Most Reviewed/ }))

    expect(screen.getByRole('heading', { name: 'Most Reviewed' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open First Song, ranked 1, 2 reviews, 4.5 average rating' })).toBeInTheDocument()
    expect(screen.getByText('#1')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Community Reviews/ })).not.toBeInTheDocument()
  })
})
