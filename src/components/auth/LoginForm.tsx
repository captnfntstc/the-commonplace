import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock, AlertCircle } from 'lucide-react'
import { FormInput } from './FormInput'
import { PasswordInput } from './PasswordInput'
import { AuthToast } from './AuthToast'
import { SocialSignIn } from './SocialSignIn'
import { useAuth } from '../../context/AuthContext'

interface LoginFormProps {
  onSwitchToRegister: () => void
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSwitchToRegister }) => {
  const navigate = useNavigate()
  const { login, resetPassword, loginWithGoogle } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [genericError, setGenericError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Forgot password flow state: 'login' | 'forgot' | 'reset-sent'
  const [viewMode, setViewMode] = useState<'login' | 'forgot' | 'reset-sent'>('login')
  const [resetInput, setResetInput] = useState('')
  const [resetError, setResetError] = useState<string | null>(null)
  const [sentEmailTarget, setSentEmailTarget] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setGenericError(null)

    const trimmedInput = email.trim()
    if (!trimmedInput || !password) {
      setGenericError('Please enter email and password.')
      return
    }

    try {
      setLoading(true)
      await login(trimmedInput, password)
      setToastMessage('✦ Logged in successfully!')
      setTimeout(() => {
        navigate('/')
      }, 600)
    } catch (err: unknown) {
      const message = (err as Error)?.message || 'Invalid email or password.'
      if (
        message.includes('auth/invalid-credential') ||
        message.includes('auth/user-not-found') ||
        message.includes('auth/wrong-password') ||
        message.includes('auth/invalid-email')
      ) {
        setGenericError('Invalid email or password.')
      } else {
        setGenericError(message.replace(/^Firebase:\s*/, ''))
      }
    } finally {
      setLoading(false)
    }
  }

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = resetInput.trim()
    if (!trimmed) {
      setResetError('Please enter your email address.')
      return
    }

    try {
      setLoading(true)
      await resetPassword(trimmed)
      setSentEmailTarget(trimmed)
      setViewMode('reset-sent')
      setToastMessage(`✦ Reset email dispatched to ${trimmed}`)
    } catch (err: unknown) {
      setResetError((err as Error)?.message?.replace(/^Firebase:\s*/, '') || 'Failed to send reset link.')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectProvider = async (provider: string) => {
    if (provider !== 'Google') return
    try {
      setLoading(true)
      await loginWithGoogle()
      setToastMessage('✦ Logged in with Google successfully!')
      setTimeout(() => {
        navigate('/')
      }, 600)
    } catch (err: unknown) {
      setGenericError((err as Error)?.message?.replace(/^Firebase:\s*/, '') || 'Google login failed.')
    } finally {
      setLoading(false)
    }
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
            Enter your email address below. If an account matches, we'll send you a link to reset your password.
          </p>

          <div className="auth-fields-stack" style={{ marginTop: 20 }}>
            <FormInput
              id="reset-input"
              label="Email address"
              type="email"
              placeholder="you@example.com"
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
            label="Email address"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
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

          <div className="auth-remember-row" style={{ justifyContent: 'flex-end' }}>
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
        <button type="submit" id="btn-login" className="auth-primary-btn" disabled={loading}>
          {loading ? 'Logging in...' : 'Log In'}
        </button>

        {/* Social Sign In Options */}
        <SocialSignIn
          mode="login"
          onSelectProvider={handleSelectProvider}
        />

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
