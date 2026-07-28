import React from 'react'
import { type Alignment } from './FormattedText'
import { HybridScrollVariant } from './variants/HybridScrollVariant'

interface CardReflectionProps {
  reflection: string
  reflectionAlign?: Alignment
  expanded: boolean
  onEdit: () => void
  onDelete: () => void
}

export const CardReflection: React.FC<CardReflectionProps> = ({
  reflection,
  reflectionAlign,
  expanded,
  onEdit,
  onDelete,
}) => {
  return (
    <HybridScrollVariant
      reflection={reflection}
      reflectionAlign={reflectionAlign}
      expanded={expanded}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  )
}
