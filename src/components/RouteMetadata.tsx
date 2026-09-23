import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const DEFAULT_DESCRIPTION = 'Catalog meaningful books, music, films, shows, games, and the reflections that stay with you.'

function readableSegment(value = '') {
  try {
    return decodeURIComponent(value).replace(/^@/, '').replace(/[-_]+/g, ' ').trim()
  } catch {
    return value.replace(/^@/, '').replace(/[-_]+/g, ' ').trim()
  }
}

// eslint-disable-next-line react-refresh/only-export-components -- Kept exportable for route metadata regression tests.
export function metadataForPath(pathname: string) {
  const segments = pathname.split('/').filter(Boolean)
  const [section, id] = segments
  if (!section) return { title: 'The Commonplace', description: DEFAULT_DESCRIPTION }
  if (section === 'login') return { title: 'Log In | The Commonplace', description: 'Log in to continue building your personal cultural catalog.' }
  if (section === 'register') return { title: 'Create Account | The Commonplace', description: 'Create your Commonplace account and begin your personal catalog.' }
  if (section === 'settings') return { title: 'Settings | The Commonplace', description: 'Manage your Commonplace profile, privacy, and account settings.' }
  if (section === 'activity') return { title: 'Activity | The Commonplace', description: 'Review your recent Commonplace activity and catalog statistics.' }
  if (section === 'help') return { title: 'Help & Support | The Commonplace', description: 'Find help for catalogs, collections, privacy, and account features.' }
  if (section === 'verify-email' || section === 'v') return { title: 'Verify Email | The Commonplace', description: 'Verify the email address connected to your Commonplace account.' }
  if (section === 'reset-password') return { title: 'Reset Password | The Commonplace', description: 'Choose a new password for your Commonplace account.' }
  if (section === 'entries' && id) return { title: 'Reading | The Commonplace', description: 'Read a catalog entry and join its discussion on The Commonplace.' }
  if (section === 'users' && id) {
    const handle = readableSegment(id)
    return { title: `@${handle} | The Commonplace`, description: `View @${handle}'s public catalog and collections on The Commonplace.` }
  }
  const entitySections = new Set([
    'people', 'groups', 'artists', 'albums', 'songs', 'authors', 'books', 'films', 'movies',
    'shows', 'tv', 'actors', 'directors', 'creators', 'games', 'studios', 'game-studios',
  ])
  if (entitySections.has(section) && id) {
    const name = readableSegment(id)
    return { title: `${name} | The Commonplace`, description: `Explore community details and reflections for ${name} on The Commonplace.` }
  }
  return { title: 'Page Not Found | The Commonplace', description: 'The requested page could not be found on The Commonplace.' }
}

export function RouteMetadata() {
  const { pathname } = useLocation()

  useEffect(() => {
    const metadata = metadataForPath(pathname)
    document.title = metadata.title
    let description = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (!description) {
      description = document.createElement('meta')
      description.name = 'description'
      document.head.appendChild(description)
    }
    description.content = metadata.description
  }, [pathname])

  return null
}
