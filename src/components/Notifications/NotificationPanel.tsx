import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, CakeSlice, Heart, MessageSquare, Trophy, UserPlus, Users, X } from 'lucide-react'
import type { AppNotification as Notification, NotificationType } from '../../types/notification'

interface NotificationPanelProps {
  notifications: Notification[]
  onMarkAllRead: () => void
  onClearAll: () => void
  onDismiss: (ids: string | string[]) => void
  onOpenNotification?: (notification: Notification) => void
}

type NotificationStack = Notification & {
  notificationIds: string[]
  actorLabels: string[]
  actorAvatarUrls: string[]
  stackCount: number
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
  if (type === 'comment' || type === 'reply') return <MessageSquare size={14} />
  if (type === 'follow' || type === 'follow_request') return <UserPlus size={14} />
  if (type === 'friend_recommendation' || type === 'people_you_may_know') return <Users size={14} />
  if (type === 'birthday') return <CakeSlice size={14} />
  return <Bell size={14} />
}

function notifColor(type: NotificationType): string {
  if (type === 'like') return '#e57373'
  if (type === 'like_milestone') return '#f5b74c'
  if (type === 'comment' || type === 'reply') return '#7ecfc0'
  if (type === 'follow' || type === 'follow_request') return '#c9a96e'
  if (type === 'friend_recommendation' || type === 'people_you_may_know') return '#a695c8'
  if (type === 'birthday') return '#e9a8bd'
  return '#c9a96e'
}

function actorLabel(notification: Notification) {
  if (notification.actorName) return notification.actorName
  if (notification.actorHandle) return `@${notification.actorHandle.replace(/^@/, '')}`
  return 'Someone'
}

function actorSummary(labels: string[]) {
  if (labels.length === 0) return 'Someone'
  if (labels.length === 1) return labels[0]
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`
  return `${labels[0]}, ${labels[1]}, and ${labels.length - 2} more`
}

function notificationGroupKey(notification: Notification) {
  if (notification.type === 'like' || notification.type === 'comment') {
    return `${notification.type}:${notification.postId || notification.entryTitle || notification.id}`
  }
  if (notification.type === 'reply') {
    return `reply:${notification.postId || notification.entryTitle || notification.id}:${notification.parentInteractionId || notification.id}`
  }
  if (
    notification.type === 'follow'
    || notification.type === 'follow_request'
    || notification.type === 'friend_recommendation'
    || notification.type === 'people_you_may_know'
  ) return notification.type
  return `${notification.type}:${notification.id}`
}

function stackNotifications(notifications: Notification[]): NotificationStack[] {
  const ordered = [...notifications]
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
  const grouped = new Map<string, Notification[]>()

  ordered.forEach((notification) => {
    const key = notificationGroupKey(notification)
    grouped.set(key, [...(grouped.get(key) || []), notification])
  })

  return Array.from(grouped.values()).map((items) => {
    const latest = items[0]
    const actors = new Map<string, Notification>()
    items.forEach((item) => {
      const key = item.actorId || item.actorHandle || item.actorName || item.id
      if (!actors.has(key)) actors.set(key, item)
    })
    const uniqueActors = Array.from(actors.values())
    return {
      ...latest,
      read: items.every((item) => item.read),
      notificationIds: items.map(({ id }) => id),
      actorLabels: uniqueActors.map(actorLabel),
      actorAvatarUrls: uniqueActors
        .map(({ actorAvatarUrl }) => actorAvatarUrl)
        .filter((url): url is string => Boolean(url)),
      stackCount: items.length,
    }
  })
}

function notifText(notification: NotificationStack): React.ReactNode {
  const actors = actorSummary(notification.actorLabels)
  switch (notification.type) {
    case 'like':
      return <><strong>{actors}</strong> liked your entry <em>&quot;{notification.entryTitle}&quot;</em></>
    case 'like_milestone':
      return <>Your entry <em>&quot;{notification.entryTitle}&quot;</em> reached <strong>{notification.milestoneCount} likes</strong></>
    case 'comment':
      return notification.stackCount === 1
        ? <><strong>{actors}</strong> commented: <em>&quot;{notification.commentSnippet}&quot;</em></>
        : <><strong>{actors}</strong> commented on your entry <em>&quot;{notification.entryTitle}&quot;</em></>
    case 'reply':
      return notification.stackCount === 1
        ? <><strong>{actors}</strong> replied: <em>&quot;{notification.commentSnippet}&quot;</em></>
        : <><strong>{actors}</strong> replied to your comment on <em>&quot;{notification.entryTitle}&quot;</em></>
    case 'follow_request':
      return <><strong>{actors}</strong> {notification.stackCount === 1 ? 'sent you a follow request' : 'sent you follow requests'}</>
    case 'follow':
      return <><strong>{actors}</strong> started following you</>
    case 'friend_recommendation':
      return <>You may know <strong>{actors}</strong> &mdash; they share your reading taste</>
    case 'people_you_may_know':
      return <><strong>{actors}</strong> {notification.stackCount === 1 ? 'is' : 'are'} on The Commonplace &mdash; people you may know</>
    case 'birthday':
      return <>Happy birthday! May your next chapter be full of meaningful discoveries. ✦</>
    default:
      return null
  }
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  notifications,
  onMarkAllRead,
  onClearAll,
  onDismiss,
  onOpenNotification,
}) => {
  const unread = notifications.filter((notification) => !notification.read).length
  const notificationStacks = stackNotifications(notifications)

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
            {notificationStacks.map((notification) => {
              const opensPost = Boolean(
                notification.postId
                && ['like', 'like_milestone', 'comment', 'reply'].includes(notification.type),
              )
              const opensProfile = notification.type === 'follow' && Boolean(notification.actorHandle)
              const isActionable = Boolean(onOpenNotification && (opensPost || opensProfile))
              const openNotification = () => {
                if (isActionable) onOpenNotification?.(notification)
              }

              return (
                <motion.div
                  key={notification.id}
                  className={`notif-item ${notification.read ? 'read' : 'unread'} ${isActionable ? 'is-actionable' : ''}`}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 40, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
                  transition={{ duration: 0.22 }}
                  layout
                  role={isActionable ? 'button' : undefined}
                  tabIndex={isActionable ? 0 : undefined}
                  aria-label={isActionable
                    ? opensProfile
                      ? `Open profile for ${actorLabel(notification)}`
                      : `Open notification for ${notification.entryTitle || 'post'}`
                    : undefined}
                  onClick={openNotification}
                  onKeyDown={(event) => {
                    if (!isActionable || (event.key !== 'Enter' && event.key !== ' ')) return
                    event.preventDefault()
                    openNotification()
                  }}
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
                  {notification.actorAvatarUrls.length > 0 && (
                    <div className="notif-avatar-stack" aria-hidden="true">
                      {notification.actorAvatarUrls.slice(0, 3).map((url, index) => (
                        <div className="notif-avatar" key={url} style={{ zIndex: 3 - index }}>
                          <img src={url} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async" />
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="notif-body">
                    <p className="notif-text">{notifText(notification)}</p>
                    <span className="notif-time">{timeAgo(notification.createdAt)} ago</span>
                  </div>
                  <button
                    type="button"
                    className="notif-dismiss-btn"
                    onClick={(event) => {
                      event.stopPropagation()
                      onDismiss(notification.notificationIds)
                    }}
                    aria-label={notification.stackCount > 1 ? `Dismiss ${notification.stackCount} grouped notifications` : 'Dismiss'}
                  >
                    <X size={12} />
                  </button>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

type NotificationBellProps = NotificationPanelProps & {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  notifications,
  onMarkAllRead,
  onClearAll,
  onDismiss,
  onOpenNotification,
  open: controlledOpen,
  onOpenChange,
}) => {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = useCallback((nextOpen: boolean) => {
    setInternalOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }, [onOpenChange])
  const ref = useRef<HTMLDivElement>(null)
  const unread = notifications.filter((notification) => !notification.read).length
  const toggleOpen = () => {
    const nextOpen = !open
    setOpen(nextOpen)
    if (nextOpen && unread > 0) onMarkAllRead()
  }

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [setOpen])

  return (
    <div className="notif-bell-wrapper" ref={ref}>
      <button
        type="button"
        className="hdr-icon-btn notif-bell-btn"
        onClick={toggleOpen}
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
              onOpenNotification={onOpenNotification
                ? (notification) => {
                    setOpen(false)
                    onOpenNotification(notification)
                  }
                : undefined}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
