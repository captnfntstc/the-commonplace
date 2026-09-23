import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
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
    <AnimatePresence initial={false}>
      {expanded && (
        <motion.div
          key="card-reflection"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.2, 0, 0, 1] }}
          className="card-reflection expanded v12-hybrid-scroll"
          style={{ overflow: 'hidden' }}
        >
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
        </motion.div>
      )}
    </AnimatePresence>
  )
}
