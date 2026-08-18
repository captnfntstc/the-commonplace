import { PrimarySearch } from '../../components/Search/PrimarySearch'
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
  onLoadMore: () => void
  onOpenEntity: (entity: HeaderSearchEntity) => void
  onOpenUser: (handle: string) => void
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
  onLoadMore,
  onOpenEntity,
  onOpenUser,
}: HeaderSearchProps) {
  return (
    <PrimarySearch
      query={query}
      onQueryChange={onQueryChange}
      open={open}
      onOpenChange={onOpenChange}
      mode={mode}
      onModeChange={onModeChange}
      mediaResults={mediaResults.map(toSearchMediaResult)}
      mediaLoading={mediaLoading}
      resultLimit={resultLimit}
      onLoadMore={onLoadMore}
      onOpenEntity={(result) => {
        const entity = mediaResults.find((candidate) => candidate.id === result.id)
        if (entity) onOpenEntity(entity)
      }}
      onOpenUser={onOpenUser}
    />
  )
}
