import type { EntryType } from '../entries/model'
import {
  type ProfileCollectionItem,
  profileCollectionItemIdentity,
} from './profileCollections'

const ALL_CATEGORY_TYPES: EntryType[] = ['book', 'film', 'tv', 'album', 'song', 'game']

/**
 * Curated high-quality trending works across all 6 media categories.
 * Each entry includes verified metadata and standard artwork URLs.
 */
export const TRENDING_COLLECTION_MEDIA: ProfileCollectionItem[] = [
  // --- BOOKS ---
  {
    id: 'trending:book:normal-people',
    type: 'book',
    title: 'Normal People',
    creator: 'Sally Rooney',
    provider: 'Open Library',
    providerId: 'OL17860771W',
    year: '2018',
    genre: 'Fiction, Romance, Drama',
    coverUrl: 'https://covers.openlibrary.org/b/id/10292724-L.jpg',
  },
  {
    id: 'trending:book:tomorrow-tomorrow',
    type: 'book',
    title: 'Tomorrow, and Tomorrow, and Tomorrow',
    creator: 'Gabrielle Zevin',
    provider: 'Open Library',
    providerId: 'OL24623101W',
    year: '2022',
    genre: 'Fiction, Drama, Video Games',
    coverUrl: 'https://covers.openlibrary.org/b/id/12843477-L.jpg',
  },
  {
    id: 'trending:book:dune',
    type: 'book',
    title: 'Dune',
    creator: 'Frank Herbert',
    provider: 'Open Library',
    providerId: 'OL893415W',
    year: '1965',
    genre: 'Science Fiction, Epic',
    coverUrl: 'https://covers.openlibrary.org/b/id/11153217-L.jpg',
  },
  {
    id: 'trending:book:secret-history',
    type: 'book',
    title: 'The Secret History',
    creator: 'Donna Tartt',
    provider: 'Open Library',
    providerId: 'OL27479W',
    year: '1992',
    genre: 'Dark Academia, Mystery',
    coverUrl: 'https://covers.openlibrary.org/b/id/8314134-L.jpg',
  },
  {
    id: 'trending:book:crying-in-h-mart',
    type: 'book',
    title: 'Crying in H Mart',
    creator: 'Michelle Zauner',
    provider: 'Open Library',
    providerId: 'OL20888258W',
    year: '2021',
    genre: 'Memoir, Biography',
    coverUrl: 'https://covers.openlibrary.org/b/id/10708942-L.jpg',
  },
  {
    id: 'trending:book:piranesi',
    type: 'book',
    title: 'Piranesi',
    creator: 'Susanna Clarke',
    provider: 'Open Library',
    providerId: 'OL20152427W',
    year: '2020',
    genre: 'Fantasy, Mystery, Literary',
    coverUrl: 'https://covers.openlibrary.org/b/id/10389349-L.jpg',
  },
  {
    id: 'trending:book:kafka-on-the-shore',
    type: 'book',
    title: 'Kafka on the Shore',
    creator: 'Haruki Murakami',
    provider: 'Open Library',
    providerId: 'OL262758W',
    year: '2002',
    genre: 'Magical Realism, Fiction',
    coverUrl: 'https://covers.openlibrary.org/b/id/8774144-L.jpg',
  },
  {
    id: 'trending:book:yellowface',
    type: 'book',
    title: 'Yellowface',
    creator: 'R.F. Kuang',
    provider: 'Open Library',
    providerId: 'OL27918541W',
    year: '2023',
    genre: 'Satire, Thriller, Fiction',
    coverUrl: 'https://covers.openlibrary.org/b/id/13444087-L.jpg',
  },
  {
    id: 'trending:book:intermezzo',
    type: 'book',
    title: 'Intermezzo',
    creator: 'Sally Rooney',
    provider: 'Open Library',
    providerId: 'OL36789124W',
    year: '2024',
    genre: 'Literary Fiction, Drama',
    coverUrl: 'https://covers.openlibrary.org/b/id/14589230-L.jpg',
  },
  {
    id: 'trending:book:klara-and-the-sun',
    type: 'book',
    title: 'Klara and the Sun',
    creator: 'Kazuo Ishiguro',
    provider: 'Open Library',
    providerId: 'OL20630732W',
    year: '2021',
    genre: 'Sci-Fi, Literary Fiction',
    coverUrl: 'https://covers.openlibrary.org/b/id/10542385-L.jpg',
  },
  {
    id: 'trending:book:1984',
    type: 'book',
    title: '1984',
    creator: 'George Orwell',
    provider: 'Open Library',
    providerId: 'OL1168083W',
    year: '1949',
    genre: 'Dystopian, Classic, Political',
    coverUrl: 'https://covers.openlibrary.org/b/id/7222246-L.jpg',
  },
  {
    id: 'trending:book:on-earth-were-briefly-gorgeous',
    type: 'book',
    title: "On Earth We're Briefly Gorgeous",
    creator: 'Ocean Vuong',
    provider: 'Open Library',
    providerId: 'OL19525419W',
    year: '2019',
    genre: 'Literary Fiction, Poetry, Memoir',
    coverUrl: 'https://covers.openlibrary.org/b/id/9255566-L.jpg',
  },

  // --- FILMS ---
  {
    id: 'trending:film:past-lives',
    type: 'film',
    title: 'Past Lives',
    creator: 'Celine Song',
    provider: 'TMDB',
    providerId: '666277',
    year: '2023',
    genre: 'Romance, Drama',
    coverUrl: 'https://image.tmdb.org/t/p/w500/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg',
  },
  {
    id: 'trending:film:aftersun',
    type: 'film',
    title: 'Aftersun',
    creator: 'Charlotte Wells',
    provider: 'TMDB',
    providerId: '965150',
    year: '2022',
    genre: 'Drama',
    coverUrl: 'https://image.tmdb.org/t/p/w500/evKz85EKouVbIr51zy5fOtpNRPg.jpg',
  },
  {
    id: 'trending:film:challengers',
    type: 'film',
    title: 'Challengers',
    creator: 'Luca Guadagnino',
    provider: 'TMDB',
    providerId: '937287',
    year: '2024',
    genre: 'Drama, Sport, Romance',
    coverUrl: 'https://image.tmdb.org/t/p/w500/H6vke7zGiuLsz4v4RPeReb9rsv.jpg',
  },
  {
    id: 'trending:film:dune-part-two',
    type: 'film',
    title: 'Dune: Part Two',
    creator: 'Denis Villeneuve',
    provider: 'TMDB',
    providerId: '693134',
    year: '2024',
    genre: 'Science Fiction, Adventure',
    coverUrl: 'https://image.tmdb.org/t/p/w500/6izwz7rsy95ARzTR3poZ8H6c5pp.jpg',
  },
  {
    id: 'trending:film:everything-everywhere',
    type: 'film',
    title: 'Everything Everywhere All At Once',
    creator: 'Daniels',
    provider: 'TMDB',
    providerId: '545611',
    year: '2022',
    genre: 'Action, Adventure, Sci-Fi',
    coverUrl: 'https://image.tmdb.org/t/p/w500/u68AjlvlutfEIcpmbYpKcdi09ut.jpg',
  },
  {
    id: 'trending:film:anatomy-of-a-fall',
    type: 'film',
    title: 'Anatomy of a Fall',
    creator: 'Justine Triet',
    provider: 'TMDB',
    providerId: '915935',
    year: '2023',
    genre: 'Thriller, Mystery, Drama',
    coverUrl: 'https://image.tmdb.org/t/p/w500/1ho0d4LNZw3Y0voeKmSvPSgJOJ2.jpg',
  },
  {
    id: 'trending:film:portrait-of-a-lady',
    type: 'film',
    title: 'Portrait of a Lady on Fire',
    creator: 'Céline Sciamma',
    provider: 'TMDB',
    providerId: '531428',
    year: '2019',
    genre: 'Romance, Drama, History',
    coverUrl: 'https://image.tmdb.org/t/p/w500/2LquGwEhbg3soxSCs9VNyh5VJd9.jpg',
  },
  {
    id: 'trending:film:oppenheimer',
    type: 'film',
    title: 'Oppenheimer',
    creator: 'Christopher Nolan',
    provider: 'TMDB',
    providerId: '872585',
    year: '2023',
    genre: 'Biography, Drama, History',
    coverUrl: 'https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
  },
  {
    id: 'trending:film:parasite',
    type: 'film',
    title: 'Parasite',
    creator: 'Bong Joon-ho',
    provider: 'TMDB',
    providerId: '496243',
    year: '2019',
    genre: 'Thriller, Comedy, Drama',
    coverUrl: 'https://image.tmdb.org/t/p/w500/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg',
  },
  {
    id: 'trending:film:drive-my-car',
    type: 'film',
    title: 'Drive My Car',
    creator: 'Ryusuke Hamaguchi',
    provider: 'TMDB',
    providerId: '758866',
    year: '2021',
    genre: 'Drama',
    coverUrl: 'https://image.tmdb.org/t/p/w500/znXps7wPyYq8UDCfeyO2vfEIeRS.jpg',
  },
  {
    id: 'trending:film:the-zone-of-interest',
    type: 'film',
    title: 'The Zone of Interest',
    creator: 'Jonathan Glazer',
    provider: 'TMDB',
    providerId: '467244',
    year: '2023',
    genre: 'Drama, War, History',
    coverUrl: 'https://image.tmdb.org/t/p/w500/hUu9zyZmDd8VZegKi1iK1Vk0RYS.jpg',
  },
  {
    id: 'trending:film:la-la-land',
    type: 'film',
    title: 'La La Land',
    creator: 'Damien Chazelle',
    provider: 'TMDB',
    providerId: '313369',
    year: '2016',
    genre: 'Musical, Drama, Romance',
    coverUrl: 'https://image.tmdb.org/t/p/w500/uDO8zWDhfWwoFdKS4fzkUJt0Rf0.jpg',
  },

  // --- TV SHOWS ---
  {
    id: 'trending:tv:succession',
    type: 'tv',
    title: 'Succession',
    creator: 'Jesse Armstrong',
    provider: 'TMDB',
    providerId: '76331',
    year: '2018',
    genre: 'Drama',
    coverUrl: 'https://image.tmdb.org/t/p/w500/z0XiwdrCQ9yVIr4O0pxzaAYRxdW.jpg',
  },
  {
    id: 'trending:tv:the-bear',
    type: 'tv',
    title: 'The Bear',
    creator: 'Christopher Storer',
    provider: 'TMDB',
    providerId: '136315',
    year: '2022',
    genre: 'Comedy, Drama',
    coverUrl: 'https://image.tmdb.org/t/p/w500/eKfVzzEazSIjJMrw9ADa2x8ksLz.jpg',
  },
  {
    id: 'trending:tv:severance',
    type: 'tv',
    title: 'Severance',
    creator: 'Dan Erickson',
    provider: 'TMDB',
    providerId: '95396',
    year: '2022',
    genre: 'Sci-Fi, Thriller, Mystery',
    coverUrl: 'https://image.tmdb.org/t/p/w500/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg',
  },
  {
    id: 'trending:tv:fleabag',
    type: 'tv',
    title: 'Fleabag',
    creator: 'Phoebe Waller-Bridge',
    provider: 'TMDB',
    providerId: '67070',
    year: '2016',
    genre: 'Comedy, Drama',
    coverUrl: 'https://image.tmdb.org/t/p/w500/vFn0nLPcIggPH5LTWWaJ2hcsGlc.jpg',
  },
  {
    id: 'trending:tv:shogun',
    type: 'tv',
    title: 'Shōgun',
    creator: 'Rachel Kondo & Justin Marks',
    provider: 'TMDB',
    providerId: '126308',
    year: '2024',
    genre: 'Drama, History, War',
    coverUrl: 'https://image.tmdb.org/t/p/w500/7O4iVfOMQmdCSxhOg1WnzG1AgYT.jpg',
  },
  {
    id: 'trending:tv:the-white-lotus',
    type: 'tv',
    title: 'The White Lotus',
    creator: 'Mike White',
    provider: 'TMDB',
    providerId: '111803',
    year: '2021',
    genre: 'Comedy, Drama, Mystery',
    coverUrl: 'https://image.tmdb.org/t/p/w500/gbSaK9v1CbcYH1ISgbM7XObD2dW.jpg',
  },
  {
    id: 'trending:tv:arcane',
    type: 'tv',
    title: 'Arcane',
    creator: 'Christian Linke & Alex Yee',
    provider: 'TMDB',
    providerId: '94605',
    year: '2021',
    genre: 'Animation, Sci-Fi, Action',
    coverUrl: 'https://image.tmdb.org/t/p/w500/87C0wecB8bHb1PsrKBI4kJiEkgV.jpg',
  },
  {
    id: 'trending:tv:normal-people',
    type: 'tv',
    title: 'Normal People',
    creator: 'Lenny Abrahamson',
    provider: 'TMDB',
    providerId: '89905',
    year: '2020',
    genre: 'Drama, Romance',
    coverUrl: 'https://image.tmdb.org/t/p/w500/tbKSsFd4ImzUgbYolttkq4pmOPQ.jpg',
  },
  {
    id: 'trending:tv:beef',
    type: 'tv',
    title: 'Beef',
    creator: 'Lee Sung Jin',
    provider: 'TMDB',
    providerId: '154385',
    year: '2023',
    genre: 'Comedy, Drama',
    coverUrl: 'https://image.tmdb.org/t/p/w500/25ih0Xq2zWbxhhKxwhvswKYQyEr.jpg',
  },
  {
    id: 'trending:tv:ripley',
    type: 'tv',
    title: 'Ripley',
    creator: 'Steven Zaillian',
    provider: 'TMDB',
    providerId: '94028',
    year: '2024',
    genre: 'Crime, Drama, Thriller',
    coverUrl: 'https://image.tmdb.org/t/p/w500/rpSo8z9alultGVTqQ3dkLEyU8xx.jpg',
  },
  {
    id: 'trending:tv:better-call-saul',
    type: 'tv',
    title: 'Better Call Saul',
    creator: 'Vince Gilligan & Peter Gould',
    provider: 'TMDB',
    providerId: '60059',
    year: '2015',
    genre: 'Crime, Drama',
    coverUrl: 'https://image.tmdb.org/t/p/w500/fC2HDm5t0kHl7mTm7jxMR31b7by.jpg',
  },
  {
    id: 'trending:tv:slow-horses',
    type: 'tv',
    title: 'Slow Horses',
    creator: 'Mick Herron & Will Smith',
    provider: 'TMDB',
    providerId: '95480',
    year: '2022',
    genre: 'Spy, Thriller, Drama',
    coverUrl: 'https://image.tmdb.org/t/p/w500/AdYr4DjOgXvDUMwu6vEhZy1Rnxk.jpg',
  },

  // --- ALBUMS ---
  {
    id: 'trending:album:punisher',
    type: 'album',
    title: 'Punisher',
    creator: 'Phoebe Bridgers',
    provider: 'Apple Music',
    providerId: '1504699857',
    year: '2020',
    genre: 'Indie Rock, Singer-Songwriter',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/5a/5d/1f/5a5d1fde-7f6f-9997-3bca-d75f1e799464/656605154565.jpg/600x600bb.jpg',
  },
  {
    id: 'trending:album:melodrama',
    type: 'album',
    title: 'Melodrama',
    creator: 'Lorde',
    provider: 'Apple Music',
    providerId: '1211014837',
    year: '2017',
    genre: 'Pop, Art Pop',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music127/v4/59/61/63/59616302-d6e9-1d2d-f5e5-01f8f6eb6095/707541069335.jpg/600x600bb.jpg',
  },
  {
    id: 'trending:album:blonde',
    type: 'album',
    title: 'Blonde',
    creator: 'Frank Ocean',
    provider: 'Apple Music',
    providerId: '1146195596',
    year: '2016',
    genre: 'R&B, Soul, Neo-Soul',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg',
  },
  {
    id: 'trending:album:nfr',
    type: 'album',
    title: 'Norman Fucking Rockwell!',
    creator: 'Lana Del Rey',
    provider: 'Apple Music',
    providerId: '1474669063',
    year: '2019',
    genre: 'Alternative, Soft Rock, Pop',
    explicit: true,
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/97/8b/86/978b868f-cf69-2930-7fa7-97bd8504de48/5063113143496_cover.jpg/600x600bb.jpg',
  },
  {
    id: 'trending:album:the-record',
    type: 'album',
    title: 'the record',
    creator: 'boygenius',
    provider: 'Apple Music',
    providerId: '1664985923',
    year: '2023',
    genre: 'Indie Rock, Alternative',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/4c/b6/e5/4cb6e5b1-2db0-88c0-f025-b79cad3b8fab/196873832111.jpg/600x600bb.jpg',
  },
  {
    id: 'trending:album:guts',
    type: 'album',
    title: 'GUTS',
    creator: 'Olivia Rodrigo',
    provider: 'Apple Music',
    providerId: '1694386888',
    year: '2023',
    genre: 'Pop Rock, Alternative',
    explicit: true,
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/9e/0d/17/9e0d17e0-c068-fbd9-fd85-610cc87c86aa/23UMGIM71511.rgb.jpg/600x600bb.jpg',
  },
  {
    id: 'trending:album:brat',
    type: 'album',
    title: 'Brat',
    creator: 'Charli xcx',
    provider: 'Apple Music',
    providerId: '1733618196',
    year: '2024',
    genre: 'Dance-pop, Hyperpop',
    explicit: true,
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/1a/5c/e9/1a5ce93c-aef4-6667-b7d1-7162203e1c39/190295229993.jpg/600x600bb.jpg',
  },
  {
    id: 'trending:album:in-rainbows',
    type: 'album',
    title: 'In Rainbows',
    creator: 'Radiohead',
    provider: 'Apple Music',
    providerId: '1109714933',
    year: '2007',
    genre: 'Art Rock, Alternative',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg',
  },
  {
    id: 'trending:album:folklore',
    type: 'album',
    title: 'Folklore',
    creator: 'Taylor Swift',
    provider: 'Apple Music',
    providerId: '1524806357',
    year: '2020',
    genre: 'Indie Folk, Alternative',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/8c/ef/c2/8cefc23a-61b7-05ff-b52a-bb1e4922087c/20UMGIM64216.rgb.jpg/600x600bb.jpg',
  },
  {
    id: 'trending:album:titanic-rising',
    type: 'album',
    title: 'Titanic Rising',
    creator: 'Weyes Blood',
    provider: 'Apple Music',
    providerId: '1450550389',
    year: '2019',
    genre: 'Baroque Pop, Chamber Pop',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/54/f6/fc/54f6fc73-6a18-d97a-a634-a4630ec35593/WeyesBlood_TitanicRising_3600.jpg/600x600bb.jpg',
  },
  {
    id: 'trending:album:igor',
    type: 'album',
    title: 'IGOR',
    creator: 'Tyler, The Creator',
    provider: 'Apple Music',
    providerId: '1463409338',
    year: '2019',
    genre: 'Hip Hop, Neo-Soul',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/a8/df/7d/a8df7d1e-0a11-6228-61af-3230783a9485/886447419601.jpg/600x600bb.jpg',
  },
  {
    id: 'trending:album:ocean-blvd',
    type: 'album',
    title: "Did you know that there's a tunnel under Ocean Blvd",
    creator: 'Lana Del Rey',
    provider: 'Apple Music',
    providerId: '1658428801',
    year: '2023',
    genre: 'Alternative Pop, Chamber Pop',
    explicit: true,
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/b0/c0/32/b0c032c5-4a44-1d57-bf8e-64b4e8110bcf/198009561926.png/600x600bb.jpg',
  },

  // --- SONGS ---
  {
    id: 'trending:song:kyoto',
    type: 'song',
    title: 'Kyoto',
    creator: 'Phoebe Bridgers',
    provider: 'Apple Music',
    providerId: '1504699863',
    year: '2020',
    genre: 'Indie Rock',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/39/91/4f/39914f60-e9aa-4ae9-3962-44b0a5e5d570/656605150062.jpg/600x600bb.jpg',
  },
  {
    id: 'trending:song:motion-sickness',
    type: 'song',
    title: 'Motion Sickness',
    creator: 'Phoebe Bridgers',
    provider: 'Apple Music',
    providerId: '1256338421',
    year: '2017',
    genre: 'Indie Rock',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/20/4c/6e/204c6ef3-8e95-4cee-2256-202ca62aebed/60220.jpg/600x600bb.jpg',
  },
  {
    id: 'trending:song:pink-white',
    type: 'song',
    title: 'Pink + White',
    creator: 'Frank Ocean',
    provider: 'Apple Music',
    providerId: '1146195599',
    year: '2016',
    genre: 'R&B, Soul',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/bb/45/68/bb4568f3-68cd-619d-fbcb-4e179916545d/BlondCover-Final.jpg/600x600bb.jpg',
  },
  {
    id: 'trending:song:ribs',
    type: 'song',
    title: 'Ribs',
    creator: 'Lorde',
    provider: 'Apple Music',
    providerId: '1440818588',
    year: '2013',
    genre: 'Art Pop, Indie Pop',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/96/a5/09/96a50916-169b-724c-b722-b8c474406352/13UAAIM68691.rgb.jpg/600x600bb.jpg',
  },
  {
    id: 'trending:song:not-strong-enough',
    type: 'song',
    title: 'Not Strong Enough',
    creator: 'boygenius',
    provider: 'Apple Music',
    providerId: '1664986241',
    year: '2023',
    genre: 'Indie Rock',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music123/v4/ad/fc/81/adfc819e-00b2-3cb5-deb2-931a5b6da3fa/22UM1IM44998.rgb.jpg/600x600bb.jpg',
  },
  {
    id: 'trending:song:vampire',
    type: 'song',
    title: 'vampire',
    creator: 'Olivia Rodrigo',
    provider: 'Apple Music',
    providerId: '1694386889',
    year: '2023',
    genre: 'Pop Rock, Alternative',
    explicit: true,
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/08/9e/07/089e0799-b405-9e69-b648-e6a19df9879c/24UMGIM30485.rgb.jpg/600x600bb.jpg',
  },
  {
    id: 'trending:song:venice-bitch',
    type: 'song',
    title: 'Venice Bitch',
    creator: 'Lana Del Rey',
    provider: 'Apple Music',
    providerId: '1474669066',
    year: '2018',
    genre: 'Psychedelic Pop, Soft Rock',
    explicit: true,
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/18/3f/ad/183fadf3-0d36-6db2-b733-d8f032654b07/14UMGIM20562.rgb.jpg/600x600bb.jpg',
  },
  {
    id: 'trending:song:360',
    type: 'song',
    title: '360',
    creator: 'Charli xcx',
    provider: 'Apple Music',
    providerId: '1733618197',
    year: '2024',
    genre: 'Dance-pop, Hyperpop',
    explicit: true,
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/7e/d5/09/7ed50926-eadd-40a8-cf87-85c17f212bb4/075679634283.jpg/600x600bb.jpg',
  },
  {
    id: 'trending:song:cardigan',
    type: 'song',
    title: 'cardigan',
    creator: 'Taylor Swift',
    provider: 'Apple Music',
    providerId: '1524806359',
    year: '2020',
    genre: 'Indie Folk',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/ca/f3/67/caf367a5-2cf6-6b2e-a891-97dc57b19f08/20UMGIM64216.rgb.jpg/600x600bb.jpg',
  },
  {
    id: 'trending:song:apocalypse',
    type: 'song',
    title: 'Apocalypse',
    creator: 'Cigarettes After Sex',
    provider: 'Apple Music',
    providerId: '1217524971',
    year: '2017',
    genre: 'Dream Pop, Ambient Pop',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/b3/5e/0f/b35e0fbe-2370-fc48-0f0c-977525e93bf2/720841214601_Cover.jpg/600x600bb.jpg',
  },
  {
    id: 'trending:song:mystery-of-love',
    type: 'song',
    title: 'Mystery of Love',
    creator: 'Sufjan Stevens',
    provider: 'Apple Music',
    providerId: '1301395344',
    year: '2017',
    genre: 'Indie Folk',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music128/v4/06/92/3c/06923c8d-1524-b097-1779-b7aebbd6aec2/CMBYN_Mystery_of_Love_Digital_Cover.jpg/600x600bb.jpg',
  },
  {
    id: 'trending:song:weird-fishes',
    type: 'song',
    title: 'Weird Fishes/Arpeggi',
    creator: 'Radiohead',
    provider: 'Apple Music',
    providerId: '1109714937',
    year: '2007',
    genre: 'Art Rock, Alternative',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg',
  },

  // --- GAMES ---
  {
    id: 'trending:game:hades',
    type: 'game',
    title: 'Hades',
    creator: 'Supergiant Games',
    provider: 'Steam',
    providerId: '1145360',
    year: '2020',
    genre: 'Roguelike, Action RPG',
    coverUrl: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1145360/header.jpg',
  },
  {
    id: 'trending:game:elden-ring',
    type: 'game',
    title: 'Elden Ring',
    creator: 'FromSoftware',
    provider: 'Steam',
    providerId: '1245620',
    year: '2022',
    genre: 'Action RPG, Open World',
    coverUrl: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1245620/header.jpg',
  },
  {
    id: 'trending:game:baldurs-gate-3',
    type: 'game',
    title: "Baldur's Gate 3",
    creator: 'Larian Studios',
    provider: 'Steam',
    providerId: '1086940',
    year: '2023',
    genre: 'RPG, Strategy',
    coverUrl: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1086940/header.jpg',
  },
  {
    id: 'trending:game:last-of-us',
    type: 'game',
    title: 'The Last of Us Part I',
    creator: 'Naughty Dog',
    provider: 'Steam',
    providerId: '1888930',
    year: '2022',
    genre: 'Action-Adventure, Narrative',
    coverUrl: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1888930/header.jpg',
  },
  {
    id: 'trending:game:hollow-knight',
    type: 'game',
    title: 'Hollow Knight',
    creator: 'Team Cherry',
    provider: 'Steam',
    providerId: '367520',
    year: '2017',
    genre: 'Metroidvania, Action-Adventure',
    coverUrl: 'https://cdn.cloudflare.steamstatic.com/steam/apps/367520/header.jpg',
  },
  {
    id: 'trending:game:celeste',
    type: 'game',
    title: 'Celeste',
    creator: 'Maddy Makes Games',
    provider: 'Steam',
    providerId: '504230',
    year: '2018',
    genre: 'Platformer, Indie',
    coverUrl: 'https://cdn.cloudflare.steamstatic.com/steam/apps/504230/header.jpg',
  },
  {
    id: 'trending:game:outer-wilds',
    type: 'game',
    title: 'Outer Wilds',
    creator: 'Mobius Digital',
    provider: 'Steam',
    providerId: '753640',
    year: '2019',
    genre: 'Adventure, Sci-Fi, Mystery',
    coverUrl: 'https://cdn.cloudflare.steamstatic.com/steam/apps/753640/header.jpg',
  },
  {
    id: 'trending:game:disco-elysium',
    type: 'game',
    title: 'Disco Elysium',
    creator: 'ZA/UM',
    provider: 'Steam',
    providerId: '632470',
    year: '2019',
    genre: 'RPG, Narrative, Mystery',
    coverUrl: 'https://cdn.cloudflare.steamstatic.com/steam/apps/632470/header.jpg',
  },
  {
    id: 'trending:game:cyberpunk-2077',
    type: 'game',
    title: 'Cyberpunk 2077',
    creator: 'CD Projekt Red',
    provider: 'Steam',
    providerId: '1091500',
    year: '2020',
    genre: 'Action RPG, Cyberpunk, Open World',
    coverUrl: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1091500/header.jpg',
  },
  {
    id: 'trending:game:rdr2',
    type: 'game',
    title: 'Red Dead Redemption 2',
    creator: 'Rockstar Games',
    provider: 'Steam',
    providerId: '1174180',
    year: '2018',
    genre: 'Action-Adventure, Open World',
    coverUrl: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1174180/header.jpg',
  },
  {
    id: 'trending:game:death-stranding',
    type: 'game',
    title: 'Death Stranding',
    creator: 'Kojima Productions',
    provider: 'Steam',
    providerId: '1850570',
    year: '2019',
    genre: 'Action, Sci-Fi, Exploration',
    coverUrl: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1850570/header.jpg',
  },
  {
    id: 'trending:game:nier-automata',
    type: 'game',
    title: 'NieR:Automata',
    creator: 'Square Enix',
    provider: 'Steam',
    providerId: '524220',
    year: '2017',
    genre: 'Action RPG, Sci-Fi',
    coverUrl: 'https://cdn.cloudflare.steamstatic.com/steam/apps/524220/header.jpg',
  },
]

/**
 * Normalization helper for strings.
 */
function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Related creator affinity graph to connect related artists, authors, directors, and studios.
 */
const CREATOR_AFFINITIES: Record<string, string[]> = {
  'phoebe bridgers': ['boygenius', 'lucy dacus', 'julien baker', 'lorde', 'taylor swift', 'clairo', 'sufjan stevens'],
  'boygenius': ['phoebe bridgers', 'lucy dacus', 'julien baker', 'lorde', 'taylor swift'],
  'lorde': ['bleachers', 'jack antonoff', 'taylor swift', 'lana del rey', 'olivia rodrigo', 'phoebe bridgers', 'charli xcx'],
  'lana del rey': ['taylor swift', 'lorde', 'weyes blood', 'billie eilish', 'cigarettes after sex', 'jack antonoff'],
  'olivia rodrigo': ['taylor swift', 'lorde', 'phoebe bridgers', 'billie eilish', 'chappell roan'],
  'frank ocean': ['tyler the creator', 'kendrick lamar', 'sza', 'daniel caesar', 'steve lacy', 'radiohead'],
  'charli xcx': ['lorde', 'caroline polachek', 'sophie', 'troye sivan', 'billie eilish'],
  'radiohead': ['thom yorke', 'the smile', 'sufjan stevens', 'frank ocean'],
  'taylor swift': ['phoebe bridgers', 'aaron dessner', 'jack antonoff', 'bon iver', 'olivia rodrigo', 'lana del rey', 'lorde'],
  'sally rooney': ['donna tartt', 'ocean vuong', 'kazuo ishiguro', 'michelle zauner', 'susanna clarke', 'lenny abrahamson'],
  'donna tartt': ['sally rooney', 'kazuo ishiguro', 'susanna clarke', 'haruki murakami'],
  'frank herbert': ['denis villeneuve', 'george orwell', 'isaac asimov', 'christopher nolan'],
  'denis villeneuve': ['christopher nolan', 'frank herbert', 'dan erickson', 'charlotte wells', 'celine song'],
  'christopher nolan': ['denis villeneuve', 'dan erickson', 'bong joon ho', 'jonathan glazer'],
  'celine song': ['charlotte wells', 'luca guadagnino', 'celine sciamma', 'justine triet'],
  'charlotte wells': ['celine song', 'celine sciamma', 'luca guadagnino'],
  'luca guadagnino': ['charlotte wells', 'celine song', 'celine sciamma', 'damien chazelle'],
  'celine sciamma': ['celine song', 'charlotte wells', 'luca guadagnino', 'justine triet'],
  'jesse armstrong': ['christopher storer', 'dan erickson', 'vince gilligan', 'mick herron'],
  'christopher storer': ['jesse armstrong', 'dan erickson', 'lee sung jin', 'mike white'],
  'dan erickson': ['jesse armstrong', 'christopher nolan', 'denis villeneuve', 'christopher storer'],
  'supergiant games': ['team cherry', 'maddy makes games', 'za um', 'mobius digital', 'fromsoftware'],
  'team cherry': ['supergiant games', 'maddy makes games', 'mobius digital', 'fromsoftware'],
  'fromsoftware': ['team cherry', 'supergiant games', 'larian studios', 'kojima productions'],
  'larian studios': ['fromsoftware', 'za um', 'cd projekt red', 'naughty dog'],
  'za um': ['larian studios', 'mobius digital', 'team cherry', 'supergiant games'],
  'mobius digital': ['team cherry', 'maddy makes games', 'za um', 'supergiant games'],
  'naughty dog': ['fromsoftware', 'cd projekt red', 'rockstar games', 'kojima productions'],
}

/**
 * Score a candidate item against a set of items already in the collection.
 */
function scoreCandidate(
  candidate: ProfileCollectionItem,
  baseCreators: Set<string>,
  baseAffinityCreators: Set<string>,
  baseGenreTokens: Set<string>,
  baseTitles: Set<string>,
  baseTypes: Set<string>,
  rankIndex: number,
): number {
  // Baseline score from curated trending order (100 down to 0)
  let score = Math.max(1, 100 - rankIndex)

  const candidateCreatorNorm = normalizeText(candidate.creator)
  const candidateTitleNorm = normalizeText(candidate.title)
  const candidateGenreTokens = new Set(normalizeText(candidate.genre || '').split(/\s+/).filter(Boolean))

  // Exact creator match
  if (baseCreators.has(candidateCreatorNorm)) {
    score += 150
  }

  // Related creator affinity
  if (baseAffinityCreators.has(candidateCreatorNorm)) {
    score += 80
  }

  // Cross-media counterpart (e.g. Dune book <-> Dune film, Normal People book <-> Normal People show)
  if (baseTitles.has(candidateTitleNorm)) {
    score += 200
  }

  // Genre overlap
  let genreMatches = 0
  for (const token of candidateGenreTokens) {
    if (token.length > 2 && baseGenreTokens.has(token)) {
      genreMatches += 1
    }
  }
  score += Math.min(60, genreMatches * 15)

  // Media type resonance
  if (baseTypes.has(candidate.type)) {
    score += 10
  }

  return score
}

/**
 * Generates smart collection suggestions.
 *
 * Rules:
 * 1. Does NOT source from the user's home library ("Your Library" abolished).
 * 2. Suggests items based on what is currently in the collection (creators, genres, affinities).
 * 3. If collection is empty, suggests curated trending items.
 * 4. Excludes items that are already in the collection.
 * 5. In "all" category: guarantees AT LEAST ONE item of EVERY category ('book', 'film', 'tv', 'album', 'song', 'game').
 * 6. In a specific category: returns EXACTLY 8 items of that category.
 */
export function getCollectionSuggestions(
  existingItems: ProfileCollectionItem[] = [],
  categoryFilter: 'all' | EntryType = 'all',
): ProfileCollectionItem[] {
  const existingIdentities = new Set(
    existingItems.map((item) => profileCollectionItemIdentity(item)),
  )

  // Extract features from existing items in collection
  const baseCreators = new Set<string>()
  const baseAffinityCreators = new Set<string>()
  const baseGenreTokens = new Set<string>()
  const baseTitles = new Set<string>()
  const baseTypes = new Set<string>()

  for (const item of existingItems) {
    const creatorNorm = normalizeText(item.creator)
    if (creatorNorm) {
      baseCreators.add(creatorNorm)
      const affinities = CREATOR_AFFINITIES[creatorNorm]
      if (affinities) {
        affinities.forEach((aff) => baseAffinityCreators.add(normalizeText(aff)))
      }
    }
    const titleNorm = normalizeText(item.title)
    if (titleNorm) {
      baseTitles.add(titleNorm)
    }
    if (item.genre) {
      normalizeText(item.genre)
        .split(/\s+/)
        .filter((w) => w.length > 2)
        .forEach((token) => baseGenreTokens.add(token))
    }
    baseTypes.add(item.type)
  }

  // Filter out any candidates that already exist in the collection
  const availableCandidates = TRENDING_COLLECTION_MEDIA.filter(
    (item) => !existingIdentities.has(profileCollectionItemIdentity(item)),
  )

  // Score all available candidates
  const scoredCandidates = availableCandidates.map((item, index) => ({
    item,
    score: scoreCandidate(
      item,
      baseCreators,
      baseAffinityCreators,
      baseGenreTokens,
      baseTitles,
      baseTypes,
      index,
    ),
  }))

  // If a specific category is selected: return exactly 8 items of that category
  if (categoryFilter !== 'all') {
    const categoryMatches = scoredCandidates
      .filter(({ item }) => item.type === categoryFilter)
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item)

    return categoryMatches.slice(0, 8)
  }

  // If "all" category: must have AT LEAST ONE item of EVERY category ('book', 'film', 'tv', 'album', 'song', 'game')
  const pickedItems: ProfileCollectionItem[] = []
  const pickedIdentities = new Set<string>()

  // 1. Pick the highest-scoring candidate for each of the 6 categories
  for (const catType of ALL_CATEGORY_TYPES) {
    const bestInCat = scoredCandidates
      .filter(({ item }) => item.type === catType && !pickedIdentities.has(profileCollectionItemIdentity(item)))
      .sort((a, b) => b.score - a.score)[0]

    if (bestInCat) {
      pickedItems.push(bestInCat.item)
      pickedIdentities.add(profileCollectionItemIdentity(bestInCat.item))
    }
  }

  // 2. Pick the top remaining candidates across any category to reach a clean, scroll-free 8 items
  const remainingCandidates = scoredCandidates
    .filter(({ item }) => !pickedIdentities.has(profileCollectionItemIdentity(item)))
    .sort((a, b) => b.score - a.score)

  for (const { item } of remainingCandidates) {
    if (pickedItems.length >= 8) break
    pickedItems.push(item)
    pickedIdentities.add(profileCollectionItemIdentity(item))
  }

  // Score map to sort picked items by relevance so top matching recommendations appear first
  const scoreMap = new Map(scoredCandidates.map((c) => [c.item.id, c.score]))
  return pickedItems.sort((a, b) => (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0))
}
