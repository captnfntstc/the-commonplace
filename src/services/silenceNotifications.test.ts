import { describe, it, expect, beforeEach } from 'vitest'
import {
  isSilenceActive,
  enqueueHeldNotification,
  activateSilenceMode,
  getSilenceSettings,
  saveSilenceSettings,
  getHeldNotificationsQueue,
  saveHeldNotificationsQueue,
  clearHeldNotificationsQueue,
  DEFAULT_SILENCE_SETTINGS,
  type SilenceNotificationsSettings,
} from './silenceNotifications'
import type { AppNotification } from '../types/notification'

function makeTestNotification(id: string, text: string): AppNotification {
  return {
    id,
    type: 'follow',
    createdAt: new Date().toISOString(),
    read: false,
    actorHandle: 'testuser',
    actorName: text,
  }
}

describe('silenceNotifications', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('isSilenceActive', () => {
    it('returns false when disabled', () => {
      const settings: SilenceNotificationsSettings = {
        ...DEFAULT_SILENCE_SETTINGS,
        enabled: false,
      }
      expect(isSilenceActive(settings)).toBe(false)
    })

    it('returns true when enabled in indefinite mode', () => {
      const settings: SilenceNotificationsSettings = {
        ...DEFAULT_SILENCE_SETTINGS,
        enabled: true,
        mode: 'indefinite',
      }
      expect(isSilenceActive(settings)).toBe(true)
    })

    it('handles 1hour mode before and after expiration', () => {
      const now = new Date('2026-11-03T12:00:00Z')
      const settings = activateSilenceMode(DEFAULT_SILENCE_SETTINGS, '1hour', now)

      expect(settings.enabled).toBe(true)
      expect(settings.mode).toBe('1hour')

      // 30 minutes in: still active
      const thirtyMinsLater = new Date('2026-11-03T12:30:00Z')
      expect(isSilenceActive(settings, thirtyMinsLater)).toBe(true)

      // 61 minutes in: expired
      const pastOneHour = new Date('2026-11-03T13:01:00Z')
      expect(isSilenceActive(settings, pastOneHour)).toBe(false)
    })

    it('handles scheduled mode crossing midnight', () => {
      const settings: SilenceNotificationsSettings = {
        ...DEFAULT_SILENCE_SETTINGS,
        enabled: true,
        mode: 'schedule',
        schedule: {
          startTime: '22:00',
          endTime: '08:00',
          days: [1, 2, 3, 4, 5], // Mon-Fri
          enabled: true,
        },
      }

      // Tuesday at 23:30 (should be active)
      const tuesdayNight = new Date(2026, 10, 3, 23, 30) // Tuesday
      expect(isSilenceActive(settings, tuesdayNight)).toBe(true)

      // Tuesday at 03:00 AM (should be active)
      const tuesdayDawn = new Date(2026, 10, 3, 3, 0)
      expect(isSilenceActive(settings, tuesdayDawn)).toBe(true)

      // Tuesday at 14:00 (outside window)
      const tuesdayAfternoon = new Date(2026, 10, 3, 14, 0)
      expect(isSilenceActive(settings, tuesdayAfternoon)).toBe(false)

      // Sunday at 23:00 (day not in schedule)
      const sundayNight = new Date(2026, 10, 8, 23, 0) // Sunday
      expect(isSilenceActive(settings, sundayNight)).toBe(false)
    })
  })

  describe('enqueueHeldNotification queueing', () => {
    it('appends notifications to queue', () => {
      let queue: AppNotification[] = []
      for (let i = 1; i <= 20; i++) {
        queue = enqueueHeldNotification(queue, makeTestNotification(`notif-${i}`, `User ${i}`))
      }

      expect(queue.length).toBe(20)
      expect(queue[0].id).toBe('notif-1')
      expect(queue[19].id).toBe('notif-20')
    })

    it('caps held queue at 20 separate notifications (keeps latest 20)', () => {
      let queue: AppNotification[] = []
      for (let i = 1; i <= 25; i++) {
        queue = enqueueHeldNotification(queue, makeTestNotification(`notif-${i}`, `User ${i}`))
      }

      expect(queue.length).toBe(20)
      expect(queue[0].id).toBe('notif-6')
      expect(queue[19].id).toBe('notif-25')
    })

    it('deduplicates existing notification by id', () => {
      let queue: AppNotification[] = [makeTestNotification('notif-1', 'User 1')]
      queue = enqueueHeldNotification(queue, makeTestNotification('notif-1', 'User 1 updated'))
      expect(queue.length).toBe(1)
      expect(queue[0].actorName).toBe('User 1 updated')
    })
  })

  describe('persistence and retrieval', () => {
    it('saves and restores settings and queue', () => {
      const customSettings: SilenceNotificationsSettings = {
        ...DEFAULT_SILENCE_SETTINGS,
        enabled: true,
        mode: '1hour',
        skipConfirmationDialog: true,
      }
      saveSilenceSettings(customSettings)
      expect(getSilenceSettings()).toEqual(customSettings)

      const queue = [makeTestNotification('1', 'A'), makeTestNotification('2', 'B')]
      saveHeldNotificationsQueue(queue)
      expect(getHeldNotificationsQueue()).toHaveLength(2)

      clearHeldNotificationsQueue()
      expect(getHeldNotificationsQueue()).toHaveLength(0)
    })
  })
})
