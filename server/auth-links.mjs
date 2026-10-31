import { randomBytes, randomInt } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import nodemailer from 'nodemailer'
import { bearerToken, getSupabaseAdmin, readJsonBody } from './supabase-admin.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LOGO_PNG_PATH = path.resolve(__dirname, '../public/TheCommonplaceRedesign.png')

const LINK_LIFETIME_MS = 24 * 60 * 60 * 1000
const PASSWORD_RESET_LIFETIME_MS = 60 * 60 * 1000
const RESEND_COOLDOWN_MS = 60 * 1000
const DEACTIVATION_REASONS = new Set([
  'taking_a_break',
  'privacy_or_safety',
  'too_distracting',
  'technical_issues',
  'not_finding_value',
  'other',
])
const REACTIVATION_DELAYS_MS = {
  tomorrow: 24 * 60 * 60 * 1000,
  seven_days: 7 * 24 * 60 * 60 * 1000,
  thirty_days: 30 * 24 * 60 * 60 * 1000,
  in_my_own_time: null,
}

// In-memory token & cooldown registries (synchronized & self-expiring)
const verificationTokens = new Map()
const passwordResetTokens = new Map()
const emailCooldowns = new Map()
const passwordResetCooldowns = new Map()

let mailTransport

function requireValue(value, name) {
  if (!value) {
    const error = new Error(`${name} is not configured.`)
    error.statusCode = 503
    throw error
  }
  return value
}

function getMailTransport(env) {
  if (!mailTransport) {
    const port = Number(env.SMTP_PORT || 465)
    mailTransport = nodemailer.createTransport({
      host: requireValue(env.SMTP_HOST || 'smtp.gmail.com', 'SMTP_HOST'),
      port,
      secure: env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : port === 465,
      auth: {
        user: requireValue(env.SMTP_USER, 'SMTP_USER'),
        pass: requireValue(env.SMTP_PASS, 'SMTP_PASS'),
      },
    })
  }
  return mailTransport
}

function cleanAppBaseUrl(env = process.env, request) {
  const requestHost = request?.headers?.['x-forwarded-host'] || request?.headers?.host
  const requestProto = request?.headers?.['x-forwarded-proto'] || (requestHost?.includes('localhost') ? 'http' : 'https')
  const detectedUrl = requestHost ? `${requestProto}://${requestHost}` : null
  const raw = env.APP_BASE_URL || env.RENDER_EXTERNAL_URL || detectedUrl
  if (!raw) {
    const error = new Error('APP_BASE_URL is not configured.')
    error.statusCode = 503
    throw error
  }
  const parsed = new URL(raw)
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('APP_BASE_URL must be an HTTP(S) URL.')
  return parsed.origin
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function renderBrandLogo({ logoUrl = 'cid:commonplace-logo', width = 320 } = {}) {
  const safeLogoUrl = escapeHtml(logoUrl)
  return `<img src="${safeLogoUrl}" width="${width}" height="34" alt="The Commonplace." style="display:block;margin:0 auto;width:${width}px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;font-family:'Quicksand','DM Sans',sans-serif;font-size:24px;font-weight:700;color:#09090b;letter-spacing:-0.5px;" />`
}

function getMailAttachments(logoUrl) {
  if (logoUrl && logoUrl.startsWith('cid:')) {
    const cidName = logoUrl.slice(4)
    if (fs.existsSync(LOGO_PNG_PATH)) {
      return [
        {
          filename: 'TheCommonplaceRedesign.png',
          path: LOGO_PNG_PATH,
          cid: cidName,
        },
      ]
    }
  }
  return []
}

function renderVerificationEmail({ email, verificationUrl, logoUrl = 'cid:commonplace-logo' }) {
  const safeEmail = escapeHtml(email)
  const safeVerificationUrl = escapeHtml(verificationUrl)
  const logoHtml = renderBrandLogo({ logoUrl, width: 310 })

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400..700;1,9..40,400..700&family=Quicksand:wght@500;600;700&display=swap" rel="stylesheet">
    <title>Verify your email</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f4f5;color:#09090b;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      One last step: verify your email to enter The Commonplace.
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#f4f4f5;">
      <tr>
        <td align="center" style="padding:48px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;">
            <tr>
              <td align="center" style="padding:0 12px 28px;">
                <div style="padding:10px 0 6px;">
                  ${logoHtml}
                </div>
              </td>
            </tr>
            <tr>
              <td style="border:1px solid #e4e4e7;border-radius:20px;background-color:#ffffff;padding:46px 46px 40px;box-shadow:0 10px 30px -10px rgba(0,0,0,0.08);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="center">
                      <div style="margin:0;color:#09090b;font-family:'Quicksand','DM Sans',sans-serif;font-weight:700;font-size:28px;line-height:36px;letter-spacing:-0.3px;">
                        Verify your email address.
                      </div>
                      <div style="margin:16px auto 0;max-width:440px;color:#52525b;font-family:'DM Sans',sans-serif;font-size:15px;line-height:24px;">
                        Finish creating your account for <strong style="color:#dc3e3e;font-weight:600;">${safeEmail}</strong>.
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:32px 0 28px;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                        <tr>
                          <td align="center" bgcolor="#dc3e3e" style="border-radius:10px;background-color:#dc3e3e;">
                            <a href="${safeVerificationUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-family:'Quicksand','DM Sans',sans-serif;font-size:15px;line-height:20px;font-weight:700;text-decoration:none;border-radius:10px;letter-spacing:0.2px;">Verify email address</a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="border-top:1px solid #f4f4f5;padding-top:24px;color:#71717a;font-family:'DM Sans',sans-serif;font-size:12px;line-height:19px;">
                      This private, one-time link expires in 24 hours.<br>
                      If you did not sign up for The Commonplace, you can safely ignore this email.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:26px 20px 0;color:#a1a1aa;font-family:'DM Sans',sans-serif;font-size:11px;line-height:18px;">
                Sent by The Commonplace &nbsp;&bull;&nbsp; A home for the things that stay with you.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function renderPasswordResetEmail({ email, resetUrl, logoUrl = 'cid:commonplace-logo' }) {
  const safeEmail = escapeHtml(email)
  const safeResetUrl = escapeHtml(resetUrl)
  const logoHtml = renderBrandLogo({ logoUrl, width: 310 })

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400..700;1,9..40,400..700&family=Quicksand:wght@500;600;700&display=swap" rel="stylesheet">
    <title>Reset your password</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f4f5;color:#09090b;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      Use this private link to reset your password for The Commonplace.
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#f4f4f5;">
      <tr>
        <td align="center" style="padding:48px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;">
            <tr>
              <td align="center" style="padding:0 12px 28px;">
                <div style="padding:10px 0 6px;">
                  ${logoHtml}
                </div>
              </td>
            </tr>
            <tr>
              <td style="border:1px solid #e4e4e7;border-radius:20px;background-color:#ffffff;padding:46px 46px 40px;box-shadow:0 10px 30px -10px rgba(0,0,0,0.08);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="center">
                      <div style="margin:0;color:#09090b;font-family:'Quicksand','DM Sans',sans-serif;font-weight:700;font-size:28px;line-height:36px;letter-spacing:-0.3px;">
                        Reset your password.
                      </div>
                      <div style="margin:16px auto 0;max-width:440px;color:#52525b;font-family:'DM Sans',sans-serif;font-size:15px;line-height:24px;">
                        We received a password reset request for <strong style="color:#dc3e3e;font-weight:600;">${safeEmail}</strong>.
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:32px 0 28px;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                        <tr>
                          <td align="center" bgcolor="#dc3e3e" style="border-radius:10px;background-color:#dc3e3e;">
                            <a href="${safeResetUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-family:'Quicksand','DM Sans',sans-serif;font-size:15px;line-height:20px;font-weight:700;text-decoration:none;border-radius:10px;letter-spacing:0.2px;">Reset my password</a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="border-top:1px solid #f4f4f5;padding-top:24px;color:#71717a;font-family:'DM Sans',sans-serif;font-size:12px;line-height:19px;">
                      This private, one-time link expires in 1 hour.<br>
                      If you did not request a password reset, you can safely ignore this email.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:26px 20px 0;color:#a1a1aa;font-family:'DM Sans',sans-serif;font-size:11px;line-height:18px;">
                Sent by The Commonplace &nbsp;&bull;&nbsp; A home for the things that stay with you.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function validActionToken(token) {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{20,64}$/.test(token)
}

function normalizeHandle(value) {
  return String(value || '').trim().replace(/^@/, '').toLowerCase()
}

function isValidHandle(handle) {
  return /^[a-z0-9_]{3,20}$/.test(handle)
}

function randomizedHandleCandidates(handle, count = 12) {
  const base = normalizeHandle(handle).replace(/[^a-z0-9_]/g, '').slice(0, 14) || 'reader'
  const candidates = new Set()
  while (candidates.size < count) {
    candidates.add(`${base}_${randomInt(100, 10000)}`.slice(0, 20))
  }
  return [...candidates]
}

async function findUserByIdentifier(identifier, supabase) {
  const normalized = String(identifier || '').trim().toLowerCase()
  if (!normalized || normalized.length > 254) return null

  if (normalized.startsWith('@') || !normalized.includes('@')) {
    const handle = normalized.replace(/^@/, '')
    if (!isValidHandle(handle)) return null
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, handle')
      .ilike('handle', handle)
      .maybeSingle()
    if (!profile?.id) return null

    const { data: userData, error } = await supabase.auth.admin.getUserById(profile.id)
    if (error || !userData?.user) return null
    return {
      uid: userData.user.id,
      email: userData.user.email,
    }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null
  // In Supabase Auth, list users matching email or generateLink
  const { data: userList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 100 })
  const matched = (userList?.users || []).find((u) => u.email?.toLowerCase() === normalized)
  if (!matched) return null
  return {
    uid: matched.id,
    email: matched.email,
  }
}

async function sendVerificationLink(request, env) {
  const idToken = bearerToken(request)
  if (!idToken) {
    const error = new Error('Authentication required.')
    error.statusCode = 401
    throw error
  }

  const supabase = getSupabaseAdmin(env)
  const { data: authData, error: authError } = await supabase.auth.getUser(idToken)
  if (authError || !authData?.user) {
    const error = new Error('Authentication required.')
    error.statusCode = 401
    throw error
  }

  const user = authData.user
  if (user.email_confirmed_at) return { alreadyVerified: true }
  const email = user.email
  if (!email) {
    const error = new Error('This account does not have an email address.')
    error.statusCode = 400
    throw error
  }

  const lastSentAt = emailCooldowns.get(user.id) || 0
  const remainingMs = RESEND_COOLDOWN_MS - (Date.now() - lastSentAt)
  if (remainingMs > 0) {
    const error = new Error(`Please wait ${Math.ceil(remainingMs / 1000)} seconds before resending.`)
    error.statusCode = 429
    error.retryAfter = Math.ceil(remainingMs / 1000)
    throw error
  }

  const token = randomBytes(16).toString('base64url')
  const expiresAt = Date.now() + LINK_LIFETIME_MS
  verificationTokens.set(token, { uid: user.id, email, expiresAt })
  emailCooldowns.set(user.id, Date.now())

  const cleanLink = `${cleanAppBaseUrl(env, request)}/v/${token}`
  const sender = env.EMAIL_FROM || `The Commonplace <${requireValue(env.SMTP_USER, 'SMTP_USER')}>`
  const logoUrl = 'cid:commonplace-logo'
  const attachments = getMailAttachments(logoUrl)
  try {
    await getMailTransport(env).sendMail({
      from: sender,
      to: email,
      subject: 'Verify your email — The Commonplace',
      text: `Your commonplace awaits.\n\nVerify ${email} to finish creating your account:\n${cleanLink}\n\nThis private, one-time link expires in 24 hours. If you did not create this account, you can safely ignore this email.`,
      html: renderVerificationEmail({ email, verificationUrl: cleanLink, logoUrl }),
      attachments,
    })
  } catch (error) {
    verificationTokens.delete(token)
    throw error
  }

  return { sent: true, retryAfter: 60 }
}

async function redeemVerificationLink(request, env) {
  const { token } = await readJsonBody(request)
  if (!validActionToken(token)) {
    const error = new Error('Invalid verification link.')
    error.statusCode = 400
    throw error
  }

  const record = verificationTokens.get(token)
  if (!record || record.expiresAt <= Date.now()) {
    const error = new Error('This verification link is invalid or expired.')
    error.statusCode = 400
    throw error
  }

  const supabase = getSupabaseAdmin(env)
  await supabase.auth.admin.updateUserById(record.uid, { email_confirm: true })
  verificationTokens.delete(token)
  return { verified: true }
}

async function findEmailByHandle(request, env) {
  const handle = new URL(request.url || '/', 'http://localhost').searchParams.get('handle') || ''
  const normalized = normalizeHandle(handle)
  if (!isValidHandle(normalized)) {
    const error = new Error('Invalid username.')
    error.statusCode = 400
    throw error
  }

  const supabase = getSupabaseAdmin(env)
  const user = await findUserByIdentifier(`@${normalized}`, supabase)
  if (!user?.email) {
    const error = new Error('Account not found.')
    error.statusCode = 404
    throw error
  }
  return { email: user.email }
}

async function checkHandleAvailability(request, env) {
  const handle = new URL(request.url || '/', 'http://localhost').searchParams.get('handle') || ''
  const normalized = normalizeHandle(handle)
  if (!isValidHandle(normalized)) {
    const error = new Error('Usernames must be 3–20 characters using only letters, numbers, or underscores.')
    error.statusCode = 400
    throw error
  }

  const supabase = getSupabaseAdmin(env)
  const { data: existing } = await supabase
    .from('profiles')
    .select('handle')
    .ilike('handle', normalized)
    .maybeSingle()

  if (!existing) return { handle: normalized, available: true, suggestions: [] }

  const candidates = randomizedHandleCandidates(normalized)
  const { data: takenProfiles } = await supabase
    .from('profiles')
    .select('handle')
    .in('handle', candidates)

  const takenSet = new Set((takenProfiles || []).map((p) => p.handle.toLowerCase()))
  const suggestions = candidates.filter((candidate) => !takenSet.has(candidate.toLowerCase())).slice(0, 3)

  return { handle: normalized, available: false, suggestions }
}

function validateDeactivationRequest(data, now = Date.now()) {
  const reason = String(data?.reason || '').trim()
  const returnPlan = String(data?.returnPlan || '').trim()
  const feedback = typeof data?.feedback === 'string' ? data.feedback.trim() : ''

  if (!DEACTIVATION_REASONS.has(reason)) {
    const error = new Error('Choose a reason for deactivating your account.')
    error.statusCode = 400
    throw error
  }
  if (!Object.hasOwn(REACTIVATION_DELAYS_MS, returnPlan)) {
    const error = new Error('Choose when you plan to return.')
    error.statusCode = 400
    throw error
  }
  const delay = REACTIVATION_DELAYS_MS[returnPlan]
  return {
    reason,
    returnPlan,
    feedback,
    safetyConcern: data?.safetyConcern === true,
    reactivatesAt: typeof delay === 'number' ? new Date(now + delay) : null,
  }
}

async function deactivateAuthenticatedAccount(request, env) {
  const idToken = bearerToken(request)
  if (!idToken) {
    const error = new Error('Authentication required.')
    error.statusCode = 401
    throw error
  }
  const requestData = validateDeactivationRequest(await readJsonBody(request))
  const supabase = getSupabaseAdmin(env)
  const { data: authData, error: authError } = await supabase.auth.getUser(idToken)
  if (authError || !authData?.user) {
    const error = new Error('Authentication required.')
    error.statusCode = 401
    throw error
  }

  const uid = authData.user.id
  await supabase
    .from('profiles')
    .update({
      account_status: 'deactivated',
      reactivates_at: requestData.reactivatesAt?.toISOString() || null,
      deactivation_reason: requestData.reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', uid)

  return {
    deactivated: true,
    reactivatesAt: requestData.reactivatesAt?.toISOString() || null,
  }
}

async function deleteAuthenticatedAccount(request, env) {
  const idToken = bearerToken(request)
  if (!idToken) {
    const error = new Error('Authentication required.')
    error.statusCode = 401
    throw error
  }

  const supabase = getSupabaseAdmin(env)
  const { data: authData, error: authError } = await supabase.auth.getUser(idToken)
  if (authError || !authData?.user) {
    const error = new Error('Authentication required.')
    error.statusCode = 401
    throw error
  }

  const uid = authData.user.id
  // Database cascades all profile, entries, and follow relations automatically on user delete
  await supabase.auth.admin.deleteUser(uid)
  return { deleted: true }
}

async function sendPasswordResetLink(request, env) {
  const { identifier } = await readJsonBody(request)
  if (typeof identifier !== 'string' || !identifier.trim() || identifier.length > 254) {
    const error = new Error('Enter a valid email or username.')
    error.statusCode = 400
    throw error
  }

  const supabase = getSupabaseAdmin(env)
  const user = await findUserByIdentifier(identifier, supabase)
  if (!user?.email) return { sent: true }

  const lastSentAt = passwordResetCooldowns.get(user.uid) || 0
  if (Date.now() - lastSentAt < RESEND_COOLDOWN_MS) return { sent: true }

  const token = randomBytes(32).toString('base64url')
  const expiresAt = Date.now() + PASSWORD_RESET_LIFETIME_MS
  passwordResetTokens.set(token, {
    uid: user.uid,
    email: user.email,
    expiresAt,
  })
  passwordResetCooldowns.set(user.uid, Date.now())

  const resetUrl = `${cleanAppBaseUrl(env, request)}/reset-password/${token}`
  const sender = env.EMAIL_FROM || `The Commonplace <${requireValue(env.SMTP_USER, 'SMTP_USER')}>`
  const logoUrl = 'cid:commonplace-logo'
  const attachments = getMailAttachments(logoUrl)
  try {
    await getMailTransport(env).sendMail({
      from: sender,
      to: user.email,
      subject: 'Reset your password — The Commonplace',
      text: `Reset your password for The Commonplace:\n${resetUrl}\n\nThis private, one-time link expires in 1 hour. If you did not request this reset, you can safely ignore this email.`,
      html: renderPasswordResetEmail({ email: user.email, resetUrl, logoUrl }),
      attachments,
    })
  } catch (error) {
    passwordResetTokens.delete(token)
    passwordResetCooldowns.delete(user.uid)
    throw error
  }

  return { sent: true }
}

async function validatePasswordResetLink(request, _env) {
  const { token } = await readJsonBody(request)
  if (!validActionToken(token)) return { valid: false }
  const record = passwordResetTokens.get(token)
  const valid = Boolean(record && record.expiresAt > Date.now())
  return { valid }
}

async function redeemPasswordResetLink(request, env) {
  const { token, newPassword } = await readJsonBody(request)
  if (!validActionToken(token)) {
    const error = new Error('This password reset link is invalid or expired.')
    error.statusCode = 400
    throw error
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
    const error = new Error('Your new password must be between 8 and 128 characters.')
    error.statusCode = 400
    throw error
  }

  const record = passwordResetTokens.get(token)
  if (!record || record.expiresAt <= Date.now()) {
    const error = new Error('This password reset link is invalid or expired.')
    error.statusCode = 400
    throw error
  }

  passwordResetTokens.delete(token)
  const supabase = getSupabaseAdmin(env)
  await supabase.auth.admin.updateUserById(record.uid, { password: newPassword })
  return { reset: true }
}

export async function handleAuthApiRequest(request, env = process.env) {
  const pathname = new URL(request.url || '/', 'http://localhost').pathname
  if (request.method === 'POST' && pathname === '/api/auth/account/deactivate') {
    return deactivateAuthenticatedAccount(request, env)
  }
  if (request.method === 'DELETE' && pathname === '/api/auth/account') {
    return deleteAuthenticatedAccount(request, env)
  }
  if (request.method === 'GET' && pathname === '/api/auth/handle-availability') {
    return checkHandleAvailability(request, env)
  }
  if (request.method === 'GET' && pathname === '/api/auth/user-by-handle') {
    return findEmailByHandle(request, env)
  }
  if (request.method === 'POST' && pathname === '/api/auth/verification-links') {
    return sendVerificationLink(request, env)
  }
  if (request.method === 'POST' && pathname === '/api/auth/verification-links/redeem') {
    return redeemVerificationLink(request, env)
  }
  if (request.method === 'POST' && pathname === '/api/auth/password-reset-links') {
    return sendPasswordResetLink(request, env)
  }
  if (request.method === 'POST' && pathname === '/api/auth/password-reset-links/validate') {
    return validatePasswordResetLink(request, env)
  }
  if (request.method === 'POST' && pathname === '/api/auth/password-reset-links/redeem') {
    return redeemPasswordResetLink(request, env)
  }
  return null
}

export const authLinkInternals = {
  cleanAppBaseUrl,
  escapeHtml,
  renderVerificationEmail,
  renderPasswordResetEmail,
  validActionToken,
  normalizeHandle,
  isValidHandle,
  randomizedHandleCandidates,
  validateDeactivationRequest,
}
