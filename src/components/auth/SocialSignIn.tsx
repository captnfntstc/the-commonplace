import React from 'react'

interface SocialSignInProps {
  mode?: 'login' | 'register'
  onSelectProvider: (providerName: string) => void
  hideHeader?: boolean
}

export const SocialSignIn: React.FC<SocialSignInProps> = ({ onSelectProvider, hideHeader = false }) => {
  return (
    <div className="auth-social-container">
      {!hideHeader && (
        <div className="auth-social-header">
          <span className="auth-social-line" />
          <span className="auth-social-label">OR SIGN IN WITH</span>
          <span className="auth-social-line" />
        </div>
      )}

      <div className="auth-social-circular-row">
        <button
          type="button"
          className="auth-social-circle-btn"
          onClick={() => onSelectProvider('Google')}
          aria-label="Sign in with Google"
          title="Google"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
            <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
          </svg>
        </button>

        <button
          type="button"
          className="auth-social-circle-btn auth-social-circle-btn--apple"
          onClick={() => onSelectProvider('Apple')}
          aria-label="Sign in with Apple"
          title="Apple"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.54c.67-.82 1.13-1.96.99-3.11-.98.04-2.18.66-2.88 1.48-.63.73-1.18 1.89-1.03 3.02 1.1.09 2.24-.56 2.92-1.39z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
