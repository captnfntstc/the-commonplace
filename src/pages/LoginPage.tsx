import React from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthCard } from '../components/auth/AuthCard'
import { LoginForm } from '../components/auth/LoginForm'

interface LoginPageProps {
  onSwitchToRegister?: () => void
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSwitchToRegister }) => {
  const navigate = useNavigate()

  const handleSwitchTab = (tab: 'login' | 'register') => {
    if (tab === 'register') {
      if (onSwitchToRegister) {
        onSwitchToRegister()
      } else {
        navigate('/register')
      }
    }
  }

  return (
    <div className="auth-page sunrise-auth-page">
      <main className="auth-main">
        <div className="auth-container">
          <AuthCard
            activeTab="login"
            onSwitchTab={handleSwitchTab}
            formPanel={
              <LoginForm
                activeTab="login"
                onSwitchTab={handleSwitchTab}
                onSwitchToRegister={() => handleSwitchTab('register')}
              />
            }
          />
        </div>
      </main>
    </div>
  )
}
