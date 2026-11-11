import { useEffect, useState } from 'react'

export interface DevSettings {
  developerMode: boolean
  silenceTestSimulationCount: number
}

export const TCP_ADMIN_HANDLE = 'tcpadmin'
export const DEV_SETTINGS_STORAGE_KEY = 'the-commonplace.devtools-settings'
export const DEV_SETTINGS_EVENT = 'tcp-dev-settings-changed'

export const DEFAULT_DEV_SETTINGS: DevSettings = {
  developerMode: true,
  silenceTestSimulationCount: 1,
}

export function cleanHandle(handle?: string | null): string {
  if (!handle) return ''
  return handle.trim().replace(/^@/, '').toLowerCase()
}

export function isTcpAdmin(handle?: string | null): boolean {
  if (!handle) return false
  return cleanHandle(handle) === TCP_ADMIN_HANDLE
}

export function loadDevSettings(): DevSettings {
  if (typeof window === 'undefined') return DEFAULT_DEV_SETTINGS
  try {
    const raw = localStorage.getItem(DEV_SETTINGS_STORAGE_KEY)
    if (!raw) return DEFAULT_DEV_SETTINGS
    const parsed = JSON.parse(raw) as Partial<DevSettings>
    return {
      developerMode: parsed.developerMode !== false,
      silenceTestSimulationCount: parsed.silenceTestSimulationCount || 1,
    }
  } catch {
    return DEFAULT_DEV_SETTINGS
  }
}

export function saveDevSettings(settings: DevSettings): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(DEV_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Ignore storage write errors
  }
}

export function useDevSettings() {
  const [settings, setSettings] = useState<DevSettings>(loadDevSettings)

  useEffect(() => {
    const handleSync = () => {
      setSettings(loadDevSettings())
    }

    window.addEventListener('storage', handleSync)
    window.addEventListener(DEV_SETTINGS_EVENT, handleSync)

    return () => {
      window.removeEventListener('storage', handleSync)
      window.removeEventListener(DEV_SETTINGS_EVENT, handleSync)
    }
  }, [])

  const updateSetting = <K extends keyof DevSettings>(key: K, value: DevSettings[K]) => {
    const next: DevSettings = {
      ...settings,
      [key]: value,
    }
    setSettings(next)
    saveDevSettings(next)
    window.dispatchEvent(new Event(DEV_SETTINGS_EVENT))
  }

  const resetSettings = () => {
    setSettings(DEFAULT_DEV_SETTINGS)
    saveDevSettings(DEFAULT_DEV_SETTINGS)
    window.dispatchEvent(new Event(DEV_SETTINGS_EVENT))
  }

  return {
    settings,
    updateSetting,
    resetSettings,
  }
}
