import React from 'react'

interface SettingsFieldProps {
  label: string
  helperText?: React.ReactNode
  badge?: React.ReactNode
  htmlFor?: string
  children: React.ReactNode
  icon?: React.ElementType
}

export const SettingsField: React.FC<SettingsFieldProps> = ({
  label,
  helperText,
  badge,
  htmlFor,
  children,
  icon: Icon,
}) => {
  return (
    <div className="settings-field">
      <div className="settings-field-header">
        <label className="settings-field-label" htmlFor={htmlFor}>
          {Icon && <Icon className="field-label-icon" aria-hidden="true" />}
          <span>{label}</span>
        </label>
        {badge && <div className="settings-field-badge">{badge}</div>}
      </div>
      <div className="settings-field-control">{children}</div>
      {helperText && <p className="settings-field-helper">{helperText}</p>}
    </div>
  )
}
