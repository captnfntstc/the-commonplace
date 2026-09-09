import { describe, expect, it } from 'vitest'
import {
  isLegacyDemoProfile,
  pendingSignupProfileForUser,
  profileBelongsToAuthUser,
  profileFromAuthUser,
  shouldResetLegacyDemoProfile,
} from './accountProfile'

describe('account profile initialization', () => {
  it('builds a clean profile from the registered Firebase identity', () => {
    const profile = profileFromAuthUser({
      uid: 'firebase-user-ABC123',
      displayName: 'Juan Dela Cruz',
      email: 'jpatpatrojas@gmail.com',
      photoURL: null,
    })

    expect(profile.firstName).toBe('Juan')
    expect(profile.lastName).toBe('Dela Cruz')
    expect(profile.email).toBe('jpatpatrojas@gmail.com')
    expect(profile.handle).toBe('jpatpatrojas_abc123')
    expect(profile.bio).toBe('')
    expect(profile.coverUrl).toBe('')
  })

  it('uses the Firebase Auth creation time for the member-since label', () => {
    const profile = profileFromAuthUser({
      uid: 'dated-user',
      email: 'dated@example.com',
      metadata: { creationTime: '2026-08-14T09:30:00.000Z' },
    })

    expect(profile.createdAt).toBe('2026-08-14T09:30:00.000Z')
  })

  it('recognizes the legacy Jimmy demo identity without flagging a real namesake', () => {
    expect(isLegacyDemoProfile({
      firstName: 'Jimmy',
      lastName: 'Boy',
      showFullName: true,
      handle: 'jimmy_reader',
      email: 'jimboii@commonplace.app',
      bio: 'Legacy demo',
      avatarUrl: '',
      coverUrl: '',
    })).toBe(true)

    expect(isLegacyDemoProfile({
      firstName: 'Jimmy',
      lastName: 'Boy',
      showFullName: true,
      handle: 'jimmy_reader',
      email: 'jimmy@example.com',
      bio: '',
      avatarUrl: '',
      coverUrl: '',
    })).toBe(false)
  })

  it('recognizes a partially migrated Jimmy demo profile after its email and handle changed', () => {
    expect(isLegacyDemoProfile({
      firstName: 'Jimmy',
      lastName: 'Boy',
      showFullName: true,
      handle: 'reader_abc123',
      email: 'reader@example.com',
      bio: '',
      avatarUrl: '',
      coverUrl: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=1200',
      showFollowLists: true,
      allowComments: true,
    })).toBe(true)
  })

  it('never resets demo-like profile details owned by the signed-in account', () => {
    const profile = {
      firstName: 'Jimmy',
      lastName: 'Boy',
      showFullName: true,
      handle: 'jimboii',
      email: 'jimmy@example.com',
      bio: 'Collector of timeless passages, album impressions, cinematic notes, and personal reflections in one quiet place.',
      avatarUrl: '',
      coverUrl: '',
      lastUsernameChangeDate: '2026-07-01T00:00:00.000Z',
    }

    expect(shouldResetLegacyDemoProfile(
      profile,
      { uid: 'real-jimmy', email: 'jimmy@example.com' },
    )).toBe(false)
    expect(shouldResetLegacyDemoProfile(
      profile,
      { uid: 'different-account', email: 'someone@example.com' },
    )).toBe(true)
  })

  it('only reuses browser-local profile data for the matching Firebase account', () => {
    const profile = profileFromAuthUser({
      uid: 'first-user',
      displayName: 'First Reader',
      email: 'first@example.com',
    })

    expect(profileBelongsToAuthUser(profile, { uid: 'first-user', email: 'first@example.com' })).toBe(true)
    expect(profileBelongsToAuthUser(profile, { uid: 'second-user', email: 'second@example.com' })).toBe(false)
  })

  it('prefers the registration name while Firebase profile propagation is still catching up', () => {
    const profile = profileFromAuthUser({
      uid: 'new-user-987654',
      displayName: null,
      email: 'reader@example.com',
    }, 'Maria Santos')

    expect(profile.firstName).toBe('Maria')
    expect(profile.lastName).toBe('Santos')
  })

  it('uses the verified username selected during registration', () => {
    const profile = profileFromAuthUser({
      uid: 'new-user-987654',
      displayName: 'Maria Santos',
      email: 'reader@example.com',
    }, undefined, 'maria_reads')

    expect(profile.handle).toBe('maria_reads')
  })

  it('keeps a valid pending registration username tied to its Firebase account', () => {
    expect(pendingSignupProfileForUser(
      { uid: 'new-user', email: 'patrick@example.com' },
      JSON.stringify({
        email: 'patrick@example.com',
        displayName: 'Patrick',
        handle: '@patrick_reads',
        birthday: '2000-01-01',
      }),
    )?.handle).toBe('patrick_reads')

    expect(pendingSignupProfileForUser(
      { uid: 'other-user', email: 'other@example.com' },
      JSON.stringify({ email: 'patrick@example.com', handle: 'patrick_reads' }),
    )).toBeNull()
  })
})
