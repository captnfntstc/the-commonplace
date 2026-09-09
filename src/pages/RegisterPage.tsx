import React from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthHeader } from '../components/auth/AuthHeader'
import { AuthCard } from '../components/auth/AuthCard'
import { RegisterForm } from '../components/auth/RegisterForm'

interface RegisterPageProps {
  onSwitchToLogin?: () => void
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onSwitchToLogin }) => {
  const navigate = useNavigate()
  const handleSwitch = () => {
    if (onSwitchToLogin) {
      onSwitchToLogin()
    } else {
      navigate('/login')
    }
  }

  return (
    <div className="auth-page">
      <AuthHeader />
      <main className="auth-main">
        <div className="auth-container">
          <AuthCard
            formPanel={<RegisterForm onSwitchToLogin={handleSwitch} />}
          />
        </div>
      </main>
    </div>
  )
}
