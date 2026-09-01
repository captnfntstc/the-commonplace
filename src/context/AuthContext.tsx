import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  type User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  signOut,
  reload,
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
  verifyBeforeUpdateEmail,
} from 'firebase/auth'
import { auth, googleProvider, isFirebaseConfigured } from '../services/firebase'

interface AuthContextType {
  currentUser: User | null
  loading: boolean
  login: (identifier: string, pass: string, keepSignedIn?: boolean) => Promise<void>
  signup: (email: string, pass: string, displayName?: string) => Promise<void>
  loginWithGoogle: (keepSignedIn?: boolean) => Promise<void>
  logout: () => Promise<void>
  changeEmail: (newEmail: string) => Promise<void>
  resendVerificationEmail: () => Promise<void>
  refreshEmailVerification: () => Promise<boolean>
  verificationEmailCooldownSeconds: number
  verificationEmailSent: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)
const VERIFICATION_EMAIL_COOLDOWN_MS = 60_000

function verificationCooldownKey(user: User) {
  return `the-commonplace.verification-email-cooldown.${user.uid || user.email || 'account'}`
}

function readVerificationCooldown(user?: User | null) {
  if (!user) return 0
  const stored = Number(localStorage.getItem(verificationCooldownKey(user)) || 0)
  return Number.isFinite(stored) && stored > 0 ? stored : 0
}

class VerificationEmailError extends Error {
  retryAfter = 0
}

async function sendAccountVerification(user: User) {
  let response: Response
  try {
    const idToken = await user.getIdToken()
    response = await fetch('/api/auth/verification-links', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
    })
  } catch {
    throw new Error('The custom verification email service is unavailable. Please try again shortly.')
  }

  const payload = await response.json().catch(() => ({})) as { error?: string; retryAfter?: number }
  if (response.ok) return Number(payload.retryAfter) || VERIFICATION_EMAIL_COOLDOWN_MS / 1000

  const error = new VerificationEmailError(payload.error || 'Unable to send verification email.')
  error.retryAfter = Number(payload.retryAfter) || 0
  throw error
}

function isEmailIdentifier(identifier: string) {
  return !identifier.startsWith('@') && (identifier.includes('@') || identifier.includes('.'))
}

async function resolveLoginEmail(identifier: string) {
  const normalized = identifier.trim()
  if (isEmailIdentifier(normalized)) return normalized

  const handle = normalized.replace(/^@/, '').toLowerCase()
  let response: Response
  try {
    response = await fetch(`/api/auth/user-by-handle?handle=${encodeURIComponent(handle)}`, {
      headers: { Accept: 'application/json' },
    })
  } catch {
    throw new Error('The sign-in service is unavailable. Please try again shortly.')
  }

  const payload = await response.json().catch(() => ({})) as { email?: string }
  if (!response.ok || !payload.email) throw new Error('Invalid email or password.')
  return payload.email
}

function clearCommonplaceStorage() {
  const keysToRemove: string[] = []
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index)
    if (key?.startsWith('the-commonplace.')) keysToRemove.push(key)
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key))
}

// eslint-disable-next-line react-refresh/only-export-components -- The hook and provider intentionally share one context module.
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider: React.FC<{ children: React.ReactNode; initialUser?: User }> = ({
  children,
  initialUser,
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(initialUser || null)
  const [loading, setLoading] = useState<boolean>(() => !initialUser && isFirebaseConfigured)
  const [, setAuthRefreshVersion] = useState(0)
  const [verificationCooldownUntil, setVerificationCooldownUntil] = useState(() => readVerificationCooldown(initialUser))
  const [verificationClock, setVerificationClock] = useState(Date.now)

  useEffect(() => {
    localStorage.removeItem('the-commonplace.auth-user')
    if (initialUser) return
    if (!isFirebaseConfigured) return

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user)
      setVerificationCooldownUntil(readVerificationCooldown(user))
      setLoading(false)
    })

    return () => unsubscribe()
  }, [initialUser])

  useEffect(() => {
    if (verificationCooldownUntil <= Date.now()) return
    const interval = window.setInterval(() => {
      const now = Date.now()
      setVerificationClock(now)
      if (now >= verificationCooldownUntil) window.clearInterval(interval)
    }, 1000)
    return () => window.clearInterval(interval)
  }, [verificationCooldownUntil])

  const requireFirebase = () => {
    if (!isFirebaseConfigured) {
      throw new Error('Firebase is not configured. Add the Firebase values to .env.local first.')
    }
  }

  const login = async (identifier: string, pass: string, keepSignedIn = false) => {
    requireFirebase()
    await setPersistence(auth, keepSignedIn ? browserLocalPersistence : browserSessionPersistence)
    const email = await resolveLoginEmail(identifier)
    await signInWithEmailAndPassword(auth, email, pass)
  }

  const signup = async (email: string, pass: string, displayName?: string) => {
    requireFirebase()
    await setPersistence(auth, browserLocalPersistence)
    const res = await createUserWithEmailAndPassword(auth, email, pass)
    if (displayName && res.user) {
      await updateProfile(res.user, { displayName })
      setAuthRefreshVersion((version) => version + 1)
    }
    const retryAfter = await sendAccountVerification(res.user)
    const cooldownUntil = Date.now() + retryAfter * 1000
    localStorage.setItem(verificationCooldownKey(res.user), String(cooldownUntil))
    setVerificationCooldownUntil(cooldownUntil)
    setVerificationClock(Date.now())
  }

  const loginWithGoogle = async (keepSignedIn = false) => {
    requireFirebase()
    await setPersistence(auth, keepSignedIn ? browserLocalPersistence : browserSessionPersistence)
    await signInWithPopup(auth, googleProvider)
  }

  const logout = async () => {
    if (!isFirebaseConfigured) {
      setCurrentUser(null)
      clearCommonplaceStorage()
      setVerificationCooldownUntil(0)
      return
    }
    await signOut(auth)
    setCurrentUser(null)
    clearCommonplaceStorage()
    setVerificationCooldownUntil(0)
    setVerificationClock(Date.now())
  }

  const changeEmail = async (newEmail: string) => {
    requireFirebase()
    if (!currentUser) throw new Error('You need to log in before changing your email.')
    const normalized = newEmail.trim().toLowerCase()
    if (!normalized) throw new Error('Enter a new email address.')
    await verifyBeforeUpdateEmail(currentUser, normalized, {
      url: `${window.location.origin}/verify-email`,
      handleCodeInApp: true,
    })
  }

  const resendVerificationEmail = async () => {
    requireFirebase()
    if (!currentUser) throw new Error('You need to log in before verifying your email.')
    if (currentUser.emailVerified) return
    try {
      const retryAfter = await sendAccountVerification(currentUser)
      const cooldownUntil = Date.now() + retryAfter * 1000
      localStorage.setItem(verificationCooldownKey(currentUser), String(cooldownUntil))
      setVerificationCooldownUntil(cooldownUntil)
      setVerificationClock(Date.now())
    } catch (error) {
      const retryAfter = error instanceof VerificationEmailError ? error.retryAfter : 0
      if (retryAfter > 0) {
        const cooldownUntil = Date.now() + retryAfter * 1000
        localStorage.setItem(verificationCooldownKey(currentUser), String(cooldownUntil))
        setVerificationCooldownUntil(cooldownUntil)
        setVerificationClock(Date.now())
      }
      throw error
    }
  }

  const refreshEmailVerification = async () => {
    requireFirebase()
    if (!currentUser) return false
    await reload(currentUser)
    await currentUser.getIdToken(true)
    setAuthRefreshVersion((version) => version + 1)
    return currentUser.emailVerified
  }

  const value: AuthContextType = {
    currentUser,
    loading,
    login,
    signup,
    loginWithGoogle,
    logout,
    changeEmail,
    resendVerificationEmail,
    refreshEmailVerification,
    verificationEmailCooldownSeconds: Math.max(0, Math.ceil((verificationCooldownUntil - verificationClock) / 1000)),
    verificationEmailSent: verificationCooldownUntil > 0,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
