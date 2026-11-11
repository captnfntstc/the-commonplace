import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Code,
  Bell,
  BellOff,
  X,
  Play,
  RotateCcw,
  Sparkles,
  Inbox,
  Trash2,
} from 'lucide-react'
import { isTcpAdmin } from './devSettings'
import {
  getSilenceSettings,
  getHeldNotificationsQueue,
  clearHeldNotificationsQueue,
  isSilenceActive,
  type SilenceNotificationsSettings,
} from '../../services/silenceNotifications'
import type { AppNotification } from '../../types/notification'
import './DeveloperTools.css'

interface DeveloperToolsModalProps {
  isOpen: boolean
  onClose: () => void
  currentHandle?: string
}

const MOCK_AUTHORS = [
  { name: 'Taylor Swift', handle: 'taylorswift', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80' },
  { name: 'Jimboi', handle: 'jimboi', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80' },
  { name: 'Olivia Rodrigo', handle: 'oliviarodrigo', avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80' },
  { name: 'Phoebe Bridgers', handle: 'phoebe', avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&auto=format&fit=crop&q=80' },
  { name: 'Gracie Abrams', handle: 'gracie', avatarUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100&auto=format&fit=crop&q=80' },
  { name: 'Lucy Dacus', handle: 'lucydacus', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80' },
  { name: 'Pat', handle: 'patpatrojas', avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80' },
  { name: 'SZA', handle: 'sza', avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80' },
]

function getTargetEntry(): { id: string; title: string } {
  try {
    const raw = localStorage.getItem('the-commonplace.entries')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.id && parsed[0]?.title) {
        return { id: String(parsed[0].id), title: String(parsed[0].title) }
      }
    }
    const homeRaw = localStorage.getItem('the-commonplace.homepage-entries')
    if (homeRaw) {
      const parsedHome = JSON.parse(homeRaw)
      if (Array.isArray(parsedHome) && parsedHome.length > 0 && parsedHome[0]?.id && parsedHome[0]?.title) {
        return { id: String(parsedHome[0].id), title: String(parsedHome[0].title) }
      }
    }
  } catch {}
  return {
    id: 'test-entry-sad-girl',
    title: 'you seem pretty sad for a girl so in love',
  }
}

export const DeveloperToolsModal: React.FC<DeveloperToolsModalProps> = ({
  isOpen,
  onClose,
  currentHandle,
}) => {
  const [silenceSettings, setSilenceSettings] = useState<SilenceNotificationsSettings>(getSilenceSettings)
  const [heldQueueCount, setHeldQueueCount] = useState<number>(() => getHeldNotificationsQueue().length)

  useEffect(() => {
    if (!isOpen) return
    const update = () => {
      setSilenceSettings(getSilenceSettings())
      setHeldQueueCount(getHeldNotificationsQueue().length)
    }
    update()
    window.addEventListener('commonplace:silence-settings-changed', update)
    window.addEventListener('commonplace:silence-queue-changed', update)
    return () => {
      window.removeEventListener('commonplace:silence-settings-changed', update)
      window.removeEventListener('commonplace:silence-queue-changed', update)
    }
  }, [isOpen])

  if (!isOpen || !isTcpAdmin(currentHandle)) return null

  const isSilenced = isSilenceActive(silenceSettings)

  const handleSendTestNotification = (count = 1, asHeldDuringSilence = false) => {
    const target = getTargetEntry()
    const notifs: AppNotification[] = []
    const likers: Array<{ userId: string; handle: string; name: string; avatarUrl?: string; createdAt?: string }> = []

    for (let i = 0; i < count; i++) {
      const author = MOCK_AUTHORS[i % MOCK_AUTHORS.length]
      const notifId = `sim-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`
      
      if (count > 5 && i % 4 === 1) {
        // Occasional comment in large floods
        notifs.push({
          id: notifId,
          type: 'comment',
          read: false,
          createdAt: new Date(Date.now() - i * 120000).toISOString(),
          actorName: author.name,
          actorHandle: author.handle,
          actorAvatarUrl: author.avatarUrl,
          postId: target.id,
          entryTitle: target.title,
          commentSnippet: 'Incredible work and thoughtful perspective!',
          heldDuringSilence: asHeldDuringSilence,
        })
      } else if (count > 5 && i % 4 === 2) {
        // Follow request
        notifs.push({
          id: notifId,
          type: 'follow_request',
          read: false,
          createdAt: new Date(Date.now() - i * 120000).toISOString(),
          actorName: author.name,
          actorHandle: author.handle,
          actorAvatarUrl: author.avatarUrl,
          heldDuringSilence: asHeldDuringSilence,
        })
      } else {
        // Likes for the target entry
        notifs.push({
          id: notifId,
          type: 'like',
          read: false,
          createdAt: new Date(Date.now() - i * 60000).toISOString(),
          actorName: author.name,
          actorHandle: author.handle,
          actorAvatarUrl: author.avatarUrl,
          postId: target.id,
          entryTitle: target.title,
          heldDuringSilence: asHeldDuringSilence,
        })
        likers.push({
          userId: `user-${author.handle}`,
          handle: author.handle,
          name: author.name,
          avatarUrl: author.avatarUrl,
          createdAt: new Date(Date.now() - i * 60000).toISOString(),
        })
      }
    }

    // Persist mock likers for this entry so likes modal can show them
    if (likers.length > 0) {
      try {
        const key = `the-commonplace.entry-likes.${target.id}`
        const existingRaw = localStorage.getItem(key)
        const existing: typeof likers = existingRaw ? JSON.parse(existingRaw) : []
        const seen = new Set(existing.map((l) => l.handle.toLowerCase()))
        likers.forEach((l) => {
          if (!seen.has(l.handle.toLowerCase())) {
            seen.add(l.handle.toLowerCase())
            existing.unshift(l)
          }
        })
        localStorage.setItem(key, JSON.stringify(existing))
      } catch {}
    }

    window.dispatchEvent(new CustomEvent('commonplace:simulate-notification', {
      detail: notifs,
    }))
    setHeldQueueCount(getHeldNotificationsQueue().length)
  }

  const handleReleaseHeldQueue = () => {
    window.dispatchEvent(new CustomEvent('commonplace:release-held-queue'))
    setHeldQueueCount(0)
  }

  const handleClearHeldQueue = () => {
    clearHeldNotificationsQueue()
    setHeldQueueCount(0)
  }

  return (
    <AnimatePresence>
      <div className="tcp-dev-backdrop" onClick={onClose} role="presentation">
        <motion.div
          className="tcp-dev-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tcp-dev-title"
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
        >
          {/* Header */}
          <div className="tcp-dev-header">
            <div className="tcp-dev-title-row">
              <div className="tcp-dev-icon-badge">
                <Code size={18} aria-hidden="true" />
              </div>
              <div>
                <h2 id="tcp-dev-title" className="tcp-dev-title">Developer Tools</h2>
                <div className="tcp-dev-badge-row">
                  <span className="tcp-dev-admin-pill">
                    <Sparkles size={11} aria-hidden="true" />
                    <span>Dev Mode</span>
                  </span>
                  <span className="tcp-dev-mode-pill">Accessible across all pages</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="tcp-dev-close-btn"
              onClick={onClose}
              aria-label="Close Developer Tools"
              title="Close"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="tcp-dev-body">
            {/* Section: Silence & Notification Testing */}
            <div className="tcp-dev-section">
              <div className="tcp-dev-section-heading">
                <div className="tcp-dev-section-icon">
                  {isSilenced ? <BellOff size={16} /> : <Bell size={16} />}
                </div>
                <div>
                  <h3 className="tcp-dev-section-title">Silence &amp; Notification Testing</h3>
                  <p className="tcp-dev-section-desc">
                    Simulate real-time incoming alerts to verify held queue buffering and release behaviors.
                  </p>
                </div>
              </div>

              <div className="tcp-dev-status-card">
                <span>
                  Silence Status: <strong>{isSilenced ? 'Active (Silenced)' : 'Inactive'}</strong>
                </span>
                <span>
                  Held Notifications: <strong>{heldQueueCount}</strong>
                </span>
              </div>

              <div className="tcp-dev-actions-grid">
                <button
                  type="button"
                  className="tcp-dev-btn"
                  onClick={() => handleSendTestNotification(1)}
                >
                  <Play size={13} aria-hidden="true" />
                  <span>+1 Test Notification</span>
                </button>

                <button
                  type="button"
                  className="tcp-dev-btn"
                  onClick={() => handleSendTestNotification(5)}
                >
                  <Play size={13} aria-hidden="true" />
                  <span>+5 Test Notifications</span>
                </button>

                <button
                  type="button"
                  className="tcp-dev-btn"
                  onClick={() => handleSendTestNotification(20)}
                  title="Simulate 20 separate notifications (held queue limit)"
                >
                  <Play size={13} aria-hidden="true" />
                  <span>+20 Separate (Held Cap)</span>
                </button>

                <button
                  type="button"
                  className="tcp-dev-btn"
                  onClick={() => handleSendTestNotification(5, true)}
                  title="Simulate 5 notifications delivered from Silence Mode"
                >
                  <BellOff size={13} aria-hidden="true" />
                  <span>While Silenced (+5)</span>
                </button>

                <button
                  type="button"
                  className="tcp-dev-btn highlight"
                  onClick={() => handleSendTestNotification(25)}
                >
                  <Sparkles size={13} aria-hidden="true" />
                  <span>Flood 25 Notifications</span>
                </button>

                <button
                  type="button"
                  className="tcp-dev-btn release"
                  onClick={handleReleaseHeldQueue}
                  disabled={heldQueueCount === 0}
                  style={{ opacity: heldQueueCount === 0 ? 0.5 : 1 }}
                >
                  <Inbox size={13} aria-hidden="true" />
                  <span>Deliver Held Queue</span>
                </button>
              </div>

              {heldQueueCount > 0 && (
                <button
                  type="button"
                  className="tcp-dev-btn"
                  onClick={handleClearHeldQueue}
                  style={{ width: '100%', color: '#ef4444' }}
                >
                  <Trash2 size={13} aria-hidden="true" />
                  <span>Clear Held Queue</span>
                </button>
              )}
            </div>

            {/* Section: Quick Cache Utilities */}
            <div className="tcp-dev-section">
              <div className="tcp-dev-section-heading">
                <div className="tcp-dev-section-icon">
                  <RotateCcw size={16} aria-hidden="true" />
                </div>
                <div>
                  <h3 className="tcp-dev-section-title">Storage Utilities</h3>
                  <p className="tcp-dev-section-desc">
                    Reset local caches and test session flags.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="tcp-dev-btn"
                onClick={() => {
                  clearHeldNotificationsQueue()
                  setHeldQueueCount(0)
                }}
              >
                <RotateCcw size={13} aria-hidden="true" />
                <span>Reset Silence Queue Storage</span>
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="tcp-dev-footer">
            <span className="tcp-dev-footer-note">
              Changes apply instantly and persist across sessions.
            </span>
            <button
              type="button"
              className="tcp-dev-done-btn"
              onClick={onClose}
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

export default DeveloperToolsModal
