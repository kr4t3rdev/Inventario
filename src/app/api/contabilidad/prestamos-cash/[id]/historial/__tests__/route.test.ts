import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth-middleware', () => ({
  withAuthGet: (handler: any) => (request: any, context: any) =>
    handler(request, context, { userId: 'user-1', tenantId: 'tenant-1', role: 'admin' }),
}))

vi.mock('@/lib/services/tenant-scope', () => ({
  requireTenant: vi.fn(() => 'tenant-1'),
  requirePermission: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    prestamoCash: {
      findFirst: vi.fn(),
    },
    reconciliacionVenta: {
      findMany: vi.fn(),
    },
  }
}))

describe('API contabilidad/prestamos-cash/[id]/historial', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_ENABLE_PRESTAMOS_CASH', 'true')
  })

  it('GET devuelve 404 si préstamo no existe', async () => {
    const prisma = (await import('@/lib/prisma')).default as any
    prisma.prestamoCash.findFirst.mockResolvedValue(null)

    const { GET } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/prestamos-cash/p-1/historial')
    const response = await GET(request, { params: Promise.resolve({ id: 'p-1' }) })

    expect(response.status).toBe(404)
  })

  it('GET retorna historial con resumen de saldo', async () => {
    const prisma = (await import('@/lib/prisma')).default as any

    prisma.prestamoCash.findFirst.mockResolvedValue({
      id: 'p-1',
      idNumerico: 10,
      clienteId: 'c-1',
      cuentaPorCobrarId: 'cxc-1',
      montoCapital: '1000',
      moneda: 'CUP',
      tasaInteres: '10',
      fechaOtorgamiento: new Date('2024-01-01T00:00:00.000Z'),
      fechaVencimiento: new Date('2024-03-01T00:00:00.000Z'),
      estado: 'ACTIVO',
      observaciones: null,
      createdById: 'u-1',
      deletedAt: null,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      cliente: { clienteId: 'c-1', nombre: 'Cliente Test' },
      cuentaPorCobrar: {
        id: 'cxc-1',
        montoDeuda: '1200',
        montoPagado: '500',
        estado: 'PARCIAL',
        fechaVencimiento: new Date('2024-03-01T00:00:00.000Z'),
      }
    })

    prisma.reconciliacionVenta.findMany.mockResolvedValue([
      {
        reconciliacionId: 'rec-1',
        monto: '500',
        moneda: 'CUP',
        tasaCambio: null,
        fechaReconciliacion: new Date('2024-02-01T00:00:00.000Z'),
        observaciones: 'Pago parcial',
        reconciliadoPor: 'u-1',
        tipoReconciliacion: 'PRESTAMO_CASH',
        cuentaBancaria: { nombreBanco: 'Banco A', numeroCuenta: '123' },
        tipoPago: { nombre: 'Efectivo' },
      }
    ])

    const { GET } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/prestamos-cash/p-1/historial')
    const response = await GET(request, { params: Promise.resolve({ id: 'p-1' }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.prestamo.id).toBe('p-1')
    expect(body.resumen.saldoPendiente).toBe(700)
    expect(body.historial).toHaveLength(1)
  })
})
