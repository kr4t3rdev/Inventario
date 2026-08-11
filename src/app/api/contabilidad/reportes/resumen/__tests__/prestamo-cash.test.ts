import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { authenticateUser } from '@/lib/auth-middleware'

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
  authenticateUser: vi.fn().mockResolvedValue({
    user: {
      userId: 'user-test',
      role: 'user',
      tenantId: 'tenant-test',
      planFeatures: {
        contabilidad: true,
        'reportes-financieros': true,
        'prestamos-cash': true,
        'deudas-cash': true,
        servicios: true,
        'inyeccion-capital': true,
      },
    },
  }),
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

  it('excluye servicios, transferencias, ajustes e inyecciones en Básico', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({
      user: {
        userId: 'user-test',
        role: 'user',
        planName: 'Básico',
        tenantId: 'tenant-test',
        planFeatures: {
          contabilidad: true,
          'reportes-financieros': true,
          servicios: false,
          'inyeccion-capital': false,
          'prestamos-cash': false,
          'deudas-cash': false,
        },
      },
    } as never)

    const prisma = (await import('@/lib/prisma')).prisma as any
    prisma.cuentaBancaria.findMany.mockResolvedValue([
      { cuentaId: 'cb-1', nombreBanco: 'Banco A', numeroCuenta: '123', moneda: 'CUP', saldo: 1000, tipoCuenta: 'corriente' }
    ])
    prisma.reconciliacionVenta.findMany.mockResolvedValue([
      {
        monto: '100',
        moneda: 'CUP',
        tipoReconciliacion: 'venta',
        cuentaBancaria: { nombreBanco: 'Banco A', numeroCuenta: '123', moneda: 'CUP' },
      }
    ])
    prisma.reconciliacionServicio.findMany.mockResolvedValue([
      {
        monto: '75',
        moneda: 'CUP',
        fechaReconciliacion: new Date('2024-02-01T00:00:00.000Z'),
        cuentaBancaria: { nombreBanco: 'Banco A', numeroCuenta: '123' },
      }
    ])
    prisma.reconciliacionGasto.findMany.mockResolvedValue([])
    prisma.transferenciaBancaria.findMany.mockResolvedValue([
      {
        montoOrigen: '50',
        monedaOrigen: 'CUP',
        montoDestino: '50',
        monedaDestino: 'CUP',
        fechaTransferencia: new Date('2024-02-01T00:00:00.000Z'),
        cuentaOrigen: { nombreBanco: 'Banco A', numeroCuenta: '123' },
        cuentaDestino: { nombreBanco: 'Banco B', numeroCuenta: '456' },
      }
    ])
    prisma.ajusteBancario.findMany.mockResolvedValue([
      {
        tipo: 'ingreso',
        monto: '25',
        moneda: 'CUP',
        montoConvertido: '25',
        descripcion: 'Ajuste',
        createdAt: new Date('2024-02-01T00:00:00.000Z'),
        cuentaBancaria: { nombreBanco: 'Banco A', numeroCuenta: '123' },
      }
    ])
    prisma.inyeccionCapital.findMany.mockResolvedValue([
      {
        tipo: 'CAPITAL_SOCIAL',
        montoRecibido: '300',
        moneda: 'CUP',
        cuentaBancaria: { nombreBanco: 'Banco A', numeroCuenta: '123' },
      }
    ])
    prisma.pagoDeuda.findMany.mockResolvedValue([
      {
        montoPagado: '40',
        cuentaBancaria: { moneda: 'CUP' },
      }
    ])

    const { GET } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/reportes/resumen')
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.estadisticas.totalTransferencias).toBe(0)
    expect(body.estadisticas.totalAjustes).toBe(0)
    expect(body.estadisticas.totalInyecciones).toBe(0)
    expect(body.resumenPorMoneda[0].desglose.ingresos.servicios).toBe(0)
    expect(body.resumenPorMoneda[0].desglose.ingresos.ajustes).toBe(0)
    expect(body.resumenPorMoneda[0].desglose.ingresos.inyecciones).toEqual([])
  })
})
