import React from 'react'
import { Edit3, Trash2, Clock } from 'lucide-react'
import { FormattedText, type Alignment } from '../FormattedText'

interface VariantProps {
  reflection: string
  reflectionAlign?: Alignment
  expanded: boolean
  onEdit: () => void
  onDelete: () => void
}

export const ArticleVariant: React.FC<VariantProps> = ({
  reflection,
  expanded,
  onEdit,
  onDelete,
}) => {
  const wordCount = reflection.trim().split(/\s+/).filter(Boolean).length
  const readTimeMin = Math.max(1, Math.ceil(wordCount / 180))

  const paragraphs = reflection.split(/\n\n+/).filter(Boolean)
  const leadParagraph = paragraphs[0] || reflection
  const bodyParagraphs = paragraphs.slice(1).join('\n\n')

  return (
    <div className={`card-reflection ${expanded ? 'expanded' : ''} v8-article`}>
      <div className="reflection-inner">
        <div className="article-badge-row">
          <span className="article-tag">
            <Clock aria-hidden="true" />
            {readTimeMin} min read &bull; {wordCount} words
          </span>
        </div>

        <div className="article-content">
          <div className="article-lead">
            <FormattedText text={leadParagraph} />
          </div>

          {bodyParagraphs && (
            <div className="article-body">
              <div className="reflection-text">
                <FormattedText text={bodyParagraphs} />
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
