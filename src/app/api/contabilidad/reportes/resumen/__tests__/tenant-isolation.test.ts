import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { AccountingReportsService } from '@/features/contabilidad/services/accounting-reports-service'

vi.mock('@/features/contabilidad/services/accounting-reports-service', () => ({
  AccountingReportsService: { getSummaryReport: vi.fn() },
}))

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn().mockResolvedValue({
    user: {
      userId: 'user-a',
      role: 'user',
      tenantId: 'tenant-a',
      planFeatures: {
        servicios: true,
        'transferencias-bancarias': true,
        'ajustes-bancarios': true,
        'inyeccion-capital': true,
        'prestamos-cash': true,
      },
    },
  }),
}))

describe('GET /api/contabilidad/reportes/resumen - aislamiento por tenant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(AccountingReportsService.getSummaryReport).mockResolvedValue({
      currencies: [],
      accounts: [],
      exportContent: null,
    } as never)
  })

  it('delega el tenant autenticado al servicio canónico', async () => {
    const { GET } = await import('../route')
    await GET(new NextRequest('http://localhost/api/contabilidad/reportes/resumen'))

    expect(AccountingReportsService.getSummaryReport).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-a' }),
    )
  })

  it('conserva cuentaId sin permitir que sustituya el tenant autenticado', async () => {
    const { GET } = await import('../route')
    await GET(new NextRequest(
      'http://localhost/api/contabilidad/reportes/resumen?cuentaId=account-b',
    ))

    expect(AccountingReportsService.getSummaryReport).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-a', cuentaId: 'account-b' }),
    )
  })

  it('incluye todo el día final del período', async () => {
    const { GET } = await import('../route')
    await GET(new NextRequest(
      'http://localhost/api/contabilidad/reportes/resumen?fechaFin=2026-01-31',
    ))

    expect(AccountingReportsService.getSummaryReport).toHaveBeenCalledWith(
      expect.objectContaining({ fechaFin: '2026-01-31' }),
    )
  })
})
