import React, { useState } from 'react'
import { Mail, Lock, User } from 'lucide-react'
import { FormInput } from './FormInput'
import { PasswordInput } from './PasswordInput'
import { LegalModal, type LegalModalType } from './LegalModal'
import { AuthToast } from './AuthToast'
import { PasswordStrengthMeter } from './PasswordStrengthMeter'
import { SocialSignIn } from './SocialSignIn'

interface RegisterFormProps {
  onSwitchToLogin: () => void
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onSwitchToLogin }) => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [legalModalType, setLegalModalType] = useState<LegalModalType>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [errors, setErrors] = useState<{
    name?: string
    email?: string
    password?: string
    confirmPassword?: string
    agreed?: string
  }>({})
  const [submitted, setSubmitted] = useState(false)

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length === 0) {
      setSubmitted(true)
      setToastMessage('✦ Account created successfully! (Simulation mode — no data stored)')
    }
  }

  if (submitted) {
    return (
      <>
        <div className="auth-success-state">
          <div className="auth-success-icon">✦</div>
          <p className="auth-success-text">Your collection begins.</p>
          <p style={{ fontSize: 13, color: 'rgba(223, 194, 161, 0.50)', marginTop: 4 }}>
            Simulation complete — zero data stored.
          </p>
          <button
            type="button"
            className="auth-success-reset"
            onClick={() => {
              setSubmitted(false)
              setName('')
              setEmail('')
              setPassword('')
              setConfirmPassword('')
              setAgreed(false)
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
        <button type="submit" id="btn-register" className="auth-primary-btn">
          Create account
        </button>

        {/* Social Sign In Options */}
        <SocialSignIn
          mode="register"
          onSelectProvider={(provider) =>
            setToastMessage(`✦ ${provider} sign-up simulated.`)
          }
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

      {/* Simulated Toast Notification */}
      <AuthToast message={toastMessage} onClose={() => setToastMessage(null)} />
    </>
  )
}
