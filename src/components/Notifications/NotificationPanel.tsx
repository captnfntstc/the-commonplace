import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, Heart, MessageSquare, Trophy, UserPlus, Users, X } from 'lucide-react'
import type { AppNotification as Notification, NotificationType } from '../../types/notification'

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

function notifText(notification: Notification): React.ReactNode {
  switch (notification.type) {
    case 'like':
      return <><strong>{notification.actorName || notification.actorHandle}</strong> liked your entry <em>&quot;{notification.entryTitle}&quot;</em></>
    case 'like_milestone':
      return <>Your entry <em>&quot;{notification.entryTitle}&quot;</em> reached <strong>{notification.milestoneCount} likes</strong></>
    case 'comment':
      return <><strong>{notification.actorName || notification.actorHandle}</strong> commented: <em>&quot;{notification.commentSnippet}&quot;</em></>
    case 'follow_request':
      return <><strong>{notification.actorName || notification.actorHandle}</strong> sent you a follow request</>
    case 'friend_recommendation':
      return <>You may know <strong>{notification.actorName || notification.actorHandle}</strong> — they share your reading taste</>
    case 'people_you_may_know':
      return <><strong>{notification.actorName || notification.actorHandle}</strong> is on The Commonplace — people you may know</>
    default:
      return null
  }
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  notifications,
  onMarkAllRead,
  onClearAll,
  onDismiss,
}) => {
  const unread = notifications.filter((notification) => !notification.read).length

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
          <p>You&apos;re all caught up!</p>
        </div>
      ) : (
        <div className="notif-list">
          <AnimatePresence initial={false}>
            {notifications.map((notification) => (
              <motion.div
                key={notification.id}
                className={`notif-item ${notification.read ? 'read' : 'unread'}`}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 40, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
                transition={{ duration: 0.22 }}
                layout
              >
                <div
                  className="notif-icon-wrap"
                  style={{
                    color: notifColor(notification.type),
                    background: `${notifColor(notification.type)}18`,
                  }}
                >
                  <NotifIcon type={notification.type} />
                </div>
                {notification.actorAvatarUrl && (
                  <div className="notif-avatar">
                    <img
                      src={notification.actorAvatarUrl}
                      alt={notification.actorName}
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
                <div className="notif-body">
                  <p className="notif-text">{notifText(notification)}</p>
                  <span className="notif-time">{timeAgo(notification.createdAt)} ago</span>
                </div>
                <button
                  type="button"
                  className="notif-dismiss-btn"
                  onClick={() => onDismiss(notification.id)}
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

type NotificationBellProps = NotificationPanelProps

export const NotificationBell: React.FC<NotificationBellProps> = ({
  notifications,
  onMarkAllRead,
  onClearAll,
  onDismiss,
}) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const unread = notifications.filter((notification) => !notification.read).length

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="notif-bell-wrapper" ref={ref}>
      <button
        type="button"
        className="hdr-icon-btn notif-bell-btn"
        onClick={() => setOpen((value) => !value)}
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
