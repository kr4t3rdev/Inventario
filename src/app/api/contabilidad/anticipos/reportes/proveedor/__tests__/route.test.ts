import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth-middleware', () => ({ authenticateUser: vi.fn() }))
vi.mock('@/features/contabilidad/services/accounting-reports-service', () => ({
  AccountingReportsService: { getProviderAdvancesReport: vi.fn() },
}))

describe('GET /api/contabilidad/anticipos/reportes/proveedor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('devuelve reporte agrupado por proveedor', async () => {
    const { authenticateUser } = await import('@/lib/auth-middleware')
    const { AccountingReportsService } = await import('@/features/contabilidad/services/accounting-reports-service')
    vi.mocked(authenticateUser).mockResolvedValue({ user: { tenantId: 'tenant-1' } } as never)
    vi.mocked(AccountingReportsService.getProviderAdvancesReport).mockResolvedValue({
      proveedores: [{
        proveedor: { vendorId: 'prov-1', nombre: 'Proveedor 1' },
        anticipos: [],
        totales: { totalOriginal: 100, totalEjecutado: 75, totalPendiente: 25 },
      }],
    } as never)

    const { GET } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/anticipos/reportes/proveedor')

    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.proveedores).toHaveLength(1)
    expect(body.proveedores[0].totales.totalOriginal).toBe(100)
    expect(body.proveedores[0].totales.totalPendiente).toBe(25)
    expect(AccountingReportsService.getProviderAdvancesReport).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      proveedorId: null,
      fechaInicio: null,
      fechaFin: null,
    })
  })
})
