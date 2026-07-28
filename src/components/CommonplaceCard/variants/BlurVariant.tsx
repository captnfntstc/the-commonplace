import React, { useState } from 'react'
import { Edit3, Trash2, Eye } from 'lucide-react'
import { FormattedText, type Alignment } from '../FormattedText'

interface VariantProps {
  reflection: string
  reflectionAlign?: Alignment
  expanded: boolean
  onEdit: () => void
  onDelete: () => void
}

export const BlurVariant: React.FC<VariantProps> = ({
  reflection,
  expanded,
  onEdit,
  onDelete,
}) => {
  const [blurRevealed, setBlurRevealed] = useState(false)

  return (
    <div className={`card-reflection ${expanded ? 'expanded' : ''} v9-blur`}>
      <div className="reflection-inner">
        <div
          className={`blur-wrapper ${
            blurRevealed ? 'blur-off' : 'blur-on'
          }`}
        >
          <div className="reflection-text">
            <FormattedText text={reflection} />
          </div>

          {!blurRevealed && reflection.length > 250 && (
            <div className="blur-overlay-backdrop">
              <button
                type="button"
                className="blur-reveal-btn"
                onClick={() => setBlurRevealed(true)}
              >
                <Eye aria-hidden="true" />
                <span>Continue Reading &rarr;</span>
              </button>
            </div>
          )}
        </div>

        <div className="card-actions">
          {blurRevealed && (
            <button
              type="button"
              className="action-btn"
              onClick={() => setBlurRevealed(false)}
            >
              <span>Re-blur</span>
            </button>
          )}
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
