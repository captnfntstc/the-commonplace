import { useEffect, useMemo, useState } from 'react'
import { signOut } from 'firebase/auth'
import { AlertCircle, CheckCircle2, Lock, MailCheck, XCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { AuthHeader } from '../components/auth/AuthHeader'
import { PasswordInput } from '../components/auth/PasswordInput'
import { PasswordStrengthMeter } from '../components/auth/PasswordStrengthMeter'
import { auth } from '../services/firebase'

type ResetState = 'checking' | 'valid' | 'invalid' | 'success'

async function postResetRequest(path: string, body: Record<string, string>) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({})) as { valid?: boolean; reset?: boolean; error?: string }
  if (!response.ok) throw new Error(payload.error || 'The password reset service is unavailable.')
  return payload
}

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const token = useMemo(
    () => window.location.pathname.match(/^\/reset-password\/([A-Za-z0-9_-]{20,64})$/)?.[1] || '',
    [],
  )
  const [status, setStatus] = useState<ResetState>(token ? 'checking' : 'invalid')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    void postResetRequest('/api/auth/password-reset-links/validate', { token })
      .then((payload) => {
        if (!cancelled) setStatus(payload.valid ? 'valid' : 'invalid')
      })
      .catch(() => {
        if (!cancelled) setStatus('invalid')
      })
    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    if (status !== 'success') return
    const timeout = window.setTimeout(() => navigate('/login', { replace: true }), 3000)
    return () => window.clearTimeout(timeout)
  }, [navigate, status])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Your new password must be at least 8 characters long.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    try {
      setSubmitting(true)
      await postResetRequest('/api/auth/password-reset-links/redeem', { token, newPassword: password })
      await signOut(auth).catch(() => {})
      setStatus('success')
    } catch (requestError) {
      const message = (requestError as Error)?.message || 'Unable to update your password.'
      if (/invalid|expired/i.test(message)) setStatus('invalid')
      else setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const returnToLogin = () => navigate('/login', { replace: true })

  if (status !== 'valid') {
    const content = status === 'checking'
      ? {
          Icon: MailCheck,
          title: 'Checking your reset link...',
          message: 'Please keep this page open while we validate the link.',
        }
      : status === 'success'
        ? {
            Icon: CheckCircle2,
            title: 'Password updated.',
            message: 'Your password has been changed. Returning you to log in...',
          }
        : {
            Icon: XCircle,
            title: 'This link is invalid or expired.',
            message: 'Request a new password reset email from the login screen.',
          }

    return (
      <div className="auth-page">
        <AuthHeader />
        <main className="auth-main">
          <section className="email-action-card" aria-live="polite">
            <content.Icon aria-hidden="true" className={`email-action-icon ${status === 'success' ? 'success' : status === 'invalid' ? 'error' : 'checking'}`} />
            <h1>{content.title}</h1>
            <p>{content.message}</p>
            {status !== 'checking' && (
              <button type="button" className="auth-primary-btn" onClick={returnToLogin}>
                Return to log in
              </button>
            )}
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <AuthHeader />
      <main className="auth-main">
        <section className="email-action-card reset-password-card">
          <h1>Choose a new password.</h1>
          <p>Use at least 8 characters and choose something you do not use elsewhere.</p>
          {error && (
            <div className="auth-generic-error-banner" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
          <form className="auth-form reset-password-form" onSubmit={handleSubmit} noValidate>
            <div className="auth-fields-stack">
              <div>
                <PasswordInput
                  id="reset-new-password"
                  label="New password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    setError('')
                  }}
                  leadingIcon={<Lock size={16} strokeWidth={1.75} />}
                />
                <PasswordStrengthMeter password={password} />
              </div>
              <PasswordInput
                id="reset-confirm-password"
                label="Confirm new password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value)
                  setError('')
                }}
                leadingIcon={<Lock size={16} strokeWidth={1.75} />}
              />
            </div>
            <button type="submit" className="auth-primary-btn" disabled={submitting}>
              {submitting ? 'Updating password...' : 'Update password'}
            </button>
          </form>
        </section>
      </main>
    </div>
  )
}
