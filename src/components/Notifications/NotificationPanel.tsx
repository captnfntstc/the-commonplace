import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell,
  Heart,
  MessageSquare,
  UserPlus,
  Users,
  Trophy,
  X,
  Zap,
} from 'lucide-react'
import type { AppNotification as Notification, NotificationType } from '../../types/notification'

// ── Types ─────────────────────────────────────────────────────────────────────
interface NotificationPanelProps {
  notifications: Notification[]
  onMarkAllRead: () => void
  onClearAll: () => void
  onDismiss: (id: string) => void
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return `${Math.floor(diff)}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

function NotifIcon({ type }: { type: NotificationType }) {
  if (type === 'like') return <Heart size={14} />
  if (type === 'like_milestone') return <Trophy size={14} />
  if (type === 'comment') return <MessageSquare size={14} />
  if (type === 'follow_request') return <UserPlus size={14} />
  if (type === 'friend_recommendation' || type === 'people_you_may_know') return <Users size={14} />
  return <Bell size={14} />
}

function notifColor(type: NotificationType): string {
  if (type === 'like') return '#e57373'
  if (type === 'like_milestone') return '#f5b74c'
  if (type === 'comment') return '#7ecfc0'
  if (type === 'follow_request') return '#c9a96e'
  if (type === 'friend_recommendation' || type === 'people_you_may_know') return '#a695c8'
  return '#c9a96e'
}

function notifText(n: Notification): React.ReactNode {
  switch (n.type) {
    case 'like':
      return <><strong>{n.actorName || n.actorHandle}</strong> liked your entry <em>"{n.entryTitle}"</em></>
    case 'like_milestone':
      return <>Your entry <em>"{n.entryTitle}"</em> reached <strong>{n.milestoneCount} likes</strong></>
    case 'comment':
      return <><strong>{n.actorName || n.actorHandle}</strong> commented: <em>"{n.commentSnippet}"</em></>
    case 'follow_request':
      return <><strong>{n.actorName || n.actorHandle}</strong> sent you a follow request</>
    case 'friend_recommendation':
      return <>You may know <strong>{n.actorName || n.actorHandle}</strong> — they share your reading taste</>
    case 'people_you_may_know':
      return <><strong>{n.actorName || n.actorHandle}</strong> is on The Commonplace — people you may know</>
    default:
      return null
  }
}

// ── Panel ─────────────────────────────────────────────────────────────────────
export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  notifications,
  onMarkAllRead,
  onClearAll,
  onDismiss,
}) => {
  const unread = notifications.filter((n) => !n.read).length

  return (
    <div className="notif-panel">
      <div className="notif-panel-header">
        <span className="notif-panel-title">Notifications</span>
        <div className="notif-panel-actions">
          {unread > 0 && (
            <button type="button" className="notif-mark-all-btn" onClick={onMarkAllRead}>
              Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button type="button" className="notif-clear-all-btn" onClick={onClearAll}>
              Clear all
            </button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="notif-empty">
          <Bell size={28} opacity={0.35} />
          <p>You're all caught up!</p>
        </div>
      ) : (
        <div className="notif-list">
          <AnimatePresence initial={false}>
            {notifications.map((n) => (
              <motion.div
                key={n.id}
                className={`notif-item ${n.read ? 'read' : 'unread'}`}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 40, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
                transition={{ duration: 0.22 }}
                layout
              >
                <div className="notif-icon-wrap" style={{ color: notifColor(n.type), background: `${notifColor(n.type)}18` }}>
                  <NotifIcon type={n.type} />
                </div>
                {n.actorAvatarUrl && (
                  <div className="notif-avatar">
                    <img src={n.actorAvatarUrl} alt={n.actorName} referrerPolicy="no-referrer" />
                  </div>
                )}
                <div className="notif-body">
                  <p className="notif-text">{notifText(n)}</p>
                  <span className="notif-time">{timeAgo(n.createdAt)} ago</span>
                </div>
                <button
                  type="button"
                  className="notif-dismiss-btn"
                  onClick={() => onDismiss(n.id)}
                  aria-label="Dismiss"
                >
                  <X size={12} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

// ── Bell Trigger ─────────────────────────────────────────────────────────────
interface NotificationBellProps {
  notifications: Notification[]
  onMarkAllRead: () => void
  onClearAll: () => void
  onDismiss: (id: string) => void
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  notifications,
  onMarkAllRead,
  onClearAll,
  onDismiss,
}) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const unread = notifications.filter((n) => !n.read).length

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="notif-bell-wrapper" ref={ref}>
      <button
        type="button"
        className="hdr-icon-btn notif-bell-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell aria-hidden="true" />
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              key="badge"
              className="notif-badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 28 }}
            >
              {unread > 9 ? '9+' : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="notif-panel-wrapper"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18 }}
          >
            <NotificationPanel
              notifications={notifications}
              onMarkAllRead={onMarkAllRead}
              onClearAll={onClearAll}
              onDismiss={onDismiss}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Dev Simulator ─────────────────────────────────────────────────────────────
interface NotifSimulatorProps {
  onAddNotification: (n: Notification) => void
}

const MOCK_PEOPLE = [
  { name: 'Elena Rostova', handle: 'elena_r', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop' },
  { name: 'Marcus Vance', handle: 'marcus_v', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop' },
  { name: 'Aria Sterling', handle: 'aria_s', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop' },
  { name: 'Sofia Chen', handle: 'sofiac', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop' },
]
const MOCK_ENTRIES = ['War and Peace', 'In Rainbows', 'The Book of Disquiet', 'Rachmaninoff: Piano Concerto No. 2']
const MILESTONES = [10, 25, 50, 100, 250, 500]

function uid() { return Math.random().toString(36).slice(2) }

export const NotifSimulator: React.FC<NotifSimulatorProps> = ({ onAddNotification }) => {
  const [open, setOpen] = useState(false)

  const spawn = (type: NotificationType) => {
    const person = MOCK_PEOPLE[Math.floor(Math.random() * MOCK_PEOPLE.length)]
    const entry = MOCK_ENTRIES[Math.floor(Math.random() * MOCK_ENTRIES.length)]
    const milestone = MILESTONES[Math.floor(Math.random() * MILESTONES.length)]

    const base: Notification = {
      id: uid(),
      type,
      read: false,
      createdAt: new Date().toISOString(),
      actorName: person.name,
      actorHandle: person.handle,
      actorAvatarUrl: person.avatar,
    }

    switch (type) {
      case 'like':
        onAddNotification({ ...base, entryTitle: entry })
        break
      case 'like_milestone':
        onAddNotification({ ...base, entryTitle: entry, milestoneCount: milestone, actorAvatarUrl: undefined })
        break
      case 'comment':
        onAddNotification({ ...base, entryTitle: entry, commentSnippet: 'This entry resonates deeply with me...' })
        break
      case 'follow_request':
        onAddNotification({ ...base })
        break
      case 'friend_recommendation':
        onAddNotification({ ...base })
        break
      case 'people_you_may_know':
        onAddNotification({ ...base })
        break
    }
  }

  return (
    <div className="notif-simulator-wrapper">
      <button
        type="button"
        className="notif-simulator-toggle"
        onClick={() => setOpen((v) => !v)}
        title="Dev: Notification Simulator"
      >
        <Zap size={13} />
        <span>Dev</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="notif-simulator-panel"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
          >
            <div className="notif-sim-header">
              <Zap size={13} />
              <span>Notification Simulator</span>
            </div>
            {([
              ['like', '❤️ Like'],
              ['like_milestone', '🏆 Milestone'],
              ['comment', '💬 Comment'],
              ['follow_request', '👤 Follow Request'],
              ['friend_recommendation', '🤝 Recommendation'],
              ['people_you_may_know', '👥 People You May Know'],
            ] as [NotificationType, string][]).map(([type, label]) => (
              <button
                key={type}
                type="button"
                className="notif-sim-btn"
                onClick={() => spawn(type)}
              >
                {label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
