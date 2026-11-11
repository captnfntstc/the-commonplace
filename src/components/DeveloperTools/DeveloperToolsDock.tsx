import React from 'react'
import { Code, Sparkles } from 'lucide-react'
import { isTcpAdmin } from './devSettings'

interface DeveloperToolsDockProps {
  currentHandle?: string
  onOpen: () => void
}

export const DeveloperToolsDock: React.FC<DeveloperToolsDockProps> = ({
  currentHandle,
  onOpen,
}) => {
  if (!isTcpAdmin(currentHandle)) return null

  return (
    <aside className="tcp-admin-dock" aria-label="Developer tools">
      <button
        type="button"
        className="tcp-admin-dock-btn"
        onClick={onOpen}
        title="Open Developer Tools"
        aria-label="Open Developer Tools"
      >
        <span className="tcp-admin-dock-icon">
          <Code size={15} aria-hidden="true" />
        </span>
        <span className="tcp-admin-dock-text">DevTools</span>
        <span className="tcp-admin-dock-pill">
          <Sparkles size={10} aria-hidden="true" />
          <span>Dev</span>
        </span>
      </button>
    </aside>
  )
}

export default DeveloperToolsDock
