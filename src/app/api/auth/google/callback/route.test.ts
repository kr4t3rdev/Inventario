import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { findUnique, create, getToken, userinfoGet, oauth2Client } = vi.hoisted(() => {
  const getToken = vi.fn()
  return {
    findUnique: vi.fn(),
    create: vi.fn(),
    getToken,
    userinfoGet: vi.fn(),
    oauth2Client: {
      getToken,
      setCredentials: vi.fn(),
    },
  }
})

vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: vi.fn(() => oauth2Client),
    },
    oauth2: vi.fn(() => ({ userinfo: { get: userinfoGet } })),
  },
}))

vi.mock('@/lib/db/platform-prisma', () => ({
  prismaPlatform: {
    user: { findUnique, create, update: vi.fn() },
    userSession: { create: vi.fn() },
    userActivityLog: { create: vi.fn() },
  },
}))

vi.mock('bcryptjs', () => ({ default: { hash: vi.fn() } }))
vi.mock('jsonwebtoken', () => ({ default: { sign: vi.fn() } }))
vi.mock('@/lib/secrets', () => ({
  getJwtSecret: vi.fn(),
  getRefreshJwtSecret: vi.fn(),
}))
vi.mock('@/lib/email', () => ({ sendEmailVerificationLink: vi.fn() }))
vi.mock('@/lib/auth/roles', () => ({ normalizeUserRole: vi.fn() }))
vi.mock('@/lib/auth/onboarding', () => ({ signOnboardingToken: vi.fn() }))
vi.mock('@/lib/auth-middleware', () => ({ resolveTenantContext: vi.fn() }))

import { GET } from './route'

describe('Google OAuth callback', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com'
    vi.clearAllMocks()
    getToken.mockResolvedValue({ tokens: { access_token: 'google-access-token' } })
    userinfoGet.mockResolvedValue({
      data: {
        id: 'google-user-123',
        email: 'nuevo@example.com',
        name: 'Nombre Google',
      },
    })
    findUnique.mockResolvedValue(null)
  })

  it('redirige al registro con el nombre y correo si no existe la cuenta', async () => {
    const request = new NextRequest('https://app.example.com/api/auth/google/callback?code=oauth-code')

    const response = await GET(request)
    const destination = new URL(response.headers.get('location')!)

    expect(destination.pathname).toBe('/register')
    expect(destination.searchParams.get('name')).toBe('Nombre Google')
    expect(destination.searchParams.get('email')).toBe('nuevo@example.com')
    expect(create).not.toHaveBeenCalled()
  })
})
