import { describe, expect, it } from 'vitest'
import {
  ageFromBirthday,
  birthdayNotificationId,
  isEligibleBirthday,
  latestEligibleBirthday,
} from './ageEligibility'

describe('account age eligibility', () => {
  const today = new Date(2026, 8, 2)

  it('requires the sixteenth birthday to have occurred', () => {
    expect(ageFromBirthday('2010-09-02', today)).toBe(16)
    expect(isEligibleBirthday('2010-09-02', today)).toBe(true)
    expect(isEligibleBirthday('2010-09-03', today)).toBe(false)
    expect(latestEligibleBirthday(today)).toBe('2010-09-02')
  })

  it('rejects invalid calendar dates', () => {
    expect(ageFromBirthday('2010-02-30', today)).toBeNull()
    expect(isEligibleBirthday('', today)).toBe(false)
  })

  it('creates one birthday greeting identity per year', () => {
    expect(birthdayNotificationId('1999-09-02', today)).toBe('birthday-2026')
    expect(birthdayNotificationId('1999-09-03', today)).toBeNull()
  })
})
