import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { getCuentaHistorialHandler } from '@/features/contabilidad/api/handlers'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    cuentaBancaria: {
      findUnique: vi.fn(),
    },
    reconciliacionVenta: {
      findMany: vi.fn(),
    },
    reconciliacionServicio: {
      findMany: vi.fn(),
    },
    reconciliacionGasto: {
      findMany: vi.fn(),
    },
    ajusteBancario: {
      findMany: vi.fn(),
    },
    inyeccionCapital: {
      findMany: vi.fn(),
    },
    pagoDeuda: {
      findMany: vi.fn(),
    },
    transferenciaBancaria: {
      findMany: vi.fn(),
    },
  }
}))

describe('API contabilidad/cuentas/[id]/historial - préstamos cash', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('marca las reconciliaciones de préstamo cash con referencia al préstamo', async () => {
    const prisma = (await import('@/lib/prisma')).prisma as any

    prisma.cuentaBancaria.findUnique.mockResolvedValue({
      cuentaId: 'cuenta-1',
      moneda: 'CUP',
    })
    prisma.reconciliacionVenta.findMany.mockResolvedValue([
      {
        reconciliacionId: 'rec-1',
        fechaReconciliacion: new Date('2024-02-01T00:00:00.000Z'),
        tipoReconciliacion: 'PRESTAMO_CASH',
        prestamoCash: {
          cliente: { nombre: 'Cliente Test' },
        },
        deudaCash: null,
        venta: null,
        observaciones: null,
        moneda: 'CUP',
        monto: '500',
        tasaCambio: null,
        tipoPago: { nombre: 'Efectivo' },
        cuentaBancaria: { nombreBanco: 'Banco A', numeroCuenta: '123', moneda: 'CUP' },
      }
    ])
    prisma.reconciliacionServicio.findMany.mockResolvedValue([])
    prisma.reconciliacionGasto.findMany.mockResolvedValue([])
    prisma.ajusteBancario.findMany.mockResolvedValue([])
    prisma.inyeccionCapital.findMany.mockResolvedValue([])
    prisma.pagoDeuda.findMany.mockResolvedValue([])
    prisma.transferenciaBancaria.findMany.mockResolvedValue([])

    const request = new NextRequest('http://localhost/api/contabilidad/cuentas/cuenta-1/historial')
    const response = await getCuentaHistorialHandler(request, { params: Promise.resolve({ id: 'cuenta-1' }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.transacciones[0].tipoMovimiento).toBe('prestamo_cash_pago')
    expect(body.transacciones[0].descripcion).toContain('Préstamo Cash')
  })
})
