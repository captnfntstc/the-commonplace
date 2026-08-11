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

## IGDB Games

Current app status: needs a backend proxy.

Do not put IGDB/Twitch secrets in Vite browser env variables. The frontend expects a proxy endpoint:

```env
VITE_METADATA_PROXY_URL=http://localhost:8787
```

The proxy should expose:

```txt
GET /search?type=game&q=zelda
```

And return:

```json
{
  "results": [
    {
      "id": "igdb:7346",
      "type": "game",
      "title": "The Legend of Zelda: Breath of the Wild",
      "creator": "Nintendo",
      "provider": "2017",
      "providerId": "7346",
      "coverUrl": "https://...",
      "year": "2017"
    }
  ]
}
```
