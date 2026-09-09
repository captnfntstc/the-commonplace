import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Edit3, Trash2, Maximize2, MoreHorizontal } from 'lucide-react'
import { FormattedText, type Alignment } from '../FormattedText'
import { getDropCapParts } from '../dropCap'

interface VariantProps {
  reflection: string
  reflectionAlign?: Alignment
  enableDropCap?: boolean
  expanded: boolean
  onEdit?: () => void
  onDelete?: () => void
  onExpandOverlay?: () => void
}

export const HybridScrollVariant: React.FC<VariantProps> = ({
  reflection,
  reflectionAlign,
  enableDropCap = false,
  expanded,
  onEdit,
  onDelete,
  onExpandOverlay,
}) => {
  const showDropCap = Boolean(enableDropCap)
  const { firstChar, restText, isEmoji, isLowercase } = getDropCapParts(reflection)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const closeMenu = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', closeMenu)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeMenu)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [menuOpen])

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
          style={{ overflow: menuOpen ? 'visible' : 'hidden' }}
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
                      <FormattedText text={restText} align={reflectionAlign} />
                    </span>
                  </div>
                ) : (
                  <div className="standard-body">
                    <FormattedText text={reflection} align={reflectionAlign} />
                  </div>
                )}
              </div>
            </div>

            {(onExpandOverlay || onEdit || onDelete) && (
              <div className="card-actions" ref={menuRef}>
                <button
                  className="card-more-btn"
                  type="button"
                  onClick={() => setMenuOpen((open) => !open)}
                  title="More actions"
                  aria-label="More entry actions"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  <MoreHorizontal aria-hidden="true" />
                </button>
                <AnimatePresence>
                  {menuOpen && (
                    <motion.div
                      className="card-actions-menu"
                      role="menu"
                      initial={{ opacity: 0, scale: 0.96, y: 4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96, y: 4 }}
                      transition={{ duration: 0.12 }}
                    >
                      {onExpandOverlay && (
                        <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onExpandOverlay() }}>
                          <Maximize2 aria-hidden="true" />
                          <span>Open reading view</span>
                        </button>
                      )}
                      {onEdit && (
                        <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onEdit() }}>
                          <Edit3 aria-hidden="true" />
                          <span>Edit entry</span>
                        </button>
                      )}
                      {onDelete && (
                        <button className="danger" type="button" role="menuitem" onClick={() => { setMenuOpen(false); onDelete() }}>
                          <Trash2 aria-hidden="true" />
                          <span>Delete entry</span>
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
