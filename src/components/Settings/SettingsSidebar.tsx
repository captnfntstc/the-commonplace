import React from 'react'
import {
  User,
  Sliders,
  Bell,
  Wrench,
  Shield,
  Lock,
  Database,
} from 'lucide-react'

export type SettingsNavTab =
  | 'profile'
  | 'social'
  | 'reading'
  | 'privacy'
  | 'security'
  | 'storage'
  | 'developer'
  | 'export'

interface SettingsSidebarProps {
  activeTab: SettingsNavTab
  onSelectTab: (tab: SettingsNavTab) => void
}

type NavGroup = {
  title: string
  items: Array<{
    id: SettingsNavTab
    label: string
    Icon: React.ElementType
    isDanger?: boolean
  }>
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'PERSONAL',
    items: [
      { id: 'profile', label: 'Profile Information', Icon: User },
      { id: 'social', label: 'Social & Interactions', Icon: Bell },
      { id: 'reading', label: 'Reading Preferences', Icon: Sliders },
    ],
  },
  {
    title: 'ACCOUNT & PRIVACY',
    items: [
      { id: 'privacy', label: 'Privacy & Visibility', Icon: Shield },
      { id: 'security', label: 'Account & Security', Icon: Lock },
      { id: 'storage', label: 'Data & Storage', Icon: Database },
      { id: 'developer', label: 'Developer Tools', Icon: Wrench },
    ],
  },
]

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  activeTab,
  onSelectTab,
}) => {
  return (
    <aside className="settings-sidebar" aria-label="Settings navigation">
      <div className="settings-sidebar-inner">
        {NAV_GROUPS.map((group, groupIdx) => (
          <div key={group.title} className="settings-nav-group">
            <span className="settings-nav-group-title">{group.title}</span>
            <div className="settings-nav-items">
              {group.items.map(({ id, label, Icon, isDanger }) => {
                const isActive = activeTab === id
                return (
                  <button
                    key={id}
                    type="button"
                    className={`settings-sidebar-item ${isActive ? 'active' : ''} ${
                      isDanger ? 'danger' : ''
                    }`}
                    onClick={() => onSelectTab(id)}
                  >
                    <Icon aria-hidden="true" className="nav-item-icon" />
                    <span>{label}</span>
                  </button>
                )
              })}
            </div>
            {groupIdx < NAV_GROUPS.length - 1 && <div className="settings-nav-divider" />}
          </div>
        ))}
      </div>
    </aside>
  )
}
