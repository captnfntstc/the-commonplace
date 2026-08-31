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

      </div>
    </div>
  )
}
