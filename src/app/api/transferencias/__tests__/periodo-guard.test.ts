import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const assertOperationAllowedMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth-middleware', () => ({
  withAuthGet: (handler: any) => handler,
  withAuthPost: (handler: any) => async (request: NextRequest, context: any) =>
    handler(request, context, { userId: 'test-user' }),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    producto: { findUnique: vi.fn() },
    transferencia: { aggregate: vi.fn() },
    puntoDeVenta: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/notificaciones-utils', () => ({
  notificarTransferencia: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/services/stock-ubicacion-service', () => ({
  upsertStockUbicacion: vi.fn().mockResolvedValue(undefined),
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

describe('Transferencias Inventario API - bloqueo por período contable', () => {
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

    const request = new NextRequest('http://localhost:3000/api/transferencias', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        productos: [{ productoId: 'p1', cantidad: 5 }],
        tipoOrigen: 'ALMACEN',
        origenId: 'a1',
        tipoDestino: 'PUNTO_VENTA',
        destinoId: 'pv1',
      }),
    })

    const response = await POST(request, {})
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.code).toBe('PERIODO_BLOQUEADO')
  })
})