import React from 'react'
import { AuthHeader } from '../components/auth/AuthHeader'
import { AuthCard } from '../components/auth/AuthCard'
import { RegisterForm } from '../components/auth/RegisterForm'

interface RegisterPageProps {
  onSwitchToLogin: () => void
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onSwitchToLogin }) => {
  return (
    <div className="auth-page">
      <AuthHeader />
      <main className="auth-main">
        <div className="auth-container">
          <AuthCard
            formPanel={<RegisterForm onSwitchToLogin={onSwitchToLogin} />}
          />
        </div>
      </main>
    </div>
  )
}
