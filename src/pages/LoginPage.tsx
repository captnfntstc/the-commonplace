import React from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthHeader } from '../components/auth/AuthHeader'
import { AuthCard } from '../components/auth/AuthCard'
import { LoginForm } from '../components/auth/LoginForm'

interface LoginPageProps {
  onSwitchToRegister?: () => void
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSwitchToRegister }) => {
  const navigate = useNavigate()
  const handleSwitch = () => {
    if (onSwitchToRegister) {
      onSwitchToRegister()
    } else {
      navigate('/register')
    }
  }

  return (
    <div className="auth-page">
      <AuthHeader />
      <main className="auth-main">
        <div className="auth-container">
          <AuthCard
            formPanel={<LoginForm onSwitchToRegister={handleSwitch} />}
          />
        </div>
      </main>
    </div>
  )
}

