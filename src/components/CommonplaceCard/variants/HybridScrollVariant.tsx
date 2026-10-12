import React from 'react'
import { FormattedText, type Alignment } from '../FormattedText'
import { getDropCapParts } from '../dropCap'

interface VariantProps {
  reflection: string
  reflectionAlign?: Alignment
  enableDropCap?: boolean
  expanded: boolean
}

export const HybridScrollVariant: React.FC<VariantProps> = ({
  reflection,
  reflectionAlign,
  enableDropCap = false,
  expanded,
}) => {
  const showDropCap = Boolean(enableDropCap)
  const { firstChar, restText, isEmoji, isLowercase } = getDropCapParts(reflection)

  return (
    <div
      className={`card-reflection v12-hybrid-scroll ${expanded ? 'expanded' : ''}`}
      aria-hidden={!expanded}
      inert={expanded ? undefined : true}
    >
      <div className="card-reflection-collapse">
        <div className="reflection-inner">
          <div className="scroll-container">
            <div className="reading-width-wrapper">
              {showDropCap ? (
                <div className="dropcap-container">
                  <span className={`dropcap-letter ${isEmoji ? 'is-emoji' : ''} ${isLowercase ? 'is-lowercase' : ''}`}>
                    {firstChar}
                  </span>
                  <span className="dropcap-body">
                    <FormattedText text={restText} align={reflectionAlign} reflowPlainText />
                  </span>
                </div>
              ) : (
                <div className="standard-body">
                  <FormattedText text={reflection} align={reflectionAlign} reflowPlainText />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
