import type { MediaEntityType, UniversalMediaEntity } from '../types/mediaEntity'

export interface EntityProfile {
  id: string
  title: string
  type: MediaEntityType
  coverUrl: string
  bio: string
  creatorLabel: string
  creatorValue: string
  universalEntity?: UniversalMediaEntity
}

/**
 * Entity Profiles Registry.
 * All hardcoded entity profiles have been removed in favor of dynamic live API metadata resolution.
 */
const theLastSignal: UniversalMediaEntity = {
  id: 'show-design-review-the-last-signal',
  name: 'The Last Signal',
  type: 'tv',
  categoryLabel: 'Series',
  artworkUrl: '/design-review/the-last-signal-poster.png',
  description: 'After a radio astronomer detects a repeating transmission hidden inside a coastal storm, a small observatory team discovers that every pulse predicts a disappearance exactly seventy-two hours before it happens. Their search for the signal’s source forces them to choose between warning the city and protecting the person apparently sending it from the future.',
  metadataChips: [
    { label: 'Creator', value: 'Mara Velez' },
    { label: 'Genre', value: 'Mystery, Science Fiction, Drama' },
    { label: 'Release Year', value: '2026' },
  ],
  communityRating: {
    average: 4.6,
    count: 184,
    distribution: { 5: 68, 4: 23, 3: 7, 2: 2, 1: 0 },
  },
  primaryCollection: {
    title: 'Cast',
    items: [
      { id: 'fixture-cast-mina-vale', rank: 1, title: 'Mina Vale', subtitle: 'Dr. Elian Reyes', artworkUrl: '' },
      { id: 'fixture-cast-jon-bell', rank: 2, title: 'Jon Bell', subtitle: 'Noah Mercer', artworkUrl: '' },
      { id: 'fixture-cast-aya-laurent', rank: 3, title: 'Aya Laurent', subtitle: 'Sera Okafor', artworkUrl: '' },
      { id: 'fixture-cast-theo-march', rank: 4, title: 'Theo March', subtitle: 'Cal Voss', artworkUrl: '' },
    ],
  },
  tvMetadata: {
    source: 'design-review-fixture',
    seasons: [
      {
        id: 91001,
        name: 'Season 1',
        seasonNumber: 1,
        episodeCount: 6,
        airDate: '2026-03-14',
        posterUrl: '/design-review/the-last-signal-poster.png',
        overview: 'The observatory team traces a signal that appears to predict disappearances across the city.',
        episodes: [
          { id: 91101, name: 'Dead Air', seasonNumber: 1, episodeNumber: 1, airDate: '2026-03-14', runtime: 51, overview: 'Elian records a transmission containing the name of a woman who vanishes three days later.' },
          { id: 91102, name: 'Seventy-Two Hours', seasonNumber: 1, episodeNumber: 2, airDate: '2026-03-21', runtime: 48, overview: 'A second name gives the team one impossible deadline and no explanation for how the signal knows.' },
          { id: 91103, name: 'The Listening Room', seasonNumber: 1, episodeNumber: 3, airDate: '2026-03-28', runtime: 53, overview: 'Sera finds an abandoned monitoring room beneath the observatory with recordings dated twenty years ahead.' },
          { id: 91104, name: 'Low Tide', seasonNumber: 1, episodeNumber: 4, airDate: '2026-04-04', runtime: 49, overview: 'The signal leads Noah to a flooded neighborhood erased from every official city map.' },
          { id: 91105, name: 'Carrier Wave', seasonNumber: 1, episodeNumber: 5, airDate: '2026-04-11', runtime: 55, overview: 'Elian realizes the missing people are not victims but parts of a message still being assembled.' },
          { id: 91106, name: 'Last Transmission', seasonNumber: 1, episodeNumber: 6, airDate: '2026-04-18', runtime: 61, overview: 'With the observatory under evacuation, the team broadcasts a reply and receives Elian’s own voice in return.' },
        ].map((episode, index) => ({
          ...episode,
          stillUrl: index % 2 === 0
            ? '/design-review/the-last-signal-observatory.png'
            : '/design-review/the-last-signal-flooded-city.png',
        })),
      },
      {
        id: 92001,
        name: 'Season 2',
        seasonNumber: 2,
        episodeCount: 6,
        airDate: '2027-05-09',
        posterUrl: '/design-review/the-last-signal-poster.png',
        overview: 'A year after the broadcast, fragments of the signal begin appearing in ordinary household devices.',
        episodes: [
          { id: 92101, name: 'Afterimage', seasonNumber: 2, episodeNumber: 1, airDate: '2027-05-09', runtime: 54, overview: 'A silent year ends when hundreds of radios repeat a message only Elian remembers sending.' },
          { id: 92102, name: 'The Quiet City', seasonNumber: 2, episodeNumber: 2, airDate: '2027-05-16', runtime: 50, overview: 'The team enters a district where every electronic signal stopped at the exact same second.' },
          { id: 92103, name: 'Numbers Station', seasonNumber: 2, episodeNumber: 3, airDate: '2027-05-23', runtime: 52, overview: 'A child’s counting game reveals coordinates scattered across incompatible versions of the city.' },
          { id: 92104, name: 'The Other Shore', seasonNumber: 2, episodeNumber: 4, airDate: '2027-05-30', runtime: 57, overview: 'Noah follows a transmission across the bay and meets someone who insists the observatory never existed.' },
          { id: 92105, name: 'Feedback', seasonNumber: 2, episodeNumber: 5, airDate: '2027-06-06', runtime: 55, overview: 'Every attempt to prevent the next disappearance makes the signal stronger and the deadline shorter.' },
          { id: 92106, name: 'Open Channel', seasonNumber: 2, episodeNumber: 6, airDate: '2027-06-13', runtime: 64, overview: 'Elian opens the channel permanently, revealing who built the signal and what it was designed to save.' },
        ].map((episode, index) => ({
          ...episode,
          stillUrl: index % 2 === 0
            ? '/design-review/the-last-signal-flooded-city.png'
            : '/design-review/the-last-signal-observatory.png',
        })),
      },
    ],
  },
}

export const MOCK_ENTITY_PROFILES: Record<string, EntityProfile> = import.meta.env.DEV
  ? {
      [theLastSignal.id]: {
        id: theLastSignal.id,
        title: theLastSignal.name,
        type: theLastSignal.type,
        coverUrl: theLastSignal.artworkUrl,
        bio: theLastSignal.description,
        creatorLabel: 'Creator',
        creatorValue: 'Mara Velez',
        universalEntity: theLastSignal,
      },
    }
  : {}
