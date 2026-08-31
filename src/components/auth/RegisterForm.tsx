import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock, User, AlertCircle } from 'lucide-react'
import { FormInput } from './FormInput'
import { PasswordInput } from './PasswordInput'
import { LegalModal, type LegalModalType } from './LegalModal'
import { AuthToast } from './AuthToast'
import { PasswordStrengthMeter } from './PasswordStrengthMeter'
import { SocialSignIn } from './SocialSignIn'
import { useAuth } from '../../context/AuthContext'

interface RegisterFormProps {
  onSwitchToLogin: () => void
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onSwitchToLogin }) => {
  const navigate = useNavigate()
  const { signup, loginWithGoogle } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [legalModalType, setLegalModalType] = useState<LegalModalType>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [genericError, setGenericError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{
    name?: string
    email?: string
    password?: string
    confirmPassword?: string
    agreed?: string
  }>({})

  const validate = () => {
    const next: typeof errors = {}
    if (!name.trim()) next.name = 'Name is required.'
    if (!email.trim()) next.email = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Enter a valid email address.'
    if (!password) next.password = 'Password is required.'
    else if (password.length < 8) next.password = 'At least 8 characters required.'
    if (!confirmPassword) next.confirmPassword = 'Please confirm your password.'
    else if (confirmPassword !== password) next.confirmPassword = 'Passwords do not match.'
    if (!agreed) next.agreed = 'You must agree to continue.'
    return next
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setGenericError(null)
    const errs = validate()
    setErrors(errs)

    if (Object.keys(errs).length === 0) {
      try {
        setLoading(true)
        await signup(email.trim(), password, name.trim())
        setToastMessage('✦ Account created! Check your email to verify it before posting.')
        setTimeout(() => {
          navigate('/')
        }, 600)
      } catch (err: unknown) {
        setGenericError((err as Error)?.message?.replace(/^Firebase:\s*/, '') || 'Registration failed.')
      } finally {
        setLoading(false)
      }
    }
  }

  const handleSelectProvider = async (provider: string) => {
    if (provider !== 'Google') return
    try {
      setLoading(true)
      await loginWithGoogle()
      setToastMessage('✦ Signed up with Google successfully!')
      setTimeout(() => {
        navigate('/')
      }, 600)
    } catch (err: unknown) {
      setGenericError((err as Error)?.message?.replace(/^Firebase:\s*/, '') || 'Google sign up failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <form
        className="auth-form"
        onSubmit={handleSubmit}
        noValidate
        aria-label="Create your account"
      >
        {/* Heading */}
        <div className="auth-form-heading-block">
          <h1 className="auth-form-heading">Create an account.</h1>
          <div className="auth-ornamental-rule" aria-hidden="true">
            <div className="auth-fading-rule" />
          </div>
        </div>

        {/* Generic Error Banner */}
        {genericError && (
          <div className="auth-generic-error-banner" role="alert">
            <AlertCircle size={16} />
            <span>{genericError}</span>
          </div>
        )}

        {/* Fields */}
        <div className="auth-fields-stack">
          <FormInput
            id="register-name"
            label="Name"
            type="text"
            autoComplete="name"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
            leadingIcon={<User size={16} strokeWidth={1.75} />}
          />

          <FormInput
            id="register-email"
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            leadingIcon={<Mail size={16} strokeWidth={1.75} />}
          />

          <div>
            <PasswordInput
              id="register-password"
              label="Password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              hint="At least 8 characters."
              leadingIcon={<Lock size={16} strokeWidth={1.75} />}
            />
            <PasswordStrengthMeter password={password} />
          </div>

          <PasswordInput
            id="register-confirm-password"
            label="Confirm Password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={errors.confirmPassword}
            leadingIcon={<Lock size={16} strokeWidth={1.75} />}
          />

          {/* Terms checkbox */}
          <div className="auth-terms-row">
            <label className="auth-checkbox-label auth-terms-label" htmlFor="register-agree">
              <input
                id="register-agree"
                type="checkbox"
                className="auth-checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                aria-describedby={errors.agreed ? 'register-agree-error' : undefined}
              />
              <span>
                I agree to the{' '}
                <button
                  type="button"
                  className="auth-link-btn"
                  onClick={() => setLegalModalType('terms')}
                >
                  Terms of Service
                </button>
                {' '}and{' '}
                <button
                  type="button"
                  className="auth-link-btn"
                  onClick={() => setLegalModalType('privacy')}
                >
                  Privacy Policy
                </button>.
              </span>
            </label>
            {errors.agreed && (
              <p id="register-agree-error" role="alert" className="form-input-error" style={{ marginTop: 4 }}>
                {errors.agreed}
              </p>
            )}
          </div>
        </div>

        {/* Primary CTA */}
        <button type="submit" id="btn-register" className="auth-primary-btn" disabled={loading}>
          {loading ? 'Creating account...' : 'Create account'}
        </button>

        {/* Social Sign In Options */}
        <SocialSignIn
          mode="register"
          onSelectProvider={handleSelectProvider}
        />

        {/* Switch to Login */}
        <p className="auth-switch-text">
          Already have an account?{' '}
          <button
            type="button"
            className="auth-link-btn"
            onClick={onSwitchToLogin}
            id="btn-switch-login"
          >
            Log in
          </button>
        </p>
      </form>

      {/* Legal Modal Overlay */}
      <LegalModal
        type={legalModalType}
        onClose={() => setLegalModalType(null)}
      />

      <AuthToast message={toastMessage} onClose={() => setToastMessage(null)} />
    </>
  )
}
