import React from 'react'

export const AuthHeader: React.FC = () => {
  return (
    <header className="auth-header">
      <div className="auth-header-inner">
        <div className="auth-header-brand">
          <div className="auth-header-title-container">
            <span className="auth-header-title">The Commonplace.</span>
            <div className="auth-header-title-rule" aria-hidden="true" />
          </div>
        </div>
      </div>
    </header>
  )
}

