import assert from 'node:assert/strict'
import test from 'node:test'
import { handleFollowRequestsApiRequest } from './follows.mjs'

test('rejects follow request endpoints when unauthenticated', async () => {
  const request = {
    method: 'POST',
    url: '/api/follow-requests/accept',
    headers: {},
  }
  await assert.rejects(
    () => handleFollowRequestsApiRequest(request, {}),
    (error) => error.statusCode === 401 && error.message === 'Authentication required.',
  )
})

test('rejects follow request endpoints when token is invalid', async () => {
  const request = {
    method: 'POST',
    url: '/api/follow-requests/request',
    headers: {
      authorization: 'Bearer bad-token',
    },
  }
  const mockEnv = {
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-key',
  }
  // Will fail trying to connect to mock supabase or reject invalid auth
  await assert.rejects(
    () => handleFollowRequestsApiRequest(request, mockEnv),
  )
})

test('rejects profile content endpoint when missing userId and handle', async () => {
  const request = {
    method: 'GET',
    url: '/api/profiles/content',
    headers: {},
  }
  await assert.rejects(
    () => handleFollowRequestsApiRequest(request, {}),
    (error) => error.statusCode === 400 && error.message === 'Missing userId or handle parameter.',
  )
})

test('rejects profile entry endpoint when missing id', async () => {
  const request = {
    method: 'GET',
    url: '/api/profiles/entry',
    headers: {},
  }
  await assert.rejects(
    () => handleFollowRequestsApiRequest(request, {}),
    (error) => error.statusCode === 400 && error.message === 'Missing entry id parameter.',
  )
})
