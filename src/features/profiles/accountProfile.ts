import type { UserProfileState } from '../../types/userProfile'

export interface AuthProfileSource {
  uid: string
  displayName?: string | null
  email?: string | null
  photoURL?: string | null
  metadata?: {
    creationTime?: string
  }
}

export const PENDING_SIGNUP_PROFILE_KEY = 'the-commonplace.pending-signup-profile'

export interface PendingSignupProfile {
  email: string
  displayName: string
  handle: string
  birthday: string
}

export function pendingSignupProfileForUser(
  user: AuthProfileSource,
  rawValue: string | null,
): PendingSignupProfile | null {
  try {
    const pending = JSON.parse(rawValue || '{}') as Partial<PendingSignupProfile>
    if (!pending.email || pending.email.trim().toLowerCase() !== user.email?.trim().toLowerCase()) return null
    const handle = pending.handle?.trim().replace(/^@/, '').toLowerCase() || ''
    if (!/^[a-z0-9_]{3,20}$/.test(handle)) return null
    return {
      email: pending.email.trim().toLowerCase(),
      displayName: pending.displayName?.trim() || '',
      handle,
      birthday: pending.birthday?.trim() || '',
    }
  } catch {
    return null
  }
}

const LEGACY_DEMO_BIO = 'Collector of timeless passages, album impressions, cinematic notes, and personal reflections in one quiet place.'
const LEGACY_DEMO_COVER_ID = 'photo-1457369804613-52c61a468e7d'

export function isLegacyDemoProfile(profile: UserProfileState) {
  return profile.firstName === 'Jimmy'
    && profile.lastName === 'Boy'
    && (
      profile.handle.replace(/^@/, '').toLowerCase() === 'jimboii'
      || profile.email.toLowerCase() === 'jimboii@commonplace.app'
      || profile.bio === LEGACY_DEMO_BIO
      || profile.coverUrl.includes(LEGACY_DEMO_COVER_ID)
      || profile.lastUsernameChangeDate === '2026-07-01T00:00:00.000Z'
    )
}

export function profileBelongsToAuthUser(profile: UserProfileState, user: AuthProfileSource) {
  const profileEmail = profile.email.trim().toLowerCase()
  const accountEmail = user.email?.trim().toLowerCase() || ''
  return Boolean(profileEmail && accountEmail && profileEmail === accountEmail)
}

export function shouldResetLegacyDemoProfile(
  profile: UserProfileState,
  user: AuthProfileSource,
) {
  return isLegacyDemoProfile(profile) && !profileBelongsToAuthUser(profile, user)
}

function accountHandle(user: AuthProfileSource, displayName: string) {
  const emailSeed = user.email?.split('@')[0] || ''
  const base = (emailSeed || displayName || 'reader')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'reader'
  const suffix = user.uid.toLowerCase().replace(/[^a-z0-9]/g, '').slice(-6) || 'account'
  const baseLength = Math.max(3, 20 - suffix.length - 1)
  return `${base.slice(0, baseLength)}_${suffix}`.slice(0, 20)
}

export function profileFromAuthUser(
  user: AuthProfileSource,
  preferredDisplayName?: string,
  preferredHandle?: string,
  birthday?: string,
): UserProfileState {
  const emailName = (user.email?.split('@')[0] || 'Reader').replace(/[._-]+/g, ' ').trim()
  const displayName = preferredDisplayName?.trim() || user.displayName?.trim() || emailName || 'Reader'
  const [firstName = 'Reader', ...remainingName] = displayName.split(/\s+/)
  const lastName = remainingName.join(' ')
  const requestedHandle = preferredHandle?.trim().replace(/^@/, '').toLowerCase() || ''

  return {
    firstName,
    lastName,
    showFullName: Boolean(lastName),
    handle: /^[a-z0-9_]{3,20}$/.test(requestedHandle)
      ? requestedHandle
      : accountHandle(user, displayName),
    email: user.email?.trim().toLowerCase() || '',
    bio: '',
    avatarUrl: user.photoURL || '',
    coverUrl: '',
    createdAt: user.metadata?.creationTime || new Date().toISOString(),
    birthday: birthday || undefined,
    showFollowLists: true,
    allowComments: true,
    showSavedActivity: false,
  }
}
