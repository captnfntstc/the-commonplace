import React from 'react'
import { motion } from 'framer-motion'
import { BrandLogo } from '../BrandLogo'
import { AuthIllustration } from './AuthIllustration'

export interface AuthCardProps {
  activeTab?: 'login' | 'register'
  onSwitchTab?: (tab: 'login' | 'register') => void
  formPanel: React.ReactNode
}

export const AuthCard: React.FC<AuthCardProps> = ({
  activeTab,
  formPanel,
}) => {
  return (
    <div className="auth-card-stage">
      {/* ── Brand Logo Prominently Positioned Above the Container ── */}
      <header className="auth-card-header-logo" aria-label="The Commonplace">
        <BrandLogo
          forceMode="light"
          accentColor="#f05353"
          className="auth-card-floating-brand-logo"
        />
      </header>

      <div className="auth-card">
        {/* Left panel — Form starting right at the top of the container */}
        <div className="auth-card-left">
          <div className="auth-card-form-container">
            <motion.div
              key={activeTab || 'auth-form'}
              className="auth-card-form-motion-shell"
              initial={{ opacity: 0.9, x: activeTab === 'login' ? -6 : 6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
              {formPanel}
            </motion.div>
          </div>
        </div>

        {/* Right panel — Curated showcase of The Commonplace entries */}
        <div className="auth-card-right">
          <AuthIllustration accentColor="#f05353" />
        </div>
      </div>
    </div>
  )
}
