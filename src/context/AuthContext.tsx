import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../services/supabase'
import { reactivateUserAccount, saveUserProfile } from '../services/cloudData'
import { PENDING_SIGNUP_PROFILE_KEY, profileFromAuthUser } from '../features/profiles/accountProfile'

export interface User {
  uid: string
  email: string | null
  displayName: string | null
  handle?: string | null
  emailVerified: boolean
  isAnonymous?: boolean
  photoURL: string | null
  metadata?: {
    creationTime?: string
  }
  providerData: Array<{
    providerId: string
    uid: string
    displayName: string | null
    email: string | null
    phoneNumber: string | null
    photoURL: string | null
  }>
  getIdToken: (forceRefresh?: boolean) => Promise<string>
}

function mapSupabaseUserToAuthUser(sbUser: any, sessionToken?: string): User {
  return {
    uid: sbUser.id,
    email: sbUser.email || null,
    displayName:
      sbUser.user_metadata?.name ||
      sbUser.user_metadata?.full_name ||
      sbUser.user_metadata?.displayName ||
      null,
    handle: sbUser.user_metadata?.handle || null,
    emailVerified: Boolean(sbUser.email_confirmed_at),
    isAnonymous: sbUser.is_anonymous || false,
    photoURL: sbUser.user_metadata?.avatar_url || null,
    metadata: {
      creationTime: sbUser.created_at || undefined,
    },
    providerData: (sbUser.identities || []).map((id: any) => ({
      providerId: id.provider === 'google' ? 'google.com' : id.provider === 'apple' ? 'apple.com' : id.provider,
      uid: id.id,
      displayName: null,
      email: sbUser.email || null,
      phoneNumber: null,
      photoURL: null,
    })),
    getIdToken: async () => {
      if (sessionToken) return sessionToken
      if (isSupabaseConfigured) {
        const { data } = await supabase.auth.getSession()
        if (data.session?.access_token) return data.session.access_token
      }
      return ''
    },
  }
}

interface AuthContextType {
  currentUser: User | null
  loading: boolean
  login: (identifier: string, pass: string, keepSignedIn?: boolean) => Promise<void>
  signup: (email: string, pass: string, displayName?: string, handle?: string, birthday?: string) => Promise<void>
  loginWithGoogle: (keepSignedIn?: boolean, birthday?: string) => Promise<void>
  loginWithApple: (keepSignedIn?: boolean, birthday?: string) => Promise<void>
  logout: () => Promise<void>
  deactivateAccount: (answers: AccountDeactivationAnswers) => Promise<void>
  deleteAccount: () => Promise<void>
  changeEmail: (newEmail: string) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  setGoogleAccountLinked: (linked: boolean) => Promise<void>
  setAppleAccountLinked: (linked: boolean) => Promise<void>
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
  const [loading, setLoading] = useState<boolean>(() => !initialUser && isSupabaseConfigured)
  const [, setAuthRefreshVersion] = useState(0)
  const [verificationCooldownUntil, setVerificationCooldownUntil] = useState(() => readVerificationCooldown(initialUser))
  const [verificationClock, setVerificationClock] = useState(Date.now)

  useEffect(() => {
    localStorage.removeItem('the-commonplace.auth-user')
    if (initialUser) return

    let mounted = true

    if (isSupabaseConfigured) {
      void supabase.auth.getSession().then(({ data: { session } }) => {
        if (!mounted) return
        if (session?.user) {
          const user = mapSupabaseUserToAuthUser(session.user, session.access_token)
          setCurrentUser(user)
          setVerificationCooldownUntil(readVerificationCooldown(user))
          setLoading(false)
        } else {
          setLoading(false)
        }
      })

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!mounted) return
        if (session?.user) {
          const user = mapSupabaseUserToAuthUser(session.user, session.access_token)
          setCurrentUser(user)
          setVerificationCooldownUntil(readVerificationCooldown(user))
          setLoading(false)
        } else {
          setCurrentUser(null)
          setLoading(false)
        }
      })

      return () => {
        mounted = false
        subscription.unsubscribe()
      }
    }

    setLoading(false)
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

  const requireConfig = () => {
    if (!isSupabaseConfigured) {
      throw new Error('Authentication is not configured. Add credentials to .env.local first.')
    }
  }

  const login = async (identifier: string, pass: string, _keepSignedIn = true) => {
    requireConfig()
    const email = await resolveLoginEmail(identifier)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    })
    if (error) {
      throw error
    }
    if (data?.user) {
      const user = mapSupabaseUserToAuthUser(data.user, data.session?.access_token)
      setCurrentUser(user)
      await reactivateUserAccount(data.user.id)
    }
  }

  const signup = async (email: string, pass: string, displayName?: string, handle?: string, birthday?: string) => {
    requireConfig()
    const normalizedEmail = email.trim().toLowerCase()
    localStorage.setItem(PENDING_SIGNUP_PROFILE_KEY, JSON.stringify({
      email: normalizedEmail,
      displayName: displayName?.trim() || '',
      handle: handle?.trim().toLowerCase() || '',
      birthday: birthday?.trim() || '',
    }))

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: pass,
      options: {
        data: {
          name: displayName?.trim() || '',
          handle: handle?.trim().toLowerCase() || '',
          birthdate: birthday?.trim() || null,
        },
      },
    })
    if (error) {
      localStorage.removeItem(PENDING_SIGNUP_PROFILE_KEY)
      throw error
    }
    if (data?.user) {
      const user = mapSupabaseUserToAuthUser(data.user, data.session?.access_token)
      if (handle) {
        await saveUserProfile(
          data.user.id,
          profileFromAuthUser(user as any, displayName, handle, birthday),
        )
      }
      setCurrentUser(user)
    }
  }

  const loginWithGoogle = async (_keepSignedIn = true, _birthday?: string) => {
    requireConfig()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    })
    if (error) throw error
  }

  const loginWithApple = async (_keepSignedIn = true, _birthday?: string) => {
    requireConfig()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: window.location.origin,
      },
    })
    if (error) throw error
  }

  const logout = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut().catch(() => undefined)
    }
    setCurrentUser(null)
    clearCommonplaceStorage()
    setVerificationCooldownUntil(0)
    setVerificationClock(Date.now())
  }

  const deactivateAccount = async (answers: AccountDeactivationAnswers) => {
    requireConfig()
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
    await supabase.auth.signOut().catch(() => undefined)
    setCurrentUser(null)
    clearCommonplaceStorage()
    setVerificationCooldownUntil(0)
    setVerificationClock(Date.now())
  }

  const deleteAccount = async () => {
    requireConfig()
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
    await supabase.auth.signOut().catch(() => undefined)
    setCurrentUser(null)
    clearCommonplaceStorage()
    setVerificationCooldownUntil(0)
    setVerificationClock(Date.now())
  }

  const changeEmail = async (newEmail: string) => {
    if (!currentUser) throw new Error('You need to log in before changing your email.')
    const normalized = newEmail.trim().toLowerCase()
    if (!normalized) throw new Error('Enter a new email address.')
    const { error } = await supabase.auth.updateUser({ email: normalized })
    if (error) throw error
  }

  const changePassword = async (_currentPassword: string, newPassword: string) => {
    if (!currentUser?.email) throw new Error('You need to log in with an email account before changing your password.')
    if (newPassword.length < 8) throw new Error('Your new password must be at least 8 characters long.')
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
  }

  const setGoogleAccountLinked = async (linked: boolean) => {
    if (!currentUser) throw new Error('You need to log in before changing linked accounts.')
    if (linked) {
      await supabase.auth.linkIdentity({ provider: 'google', options: { redirectTo: window.location.origin } })
    } else {
      const identity = currentUser.providerData?.find((p) => p.providerId === 'google.com')
      if (identity) {
        await supabase.auth.unlinkIdentity({ id: identity.uid } as any)
      }
    }
    setAuthRefreshVersion((version) => version + 1)
  }

  const setAppleAccountLinked = async (linked: boolean) => {
    if (!currentUser) throw new Error('You need to log in before changing linked accounts.')
    if (linked) {
      await supabase.auth.linkIdentity({ provider: 'apple', options: { redirectTo: window.location.origin } })
    } else {
      const identity = currentUser.providerData?.find((p) => p.providerId === 'apple.com')
      if (identity) {
        await supabase.auth.unlinkIdentity({ id: identity.uid } as any)
      }
    }
    setAuthRefreshVersion((version) => version + 1)
  }

  const resendVerificationEmail = async () => {
    requireConfig()
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
    if (!currentUser) return false
    if (isSupabaseConfigured) {
      const { data } = await supabase.auth.getUser()
      if (data?.user) {
        const mapped = mapSupabaseUserToAuthUser(data.user)
        setCurrentUser(mapped)
        setAuthRefreshVersion((version) => version + 1)
        return mapped.emailVerified
      }
    }
    return false
  }

  const value: AuthContextType = {
    currentUser,
    loading,
    login,
    signup,
    loginWithGoogle,
    loginWithApple,
    logout,
    deactivateAccount,
    deleteAccount,
    changeEmail,
    changePassword,
    setGoogleAccountLinked,
    setAppleAccountLinked,
    resendVerificationEmail,
    refreshEmailVerification,
    verificationEmailCooldownSeconds: Math.max(0, Math.ceil((verificationCooldownUntil - verificationClock) / 1000)),
    verificationEmailSent: verificationCooldownUntil > 0,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
