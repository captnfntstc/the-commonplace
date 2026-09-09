import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock, User, AtSign, AlertCircle, CheckCircle2, LoaderCircle, Calendar } from 'lucide-react'
import { FormInput } from './FormInput'
import { PasswordInput } from './PasswordInput'
import { LegalModal, type LegalModalType } from './LegalModal'
import { AuthToast } from './AuthToast'
import { PasswordStrengthMeter } from './PasswordStrengthMeter'
import { SocialSignIn } from './SocialSignIn'
import { useAuth } from '../../context/AuthContext'
import {
  isEligibleBirthday,
  latestEligibleBirthday,
  MINIMUM_ACCOUNT_AGE,
} from '../../features/auth/ageEligibility'

interface RegisterFormProps {
  onSwitchToLogin: () => void
}

interface HandleAvailabilityResponse {
  handle: string
  available: boolean
  suggestions: string[]
}

const HANDLE_PATTERN = /^[a-z0-9_]{3,20}$/

async function checkHandleAvailability(handle: string, signal?: AbortSignal) {
  let response: Response
  try {
    response = await fetch(`/api/auth/handle-availability?handle=${encodeURIComponent(handle)}`, {
      headers: { Accept: 'application/json' },
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new Error('The username checker is unavailable. Please try again shortly.', { cause: error })
  }

  const payload = await response.json().catch(() => ({})) as Partial<HandleAvailabilityResponse> & { error?: string }
  if (!response.ok) throw new Error(payload.error || 'Unable to check that username right now.')
  return {
    handle: payload.handle || handle,
    available: Boolean(payload.available),
    suggestions: Array.isArray(payload.suggestions) ? payload.suggestions : [],
  }
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onSwitchToLogin }) => {
  const navigate = useNavigate()
  const { signup, loginWithGoogle } = useAuth()
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [birthday, setBirthday] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [legalModalType, setLegalModalType] = useState<LegalModalType>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [genericError, setGenericError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'error'>('idle')
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([])
  const [errors, setErrors] = useState<{
    name?: string
    username?: string
    email?: string
    birthday?: string
    ageConfirmed?: string
    password?: string
    confirmPassword?: string
    agreed?: string
  }>({})

  useEffect(() => {
    const normalized = username.trim().toLowerCase()
    if (!HANDLE_PATTERN.test(normalized)) {
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setUsernameStatus('checking')
      try {
        const result = await checkHandleAvailability(normalized, controller.signal)
        setUsernameStatus(result.available ? 'available' : 'taken')
        setUsernameSuggestions(result.suggestions)
        setErrors((current) => ({
          ...current,
          username: result.available ? undefined : 'That username is already taken.',
        }))
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setUsernameStatus('error')
        setUsernameSuggestions([])
      }
    }, 400)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [username])

  const validate = () => {
    const next: typeof errors = {}
    if (!name.trim()) next.name = 'Name is required.'
    const normalizedUsername = username.trim().toLowerCase()
    if (!normalizedUsername) next.username = 'Username is required.'
    else if (!HANDLE_PATTERN.test(normalizedUsername)) {
      next.username = 'Use 3–20 lowercase letters, numbers, or underscores.'
    } else if (usernameStatus === 'taken') next.username = 'That username is already taken.'
    if (!email.trim()) next.email = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Enter a valid email address.'
    if (!birthday) next.birthday = 'Date of birth is required.'
    else if (!isEligibleBirthday(birthday)) next.birthday = `You must be at least ${MINIMUM_ACCOUNT_AGE} years old to create an account.`
    if (!ageConfirmed) next.ageConfirmed = `Confirm that you are ${MINIMUM_ACCOUNT_AGE} or older.`
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
        const normalizedUsername = username.trim().toLowerCase()
        const availability = await checkHandleAvailability(normalizedUsername)
        if (!availability.available) {
          setUsernameStatus('taken')
          setUsernameSuggestions(availability.suggestions)
          setErrors((current) => ({ ...current, username: 'That username is already taken.' }))
          return
        }
        await signup(email.trim(), password, name.trim(), normalizedUsername, birthday)
        setToastMessage('✦ Account created! Verify your email whenever you are ready to start posting.')
        setTimeout(() => {
          navigate('/')
        }, 600)
      } catch (err: unknown) {
        const message = (err as Error)?.message?.replace(/^Firebase:\s*/, '') || 'Registration failed.'
        if (/username.*already in use/i.test(message)) {
          setUsernameStatus('taken')
          setErrors((current) => ({ ...current, username: 'That username is already taken.' }))
        } else {
          setGenericError(message)
        }
      } finally {
        setLoading(false)
      }
    }
  }

  const handleSelectProvider = async (provider: string) => {
    if (provider !== 'Google') return
    if (!birthday || !isEligibleBirthday(birthday)) {
      setErrors((current) => ({
        ...current,
        birthday: birthday
          ? `You must be at least ${MINIMUM_ACCOUNT_AGE} years old to create an account.`
          : 'Enter your date of birth before continuing with Google.',
      }))
      return
    }
    if (!ageConfirmed) {
      setErrors((current) => ({
        ...current,
        ageConfirmed: `Confirm that you are ${MINIMUM_ACCOUNT_AGE} or older.`,
      }))
      return
    }
    try {
      setLoading(true)
      await loginWithGoogle(false, birthday)
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

          <div className="auth-register-inline-fields">
            <div>
              <FormInput
              id="register-username"
              label="Username"
              type="text"
              autoComplete="username"
              placeholder="your_username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value.replace(/^@/, '').replace(/\s+/g, '').toLowerCase())
                setUsernameStatus('idle')
                setUsernameSuggestions([])
                setErrors((current) => ({ ...current, username: undefined }))
              }}
              error={errors.username}
              leadingIcon={<AtSign size={16} strokeWidth={1.75} />}
              />
              {usernameStatus === 'checking' && (
              <p className="auth-username-availability is-checking" role="status">
                <LoaderCircle size={14} className="auth-spin" /> Checking availability…
              </p>
              )}
              {usernameStatus === 'available' && !errors.username && (
              <p className="auth-username-availability is-available" role="status">
                <CheckCircle2 size={14} /> Username is available.
              </p>
              )}
              {usernameStatus === 'error' && (
              <p className="auth-username-availability is-error" role="status">
                Couldn’t check availability. We’ll try again when you submit.
              </p>
              )}
              {usernameStatus === 'taken' && usernameSuggestions.length > 0 && (
              <div className="auth-username-suggestions" aria-label="Available username suggestions">
                <span>Try an available username:</span>
                <div>
                  {usernameSuggestions.map((suggestion) => (
                    <button
                      type="button"
                      className="auth-username-suggestion"
                      key={suggestion}
                      onClick={() => {
                        setUsername(suggestion)
                        setUsernameStatus('idle')
                        setUsernameSuggestions([])
                        setErrors((current) => ({ ...current, username: undefined }))
                      }}
                    >
                      @{suggestion}
                    </button>
                  ))}
                </div>
              </div>
              )}
            </div>

            <FormInput
              id="register-birthday"
              label="Date of birth"
              type="date"
              autoComplete="bday"
              value={birthday}
              max={latestEligibleBirthday()}
              onChange={(e) => {
                setBirthday(e.target.value)
                setErrors((current) => ({ ...current, birthday: undefined }))
              }}
              error={errors.birthday}
              leadingIcon={<Calendar size={16} strokeWidth={1.75} />}
            />
          </div>

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
            <div className="auth-age-confirmation-row">
              <label className="auth-checkbox-label auth-age-confirmation-label" htmlFor="register-age-confirmation">
                <input
                  id="register-age-confirmation"
                  type="checkbox"
                  className="auth-checkbox"
                  checked={ageConfirmed}
                  onChange={(event) => {
                    setAgeConfirmed(event.target.checked)
                    setErrors((current) => ({ ...current, ageConfirmed: undefined }))
                  }}
                  aria-describedby={errors.ageConfirmed ? 'register-age-confirmation-error' : undefined}
                />
                <span>By checking this, I confirm that I am {MINIMUM_ACCOUNT_AGE} or older.</span>
              </label>
              <button
                type="button"
                className="auth-age-learn-more"
                onClick={() => setLegalModalType('age')}
              >
                Learn more
              </button>
            </div>
            {errors.ageConfirmed && (
              <p id="register-age-confirmation-error" role="alert" className="form-input-error">
                {errors.ageConfirmed}
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
