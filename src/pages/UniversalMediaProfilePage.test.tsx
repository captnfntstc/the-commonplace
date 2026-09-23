import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Entry } from '../features/entries/model'
import type { UniversalMediaEntity } from '../types/mediaEntity'
import { reviewMatchesEntity, UniversalMediaProfilePage } from './UniversalMediaProfilePage'

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

const tvEntity: UniversalMediaEntity = {
  id: 'tv:fixture',
  name: 'Fixture Series',
  type: 'tv',
  categoryLabel: 'TV Series',
  artworkUrl: '',
  description: 'A fixture series used to verify season navigation.',
  metadataChips: [{ label: 'Genre', value: 'Drama' }],
  communityRating: {
    average: 0,
    count: 0,
    distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  },
  tvMetadata: {
    source: 'design-review-fixture',
    seasons: [
      {
        id: 101,
        name: 'Season 1',
        seasonNumber: 1,
        episodeCount: 1,
        overview: 'The story begins.',
        episodes: [{
          id: 1001,
          name: 'The Beginning',
          seasonNumber: 1,
          episodeNumber: 1,
          airDate: '2026-01-02',
          runtime: 48,
          overview: 'The first chapter.',
        }],
      },
      {
        id: 102,
        name: 'Season 2',
        seasonNumber: 2,
        episodeCount: 1,
        overview: 'The story continues.',
        episodes: [{
          id: 2001,
          name: 'The Return',
          seasonNumber: 2,
          episodeNumber: 1,
          runtime: 52,
          overview: 'The second chapter.',
        }],
      },
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

const musicEntities: UniversalMediaEntity[] = [
  {
    id: 'album-101',
    name: 'Fixture Album',
    type: 'album',
    categoryLabel: 'Album',
    artworkUrl: '',
    providerId: '101',
    description: '',
    metadataChips: [{ label: 'Artist', value: 'Fixture Artist' }],
    communityRating: { average: 0, count: 0, distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } },
  },
  {
    id: 'song-202',
    name: 'Fixture Song',
    type: 'song',
    categoryLabel: 'Song',
    artworkUrl: '',
    providerId: '202',
    description: '',
    metadataChips: [{ label: 'Artist', value: 'Fixture Artist' }],
    communityRating: { average: 0, count: 0, distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } },
  },
]

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

const directorEntity: UniversalMediaEntity = {
  id: 'director:fixture',
  name: 'Fixture Director',
  type: 'director',
  categoryLabel: 'Director',
  artworkUrl: '',
  description: 'A director fixture.',
  metadataChips: [{ label: 'Profession', value: 'Director' }],
  primaryCollection: {
    title: 'Top Works',
    items: [{
      id: 'collection:film:550',
      rank: 1,
      title: 'Fixture Movie',
      subtitle: 'Drama · 2026',
      artworkUrl: 'https://image.tmdb.org/t/p/w500/fixture-poster.jpg',
      rating: 5,
    }],
  },
  communityRating: {
    average: 5,
    count: 1,
    distribution: { 5: 1, 4: 0, 3: 0, 2: 0, 1: 0 },
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

it('shares reviews between clean and explicit music editions with collaboration credits', () => {
  const explicitAlbum: UniversalMediaEntity = {
    ...musicEntities[0],
    name: 'Fixture Album (Explicit)',
    explicit: true,
    metadataChips: [{ label: 'Artist', value: 'Fixture Artist & Guest Artist' }],
  }
  const cleanReview: Entry = {
    id: 'clean-review', ownerId: 'reader', type: 'album', title: 'Fixture Album (Clean Edition)',
    creator: 'Fixture Artist', provider: 'Apple Music', providerId: 'clean-101', rating: 4,
    favoritePassage: '', reflection: 'Shared with the original release.',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', coverTone: 'gold',
  }

  expect(reviewMatchesEntity(cleanReview, explicitAlbum, explicitAlbum.metadataChips)).toBe(true)
})

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

  it.each(musicEntities)('keeps $type profiles behind a skeleton until provider hydration settles', async (entity) => {
    render(
      <UniversalMediaProfilePage
        entity={entity}
        communityEntries={[]}
        onBack={vi.fn()}
      />,
    )

    expect(screen.getByRole('status', { name: `Loading ${entity.name}` })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: entity.name, level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: `Loading ${entity.name}` })).not.toBeInTheDocument()
  })

  it('shows a skeleton before API hydration, then similar games from the provider', async () => {
    render(
      <UniversalMediaProfilePage
        entity={gameEntity}
        communityEntries={[]}
        onBack={vi.fn()}
      />,
    )

    expect(screen.getByRole('status', { name: 'Loading Source Game' })).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: 'Similar' }))

    expect(screen.getByRole('heading', { name: 'Similar Games' })).toBeInTheDocument()
    const firstSimilarGame = screen.getByRole('button', { name: 'Open Actually Similar Game game profile' })
    expect(firstSimilarGame).toBeInTheDocument()
    expect(firstSimilarGame).toHaveClass('filmography-tile', 'similar-media-tile')
    expect(screen.getAllByRole('button', { name: /game profile$/ })).toHaveLength(4)
    expect(screen.queryByRole('button', { name: 'Open Fifth Similar Game game profile' })).not.toBeInTheDocument()
    expect(screen.queryByText('No similar games available.')).not.toBeInTheDocument()
  })

  it('shows a film cast as clickable cast cards', async () => {
    render(
      <UniversalMediaProfilePage
        entity={movieEntity}
        communityEntries={[]}
        onBack={vi.fn()}
      />,
    )

    expect(screen.queryByRole('heading', { name: 'Cast' })).not.toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: 'Cast' }))

    expect(screen.getByRole('heading', { name: 'Cast' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Mina Vale as Dr. Elian Reyes' })).toHaveClass(
      'filmography-tile',
      'cast-member-tile',
    )
    expect(screen.getByText('Dr. Elian Reyes')).toBeInTheDocument()
  })

  it('shows a series seasons and switches the visible episode list', async () => {
    render(
      <UniversalMediaProfilePage
        entity={tvEntity}
        communityEntries={[]}
        onBack={vi.fn()}
      />,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Seasons' }))

    expect(screen.getByRole('heading', { name: 'Seasons' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show Season 1, 1 episode' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: 'The Beginning' })).toBeInTheDocument()
    expect(screen.getByText('48 min')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Show Season 2, 1 episode' }))

    expect(screen.getByRole('button', { name: 'Show Season 2, 1 episode' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: 'The Return' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'The Beginning' })).not.toBeInTheDocument()
  })

  it('shows similar people on human profiles as circular portraits with names below', async () => {
    render(
      <UniversalMediaProfilePage
        entity={humanEntity}
        communityEntries={[]}
        onBack={vi.fn()}
      />,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Similar' }))

    expect(screen.getByRole('heading', { name: 'Similar People' })).toBeInTheDocument()
    const relatedPerson = screen.getByRole('button', { name: 'Open Related Performer actor profile' })
    expect(relatedPerson).toHaveClass('cast-member-tile', 'similar-person-tile')
    expect(relatedPerson.querySelector('.cast-portrait-frame')).toBeInTheDocument()
    expect(screen.getByText('Related Performer')).toHaveClass('filmography-tile-title')
  })

  it('uses full movie posters for director highlights on overview and Top Movies', async () => {
    const onNavigateToEntity = vi.fn()
    const { container } = render(
      <UniversalMediaProfilePage
        entity={directorEntity}
        communityEntries={[]}
        onBack={vi.fn()}
        onNavigateToEntity={onNavigateToEntity}
      />,
    )

    const overviewMovie = await screen.findByRole('button', { name: 'Open Fixture Movie movie profile' })
    expect(overviewMovie).toHaveClass('poster-media-tile', 'top-movie-poster-tile')
    expect(overviewMovie.querySelector('.poster-media-frame')).toBeInTheDocument()
    expect(overviewMovie.querySelector('img')).toHaveAttribute(
      'src',
      'https://image.tmdb.org/t/p/w500/fixture-poster.jpg',
    )
    expect(container.querySelector('.top-content-row')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Top Movies' }))
    expect(screen.getByRole('button', { name: 'Open Fixture Movie movie profile' })).toHaveClass('top-movie-poster-tile')

    fireEvent.click(screen.getByRole('button', { name: 'Open Fixture Movie movie profile' }))
    expect(onNavigateToEntity).toHaveBeenCalledWith(
      'tmdb:film:550',
      'movie',
      expect.objectContaining({
        name: 'Fixture Movie',
        artworkUrl: 'https://image.tmdb.org/t/p/w500/fixture-poster.jpg',
      }),
    )
  })

  it('ranks reviewed works on artist profiles instead of presenting reviews of the artist', async () => {
    render(
      <UniversalMediaProfilePage
        entity={artistEntity}
        communityEntries={artistWorkEntries}
        onBack={vi.fn()}
      />,
    )

    expect(screen.queryByRole('heading', { name: /Community Reviews/ })).not.toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: /Most Reviewed/ }))

    expect(screen.getByRole('heading', { name: 'Most Reviewed' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open First Song, ranked 1, 2 reviews, 4.5 average rating' })).toBeInTheDocument()
    expect(screen.getByText('#1')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Community Reviews/ })).not.toBeInTheDocument()
  })
})
