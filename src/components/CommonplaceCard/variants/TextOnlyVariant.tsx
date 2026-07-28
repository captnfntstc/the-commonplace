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

export const TextOnlyVariant: React.FC<VariantProps> = ({
  reflection,
  expanded,
  onEdit,
  onDelete,
}) => {
  return (
    <div className={`card-reflection ${expanded ? 'expanded' : ''} v7-textonly`}>
      <div className="reflection-inner text-only-flex">
        <div className="text-only-body">
          <div className="reflection-text">
            <FormattedText text={reflection} />
          </div>
        </div>

        <div className="card-actions anchored-footer">
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
