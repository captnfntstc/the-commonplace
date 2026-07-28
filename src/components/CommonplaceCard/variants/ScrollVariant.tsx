import React from 'react'
import { Edit3, Trash2 } from 'lucide-react'
import { FormattedText, type Alignment } from '../FormattedText'

interface VariantProps {
  reflection: string
  reflectionAlign?: Alignment
  expanded: boolean
  onEdit: () => void
  onDelete: () => void
}

export const ScrollVariant: React.FC<VariantProps> = ({
  reflection,
  expanded,
  onEdit,
  onDelete,
}) => {
  return (
    <div className={`card-reflection ${expanded ? 'expanded' : ''} v2-scroll`}>
      <div className="reflection-inner">
        <div className="scroll-container">
          <div className="reflection-text">
            <FormattedText text={reflection} />
          </div>
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
