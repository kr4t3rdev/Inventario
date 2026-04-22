import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    cuentaBancaria: { findUnique: vi.fn() },
    reconciliacionVenta: { findMany: vi.fn() },
    reconciliacionServicio: { findMany: vi.fn() },
    reconciliacionGasto: { findMany: vi.fn() },
    ajusteBancario: { findMany: vi.fn() },
    inyeccionCapital: { findMany: vi.fn() },
    pagoDeuda: { findMany: vi.fn() },
    transferenciaBancaria: { findMany: vi.fn() },
  }
}))

describe('API contabilidad/cuentas/[id]/historial - desembolso préstamo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('clasifica el desembolso de préstamo cash como egreso', async () => {
    const prisma = (await import('@/lib/prisma')).prisma as any
    prisma.cuentaBancaria.findUnique.mockResolvedValue({ cuentaId: 'cb-1', moneda: 'CUP', nombreBanco: 'Banco A', numeroCuenta: '123' })
    prisma.reconciliacionVenta.findMany.mockResolvedValue([
      {
        reconciliacionId: 'rec-1',
        fechaReconciliacion: new Date('2024-02-01T00:00:00.000Z'),
        tipoReconciliacion: 'PRESTAMO_CASH_DESEMBOLSO',
        prestamoCash: { id: 'p-1', cliente: { nombre: 'Cliente Test' } },
        deudaCash: null,
        venta: null,
        observaciones: 'Desembolso',
        moneda: 'CUP',
        monto: '500',
        tasaCambio: null,
        tipoPago: { nombre: 'Transferencia' },
        cuentaBancaria: { nombreBanco: 'Banco A', numeroCuenta: '123', moneda: 'CUP' },
      }
    ])
    prisma.reconciliacionServicio.findMany.mockResolvedValue([])
    prisma.reconciliacionGasto.findMany.mockResolvedValue([])
    prisma.ajusteBancario.findMany.mockResolvedValue([])
    prisma.inyeccionCapital.findMany.mockResolvedValue([])
    prisma.pagoDeuda.findMany.mockResolvedValue([])
    prisma.transferenciaBancaria.findMany.mockResolvedValue([])

    const { GET } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/cuentas/cb-1/historial')
    const response = await GET(request, { params: Promise.resolve({ id: 'cb-1' }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.transacciones[0].tipoMovimiento).toBe('prestamo_cash_desembolso')
    expect(body.transacciones[0].esIngreso).toBe(false)
  })
})
