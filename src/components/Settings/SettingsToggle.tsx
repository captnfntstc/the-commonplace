import React from 'react'
import { motion } from 'framer-motion'

interface SettingsToggleProps {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  icon?: React.ElementType
  badge?: React.ReactNode
}

export const SettingsToggle: React.FC<SettingsToggleProps> = ({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  icon: Icon,
  badge,
}) => {
  return (
    <div className={`settings-toggle-row ${disabled ? 'disabled' : ''}`}>
      <div className="toggle-left">
        {Icon && (
          <div className="toggle-icon-wrap" aria-hidden="true">
            <Icon />
          </div>
        )}
        <div className="toggle-text">
          <div className="toggle-label-row">
            <span className="toggle-label">{label}</span>
            {badge && <span className="toggle-badge">{badge}</span>}
          </div>
          {description && <span className="toggle-description">{description}</span>}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-label={label}
        aria-checked={checked}
        className={`settings-toggle-switch ${checked ? 'on' : 'off'}`}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
      >
        <motion.span
          className="toggle-handle"
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </button>
    </div>
  )
}
