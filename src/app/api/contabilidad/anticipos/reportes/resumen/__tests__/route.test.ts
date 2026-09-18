import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth-middleware', () => ({ authenticateUser: vi.fn() }))
vi.mock('@/features/contabilidad/services/accounting-reports-service', () => ({
  AccountingReportsService: { getAdvancesSummaryReport: vi.fn() },
}))

describe('GET /api/contabilidad/anticipos/reportes/resumen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('devuelve el resumen general de anticipos', async () => {
    const { authenticateUser } = await import('@/lib/auth-middleware')
    const { AccountingReportsService } = await import('@/features/contabilidad/services/accounting-reports-service')
    vi.mocked(authenticateUser).mockResolvedValue({ user: { tenantId: 'tenant-1' } } as never)
    vi.mocked(AccountingReportsService.getAdvancesSummaryReport).mockResolvedValue({
      resumen: {
        porTipo: { PAGO: 100, COBRO: 50 },
        porEstado: { RESERVADO: 1, EJECUTADO: 1 },
        porMoneda: { CUP: { total: 100, pendiente: 25 }, USD: { total: 50, pendiente: 0 } },
        totalesGenerales: { totalAnticipos: 150, totalEjecutado: 125, totalPendiente: 25 },
      },
    } as never)

    const { GET } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/anticipos/reportes/resumen')

    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.resumen.totalesGenerales.totalAnticipos).toBe(150)
    expect(body.resumen.porTipo.PAGO).toBe(100)
    expect(body.resumen.porTipo.COBRO).toBe(50)
    expect(AccountingReportsService.getAdvancesSummaryReport).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      tipo: null,
      fechaInicio: null,
      fechaFin: null,
    })
  })
})
