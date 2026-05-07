import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth-middleware', () => ({
  withAuthGet: (handler: any) => handler,
  withAuthPost: (handler: any) => async (request: NextRequest, context: any) =>
    handler(request, context, { userId: 'user-test' })
}))

vi.mock('@/lib/prisma', () => {
  const prisma = {
    deudaCash: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn()
    },
    cuentaPorPagar: {
      create: vi.fn()
    },
    vendor: {
      findUnique: vi.fn()
    },
    $transaction: vi.fn()
  }
  return { prisma, default: prisma }
})

vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: { log: vi.fn() }
}))

describe('API contabilidad/deudas-cash', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_ENABLE_DEUDAS_CASH', 'true')
  })

  it('GET lista deudas con status 200', async () => {
    const prisma = (await import('@/lib/prisma')).default as any
    const mockDeudas = [
      { id: 'd-1', montoCapital: 2000, estado: 'ACTIVO', proveedor: { vendorId: 'v-1', nombre: 'Vendor Test' } }
    ]
    prisma.deudaCash.findMany.mockResolvedValue(mockDeudas)
    prisma.deudaCash.count.mockResolvedValue(1)

    const { GET } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/deudas-cash')
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.deudas).toHaveLength(1)
    expect(body.pagination.total).toBe(1)
  })

  it('GET filtra por proveedorId', async () => {
    const prisma = (await import('@/lib/prisma')).default as any
    prisma.deudaCash.findMany.mockResolvedValue([])
    prisma.deudaCash.count.mockResolvedValue(0)

    const { GET } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/deudas-cash?proveedorId=v-1')
    await GET(request)

    expect(prisma.deudaCash.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ proveedorId: 'v-1' })
      })
    )
  })

  it('GET devuelve 404 si módulo deshabilitado', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_DEUDAS_CASH', 'false')

    const { GET } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/deudas-cash')
    const response = await GET(request)

    expect(response.status).toBe(404)
  })

  it('POST crea deuda con status 201', async () => {
    const prisma = (await import('@/lib/prisma')).default as any

    prisma.vendor.findUnique.mockResolvedValue({ nombre: 'Vendor Test' })

    const mockCuenta = { cuentaPorPagarId: 'cxp-1' }
    const mockDeuda = {
      id: 'd-new',
      montoCapital: 3000,
      moneda: 'CUP',
      proveedorId: 'v-1',
      proveedor: { vendorId: 'v-1', nombre: 'Vendor Test' },
      cuentaPorPagar: mockCuenta
    }

    prisma.$transaction.mockImplementation(async (callback: any) => {
      const tx = {
        tipoPago: {
          findFirst: vi.fn().mockResolvedValue({ tipoId: 'tp-transferencia', nombre: 'Transferencia' })
        },
        deudaCash: {
          findFirst: vi.fn().mockResolvedValue({ idNumerico: 5 }),
          create: vi.fn().mockResolvedValue(mockDeuda)
        },
        cuentaPorPagar: { create: vi.fn().mockResolvedValue(mockCuenta) },
        cuentaBancaria: { update: vi.fn().mockResolvedValue({}) },
        reconciliacionVenta: { create: vi.fn().mockResolvedValue({ reconciliacionId: 'rec-deuda-1' }) }
      }
      return callback(tx)
    })

    const { POST } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/deudas-cash', {
      method: 'POST',
      body: JSON.stringify({
        proveedorId: 'v-1',
        montoCapital: 3000,
        moneda: 'CUP',
        cuentaBancariaId: 'cb-1'
      })
    })

    const response = await POST(request, {})
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.deuda.id).toBe('d-new')
  })

  it('POST devuelve 404 si proveedor no existe', async () => {
    const prisma = (await import('@/lib/prisma')).default as any
    prisma.vendor.findUnique.mockResolvedValue(null)

    const { POST } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/deudas-cash', {
      method: 'POST',
      body: JSON.stringify({
        proveedorId: 'v-inexistente',
        montoCapital: 1000,
        moneda: 'CUP',
        cuentaBancariaId: 'cb-1'
      })
    })

    const response = await POST(request, {})

    expect(response.status).toBe(404)
  })

  it('POST devuelve 400 con body inválido', async () => {
    const { POST } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/deudas-cash', {
      method: 'POST',
      body: JSON.stringify({ montoCapital: -5 })
    })

    const response = await POST(request, {})

    expect(response.status).toBe(400)
  })
})

describe('API contabilidad/deudas-cash/[id]/pagar', () => {
  const mockContext = { params: Promise.resolve({ id: 'd-1' }) }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_ENABLE_DEUDAS_CASH', 'true')
  })

  it('POST registra pago parcial con status 201', async () => {
    const prisma = (await import('@/lib/prisma')).default as any

    const mockDeuda = {
      id: 'd-1',
      estado: 'ACTIVO',
      moneda: 'CUP',
      cuentaPorPagarId: 'cxp-1',
      cuentaPorPagar: { montoDeuda: 2000, montoPagado: 0, saldoPendiente: 2000 },
      cuentaBancariaId: 'cb-1'
    }
    const mockReconciliacion = { reconciliacionId: 'rec-1' }

    prisma.deudaCash.findFirst.mockResolvedValue(mockDeuda)
    prisma.$transaction.mockImplementation(async (callback: any) => {
      const tx = {
        reconciliacionVenta: { create: vi.fn().mockResolvedValue(mockReconciliacion) },
        cuentaBancaria: { update: vi.fn().mockResolvedValue({}) },
        cuentaPorPagar: { update: vi.fn() },
        deudaCash: { update: vi.fn() }
      }
      return callback(tx)
    })

    const { POST } = await import('../[id]/pagar/route')
    const request = new NextRequest('http://localhost/api/contabilidad/deudas-cash/d-1/pagar', {
      method: 'POST',
      body: JSON.stringify({
        monto: 1000,
        cuentaId: 'cuenta-1',
        tipoPagoId: 'tp-1'
      })
    })

    const response = await POST(request, mockContext)
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.reconciliacion.reconciliacionId).toBe('rec-1')
  })

  it('POST devuelve 404 si deuda no existe', async () => {
    const prisma = (await import('@/lib/prisma')).default as any
    prisma.deudaCash.findFirst.mockResolvedValue(null)

    const { POST } = await import('../[id]/pagar/route')
    const request = new NextRequest('http://localhost/api/contabilidad/deudas-cash/d-1/pagar', {
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

  it('POST devuelve 400 si deuda ya está pagada', async () => {
    const prisma = (await import('@/lib/prisma')).default as any
    prisma.deudaCash.findFirst.mockResolvedValue({
      id: 'd-1',
      estado: 'PAGADO',
      cuentaPorPagar: { montoDeuda: 2000, montoPagado: 2000, saldoPendiente: 0 }
    })

    const { POST } = await import('../[id]/pagar/route')
    const request = new NextRequest('http://localhost/api/contabilidad/deudas-cash/d-1/pagar', {
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
    prisma.deudaCash.findFirst.mockResolvedValue({
      id: 'd-1',
      estado: 'ACTIVO',
      cuentaPorPagar: { montoDeuda: 2000, montoPagado: 1800, saldoPendiente: 200 }
    })

    const { POST } = await import('../[id]/pagar/route')
    const request = new NextRequest('http://localhost/api/contabilidad/deudas-cash/d-1/pagar', {
      method: 'POST',
      body: JSON.stringify({
        monto: 500,
        cuentaId: 'cuenta-1',
        tipoPagoId: 'tp-1'
      })
    })

    const response = await POST(request, mockContext)

    expect(response.status).toBe(400)
  })
})
