import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { mockUser, mockRequirePermission, mockRequireTenant } = vi.hoisted(() => ({
  mockUser: { userId: 'user-1', tenantId: 'tenant-1', role: 'regularUser' },
  mockRequirePermission: vi.fn(),
  mockRequireTenant: vi.fn(() => 'tenant-1'),
}))

vi.mock('@/lib/auth-middleware', () => ({
  withAuthGet: (handler: any) => (request: unknown, context: unknown) =>
    handler(request, context, mockUser),
}))

vi.mock('@/lib/services/tenant-scope', () => ({
  requirePermission: mockRequirePermission,
  requireTenant: mockRequireTenant,
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    prestamoCash: {
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    cuentaPorCobrar: {
      findMany: vi.fn(),
    },
    reconciliacionVenta: {
      aggregate: vi.fn(),
    },
  }
}))

describe('API contabilidad/prestamos-cash/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_ENABLE_PRESTAMOS_CASH', 'true')
  })

  it('GET retorna estadísticas enriquecidas', async () => {
    const prisma = (await import('@/lib/prisma')).default as any

    prisma.prestamoCash.count
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)

    prisma.prestamoCash.groupBy.mockResolvedValueOnce([
      { moneda: 'CUP', _sum: { montoCapital: '1000' } },
      { moneda: 'USD', _sum: { montoCapital: '200' } },
    ])

    prisma.cuentaPorCobrar.findMany.mockResolvedValueOnce([
      { montoDeuda: '1200', montoPagado: '500', prestamoCash: { moneda: 'CUP' } },
      { montoDeuda: '300', montoPagado: '100', prestamoCash: { moneda: 'USD' } },
    ])

    prisma.reconciliacionVenta.aggregate.mockResolvedValueOnce({
      _sum: { monto: '600' },
      _avg: { monto: '150' },
    })

    const { GET } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/prestamos-cash/stats')
    const response = await GET(request, {})
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.totalActivos).toBe(4)
    expect(body.totalPagados).toBe(2)
    expect(body.totalVencidos).toBe(1)
    expect(body.montoTotalPrestado).toEqual({ CUP: 1000, USD: 200 })
    expect(body.montoPendienteCobro).toEqual({ CUP: 700, USD: 200 })
    expect(body.resumenMovimientos.totalPagos).toBe(600)
    expect(body.resumenMovimientos.promedioPago).toBe(150)
    expect(prisma.prestamoCash.count).toHaveBeenNthCalledWith(1, {
      where: { tenantId: 'tenant-1', estado: 'ACTIVO', deletedAt: null },
    })
    expect(prisma.prestamoCash.count).toHaveBeenNthCalledWith(2, {
      where: { tenantId: 'tenant-1', estado: 'PAGADO', deletedAt: null },
    })
    expect(prisma.prestamoCash.count).toHaveBeenNthCalledWith(3, {
      where: { tenantId: 'tenant-1', estado: 'VENCIDO', deletedAt: null },
    })
    expect(prisma.prestamoCash.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-1', estado: { not: 'CANCELADO' }, deletedAt: null },
    }))
    expect(prisma.cuentaPorCobrar.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-1', tipoCuenta: 'PRESTAMO_CASH', estado: { not: 'PAGADA' } },
    }))
    expect(prisma.reconciliacionVenta.aggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-1', tipoReconciliacion: 'PRESTAMO_CASH' },
    }))
  })

  it('denies stats without accounting permission before querying tenant data', async () => {
    const { ActionError } = await import('@/lib/server-actions')
    const prisma = (await import('@/lib/prisma')).default as any
    mockRequirePermission.mockImplementation(() => {
      throw new ActionError('forbidden', 'FORBIDDEN')
    })

    const { GET } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/prestamos-cash/stats')
    const response = await GET(request, {})

    expect(response.status).toBe(403)
    expect(prisma.prestamoCash.count).not.toHaveBeenCalled()
    expect(prisma.prestamoCash.groupBy).not.toHaveBeenCalled()
    expect(prisma.cuentaPorCobrar.findMany).not.toHaveBeenCalled()
    expect(prisma.reconciliacionVenta.aggregate).not.toHaveBeenCalled()
  })
})
