import React from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthCard } from '../components/auth/AuthCard'
import { RegisterForm } from '../components/auth/RegisterForm'

interface RegisterPageProps {
  onSwitchToLogin?: () => void
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onSwitchToLogin }) => {
  const navigate = useNavigate()

  const handleSwitchTab = (tab: 'login' | 'register') => {
    if (tab === 'login') {
      if (onSwitchToLogin) {
        onSwitchToLogin()
      } else {
        navigate('/login')
      }
    }
  }

  return (
    <div className="auth-page sunrise-auth-page">
      <main className="auth-main">
        <div className="auth-container">
          <AuthCard
            activeTab="register"
            onSwitchTab={handleSwitchTab}
            formPanel={
              <RegisterForm
                activeTab="register"
                onSwitchTab={handleSwitchTab}
                onSwitchToLogin={() => handleSwitchTab('login')}
              />
            }
          />
        </div>
      </main>
    </div>
  )
}
