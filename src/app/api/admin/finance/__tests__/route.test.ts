import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { prisma } from '@/lib/prisma'

const authenticateUser = vi.fn()

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

  it('rechaza a usuarios que no son admin global', async () => {
    vi.mocked(authenticateUser).mockResolvedValueOnce(mockAdminUser('user'))

    const request = new NextRequest('http://localhost/api/admin/finance')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toBe('Solo administradores globales')
  })
})
