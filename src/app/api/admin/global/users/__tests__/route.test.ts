import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { prisma } from '@/lib/prisma'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    tenantMembership: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}))

vi.mock('@/lib/auth/roles', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    isAdminRole: (role: string) => role === 'admin',
  }
})

import { GET } from '../route'

function mockAuth(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      userId: 'user-admin-1',
      name: 'Admin User',
      email: 'admin@test.com',
      role: 'admin',
      isActive: true,
      tenantId: 'tenant-1',
      tenantRole: 'manager',
      ...overrides,
    },
    token: 'mock-token',
  }
}

const { authenticateUser } = await import('@/lib/auth-middleware')

describe('GET /api/admin/global/users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('permite acceso a manager de tenant para su propia empresa', async () => {
    vi.mocked(authenticateUser).mockResolvedValueOnce(mockAuth({ role: 'regularUser', tenantId: 'tenant-1', tenantRole: 'manager' }))
    vi.mocked(prisma.tenantMembership.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.tenantMembership.count).mockResolvedValueOnce(0)
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([])

    const request = new NextRequest('http://localhost/api/admin/global/users')
    const response = await GET(request)

    expect(response.status).toBe(200)
    // Verifica que se filtró por el tenant del usuario
    expect(prisma.tenantMembership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
        }),
      }),
    )
  })

  it('rechaza si no es admin ni manager de tenant', async () => {
    vi.mocked(authenticateUser).mockResolvedValueOnce(mockAuth({ role: 'dependiente', tenantId: null, tenantRole: null }))

    const request = new NextRequest('http://localhost/api/admin/global/users')
    const response = await GET(request)

    expect(response.status).toBe(403)
    const data = await response.json()
    expect(data.error).toBe('No autorizado')
  })

  it('devuelve lista de usuarios con paginación', async () => {
    const mockMemberships = [
      {
        membershipId: 'mem-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        tenantRole: 'admin',
        user: {
          userId: 'user-1',
          name: 'John Doe',
          email: 'john@test.com',
          role: 'admin',
          isActive: true,
          createdAt: new Date(),
        },
        tenant: { nombre: 'Empresa A', slug: 'empresa-a' },
      },
      {
        membershipId: 'mem-2',
        tenantId: 'tenant-2',
        userId: 'user-2',
        tenantRole: 'dependiente',
        user: {
          userId: 'user-2',
          name: 'Jane Smith',
          email: 'jane@test.com',
          role: 'dependiente',
          isActive: true,
          createdAt: new Date(),
        },
        tenant: { nombre: 'Empresa B', slug: 'empresa-b' },
      },
    ]

    vi.mocked(authenticateUser).mockResolvedValueOnce(mockAuth())
    vi.mocked(prisma.tenantMembership.findMany).mockResolvedValueOnce(mockMemberships as any)
    vi.mocked(prisma.tenantMembership.count).mockResolvedValueOnce(2)
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([])

    const request = new NextRequest('http://localhost/api/admin/global/users?page=1&limit=10')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.users).toHaveLength(2)
    expect(data.total).toBe(2)
    expect(data.page).toBe(1)
    expect(data.pages).toBe(1)
    expect(data.limit).toBe(10)
    expect(data.users[0]).toMatchObject({
      userId: 'user-1',
      name: 'John Doe',
      tenantId: 'tenant-1',
      tenantName: 'Empresa A',
      tenantRole: 'admin',
    })
  })

  it('incluye usuarios pendientes de aprobación global sin membresía', async () => {
    const mockMemberships = [
      {
        membershipId: 'mem-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        tenantRole: 'admin',
        user: {
          userId: 'user-1',
          name: 'John Doe',
          email: 'john@test.com',
          role: 'admin',
          isActive: true,
          createdAt: new Date(),
        },
        tenant: { nombre: 'Empresa A', slug: 'empresa-a' },
      },
    ]

    const mockPendingUsers = [
      {
        userId: 'user-pending-1',
        name: 'Pending User',
        email: 'pending@test.com',
        role: 'regularUser',
        isActive: false,
        onboardingStatus: 'awaiting_global_approval',
        onboardingType: 'company',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]

    vi.mocked(authenticateUser).mockResolvedValueOnce(mockAuth())
    vi.mocked(prisma.tenantMembership.findMany).mockResolvedValueOnce(mockMemberships as any)
    vi.mocked(prisma.tenantMembership.count).mockResolvedValueOnce(1)
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce(mockPendingUsers as any)

    const request = new NextRequest('http://localhost/api/admin/global/users?page=1&limit=10')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.users).toHaveLength(2)
    expect(data.total).toBe(2)

    const pendingUser = data.users.find((u: any) => u.userId === 'user-pending-1')
    expect(pendingUser).toBeDefined()
    expect(pendingUser.tenantId).toBeNull()
    expect(pendingUser.tenantName).toBeNull()
    expect(pendingUser.tenantRole).toBeNull()
    expect(pendingUser.membershipId).toBeNull()
    expect(pendingUser.onboardingStatus).toBe('awaiting_global_approval')
  })

  it('filtra por tenantId', async () => {
    const mockAuthResult = mockAuth()
    vi.mocked(authenticateUser).mockResolvedValueOnce(mockAuthResult)
    vi.mocked(prisma.tenantMembership.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.tenantMembership.count).mockResolvedValueOnce(0)
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([])

    const request = new NextRequest('http://localhost/api/admin/global/users?tenantId=550e8400-e29b-41d4-a716-446655440000')
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(prisma.tenantMembership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: '550e8400-e29b-41d4-a716-446655440000',
        }),
      }),
    )
  })

  it('filtra por búsqueda (nombre o email)', async () => {
    vi.mocked(authenticateUser).mockResolvedValueOnce(mockAuth())
    vi.mocked(prisma.tenantMembership.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.tenantMembership.count).mockResolvedValueOnce(0)
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([])

    const request = new NextRequest('http://localhost/api/admin/global/users?search=john')
    await GET(request)

    expect(prisma.tenantMembership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user: {
            OR: [
              { name: { contains: 'john', mode: 'insensitive' } },
              { email: { contains: 'john', mode: 'insensitive' } },
            ],
          },
        }),
      }),
    )
  })

  it('filtra por role (tenantRole)', async () => {
    vi.mocked(authenticateUser).mockResolvedValueOnce(mockAuth())
    vi.mocked(prisma.tenantMembership.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.tenantMembership.count).mockResolvedValueOnce(0)
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([])

    const request = new NextRequest('http://localhost/api/admin/global/users?role=admin')
    await GET(request)

    expect(prisma.tenantMembership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantRole: 'admin',
        }),
      }),
    )
  })

  it('filtra por isActive', async () => {
    vi.mocked(authenticateUser).mockResolvedValueOnce(mockAuth())
    vi.mocked(prisma.tenantMembership.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.tenantMembership.count).mockResolvedValueOnce(0)
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([])

    const request = new NextRequest('http://localhost/api/admin/global/users?isActive=true')
    await GET(request)

    expect(prisma.tenantMembership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user: { isActive: true },
        }),
      }),
    )
  })

  it('ordena por columna especificada', async () => {
    vi.mocked(authenticateUser).mockResolvedValueOnce(mockAuth())
    vi.mocked(prisma.tenantMembership.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.tenantMembership.count).mockResolvedValueOnce(0)
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([])

    const request = new NextRequest('http://localhost/api/admin/global/users?sortBy=name&sortOrder=asc')
    await GET(request)

    expect(prisma.tenantMembership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: expect.objectContaining({
          user: { name: 'asc' },
        }),
      }),
    )
  })

  it('rechaza parámetros inválidos', async () => {
    vi.mocked(authenticateUser).mockResolvedValueOnce(mockAuth())

    const request = new NextRequest('http://localhost/api/admin/global/users?page=invalid')
    const response = await GET(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toContain('inválidos')
  })

  it('es resiliente ante error en memberships y devuelve lista vacía', async () => {
    vi.mocked(authenticateUser).mockResolvedValueOnce(mockAuth())
    vi.mocked(prisma.tenantMembership.findMany).mockRejectedValueOnce(new Error('DB error'))
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([])

    const request = new NextRequest('http://localhost/api/admin/global/users')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.users).toHaveLength(0)
    expect(data.total).toBe(0)
  })
})
