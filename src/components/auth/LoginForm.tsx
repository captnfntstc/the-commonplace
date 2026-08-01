import React, { useState } from 'react'
import { Mail, Lock, AlertCircle, Info } from 'lucide-react'
import { FormInput } from './FormInput'
import { PasswordInput } from './PasswordInput'
import { AuthDivider } from './Divider'
import { AuthToast } from './AuthToast'
import { SocialSignIn } from './SocialSignIn'

interface LoginFormProps {
  onSwitchToRegister: () => void
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSwitchToRegister }) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [genericError, setGenericError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Forgot password flow state: 'login' | 'forgot' | 'reset-sent'
  const [viewMode, setViewMode] = useState<'login' | 'forgot' | 'reset-sent'>('login')
  const [resetInput, setResetInput] = useState('')
  const [resetError, setResetError] = useState<string | null>(null)
  const [sentEmailTarget, setSentEmailTarget] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setGenericError(null)

    const trimmedInput = email.trim().toLowerCase()

    // Test credentials check: admin (or admin@example.com / admin@commonplace.app) + password
    const isValidAdminUser =
      trimmedInput === 'admin' ||
      trimmedInput === 'admin@example.com' ||
      trimmedInput === 'admin@commonplace.app'

    if (isValidAdminUser && password === 'password') {
      setSubmitted(true)
      setToastMessage('✦ Logged in successfully as admin! (Simulation mode)')
    } else {
      // Unified generic security error - does not reveal specific field mistakes
      setGenericError('Invalid email or password.')
    }
  }

  const handleResetSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = resetInput.trim()
    if (!trimmed) {
      setResetError('Please enter your email or username.')
      return
    }

    const resolvedEmail = trimmed.includes('@') ? trimmed : `${trimmed}@commonplace.app`
    setSentEmailTarget(resolvedEmail)
    setViewMode('reset-sent')
    setToastMessage(`✦ Reset email dispatched to ${resolvedEmail}`)
  }

  const handleGuestClick = () => {
    setToastMessage('✦ Continuing as Guest reader...')
  }

  if (submitted) {
    return (
      <>
        <div className="auth-success-state">
          <div className="auth-success-icon">✦</div>
          <p className="auth-success-text">Welcome back, Admin.</p>
          <p style={{ fontSize: 13, color: 'rgba(223, 194, 161, 0.50)', marginTop: 4 }}>
            Simulation complete — zero credentials stored.
          </p>
          <button
            type="button"
            className="auth-success-reset"
            onClick={() => {
              setSubmitted(false)
              setEmail('')
              setPassword('')
              setGenericError(null)
            }}
            style={{ marginTop: 12 }}
          >
            Try again
          </button>
        </div>
        <AuthToast message={toastMessage} onClose={() => setToastMessage(null)} />
      </>
    )
  }

  // RENDER: Step 2 - Check Email Confirmation Screen
  if (viewMode === 'reset-sent') {
    return (
      <>
        <div className="auth-form">
          <div className="auth-form-heading-block">
            <h1 className="auth-form-heading">Check your email.</h1>
            <div className="auth-ornamental-rule" aria-hidden="true">
              <div className="auth-fading-rule" />
            </div>
          </div>

          <p className="auth-reset-sent-desc">
            We sent a password reset link to <strong style={{ color: '#D6AE73' }}>{sentEmailTarget}</strong>. Please check your inbox and follow the link to reset your password.
          </p>

          <button
            type="button"
            className="auth-primary-btn"
            style={{ marginTop: 24 }}
            onClick={() => {
              setViewMode('login')
              setResetInput('')
              setResetError(null)
            }}
          >
            Return to log in
          </button>
        </div>
        <AuthToast message={toastMessage} onClose={() => setToastMessage(null)} />
      </>
    )
  }

  // RENDER: Step 1 - Forgot Password Form Prompt
  if (viewMode === 'forgot') {
    return (
      <>
        <form
          className="auth-form"
          onSubmit={handleResetSubmit}
          noValidate
          aria-label="Reset your password"
        >
          <div className="auth-form-heading-block">
            <h1 className="auth-form-heading">Reset password.</h1>
            <div className="auth-ornamental-rule" aria-hidden="true">
              <div className="auth-fading-rule" />
            </div>
          </div>

          <p className="auth-reset-prompt-desc">
            Enter your email or username below. If an account matches, we'll send you a link to reset your password.
          </p>

          <div className="auth-fields-stack" style={{ marginTop: 20 }}>
            <FormInput
              id="reset-input"
              label="Email or Username"
              type="text"
              placeholder="admin or you@example.com"
              value={resetInput}
              onChange={(e) => {
                setResetInput(e.target.value)
                if (resetError) setResetError(null)
              }}
              error={resetError || undefined}
              leadingIcon={<Mail size={16} strokeWidth={1.75} />}
            />
          </div>

          <button type="submit" className="auth-primary-btn">
            Send reset link
          </button>

          <p className="auth-switch-text" style={{ marginTop: 16 }}>
            Remembered your password?{' '}
            <button
              type="button"
              className="auth-link-btn"
              onClick={() => {
                setViewMode('login')
                setResetError(null)
              }}
            >
              Back to log in
            </button>
          </p>
        </form>
        <AuthToast message={toastMessage} onClose={() => setToastMessage(null)} />
      </>
    )
  }

  // RENDER: Standard Login Form
  return (
    <>
      <form
        className="auth-form"
        onSubmit={handleSubmit}
        noValidate
        aria-label="Log in to your account"
      >
        {/* Heading */}
        <div className="auth-form-heading-block">
          <h1 className="auth-form-heading">Welcome back.</h1>
          <div className="auth-ornamental-rule" aria-hidden="true">
            <div className="auth-fading-rule" />
          </div>
        </div>

        {/* Test Credential Hint Banner */}
        <div className="auth-test-credentials-box">
          <Info size={14} className="test-cred-icon" />
          <span>Test login — <strong>User:</strong> admin | <strong>Password:</strong> password</span>
        </div>

        {/* Unified Generic Error Message */}
        {genericError && (
          <div className="auth-generic-error-banner" role="alert">
            <AlertCircle size={16} />
            <span>{genericError}</span>
          </div>
        )}

        {/* Fields */}
        <div className="auth-fields-stack">
          <FormInput
            id="login-email"
            label="Email or Username"
            type="text"
            autoComplete="username"
            placeholder="admin or you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (genericError) setGenericError(null)
            }}
            error={undefined}
            leadingIcon={<Mail size={16} strokeWidth={1.75} />}
          />

          <PasswordInput
            id="login-password"
            label="Password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (genericError) setGenericError(null)
            }}
            error={undefined}
            leadingIcon={<Lock size={16} strokeWidth={1.75} />}
          />

          {/* Remember me + Forgot password row */}
          <div className="auth-remember-row">
            <label className="auth-checkbox-label" htmlFor="login-remember">
              <input
                id="login-remember"
                type="checkbox"
                className="auth-checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>Remember me</span>
            </label>
            <button
              type="button"
              className="auth-link-btn auth-forgot-btn"
              onClick={() => {
                setViewMode('forgot')
                setResetInput(email)
              }}
            >
              Forgot password?
            </button>
          </div>
        </div>

        {/* Primary CTA */}
        <button type="submit" id="btn-login" className="auth-primary-btn">
          Log In
        </button>

        {/* Social Sign In Options */}
        <SocialSignIn
          mode="login"
          onSelectProvider={(provider) =>
            setToastMessage(`✦ ${provider} log-in simulated.`)
          }
        />

        <AuthDivider label="OR" />

        {/* Guest CTA */}
        <button
          type="button"
          id="btn-guest"
          className="auth-outline-btn"
          onClick={handleGuestClick}
        >
          Continue as Guest
        </button>

        {/* Switch to Register */}
        <p className="auth-switch-text">
          Don't have an account?{' '}
          <button
            type="button"
            className="auth-link-btn"
            onClick={onSwitchToRegister}
            id="btn-switch-register"
          >
            Create one
          </button>
        </p>
      </form>

      <AuthToast message={toastMessage} onClose={() => setToastMessage(null)} />
    </>
  )
}
