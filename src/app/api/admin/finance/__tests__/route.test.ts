import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { authenticateUser } = vi.hoisted(() => ({
  authenticateUser: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    venta: { aggregate: vi.fn() },
    ventaServicios: { aggregate: vi.fn() },
    gastosDE: { aggregate: vi.fn() },
    cuentaPorCobrar: { aggregate: vi.fn() },
    cuentaPorPagar: { aggregate: vi.fn() },
    tenant: { count: vi.fn() },
  },
}))

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser,
  withAuthGet:
    (handler: (request: NextRequest, context: unknown, user: { role: string }) => Promise<Response>) =>
    async (request: NextRequest, context: unknown) => {
      const authResult = await authenticateUser(request)
      if ('status' in authResult) return authResult as Response
      return handler(request, context, authResult.user)
    },
}))

import { prisma } from '@/lib/prisma'
import { GET } from '../route'

function mockAdminUser(role: string = 'admin') {
  return {
    user: {
      userId: 'user-admin-1',
      name: 'Admin User',
      email: 'admin@test.com',
      role,
      isActive: true,
      tenantId: null,
      tenantRole: null,
    },
    token: 'mock-token',
  }
}

describe('GET /api/admin/finance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('devuelve el contrato base para admins globales', async () => {
    vi.mocked(authenticateUser).mockResolvedValueOnce(mockAdminUser())
    vi.mocked(prisma.venta.aggregate).mockResolvedValueOnce({ _count: 2, _sum: { total: 1500 } } as never)
    vi.mocked(prisma.ventaServicios.aggregate).mockResolvedValueOnce({ _count: 1, _sum: { total: 500 } } as never)
    vi.mocked(prisma.gastosDE.aggregate).mockResolvedValueOnce({ _count: 3, _sum: { monto: 700 } } as never)
    vi.mocked(prisma.cuentaPorCobrar.aggregate).mockResolvedValueOnce({
      _count: 4,
      _sum: { montoDeuda: 2000, montoPagado: 1200 },
    } as never)
    vi.mocked(prisma.cuentaPorPagar.aggregate).mockResolvedValueOnce({
      _count: 5,
      _sum: { saldoPendiente: 900 },
    } as never)
    vi.mocked(prisma.tenant.count).mockResolvedValueOnce(7)

    const request = new NextRequest('http://localhost/api/admin/finance')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toMatchObject({
      meta: {
        from: null,
        to: null,
        tenantId: null,
        groupBy: 'month',
      },
      summary: expect.any(Object),
      accounts: expect.any(Object),
      trend: expect.any(Array),
      breakdown: expect.any(Object),
      tenantCount: 7,
      revenue: {
        totalVentas: 2,
        totalVentasMonto: 1500,
        totalVentasServicios: 1,
        totalServiciosMonto: 500,
        totalIngresos: 2000,
      },
      gastos: { totalGastos: 3, totalMonto: 700 },
      cuentasPorCobrar: { total: 4, saldoPendiente: 800 },
      cuentasPorPagar: { total: 5, saldoPendiente: 900 },
    })
  })

  it('expone los filtros válidos en meta', async () => {
    vi.mocked(authenticateUser).mockResolvedValueOnce(mockAdminUser())
    vi.mocked(prisma.venta.aggregate).mockResolvedValueOnce({ _count: 0, _sum: { total: 0 } } as never)
    vi.mocked(prisma.ventaServicios.aggregate).mockResolvedValueOnce({ _count: 0, _sum: { total: 0 } } as never)
    vi.mocked(prisma.gastosDE.aggregate).mockResolvedValueOnce({ _count: 0, _sum: { monto: 0 } } as never)
    vi.mocked(prisma.cuentaPorCobrar.aggregate).mockResolvedValueOnce({
      _count: 0,
      _sum: { montoDeuda: 0, montoPagado: 0 },
    } as never)
    vi.mocked(prisma.cuentaPorPagar.aggregate).mockResolvedValueOnce({
      _count: 0,
      _sum: { saldoPendiente: 0 },
    } as never)
    vi.mocked(prisma.tenant.count).mockResolvedValueOnce(0)

    const request = new NextRequest(
      'http://localhost/api/admin/finance?from=2026-05-01&to=2026-05-13&tenantId=tenant-1&groupBy=week',
    )
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.meta).toMatchObject({
      from: '2026-05-01',
      to: '2026-05-13',
      tenantId: 'tenant-1',
      groupBy: 'week',
    })
    expect(data.summary).toBeDefined()
    expect(data.trend).toBeInstanceOf(Array)
    expect(data.breakdown).toBeDefined()
  })

  it('aplica tenantId y rango de fechas a los agregados', async () => {
    vi.mocked(authenticateUser).mockResolvedValueOnce(mockAdminUser())
    vi.mocked(prisma.venta.aggregate).mockResolvedValueOnce({ _count: 0, _sum: { total: 0 } } as never)
    vi.mocked(prisma.ventaServicios.aggregate).mockResolvedValueOnce({ _count: 0, _sum: { total: 0 } } as never)
    vi.mocked(prisma.gastosDE.aggregate).mockResolvedValueOnce({ _count: 0, _sum: { monto: 0 } } as never)
    vi.mocked(prisma.cuentaPorCobrar.aggregate).mockResolvedValueOnce({
      _count: 0,
      _sum: { montoDeuda: 0, montoPagado: 0 },
    } as never)
    vi.mocked(prisma.cuentaPorPagar.aggregate).mockResolvedValueOnce({
      _count: 0,
      _sum: { saldoPendiente: 0 },
    } as never)
    vi.mocked(prisma.tenant.count).mockResolvedValueOnce(0)

    const request = new NextRequest(
      'http://localhost/api/admin/finance?from=2026-05-01&to=2026-05-13&tenantId=tenant-1&groupBy=week',
    )

    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(prisma.venta.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          createdAt: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
      }),
    )
    expect(prisma.gastosDE.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
        }),
      }),
    )
  })

  it('rechaza valores inválidos de query', async () => {
    vi.mocked(authenticateUser).mockResolvedValueOnce(mockAdminUser())

    const request = new NextRequest('http://localhost/api/admin/finance?groupBy=year')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Parámetros inválidos')
  })

  it('rechaza fechas inválidas y rangos invertidos', async () => {
    vi.mocked(authenticateUser).mockResolvedValueOnce(mockAdminUser())

    const invalidFrom = await GET(new NextRequest('http://localhost/api/admin/finance?from=not-a-date'))
    expect(invalidFrom.status).toBe(400)

    vi.mocked(authenticateUser).mockResolvedValueOnce(mockAdminUser())
    const invalidRange = await GET(
      new NextRequest('http://localhost/api/admin/finance?from=2026-05-13&to=2026-05-01'),
    )
    expect(invalidRange.status).toBe(400)
  })

  it('rechaza a usuarios que no son admin global', async () => {
    vi.mocked(authenticateUser).mockResolvedValueOnce(mockAdminUser('user'))

    const request = new NextRequest('http://localhost/api/admin/finance')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toBe('Solo administradores globales')
  })
})
