import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn().mockResolvedValue({ user: { userId: 'user-test' } }),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    reconciliacionVenta: { findMany: vi.fn() },
    reconciliacionServicio: { findMany: vi.fn() },
    reconciliacionGasto: { findMany: vi.fn() },
    transferenciaBancaria: { findMany: vi.fn() },
    ajusteBancario: { findMany: vi.fn() },
    inyeccionCapital: { findMany: vi.fn() },
    pagoDeuda: { findMany: vi.fn() },
  }
}))

describe('API contabilidad/reportes/movimientos - deudas cash', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('incluye desembolso de deuda cash como egreso', async () => {
    const prisma = (await import('@/lib/prisma')).prisma as any
    prisma.reconciliacionVenta.findMany.mockResolvedValue([
      {
        reconciliacionId: 'rec-1',
        monto: '500',
        moneda: 'CUP',
        tasaCambio: null,
        fechaReconciliacion: new Date('2024-02-01T00:00:00.000Z'),
        observaciones: 'Desembolso deuda',
        reconciliadoPor: 'user-test',
        tipoReconciliacion: 'DEUDA_CASH_DESEMBOLSO',
        venta: null,
        deudaCash: { id: 'deuda-1', proveedor: { nombre: 'Proveedor Test' } },
        prestamoCash: null,
        cuentaBancaria: { nombreBanco: 'Banco A', numeroCuenta: '123' },
        tipoPago: { nombre: 'Transferencia' },
      }
    ])
    prisma.reconciliacionServicio.findMany.mockResolvedValue([])
    prisma.reconciliacionGasto.findMany.mockResolvedValue([])
    prisma.transferenciaBancaria.findMany.mockResolvedValue([])
    prisma.ajusteBancario.findMany.mockResolvedValue([])
    prisma.inyeccionCapital.findMany.mockResolvedValue([])
    prisma.pagoDeuda.findMany.mockResolvedValue([])

    const { GET } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/reportes/movimientos')
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data[0].tipo).toBe('deuda_cash_desembolso')
    expect(body.data[0].descripcion).toContain('Desembolso de Deuda Cash')
  })
})
