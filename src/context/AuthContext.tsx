import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  type User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  reload,
  browserLocalPersistence,
  setPersistence,
} from 'firebase/auth'
import { auth, googleProvider, isFirebaseConfigured } from '../services/firebase'

interface AuthContextType {
  currentUser: User | null
  loading: boolean
  login: (email: string, pass: string) => Promise<void>
  signup: (email: string, pass: string, displayName?: string) => Promise<void>
  loginWithGoogle: () => Promise<void>
  logout: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
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

  const login = async (emailInput: string, pass: string) => {
    const raw = emailInput.trim()
    requireFirebase()
    await setPersistence(auth, browserLocalPersistence)
    await signInWithEmailAndPassword(auth, raw, pass)
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

  const loginWithGoogle = async () => {
    requireFirebase()
    await setPersistence(auth, browserLocalPersistence)
    await signInWithPopup(auth, googleProvider)
  }

  const logout = async () => {
    if (!isFirebaseConfigured) {
      setCurrentUser(null)
      return
    }
    await signOut(auth)
  }

  const resetPassword = async (email: string) => {
    requireFirebase()
    await sendPasswordResetEmail(auth, email)
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
    resetPassword,
    resendVerificationEmail,
    refreshEmailVerification,
    verificationEmailCooldownSeconds: Math.max(0, Math.ceil((verificationCooldownUntil - verificationClock) / 1000)),
    verificationEmailSent: verificationCooldownUntil > 0,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
