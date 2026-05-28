import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth-middleware', () => ({
  withAuthGet: (handler: any) => handler,
  withAuthPost: (handler: any) => async (request: NextRequest, context: any) =>
    handler(request, context, { userId: 'user-test' })
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    prestamoCash: {
      findFirst: vi.fn(),
      update: vi.fn()
    },
    cuentaPorCobrar: {
      update: vi.fn()
    },
    reconciliacionVenta: {
      create: vi.fn()
    },
    $transaction: vi.fn()
  }
}))

vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: { log: vi.fn() }
}))

const mockContext = { params: Promise.resolve({ id: 'p-1' }) }

describe('API contabilidad/prestamos-cash/[id]/pagar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('PERIODO_GUARD_ENABLED', 'false')
    vi.stubEnv('NEXT_PUBLIC_ENABLE_PRESTAMOS_CASH', 'true')
  })

  it('POST registra pago parcial con status 201', async () => {
    const prisma = (await import('@/lib/prisma')).default as any

    const mockPrestamo = {
      id: 'p-1',
      estado: 'ACTIVO',
      moneda: 'CUP',
      cuentaPorCobrarId: 'cxc-1',
      cuentaPorCobrar: { montoDeuda: 1000, montoPagado: 0 }
    }
    const mockReconciliacion = { reconciliacionId: 'rec-1' }

    prisma.prestamoCash.findFirst.mockResolvedValue(mockPrestamo)
    prisma.$transaction.mockImplementation(async (callback: any) => {
      const tx = {
        reconciliacionVenta: { create: vi.fn().mockResolvedValue(mockReconciliacion) },
        cuentaBancaria: { update: vi.fn() },
        cuentaPorCobrar: { update: vi.fn() },
        prestamoCash: { update: vi.fn() }
      }
      return callback(tx)
    })

    const { POST } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/prestamos-cash/p-1/pagar', {
      method: 'POST',
      body: JSON.stringify({
        monto: 500,
        cuentaId: 'cuenta-1',
        tipoPagoId: 'tp-1'
      })
    })

    const response = await POST(request, mockContext)
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.reconciliacion.reconciliacionId).toBe('rec-1')
  })

  it('POST devuelve 404 si préstamo no existe', async () => {
    const prisma = (await import('@/lib/prisma')).default as any
    prisma.prestamoCash.findFirst.mockResolvedValue(null)

    const { POST } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/prestamos-cash/p-1/pagar', {
      method: 'POST',
      body: JSON.stringify({
        monto: 100,
        cuentaId: 'cuenta-1',
        tipoPagoId: 'tp-1'
      })
    })

    const response = await POST(request, mockContext)

    expect(response.status).toBe(404)
  })

  it('POST devuelve 400 si préstamo ya está pagado', async () => {
    const prisma = (await import('@/lib/prisma')).default as any
    prisma.prestamoCash.findFirst.mockResolvedValue({
      id: 'p-1',
      estado: 'PAGADO',
      cuentaPorCobrar: { montoDeuda: 1000, montoPagado: 1000 }
    })

    const { POST } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/prestamos-cash/p-1/pagar', {
      method: 'POST',
      body: JSON.stringify({
        monto: 100,
        cuentaId: 'cuenta-1',
        tipoPagoId: 'tp-1'
      })
    })

    const response = await POST(request, mockContext)

    expect(response.status).toBe(400)
  })

  it('POST devuelve 400 si monto excede saldo', async () => {
    const prisma = (await import('@/lib/prisma')).default as any
    prisma.prestamoCash.findFirst.mockResolvedValue({
      id: 'p-1',
      estado: 'ACTIVO',
      cuentaPorCobrar: { montoDeuda: 1000, montoPagado: 900 }
    })

    const { POST } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/prestamos-cash/p-1/pagar', {
      method: 'POST',
      body: JSON.stringify({
        monto: 200,
        cuentaId: 'cuenta-1',
        tipoPagoId: 'tp-1'
      })
    })

    const response = await POST(request, mockContext)

    expect(response.status).toBe(400)
  })

  it('POST devuelve 404 si módulo deshabilitado', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_PRESTAMOS_CASH', 'false')

    const { POST } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/prestamos-cash/p-1/pagar', {
      method: 'POST',
      body: JSON.stringify({
        monto: 100,
        cuentaId: 'cuenta-1',
        tipoPagoId: 'tp-1'
      })
    })

    const response = await POST(request, mockContext)

    expect(response.status).toBe(404)
  })
})
