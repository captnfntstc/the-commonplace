import { describe, it } from 'vitest'
import { fetchItunesDiscography, fetchItunesAlbumDetails } from './metadata'

describe('real itunes test for EPs', () => {
  it('tests boygenius or phoebe bridgers EPs', async () => {
    const disco = await fetchItunesDiscography('boygenius')
    const eps = disco.filter(d => d.category === 'ep')
    console.log('boygenius EPs in discography:', eps.map(e => ({ id: e.id, title: e.title, year: e.year, category: e.category })))

    for (const ep of eps) {
      console.log('Testing EP:', ep.title, ep.id)
      const details = await fetchItunesAlbumDetails(
        ep.title,
        ep.artist,
        undefined,
        undefined,
        ep.id.replace('album-', ''),
        ep.year
      )
      console.log('Result for', ep.title, details ? { title: details.title, trackCount: details.trackCount, tracks: details.tracks?.length } : 'NULL')
    }
  }, 30000)
})
