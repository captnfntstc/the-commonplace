import React from 'react'

interface SocialSignInProps {
  mode: 'login' | 'register'
  onSelectProvider: (providerName: string) => void
}

export const SocialSignIn: React.FC<SocialSignInProps> = ({ mode, onSelectProvider }) => {
  const headerText = mode === 'login' ? 'Or log in with' : 'Or sign up with'

  return (
    <div className="auth-social-container">
      <div className="auth-social-header">
        <span className="auth-social-line" />
        <span className="auth-social-label">{headerText}</span>
        <span className="auth-social-line" />
      </div>

      <div className="auth-social-grid">
        {/* Google */}
        <button
          type="button"
          className="auth-social-btn"
          onClick={() => onSelectProvider('Google')}
          aria-label={`${headerText} Google`}
          title="Google"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M12.24 10.285V13.4h6.887c-.58 3.407-3.41 5.604-6.887 5.604-4.156 0-7.56-3.376-7.56-7.54s3.404-7.54 7.56-7.54c1.86 0 3.56.666 4.88 1.884l2.5-2.5C17.65 1.585 15.13.785 12.24.785 6.03.785 1 5.815 1 12.025s5.03 11.24 11.24 11.24c6.48 0 10.77-4.56 10.77-10.96 0-.74-.08-1.46-.2-2.02H12.24z" />
          </svg>
        </button>

        {/* Apple */}
        <button
          type="button"
          className="auth-social-btn"
          onClick={() => onSelectProvider('Apple')}
          aria-label={`${headerText} Apple`}
          title="Apple"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.54c.67-.82 1.13-1.96.99-3.11-.98.04-2.18.66-2.88 1.48-.63.73-1.18 1.89-1.03 3.02 1.1.09 2.24-.56 2.92-1.39z" />
          </svg>
        </button>

        {/* Microsoft */}
        <button
          type="button"
          className="auth-social-btn"
          onClick={() => onSelectProvider('Microsoft')}
          aria-label={`${headerText} Microsoft`}
          title="Microsoft"
        >
          <svg viewBox="0 0 23 23" width="18" height="18" fill="currentColor">
            <path d="M0 0h11v11H0zM12 0h11v11H12zM0 12h11v11H0zM12 12h11v11H12z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
