import { useEffect, useState } from 'react'
import { CheckCircle2, MailCheck, XCircle } from 'lucide-react'
import { AuthHeader } from '../components/auth/AuthHeader'
import { supabase } from '../services/supabase'

type VerificationState = 'checking' | 'success' | 'error'
type VerificationRequest =
  | { kind: 'short'; token: string }
  | { kind: 'otp'; tokenHash: string; type: string }
  | { kind: 'invalid' }

const pendingVerifications = new Map<string, Promise<void>>()

async function redeemShortLink(token: string) {
  const key = `short:${token}`
  const existing = pendingVerifications.get(key)
  if (existing) return existing
  const request = fetch('/api/auth/verification-links/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
    .then(async (response) => {
      const payload = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(payload.error || 'This verification link is invalid or expired.')
    })
  pendingVerifications.set(key, request)
  return request
}

async function redeemSupabaseOtp(tokenHash: string, type: any) {
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
  if (error) throw error
}

function getVerificationRequest(): VerificationRequest {
  const shortToken = window.location.pathname.match(/^\/v\/([A-Za-z0-9_-]{20,64})$/)?.[1]
  if (shortToken) return { kind: 'short', token: shortToken }
  const parameters = new URLSearchParams(window.location.search)
  const tokenHash = parameters.get('token_hash')
  const type = parameters.get('type') || 'email'
  if (tokenHash) {
    return { kind: 'otp', tokenHash, type }
  }
  return { kind: 'invalid' }
}

export function EmailVerificationPage() {
  const [verificationRequest] = useState<VerificationRequest>(getVerificationRequest)
  const [status, setStatus] = useState<VerificationState>(
    verificationRequest.kind === 'invalid' ? 'error' : 'checking',
  )

  useEffect(() => {
    if (verificationRequest.kind !== 'short') {
      window.history.replaceState({}, '', '/verify-email')
    }

    if (verificationRequest.kind === 'invalid') return

    let cancelled = false
    const verification = verificationRequest.kind === 'short'
      ? redeemShortLink(verificationRequest.token)
      : redeemSupabaseOtp(verificationRequest.tokenHash, verificationRequest.type)

    verification
      .then(async () => {
        await supabase.auth.getUser().catch(() => undefined)
        if (!cancelled) setStatus('success')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [verificationRequest])

  const content = status === 'checking'
    ? {
        Icon: MailCheck,
        title: 'Verifying your email...',
        message: 'Please keep this page open while we confirm your address.',
      }
    : status === 'success'
      ? {
          Icon: CheckCircle2,
          title: 'Email verified.',
          message: 'Your account is confirmed. You can now publish entries on The Commonplace.',
        }
      : {
          Icon: XCircle,
          title: 'Verification link unavailable.',
          message: 'This link may be invalid or expired. Return to Settings to request a new verification email.',
        }

  return (
    <div className="auth-page">
      <AuthHeader />
      <main className="auth-main">
        <section className="email-action-card" aria-live="polite">
          <content.Icon aria-hidden="true" className={`email-action-icon ${status}`} />
          <h1>{content.title}</h1>
          <p>{content.message}</p>
          {status !== 'checking' && (
            <button type="button" className="auth-primary-btn" onClick={() => window.location.assign('/')}>
              Return to The Commonplace
            </button>
          )}
        </section>
      </main>
    </div>
  )
}
