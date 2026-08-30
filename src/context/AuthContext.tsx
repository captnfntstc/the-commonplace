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
} from 'firebase/auth'
import { auth, googleProvider, isFirebaseConfigured } from '../services/firebase'

interface AuthContextType {
  currentUser: User | null
  loading: boolean
  isDemoMode: boolean
  login: (email: string, pass: string) => Promise<void>
  signup: (email: string, pass: string, displayName?: string) => Promise<void>
  loginWithGoogle: () => Promise<void>
  logout: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
}

const DEFAULT_DEMO_USER: User = {
  uid: 'demo-jimb0iii-uid',
  email: 'jimb0iii@commonplace.app',
  displayName: 'jimb0iii',
  emailVerified: true,
  isAnonymous: false,
  metadata: {},
  providerData: [],
  refreshToken: '',
  tenantId: null,
  delete: async () => {},
  getIdToken: async () => 'demo-token',
  getIdTokenResult: async () => ({
    authTime: '',
    claims: {},
    issuedAtTime: '',
    expirationTime: '',
    signInProvider: null,
    signInSecondFactor: null,
    token: 'demo-token',
  }),
  reload: async () => {},
  toJSON: () => ({}),
  phoneNumber: null,
  photoURL: null,
  providerId: 'demo',
} as unknown as User

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (!isFirebaseConfigured) {
      try {
        const stored = localStorage.getItem('the-commonplace.auth-user')
        if (stored) return JSON.parse(stored)
      } catch {
        // fallback
      }
      return DEFAULT_DEMO_USER
    }
    return null
  })
  const [loading, setLoading] = useState<boolean>(true)

  const updateDemoUser = (user: User | null) => {
    setCurrentUser(user)
    if (user) {
      localStorage.setItem('the-commonplace.auth-user', JSON.stringify(user))
    } else {
      localStorage.removeItem('the-commonplace.auth-user')
    }
  }

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const login = async (emailInput: string, pass: string) => {
    const raw = emailInput.trim()
    const norm = raw.toLowerCase()
    const resolvedEmail = raw.includes('@') ? raw : `${raw}@commonplace.app`

    // Test credentials check: jimb0iii (or admin) with password 'password'
    const isTestUser =
      norm === 'jimb0iii' ||
      norm === 'jimb0iii@commonplace.app' ||
      norm === 'jimb0i' ||
      norm === 'admin' ||
      norm === 'admin@example.com' ||
      norm === 'admin@commonplace.app'

    if (isTestUser && pass === 'password') {
      const username = norm.includes('jimb0iii') || norm.includes('jimb0i') ? 'jimb0iii' : 'admin'
      const newUser = {
        ...DEFAULT_DEMO_USER,
        uid: `demo-${username}-uid`,
        email: `${username}@commonplace.app`,
        displayName: username,
      } as unknown as User
      updateDemoUser(newUser)
      return
    }

    if (!isFirebaseConfigured) {
      throw new Error('Invalid email or password.')
    }

    await signInWithEmailAndPassword(auth, resolvedEmail, pass)
  }

  const signup = async (email: string, pass: string, displayName?: string) => {
    if (!isFirebaseConfigured) {
      const newUser = {
        ...DEFAULT_DEMO_USER,
        uid: `demo-user-${Date.now()}`,
        email,
        displayName: displayName || email.split('@')[0],
      } as unknown as User
      updateDemoUser(newUser)
      return
    }

    const res = await createUserWithEmailAndPassword(auth, email, pass)
    if (displayName && res.user) {
      await updateProfile(res.user, { displayName })
      setCurrentUser({ ...res.user, displayName })
    }
  }

  const loginWithGoogle = async () => {
    if (!isFirebaseConfigured) {
      const newUser = {
        ...DEFAULT_DEMO_USER,
        uid: 'demo-google-user',
        email: 'googleuser@example.com',
        displayName: 'Google Demo User',
        photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      } as unknown as User
      updateDemoUser(newUser)
      return
    }

    await signInWithPopup(auth, googleProvider)
  }

  const logout = async () => {
    if (!isFirebaseConfigured) {
      updateDemoUser(null)
      return
    }
    await signOut(auth)
  }

  const resetPassword = async (email: string) => {
    if (!isFirebaseConfigured) {
      return
    }
    await sendPasswordResetEmail(auth, email)
  }

  const value: AuthContextType = {
    currentUser,
    loading,
    isDemoMode: !isFirebaseConfigured,
    login,
    signup,
    loginWithGoogle,
    logout,
    resetPassword,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
