import React, { useState } from 'react'
import { Edit3, Trash2 } from 'lucide-react'
import { FormattedText, type Alignment } from '../FormattedText'

interface VariantProps {
  reflection: string
  reflectionAlign?: Alignment
  expanded: boolean
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
  entryId: string
}

export const FadeVariant: React.FC<VariantProps> = ({
  reflection,
  expanded,
  onEdit,
  onDelete,
}) => {
  const [showFullText, setShowFullText] = useState(false)

  return (
    <div className={`card-reflection ${expanded ? 'expanded' : ''} v1-fade`}>
      <div className="reflection-inner">
        <div
          className={`fade-content ${showFullText ? 'full-revealed' : 'fade-masked'}`}
        >
          <div className="reflection-text">
            <FormattedText text={reflection} />
          </div>
          {!showFullText && reflection.length > 280 && (
            <button
              type="button"
              className="continue-reading-btn"
              onClick={() => setShowFullText(true)}
            >
              Continue Reading &rarr;
            </button>
          )}
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
