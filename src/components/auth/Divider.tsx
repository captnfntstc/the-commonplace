import React from 'react'

interface DividerProps {
  label?: string
}

export const AuthDivider: React.FC<DividerProps> = ({ label = 'OR' }) => {
  return (
    <div className="auth-divider" role="separator">
      <div className="auth-divider-line" />
      {label && <span className="auth-divider-label">{label}</span>}
      <div className="auth-divider-line" />
    </div>
  )
}
