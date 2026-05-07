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

describe('API contabilidad/reportes/movimientos - préstamos cash', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('incluye préstamo cash con referencia y detalles', async () => {
    const prisma = (await import('@/lib/prisma')).prisma as any
    prisma.reconciliacionVenta.findMany.mockResolvedValue([
      {
        reconciliacionId: 'rec-1',
        monto: '500',
        moneda: 'CUP',
        montoConvertido: '500',
        tasaCambio: null,
        fechaReconciliacion: new Date('2024-02-01T00:00:00.000Z'),
        observaciones: 'Pago préstamo',
        reconciliadoPor: 'user-test',
        tipoReconciliacion: 'PRESTAMO_CASH',
        venta: null,
        prestamoCash: { id: 'prestamo-1', cliente: { nombre: 'Cliente Test' } },
        deudaCash: null,
        cuentaBancaria: { nombreBanco: 'Banco A', numeroCuenta: '123' },
        tipoPago: { nombre: 'Efectivo' },
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
    expect(body.data[0].tipo).toBe('prestamo_cash_pago')
    expect(body.data[0].referencia).toBe('prestamo-1')
    expect(body.data[0].detalles.tipoReconciliacion).toBe('PRESTAMO_CASH')
  })

  it('incluye desembolso de préstamo cash como movimiento diferenciado', async () => {
    const prisma = (await import('@/lib/prisma')).prisma as any
    prisma.reconciliacionVenta.findMany.mockResolvedValue([
      {
        reconciliacionId: 'rec-2',
        monto: '500',
        moneda: 'CUP',
        montoConvertido: '500',
        tasaCambio: null,
        fechaReconciliacion: new Date('2024-02-01T00:00:00.000Z'),
        observaciones: 'Desembolso préstamo',
        reconciliadoPor: 'user-test',
        tipoReconciliacion: 'PRESTAMO_CASH_DESEMBOLSO',
        venta: null,
        prestamoCash: { id: 'prestamo-2', cliente: { nombre: 'Cliente Test' } },
        deudaCash: null,
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
    expect(body.data[0].tipo).toBe('prestamo_cash_desembolso')
    expect(body.data[0].referencia).toBe('prestamo-2')
    expect(body.data[0].detalles.tipoReconciliacion).toBe('PRESTAMO_CASH_DESEMBOLSO')
  })

  it('mantiene el cobro de préstamo cash como salida de recuperación', async () => {
    const prisma = (await import('@/lib/prisma')).prisma as any
    prisma.reconciliacionVenta.findMany.mockResolvedValue([
      {
        reconciliacionId: 'rec-3',
        monto: '100',
        moneda: 'CUP',
        montoConvertido: '100',
        tasaCambio: null,
        fechaReconciliacion: new Date('2024-02-01T00:00:00.000Z'),
        observaciones: 'Cobro préstamo',
        reconciliadoPor: 'user-test',
        tipoReconciliacion: 'PRESTAMO_CASH',
        venta: null,
        prestamoCash: { id: 'prestamo-3', cliente: { nombre: 'Cliente Test' } },
        deudaCash: null,
        cuentaBancaria: { nombreBanco: 'Banco A', numeroCuenta: '123' },
        tipoPago: { nombre: 'Efectivo' },
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
    expect(body.data[0].tipo).toBe('prestamo_cash_pago')
    expect(body.data[0].detalles.tipoReconciliacion).toBe('PRESTAMO_CASH')
  })
})
