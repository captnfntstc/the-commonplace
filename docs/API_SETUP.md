# API Setup

## Google Books

Current app status: works in the browser for public book search.

1. Go to Google Cloud Console.
2. Create or select a project.
3. Enable the Google Books API.
4. Optional for local testing: create an API key and restrict it later.

The app currently uses public volume search without a key.

## TMDB Movies And TV

Current app status: works after adding a TMDB API read access token.

1. Create a TMDB account.
2. Open TMDB developer settings.
3. Request/create API access.
4. Copy the API Read Access Token.
5. Add it to `.env.local`:

```env
VITE_TMDB_ACCESS_TOKEN=your_tmdb_read_access_token
```

## Music

Current app status: uses MusicBrainz for songs/albums and LRCLIB for lyrics.

MusicBrainz is open and does not need a key, but it asks apps to send a useful user agent/contact.

Add this to `.env.local`:

```env
VITE_APP_CONTACT=your_email@example.com
```

Lyrics are fetched only for songs after a song result is selected. Albums use a freeform passage field for now.

### Similar artists from Last.fm

Artist profiles use Last.fm's listener-based `artist.getSimilar` results as the
primary Similar Artists source. MusicBrainz genre/location matching and iTunes
remain automatic fallbacks when Last.fm is unavailable.

1. Create or sign in to a Last.fm account.
2. Create an API account/key at [Last.fm API](https://www.last.fm/api/account/create).
3. Add the server-only key to `.env.local`:

```env
LASTFM_API_KEY=your_lastfm_api_key
```

Do not prefix this value with `VITE_`; the browser calls the app's server proxy
and never receives the key. Add the same secret to the deployed service's
Environment settings. It is declared with `sync: false` in `render.yaml`.

### Band portraits from Fanart.tv

Band portraits use MusicBrainz to confirm that an artist is a `Group`, then use
the most recently uploaded `artistthumb` from Fanart.tv. Solo artists continue
to use Wikipedia, which is also the automatic fallback when a band has no
Fanart.tv image.

1. Create a Fanart.tv account and request a personal API key.
2. Add the server-only value to `.env.local`:

```env
FANART_TV_API_KEY=your_fanart_tv_personal_api_key
```

Do not prefix this value with `VITE_`; it is read only by the app's server-side
proxy. Add the same secret to the deployed service's Environment settings.

## IGDB Games

Game metadata and cover artwork come from IGDB through the app's server-side
proxy. The browser never receives the Twitch client secret. Steam remains a
fallback when IGDB is unavailable and supplies PC-specific metadata for Steam
records.

1. Sign in to the [Twitch Developer Console](https://dev.twitch.tv/console/apps),
   enable two-factor authentication, and register an application.
2. Create a client secret for the application.
3. Add both server-only values to `.env.local` for local development:

```env
IGDB_CLIENT_ID=your_twitch_application_client_id
IGDB_CLIENT_SECRET=your_twitch_application_client_secret
```

Do not prefix these values with `VITE_`; Vite-prefixed variables are included in
the browser bundle. For Render, configure the same two secrets in the service's
Environment settings. They are declared with `sync: false` in `render.yaml`.

The IGDB adapter groups versions, ports, and remasters under a canonical game.
Platform-specific dates appear in the release timeline, while remakes remain
separate games. Cancelled games are filtered from normal catalog and search
results.
