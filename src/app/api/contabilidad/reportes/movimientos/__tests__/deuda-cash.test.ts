import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { authenticateUser } from '@/lib/auth-middleware'

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn().mockResolvedValue({
    user: {
      userId: 'user-test',
      tenantId: 'tenant-test',
      role: 'user',
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

  it('oculta servicios, transferencias, ajustes e inyecciones en Básico', async () => {
    vi.mocked(authenticateUser).mockResolvedValue({
      user: {
        userId: 'user-test',
        tenantId: 'tenant-test',
        role: 'user',
        planName: 'Básico',
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
    prisma.reconciliacionVenta.findMany.mockResolvedValue([
      {
        reconciliacionId: 'rec-venta',
        monto: '100',
        moneda: 'CUP',
        montoConvertido: '100',
        tasaCambio: null,
        fechaReconciliacion: new Date('2024-02-01T00:00:00.000Z'),
        observaciones: 'Venta normal',
        reconciliadoPor: 'user-test',
        tipoReconciliacion: 'venta',
        venta: { ventaId: 'v-1', total: '100', createdAt: new Date('2024-02-01T00:00:00.000Z') },
        prestamoCash: null,
        deudaCash: null,
        cuentaBancaria: { nombreBanco: 'Banco A', numeroCuenta: '123' },
        tipoPago: { nombre: 'Efectivo' },
      }
    ])
    prisma.reconciliacionServicio.findMany.mockResolvedValue([
      {
        reconciliacionId: 'rec-servicio',
        monto: '75',
        moneda: 'CUP',
        fechaReconciliacion: new Date('2024-02-01T00:00:00.000Z'),
        observaciones: 'Servicio',
        reconciliadoPor: 'user-test',
        ventasServicio: { ventaServicioId: 'vs-1' },
        cuentaBancaria: { nombreBanco: 'Banco A', numeroCuenta: '123' },
        tipoPago: { nombre: 'Transferencia' },
      }
    ])
    prisma.reconciliacionGasto.findMany.mockResolvedValue([])
    prisma.transferenciaBancaria.findMany.mockResolvedValue([
      {
        transferenciaId: 'tr-1',
        numeroComprobante: 'cmp-1',
        montoOrigen: '50',
        monedaOrigen: 'CUP',
        montoDestino: '50',
        monedaDestino: 'CUP',
        tasaCambio: null,
        motivo: 'Interna',
        descripcion: 'Transferencia',
        fechaTransferencia: new Date('2024-02-01T00:00:00.000Z'),
        cuentaOrigen: { nombreBanco: 'Banco A', numeroCuenta: '123' },
        cuentaDestino: { nombreBanco: 'Banco B', numeroCuenta: '456' },
      }
    ])
    prisma.ajusteBancario.findMany.mockResolvedValue([
      {
        ajusteId: 'aj-1',
        tipo: 'ingreso',
        monto: '25',
        moneda: 'CUP',
        montoConvertido: '25',
        tasaCambio: null,
        descripcion: 'Ajuste',
        motivo: 'Corrección',
        realizadoPor: 'user-test',
        createdAt: new Date('2024-02-01T00:00:00.000Z'),
        cuentaBancaria: { nombreBanco: 'Banco A', numeroCuenta: '123' },
      }
    ])
    prisma.inyeccionCapital.findMany.mockResolvedValue([
      {
        id: 'iny-1',
        tipo: 'CAPITAL_SOCIAL',
        montoRecibido: '300',
        moneda: 'CUP',
        descripcion: 'Capital',
        socio: 'Socio A',
        entidadPrestamista: null,
        createdAt: new Date('2024-02-01T00:00:00.000Z'),
        cuentaBancaria: { nombreBanco: 'Banco A', numeroCuenta: '123' },
      }
    ])
    prisma.pagoDeuda.findMany.mockResolvedValue([
      {
        id: 'pd-1',
        montoPagado: '40',
        fechaPago: new Date('2024-02-01T00:00:00.000Z'),
        comprobante: 'pd-1',
        observaciones: 'Pago deuda',
        cuentaBancaria: { nombreBanco: 'Banco A', numeroCuenta: '123', moneda: 'CUP' },
        inyeccion: { entidadPrestamista: 'Prestamista', tipo: 'DEUDA_EXTERNA' },
      }
    ])

    const { GET } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/reportes/movimientos')
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.map((mov: any) => mov.tipo)).toEqual(['venta'])
  })
})
