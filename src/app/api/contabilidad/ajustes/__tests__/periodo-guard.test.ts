import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const assertOperationAllowedMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn().mockResolvedValue({
    user: { userId: 'test-user', name: 'Test', email: 'test@test.com', role: 'ADMIN', isActive: true },
  }),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    cuentaBancaria: { findUnique: vi.fn() },
    ajusteBancario: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: { log: vi.fn().mockResolvedValue(undefined) },
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

describe('Ajustes Bancarios API - bloqueo por período contable', () => {
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

    const { POST } = await import('../route')

    const request = new NextRequest('http://localhost:3000/api/contabilidad/ajustes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        cuentaId: 'c1',
        tipo: 'ingreso',
        monto: 100,
        moneda: 'CUP',
        descripcion: 'Ajuste test',
        motivo: 'Corrección',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.code).toBe('PERIODO_BLOQUEADO')
  })
})