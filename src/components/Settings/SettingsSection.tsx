import React from 'react'

interface SettingsSectionProps {
  title: string
  description?: string
  icon?: React.ElementType
  badge?: React.ReactNode
  children: React.ReactNode
  isDanger?: boolean
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  description,
  icon: Icon,
  badge,
  children,
  isDanger,
}) => {
  return (
    <section className={`settings-section ${isDanger ? 'danger-section' : ''}`}>
      <div className="settings-section-header">
        <div className="settings-section-title-row">
          {Icon && (
            <div className={`settings-section-icon-badge ${isDanger ? 'danger' : ''}`}>
              <Icon aria-hidden="true" />
            </div>
          )}
          <h3 className={`settings-section-title ${isDanger ? 'danger' : ''}`}>{title}</h3>
          {badge && <div className="settings-section-badge">{badge}</div>}
        </div>
        {description && <p className="settings-section-desc">{description}</p>}
      </div>
      <div className="settings-section-content">{children}</div>
    </section>
  )
}
