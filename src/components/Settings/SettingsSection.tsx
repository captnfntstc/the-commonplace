import React from 'react'

interface SettingsSectionProps {
  title: string
  description?: string
  children: React.ReactNode
  isDanger?: boolean
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  description,
  children,
  isDanger,
}) => {
  return (
    <section className={`settings-section ${isDanger ? 'danger-section' : ''}`}>
      <div className="settings-section-header">
        <h3 className={`settings-section-title ${isDanger ? 'danger' : ''}`}>{title}</h3>
        {description && <p className="settings-section-desc">{description}</p>}
      </div>
      <div className="settings-section-content">{children}</div>
    </section>
  )
}
