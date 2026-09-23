import React from 'react'
import { type Alignment } from './FormattedText'
import { HybridScrollVariant } from './variants/HybridScrollVariant'

interface CardReflectionProps {
  reflection: string
  reflectionAlign?: Alignment
  enableDropCap?: boolean
  expanded: boolean
}

export const CardReflection: React.FC<CardReflectionProps> = ({
  reflection,
  reflectionAlign,
  enableDropCap,
  expanded,
}) => {
  return (
    <HybridScrollVariant
      reflection={reflection}
      reflectionAlign={reflectionAlign}
      enableDropCap={enableDropCap}
      expanded={expanded}
    />
  )
}
