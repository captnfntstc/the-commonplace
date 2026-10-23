import React from 'react'
import { Code, Sparkles, Layers } from 'lucide-react'
import { isTcpAdmin, useDevSettings } from './devSettings'

interface DeveloperToolsDockProps {
  currentHandle?: string
  onOpen: () => void
}

export const DeveloperToolsDock: React.FC<DeveloperToolsDockProps> = ({
  currentHandle,
  onOpen,
}) => {
  const { settings } = useDevSettings()

  if (!isTcpAdmin(currentHandle)) return null

  const isAlt = settings.collectionLayout !== 'classic'
  const layoutBadge =
    settings.collectionLayout === 'hollis'
      ? 'HOL'
      : settings.collectionLayout === 'universal'
        ? 'UNI'
        : 'STD'

  return (
    <aside className="tcp-admin-dock" aria-label="Administrator developer tools">
      <button
        type="button"
        className={`tcp-admin-dock-btn ${isAlt ? 'is-alt-active' : ''}`}
        onClick={onOpen}
        title="Open Developer Tools (@tcpadmin)"
        aria-label="Open Developer Tools"
      >
        <span className="tcp-admin-dock-icon">
          <Code size={16} aria-hidden="true" />
        </span>
        <span className="tcp-admin-dock-text">DevTools</span>
        <span className={`tcp-admin-dock-pill ${isAlt ? 'is-alt' : 'is-std'}`}>
          {isAlt ? (
            <>
              <Sparkles size={11} aria-hidden="true" />
              <span>{layoutBadge}</span>
            </>
          ) : (
            <>
              <Layers size={11} aria-hidden="true" />
              <span>STD</span>
            </>
          )}
        </span>
      </button>
    </aside>
  )
}

export default DeveloperToolsDock
