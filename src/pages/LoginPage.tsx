import React from 'react'
import { AuthHeader } from '../components/auth/AuthHeader'
import { AuthCard } from '../components/auth/AuthCard'
import { LoginForm } from '../components/auth/LoginForm'

interface LoginPageProps {
  onSwitchToRegister: () => void
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSwitchToRegister }) => {
  return (
    <div className="auth-page">
      <AuthHeader />
      <main className="auth-main">
        <div className="auth-container">
          <AuthCard
            formPanel={<LoginForm onSwitchToRegister={onSwitchToRegister} />}
          />
        </div>
      </main>
    </div>
  )
}
