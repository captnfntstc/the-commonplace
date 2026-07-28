import React from 'react'
import { Edit3, Trash2, BookOpen } from 'lucide-react'
import { FormattedText, type Alignment } from '../FormattedText'

interface VariantProps {
  reflection: string
  reflectionAlign?: Alignment
  title: string
  creator: string
  expanded: boolean
  onEdit: () => void
  onDelete: () => void
}

export const BookPageVariant: React.FC<VariantProps> = ({
  reflection,
  title,
  creator,
  expanded,
  onEdit,
  onDelete,
}) => {
  return (
    <div className={`card-reflection ${expanded ? 'expanded' : ''} v11-bookpage`}>
      <div className="reflection-inner">
        <div className="book-page-sheet">
          <div className="book-page-header">
            <span className="book-chapter-tag">
              <BookOpen aria-hidden="true" /> Reflection
            </span>
            <h3 className="book-page-title">{title}</h3>
            {creator && <p className="book-page-author">by {creator}</p>}
            <hr className="book-header-rule" />
          </div>

          <div className="book-page-body">
            <div className="book-serif-text">
              <FormattedText text={reflection} />
            </div>
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
