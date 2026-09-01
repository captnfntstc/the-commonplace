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
