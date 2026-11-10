import type { AppNotification } from '../types/notification'

export type SilenceDurationMode = 'indefinite' | '1hour' | 'schedule'

export interface SilenceSchedule {
  startTime: string // "22:00"
  endTime: string   // "08:00"
  days: number[]    // [0, 1, 2, 3, 4, 5, 6] (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  enabled: boolean
}

export interface SilenceNotificationsSettings {
  enabled: boolean
  mode: SilenceDurationMode
  activatedAt?: string
  oneHourExpiresAt?: string
  schedule: SilenceSchedule
  skipConfirmationDialog: boolean
}

export const SILENCE_QUEUE_MAX = 20

export const DEFAULT_SILENCE_SETTINGS: SilenceNotificationsSettings = {
  enabled: false,
  mode: 'indefinite',
  schedule: {
    startTime: '22:00',
    endTime: '08:00',
    days: [0, 1, 2, 3, 4, 5, 6],
    enabled: true,
  },
  skipConfirmationDialog: false,
}

export const SILENCE_SETTINGS_KEY = 'the-commonplace.silence-notifications-settings'
export const SILENCE_QUEUE_KEY = 'the-commonplace.silence-notifications-held-queue'
export const SILENCE_DELIVERED_KEY = 'the-commonplace.silence-delivered-notification-ids'

export function getDeliveredSilenceNotificationIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SILENCE_DELIVERED_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
}

export function saveDeliveredSilenceNotificationIds(ids: Set<string> | string[]): void {
  try {
    const arr = Array.from(ids)
    localStorage.setItem(SILENCE_DELIVERED_KEY, JSON.stringify(arr))
  } catch {}
}

export function addDeliveredSilenceNotificationIds(ids: string[]): void {
  try {
    const current = getDeliveredSilenceNotificationIds()
    ids.forEach((id) => current.add(id))
    saveDeliveredSilenceNotificationIds(current)
  } catch {}
}

export function removeDeliveredSilenceNotificationIds(ids: string[]): void {
  try {
    const current = getDeliveredSilenceNotificationIds()
    ids.forEach((id) => current.delete(id))
    saveDeliveredSilenceNotificationIds(current)
  } catch {}
}

export function clearDeliveredSilenceNotificationIds(): void {
  try {
    localStorage.removeItem(SILENCE_DELIVERED_KEY)
  } catch {}
}

export function getSilenceSettings(): SilenceNotificationsSettings {
  try {
    const raw = localStorage.getItem(SILENCE_SETTINGS_KEY)
    if (!raw) return DEFAULT_SILENCE_SETTINGS
    const parsed = JSON.parse(raw)
    return {
      ...DEFAULT_SILENCE_SETTINGS,
      ...parsed,
      schedule: {
        ...DEFAULT_SILENCE_SETTINGS.schedule,
        ...(parsed?.schedule || {}),
      },
    }
  } catch {
    return DEFAULT_SILENCE_SETTINGS
  }
}

export function saveSilenceSettings(settings: SilenceNotificationsSettings): void {
  try {
    localStorage.setItem(SILENCE_SETTINGS_KEY, JSON.stringify(settings))
  } catch (err) {
    console.error('Error saving silence notifications settings:', err)
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('commonplace:silence-settings-changed', { detail: settings }))
  }
}

export function getHeldNotificationsQueue(): AppNotification[] {
  try {
    const raw = localStorage.getItem(SILENCE_QUEUE_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export function saveHeldNotificationsQueue(queue: AppNotification[]): void {
  try {
    localStorage.setItem(SILENCE_QUEUE_KEY, JSON.stringify(queue))
  } catch (err) {
    console.error('Error saving held notifications queue:', err)
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('commonplace:silence-queue-changed', { detail: queue }))
  }
}

export function clearHeldNotificationsQueue(): void {
  try {
    localStorage.removeItem(SILENCE_QUEUE_KEY)
  } catch (err) {
    console.error('Error clearing held notifications queue:', err)
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('commonplace:silence-queue-changed', { detail: [] }))
  }
}

export function isSilenceActive(settings: SilenceNotificationsSettings, now = new Date()): boolean {
  if (!settings.enabled) return false

  if (settings.mode === 'indefinite') {
    return true
  }

  if (settings.mode === '1hour') {
    if (!settings.oneHourExpiresAt) return true
    const expiresAt = new Date(settings.oneHourExpiresAt).getTime()
    return now.getTime() < expiresAt
  }

  if (settings.mode === 'schedule') {
    if (!settings.schedule.enabled) return false
    const currentDay = now.getDay()
    if (!settings.schedule.days.includes(currentDay)) return false

    const [startH, startM] = (settings.schedule.startTime || '22:00').split(':').map(Number)
    const [endH, endM] = (settings.schedule.endTime || '08:00').split(':').map(Number)

    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const startMinutes = (startH || 0) * 60 + (startM || 0)
    const endMinutes = (endH || 0) * 60 + (endM || 0)

    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes
    } else {
      // Midnight crossing, e.g. 22:00 (1320m) to 08:00 (480m)
      return currentMinutes >= startMinutes || currentMinutes < endMinutes
    }
  }

  return false
}

/**
 * Enqueue notification into held queue.
 * Appends new notification and deduplicates by ID.
 * Capped at SILENCE_QUEUE_MAX (20) separate notifications.
 */
export function enqueueHeldNotification(queue: AppNotification[], newNotif: AppNotification): AppNotification[] {
  const tagged: AppNotification = { ...newNotif, heldDuringSilence: true }
  const filtered = queue.filter((item) => item.id !== newNotif.id)
  const nextQueue = [...filtered, tagged]
  if (nextQueue.length > SILENCE_QUEUE_MAX) {
    return nextQueue.slice(-SILENCE_QUEUE_MAX)
  }
  return nextQueue
}

/**
 * Helper to activate silence mode with chosen options
 */
export function activateSilenceMode(
  currentSettings: SilenceNotificationsSettings,
  mode: SilenceDurationMode,
  now = new Date()
): SilenceNotificationsSettings {
  const next: SilenceNotificationsSettings = {
    ...currentSettings,
    enabled: true,
    mode,
    activatedAt: now.toISOString(),
  }

  if (mode === '1hour') {
    const expires = new Date(now.getTime() + 60 * 60 * 1000)
    next.oneHourExpiresAt = expires.toISOString()
  } else {
    next.oneHourExpiresAt = undefined
  }

  return next
}
