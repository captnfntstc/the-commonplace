import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as metadata from '../metadata'
import type { Entry } from '../features/entries/model'
import type { UniversalMediaEntity } from '../types/mediaEntity'
import { EntityLoadingSkeleton } from '../components/PageLoadingSkeleton'
import { renderInlineTitleWithExplicit, reviewMatchesEntity, UniversalMediaProfilePage } from './UniversalMediaProfilePage'

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

it('does not bleed solo song reviews onto duet collaborations or remix versions', () => {
  const soloSongReview: Entry = {
    id: 'solo-review',
    ownerId: 'reader',
    type: 'song',
    title: 'expectations',
    creator: 'Olivia Rodrigo',
    provider: 'you seem pretty sad for a girl so in love',
    providerId: '1889992129',
    rating: 5,
    favoritePassage: 'Notable line',
    reflection: 'Solo reflection',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    coverTone: 'rose',
  }

  const duetSongEntity: UniversalMediaEntity = {
    id: 'song-6822390426',
    name: 'expectations',
    type: 'song',
    categoryLabel: 'Song',
    artworkUrl: '',
    description: '',
    metadataChips: [
      { label: 'Artist', value: 'Olivia Rodrigo & Chappell Roan' },
      { label: 'Album', value: 'expectations - Single' },
    ],
    communityRating: { average: 0, count: 0, distribution: {} },
  }

  const remixSongEntity: UniversalMediaEntity = {
    id: 'song-remix-1',
    name: 'expectations (Remix)',
    type: 'song',
    categoryLabel: 'Song',
    artworkUrl: '',
    description: '',
    metadataChips: [
      { label: 'Artist', value: 'Olivia Rodrigo' },
      { label: 'Album', value: 'expectations (Remixes) - EP' },
    ],
    communityRating: { average: 0, count: 0, distribution: {} },
  }

  const cleanSongReview: Entry = {
    ...soloSongReview,
    id: 'clean-song-review',
    title: 'expectations (Clean)',
  }

  const explicitSongEntity: UniversalMediaEntity = {
    id: 'song-explicit-1',
    name: 'expectations (Explicit)',
    type: 'song',
    categoryLabel: 'Song',
    artworkUrl: '',
    description: '',
    metadataChips: [
      { label: 'Artist', value: 'Olivia Rodrigo' },
      { label: 'Album', value: 'you seem pretty sad for a girl so in love' },
    ],
    communityRating: { average: 0, count: 0, distribution: {} },
  }

  // Solo review must NOT match the duet with Chappell Roan
  expect(reviewMatchesEntity(soloSongReview, duetSongEntity, duetSongEntity.metadataChips)).toBe(false)

  // Standard review must NOT match the remix version
  expect(reviewMatchesEntity(soloSongReview, remixSongEntity, remixSongEntity.metadataChips)).toBe(false)

  // Clean and explicit editions of the same solo recording DO match
  expect(reviewMatchesEntity(cleanSongReview, explicitSongEntity, explicitSongEntity.metadataChips)).toBe(true)
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

  it('renders NotFoundPage and calls onNotFound if the artist or media does not exist', async () => {
    const onNotFound = vi.fn()
    const nonexistentArtist: UniversalMediaEntity = {
      id: 'artist:nonexistent-user',
      name: 'Nonexistent User',
      type: 'artist',
      categoryLabel: 'Artist',
      artworkUrl: '',
      description: '',
      metadataChips: [{ label: 'Profession', value: 'Artist' }],
      communityRating: {
        average: 0,
        count: 0,
        distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      },
    }

    render(
      <UniversalMediaProfilePage
        entity={nonexistentArtist}
        communityEntries={[]}
        onBack={vi.fn()}
        onNotFound={onNotFound}
      />,
    )

    expect(await screen.findByRole('heading', { name: 'This page slipped between the margins.' })).toBeInTheDocument()
    expect(screen.getByText('404')).toBeInTheDocument()
    await waitFor(() => expect(onNotFound).toHaveBeenCalled())
  })

  it('renders spotlight profile layout with backdrop and container category badge', async () => {
    const songEntity: UniversalMediaEntity = {
      id: 'song:fixture-spotlight',
      name: 'Spotlight Song',
      type: 'song',
      categoryLabel: 'Song',
      artworkUrl: 'https://example.com/artwork.jpg',
      providerId: '999',
      explicit: false,
      description: 'Song description',
      metadataChips: [
        { label: 'Artist', value: 'Fixture Artist' },
        { label: 'Track #', value: '#4' },
      ],
      communityRating: { average: 4, count: 1, distribution: { 5: 0, 4: 1, 3: 0, 2: 0, 1: 0 } },
    }

    const { container } = render(
      <UniversalMediaProfilePage
        entity={songEntity}
        communityEntries={[]}
        onBack={vi.fn()}
      />,
    )

    await screen.findByRole('heading', { name: 'Spotlight Song', level: 1 })
    expect(container.querySelector('.universal-media-profile-page.is-spotlight-profile')).toBeInTheDocument()
    expect(container.querySelector('.media-hero-backdrop')).toBeInTheDocument()
    expect(container.querySelector('.media-container-category-badge')).toBeInTheDocument()
    expect(container.querySelector('.media-hero-track-eyebrow')).toHaveTextContent('TRACK 4')
  })

  it('renders explicit badge on the left before the title with the first word for explicit songs', async () => {
    const explicitSong: UniversalMediaEntity = {
      id: 'song:fixture-explicit',
      name: 'you seem pretty sad for a girl so in love',
      type: 'song',
      categoryLabel: 'Song',
      artworkUrl: 'https://example.com/artwork.jpg',
      providerId: '999',
      explicit: true,
      description: 'Song description',
      metadataChips: [
        { label: 'Artist', value: 'Fixture Artist' },
        { label: 'Explicit', value: 'Yes' },
      ],
      communityRating: { average: 4, count: 1, distribution: { 5: 0, 4: 1, 3: 0, 2: 0, 1: 0 } },
    }

    const { container } = render(
      <UniversalMediaProfilePage
        entity={explicitSong}
        communityEntries={[]}
        onBack={vi.fn()}
      />,
    )

    const heading = await screen.findByRole('heading', {
      name: 'you seem pretty sad for a girl so in love',
      level: 1,
    })
    expect(heading).toBeInTheDocument()

    const affixGroup = container.querySelector('.media-hero-title-affix-group.is-left')
    expect(affixGroup).toBeInTheDocument()
    expect(affixGroup?.textContent).toContain('you')
    expect(affixGroup?.textContent).toContain('E')

    const badge = affixGroup?.querySelector('.explicit-badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders explicit badge on the left before the title for explicit albums', async () => {
    const explicitAlbum: UniversalMediaEntity = {
      id: 'album:fixture-explicit',
      name: 'you seem pretty sad for a girl so in love',
      type: 'album',
      categoryLabel: 'Album',
      artworkUrl: 'https://example.com/artwork.jpg',
      providerId: '888',
      explicit: true,
      description: 'Album description',
      metadataChips: [
        { label: 'Artist', value: 'Fixture Artist' },
        { label: 'Explicit', value: 'Yes' },
      ],
      communityRating: { average: 5, count: 1, distribution: { 5: 1, 4: 0, 3: 0, 2: 0, 1: 0 } },
    }

    const { container } = render(
      <UniversalMediaProfilePage
        entity={explicitAlbum}
        communityEntries={[]}
        onBack={vi.fn()}
      />,
    )

    const heading = await screen.findByRole('heading', {
      name: 'you seem pretty sad for a girl so in love',
      level: 1,
    })
    expect(heading).toBeInTheDocument()

    const affixGroup = container.querySelector('.media-hero-title-affix-group.is-left')
    expect(affixGroup).toBeInTheDocument()
    expect(affixGroup?.textContent).toContain('you')
    expect(affixGroup?.textContent).toContain('E')
  })

  it('renders primary Write an entry, Add to collection, and Share action buttons', async () => {
    const songEntity: UniversalMediaEntity = {
      id: 'song:fixture-actions',
      name: 'Action Song',
      type: 'song',
      categoryLabel: 'Song',
      artworkUrl: 'https://example.com/artwork.jpg',
      providerId: '777',
      explicit: false,
      description: 'Song description',
      metadataChips: [{ label: 'Artist', value: 'Fixture Artist' }],
      communityRating: { average: 4, count: 1, distribution: { 5: 0, 4: 1, 3: 0, 2: 0, 1: 0 } },
    }

    const onQuickAddEntry = vi.fn()
    const onAddToCollection = vi.fn()

    render(
      <UniversalMediaProfilePage
        entity={songEntity}
        communityEntries={[]}
        onBack={vi.fn()}
        onQuickAddEntry={onQuickAddEntry}
        onAddToCollection={onAddToCollection}
      />,
    )

    await screen.findByRole('heading', { name: 'Action Song', level: 1 })
    const addEntryBtn = screen.getByRole('button', { name: /Write an entry/i })
    expect(addEntryBtn).toBeInTheDocument()
    fireEvent.click(addEntryBtn)
    expect(onQuickAddEntry).toHaveBeenCalledTimes(1)

    const addToCollectionBtn = screen.getByRole('button', { name: /Add to collection/i })
    expect(addToCollectionBtn).toBeInTheDocument()
    fireEvent.click(addToCollectionBtn)
    expect(onAddToCollection).toHaveBeenCalledTimes(1)

    const shareBtn = screen.getByRole('button', { name: /Share Action Song/i })
    expect(shareBtn).toBeInTheDocument()
  })

  it('renders inline title with explicit badge inside affix group on the left before the title', () => {
    const { container: multiWord } = render(
      <div>
        {renderInlineTitleWithExplicit('you seem pretty sad for a girl so in love', true)}
      </div>,
    )
    const affixGroup = multiWord.querySelector('.media-hero-title-affix-group.is-left')
    expect(affixGroup).toBeInTheDocument()
    expect(affixGroup?.textContent).toContain('E')
    expect(affixGroup?.textContent).toContain('you')
    expect(multiWord.textContent).toBe('Eyou seem pretty sad for a girl so in love')

    const { container: singleWord } = render(
      <div>
        {renderInlineTitleWithExplicit('Lover', true)}
      </div>,
    )
    const singleAffix = singleWord.querySelector('.media-hero-title-affix-group.is-left')
    expect(singleAffix).toBeInTheDocument()
    expect(singleAffix?.textContent).toContain('E')
    expect(singleAffix?.textContent).toContain('Lover')

    const { container: nonExplicit } = render(
      <div>
        {renderInlineTitleWithExplicit('Fearless', false)}
      </div>,
    )
    expect(nonExplicit.querySelector('.explicit-badge')).not.toBeInTheDocument()
    expect(nonExplicit.querySelector('.media-hero-title-affix-group')).not.toBeInTheDocument()
    expect(nonExplicit.textContent).toBe('Fearless')
  })

  it('renders EntityLoadingSkeleton matching the Spotlight Profile layout structure', () => {
    const { container } = render(<EntityLoadingSkeleton showHeader={false} showLocalNavigation={true} />)

    const main = container.querySelector('.universal-media-profile-page.is-spotlight-profile.route-entity-skeleton')
    expect(main).toBeInTheDocument()

    // Local topbar skeleton
    expect(container.querySelector('.media-profile-topbar')).toBeInTheDocument()
    expect(container.querySelector('.route-entity-back-btn')).toBeInTheDocument()
    expect(container.querySelector('.editorial-divider')).toBeInTheDocument()

    // Hero section skeleton with spotlight category badge and 2-column grid areas
    const hero = container.querySelector('.media-hero-section')
    expect(hero).toBeInTheDocument()
    expect(hero?.querySelector('.media-container-category-badge.skeleton-box')).toBeInTheDocument()
    expect(hero?.querySelector('.media-hero-left .route-entity-artwork')).toBeInTheDocument()
    expect(hero?.querySelector('.media-hero-right .media-hero-text-block')).toBeInTheDocument()
    expect(hero?.querySelector('.route-entity-title')).toBeInTheDocument()
    expect(hero?.querySelector('.media-chips-row')).toBeInTheDocument()
    expect(hero?.querySelector('.media-hero-body-block .media-hero-actions')).toBeInTheDocument()

    // Tabs section skeleton
    const tabsContainer = container.querySelector('.media-tabs-container')
    expect(tabsContainer).toBeInTheDocument()
    expect(tabsContainer?.querySelectorAll('.route-entity-tab')).toHaveLength(4)
    expect(tabsContainer?.querySelector('.route-entity-content .is-panel')).toBeInTheDocument()
  })

  it('does not render an explicit badge on the cover art thumbnail', async () => {
    const explicitAlbum: UniversalMediaEntity = {
      id: 'album:fixture-art-check',
      name: 'Album Art Check',
      type: 'album',
      categoryLabel: 'Album',
      artworkUrl: 'https://example.com/artwork.jpg',
      providerId: '9999',
      explicit: true,
      description: 'Album description',
      metadataChips: [
        { label: 'Artist', value: 'Fixture Artist' },
        { label: 'Explicit', value: 'Yes' },
      ],
      communityRating: { average: 5, count: 1, distribution: { 5: 1, 4: 0, 3: 0, 2: 0, 1: 0 } },
    }

    const { container } = render(
      <UniversalMediaProfilePage
        entity={explicitAlbum}
        communityEntries={[]}
        onBack={vi.fn()}
      />,
    )

    await screen.findByRole('heading', { name: 'Album Art Check', level: 1 })

    // Ensure no explicit badge is placed directly on the cover art container or frames
    expect(container.querySelector('.media-artwork-container .explicit-badge')).not.toBeInTheDocument()
    expect(container.querySelector('.universal-entity-explicit-badge')).not.toBeInTheDocument()
  })

  it('renders both discography and filmography tabs with verified profession for dual-craft artist', async () => {
    const dualArtist: UniversalMediaEntity = {
      id: 'human:taylor-swift',
      name: 'Taylor Swift',
      type: 'human',
      categoryLabel: 'Singer-songwriter',
      description: 'Taylor Swift is an American singer-songwriter.',
      artworkUrl: 'https://example.com/taylor.jpg',
      humanProfile: {
        canonicalId: 'human:Q26876',
        context: 'musician',
        primaryProfession: 'singer_songwriter',
        professions: ['singer_songwriter', 'musician', 'actor', 'director'],
        occupationLabels: ['Singer-songwriter', 'Actress', 'Director'],
        providerIds: {
          wikidataId: 'Q26876',
        },
        capabilities: {
          topSongs: true,
          discography: true,
          filmography: true,
          publishedWorks: false,
          directing: true,
          creating: false,
          producing: false,
          writing: false,
        },
      },
      metadataChips: [
        { label: 'Profession', value: 'Singer-songwriter, Actress, Director' },
      ],
      communityRating: { average: 5, count: 10, distribution: { 5: 10, 4: 0, 3: 0, 2: 0, 1: 0 } },
    }

    render(
      <UniversalMediaProfilePage
        entity={dualArtist}
        communityEntries={[]}
        onBack={vi.fn()}
      />,
    )

    await screen.findByRole('heading', { name: 'Taylor Swift', level: 1 })
    expect(screen.getByRole('button', { name: 'Top Songs' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Discography' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Filmography' })).toBeInTheDocument()
    expect(screen.getByText('Singer-songwriter')).toBeInTheDocument()
  })

  it('renders filmography tiles adapting the discography layout with character and entity badge', async () => {
    vi.spyOn(metadata, 'fetchWikipediaProfile').mockResolvedValue({
      title: 'Taylor Swift',
      portraitUrl: '',
      description: 'Taylor Swift is an American singer-songwriter and actress.',
      pageUrl: '',
      wikidataId: 'Q26876',
    })
    vi.spyOn(metadata, 'fetchHumanScreenCredits').mockResolvedValue({
      credits: [
        {
          id: 'movie:101:acting',
          providerId: '101',
          mediaType: 'movie',
          title: 'Amsterdam',
          year: '2022',
          role: 'Liz Meekins',
          category: 'acting',
        },
      ],
    })

    const actorArtist: UniversalMediaEntity = {
      id: 'human:taylor-swift',
      name: 'Taylor Swift',
      type: 'human',
      categoryLabel: 'Singer-songwriter',
      description: 'Taylor Swift is an American singer-songwriter.',
      artworkUrl: 'https://example.com/taylor.jpg',
      humanProfile: {
        canonicalId: 'human:Q26876',
        primaryProfession: 'singer_songwriter',
        professions: ['singer_songwriter', 'actor'],
        occupationLabels: ['Singer-songwriter', 'Actress'],
        providerIds: {
          wikidataId: 'Q26876',
        },
        capabilities: {
          topSongs: true,
          discography: true,
          filmography: true,
          publishedWorks: false,
          directing: false,
          creating: false,
          producing: false,
          writing: false,
        },
      },
      metadataChips: [],
      communityRating: { average: 5, count: 10, distribution: { 5: 10, 4: 0, 3: 0, 2: 0, 1: 0 } },
    }

    render(
      <UniversalMediaProfilePage
        entity={actorArtist}
        communityEntries={[]}
        onBack={vi.fn()}
      />,
    )

    await screen.findByRole('heading', { name: 'Taylor Swift', level: 1 })
    const filmographyTab = screen.getByRole('button', { name: 'Filmography' })
    fireEvent.click(filmographyTab)

    const tileTitle = await screen.findByText('Amsterdam')
    expect(tileTitle).toHaveClass('filmography-tile-title')

    const characterSubtitle = screen.getByText('Liz Meekins')
    expect(characterSubtitle).toHaveClass('filmography-tile-subtitle')

    // Verify entity badge inside the poster frame
    const badge = screen.getByText('Film')
    expect(badge.closest('.universal-entity-type-badge')).toBeInTheDocument()

    // Verify no title overlay covers the poster frame
    const tileButton = screen.getByRole('button', { name: /Open Amsterdam/i })
    expect(tileButton.querySelector('.media-title-overlay')).toBeNull()
  })

  it('makes artist and track count metadata chips clickable while keeping release year and genre static', async () => {
    const onNavigateToEntity = vi.fn()
    const albumWithChips: UniversalMediaEntity = {
      id: 'album:fixture:guts',
      name: 'GUTS',
      type: 'album',
      categoryLabel: 'Album',
      artworkUrl: 'https://example.com/guts.jpg',
      description: 'Album profile for GUTS by Olivia Rodrigo.',
      metadataChips: [
        { label: 'Artist', value: 'Olivia Rodrigo' },
        { label: 'Release Year', value: '2026' },
        { label: 'Genre', value: 'Pop' },
        { label: 'Track Count', value: '13 Tracks' },
      ],
      communityRating: { average: 0, count: 0, distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } },
      primaryCollection: {
        title: 'Tracks',
        items: [
          { id: 'song:1', rank: 1, title: 'all-american bitch', subtitle: 'Olivia Rodrigo', artworkUrl: '' },
          { id: 'song:2', rank: 2, title: 'bad idea right?', subtitle: 'Olivia Rodrigo', artworkUrl: '' },
        ],
      },
    }

    render(
      <UniversalMediaProfilePage
        entity={albumWithChips}
        communityEntries={[]}
        onBack={vi.fn()}
        onNavigateToEntity={onNavigateToEntity}
      />,
    )

    await screen.findByRole('heading', { name: 'GUTS', level: 1 })

    // Check non-clickable chips (Release Year, Genre): they should NOT be buttons
    const chipsRow = document.querySelector('.media-chips-row')
    expect(chipsRow).toBeInTheDocument()

    const genreChip = Array.from(chipsRow?.querySelectorAll('.media-metadata-chip') || []).find((c) =>
      c.querySelector('.chip-label')?.textContent?.includes('Genre'),
    )
    expect(genreChip).not.toHaveClass('is-interactive')
    const genreValue = genreChip?.querySelector('.chip-value')
    expect(genreValue?.tagName.toLowerCase()).toBe('span')
    expect(genreValue?.textContent).toBe('Pop')

    const yearChip = Array.from(chipsRow?.querySelectorAll('.media-metadata-chip') || []).find((c) =>
      c.querySelector('.chip-label')?.textContent?.includes('Release Year'),
    )
    expect(yearChip).not.toHaveClass('is-interactive')
    const yearValue = yearChip?.querySelector('.chip-value')
    expect(yearValue?.tagName.toLowerCase()).toBe('span')
    expect(yearValue?.textContent).toBe('2026')

    // Click Artist chip -> navigates to artist profile
    const artistButton = screen.getByRole('button', { name: /View artist profile for Olivia Rodrigo/i })
    expect(artistButton).toBeInTheDocument()
    fireEvent.click(artistButton)

    expect(onNavigateToEntity).toHaveBeenCalledWith(
      'human:olivia-rodrigo',
      'human',
      expect.objectContaining({
        id: 'human:olivia-rodrigo',
        name: 'Olivia Rodrigo',
        type: 'human',
      }),
    )

    // Check initial active tab is Overview
    const tracksTabButton = screen.getByRole('button', { name: 'Tracks' })
    expect(tracksTabButton).not.toHaveClass('active')

    // Click Track Count chip -> switches to Tracks tab
    const trackCountButton = screen.getByRole('button', { name: /View tracks \(13 Tracks\)/i })
    expect(trackCountButton).toBeInTheDocument()
    fireEvent.click(trackCountButton)

    // The Tracks tab should now be active
    expect(tracksTabButton).toHaveClass('active')
  })
})
