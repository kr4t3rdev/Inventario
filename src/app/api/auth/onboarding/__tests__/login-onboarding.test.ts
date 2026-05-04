import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { prisma } from '@/lib/prisma'
import { POST } from '../../login/route'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    userSession: { create: vi.fn() },
    tenantMembership: { findUnique: vi.fn(), findFirst: vi.fn() },
    tenantLicense: { findFirst: vi.fn() },
    userActivityLog: { create: vi.fn() },
    notification: { create: vi.fn() },
  },
}))

vi.mock('bcryptjs', () => ({
  default: { compare: vi.fn().mockResolvedValue(true) },
}))

vi.mock('jsonwebtoken', () => ({
  default: { sign: vi.fn().mockReturnValue('mock-jwt-token') },
}))

vi.mock('@/lib/secrets', () => ({
  getJwtSecret: () => 'jwt-secret',
  getRefreshJwtSecret: () => 'refresh-secret',
}))

vi.mock('@/lib/email', () => ({
  sendFailedLoginAttemptsNotification: vi.fn(),
}))

describe('login con estados onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('permite login a usuario mid-onboarding con isActive=false', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      userId: 'user-1',
      name: 'Test User',
      email: 'test@test.com',
      password: 'hashed-password',
      role: 'regularUser',
      isActive: false,
      expiresAt: null,
      lockedUntil: null,
      loginAttempts: 0,
      onboardingStatus: 'awaiting_manager_approval',
    } as any)

    vi.mocked(prisma.userSession.create).mockResolvedValueOnce({} as any)
    vi.mocked(prisma.userActivityLog.create).mockResolvedValueOnce({} as any)

    const request = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', password: 'correct' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.token).toBe('mock-jwt-token')
    expect(data.user.onboardingStatus).toBe('awaiting_manager_approval')
    expect(data.user.isActive).toBe(false)
  })

  it('bloquea login a usuario inactivo sin onboarding pendiente', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      userId: 'user-2',
      name: 'Blocked User',
      email: 'blocked@test.com',
      password: 'hashed-password',
      role: 'regularUser',
      isActive: false,
      expiresAt: null,
      lockedUntil: null,
      loginAttempts: 0,
      onboardingStatus: 'completed',
    } as any)

    const request = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'blocked@test.com', password: 'correct' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toContain('inactivo')
  })

  it('permite login a usuario con onboardingStatus null', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      userId: 'user-3',
      name: 'Legacy User',
      email: 'legacy@test.com',
      password: 'hashed-password',
      role: 'admin',
      isActive: true,
      expiresAt: null,
      lockedUntil: null,
      loginAttempts: 0,
      onboardingStatus: null,
    } as any)

    vi.mocked(prisma.userSession.create).mockResolvedValueOnce({} as any)
    vi.mocked(prisma.userActivityLog.create).mockResolvedValueOnce({} as any)

    const request = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'legacy@test.com', password: 'correct' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.user.onboardingStatus).toBeNull()
  })

  it('permite login a usuario con pending_email_verification', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      userId: 'user-4',
      name: 'New User',
      email: 'new@test.com',
      password: 'hashed-password',
      role: 'regularUser',
      isActive: false,
      expiresAt: null,
      lockedUntil: null,
      loginAttempts: 0,
      onboardingStatus: 'pending_email_verification',
    } as any)

    vi.mocked(prisma.userSession.create).mockResolvedValueOnce({} as any)
    vi.mocked(prisma.userActivityLog.create).mockResolvedValueOnce({} as any)

    const request = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@test.com', password: 'correct' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.user.onboardingStatus).toBe('pending_email_verification')
  })
})
