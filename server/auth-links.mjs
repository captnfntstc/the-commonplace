import { randomBytes, randomInt } from 'node:crypto'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import nodemailer from 'nodemailer'
import { bearerToken, getAdminServices, readJsonBody } from './firebase-admin.mjs'

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

function cleanAppBaseUrl(env) {
  const raw = requireValue(env.APP_BASE_URL, 'APP_BASE_URL')
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

function renderVerificationEmail({ email, verificationUrl }) {
  const safeEmail = escapeHtml(email)
  const safeVerificationUrl = escapeHtml(verificationUrl)

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="dark">
    <meta name="supported-color-schemes" content="dark">
    <title>Verify your email</title>
  </head>
  <body style="margin:0;padding:0;background-color:#090806;color:#e7d6c2;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      One last step: verify your email to enter The Commonplace.
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#090806;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;">
            <tr>
              <td align="center" style="padding:0 12px 28px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                  <tr>
                    <td style="width:52px;border-top:1px solid #6f5237;font-size:1px;line-height:1px;">&nbsp;</td>
                    <td style="padding:0 12px;color:#c99668;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:15px;">&#10022;</td>
                    <td style="width:52px;border-top:1px solid #6f5237;font-size:1px;line-height:1px;">&nbsp;</td>
                  </tr>
                </table>
                <div style="padding-top:13px;color:#d5a275;font-family:Georgia,'Times New Roman',serif;font-size:32px;line-height:38px;letter-spacing:-0.5px;">
                  The Commonplace.
                </div>
                <div style="padding-top:6px;color:#8f755d;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:14px;letter-spacing:2.8px;text-transform:uppercase;">
                  Read &nbsp;&bull;&nbsp; Reflect &nbsp;&bull;&nbsp; Remember
                </div>
              </td>
            </tr>
            <tr>
              <td style="border:1px solid #3a2b1d;border-radius:16px;background-color:#14110d;padding:44px 46px 38px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="center">
                      <div style="margin:0;color:#f0e1cf;font-family:Georgia,'Times New Roman',serif;font-size:27px;line-height:34px;">
                        Your commonplace awaits.
                      </div>
                      <div style="margin:18px auto 0;max-width:440px;color:#b9a088;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;">
                        Verify <strong style="color:#d9bea4;font-weight:600;">${safeEmail}</strong> to finish creating your account and begin collecting the things worth remembering.
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:30px 0 28px;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                        <tr>
                          <td align="center" bgcolor="#d2a16f" style="border-radius:10px;">
                            <a href="${safeVerificationUrl}" style="display:inline-block;padding:14px 28px;color:#160f09;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;font-weight:700;text-decoration:none;">Verify my email</a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="border-top:1px solid #302419;padding-top:24px;color:#917963;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;">
                      This private, one-time link expires in 24 hours.<br>
                      If you did not create this account, you can safely ignore this email.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 20px 0;color:#6f5c4b;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:18px;">
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

function renderPasswordResetEmail({ email, resetUrl }) {
  const safeEmail = escapeHtml(email)
  const safeResetUrl = escapeHtml(resetUrl)

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="dark">
    <meta name="supported-color-schemes" content="dark">
    <title>Reset your password</title>
  </head>
  <body style="margin:0;padding:0;background-color:#090806;color:#e7d6c2;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      Use this private link to reset your password for The Commonplace.
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#090806;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;">
            <tr>
              <td align="center" style="padding:0 12px 28px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                  <tr>
                    <td style="width:52px;border-top:1px solid #6f5237;font-size:1px;line-height:1px;">&nbsp;</td>
                    <td style="padding:0 12px;color:#c99668;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:15px;">&#10022;</td>
                    <td style="width:52px;border-top:1px solid #6f5237;font-size:1px;line-height:1px;">&nbsp;</td>
                  </tr>
                </table>
                <div style="padding-top:13px;color:#d5a275;font-family:Georgia,'Times New Roman',serif;font-size:32px;line-height:38px;letter-spacing:-0.5px;">
                  The Commonplace.
                </div>
                <div style="padding-top:6px;color:#8f755d;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:14px;letter-spacing:2.8px;text-transform:uppercase;">
                  Read &nbsp;&bull;&nbsp; Reflect &nbsp;&bull;&nbsp; Remember
                </div>
              </td>
            </tr>
            <tr>
              <td style="border:1px solid #3a2b1d;border-radius:16px;background-color:#14110d;padding:44px 46px 38px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="center">
                      <div style="margin:0;color:#f0e1cf;font-family:Georgia,'Times New Roman',serif;font-size:27px;line-height:34px;">
                        Reset your password.
                      </div>
                      <div style="margin:18px auto 0;max-width:440px;color:#b9a088;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;">
                        We received a password reset request for <strong style="color:#d9bea4;font-weight:600;">${safeEmail}</strong>.
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:30px 0 28px;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                        <tr>
                          <td align="center" bgcolor="#d2a16f" style="border-radius:10px;">
                            <a href="${safeResetUrl}" style="display:inline-block;padding:14px 28px;color:#160f09;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;font-weight:700;text-decoration:none;">Reset my password</a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="border-top:1px solid #302419;padding-top:24px;color:#917963;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;">
                      This private, one-time link expires in 1 hour.<br>
                      If you did not request a password reset, you can safely ignore this email.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 20px 0;color:#6f5c4b;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:18px;">
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

function isUserNotFound(error) {
  return error?.code === 'auth/user-not-found' || /no user record/i.test(String(error?.message || ''))
}

async function findUserByIdentifier(identifier, { adminAuth, adminDb }) {
  const normalized = String(identifier || '').trim().toLowerCase()
  if (!normalized || normalized.length > 254) return null

  if (normalized.startsWith('@') || !normalized.includes('@')) {
    const handle = normalized.replace(/^@/, '')
    if (!/^[a-z0-9_]{3,20}$/.test(handle)) return null
    const handleSnapshot = await adminDb.collection('handles').doc(handle).get()
    const uid = String(handleSnapshot.data()?.uid || '')
    if (!handleSnapshot.exists || !uid) return null
    try {
      return await adminAuth.getUser(uid)
    } catch (error) {
      if (isUserNotFound(error)) return null
      throw error
    }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null
  try {
    return await adminAuth.getUserByEmail(normalized)
  } catch (error) {
    if (isUserNotFound(error)) return null
    throw error
  }
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

async function sendVerificationLink(request, env) {
  const idToken = bearerToken(request)
  if (!idToken) {
    const error = new Error('Authentication required.')
    error.statusCode = 401
    throw error
  }

  const { adminAuth, adminDb } = getAdminServices(env)
  const decoded = await adminAuth.verifyIdToken(idToken)
  if (decoded.email_verified) return { alreadyVerified: true }
  const email = decoded.email
  if (!email) {
    const error = new Error('This account does not have an email address.')
    error.statusCode = 400
    throw error
  }

  const cooldownRef = adminDb.collection('authEmailCooldowns').doc(decoded.uid)
  const cooldownSnapshot = await cooldownRef.get()
  const lastSentAt = cooldownSnapshot.data()?.lastSentAt?.toMillis?.() || 0
  const remainingMs = RESEND_COOLDOWN_MS - (Date.now() - lastSentAt)
  if (remainingMs > 0) {
    const error = new Error(`Please wait ${Math.ceil(remainingMs / 1000)} seconds before resending.`)
    error.statusCode = 429
    error.retryAfter = Math.ceil(remainingMs / 1000)
    throw error
  }

  const token = randomBytes(16).toString('base64url')
  const linkRef = adminDb.collection('authActionLinks').doc(token)
  const expiresAt = Timestamp.fromMillis(Date.now() + LINK_LIFETIME_MS)
  await Promise.all([
    linkRef.set({ uid: decoded.uid, email, type: 'verify-email', expiresAt, createdAt: FieldValue.serverTimestamp() }),
    cooldownRef.set({ lastSentAt: FieldValue.serverTimestamp() }, { merge: true }),
  ])

  const cleanLink = `${cleanAppBaseUrl(env)}/v/${token}`
  const sender = env.EMAIL_FROM || `The Commonplace <${requireValue(env.SMTP_USER, 'SMTP_USER')}>`
  try {
    await getMailTransport(env).sendMail({
      from: sender,
      to: email,
      subject: 'Verify your email — The Commonplace',
      text: `Your commonplace awaits.\n\nVerify ${email} to finish creating your account:\n${cleanLink}\n\nThis private, one-time link expires in 24 hours. If you did not create this account, you can safely ignore this email.`,
      html: renderVerificationEmail({ email, verificationUrl: cleanLink }),
    })
  } catch (error) {
    await linkRef.delete().catch(() => {})
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

  const { adminAuth, adminDb } = getAdminServices(env)
  const linkRef = adminDb.collection('authActionLinks').doc(token)
  const snapshot = await linkRef.get()
  const data = snapshot.data()
  if (!snapshot.exists || data?.type !== 'verify-email' || !data.expiresAt || data.expiresAt.toMillis() <= Date.now()) {
    const error = new Error('This verification link is invalid or expired.')
    error.statusCode = 400
    throw error
  }

  await adminAuth.updateUser(data.uid, { emailVerified: true })
  await linkRef.delete()
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

  const services = getAdminServices(env)
  const user = await findUserByIdentifier(`@${normalized}`, services)
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

  const { adminDb } = getAdminServices(env)
  const handleRef = adminDb.collection('handles').doc(normalized)
  const snapshot = await handleRef.get()
  if (!snapshot.exists) return { handle: normalized, available: true, suggestions: [] }

  const candidates = randomizedHandleCandidates(normalized)
  const candidateSnapshots = await adminDb.getAll(
    ...candidates.map((candidate) => adminDb.collection('handles').doc(candidate)),
  )
  const suggestions = candidateSnapshots
    .filter((candidateSnapshot) => !candidateSnapshot.exists)
    .map((candidateSnapshot) => candidateSnapshot.id)
    .slice(0, 3)

  return { handle: normalized, available: false, suggestions }
}

async function deleteAccountData(adminDb, uid) {
  const querySnapshots = await Promise.all([
    adminDb.collection('handles').where('uid', '==', uid).get(),
    adminDb.collection('posts').where('ownerId', '==', uid).get(),
    adminDb.collection('follows').where('followerId', '==', uid).get(),
    adminDb.collection('follows').where('followingId', '==', uid).get(),
    adminDb.collection('follow-requests').where('requesterId', '==', uid).get(),
    adminDb.collection('follow-requests').where('targetId', '==', uid).get(),
    adminDb.collection('authActionLinks').where('uid', '==', uid).get(),
  ])
  const refs = new Map()
  refs.set(`users/${uid}`, adminDb.collection('users').doc(uid))
  refs.set(`authEmailCooldowns/${uid}`, adminDb.collection('authEmailCooldowns').doc(uid))
  refs.set(`authPasswordResetCooldowns/${uid}`, adminDb.collection('authPasswordResetCooldowns').doc(uid))
  querySnapshots.forEach((snapshot) => {
    snapshot.docs.forEach((document) => refs.set(document.ref.path, document.ref))
  })

  const allPosts = await adminDb.collection('posts').get()
  for (const post of allPosts.docs) {
    const comments = await post.ref.collection('comments').get()
    for (const comment of comments.docs) {
      if (String(comment.data()?.authorId || '') === uid) {
        refs.set(comment.ref.path, comment.ref)
        continue
      }
      const [commentLikes, replies] = await Promise.all([
        comment.ref.collection('likes').get(),
        comment.ref.collection('replies').get(),
      ])
      commentLikes.docs.forEach((like) => {
        if (like.id === uid || String(like.data()?.userId || '') === uid) refs.set(like.ref.path, like.ref)
      })
      for (const reply of replies.docs) {
        if (String(reply.data()?.authorId || '') === uid) {
          refs.set(reply.ref.path, reply.ref)
          continue
        }
        const replyLikes = await reply.ref.collection('likes').get()
        replyLikes.docs.forEach((like) => {
          if (like.id === uid || String(like.data()?.userId || '') === uid) refs.set(like.ref.path, like.ref)
        })
      }
    }
  }

  for (const ref of refs.values()) await adminDb.recursiveDelete(ref)
  return refs.size
}

async function deleteAuthenticatedAccount(request, env) {
  const idToken = bearerToken(request)
  if (!idToken) {
    const error = new Error('Authentication required.')
    error.statusCode = 401
    throw error
  }
  const { adminAuth, adminDb } = getAdminServices(env)
  const decoded = await adminAuth.verifyIdToken(idToken)
  const deletedTargets = await deleteAccountData(adminDb, decoded.uid)
  await adminAuth.deleteUser(decoded.uid)
  return { deleted: true, deletedTargets }
}

function validateDeactivationRequest(data, now = Date.now()) {
  const reason = typeof data?.reason === 'string' ? data.reason.trim() : ''
  const returnPlan = typeof data?.returnPlan === 'string' ? data.returnPlan.trim() : ''
  const feedback = typeof data?.feedback === 'string' ? data.feedback.trim() : ''
  if (!DEACTIVATION_REASONS.has(reason)) {
    const error = new Error('Choose why you are deactivating your account.')
    error.statusCode = 400
    throw error
  }
  if (!Object.hasOwn(REACTIVATION_DELAYS_MS, returnPlan)) {
    const error = new Error('Choose when you would like your account to return.')
    error.statusCode = 400
    throw error
  }
  if (feedback.length > 1000) {
    const error = new Error('Feedback must be 1,000 characters or fewer.')
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
  const { adminAuth, adminDb } = getAdminServices(env)
  const decoded = await adminAuth.verifyIdToken(idToken)
  const userRef = adminDb.collection('users').doc(decoded.uid)
  const privateSettingsRef = userRef.collection('private').doc('settings')
  const reactivatesAt = requestData.reactivatesAt
    ? Timestamp.fromDate(requestData.reactivatesAt)
    : null

  await Promise.all([
    userRef.set({
      accountStatus: 'deactivated',
      deactivatedAt: FieldValue.serverTimestamp(),
      reactivatesAt,
      updatedAt: new Date().toISOString(),
    }, { merge: true }),
    privateSettingsRef.set({
      deactivation: {
        reason: requestData.reason,
        returnPlan: requestData.returnPlan,
        feedback: requestData.feedback,
        safetyConcern: requestData.safetyConcern,
        submittedAt: FieldValue.serverTimestamp(),
      },
      updatedAt: new Date().toISOString(),
    }, { merge: true }),
  ])
  await adminAuth.revokeRefreshTokens(decoded.uid)
  return {
    deactivated: true,
    reactivatesAt: requestData.reactivatesAt?.toISOString() || null,
  }
}

async function sendPasswordResetLink(request, env) {
  const { identifier } = await readJsonBody(request)
  if (typeof identifier !== 'string' || !identifier.trim() || identifier.length > 254) {
    const error = new Error('Enter a valid email or username.')
    error.statusCode = 400
    throw error
  }

  const { adminAuth, adminDb } = getAdminServices(env)
  const user = await findUserByIdentifier(identifier, { adminAuth, adminDb })
  if (!user?.email) return { sent: true }

  const cooldownRef = adminDb.collection('authPasswordResetCooldowns').doc(user.uid)
  const cooldownSnapshot = await cooldownRef.get()
  const lastSentAt = cooldownSnapshot.data()?.lastSentAt?.toMillis?.() || 0
  if (Date.now() - lastSentAt < RESEND_COOLDOWN_MS) return { sent: true }

  const token = randomBytes(32).toString('base64url')
  const linkRef = adminDb.collection('authActionLinks').doc(token)
  const expiresAt = Timestamp.fromMillis(Date.now() + PASSWORD_RESET_LIFETIME_MS)
  await Promise.all([
    linkRef.set({
      uid: user.uid,
      email: user.email,
      type: 'reset-password',
      expiresAt,
      createdAt: FieldValue.serverTimestamp(),
    }),
    cooldownRef.set({ lastSentAt: FieldValue.serverTimestamp() }, { merge: true }),
  ])

  const resetUrl = `${cleanAppBaseUrl(env)}/reset-password/${token}`
  const sender = env.EMAIL_FROM || `The Commonplace <${requireValue(env.SMTP_USER, 'SMTP_USER')}>`
  try {
    await getMailTransport(env).sendMail({
      from: sender,
      to: user.email,
      subject: 'Reset your password — The Commonplace',
      text: `Reset your password for The Commonplace:\n${resetUrl}\n\nThis private, one-time link expires in 1 hour. If you did not request this reset, you can safely ignore this email.`,
      html: renderPasswordResetEmail({ email: user.email, resetUrl }),
    })
  } catch (error) {
    await Promise.all([
      linkRef.delete().catch(() => {}),
      cooldownRef.delete().catch(() => {}),
    ])
    throw error
  }

  return { sent: true }
}

async function validatePasswordResetLink(request, env) {
  const { token } = await readJsonBody(request)
  if (!validActionToken(token)) return { valid: false }
  const { adminDb } = getAdminServices(env)
  const snapshot = await adminDb.collection('authActionLinks').doc(token).get()
  const data = snapshot.data()
  const valid = Boolean(
    snapshot.exists
    && data?.type === 'reset-password'
    && data.expiresAt?.toMillis?.() > Date.now(),
  )
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

  const { adminAuth, adminDb } = getAdminServices(env)
  const linkRef = adminDb.collection('authActionLinks').doc(token)
  const data = await adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(linkRef)
    const linkData = snapshot.data()
    if (!snapshot.exists || linkData?.type !== 'reset-password' || linkData.expiresAt?.toMillis?.() <= Date.now()) {
      const error = new Error('This password reset link is invalid or expired.')
      error.statusCode = 400
      throw error
    }
    transaction.delete(linkRef)
    return linkData
  })
  await adminAuth.updateUser(data.uid, { password: newPassword })
  await adminAuth.revokeRefreshTokens(data.uid)
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
