import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

let adminApp

function requireValue(value, name) {
  if (!value) {
    const error = new Error(`${name} is not configured.`)
    error.statusCode = 503
    throw error
  }
  return value
}

export function getAdminServices(env = process.env) {
  if (!adminApp) {
    const projectId = requireValue(
      env.FIREBASE_ADMIN_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID,
      'FIREBASE_ADMIN_PROJECT_ID',
    )
    const clientEmail = requireValue(env.FIREBASE_ADMIN_CLIENT_EMAIL, 'FIREBASE_ADMIN_CLIENT_EMAIL')
    const privateKey = requireValue(env.FIREBASE_ADMIN_PRIVATE_KEY, 'FIREBASE_ADMIN_PRIVATE_KEY')
      .replace(/\\n/g, '\n')
    adminApp = getApps()[0] || initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId })
  }
  return { adminAuth: getAuth(adminApp), adminDb: getFirestore(adminApp) }
}

export function bearerToken(request) {
  const header = String(request.headers.authorization || '')
  return header.startsWith('Bearer ') ? header.slice(7).trim() : ''
}

export async function readJsonBody(request, maxBytes = 16_384) {
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (body.length > maxBytes) {
      const error = new Error('Request body is too large.')
      error.statusCode = 413
      throw error
    }
  }
  try {
    return body ? JSON.parse(body) : {}
  } catch {
    const error = new Error('Invalid JSON request.')
    error.statusCode = 400
    throw error
  }
}
