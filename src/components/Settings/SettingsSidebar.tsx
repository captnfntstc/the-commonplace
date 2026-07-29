import React from 'react'
import {
  User,
  Sliders,
  Moon,
  Bell,
  Link as LinkIcon,
  Shield,
  Lock,
  Database,
  Download,
  Trash2,
} from 'lucide-react'

export type SettingsNavTab =
  | 'profile'
  | 'general'
  | 'appearance'
  | 'notifications'
  | 'linked'
  | 'privacy'
  | 'security'
  | 'storage'
  | 'export'
  | 'delete'

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
    title: 'GENERAL',
    items: [
      { id: 'profile', label: 'Profile', Icon: User },
      { id: 'general', label: 'General', Icon: Sliders },
      { id: 'appearance', label: 'Appearance', Icon: Moon },
      { id: 'notifications', label: 'Notifications', Icon: Bell },
    ],
  },
  {
    title: 'ACCOUNT',
    items: [
      { id: 'linked', label: 'Linked Accounts', Icon: LinkIcon },
      { id: 'privacy', label: 'Privacy', Icon: Shield },
      { id: 'security', label: 'Security', Icon: Lock },
      { id: 'storage', label: 'Data & Storage', Icon: Database },
    ],
  },
  {
    title: 'ADVANCED',
    items: [
      { id: 'export', label: 'Export Data', Icon: Download },
      { id: 'delete', label: 'Delete Account', Icon: Trash2, isDanger: true },
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
