import React from 'react'
import { motion } from 'framer-motion'
import { AuthIllustration } from './AuthIllustration'

interface AuthCardProps {
  formPanel: React.ReactNode
}

export const AuthCard: React.FC<AuthCardProps> = ({ formPanel }) => {
  return (
    <motion.div
      className="auth-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {/* Left panel — quote & illustration */}
      <div className="auth-card-left">
        <div className="auth-quote-block">
          <h2 className="auth-card-quote-main">
            Your space for<br />the things that <em>stay</em>.
          </h2>
          <div className="auth-quote-divider" aria-hidden="true">
            <div className="auth-fading-rule" />
          </div>
          <p className="auth-card-quote-sub">
            Return to what matters.
          </p>
        </div>
        <AuthIllustration />
      </div>

      {/* Vertical divider */}
      <div className="auth-card-divider" aria-hidden="true" />

      {/* Right panel — form */}
      <div className="auth-card-right">
        {formPanel}
      </div>
    </motion.div>
  )
}
