import React from 'react'

interface PasswordStrengthMeterProps {
  password?: string
}

export const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({ password = '' }) => {
  if (!password) return null

  // Calculate strength score (0 to 4)
  let score = 0
  if (password.length >= 8) score += 1
  if (/[0-9]/.test(password)) score += 1
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1

  // Ensure minimum score of 1 if password entered
  if (password.length > 0 && score === 0) score = 1

  const getLabel = () => {
    switch (score) {
      case 1:
        return 'Weak'
      case 2:
        return 'Fair'
      case 3:
        return 'Good'
      case 4:
        return 'Strong'
      default:
        return 'Weak'
    }
  }

  const getColor = (segmentIndex: number) => {
    if (segmentIndex >= score) return 'rgba(205, 167, 116, 0.15)'
    switch (score) {
      case 1:
        return '#e57373' // Weak - red
      case 2:
        return '#E4BC84' // Fair - warm gold
      case 3:
        return '#9fae91' // Good - sage
      case 4:
        return '#78b589' // Strong - green sage
      default:
        return '#e57373'
    }
  }

  return (
    <div className="password-strength-container" style={{ marginTop: 8 }}>
      <div className="password-strength-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: 'rgba(223, 194, 161, 0.60)', fontFamily: 'Inter, sans-serif' }}>
          Password strength
        </span>
        <span
          className="password-strength-label"
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: getColor(0),
            fontFamily: 'Inter, sans-serif',
            transition: 'color 200ms ease',
          }}
        >
          {getLabel()}
        </span>
      </div>

      {/* 4 Segment Bars */}
      <div style={{ display: 'flex', gap: 4, height: 4, width: '100%' }}>
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            style={{
              flex: 1,
              height: '100%',
              borderRadius: 2,
              backgroundColor: getColor(index),
              transition: 'background-color 200ms ease',
            }}
          />
        ))}
      </div>
    </div>
  )
}
