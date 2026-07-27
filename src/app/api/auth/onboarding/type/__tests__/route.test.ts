import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { prisma } from '@/lib/prisma'
import { POST } from '../route'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    salesAgentProfile: {
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    tenant: { create: vi.fn() },
    tenantMembership: {
      count: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    tenantLicense: { create: vi.fn() },
  },
}))

vi.mock('@/lib/auth/onboarding', () => ({
  validateCSRF: vi.fn(() => ({ valid: true })),
  verifyOnboardingToken: vi.fn(),
  signOnboardingToken: vi.fn(),
}))

describe('/api/auth/onboarding/type', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      userId: 'user-agent',
      isActive: false,
      onboardingStatus: 'selecting_user_type',
    } as never)
    vi.mocked(prisma.tenantMembership.count).mockResolvedValue(0 as never)
  })

  it('guarda el tipo worker y avanza a selecting_tenant', async () => {
    const { verifyOnboardingToken } = await import('@/lib/auth/onboarding')
    vi.mocked(verifyOnboardingToken).mockReturnValue({
      userId: 'user-1',
      email: 'worker@test.com',
      purpose: 'onboarding',
    } as never)

    vi.mocked(prisma.user.update).mockResolvedValueOnce({} as never)

    const request = new NextRequest('http://localhost/api/auth/onboarding/type', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer onboarding-token',
        'x-request-id': '550e8400-e29b-41d4-a716-446655440000',
      },
      body: JSON.stringify({ userType: 'worker' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.onboardingStatus).toBe('selecting_tenant')
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: {
        onboardingType: 'worker',
        onboardingStatus: 'selecting_tenant',
      },
    })
  })

  it('guarda el tipo company y avanza a awaiting_global_approval', async () => {
    const { verifyOnboardingToken } = await import('@/lib/auth/onboarding')
    vi.mocked(verifyOnboardingToken).mockReturnValue({
      userId: 'user-2',
      email: 'company@test.com',
      purpose: 'onboarding',
    } as never)

    vi.mocked(prisma.user.update).mockResolvedValueOnce({} as never)

    const request = new NextRequest('http://localhost/api/auth/onboarding/type', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer onboarding-token',
        'x-request-id': '550e8400-e29b-41d4-a716-446655440000',
      },
      body: JSON.stringify({ userType: 'company' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.onboardingStatus).toBe('awaiting_global_approval')
  })

  it('rechaza salesAgent sin teléfono', async () => {
    const { verifyOnboardingToken } = await import('@/lib/auth/onboarding')
    vi.mocked(verifyOnboardingToken).mockReturnValue({
      userId: 'user-agent',
      email: 'agent@test.com',
      purpose: 'onboarding',
    } as never)

    const request = new NextRequest('http://localhost/api/auth/onboarding/type', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer onboarding-token',
        'x-request-id': '550e8400-e29b-41d4-a716-446655440000',
      },
      body: JSON.stringify({ userType: 'salesAgent', phone: '   ' }),
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
    expect(prisma.user.update).not.toHaveBeenCalled()
    expect(prisma.salesAgentProfile.create).not.toHaveBeenCalled()
  })

  it('crea el perfil pendiente sin tenant y normaliza el teléfono', async () => {
    const { verifyOnboardingToken } = await import('@/lib/auth/onboarding')
    vi.mocked(verifyOnboardingToken).mockReturnValue({
      userId: 'user-agent',
      email: 'agent@test.com',
      purpose: 'onboarding',
    } as never)
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback: any) =>
      callback(prisma),
    )
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      userId: 'user-agent',
      isActive: false,
      onboardingStatus: 'selecting_user_type',
    } as never)
    vi.mocked(prisma.tenantMembership.count).mockResolvedValueOnce(0 as never)
    vi.mocked(prisma.salesAgentProfile.findUnique).mockResolvedValueOnce(null as never)
    vi.mocked(prisma.user.update).mockResolvedValueOnce({} as never)
    vi.mocked(prisma.salesAgentProfile.create).mockResolvedValueOnce({} as never)

    const request = new NextRequest('http://localhost/api/auth/onboarding/type', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer onboarding-token',
        'x-request-id': '550e8400-e29b-41d4-a716-446655440000',
      },
      body: JSON.stringify({ userType: 'salesAgent', phone: '+53 555-1234' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.onboardingStatus).toBe('awaiting_sales_agent_approval')
    expect(prisma.salesAgentProfile.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-agent',
        referralCode: null,
        phone: '+535551234',
        status: 'pending_approval',
      },
    })
    expect(prisma.tenant.create).not.toHaveBeenCalled()
    expect(prisma.tenantMembership.create).not.toHaveBeenCalled()
    expect(prisma.tenantLicense.create).not.toHaveBeenCalled()
    expect(prisma.tenantMembership.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-agent', isActive: false },
    })
  })

  it('rechaza salesAgent si no está seleccionando tipo o ya tiene membresía activa', async () => {
    const { verifyOnboardingToken } = await import('@/lib/auth/onboarding')
    vi.mocked(verifyOnboardingToken).mockReturnValue({
      userId: 'user-agent',
      email: 'agent@test.com',
      purpose: 'onboarding',
    } as never)
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(prisma))
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce({
        userId: 'user-agent',
        isActive: true,
        onboardingStatus: null,
      } as never)
      .mockResolvedValueOnce({
        userId: 'user-agent',
        isActive: false,
        onboardingStatus: 'selecting_user_type',
      } as never)
    vi.mocked(prisma.tenantMembership.count).mockResolvedValueOnce(1 as never)

    const makeRequest = () => new NextRequest('http://localhost/api/auth/onboarding/type', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer stale-onboarding-token',
        'x-request-id': '550e8400-e29b-41d4-a716-446655440000',
      },
      body: JSON.stringify({ userType: 'salesAgent', phone: '+53 555 9999' }),
    })

    expect((await POST(makeRequest())).status).toBe(409)
    expect((await POST(makeRequest())).status).toBe(409)
    expect(prisma.salesAgentProfile.create).not.toHaveBeenCalled()
    expect(prisma.tenantMembership.deleteMany).not.toHaveBeenCalled()
  })

  it('rechaza un token viejo sin degradar un perfil salesAgent activo', async () => {
    const { verifyOnboardingToken } = await import('@/lib/auth/onboarding')
    vi.mocked(verifyOnboardingToken).mockReturnValue({
      userId: 'user-agent',
      email: 'agent@test.com',
      purpose: 'onboarding',
    } as never)
    vi.mocked(prisma.salesAgentProfile.findUnique).mockResolvedValueOnce({
      userId: 'user-agent',
      status: 'active',
      phone: '+535551234',
    } as never)
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback: any) =>
      callback(prisma),
    )

    const request = new NextRequest('http://localhost/api/auth/onboarding/type', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer stale-onboarding-token',
        'x-request-id': '550e8400-e29b-41d4-a716-446655440000',
      },
      body: JSON.stringify({ userType: 'salesAgent', phone: '+53 555 9999' }),
    })

    const response = await POST(request)

    expect(response.status).toBe(409)
    expect(prisma.$transaction).toHaveBeenCalledOnce()
    expect(prisma.user.update).not.toHaveBeenCalled()
    expect(prisma.salesAgentProfile.create).not.toHaveBeenCalled()
  })

  it('no cambia el usuario si aprobación gana la carrera dentro de la transacción', async () => {
    const { verifyOnboardingToken } = await import('@/lib/auth/onboarding')
    vi.mocked(verifyOnboardingToken).mockReturnValue({
      userId: 'user-agent',
      email: 'agent@test.com',
      purpose: 'onboarding',
    } as never)
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback: any) =>
      callback(prisma),
    )
    vi.mocked(prisma.salesAgentProfile.findUnique).mockResolvedValueOnce({
      userId: 'user-agent',
      status: 'pending_approval',
    } as never)
    vi.mocked(prisma.salesAgentProfile.updateMany).mockResolvedValueOnce({
      count: 0,
    } as never)

    const request = new NextRequest('http://localhost/api/auth/onboarding/type', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer stale-onboarding-token',
        'x-request-id': '550e8400-e29b-41d4-a716-446655440000',
      },
      body: JSON.stringify({ userType: 'salesAgent', phone: '+53 555 9999' }),
    })

    const response = await POST(request)

    expect(response.status).toBe(409)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })
})
