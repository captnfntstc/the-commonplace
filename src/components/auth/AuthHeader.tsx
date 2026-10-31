import React from 'react'
import { BrandLogo } from '../BrandLogo'

export interface AuthHeaderProps {
  forceMode?: 'light' | 'dark'
  accentColor?: string
}

export const AuthHeader: React.FC<AuthHeaderProps> = ({
  forceMode = 'dark',
  accentColor,
}) => {
  return (
    <header className="auth-header">
      <div className="auth-header-inner">
        <div className="auth-header-brand">
          <div className="auth-header-title-container">
            <BrandLogo forceMode={forceMode} accentColor={accentColor} className="auth-header-wordmark-logo" />
            <div className="auth-header-title-rule" aria-hidden="true" />
          </div>
        </div>
      </div>
    </header>
  )
}
