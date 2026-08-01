/**
 * Standalone auth preview entry point.
 * This is completely separate from the main app — it only renders the auth pages.
 * Navigate to http://localhost:5173/auth-preview.html to preview the auth pages.
 *
 * To link to the main app in the future:
 * 1. Add react-router-dom routes for /login and /register in App.tsx
 * 2. Import LoginPage and RegisterPage in the router
 * 3. Remove or keep this preview file as-is
 */

import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './App.css'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'

function AuthPreviewApp() {
  const [view, setView] = useState<'login' | 'register'>('login')

  if (view === 'register') {
    return <RegisterPage onSwitchToLogin={() => setView('login')} />
  }

  return <LoginPage onSwitchToRegister={() => setView('register')} />
}

createRoot(document.getElementById('auth-preview-root')!).render(
  <StrictMode>
    <AuthPreviewApp />
  </StrictMode>,
)
