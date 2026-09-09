import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  type User,
  type UserCredential,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  getAdditionalUserInfo,
  signOut,
  reload,
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
  verifyBeforeUpdateEmail,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  linkWithPopup,
  unlink,
} from 'firebase/auth'
import { auth, googleProvider, isFirebaseConfigured } from '../services/firebase'
import { loadUserProfile, reactivateUserAccount, saveUserProfile } from '../services/cloudData'
import { PENDING_SIGNUP_PROFILE_KEY, profileFromAuthUser } from '../features/profiles/accountProfile'

interface AuthContextType {
  currentUser: User | null
  loading: boolean
  login: (identifier: string, pass: string, keepSignedIn?: boolean) => Promise<void>
  signup: (email: string, pass: string, displayName?: string, handle?: string, birthday?: string) => Promise<void>
  loginWithGoogle: (keepSignedIn?: boolean, birthday?: string) => Promise<void>
  logout: () => Promise<void>
  deactivateAccount: (answers: AccountDeactivationAnswers) => Promise<void>
  deleteAccount: () => Promise<void>
  changeEmail: (newEmail: string) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  setGoogleAccountLinked: (linked: boolean) => Promise<void>
  resendVerificationEmail: () => Promise<void>
  refreshEmailVerification: () => Promise<boolean>
  verificationEmailCooldownSeconds: number
  verificationEmailSent: boolean
}

export type AccountDeactivationAnswers = {
  reason: string
  returnPlan: string
  safetyConcern: boolean
  feedback: string
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
    if (key?.startsWith('the-commonplace.') || key?.startsWith('the_commonplace_')) keysToRemove.push(key)
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

  const login = async (identifier: string, pass: string, keepSignedIn = true) => {
    requireFirebase()
    await setPersistence(auth, keepSignedIn ? browserLocalPersistence : browserSessionPersistence)
    const email = await resolveLoginEmail(identifier)
    const credential = await signInWithEmailAndPassword(auth, email, pass)
    await reactivateUserAccount(credential.user.uid)
  }

  const signup = async (email: string, pass: string, displayName?: string, handle?: string, birthday?: string) => {
    requireFirebase()
    await setPersistence(auth, browserLocalPersistence)
    const normalizedEmail = email.trim().toLowerCase()
    localStorage.setItem(PENDING_SIGNUP_PROFILE_KEY, JSON.stringify({
      email: normalizedEmail,
      displayName: displayName?.trim() || '',
      handle: handle?.trim().toLowerCase() || '',
      birthday: birthday?.trim() || '',
    }))
    let res: UserCredential
    try {
      res = await createUserWithEmailAndPassword(auth, normalizedEmail, pass)
    } catch (error) {
      localStorage.removeItem(PENDING_SIGNUP_PROFILE_KEY)
      throw error
    }
    try {
      if (displayName && res.user) {
        await updateProfile(res.user, { displayName })
        setAuthRefreshVersion((version) => version + 1)
      }
      if (handle) {
        await saveUserProfile(
          res.user.uid,
          profileFromAuthUser(res.user, displayName, handle, birthday),
        )
      }
    } catch (error) {
      localStorage.removeItem(PENDING_SIGNUP_PROFILE_KEY)
      await deleteUser(res.user).catch(() => undefined)
      throw error
    }
  }

  const loginWithGoogle = async (keepSignedIn = true, birthday?: string) => {
    requireFirebase()
    await setPersistence(auth, keepSignedIn ? browserLocalPersistence : browserSessionPersistence)
    const credential = await signInWithPopup(auth, googleProvider)
    const isNewAccount = getAdditionalUserInfo(credential)?.isNewUser === true
    if (isNewAccount && !birthday) {
      await deleteUser(credential.user).catch(() => undefined)
      throw new Error('New Google accounts must be created from the registration page with a valid date of birth.')
    }
    if (birthday) {
      const existingProfile = isNewAccount ? null : await loadUserProfile(credential.user.uid).catch(() => null)
      await saveUserProfile(
        credential.user.uid,
        existingProfile
          ? { ...existingProfile, birthday: existingProfile.birthday || birthday }
          : profileFromAuthUser(credential.user, undefined, undefined, birthday),
      )
    }
    await reactivateUserAccount(credential.user.uid)
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

  const deactivateAccount = async (answers: AccountDeactivationAnswers) => {
    requireFirebase()
    if (!currentUser) throw new Error('You need to log in before deactivating your account.')
    let response: Response
    try {
      const idToken = await currentUser.getIdToken()
      response = await fetch('/api/auth/account/deactivate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(answers),
      })
    } catch (error) {
      throw new Error('The account deactivation service is unavailable. Please try again shortly.', { cause: error })
    }
    const payload = await response.json().catch(() => ({})) as { error?: string }
    if (!response.ok) throw new Error(payload.error || 'Unable to deactivate your account.')
    await signOut(auth).catch(() => undefined)
    setCurrentUser(null)
    clearCommonplaceStorage()
    setVerificationCooldownUntil(0)
    setVerificationClock(Date.now())
  }

  const deleteAccount = async () => {
    requireFirebase()
    if (!currentUser) throw new Error('You need to log in before deleting your account.')
    let response: Response
    try {
      const idToken = await currentUser.getIdToken()
      response = await fetch('/api/auth/account', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` },
      })
    } catch (error) {
      throw new Error('The account deletion service is unavailable. Please try again shortly.', { cause: error })
    }
    const payload = await response.json().catch(() => ({})) as { error?: string }
    if (!response.ok) throw new Error(payload.error || 'Unable to delete your account.')
    await signOut(auth).catch(() => undefined)
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

  const changePassword = async (currentPassword: string, newPassword: string) => {
    requireFirebase()
    if (!currentUser?.email) throw new Error('You need to log in with an email account before changing your password.')
    if (!currentPassword) throw new Error('Enter your current password.')
    if (newPassword.length < 8) throw new Error('Your new password must be at least 8 characters long.')
    const credential = EmailAuthProvider.credential(currentUser.email, currentPassword)
    await reauthenticateWithCredential(currentUser, credential)
    await updatePassword(currentUser, newPassword)
  }

  const setGoogleAccountLinked = async (linked: boolean) => {
    requireFirebase()
    if (!currentUser) throw new Error('You need to log in before changing linked accounts.')
    const providers = currentUser.providerData || []
    const hasGoogle = providers.some(({ providerId }) => providerId === 'google.com')
    if (linked && !hasGoogle) {
      await linkWithPopup(currentUser, googleProvider)
    } else if (!linked && hasGoogle) {
      if (providers.length <= 1) throw new Error('Add another sign-in method before disconnecting Google.')
      await unlink(currentUser, 'google.com')
    }
    setAuthRefreshVersion((version) => version + 1)
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
    deactivateAccount,
    deleteAccount,
    changeEmail,
    changePassword,
    setGoogleAccountLinked,
    resendVerificationEmail,
    refreshEmailVerification,
    verificationEmailCooldownSeconds: Math.max(0, Math.ceil((verificationCooldownUntil - verificationClock) / 1000)),
    verificationEmailSent: verificationCooldownUntil > 0,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
