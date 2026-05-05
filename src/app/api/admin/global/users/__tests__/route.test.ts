import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { prisma } from '@/lib/prisma'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    tenantMembership: {
      findMany: vi.fn(),
      count: vi.fn(),
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

  it('rechaza si no es admin', async () => {
    vi.mocked(authenticateUser).mockResolvedValueOnce(mockAuth({ role: 'dependiente' }))

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

  it('filtra por tenantId', async () => {
    const mockAuthResult = mockAuth()
    vi.mocked(authenticateUser).mockResolvedValueOnce(mockAuthResult)
    vi.mocked(prisma.tenantMembership.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.tenantMembership.count).mockResolvedValueOnce(0)

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

  it('maneja error del servidor', async () => {
    vi.mocked(authenticateUser).mockResolvedValueOnce(mockAuth())
    vi.mocked(prisma.tenantMembership.findMany).mockRejectedValueOnce(new Error('DB error'))

    const request = new NextRequest('http://localhost/api/admin/global/users')
    const response = await GET(request)

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBe('Error interno del servidor')
  })
})
})
