import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { GET } from '../route'

const prismaMock = vi.hoisted(() => ({
  cuentaPorCobrar: {
    findMany: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({
  default: prismaMock,
}))

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}))

vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: vi.fn(() => ({
    logAction: vi.fn(),
  })),
}))

describe('Cuentas por Cobrar API - GET', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('debe retornar 401 cuando no hay usuario autenticado', async () => {
    const { authenticateUser } = await import('@/lib/auth-middleware')
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    )

    const request = new NextRequest('http://localhost/api/contabilidad/cuentas-por-cobrar')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('debe calcular totalPagadoFactura y saldoFactura normalizando pagos multi-moneda', async () => {
    const { authenticateUser } = await import('@/lib/auth-middleware')
    
    vi.mocked(authenticateUser).mockResolvedValue({
      user: { userId: 'user-123' }
    } as any)
    
    prismaMock.cuentaPorCobrar.findMany.mockResolvedValue([
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
    const { authenticateUser } = await import('@/lib/auth-middleware')
    
    vi.mocked(authenticateUser).mockResolvedValue({
      user: { userId: 'user-123' }
    } as any)
    
    prismaMock.cuentaPorCobrar.findMany.mockResolvedValue([
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
