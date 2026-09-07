import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { authenticateUser } from '../auth-middleware'
import { prisma } from '../prisma'
import jwt from 'jsonwebtoken'

vi.mock('../prisma', () => ({
  prisma: {
    userSession: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    tenantMembership: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    tenantLicense: {
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('@/lib/db/platform-prisma', async () => {
  const { prisma } = await import('../prisma')
  return { prismaPlatform: prisma, default: prisma }
})

vi.mock('jsonwebtoken')

describe('authenticateUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return error if no authorization header', async () => {
    const mockRequest = new NextRequest(
      new Request('http://localhost/api/test')
    )

    const result = await authenticateUser(mockRequest)

    if ('status' in result) {
      expect(result.status).toBe(401)
    } else {
      throw new Error('Expected error response')
    }
  })

  it('should return error if Bearer token missing', async () => {
    const mockRequest = new NextRequest(
      new Request('http://localhost/api/test', {
        headers: { authorization: 'Invalid token' },
      })
    )

    const result = await authenticateUser(mockRequest)

    if ('status' in result) {
      expect(result.status).toBe(401)
    } else {
      throw new Error('Expected error response')
    }
  })

  it('should return error if JWT format invalid', async () => {
    const mockRequest = new NextRequest(
      new Request('http://localhost/api/test', {
        headers: { authorization: 'Bearer invalid.token' },
      })
    )

    const result = await authenticateUser(mockRequest)

    if ('status' in result) {
      expect(result.status).toBe(401)
    } else {
      throw new Error('Expected error response')
    }
  })

  it('should return user if authentication successful', async () => {
    const mockUser = {
      userId: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'admin' as const,
      isActive: true,
    }

    const mockToken = 'valid.jwt.token'

    const mockRequest = new NextRequest(
      new Request('http://localhost/api/test', {
        headers: { authorization: `Bearer ${mockToken}` },
      })
    )

    vi.mocked(jwt.verify).mockReturnValue({
      userId: 'user-1',
      email: 'test@example.com',
    } as any)

    vi.mocked(prisma.userSession.findUnique).mockResolvedValue({
      isActive: true,
      expiresAt: new Date(Date.now() + 1000000),
      userId: 'user-1',
    } as any)

    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)

    const result = await authenticateUser(mockRequest)

    if ('status' in result) {
      throw new Error('Expected user object, got error response')
    }

    expect(result.user).toEqual(mockUser)
  })

  it('preserves planName and planFeatures from the resolved tenant context', async () => {
    const mockToken = 'valid.jwt.token'

    const mockRequest = new NextRequest(
      new Request('http://localhost/api/test', {
        headers: { authorization: `Bearer ${mockToken}` },
      })
    )

    vi.mocked(jwt.verify).mockReturnValue({
      userId: 'user-1',
      email: 'test@example.com',
      tenantId: 'tenant-basic',
    } as any)

    vi.mocked(prisma.userSession.findUnique).mockResolvedValue({
      isActive: true,
      expiresAt: new Date(Date.now() + 1000000),
      userId: 'user-1',
    } as any)

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      userId: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'manager',
      isActive: true,
    } as any)

    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue({
      tenantId: 'tenant-basic',
      userId: 'user-1',
      tenantRole: 'manager',
      isActive: true,
    } as any)

    vi.mocked(prisma.tenantLicense.findFirst).mockResolvedValue({
      maxUsuarios: 3,
      maxAlmacenes: 2,
      maxProductos: 500,
      expiracion: new Date(Date.now() + 1000000),
      features: {
        empleados: true,
        nomina: true,
        asistencia: true,
        vacaciones: true,
      },
      plan: {
        nombre: 'Básico',
      },
    } as any)

    const result = await authenticateUser(mockRequest)

    if ('status' in result) {
      throw new Error('Expected user object, got error response')
    }

    expect(result.user).toEqual(
      expect.objectContaining({
        tenantId: 'tenant-basic',
        tenantRole: 'manager',
        planName: 'Básico',
        planFeatures: {
          empleados: true,
          nomina: true,
          asistencia: true,
          vacaciones: true,
        },
      }),
    )
  })

  it('merges plan features with explicit license overrides', async () => {
    const mockToken = 'valid.jwt.token'

    const mockRequest = new NextRequest(
      new Request('http://localhost/api/test', {
        headers: { authorization: `Bearer ${mockToken}` },
      })
    )

    vi.mocked(jwt.verify).mockReturnValue({
      userId: 'user-1',
      email: 'test@example.com',
      tenantId: 'tenant-basic',
    } as any)

    vi.mocked(prisma.userSession.findUnique).mockResolvedValue({
      isActive: true,
      expiresAt: new Date(Date.now() + 1000000),
      userId: 'user-1',
    } as any)

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      userId: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'manager',
      isActive: true,
    } as any)

    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue({
      tenantId: 'tenant-basic',
      userId: 'user-1',
      tenantRole: 'manager',
      isActive: true,
    } as any)

    vi.mocked(prisma.tenantLicense.findFirst).mockResolvedValue({
      maxUsuarios: 3,
      maxAlmacenes: 2,
      maxProductos: 500,
      maxClientes: 50,
      expiracion: new Date(Date.now() + 1000000),
      features: {
        contabilidad: false,
      },
      featureOverrides: {
        'reportes-financieros': false,
      },
      plan: {
        nombre: 'Básico',
        features: {
          contabilidad: true,
          'reportes-financieros': true,
        },
      },
    } as any)

    const result = await authenticateUser(mockRequest)

    if ('status' in result) {
      throw new Error('Expected user object, got error response')
    }

    expect(result.user).toEqual(
      expect.objectContaining({
        planName: 'Básico',
        planFeatures: {
          contabilidad: true,
          'reportes-financieros': false,
        },
      }),
    )
  })

  it('should return error if session is inactive', async () => {
    const mockToken = 'valid.jwt.token'

    const mockRequest = new NextRequest(
      new Request('http://localhost/api/test', {
        headers: { authorization: `Bearer ${mockToken}` },
      })
    )

    vi.mocked(jwt.verify).mockReturnValue({
      userId: 'user-1',
      email: 'test@example.com',
    } as any)

    vi.mocked(prisma.userSession.findUnique).mockResolvedValue({
      isActive: false,
      expiresAt: new Date(Date.now() + 1000000),
      userId: 'user-1',
    } as any)

    const result = await authenticateUser(mockRequest)

    if ('status' in result) {
      expect(result.status).toBe(401)
    } else {
      throw new Error('Expected error response')
    }
  })

  it('should return error if session expired', async () => {
    const mockToken = 'valid.jwt.token'

    const mockRequest = new NextRequest(
      new Request('http://localhost/api/test', {
        headers: { authorization: `Bearer ${mockToken}` },
      })
    )

    vi.mocked(jwt.verify).mockReturnValue({
      userId: 'user-1',
      email: 'test@example.com',
    } as any)

    vi.mocked(prisma.userSession.findUnique).mockResolvedValue({
      isActive: true,
      expiresAt: new Date(Date.now() - 1000), // Expired
      userId: 'user-1',
    } as any)

    const result = await authenticateUser(mockRequest)

    if ('status' in result) {
      expect(result.status).toBe(401)
    } else {
      throw new Error('Expected error response')
    }
  })

  it('should return error if user not found', async () => {
    const mockToken = 'valid.jwt.token'

    const mockRequest = new NextRequest(
      new Request('http://localhost/api/test', {
        headers: { authorization: `Bearer ${mockToken}` },
      })
    )

    vi.mocked(jwt.verify).mockReturnValue({
      userId: 'user-1',
      email: 'test@example.com',
    } as any)

    vi.mocked(prisma.userSession.findUnique).mockResolvedValue({
      isActive: true,
      expiresAt: new Date(Date.now() + 1000000),
      userId: 'user-1',
    } as any)

    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    const result = await authenticateUser(mockRequest)

    if ('status' in result) {
      expect(result.status).toBe(401)
    } else {
      throw new Error('Expected error response')
    }
  })

  it('should return error if user is inactive', async () => {
    const mockToken = 'valid.jwt.token'

    const mockRequest = new NextRequest(
      new Request('http://localhost/api/test', {
        headers: { authorization: `Bearer ${mockToken}` },
      })
    )

    vi.mocked(jwt.verify).mockReturnValue({
      userId: 'user-1',
      email: 'test@example.com',
    } as any)

    vi.mocked(prisma.userSession.findUnique).mockResolvedValue({
      isActive: true,
      expiresAt: new Date(Date.now() + 1000000),
      userId: 'user-1',
    } as any)

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      userId: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'admin',
      isActive: false,
    } as any)

    const result = await authenticateUser(mockRequest)

    if ('status' in result) {
      expect(result.status).toBe(403)
    } else {
      throw new Error('Expected error response')
    }
  })

  it('should handle JWT errors gracefully', async () => {
    const mockToken = 'invalid.jwt.token'

    const mockRequest = new NextRequest(
      new Request('http://localhost/api/test', {
        headers: { authorization: `Bearer ${mockToken}` },
      })
    )

    vi.mocked(jwt.verify).mockImplementation(() => {
      throw new jwt.JsonWebTokenError('Invalid token')
    })

    const result = await authenticateUser(mockRequest)

    if ('status' in result) {
      expect(result.status).toBe(401)
    } else {
      throw new Error('Expected error response')
    }
  })

  describe('tenant context resolution', () => {
    const mockToken = 'valid.tenant.jwt'
    const mockUser = {
      userId: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'admin' as const,
      isActive: true,
    }
    const mockMembership = {
      membershipId: 'membership-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
      tenantRole: 'admin',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    beforeEach(() => {
      vi.mocked(jwt.verify).mockReturnValue({
        userId: 'user-1',
        email: 'test@example.com',
      } as any)
      vi.mocked(prisma.userSession.findUnique).mockResolvedValue({
        isActive: true,
        expiresAt: new Date(Date.now() + 1000000),
        userId: 'user-1',
      } as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
    })

    it('attaches tenantId and tenantRole when membership exists', async () => {
      vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValue(mockMembership as any)
      vi.mocked(prisma.tenantLicense.findFirst).mockResolvedValue(null)

      const request = new NextRequest(
        new Request('http://localhost/api/test', {
          headers: { authorization: `Bearer ${mockToken}` },
        })
      )

      const result = await authenticateUser(request)

      if ('status' in result) {
        throw new Error('Expected user, got error')
      }

      expect(result.user.tenantId).toBe('tenant-1')
      expect(result.user.tenantRole).toBe('manager')
    })

    it('resolves tenant from x-tenant-id header when provided', async () => {
      vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(mockMembership as any)
      vi.mocked(prisma.tenantLicense.findFirst).mockResolvedValue(null)

      const request = new NextRequest(
        new Request('http://localhost/api/test', {
          headers: {
            authorization: `Bearer ${mockToken}`,
            'x-tenant-id': 'tenant-1',
          },
        })
      )

      const result = await authenticateUser(request)

      if ('status' in result) {
        throw new Error('Expected user, got error')
      }

      // Should use findUnique (exact match) instead of findFirst
      expect(prisma.tenantMembership.findUnique).toHaveBeenCalledWith({
        where: { tenantId_userId: { tenantId: 'tenant-1', userId: 'user-1' } },
      })
      expect(result.user.tenantId).toBe('tenant-1')
    })

    it('does not attach tenant context when no membership exists', async () => {
      vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValue(null)

      const request = new NextRequest(
        new Request('http://localhost/api/test', {
          headers: { authorization: `Bearer ${mockToken}` },
        })
      )

      const result = await authenticateUser(request)

      if ('status' in result) {
        throw new Error('Expected user, got error')
      }

      expect(result.user.tenantId).toBeUndefined()
      expect(result.user.tenantRole).toBeUndefined()
    })

    it('attaches planLimits when tenant has active license', async () => {
      vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValue(mockMembership as any)
      vi.mocked(prisma.tenantLicense.findFirst).mockResolvedValue({
        maxUsuarios: 10,
        maxAlmacenes: 5,
        maxProductos: 500,
        maxClientes: 250,
      } as any)

      const request = new NextRequest(
        new Request('http://localhost/api/test', {
          headers: { authorization: `Bearer ${mockToken}` },
        })
      )

      const result = await authenticateUser(request)

      if ('status' in result) {
        throw new Error('Expected user, got error')
      }

      expect(result.user.planLimits).toEqual({
        maxUsuarios: 10,
        maxAlmacenes: 5,
        maxProductos: 500,
        maxClientes: 250,
      })
    })
  })
})
