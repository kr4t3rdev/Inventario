import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    cuentaBancaria: { findMany: vi.fn() },
    reconciliacionVenta: { findMany: vi.fn() },
    reconciliacionServicio: { findMany: vi.fn() },
    reconciliacionGasto: { findMany: vi.fn() },
    transferenciaBancaria: { findMany: vi.fn() },
    ajusteBancario: { findMany: vi.fn() },
    inyeccionCapital: { findMany: vi.fn() },
    pagoDeuda: { findMany: vi.fn() },
  }
}))

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn().mockResolvedValue({ user: { userId: 'user-test' } }),
}))

describe('API contabilidad/reportes/resumen - préstamos cash', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('no cuenta el desembolso de préstamo cash como ingreso', async () => {
    const prisma = (await import('@/lib/prisma')).prisma as any
    prisma.cuentaBancaria.findMany.mockResolvedValue([
      { cuentaId: 'cb-1', moneda: 'CUP', saldo: 1000 }
    ])
    prisma.reconciliacionVenta.findMany.mockResolvedValue([
      {
        monto: '500',
        moneda: 'CUP',
        tipoReconciliacion: 'PRESTAMO_CASH_DESEMBOLSO',
        cuentaBancaria: { nombreBanco: 'Banco A', numeroCuenta: '123' },
      }
    ])
    prisma.reconciliacionServicio.findMany.mockResolvedValue([])
    prisma.reconciliacionGasto.findMany.mockResolvedValue([])
    prisma.transferenciaBancaria.findMany.mockResolvedValue([])
    prisma.ajusteBancario.findMany.mockResolvedValue([])
    prisma.inyeccionCapital.findMany.mockResolvedValue([])
    prisma.pagoDeuda.findMany.mockResolvedValue([])

    const { GET } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/reportes/resumen')
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.resumenPorMoneda[0].totalIngresos).toBe(0)
  })
})
