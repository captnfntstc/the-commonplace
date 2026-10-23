import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Code,
  Layers,
  LayoutGrid,
  List,
  BarChart2,
  X,
  RotateCcw,
  ShieldCheck,
  Check,
  ShoppingBag,
  Music,
  Eye,
} from 'lucide-react'
import { isTcpAdmin, useDevSettings, type CollectionLayoutDesign, type AlternativeViewMode } from './devSettings'
import './DeveloperTools.css'

interface DeveloperToolsModalProps {
  isOpen: boolean
  onClose: () => void
  currentHandle?: string
}

export const DeveloperToolsModal: React.FC<DeveloperToolsModalProps> = ({
  isOpen,
  onClose,
  currentHandle,
}) => {
  const { settings, updateSetting, resetSettings } = useDevSettings()

  if (!isOpen || !isTcpAdmin(currentHandle)) return null

  const handleLayoutSelect = (layout: CollectionLayoutDesign) => {
    updateSetting('collectionLayout', layout)
  }

  const handleViewModeSelect = (mode: AlternativeViewMode) => {
    updateSetting('alternativeViewMode', mode)
  }

  return (
    <AnimatePresence>
      <div className="tcp-dev-backdrop" onClick={onClose} role="presentation">
        <motion.div
          className="tcp-dev-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tcp-dev-title"
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          {/* Header */}
          <div className="tcp-dev-header">
            <div className="tcp-dev-title-row">
              <div className="tcp-dev-icon-badge">
                <Code size={18} aria-hidden="true" />
              </div>
              <div>
                <h2 id="tcp-dev-title" className="tcp-dev-title">Developer Tools</h2>
                <div className="tcp-dev-badge-row">
                  <span className="tcp-dev-admin-pill">
                    <ShieldCheck size={12} aria-hidden="true" />
                    <span>@tcpadmin</span>
                  </span>
                  <span className="tcp-dev-mode-pill">Administrator Mode</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="tcp-dev-close-btn"
              onClick={onClose}
              aria-label="Close Developer Tools"
              title="Close"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="tcp-dev-body">
            {/* Section: Collections Design Switcher */}
            <div className="tcp-dev-section">
              <div className="tcp-dev-section-heading">
                <div className="tcp-dev-section-icon">
                  <Layers size={16} aria-hidden="true" />
                </div>
                <div>
                  <h3 className="tcp-dev-section-title">Collections Design</h3>
                  <p className="tcp-dev-section-desc">
                    Switch seamlessly between the original collection layout and the new alternative design.
                  </p>
                </div>
              </div>

              <div className="tcp-dev-options-grid three-col">
                {/* Classic Option */}
                <div
                  className={`tcp-dev-option-card ${settings.collectionLayout === 'classic' ? 'is-active' : ''}`}
                  onClick={() => handleLayoutSelect('classic')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleLayoutSelect('classic')}
                >
                  <div className="tcp-dev-option-header">
                    <div className="tcp-dev-option-icon classic">
                      <Layers size={18} aria-hidden="true" />
                    </div>
                    {settings.collectionLayout === 'classic' && (
                      <span className="tcp-dev-active-badge">
                        <Check size={12} aria-hidden="true" /> Active
                      </span>
                    )}
                  </div>
                  <h4 className="tcp-dev-option-name">Standard Design</h4>
                  <p className="tcp-dev-option-detail">
                    The classic collection view with hero header, metadata tags, and multi-column media masonry.
                  </p>
                  <div className="tcp-dev-preview-hint">Original layout</div>
                </div>

                {/* Layout 1: Hollis Option */}
                <div
                  className={`tcp-dev-option-card ${settings.collectionLayout === 'hollis' ? 'is-active' : ''}`}
                  onClick={() => handleLayoutSelect('hollis')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleLayoutSelect('hollis')}
                >
                  <div className="tcp-dev-option-header">
                    <div className="tcp-dev-option-icon hollis">
                      <ShoppingBag size={18} aria-hidden="true" />
                    </div>
                    {settings.collectionLayout === 'hollis' && (
                      <span className="tcp-dev-active-badge">
                        <Check size={12} aria-hidden="true" /> Active
                      </span>
                    )}
                  </div>
                  <h4 className="tcp-dev-option-name">Layout 1: Hollis</h4>
                  <p className="tcp-dev-option-detail">
                    Body Care e-commerce catalog aesthetic: filter sidebar, product specs, count pills &amp; masonry grid.
                  </p>
                  <div className="tcp-dev-preview-hint highlight">Body Care Mockup</div>
                </div>

                {/* Layout 2: Universal Option */}
                <div
                  className={`tcp-dev-option-card ${settings.collectionLayout === 'universal' ? 'is-active' : ''}`}
                  onClick={() => handleLayoutSelect('universal')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleLayoutSelect('universal')}
                >
                  <div className="tcp-dev-option-header">
                    <div className="tcp-dev-option-icon universal">
                      <Music size={18} aria-hidden="true" />
                    </div>
                    {settings.collectionLayout === 'universal' && (
                      <span className="tcp-dev-active-badge">
                        <Check size={12} aria-hidden="true" /> Active
                      </span>
                    )}
                  </div>
                  <h4 className="tcp-dev-option-name">Layout 2: Universal</h4>
                  <p className="tcp-dev-option-detail">
                    Desktop music studio aesthetic: hero banner, Now-Playing spotlight, stream charts, and masonry grid.
                  </p>
                  <div className="tcp-dev-preview-hint red-highlight">Music App Mockup</div>
                </div>
              </div>

              {/* Alternative Options Settings (Visible when Hollis or Universal is selected) */}
              {settings.collectionLayout !== 'classic' && (
                <div className="tcp-dev-suboptions">
                  <span className="tcp-dev-suboptions-label">Alternative View Default:</span>
                  <div className="tcp-dev-button-group">
                    <button
                      type="button"
                      className={`tcp-dev-group-btn ${settings.alternativeViewMode === 'catalog' ? 'is-selected' : ''}`}
                      onClick={() => handleViewModeSelect('catalog')}
                    >
                      <LayoutGrid size={14} aria-hidden="true" />
                      <span>Catalog Cards (Hollis)</span>
                    </button>
                    <button
                      type="button"
                      className={`tcp-dev-group-btn ${settings.alternativeViewMode === 'table' ? 'is-selected' : ''}`}
                      onClick={() => handleViewModeSelect('table')}
                    >
                      <List size={14} aria-hidden="true" />
                      <span>Tracklist Table (Universal)</span>
                    </button>
                  </div>

                  <label className="tcp-dev-toggle-row">
                    <span className="tcp-dev-toggle-text">
                      <BarChart2 size={14} aria-hidden="true" />
                      <span>Show Spotlight &amp; Analytics Sidebar</span>
                    </span>
                    <input
                      type="checkbox"
                      className="tcp-dev-checkbox"
                      checked={settings.showAnalyticsSidebar}
                      onChange={(e) => updateSetting('showAnalyticsSidebar', e.target.checked)}
                    />
                  </label>

                  <label className="tcp-dev-toggle-row">
                    <span className="tcp-dev-toggle-text">
                      <Eye size={14} aria-hidden="true" />
                      <span>Show Cover Artwork on Gradient</span>
                    </span>
                    <input
                      type="checkbox"
                      className="tcp-dev-checkbox"
                      checked={settings.showCoverOnGradient}
                      onChange={(e) => updateSetting('showCoverOnGradient', e.target.checked)}
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Section: Diagnostic & Quick Actions */}
            <div className="tcp-dev-section">
              <div className="tcp-dev-section-heading">
                <div className="tcp-dev-section-icon secondary">
                  <ShieldCheck size={16} aria-hidden="true" />
                </div>
                <div>
                  <h3 className="tcp-dev-section-title">Admin Utilities</h3>
                  <p className="tcp-dev-section-desc">
                    Manage session preferences and experimental flags.
                  </p>
                </div>
              </div>

              <div className="tcp-dev-actions-row">
                <button
                  type="button"
                  className="tcp-dev-action-btn"
                  onClick={resetSettings}
                >
                  <RotateCcw size={14} aria-hidden="true" />
                  <span>Reset Dev Flags to Default</span>
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="tcp-dev-footer">
            <span className="tcp-dev-footer-note">
              Changes apply instantly across all pages and persist in local storage.
            </span>
            <button
              type="button"
              className="tcp-dev-done-btn"
              onClick={onClose}
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
export default DeveloperToolsModal
