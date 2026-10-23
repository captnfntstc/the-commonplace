import { describe, it, expect, beforeEach } from 'vitest'
import {
  cleanHandle,
  isTcpAdmin,
  loadDevSettings,
  saveDevSettings,
  DEFAULT_DEV_SETTINGS,
  DEV_SETTINGS_STORAGE_KEY,
  TCP_ADMIN_HANDLE,
  type DevSettings,
} from './devSettings'

describe('Developer Tools settings & authorization', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('isTcpAdmin handle check', () => {
    it('matches exact tcpadmin and constant', () => {
      expect(TCP_ADMIN_HANDLE).toBe('tcpadmin')
      expect(isTcpAdmin('tcpadmin')).toBe(true)
    })

    it('matches @tcpadmin with leading @ symbol', () => {
      expect(isTcpAdmin('@tcpadmin')).toBe(true)
      expect(isTcpAdmin('@TCPadmin')).toBe(true)
      expect(isTcpAdmin('  @TcpAdmin  ')).toBe(true)
    })

    it('rejects regular users and variations', () => {
      expect(isTcpAdmin('johndoe')).toBe(false)
      expect(isTcpAdmin('@johndoe')).toBe(false)
      expect(isTcpAdmin('admin')).toBe(false)
      expect(isTcpAdmin('tcpadmin1')).toBe(false)
      expect(isTcpAdmin('')).toBe(false)
      expect(isTcpAdmin(null)).toBe(false)
      expect(isTcpAdmin(undefined)).toBe(false)
    })
  })

  describe('cleanHandle helper', () => {
    it('strips @ symbol, trims and lowercases', () => {
      expect(cleanHandle('@TcpAdmin')).toBe('tcpadmin')
      expect(cleanHandle('  @User_123  ')).toBe('user_123')
      expect(cleanHandle(null)).toBe('')
    })
  })

  describe('loadDevSettings & saveDevSettings', () => {
    it('returns default settings when storage is empty', () => {
      const settings = loadDevSettings()
      expect(settings).toEqual(DEFAULT_DEV_SETTINGS)
      expect(settings.collectionLayout).toBe('classic')
      expect(settings.alternativeViewMode).toBe('catalog')
      expect(settings.showAnalyticsSidebar).toBe(true)
      expect(settings.showCoverOnGradient).toBe(true)
    })

    it('saves and loads alternative collection settings seamlessly', () => {
      const updatedHollis: DevSettings = {
        collectionLayout: 'hollis',
        alternativeViewMode: 'catalog',
        showAnalyticsSidebar: true,
        showCoverOnGradient: true,
      }
      saveDevSettings(updatedHollis)
      expect(loadDevSettings()).toEqual(updatedHollis)

      const updatedUniversal: DevSettings = {
        collectionLayout: 'universal',
        alternativeViewMode: 'table',
        showAnalyticsSidebar: false,
        showCoverOnGradient: false,
      }
      saveDevSettings(updatedUniversal)
      expect(loadDevSettings()).toEqual(updatedUniversal)
    })

    it('migrates legacy alternative key to hollis', () => {
      localStorage.setItem(DEV_SETTINGS_STORAGE_KEY, JSON.stringify({ collectionLayout: 'alternative' }))
      expect(loadDevSettings().collectionLayout).toBe('hollis')
    })

    it('handles malformed localStorage safely', () => {
      localStorage.setItem(DEV_SETTINGS_STORAGE_KEY, '{invalid json}')
      const settings = loadDevSettings()
      expect(settings).toEqual(DEFAULT_DEV_SETTINGS)
    })
  })
})
