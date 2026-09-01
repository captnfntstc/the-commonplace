import { useEffect, useState } from 'react'
import { applyActionCode } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { CheckCircle2, MailCheck, XCircle } from 'lucide-react'
import { AuthHeader } from '../components/auth/AuthHeader'
import { auth, db, isFirebaseConfigured } from '../services/firebase'

type VerificationState = 'checking' | 'success' | 'error'
type VerificationRequest =
  | { kind: 'short'; token: string }
  | { kind: 'legacy'; code: string }
  | { kind: 'invalid' }

const pendingVerifications = new Map<string, Promise<void>>()

function verifyCode(code: string) {
  const existing = pendingVerifications.get(code)
  if (existing) return existing
  const request = applyActionCode(auth, code)
  pendingVerifications.set(code, request)
  return request
}

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

function getVerificationRequest(): VerificationRequest {
  const shortToken = window.location.pathname.match(/^\/v\/([A-Za-z0-9_-]{20,64})$/)?.[1]
  if (shortToken) return { kind: 'short', token: shortToken }
  const parameters = new URLSearchParams(window.location.search)
  const actionCode = parameters.get('oobCode')
  const mode = parameters.get('mode')
  if (isFirebaseConfigured && (mode === 'verifyEmail' || mode === 'verifyAndChangeEmail') && actionCode) {
    return { kind: 'legacy', code: actionCode }
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
      // Remove legacy Firebase identifiers and the one-time code from the address bar immediately.
      window.history.replaceState({}, '', '/verify-email')
    }

    if (verificationRequest.kind === 'invalid') return

    let cancelled = false
    const verification = verificationRequest.kind === 'short'
      ? redeemShortLink(verificationRequest.token)
      : verifyCode(verificationRequest.code)
    verification
      .then(async () => {
        if (auth.currentUser) {
          await auth.currentUser.reload()
          await auth.currentUser.getIdToken(true)
          if (auth.currentUser.email) {
            await setDoc(doc(db, 'users', auth.currentUser.uid, 'private', 'settings'), {
              email: auth.currentUser.email,
              updatedAt: new Date().toISOString(),
            }, { merge: true }).catch(() => {})
          }
        }
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
