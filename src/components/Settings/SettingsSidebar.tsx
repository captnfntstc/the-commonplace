import React from 'react'
import {
  User,
  Palette,
  Bell,
  MessageSquare,
  Globe,
  Shield,
  HardDrive,
  Lock,
  Scale,
} from 'lucide-react'

export type SettingsNavTab =
  | 'profile'
  | 'theme'
  | 'notifications'
  | 'social'
  | 'language'
  | 'privacy'
  | 'data'
  | 'security'
  | 'legal'

interface SettingsSidebarProps {
  activeTab: SettingsNavTab
  onSelectTab: (tab: SettingsNavTab) => void
}

type NavGroup = {
  title: string
  items: Array<{
    id: SettingsNavTab
    label: string
    hint?: string
    Icon: React.ElementType
    isDanger?: boolean
  }>
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'PERSONAL & EXPERIENCE',
    items: [
      { id: 'profile', label: 'Profile Information', hint: 'Identity & biography', Icon: User },
      { id: 'theme', label: 'Theme & Appearance', hint: 'Look & feel', Icon: Palette },
      { id: 'notifications', label: 'Notifications', hint: 'Alerts & digests', Icon: Bell },
      { id: 'social', label: 'Social & Interactions', hint: 'Comments & community', Icon: MessageSquare },
      { id: 'language', label: 'Language & Region', hint: 'Locale & time format', Icon: Globe },
    ],
  },
  {
    title: 'ACCOUNT & PRIVACY',
    items: [
      { id: 'privacy', label: 'Privacy & Visibility', hint: 'Access & discovery', Icon: Shield },
      { id: 'data', label: 'Your Data', hint: 'Archive, export & cache', Icon: HardDrive },
      { id: 'security', label: 'Account & Security', hint: 'Credentials & sign-in', Icon: Lock },
    ],
  },
  {
    title: 'COMMUNITY & LEGAL',
    items: [
      { id: 'legal', label: 'Community Standards & Legal Policy', hint: 'Terms, privacy & conduct', Icon: Scale },
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
