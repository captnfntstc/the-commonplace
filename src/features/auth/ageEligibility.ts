export const MINIMUM_ACCOUNT_AGE = 16

function parseCalendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return { year, month, day }
}

export function ageFromBirthday(birthday: string, today = new Date()) {
  const parsed = parseCalendarDate(birthday)
  if (!parsed) return null
  let age = today.getFullYear() - parsed.year
  const birthdayHasPassed = today.getMonth() + 1 > parsed.month
    || (today.getMonth() + 1 === parsed.month && today.getDate() >= parsed.day)
  if (!birthdayHasPassed) age -= 1
  return age
}

export function isEligibleBirthday(birthday: string, today = new Date()) {
  const age = ageFromBirthday(birthday, today)
  return age !== null && age >= MINIMUM_ACCOUNT_AGE
}

export function latestEligibleBirthday(today = new Date()) {
  const date = new Date(today.getFullYear() - MINIMUM_ACCOUNT_AGE, today.getMonth(), today.getDate())
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function birthdayNotificationId(birthday: string, today = new Date()) {
  const parsed = parseCalendarDate(birthday)
  if (!parsed || parsed.month !== today.getMonth() + 1 || parsed.day !== today.getDate()) return null
  return `birthday-${today.getFullYear()}`
}
