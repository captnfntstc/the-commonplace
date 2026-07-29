import React from 'react'
import { motion } from 'framer-motion'
import { Settings, X, Sliders, Moon, Trash2, Database } from 'lucide-react'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  onClearAllData: () => void
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onClearAllData,
}) => {
  if (!isOpen) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <motion.div
        className="settings-modal"
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings-header">
          <div className="settings-header-title">
            <Settings aria-hidden="true" />
            <h2>Commonplace Settings</h2>
          </div>
          <button
            type="button"
            className="composer-close-icon"
            onClick={onClose}
            aria-label="Close settings"
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <div className="settings-body">
          <section className="settings-section">
            <h3 className="settings-section-title">
              <Sliders aria-hidden="true" />
              Reading & Display
            </h3>
            <div className="settings-option">
              <div>
                <span className="option-title">Drop Cap Initial Letter</span>
                <span className="option-subtitle">Enable large serif drop caps on reflections by default</span>
              </div>
              <input type="checkbox" defaultChecked className="settings-checkbox" />
            </div>

            <div className="settings-option">
              <div>
                <span className="option-title">Smooth Column Animations</span>
                <span className="option-subtitle">Use GPU hardware-accelerated transitions for masonry grid</span>
              </div>
              <input type="checkbox" defaultChecked className="settings-checkbox" />
            </div>
          </section>

          <section className="settings-section">
            <h3 className="settings-section-title">
              <Moon aria-hidden="true" />
              Aesthetics & Theme
            </h3>
            <div className="settings-option">
              <div>
                <span className="option-title">Theme Palette</span>
                <span className="option-subtitle">Current palette: Warm Antique Obsidian</span>
              </div>
              <span className="settings-badge">Active</span>
            </div>
          </section>

          <section className="settings-section danger-zone">
            <h3 className="settings-section-title danger">
              <Database aria-hidden="true" />
              Data & Storage
            </h3>
            <div className="settings-option">
              <div>
                <span className="option-title">Reset Local Catalog</span>
                <span className="option-subtitle">Permanently delete all saved entries from local storage</span>
              </div>
              <button
                type="button"
                className="action-btn danger"
                onClick={() => {
                  if (window.confirm('Are you sure you want to clear all entries?')) {
                    onClearAllData()
                    onClose()
                  }
                }}
              >
                <Trash2 aria-hidden="true" />
                Clear All Data
              </button>
            </div>
          </section>
        </div>
      </motion.div>
    </div>
  )
}
