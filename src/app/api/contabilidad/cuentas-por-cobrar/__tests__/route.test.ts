import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '../route'

vi.mock('@/lib/prisma', () => ({
  default: {
    cuentaPorCobrar: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth-utils', () => ({
  verify_token: vi.fn(),
}))

describe('Cuentas por Cobrar API - GET', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('debe retornar 401 cuando no hay usuario autenticado', async () => {
    const { verify_token } = await import('@/lib/auth-utils')
    vi.mocked(verify_token).mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/contabilidad/cuentas-por-cobrar')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('debe calcular totalPagadoFactura y saldoFactura normalizando pagos multi-moneda', async () => {
    const { verify_token } = await import('@/lib/auth-utils')
    const prisma = (await import('@/lib/prisma')).default

    vi.mocked(verify_token).mockResolvedValue({ userId: 'user-123' } as any)
    vi.mocked(prisma.cuentaPorCobrar.findMany).mockResolvedValue([
      {
        id: 'cxc-1',
        facturaId: 'fac-1',
        numeroFactura: 'SD-100',
        clienteId: 'cli-1',
        montoDeuda: 1000,
        montoPagado: 0,
        estado: 'PENDIENTE',
        idTransferencia: null,
        fechaVencimiento: null,
        createdAt: new Date('2026-02-14T10:00:00.000Z'),
        updatedAt: new Date('2026-02-14T10:00:00.000Z'),
        cliente: { clienteId: 'cli-1', nombre: 'Cliente Demo' },
        factura: {
          idFactura: 'fac-1',
          numeroFactura: 'SD-100',
          total: 1000,
          venta: {
            total: 1000,
            reconciliaciones: [
              {
                monto: 2,
                moneda: 'USD',
                tasaCambio: 100,
                fechaReconciliacion: new Date('2026-02-14T09:00:00.000Z'),
              },
              {
                monto: 100,
                moneda: 'CUP',
                tasaCambio: null,
                fechaReconciliacion: new Date('2026-02-14T09:30:00.000Z'),
              },
            ],
          },
        },
      } as any,
    ])

    const request = new NextRequest('http://localhost/api/contabilidad/cuentas-por-cobrar')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.cuentas).toHaveLength(1)
    expect(data.cuentas[0].totalPagadoFactura).toBe(300)
    expect(data.cuentas[0].saldoFactura).toBe(700)
  })

  it('debe calcular saldo usando montoDeuda cuando no existe factura relacionada', async () => {
    const { verify_token } = await import('@/lib/auth-utils')
    const prisma = (await import('@/lib/prisma')).default

    vi.mocked(verify_token).mockResolvedValue({ userId: 'user-123' } as any)
    vi.mocked(prisma.cuentaPorCobrar.findMany).mockResolvedValue([
      {
        id: 'cxc-2',
        facturaId: null,
        numeroFactura: 'MANUAL-1',
        clienteId: 'cli-2',
        montoDeuda: 800,
        montoPagado: 200,
        estado: 'PARCIAL',
        idTransferencia: null,
        fechaVencimiento: null,
        createdAt: new Date('2026-02-14T10:00:00.000Z'),
        updatedAt: new Date('2026-02-14T10:00:00.000Z'),
        cliente: { clienteId: 'cli-2', nombre: 'Cliente Manual' },
        factura: null,
      } as any,
    ])

    const request = new NextRequest('http://localhost/api/contabilidad/cuentas-por-cobrar')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.cuentas).toHaveLength(1)
    expect(data.cuentas[0].totalFactura).toBe(800)
    expect(data.cuentas[0].totalPagadoFactura).toBe(200)
    expect(data.cuentas[0].saldoFactura).toBe(600)
  })
})
