import { PrimarySearch, type SearchCategory } from '../../components/Search/PrimarySearch'
import { toSearchMediaResult, type HeaderSearchEntity } from './entitySearch'

type SearchMode = 'media' | 'users'

interface HeaderSearchProps {
  open: boolean
  query: string
  mode: SearchMode
  mediaResults: HeaderSearchEntity[]
  mediaLoading: boolean
  resultLimit: number
  onOpenChange: (open: boolean) => void
  onQueryChange: (query: string) => void
  onModeChange: (mode: SearchMode) => void
  onMediaFilterChange?: (filter: SearchCategory | 'all') => void
  onLoadMore: () => void
  onOpenEntity: (entity: HeaderSearchEntity) => void
  onOpenUser: (handle: string) => void
  storageScope?: string
}

export function HeaderSearch({
  open,
  query,
  mode,
  mediaResults,
  mediaLoading,
  resultLimit,
  onOpenChange,
  onQueryChange,
  onModeChange,
  onMediaFilterChange,
  onLoadMore,
  onOpenEntity,
  onOpenUser,
  storageScope,
}: HeaderSearchProps) {
  return (
    <PrimarySearch
      query={query}
      onQueryChange={onQueryChange}
      open={open}
      onOpenChange={onOpenChange}
      mode={mode}
      onModeChange={onModeChange}
      onMediaFilterChange={onMediaFilterChange}
      mediaResults={mediaResults.map(toSearchMediaResult)}
      mediaLoading={mediaLoading}
      resultLimit={resultLimit}
      onLoadMore={onLoadMore}
      onOpenEntity={(result) => {
        const entity = mediaResults.find((candidate) => candidate.id === result.id) || {
          id: result.id,
          title: result.name,
          artworkUrl: result.image,
          type: result.type,
          creatorValue: result.subtitle,
          bio: '',
          source: 'metadata',
          rank: 0,
        }
        onOpenEntity(entity)
      }}
      onOpenUser={onOpenUser}
      storageScope={storageScope}
    />
  )
}
