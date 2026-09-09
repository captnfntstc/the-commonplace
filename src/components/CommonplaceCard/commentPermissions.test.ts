import { describe, expect, it } from 'vitest'
import {
  hideReportedInteraction,
  isInteractionOwner,
  isReportedInteractionHidden,
} from './commentPermissions'

describe('comment ownership permissions', () => {
  it('allows deletion only when the signed-in user authored the interaction', () => {
    expect(isInteractionOwner({ authorId: 'user-a' }, 'user-a', 'reader')).toBe(true)
    expect(isInteractionOwner({ authorId: 'user-b' }, 'user-a', 'reader')).toBe(false)
  })

  it('does not treat the current post owner as the comment owner', () => {
    expect(isInteractionOwner({ authorId: 'commenter' }, 'post-owner', 'post_owner')).toBe(false)
  })

  it('uses an exact normalized handle only when no account id is available', () => {
    expect(isInteractionOwner({ authorHandle: '@Reader' }, null, 'reader')).toBe(true)
    expect(isInteractionOwner({ authorHandle: '@someone_else' }, null, 'reader')).toBe(false)
  })

  it('keeps a reported interaction hidden for that viewer', () => {
    hideReportedInteraction('viewer-a', 'post-1', 'comment', 'comment-1')

    expect(isReportedInteractionHidden('viewer-a', 'post-1', 'comment', 'comment-1')).toBe(true)
    expect(isReportedInteractionHidden('viewer-b', 'post-1', 'comment', 'comment-1')).toBe(false)
  })
})
