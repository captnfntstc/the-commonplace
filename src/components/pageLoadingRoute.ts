export type PageLoadingVariant =
  | 'home'
  | 'profile'
  | 'entity'
  | 'settings'
  | 'activity'
  | 'help'
  | 'auth'
  | 'utility'

const ENTITY_ROUTE_SECTIONS = new Set([
  'people',
  'groups',
  'artists',
  'albums',
  'songs',
  'authors',
  'books',
  'films',
  'movies',
  'shows',
  'tv',
  'actors',
  'directors',
  'creators',
  'games',
  'studios',
  'game-studios',
])

export function pageLoadingVariantForPath(pathname: string): PageLoadingVariant {
  const section = pathname.split('/').filter(Boolean)[0]?.toLowerCase() || ''
  if (!section) return 'home'
  if (section === 'users' || section === 'profile') return 'profile'
  if (ENTITY_ROUTE_SECTIONS.has(section)) return 'entity'
  if (section === 'settings') return 'settings'
  if (section === 'activity') return 'activity'
  if (section === 'help') return 'help'
  if (['login', 'register', 'verify-email', 'v', 'reset-password'].includes(section)) return 'auth'
  return 'utility'
}
