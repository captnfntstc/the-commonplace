import React from 'react'
import { motion } from 'framer-motion'

interface SettingsToggleProps {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

export const SettingsToggle: React.FC<SettingsToggleProps> = ({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}) => {
  return (
    <div className={`settings-toggle-row ${disabled ? 'disabled' : ''}`}>
      <div className="toggle-text">
        <span className="toggle-label">{label}</span>
        {description && <span className="toggle-description">{description}</span>}
      </div>
      <button
        type="button"
        role="switch"
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
