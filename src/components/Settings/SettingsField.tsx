import React from 'react'

interface SettingsFieldProps {
  label: string
  helperText?: React.ReactNode
  badge?: React.ReactNode
  htmlFor?: string
  children: React.ReactNode
}

export const SettingsField: React.FC<SettingsFieldProps> = ({
  label,
  helperText,
  badge,
  htmlFor,
  children,
}) => {
  return (
    <div className="settings-field">
      <div className="settings-field-header">
        <label className="settings-field-label" htmlFor={htmlFor}>
          {label}
        </label>
        {badge && <div className="settings-field-badge">{badge}</div>}
      </div>
      <div className="settings-field-control">{children}</div>
      {helperText && <p className="settings-field-helper">{helperText}</p>}
    </div>
  )
}
