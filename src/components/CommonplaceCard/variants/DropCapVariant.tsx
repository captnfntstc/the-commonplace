import React from 'react'
import { Edit3, Trash2 } from 'lucide-react'
import { getDropCapParts } from './HybridScrollVariant'
import { FormattedText, type Alignment } from '../FormattedText'

interface VariantProps {
  reflection: string
  reflectionAlign?: Alignment
  expanded: boolean
  onEdit: () => void
  onDelete: () => void
}

export const DropCapVariant: React.FC<VariantProps> = ({
  reflection,
  expanded,
  onEdit,
  onDelete,
}) => {
  const { firstChar, restText, isEmoji } = getDropCapParts(reflection)

  return (
    <div className={`card-reflection ${expanded ? 'expanded' : ''} v4-dropcap`}>
      <div className="reflection-inner">
        <div className="dropcap-container">
          <span className={`dropcap-letter ${isEmoji ? 'is-emoji' : ''}`}>{firstChar}</span>
          <span className="dropcap-body">
            <FormattedText text={restText} />
          </span>
        </div>

        <div className="card-actions">
          <button className="action-btn" type="button" onClick={onEdit}>
            <Edit3 aria-hidden="true" />
            <span>Edit</span>
          </button>
          <button className="action-btn danger" type="button" onClick={onDelete}>
            <Trash2 aria-hidden="true" />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  )
}
