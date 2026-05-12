import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

import { prisma } from '../../../../../lib/prisma'

import { POST } from '../route'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    userSession: {
      create: vi.fn(),
    },
    tenantMembership: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    tenantLicense: {
      findFirst: vi.fn(),
    },
    licencia: {
      findFirst: vi.fn(),
    },
    userActivityLog: {
      create: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
  },
}))

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
  },
}))

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(),
  },
}))

vi.mock('@/lib/secrets', () => ({
  getJwtSecret: () => 'jwt-secret',
  getRefreshJwtSecret: () => 'refresh-secret',
}))

vi.mock('@/lib/email', () => ({
  sendFailedLoginAttemptsNotification: vi.fn(),
}))

describe('auth login route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(null as never)
    vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValue(null as never)
    vi.mocked(prisma.tenantLicense.findFirst).mockResolvedValue(null as never)
    vi.mocked(prisma.licencia.findFirst).mockResolvedValue(null as never)
  })

  it('firma JWT tenant-aware cuando recibe un tenant válido', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      userId: 'u1',
      email: 'u1@test.com',
      password: 'hash',
      isActive: true,
      role: 'admin',
      loginAttempts: 0,
      lockedUntil: null,
      lastFailedLogin: null,
    } as never)
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never)
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue({
      membershipId: 'm1',
      tenantId: 'tenant-1',
      userId: 'u1',
      tenantRole: 'manager',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never)
    vi.mocked(prisma.tenantLicense.findFirst).mockResolvedValue({
      tenantLicenseId: 'license-1',
      tenantId: 'tenant-1',
      activa: true,
      inicio: new Date(),
      expiracion: new Date(Date.now() + 1000000),
      maxUsuarios: 10,
      maxAlmacenes: 5,
      maxProductos: 500,
    } as never)
    vi.mocked(jwt.sign)
      .mockReturnValueOnce('access-token' as never)
      .mockReturnValueOnce('refresh-token' as never)

    const request = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-tenant-id': 'tenant-1' },
      body: JSON.stringify({ email: 'u1@test.com', password: 'secret123' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.token).toBe('access-token')
    expect(data.user.tenantId).toBe('tenant-1')
    expect(data.user.tenantRole).toBe('manager')
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1' },
        data: expect.objectContaining({ expiresAt: expect.any(Date) }),
      })
    )
    expect(vi.mocked(jwt.sign)).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ tenantId: 'tenant-1', tenantRole: 'manager' }),
      'jwt-secret',
      { expiresIn: '30d' }
    )
  })

  it('rechaza un tenant solicitado que no pertenece al usuario', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      userId: 'u2',
      email: 'u2@test.com',
      password: 'hash',
      isActive: true,
      role: 'admin',
      loginAttempts: 0,
      lockedUntil: null,
      lastFailedLogin: null,
    } as never)
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never)
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(null as never)

    const request = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-tenant-id': 'tenant-x' },
      body: JSON.stringify({ email: 'u2@test.com', password: 'secret123' }),
    })

    const response = await POST(request)

    expect(response.status).toBe(403)
  })

  it('rechaza login sin tenant activo aunque exista licencia legacy', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      userId: 'u3',
      email: 'u3@test.com',
      password: 'hash',
      isActive: true,
      role: 'regularUser',
      loginAttempts: 0,
      lockedUntil: null,
      lastFailedLogin: null,
    } as never)
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never)
    vi.mocked(prisma.licencia.findFirst).mockResolvedValue({
      licenciaId: 'legacy-license',
      usuarioId: 'u3',
      planId: 'plan-1',
      activa: true,
      inicio: new Date(),
      expiracion: new Date(Date.now() + 1000000),
    } as never)

    const request = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'u3@test.com', password: 'secret123' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toContain('empresa activa')
    expect(prisma.licencia.findFirst).not.toHaveBeenCalled()
  })
})
