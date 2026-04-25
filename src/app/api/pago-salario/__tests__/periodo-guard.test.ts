import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const authenticateUserMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    user: { userId: 'test-user', name: 'Test', email: 'test@test.com', role: 'ADMIN', isActive: true },
  })
)

const assertOperationAllowedMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: authenticateUserMock,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    pagosalario: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/services/periodo-operacion-guard', () => ({
  assertOperationAllowed: assertOperationAllowedMock,
  isPeriodoOperacionError: (error: unknown) =>
    Boolean(
      error &&
        typeof error === 'object' &&
        'code' in (error as Record<string, unknown>) &&
        (error as Record<string, unknown>).code === 'PERIODO_BLOQUEADO'
    ),
  serializePeriodoOperacionError: (error: { message: string; code: string }) => ({
    error: error.message,
    code: error.code,
  }),
}))

import { POST } from '../route'

describe('Pago Salario API - bloqueo por período contable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    assertOperationAllowedMock.mockResolvedValue(undefined)
  })

  it('debe responder 409 cuando el período está bloqueado', async () => {
    assertOperationAllowedMock.mockRejectedValueOnce({
      message: 'Período cerrado',
      status: 409,
      code: 'PERIODO_BLOQUEADO',
    })

    const request = new NextRequest('http://localhost:3000/api/pago-salario', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        empleadoId: 'emp-1',
        salario: 5000,
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.code).toBe('PERIODO_BLOQUEADO')
  })
})