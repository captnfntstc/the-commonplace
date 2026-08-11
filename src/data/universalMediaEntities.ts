import type { UniversalMediaEntity } from '../types/mediaEntity'

export const UNIVERSAL_MEDIA_ENTITIES: Record<string, UniversalMediaEntity> = {
  // ── Artists ─────────────────────────────────────────────────────────────────
  'noah-kahan': {
    id: 'noah-kahan',
    name: 'Noah Kahan',
    type: 'artist',
    categoryLabel: 'Artist',
    artworkUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop',
    description:
      'American singer-songwriter whose introspective folk-pop arrangements explore themes of small-town nostalgia, mental health, and New England winters. Rising through acoustic storytelling, his work resonates deeply with listeners seeking quiet catharsis.',
    metadataChips: [
      { label: 'Genre', value: 'Indie Folk / Folk-Pop' },
      { label: 'Monthly Listeners', value: '24.8M' },
      { label: 'Country', value: 'United States' },
      { label: 'Active Since', value: '2017' },
      { label: 'Albums Released', value: '3 Studio Albums, 3 EPs' },
    ],
    communityRating: {
      average: 4.8,
      count: 1420,
      distribution: { 5: 82, 4: 14, 3: 3, 2: 1, 1: 0 },
    },
    primaryCollection: {
      title: 'Top Songs',
      items: [
        { id: 'nk1', rank: 1, title: 'Stick Season', subtitle: 'Stick Season (2022)', rating: 4.9 },
        { id: 'nk2', rank: 2, title: 'Dial Drunk', subtitle: 'Stick Season (Forever)', rating: 4.8 },
        { id: 'nk3', rank: 3, title: 'Northern Attitude', subtitle: 'feat. Hozier', rating: 4.8 },
        { id: 'nk4', rank: 4, title: 'Call Your Mom', subtitle: 'Stick Season (Extended)', rating: 4.7 },
        { id: 'nk5', rank: 5, title: 'Homesick', subtitle: 'Stick Season (2022)', rating: 4.6 },
      ],
    },
    secondaryCollection: {
      title: 'Albums & EPs',
      items: [
        { id: 'stick-season-album', title: 'Stick Season (We’ll All Be Here Forever)', subtitle: 'Album · 2023', artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/e4/75/f3/e475f31a-ade1-50bf-e983-1467aaf62c46/23UMGIM59938.rgb.jpg/1000x1000bb.jpg', rating: 4.9 },
        { id: 'stick-season-std-album', title: 'Stick Season', subtitle: 'Album · 2022', artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/8d/25/8e/8d258e09-7395-998f-23ed-82b0433b0518/22UMGIM71396.rgb.jpg/1000x1000bb.jpg', rating: 4.9 },
        { id: 'i-was-i-am-album', title: 'I Was / I Am', subtitle: 'Album · 2021', artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e2/06/01/e2060119-017e-3781-d39d-65535a03b6bb/21UMGIM50684.rgb.jpg/1000x1000bb.jpg', rating: 4.6 },
        { id: 'cape-elizabeth-ep', title: 'Cape Elizabeth EP', subtitle: 'EP · 2020', artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/a0/ee/28/a0ee28c9-6d01-a52f-1fcf-0d82887e145a/20UMGIM31849.rgb.jpg/1000x1000bb.jpg', rating: 4.7 },
        { id: 'busyhead-album', title: 'Busyhead', subtitle: 'Album · 2019', artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/c3/80/d0/c380d05c-5f46-5d25-f479-3c57481ace68/00602577648090.rgb.jpg/1000x1000bb.jpg', rating: 4.5 },
      ],
    },
    relatedEntities: {
      title: 'Similar Artists',
      items: [
        { id: 'hollow-coves', title: 'Hollow Coves', subtitle: 'Indie Folk', artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/1d/8d/ed/1d8ded31-05c8-64d0-57ff-93bd93f7d491/067003150354.png/1000x1000bb.jpg', type: 'artist' },
        { id: 'taylor-swift', title: 'Taylor Swift', subtitle: 'Folk / Pop', artworkUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/68/Glasto2025-546_%28cropped%29_2.jpg', type: 'artist' },
        { id: 'olivia-rodrigo', title: 'Olivia Rodrigo', subtitle: 'Alt Pop', artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/08/9e/07/089e0799-b405-9e69-b648-e6a19df9879c/24UMGIM30485.rgb.jpg/1000x1000bb.jpg', type: 'artist' },
      ],
    },
  },

  'taylor-swift': {
    id: 'taylor-swift',
    name: 'Taylor Swift',
    type: 'artist',
    categoryLabel: 'Artist',
    artworkUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/68/Glasto2025-546_%28cropped%29_2.jpg',
    description:
      'Globally celebrated singer-songwriter renowned for her autobiographical lyricism, genre transitions from country to synth-pop and indie folklore, and artistic reinventions that define modern popular music history.',
    metadataChips: [
      { label: 'Genre', value: 'Pop / Country / Indie Folk' },
      { label: 'Monthly Listeners', value: '104.2M' },
      { label: 'Country', value: 'United States' },
      { label: 'Active Since', value: '2006' },
      { label: 'Albums Released', value: '11 Studio Albums' },
    ],
    communityRating: {
      average: 4.9,
      count: 5890,
      distribution: { 5: 90, 4: 8, 3: 1, 2: 1, 1: 0 },
    },
    primaryCollection: {
      title: 'Top Songs',
      items: [
        { id: 'ts1', rank: 1, title: 'All Too Well (10 Minute Version)', subtitle: 'Red (Taylor’s Version)', rating: 5.0 },
        { id: 'ts2', rank: 2, title: 'cardigan', subtitle: 'folklore (2020)', rating: 4.9 },
        { id: 'ts3', rank: 3, title: 'Cruel Summer', subtitle: 'Lover (2019)', rating: 4.9 },
        { id: 'ts4', rank: 4, title: 'august', subtitle: 'folklore (2020)', rating: 4.8 },
        { id: 'ts5', rank: 5, title: 'Blank Space', subtitle: '1989 (2014)', rating: 4.8 },
      ],
    },
    secondaryCollection: {
      title: 'Albums Discography',
      items: [
        { id: 'ttpd-album', title: 'THE TORTURED POETS DEPARTMENT', subtitle: 'Album · 2024', artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/a3/8a/8d/a38a8de5-ae11-154c-dca5-221e6549caee/24UMGIM44778.rgb.jpg/1000x1000bb.jpg', rating: 4.9 },
        { id: '1989-tv-album', title: '1989 (Taylor’s Version)', subtitle: 'Album · 2023', artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/89/4a/4a/894a4ab9-b0b0-9ea5-ca41-8da0b9b79453/14UMDIM03405.rgb.jpg/1000x1000bb.jpg', rating: 4.9 },
        { id: 'speak-now-tv-album', title: 'Speak Now (Taylor’s Version)', subtitle: 'Album · 2023', artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/9f/3c/0a/9f3c0a60-f9e0-a34e-60e5-0be1f182896b/23UMGIM63932.rgb.jpg/1000x1000bb.jpg', rating: 4.9 },
        { id: 'midnights-album', title: 'Midnights', subtitle: 'Album · 2022', artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/fb/b7/5d/fbb75d98-3b52-2fa5-ca82-658194f3c498/23UMGIM58157.rgb.jpg/1000x1000bb.jpg', rating: 4.8 },
        { id: 'red-tv-album', title: 'Red (Taylor’s Version)', subtitle: 'Album · 2021', artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/c6/27/9c/c6279c07-9329-827d-31c4-f5d4c7d99ff4/21UM1IM25046.rgb.jpg/1000x1000bb.jpg', rating: 4.9 },
        { id: 'fearless-tv-album', title: 'Fearless (Taylor’s Version)', subtitle: 'Album · 2021', artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/c3/d0/1c/c3d01c88-73e7-187e-fd62-e1744de979a6/21UMGIM09915.rgb.jpg/1000x1000bb.jpg', rating: 4.8 },
        { id: 'evermore-album', title: 'evermore', subtitle: 'Album · 2020', artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/18/93/99/189399a7-95e1-324b-e40a-bd9e3ea22a95/20UM1IM14847.rgb.jpg/1000x1000bb.jpg', rating: 4.9 },
        { id: 'folklore-album', title: 'folklore', subtitle: 'Album · 2020', artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/8c/ef/c2/8cefc23a-61b7-05ff-b52a-bb1e4922087c/20UMGIM64216.rgb.jpg/1000x1000bb.jpg', rating: 5.0 },
        { id: 'lover-album', title: 'Lover', subtitle: 'Album · 2019', artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/49/3d/ab/493dab54-f920-9043-6181-80993b8116c9/19UMGIM53909.rgb.jpg/1000x1000bb.jpg', rating: 4.8 },
        { id: 'reputation-album', title: 'reputation', subtitle: 'Album · 2017', artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/eb/e6/06/ebe606da-e00f-82d3-47f3-b79904eed541/17UM1IM24651.rgb.jpg/1000x1000bb.jpg', rating: 4.9 },
      ],
    },
  },

  'olivia-rodrigo': {
    id: 'olivia-rodrigo',
    name: 'Olivia Rodrigo',
    type: 'artist',
    categoryLabel: 'Artist',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/08/9e/07/089e0799-b405-9e69-b648-e6a19df9879c/24UMGIM30485.rgb.jpg/1000x1000bb.jpg',
    description:
      'Grammy Award-winning songwriter crafting vulnerable piano ballads and high-energy pop-punk anthems capturing teenage longing, heartbreak, and emotional intensity.',
    metadataChips: [
      { label: 'Genre', value: 'Pop / Alt-Rock' },
      { label: 'Monthly Listeners', value: '58.4M' },
      { label: 'Country', value: 'United States' },
      { label: 'Active Since', value: '2020' },
      { label: 'Albums Released', value: '2 Studio Albums' },
    ],
    communityRating: {
      average: 4.8,
      count: 2100,
      distribution: { 5: 83, 4: 13, 3: 3, 2: 1, 1: 0 },
    },
    primaryCollection: {
      title: 'Top Songs',
      items: [
        { id: 'or1', rank: 1, title: 'drivers license', subtitle: 'SOUR (2021)', rating: 4.9 },
        { id: 'or2', rank: 2, title: 'vampire', subtitle: 'GUTS (2023)', rating: 4.9 },
        { id: 'or3', rank: 3, title: 'deja vu', subtitle: 'SOUR (2021)', rating: 4.8 },
        { id: 'or4', rank: 4, title: 'good 4 u', subtitle: 'SOUR (2021)', rating: 4.7 },
        { id: 'or5', rank: 5, title: 'get him back!', subtitle: 'GUTS (2023)', rating: 4.7 },
      ],
    },
    secondaryCollection: {
      title: 'Albums Discography',
      items: [
        { id: 'guts-spilled-album', title: 'GUTS (spilled)', subtitle: 'Deluxe Album · 2024', artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/08/9e/07/089e0799-b405-9e69-b648-e6a19df9879c/24UMGIM30485.rgb.jpg/1000x1000bb.jpg', rating: 4.9 },
        { id: 'guts-album', title: 'GUTS', subtitle: 'Album · 2023', artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/9e/0d/17/9e0d17e0-c068-fbd9-fd85-610cc87c86aa/23UMGIM71511.rgb.jpg/1000x1000bb.jpg', rating: 4.9 },
        { id: 'sour-album', title: 'SOUR', subtitle: 'Album · 2021', artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/02/ed/8c/02ed8cab-c089-2fdd-7ce6-ab334a9a4e19/21UMGIM26093.rgb.jpg/1000x1000bb.jpg', rating: 4.9 },
      ],
    },
  },

  'hollow-coves': {
    id: 'hollow-coves',
    name: 'Hollow Coves',
    type: 'artist',
    categoryLabel: 'Artist',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/1d/8d/ed/1d8ded31-05c8-64d0-57ff-93bd93f7d491/067003150354.png/1000x1000bb.jpg',
    description:
      'Australian indie folk duo crafting soothing acoustic melodies inspired by travel, coastal landscapes, and quiet moments of reflection.',
    metadataChips: [
      { label: 'Genre', value: 'Indie Folk / Acoustic' },
      { label: 'Monthly Listeners', value: '4.2M' },
      { label: 'Country', value: 'Australia' },
      { label: 'Active Since', value: '2014' },
      { label: 'Albums Released', value: '2 Studio Albums, 2 EPs' },
    ],
    communityRating: {
      average: 4.7,
      count: 890,
      distribution: { 5: 78, 4: 18, 3: 2, 2: 1, 1: 0 },
    },
    secondaryCollection: {
      title: 'Albums & EPs',
      items: [
        { id: 'nothing-to-lose-album', title: 'Nothing to Lose', subtitle: 'Album · 2024', artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/1d/8d/ed/1d8ded31-05c8-64d0-57ff-93bd93f7d491/067003150354.png/1000x1000bb.jpg', rating: 4.9 },
        { id: 'moments-album', title: 'Moments', subtitle: 'Album · 2019', artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/7e/d3/02/7ed30270-b442-1061-aaf6-f45e2aa92d00/067003120753.png/1000x1000bb.jpg', rating: 4.8 },
        { id: 'wanderlust-ep', title: 'Wanderlust EP', subtitle: 'EP · 2017', artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/74/c7/15/74c71511-66be-4139-72a5-f5491ba8ec19/067003435659.png/1000x1000bb.jpg', rating: 4.9 },
      ],
    },
  },

  // ── Dedicated Album Profiles ───────────────────────────────────────────────
  'stick-season-album': {
    id: 'stick-season-album',
    name: 'Stick Season (We’ll All Be Here Forever)',
    type: 'album',
    categoryLabel: 'Album',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/e4/75/f3/e475f31a-ade1-50bf-e983-1467aaf62c46/23UMGIM59938.rgb.jpg/1000x1000bb.jpg',
    description:
      'The breakout third studio album by Noah Kahan. Blending vivid Vermont imagery, melancholic acoustic storytelling, and energetic indie-folk choruses, the album captures isolation, growth, and love for home.',
    metadataChips: [
      { label: 'Artist', value: 'Noah Kahan' },
      { label: 'Release Year', value: '2023' },
      { label: 'Genre', value: 'Indie Folk / Folk-Pop' },
      { label: 'Track Count', value: '21 Tracks' },
      { label: 'Label', value: 'Republic Records' },
    ],
    communityRating: {
      average: 4.9,
      count: 1890,
      distribution: { 5: 88, 4: 10, 3: 1, 2: 1, 1: 0 },
    },
    primaryCollection: {
      title: 'Tracklist',
      items: [
        { id: 't1', rank: 1, title: 'Stick Season', subtitle: '3:02 · Single 1', rating: 5.0 },
        { id: 't2', rank: 2, title: 'Northern Attitude', subtitle: '4:27 · Track 2', rating: 4.9 },
        { id: 't3', rank: 3, title: 'All My Love', subtitle: '4:11 · Track 3', rating: 4.8 },
        { id: 't4', rank: 4, title: 'Dial Drunk', subtitle: '3:33 · Single 2', rating: 4.9 },
        { id: 't5', rank: 5, title: 'Call Your Mom', subtitle: '4:38 · Track 5', rating: 4.8 },
      ],
    },
    relatedEntities: {
      title: 'More by Noah Kahan',
      items: [
        { id: 'noah-kahan', title: 'Noah Kahan', subtitle: 'Artist Profile', artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music123/v4/c7/05/13/c705138a-2342-ceb1-2c68-b8c765521cf7/artwork.jpg/1000x1000bb.jpg', type: 'artist' },
      ],
    },
  },

  'stick-season-std-album': {
    id: 'stick-season-std-album',
    name: 'Stick Season',
    type: 'album',
    categoryLabel: 'Album',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/8d/25/8e/8d258e09-7395-998f-23ed-82b0433b0518/22UMGIM71396.rgb.jpg/1000x1000bb.jpg',
    description: 'The standard 14-track release of Stick Season by Noah Kahan.',
    metadataChips: [
      { label: 'Artist', value: 'Noah Kahan' },
      { label: 'Release Year', value: '2022' },
      { label: 'Genre', value: 'Indie Folk' },
      { label: 'Track Count', value: '14 Tracks' },
      { label: 'Label', value: 'Republic Records' },
    ],
    communityRating: {
      average: 4.9,
      count: 1450,
      distribution: { 5: 88, 4: 10, 3: 2, 2: 0, 1: 0 },
    },
  },

  'i-was-i-am-album': {
    id: 'i-was-i-am-album',
    name: 'I Was / I Am',
    type: 'album',
    categoryLabel: 'Album',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e2/06/01/e2060119-017e-3781-d39d-65535a03b6bb/21UMGIM50684.rgb.jpg/1000x1000bb.jpg',
    description: 'The sophomore studio album by Noah Kahan featuring introspective songwriting, lush acoustic guitars, and honest reflections on personal growth.',
    metadataChips: [
      { label: 'Artist', value: 'Noah Kahan' },
      { label: 'Release Year', value: '2021' },
      { label: 'Genre', value: 'Indie Folk / Pop' },
      { label: 'Track Count', value: '10 Tracks' },
      { label: 'Label', value: 'Republic Records' },
    ],
    communityRating: {
      average: 4.6,
      count: 920,
      distribution: { 5: 75, 4: 20, 3: 4, 2: 1, 1: 0 },
    },
  },

  'cape-elizabeth-ep': {
    id: 'cape-elizabeth-ep',
    name: 'Cape Elizabeth EP',
    type: 'album',
    categoryLabel: 'EP',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/a0/ee/28/a0ee28c9-6d01-a52f-1fcf-0d82887e145a/20UMGIM31849.rgb.jpg/1000x1000bb.jpg',
    description: 'A 5-track acoustic EP recorded by Noah Kahan in 2020.',
    metadataChips: [
      { label: 'Artist', value: 'Noah Kahan' },
      { label: 'Release Year', value: '2020' },
      { label: 'Genre', value: 'Acoustic Folk' },
      { label: 'Track Count', value: '5 Tracks' },
      { label: 'Label', value: 'Republic Records' },
    ],
    communityRating: {
      average: 4.7,
      count: 650,
      distribution: { 5: 80, 4: 15, 3: 3, 2: 1, 1: 1 },
    },
  },

  'busyhead-album': {
    id: 'busyhead-album',
    name: 'Busyhead',
    type: 'album',
    categoryLabel: 'Album',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/c3/80/d0/c380d05c-5f46-5d25-f479-3c57481ace68/00602577648090.rgb.jpg/1000x1000bb.jpg',
    description: 'The debut studio album by Noah Kahan, introducing his signature emotional transparency and folk-pop sensibilities.',
    metadataChips: [
      { label: 'Artist', value: 'Noah Kahan' },
      { label: 'Release Year', value: '2019' },
      { label: 'Genre', value: 'Indie Pop' },
      { label: 'Track Count', value: '10 Tracks' },
      { label: 'Label', value: 'Republic Records' },
    ],
    communityRating: {
      average: 4.5,
      count: 810,
      distribution: { 5: 72, 4: 22, 3: 5, 2: 1, 1: 0 },
    },
  },

  'ttpd-album': {
    id: 'ttpd-album',
    name: 'THE TORTURED POETS DEPARTMENT',
    type: 'album',
    categoryLabel: 'Album',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/a3/8a/8d/a38a8de5-ae11-154c-dca5-221e6549caee/24UMGIM44778.rgb.jpg/1000x1000bb.jpg',
    description: 'The eleventh studio album by Taylor Swift, an introspective synth-pop and synth-folk double album.',
    metadataChips: [
      { label: 'Artist', value: 'Taylor Swift' },
      { label: 'Release Year', value: '2024' },
      { label: 'Genre', value: 'Synth-Pop / Folk' },
      { label: 'Track Count', value: '31 Tracks' },
      { label: 'Label', value: 'Republic Records' },
    ],
    communityRating: {
      average: 4.9,
      count: 7200,
      distribution: { 5: 90, 4: 8, 3: 1, 2: 1, 1: 0 },
    },
  },

  'speak-now-tv-album': {
    id: 'speak-now-tv-album',
    name: 'Speak Now (Taylor’s Version)',
    type: 'album',
    categoryLabel: 'Album',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/d4/23/57/d423579f-24f7-5c82-ed10-fbfd21ceef25/10UMDIM00487.rgb.jpg/1000x1000bb.jpg',
    description: 'The third re-recorded album by Taylor Swift, featuring self-written anthems and 6 From The Vault tracks.',
    metadataChips: [
      { label: 'Artist', value: 'Taylor Swift' },
      { label: 'Release Year', value: '2023' },
      { label: 'Genre', value: 'Pop Rock / Country' },
      { label: 'Track Count', value: '22 Tracks' },
      { label: 'Label', value: 'Republic Records' },
    ],
    communityRating: {
      average: 4.9,
      count: 4800,
      distribution: { 5: 89, 4: 9, 3: 1, 2: 1, 1: 0 },
    },
  },

  'midnights-album': {
    id: 'midnights-album',
    name: 'Midnights',
    type: 'album',
    categoryLabel: 'Album',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/fb/b7/5d/fbb75d98-3b52-2fa5-ca82-658194f3c498/23UMGIM58157.rgb.jpg/1000x1000bb.jpg',
    description: 'The tenth studio album by Taylor Swift, a concept album analyzing 13 sleepless nights scattered throughout her life.',
    metadataChips: [
      { label: 'Artist', value: 'Taylor Swift' },
      { label: 'Release Year', value: '2022' },
      { label: 'Genre', value: 'Synth-Pop / Midtempo' },
      { label: 'Track Count', value: '13 Tracks' },
      { label: 'Label', value: 'Republic Records' },
    ],
    communityRating: {
      average: 4.8,
      count: 5900,
      distribution: { 5: 85, 4: 12, 3: 2, 2: 1, 1: 0 },
    },
  },

  'fearless-tv-album': {
    id: 'fearless-tv-album',
    name: 'Fearless (Taylor’s Version)',
    type: 'album',
    categoryLabel: 'Album',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/c3/d0/1c/c3d01c88-73e7-187e-fd62-e1744de979a6/21UMGIM09915.rgb.jpg/1000x1000bb.jpg',
    description: 'The first re-recorded album by Taylor Swift, revisiting her Grammy Album of the Year winning country breakout.',
    metadataChips: [
      { label: 'Artist', value: 'Taylor Swift' },
      { label: 'Release Year', value: '2021' },
      { label: 'Genre', value: 'Country Pop' },
      { label: 'Track Count', value: '26 Tracks' },
      { label: 'Label', value: 'Republic Records' },
    ],
    communityRating: {
      average: 4.8,
      count: 4100,
      distribution: { 5: 86, 4: 11, 3: 2, 2: 1, 1: 0 },
    },
  },

  'evermore-album': {
    id: 'evermore-album',
    name: 'evermore',
    type: 'album',
    categoryLabel: 'Album',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/18/93/99/189399a7-95e1-324b-e40a-bd9e3ea22a95/20UM1IM14847.rgb.jpg/1000x1000bb.jpg',
    description: 'The ninth studio album by Taylor Swift, described as the sister record to folklore.',
    metadataChips: [
      { label: 'Artist', value: 'Taylor Swift' },
      { label: 'Release Year', value: '2020' },
      { label: 'Genre', value: 'Indie Folk / Alternative' },
      { label: 'Track Count', value: '15 Tracks' },
      { label: 'Label', value: 'Republic Records' },
    ],
    communityRating: {
      average: 4.9,
      count: 5120,
      distribution: { 5: 91, 4: 7, 3: 1, 2: 1, 1: 0 },
    },
  },

  'folklore-album': {
    id: 'folklore-album',
    name: 'folklore',
    type: 'album',
    categoryLabel: 'Album',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/8c/ef/c2/8cefc23a-61b7-05ff-b52a-bb1e4922087c/20UMGIM64216.rgb.jpg/1000x1000bb.jpg',
    description:
      'The surprise eighth studio album by Taylor Swift, recorded in quarantine during 2020. Shifting to acoustic indie folk and chamber pop, the record creates atmospheric storytelling of escapism, nostalgia, and romance.',
    metadataChips: [
      { label: 'Artist', value: 'Taylor Swift' },
      { label: 'Release Year', value: '2020' },
      { label: 'Genre', value: 'Indie Folk / Chamber Pop' },
      { label: 'Track Count', value: '16 Tracks' },
      { label: 'Label', value: 'Republic Records' },
    ],
    communityRating: {
      average: 5.0,
      count: 6420,
      distribution: { 5: 94, 4: 5, 3: 1, 2: 0, 1: 0 },
    },
    primaryCollection: {
      title: 'Tracklist',
      items: [
        { id: 'flk1', rank: 1, title: 'cardigan', subtitle: '3:59 · Track 2', rating: 5.0 },
        { id: 'flk2', rank: 2, title: 'august', subtitle: '4:21 · Track 8', rating: 4.9 },
        { id: 'flk3', rank: 3, title: 'exile (feat. Bon Iver)', subtitle: '4:45 · Track 3', rating: 5.0 },
        { id: 'flk4', rank: 4, title: 'the 1', subtitle: '3:30 · Track 1', rating: 4.8 },
        { id: 'flk5', rank: 5, title: 'my tears ricochet', subtitle: '4:15 · Track 5', rating: 4.9 },
      ],
    },
    relatedEntities: {
      title: 'More by Taylor Swift',
      items: [
        { id: 'taylor-swift', title: 'Taylor Swift', subtitle: 'Artist Profile', artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music123/v4/c7/05/13/c705138a-2342-ceb1-2c68-b8c765521cf7/artwork.jpg/1000x1000bb.jpg', type: 'artist' },
      ],
    },
  },

  'red-tv-album': {
    id: 'red-tv-album',
    name: 'Red (Taylor’s Version)',
    type: 'album',
    categoryLabel: 'Album',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/25/0d/7e/250d7e42-3a2f-19ac-f865-f1e04a4a1f97/12UMDIM01007.rgb.jpg/1000x1000bb.jpg',
    description: 'The second re-recorded album by Taylor Swift, featuring 30 tracks including the epic All Too Well (10 Minute Version).',
    metadataChips: [
      { label: 'Artist', value: 'Taylor Swift' },
      { label: 'Release Year', value: '2021' },
      { label: 'Genre', value: 'Pop / Country' },
      { label: 'Track Count', value: '30 Tracks' },
      { label: 'Label', value: 'Republic Records' },
    ],
    communityRating: {
      average: 4.9,
      count: 4890,
      distribution: { 5: 91, 4: 7, 3: 1, 2: 1, 1: 0 },
    },
  },

  '1989-tv-album': {
    id: '1989-tv-album',
    name: '1989 (Taylor’s Version)',
    type: 'album',
    categoryLabel: 'Album',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/89/4a/4a/894a4ab9-b0b0-9ea5-ca41-8da0b9b79453/14UMDIM03405.rgb.jpg/1000x1000bb.jpg',
    description: 'The fourth re-recorded album by Taylor Swift, reimagining her iconic synth-pop classic with 5 new Vault tracks.',
    metadataChips: [
      { label: 'Artist', value: 'Taylor Swift' },
      { label: 'Release Year', value: '2023' },
      { label: 'Genre', value: 'Synth-Pop' },
      { label: 'Track Count', value: '21 Tracks' },
      { label: 'Label', value: 'Republic Records' },
    ],
    communityRating: {
      average: 4.9,
      count: 5120,
      distribution: { 5: 90, 4: 8, 3: 1, 2: 1, 1: 0 },
    },
  },

  'guts-spilled-album': {
    id: 'guts-spilled-album',
    name: 'GUTS (spilled)',
    type: 'album',
    categoryLabel: 'Album',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/08/9e/07/089e0799-b405-9e69-b648-e6a19df9879c/24UMGIM30485.rgb.jpg/1000x1000bb.jpg',
    description: 'The deluxe expanded edition of GUTS by Olivia Rodrigo featuring 5 bonus tracks including obsessed and stranger.',
    metadataChips: [
      { label: 'Artist', value: 'Olivia Rodrigo' },
      { label: 'Release Year', value: '2024' },
      { label: 'Genre', value: 'Alt-Rock / Pop-Punk' },
      { label: 'Track Count', value: '17 Tracks' },
      { label: 'Label', value: 'Geffen Records' },
    ],
    communityRating: {
      average: 4.9,
      count: 2410,
      distribution: { 5: 88, 4: 10, 3: 2, 2: 0, 1: 0 },
    },
  },

  'sour-album': {
    id: 'sour-album',
    name: 'SOUR',
    type: 'album',
    categoryLabel: 'Album',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/02/ed/8c/02ed8cab-c089-2fdd-7ce6-ab334a9a4e19/21UMGIM26093.rgb.jpg/1000x1000bb.jpg',
    description:
      'The debut studio album by Olivia Rodrigo. Exploring heartbreak, jealousy, and teenage angst through a blend of pop-punk and bedroom piano ballads, SOUR became a global phenomenon.',
    metadataChips: [
      { label: 'Artist', value: 'Olivia Rodrigo' },
      { label: 'Release Year', value: '2021' },
      { label: 'Genre', value: 'Pop-Punk / Alt-Pop' },
      { label: 'Track Count', value: '11 Tracks' },
      { label: 'Label', value: 'Geffen Records' },
    ],
    communityRating: {
      average: 4.9,
      count: 3200,
      distribution: { 5: 87, 4: 10, 3: 2, 2: 1, 1: 0 },
    },
    primaryCollection: {
      title: 'Tracklist',
      items: [
        { id: 's1', rank: 1, title: 'drivers license', subtitle: '4:02 · Track 3', rating: 5.0 },
        { id: 's2', rank: 2, title: 'good 4 u', subtitle: '2:58 · Track 6', rating: 4.9 },
        { id: 's3', rank: 3, title: 'deja vu', subtitle: '3:35 · Track 5', rating: 4.9 },
        { id: 's4', rank: 4, title: 'traitor', subtitle: '3:49 · Track 2', rating: 4.8 },
        { id: 's5', rank: 5, title: 'brutal', subtitle: '2:23 · Track 1', rating: 4.7 },
      ],
    },
    relatedEntities: {
      title: 'More by Olivia Rodrigo',
      items: [
        { id: 'olivia-rodrigo', title: 'Olivia Rodrigo', subtitle: 'Artist Profile', artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music123/v4/c7/05/13/c705138a-2342-ceb1-2c68-b8c765521cf7/artwork.jpg/1000x1000bb.jpg', type: 'artist' },
      ],
    },
  },

  'guts-album': {
    id: 'guts-album',
    name: 'GUTS',
    type: 'album',
    categoryLabel: 'Album',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/9e/0d/17/9e0d17e0-c068-fbd9-fd85-610cc87c86aa/23UMGIM71511.rgb.jpg/1000x1000bb.jpg',
    description:
      'The second studio album by Olivia Rodrigo. Expanding on her rock sensibilities with sharp wit, chaotic energy, and introspective honesty.',
    metadataChips: [
      { label: 'Artist', value: 'Olivia Rodrigo' },
      { label: 'Release Year', value: '2023' },
      { label: 'Genre', value: 'Alt-Rock / Pop-Punk' },
      { label: 'Track Count', value: '12 Tracks' },
      { label: 'Label', value: 'Geffen Records' },
    ],
    communityRating: {
      average: 4.9,
      count: 2890,
      distribution: { 5: 86, 4: 11, 3: 2, 2: 1, 1: 0 },
    },
  },

  'nothing-to-lose-album': {
    id: 'nothing-to-lose-album',
    name: 'Nothing to Lose',
    type: 'album',
    categoryLabel: 'Album',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/1d/8d/ed/1d8ded31-05c8-64d0-57ff-93bd93f7d491/067003150354.png/1000x1000bb.jpg',
    description: 'The sophomore studio album by Hollow Coves celebrating gratitude and new beginnings.',
    metadataChips: [
      { label: 'Artist', value: 'Hollow Coves' },
      { label: 'Release Year', value: '2024' },
      { label: 'Genre', value: 'Indie Folk' },
      { label: 'Track Count', value: '11 Tracks' },
      { label: 'Label', value: 'Nettwerk' },
    ],
    communityRating: {
      average: 4.9,
      count: 1200,
      distribution: { 5: 87, 4: 11, 3: 2, 2: 0, 1: 0 },
    },
  },

  'wanderlust-ep': {
    id: 'wanderlust-ep',
    name: 'Wanderlust EP',
    type: 'album',
    categoryLabel: 'EP',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/74/c7/15/74c71511-66be-4139-72a5-f5491ba8ec19/067003435659.png/1000x1000bb.jpg',
    description:
      'The beloved debut EP by Australian indie folk duo Hollow Coves, featuring peaceful acoustic harmonies inspired by travel and ocean coasts.',
    metadataChips: [
      { label: 'Artist', value: 'Hollow Coves' },
      { label: 'Release Year', value: '2017' },
      { label: 'Genre', value: 'Indie Folk / Acoustic' },
      { label: 'Track Count', value: '6 Tracks' },
      { label: 'Label', value: 'Nettwerk' },
    ],
    communityRating: {
      average: 4.9,
      count: 1420,
      distribution: { 5: 88, 4: 10, 3: 1, 2: 1, 1: 0 },
    },
  },

  'moments-album': {
    id: 'moments-album',
    name: 'Moments',
    type: 'album',
    categoryLabel: 'Album',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/7e/d3/02/7ed30270-b442-1061-aaf6-f45e2aa92d00/067003120753.png/1000x1000bb.jpg',
    description: 'The debut studio album by Hollow Coves, capturing organic acoustic textures and reflective lyrics.',
    metadataChips: [
      { label: 'Artist', value: 'Hollow Coves' },
      { label: 'Release Year', value: '2019' },
      { label: 'Genre', value: 'Indie Folk' },
      { label: 'Track Count', value: '11 Tracks' },
      { label: 'Label', value: 'Nettwerk' },
    ],
    communityRating: {
      average: 4.8,
      count: 1100,
      distribution: { 5: 82, 4: 15, 3: 2, 2: 1, 1: 0 },
    },
  },

  // ── Movies ──────────────────────────────────────────────────────────────────
  'interstellar': {
    id: 'interstellar',
    name: 'Interstellar',
    type: 'movie',
    categoryLabel: 'Movie',
    artworkUrl: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
    description:
      'In a future where crop blights threaten human survival, a former NASA pilot leads an interstellar voyage through a wormhole near Saturn to discover a habitable sanctuary across space and time.',
    metadataChips: [
      { label: 'Director', value: 'Christopher Nolan' },
      { label: 'Runtime', value: '169 min' },
      { label: 'Studio', value: 'Paramount / Warner Bros.' },
      { label: 'Release Year', value: '2014' },
      { label: 'Rating', value: 'PG-13' },
    ],
    communityRating: {
      average: 4.9,
      count: 4210,
      distribution: { 5: 89, 4: 9, 3: 1, 2: 1, 1: 0 },
    },
    primaryCollection: {
      title: 'Cast',
      items: [
        { id: 'c-int-1', rank: 1, title: 'Matthew McConaughey', subtitle: 'as Joseph Cooper', rating: 5.0 },
        { id: 'c-int-2', rank: 2, title: 'Anne Hathaway', subtitle: 'as Dr. Amelia Brand', rating: 4.8 },
        { id: 'c-int-3', rank: 3, title: 'Jessica Chastain', subtitle: 'as Murphy Cooper', rating: 4.9 },
        { id: 'c-int-4', rank: 4, title: 'Michael Caine', subtitle: 'as Professor John Brand', rating: 4.7 },
        { id: 'c-int-5', rank: 5, title: 'Timothée Chalamet', subtitle: 'as Young Tom Cooper', rating: 4.6 },
      ],
    },
  },

  'dead-poets-society': {
    id: 'dead-poets-society',
    name: 'Dead Poets Society',
    type: 'movie',
    categoryLabel: 'Movie',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/1d/c9/54/1dc9544b-a7ed-3f26-5629-1f4a25d8d421/00050087245696.rgb.jpg/1000x1000bb.jpg',
    description:
      'An unconventional English teacher at an all-boys preparatory academy inspires his pupils to break free from rigid tradition through literature, poetry, and the eternal pursuit to seize the day.',
    metadataChips: [
      { label: 'Director', value: 'Peter Weir' },
      { label: 'Runtime', value: '128 min' },
      { label: 'Studio', value: 'Touchstone Pictures' },
      { label: 'Release Year', value: '1989' },
      { label: 'Rating', value: 'PG-13' },
    ],
    communityRating: {
      average: 4.9,
      count: 3120,
      distribution: { 5: 91, 4: 7, 3: 1, 2: 1, 1: 0 },
    },
    primaryCollection: {
      title: 'Cast',
      items: [
        { id: 'c-dps-1', rank: 1, title: 'Robin Williams', subtitle: 'as John Keating', rating: 5.0 },
        { id: 'c-dps-2', rank: 2, title: 'Robert Sean Leonard', subtitle: 'as Neil Perry', rating: 4.9 },
        { id: 'c-dps-3', rank: 3, title: 'Ethan Hawke', subtitle: 'as Todd Anderson', rating: 4.9 },
        { id: 'c-dps-4', rank: 4, title: 'Josh Charles', subtitle: 'as Knox Overstreet', rating: 4.7 },
        { id: 'c-dps-5', rank: 5, title: 'Gale Hansen', subtitle: 'as Charlie Dalton', rating: 4.6 },
      ],
    },
  },

  'perks-of-being-a-wallflower': {
    id: 'perks-of-being-a-wallflower',
    name: 'The Perks of Being a Wallflower',
    type: 'movie',
    categoryLabel: 'Movie',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/56/99/47/56994761-ed8e-1e0b-15f9-7b649923ac42/06PNDIM00296.rgb.jpg/1000x1000bb.jpg',
    description:
      'An introverted freshman navigating mental illness and high school isolation finds friendship, love, and belonging when two expressive seniors welcome him into their world.',
    metadataChips: [
      { label: 'Director', value: 'Stephen Chbosky' },
      { label: 'Runtime', value: '102 min' },
      { label: 'Studio', value: 'Summit Entertainment' },
      { label: 'Release Year', value: '2012' },
      { label: 'Rating', value: 'PG-13' },
    ],
    communityRating: {
      average: 4.8,
      count: 2450,
      distribution: { 5: 84, 4: 13, 3: 2, 2: 1, 1: 0 },
    },
  },

  'almost-famous': {
    id: 'almost-famous',
    name: 'Almost Famous',
    type: 'movie',
    categoryLabel: 'Movie',
    artworkUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop',
    description:
      'A teenage rock journalist in 1973 embarks on a life-changing tour with an up-and-coming band for Rolling Stone magazine, witnessing the passion and turmoil of 1970s rock and roll culture.',
    metadataChips: [
      { label: 'Director', value: 'Cameron Crowe' },
      { label: 'Runtime', value: '122 min' },
      { label: 'Studio', value: 'DreamWorks Pictures' },
      { label: 'Release Year', value: '2000' },
      { label: 'Rating', value: 'R' },
    ],
    communityRating: {
      average: 4.8,
      count: 1980,
      distribution: { 5: 82, 4: 15, 3: 2, 2: 1, 1: 0 },
    },
  },

  'wicked': {
    id: 'wicked',
    name: 'Wicked',
    type: 'movie',
    categoryLabel: 'Movie',
    artworkUrl: 'https://image.tmdb.org/t/p/w500/u3bZgnGQ9T01sWNhyveQz0wH0Hl.jpg',
    description:
      'The cinematic adaptation of the Broadway musical telling the origin story of Oz’s Witches: Elphaba, misunderstood for her green skin, and Glinda, favored by popularity.',
    metadataChips: [
      { label: 'Director', value: 'Jon M. Chu' },
      { label: 'Runtime', value: '160 min' },
      { label: 'Studio', value: 'Universal Pictures' },
      { label: 'Release Year', value: '2024' },
      { label: 'Rating', value: 'PG' },
    ],
    communityRating: {
      average: 4.8,
      count: 3200,
      distribution: { 5: 85, 4: 11, 3: 3, 2: 1, 1: 0 },
    },
  },

  // ── TV Shows ────────────────────────────────────────────────────────────────
  'the-big-bang-theory': {
    id: 'the-big-bang-theory',
    name: 'The Big Bang Theory',
    type: 'tv',
    categoryLabel: 'TV Show',
    artworkUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop',
    description:
      'Long-running sitcom exploring the humorous lives of two brilliant Caltech physicists, their eccentric friends, and the aspiring actress across the hall.',
    metadataChips: [
      { label: 'Creator', value: 'Chuck Lorre & Bill Prady' },
      { label: 'Seasons', value: '12 Seasons' },
      { label: 'Episodes', value: '279 Episodes' },
      { label: 'Status', value: 'Ended (2019)' },
    ],
    communityRating: {
      average: 4.7,
      count: 2980,
      distribution: { 5: 75, 4: 20, 3: 4, 2: 1, 1: 0 },
    },
  },

  'friends': {
    id: 'friends',
    name: 'Friends',
    type: 'tv',
    categoryLabel: 'TV Show',
    artworkUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop',
    description:
      'Iconic 90s comedy series recording the romantic, career, and personal lives of six young adults living in Manhattan.',
    metadataChips: [
      { label: 'Creator', value: 'David Crane & Marta Kauffman' },
      { label: 'Seasons', value: '10 Seasons' },
      { label: 'Episodes', value: '236 Episodes' },
      { label: 'Status', value: 'Ended (2004)' },
    ],
    communityRating: {
      average: 4.9,
      count: 6540,
      distribution: { 5: 88, 4: 10, 3: 1, 2: 1, 1: 0 },
    },
  },

  'how-i-met-your-mother': {
    id: 'how-i-met-your-mother',
    name: 'How I Met Your Mother',
    type: 'tv',
    categoryLabel: 'TV Show',
    artworkUrl: 'https://images.unsplash.com/photo-1543807535-eceef0bc6599?w=800&auto=format&fit=crop',
    description:
      'Framed as a father retelling his youth to his children, this romantic sitcom chronicles Ted Mosby and his close-knit group of friends through dating and life in NYC.',
    metadataChips: [
      { label: 'Creator', value: 'Carter Bays & Craig Thomas' },
      { label: 'Seasons', value: '9 Seasons' },
      { label: 'Episodes', value: '208 Episodes' },
      { label: 'Status', value: 'Ended (2014)' },
    ],
    communityRating: {
      average: 4.7,
      count: 3410,
      distribution: { 5: 76, 4: 18, 3: 4, 2: 1, 1: 1 },
    },
  },

  'mr-robot': {
    id: 'mr-robot',
    name: 'Mr. Robot',
    type: 'tv',
    categoryLabel: 'TV Show',
    artworkUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop',
    description:
      'Cyber-thriller following Elliot Alderson, a brilliant cybersecurity engineer and vigilante hacker suffering from anxiety and mental illness, recruited by a secret hacktivist group.',
    metadataChips: [
      { label: 'Creator', value: 'Sam Esmail' },
      { label: 'Seasons', value: '4 Seasons' },
      { label: 'Episodes', value: '45 Episodes' },
      { label: 'Status', value: 'Ended (2019)' },
    ],
    communityRating: {
      average: 4.9,
      count: 4120,
      distribution: { 5: 90, 4: 8, 3: 1, 2: 1, 1: 0 },
    },
  },

  'malcolm-in-the-middle': {
    id: 'malcolm-in-the-middle',
    name: 'Malcolm in the Middle',
    type: 'tv',
    categoryLabel: 'TV Show',
    artworkUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop',
    description:
      'Critically acclaimed sitcom focusing on a gifted middle child coping with his wildly chaotic, lower-middle-class family.',
    metadataChips: [
      { label: 'Creator', value: 'Linwood Boomer' },
      { label: 'Seasons', value: '7 Seasons' },
      { label: 'Episodes', value: '151 Episodes' },
      { label: 'Status', value: 'Ended (2006)' },
    ],
    communityRating: {
      average: 4.8,
      count: 2890,
      distribution: { 5: 84, 4: 13, 3: 2, 2: 1, 1: 0 },
    },
  },

  // ── Games ───────────────────────────────────────────────────────────────────
  'red-dead-redemption': {
    id: 'red-dead-redemption',
    name: 'Red Dead Redemption Franchise',
    type: 'game',
    categoryLabel: 'Game',
    artworkUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800&auto=format&fit=crop',
    description:
      'Western action-adventure epic chronicling the tragic sunset of the American outlaw era through Arthur Morgan and John Marston.',
    metadataChips: [
      { label: 'Developer', value: 'Rockstar Games' },
      { label: 'Publisher', value: 'Rockstar Games' },
      { label: 'Platforms', value: 'PS4, Xbox, PC, Switch' },
      { label: 'Release', value: '2010 - Present' },
      { label: 'Genre', value: 'Open World Western' },
    ],
    communityRating: {
      average: 5.0,
      count: 7890,
      distribution: { 5: 96, 4: 3, 3: 1, 2: 0, 1: 0 },
    },
  },

  'the-last-of-us': {
    id: 'the-last-of-us',
    name: 'The Last of Us Franchise',
    type: 'game',
    categoryLabel: 'Game',
    artworkUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop',
    description:
      'Post-apocalyptic narrative masterpiece chronicling the emotional bond between Joel and Ellie across a fungal pandemic America.',
    metadataChips: [
      { label: 'Developer', value: 'Naughty Dog' },
      { label: 'Publisher', value: 'Sony Interactive Ent.' },
      { label: 'Platforms', value: 'PlayStation, PC' },
      { label: 'Release', value: '2013 - Present' },
      { label: 'Genre', value: 'Action / Survival Horror' },
    ],
    communityRating: {
      average: 5.0,
      count: 8420,
      distribution: { 5: 95, 4: 4, 3: 1, 2: 0, 1: 0 },
    },
  },

  'resident-evil': {
    id: 'resident-evil',
    name: 'Resident Evil Franchise',
    type: 'game',
    categoryLabel: 'Game',
    artworkUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&auto=format&fit=crop',
    description:
      'Seminal survival horror franchise spanning viral outbreaks, bio-weapons, and iconic operatives fighting Umbrella Corporation.',
    metadataChips: [
      { label: 'Developer', value: 'Capcom' },
      { label: 'Publisher', value: 'Capcom' },
      { label: 'Platforms', value: 'Multi-Platform' },
      { label: 'Release', value: '1996 - Present' },
      { label: 'Genre', value: 'Survival Horror' },
    ],
    communityRating: {
      average: 4.9,
      count: 5120,
      distribution: { 5: 89, 4: 9, 3: 1, 2: 1, 1: 0 },
    },
  },

  'stardew-valley': {
    id: 'stardew-valley',
    name: 'Stardew Valley',
    type: 'game',
    categoryLabel: 'Game',
    artworkUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop',
    description:
      'Heartwarming farming simulation RPG created independently by ConcernedApe, inviting players to inherit an old farm plot and build a thriving rural community.',
    metadataChips: [
      { label: 'Developer', value: 'ConcernedApe' },
      { label: 'Publisher', value: 'ConcernedApe' },
      { label: 'Platforms', value: 'PC, Switch, Mobile, Consoles' },
      { label: 'Release', value: '2016' },
      { label: 'Genre', value: 'Farming Simulation / RPG' },
    ],
    communityRating: {
      average: 5.0,
      count: 9100,
      distribution: { 5: 97, 4: 2, 3: 1, 2: 0, 1: 0 },
    },
  },

  'silent-hill': {
    id: 'silent-hill',
    name: 'Silent Hill Franchise',
    type: 'game',
    categoryLabel: 'Game',
    artworkUrl: 'https://images.unsplash.com/photo-1579373903781-fd5c0c30c4cd?w=800&auto=format&fit=crop',
    description:
      'Psychological horror game series exploring otherworldly nightmare dimensions, internal grief, and surreal terror.',
    metadataChips: [
      { label: 'Developer', value: 'Konami / Team Silent' },
      { label: 'Publisher', value: 'Konami' },
      { label: 'Platforms', value: 'PlayStation, PC, Xbox' },
      { label: 'Release', value: '1999 - Present' },
      { label: 'Genre', value: 'Psychological Horror' },
    ],
    communityRating: {
      average: 4.8,
      count: 3780,
      distribution: { 5: 86, 4: 11, 3: 2, 2: 1, 1: 0 },
    },
  },

  // ── Directors & Authors ─────────────────────────────────────────────────────
  'christopher-nolan': {
    id: 'christopher-nolan',
    name: 'Christopher Nolan',
    type: 'director',
    categoryLabel: 'Director',
    artworkUrl: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=500&auto=format&fit=crop',
    description:
      'Acclaimed British-American filmmaker celebrated for non-linear storytelling, practical special effects, philosophical themes of time and memory, and cinematic scale.',
    metadataChips: [
      { label: 'Active Since', value: '1998' },
      { label: 'Nationality', value: 'British / American' },
      { label: 'Known For', value: 'Sci-Fi / Nonlinear Thrillers' },
      { label: 'Films Directed', value: '12 Feature Films' },
    ],
    communityRating: {
      average: 4.9,
      count: 6200,
      distribution: { 5: 92, 4: 6, 3: 1, 2: 1, 1: 0 },
    },
  },

  'george-orwell': {
    id: 'george-orwell',
    name: 'George Orwell',
    type: 'author',
    categoryLabel: 'Author',
    artworkUrl: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=500&auto=format&fit=crop',
    description:
      'English novelist, essayist, and critic famous for his lucid prose and social criticism opposing totalitarianism, exemplified by 1984 and Animal Farm.',
    metadataChips: [
      { label: 'Active Era', value: '1928 - 1950' },
      { label: 'Nationality', value: 'English' },
      { label: 'Genre', value: 'Dystopian / Political Satire' },
      { label: 'Famous Works', value: '1984, Animal Farm' },
    ],
    communityRating: {
      average: 4.9,
      count: 5410,
      distribution: { 5: 91, 4: 7, 3: 1, 2: 1, 1: 0 },
    },
  },
}
