import { describe, it, expect, vi } from 'vitest'
import { calculateLuminance, detectImageLuminance } from './imageLuminance'

describe('imageLuminance', () => {
  it('calculates perceived luminance correctly', () => {
    // Pure black
    expect(calculateLuminance(0, 0, 0)).toBe(0)
    // Pure white
    expect(Math.round(calculateLuminance(255, 255, 255))).toBe(255)
    // Dark navy (e.g. night sky)
    expect(calculateLuminance(15, 23, 42)).toBeLessThan(50)
    // Light sky blue
    expect(calculateLuminance(186, 230, 253)).toBeGreaterThan(200)
  })

  it('safely handles empty or missing image URLs', () => {
    const callback = vi.fn()
    detectImageLuminance('', callback)
    expect(callback).not.toHaveBeenCalled()
  })
})
