import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { prisma } from '@/lib/prisma'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    tenant: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    tenantMembership: {
      create: vi.fn(),
    },
    tenantLicense: {
      create: vi.fn(),
    },
    moneda: {
      upsert: vi.fn(),
    },
    plan: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn((callback: Function) => callback(prisma)),
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

import { POST } from '../route'

const { authenticateUser } = await import('@/lib/auth-middleware')

function mockAuth(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      userId: 'user-admin-1',
      name: 'Admin User',
      email: 'admin@test.com',
      role: 'admin',
      isActive: true,
      ...overrides,
    },
    token: 'mock-token',
  }
}

describe('POST /api/admin/global/users/[id]/approve', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rechaza si no es admin', async () => {
    vi.mocked(authenticateUser).mockResolvedValueOnce(mockAuth({ role: 'dependiente' }))

    const request = new NextRequest('http://localhost/api/admin/global/users/user-1/approve', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const response = await POST(request, { params: Promise.resolve({ id: 'user-1' }) })

    expect(response.status).toBe(403)
    const data = await response.json()
    expect(data.error).toBe('No autorizado')
  })

  it('rechaza si el usuario no está en awaiting_global_approval', async () => {
    vi.mocked(authenticateUser).mockResolvedValueOnce(mockAuth())
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      userId: 'user-1',
      name: 'Test User',
      email: 'test@test.com',
      onboardingStatus: 'completed',
      onboardingType: 'company',
    } as any)

    const request = new NextRequest('http://localhost/api/admin/global/users/user-1/approve', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const response = await POST(request, { params: Promise.resolve({ id: 'user-1' }) })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('El usuario no está esperando aprobación global')
  })

  it('rechaza si el usuario no existe', async () => {
    vi.mocked(authenticateUser).mockResolvedValueOnce(mockAuth())
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)

    const request = new NextRequest('http://localhost/api/admin/global/users/user-1/approve', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const response = await POST(request, { params: Promise.resolve({ id: 'user-1' }) })

    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error).toBe('Usuario no encontrado')
  })

  it('aprueba usuario company y crea tenant + membresía', async () => {
    vi.mocked(authenticateUser).mockResolvedValueOnce(mockAuth())
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      userId: 'user-1',
      name: 'Test Company',
      email: 'company@test.com',
      onboardingStatus: 'awaiting_global_approval',
      onboardingType: 'company',
    } as any)
    vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(null)
    vi.mocked(prisma.tenant.create).mockResolvedValueOnce({
      tenantId: 'tenant-new',
      nombre: 'Test Company',
      slug: 'test-company',
    } as any)
    vi.mocked(prisma.tenantMembership.create).mockResolvedValueOnce({
      membershipId: 'mem-new',
      tenantId: 'tenant-new',
      userId: 'user-1',
      tenantRole: 'manager',
      isActive: true,
    } as any)
    vi.mocked(prisma.user.update).mockResolvedValueOnce({
      userId: 'user-1',
      role: 'manager',
      isActive: true,
      onboardingStatus: 'completed',
    } as any)

    const request = new NextRequest('http://localhost/api/admin/global/users/user-1/approve', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const response = await POST(request, { params: Promise.resolve({ id: 'user-1' }) })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.action).toBe('approved')
    expect(data.tenant.tenantId).toBe('tenant-new')
    expect(data.tenant.nombre).toBe('Test Company')
    expect(data.membershipId).toBe('mem-new')
    expect(prisma.moneda.upsert).toHaveBeenCalledWith({
      where: { codigo: 'CUP' },
      update: {
        esPrincipal: true,
        isActive: true,
      },
      create: {
        codigo: 'CUP',
        nombre: 'Peso Cubano',
        simbolo: '$',
        esPrincipal: true,
        isActive: true,
      },
    })
  })

  it('aprueba usuario con plan y crea licencia', async () => {
    vi.mocked(authenticateUser).mockResolvedValueOnce(mockAuth())
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      userId: 'user-1',
      name: 'Test Company',
      email: 'company@test.com',
      onboardingStatus: 'awaiting_global_approval',
      onboardingType: 'company',
    } as any)
    vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(null)
    vi.mocked(prisma.tenant.create).mockResolvedValueOnce({
      tenantId: 'tenant-new',
      nombre: 'Test Company',
      slug: 'test-company',
    } as any)
    vi.mocked(prisma.tenantMembership.create).mockResolvedValueOnce({
      membershipId: 'mem-new',
      tenantId: 'tenant-new',
      userId: 'user-1',
      tenantRole: 'manager',
      isActive: true,
    } as any)
    vi.mocked(prisma.user.update).mockResolvedValueOnce({
      userId: 'user-1',
      role: 'manager',
      isActive: true,
      onboardingStatus: 'completed',
    } as any)
    vi.mocked(prisma.plan.findUnique).mockResolvedValueOnce({
      planId: 'plan-1',
      nombre: 'Pro',
      duracionDias: 30,
      maxUsuarios: 10,
      maxAlmacenes: 5,
      maxProductos: 1000,
    } as any)
    vi.mocked(prisma.tenantLicense.create).mockResolvedValueOnce({
      tenantLicenseId: 'lic-new',
      tenantId: 'tenant-new',
      planId: 'plan-1',
      expiracion: new Date('2025-06-01'),
    } as any)

    const request = new NextRequest('http://localhost/api/admin/global/users/user-1/approve', {
      method: 'POST',
      body: JSON.stringify({ planId: 'plan-1', licenseDurationDays: 30 }),
    })
    const response = await POST(request, { params: Promise.resolve({ id: 'user-1' }) })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.license).not.toBeNull()
    expect(data.license.tenantLicenseId).toBe('lic-new')
    expect(data.license.planId).toBe('plan-1')
    expect(prisma.moneda.upsert).toHaveBeenCalledWith({
      where: { codigo: 'CUP' },
      update: {
        esPrincipal: true,
        isActive: true,
      },
      create: {
        codigo: 'CUP',
        nombre: 'Peso Cubano',
        simbolo: '$',
        esPrincipal: true,
        isActive: true,
      },
    })
  })
})
