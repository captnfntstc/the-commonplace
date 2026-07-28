import React from 'react'
import { Edit3, Trash2 } from 'lucide-react'
import { FormattedText, type Alignment } from '../FormattedText'

interface VariantProps {
  reflection: string
  reflectionAlign?: Alignment
  favoritePassage?: string
  expanded: boolean
  onEdit: () => void
  onDelete: () => void
}

export const EditorialVariant: React.FC<VariantProps> = ({
  reflection,
  favoritePassage,
  expanded,
  onEdit,
  onDelete,
}) => {
  const paragraphs = reflection.split(/\n\n+/).filter(Boolean)
  const mainReflection = paragraphs[0] || reflection
  const deepThoughts = paragraphs.slice(1).join('\n\n')

  return (
    <div className={`card-reflection ${expanded ? 'expanded' : ''} v3-editorial`}>
      <div className="reflection-inner">
        <div className="editorial-wrapper">
          {favoritePassage && (
            <div className="editorial-section">
              <span className="editorial-label">Key Quote</span>
              <blockquote className="editorial-quote">
                "<FormattedText text={favoritePassage} />"
              </blockquote>
            </div>
          )}

          {favoritePassage && <hr className="editorial-divider" />}

          <div className="editorial-section">
            <span className="editorial-label">Reflection</span>
            <div className="editorial-body">
              <FormattedText text={mainReflection} />
            </div>
          </div>

          {deepThoughts && <hr className="editorial-divider" />}

          {deepThoughts && (
            <div className="editorial-section">
              <span className="editorial-label">Thoughts & Takeaways</span>
              <div className="editorial-body">
                <FormattedText text={deepThoughts} />
              </div>
            </div>
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
