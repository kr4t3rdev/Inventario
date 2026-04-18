import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    $transaction: vi.fn()
  }
}))

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn()
}))

vi.mock('@/lib/services/pago-gastos-workflow', () => ({
  applyPagoGastoWorkflow: vi.fn(),
  isGastoWorkflowError: vi.fn((error: unknown) => {
    const candidate = error as { status?: unknown; code?: unknown } | null
    return Boolean(
      candidate &&
      typeof candidate === 'object' &&
      typeof candidate.status === 'number' &&
      typeof candidate.code === 'string'
    )
  })
}))

describe('Cuentas por pagar API - pagar POST', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('responde 401 si no hay usuario autenticado', async () => {
    const { POST } = await import('../route')
    const { authenticateUser } = await import('@/lib/auth-middleware')
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) as any
    )

    const request = new NextRequest('http://localhost/api/contabilidad/cuentas-por-pagar/pagar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        numeroFactura: 'FAC-1',
        tipo: 'compra',
        monto: 10,
        numeroTransaccion: 'TRX-1',
        cuentaProveedor: '123'
      })
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('responde 404 cuando factura de compra no existe para crear CxP', async () => {
    const { POST } = await import('../route')
    const prisma = (await import('@/lib/prisma')).default as any
    const { authenticateUser } = await import('@/lib/auth-middleware')

    vi.mocked(authenticateUser).mockResolvedValue({ user: { userId: 'user-1' } } as any)

    prisma.$transaction.mockImplementation(async (callback: any) => {
      const tx = {
        cuentaPorPagar: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn(),
          findUnique: vi.fn()
        },
        gastoCompra: {
          findFirst: vi.fn().mockResolvedValue(null)
        },
        gastosDE: {
          findFirst: vi.fn()
        },
        pagoCuentaPorPagar: {
          findUnique: vi.fn()
        }
      }
      return callback(tx)
    })

    const request = new NextRequest('http://localhost/api/contabilidad/cuentas-por-pagar/pagar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        numeroFactura: 'FAC-404',
        tipo: 'compra',
        monto: 10,
        numeroTransaccion: 'TRX-2',
        cuentaProveedor: '123'
      })
    })

    const response = await POST(request)
    const data = await response.json()
    expect(response.status).toBe(404)
    expect(data.error).toBe('Compra no encontrada')
  })

  it('mapea errores de negocio del workflow con status/code', async () => {
    const { POST } = await import('../route')
    const prisma = (await import('@/lib/prisma')).default as any
    const { authenticateUser } = await import('@/lib/auth-middleware')
    const { applyPagoGastoWorkflow } = await import('@/lib/services/pago-gastos-workflow')

    vi.mocked(authenticateUser).mockResolvedValue({ user: { userId: 'user-1' } } as any)

    prisma.$transaction.mockImplementation(async (callback: any) => {
      const tx = {
        cuentaPorPagar: {
          findFirst: vi.fn().mockResolvedValue({
            cuentaPorPagarId: 'cxp-1',
            numeroFactura: 'FAC-1',
            tipo: 'compra',
            gastoCompraId: 'gc-1',
            gastosDEId: null,
            moneda: 'CUP'
          }),
          create: vi.fn(),
          findUnique: vi.fn()
        },
        gastoCompra: {
          findFirst: vi.fn()
        },
        gastosDE: {
          findFirst: vi.fn()
        },
        pagoCuentaPorPagar: {
          findUnique: vi.fn()
        }
      }
      return callback(tx)
    })

    vi.mocked(applyPagoGastoWorkflow as any).mockRejectedValue({
      message: 'El monto no puede exceder el saldo pendiente',
      status: 400,
      code: 'MONTO_EXCEDE_SALDO'
    })

    const request = new NextRequest('http://localhost/api/contabilidad/cuentas-por-pagar/pagar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        numeroFactura: 'FAC-1',
        tipo: 'compra',
        monto: 5000,
        numeroTransaccion: 'TRX-3',
        cuentaProveedor: '123'
      })
    })

    const response = await POST(request)
    const data = await response.json()
    expect(response.status).toBe(400)
    expect(data.code).toBe('MONTO_EXCEDE_SALDO')
  })

  it('retorna cuenta y pago cuando el workflow se aplica correctamente', async () => {
    const { POST } = await import('../route')
    const prisma = (await import('@/lib/prisma')).default as any
    const { authenticateUser } = await import('@/lib/auth-middleware')
    const { applyPagoGastoWorkflow } = await import('@/lib/services/pago-gastos-workflow')

    vi.mocked(authenticateUser).mockResolvedValue({ user: { userId: 'user-9' } } as any)

    const cuentaFindFirst = vi.fn().mockResolvedValue({
      cuentaPorPagarId: 'cxp-9',
      numeroFactura: 'FAC-9',
      tipo: 'servicio',
      gastoCompraId: null,
      gastosDEId: 'gde-9',
      moneda: 'CUP'
    })
    const cuentaFindUnique = vi.fn().mockResolvedValue({
      cuentaPorPagarId: 'cxp-9',
      numeroFactura: 'FAC-9',
      tipo: 'servicio',
      estado: 'PAGADA'
    })
    const pagoFindUnique = vi.fn().mockResolvedValue({
      pagoCuentaPorPagarId: 'pago-9',
      cuentaPorPagarId: 'cxp-9',
      numeroTransaccion: 'TRX-9',
      monto: 100
    })

    prisma.$transaction.mockImplementation(async (callback: any) => {
      const tx = {
        cuentaPorPagar: {
          findFirst: cuentaFindFirst,
          create: vi.fn(),
          findUnique: cuentaFindUnique
        },
        gastoCompra: {
          findFirst: vi.fn()
        },
        gastosDE: {
          findFirst: vi.fn()
        },
        pagoCuentaPorPagar: {
          findUnique: pagoFindUnique
        }
      }
      return callback(tx)
    })

    vi.mocked(applyPagoGastoWorkflow as any).mockResolvedValue({
      reconciliaciones: [
        {
          reconciliacionId: 'rec-9',
          cuentaId: 'cb-1',
          monto: 100,
          moneda: 'CUP',
          montoConvertido: 100,
          descripcion: 'Pago FAC-9'
        }
      ],
      cuentaPorPagar: {
        cuentaPorPagarId: 'cxp-9',
        estado: 'PAGADA',
        montoPagado: 100,
        saldoPendiente: 0
      },
      pagoCuentaPorPagar: {
        pagoCuentaPorPagarId: 'pago-9',
        numeroTransaccion: 'TRX-9',
        monto: 100
      }
    })

    const request = new NextRequest('http://localhost/api/contabilidad/cuentas-por-pagar/pagar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        numeroFactura: 'FAC-9',
        tipo: 'servicio',
        monto: 100,
        numeroTransaccion: 'TRX-9',
        cuentaProveedor: '123'
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.cuenta.cuentaPorPagarId).toBe('cxp-9')
    expect(data.pago.pagoCuentaPorPagarId).toBe('pago-9')
    expect(applyPagoGastoWorkflow).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        cuentaPorPagarId: 'cxp-9',
        referenciaId: 'gde-9',
        tipoGasto: 'gastoDE'
      })
    )
  })
})
