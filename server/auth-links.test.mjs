import assert from 'node:assert/strict'
import test from 'node:test'
import { Readable } from 'node:stream'
import { authLinkInternals, handleAuthApiRequest } from './auth-links.mjs'

test('normalizes the configured public app URL to its origin', () => {
  assert.equal(
    authLinkInternals.cleanAppBaseUrl({ APP_BASE_URL: 'https://example.com/some/path' }),
    'https://example.com',
  )
})

test('escapes user-controlled values before placing them in verification email HTML', () => {
  assert.equal(authLinkInternals.escapeHtml('<user@example.com>'), '&lt;user@example.com&gt;')
})

test('renders an aligned branded verification email without an external logo dependency', () => {
  const html = authLinkInternals.renderVerificationEmail({
    email: '<reader@example.com>',
    verificationUrl: 'https://commonplace.example/v/token&preview=true',
  })

  assert.match(html, /The Commonplace\./)
  assert.match(html, /Read &nbsp;&bull;&nbsp; Reflect &nbsp;&bull;&nbsp; Remember/)
  assert.match(html, /align="center"/)
  assert.match(html, /max-width:600px/)
  assert.match(html, /&lt;reader@example\.com&gt;/)
  assert.match(html, /https:\/\/commonplace\.example\/v\/token&amp;preview=true/)
  assert.doesNotMatch(html, /<img\b/i)
})

test('requires an authenticated Firebase session before generating a short link', async () => {
  const request = {
    method: 'POST',
    url: '/api/auth/verification-links',
    headers: {},
  }
  await assert.rejects(
    () => handleAuthApiRequest(request, {}),
    (error) => error.statusCode === 401 && error.message === 'Authentication required.',
  )
})

test('requires an authenticated Firebase session before deleting an account', async () => {
  const request = Readable.from([])
  Object.assign(request, {
    method: 'DELETE',
    url: '/api/auth/account',
    headers: {},
  })
  await assert.rejects(
    () => handleAuthApiRequest(request, {}),
    (error) => error.statusCode === 401 && error.message === 'Authentication required.',
  )
})

test('requires an authenticated Firebase session before deactivating an account', async () => {
  const request = Readable.from([JSON.stringify({
    reason: 'taking_a_break',
    returnPlan: 'seven_days',
  })])
  Object.assign(request, {
    method: 'POST',
    url: '/api/auth/account/deactivate',
    headers: {},
  })
  await assert.rejects(
    () => handleAuthApiRequest(request, {}),
    (error) => error.statusCode === 401 && error.message === 'Authentication required.',
  )
})

test('validates deactivation answers and calculates automatic reactivation', () => {
  const now = Date.parse('2026-09-01T00:00:00.000Z')
  const scheduled = authLinkInternals.validateDeactivationRequest({
    reason: 'privacy_or_safety',
    returnPlan: 'seven_days',
    safetyConcern: true,
    feedback: '  I need better blocking tools.  ',
  }, now)
  assert.equal(scheduled.reactivatesAt.toISOString(), '2026-09-08T00:00:00.000Z')
  assert.equal(scheduled.feedback, 'I need better blocking tools.')
  assert.equal(scheduled.safetyConcern, true)

  const manual = authLinkInternals.validateDeactivationRequest({
    reason: 'taking_a_break',
    returnPlan: 'in_my_own_time',
  }, now)
  assert.equal(manual.reactivatesAt, null)
})

test('renders a branded password reset email with escaped account data and a one-hour notice', () => {
  const html = authLinkInternals.renderPasswordResetEmail({
    email: '<reader@example.com>',
    resetUrl: 'https://commonplace.example/reset-password/token&preview=true',
  })

  assert.match(html, /Reset your password\./)
  assert.match(html, /Reset my password/)
  assert.match(html, /expires in 1 hour/)
  assert.match(html, /&lt;reader@example\.com&gt;/)
  assert.match(html, /token&amp;preview=true/)
  assert.doesNotMatch(html, /<img\b/i)
})

test('accepts only bounded URL-safe auth action tokens', () => {
  assert.equal(authLinkInternals.validActionToken('a'.repeat(20)), true)
  assert.equal(authLinkInternals.validActionToken('abc/unsafe-token-value'), false)
  assert.equal(authLinkInternals.validActionToken('short'), false)
  assert.equal(authLinkInternals.validActionToken('a'.repeat(65)), false)
})

test('returns an opaque invalid result for malformed reset tokens without accessing Firebase', async () => {
  const request = Readable.from([JSON.stringify({ token: 'short' })])
  Object.assign(request, {
    method: 'POST',
    url: '/api/auth/password-reset-links/validate',
    headers: {},
  })

  assert.deepEqual(await handleAuthApiRequest(request, {}), { valid: false })
})

test('normalizes and validates registration handles', () => {
  assert.equal(authLinkInternals.normalizeHandle('  @Reader_Name  '), 'reader_name')
  assert.equal(authLinkInternals.isValidHandle('reader_name'), true)
  assert.equal(authLinkInternals.isValidHandle('no spaces'), false)
  assert.equal(authLinkInternals.isValidHandle('ab'), false)
})

test('generates unique valid randomized username candidates', () => {
  const suggestions = authLinkInternals.randomizedHandleCandidates('reader_name')
  assert.equal(suggestions.length, 12)
  assert.equal(new Set(suggestions).size, suggestions.length)
  suggestions.forEach((suggestion) => {
    assert.equal(authLinkInternals.isValidHandle(suggestion), true)
    assert.match(suggestion, /^reader_name_\d{3,4}$/)
  })
})
