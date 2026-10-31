import { createClient } from '@supabase/supabase-js'

let supabaseAdminClient

export function getSupabaseAdmin(env = process.env) {
  if (!supabaseAdminClient) {
    const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceRoleKey) {
      const error = new Error('Supabase environment variables (VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) are not configured.')
      error.statusCode = 503
      throw error
    }
    supabaseAdminClient = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }
  return supabaseAdminClient
}

export function bearerToken(request) {
  const header = String(request?.headers?.authorization || '')
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
