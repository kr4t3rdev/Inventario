import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth-middleware', () => ({
  withAuthPost: (handler: any) => async (request: NextRequest, context: any) =>
    handler(request, context, { userId: 'user-test' })
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    $transaction: vi.fn()
  }
}))

vi.mock('@/lib/services/pago-gastos-workflow', () => ({
  applyPagoGastoWorkflow: vi.fn()
}))

vi.mock('@/lib/services/facturacion-ventas-workflow', () => ({
  reconciliarVentaDirecta: vi.fn()
}))

vi.mock('@/lib/services/anticipos-workflow', () => ({
  executeAnticipo: vi.fn(),
  isAnticipoWorkflowError: vi.fn()
}))

describe('API contabilidad/anticipos/[id]/ejecutar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ejecuta anticipo y retorna 200', async () => {
    const prisma = (await import('@/lib/prisma')).default as any
    const workflow = await import('@/lib/services/anticipos-workflow')

    ;(workflow.executeAnticipo as any).mockResolvedValue({
      anticipoId: 'ant-1',
      estado: 'EJECUTADO',
      saldoDisponible: 0,
      movimientoId: 'mov-1',
      idempotentReplay: false
    })
    ;(workflow.isAnticipoWorkflowError as any).mockReturnValue(false)
    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        compraProducto: { findUnique: vi.fn() },
        factura: { findUnique: vi.fn(), update: vi.fn() }
      })
    )

    const { POST } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/anticipos/ant-1/ejecutar', {
      method: 'POST',
      body: JSON.stringify({
        contexto: 'FACTURA_DIRECTA',
        documentoDestinoId: 'fac-1',
        montoObjetivo: 100,
        monedaObjetivo: 'CUP',
        idempotencyKey: 'idem-1'
      })
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'ant-1' }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.result.anticipoId).toBe('ant-1')
  })

  it('retorna error de validacion con status 400', async () => {
    const { POST } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/anticipos/ant-1/ejecutar', {
      method: 'POST',
      body: JSON.stringify({
        contexto: 'FACTURA_DIRECTA'
      })
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'ant-1' }) })
    expect(response.status).toBe(400)
  })

  it('retorna error de concurrencia con status 409', async () => {
    const prisma = (await import('@/lib/prisma')).default as any
    const workflow = await import('@/lib/services/anticipos-workflow')
    const businessError = Object.assign(new Error('concurrencia'), { status: 409, code: 'CONCURRENCIA' })

    ;(workflow.executeAnticipo as any).mockRejectedValue(businessError)
    ;(workflow.isAnticipoWorkflowError as any).mockImplementation((error: any) => error?.code === 'CONCURRENCIA')
    prisma.$transaction.mockImplementation(async (callback: any) => callback({}))

    const { POST } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/anticipos/ant-1/ejecutar', {
      method: 'POST',
      body: JSON.stringify({
        contexto: 'FACTURA_DIRECTA',
        documentoDestinoId: 'fac-1',
        montoObjetivo: 100,
        monedaObjetivo: 'CUP',
        idempotencyKey: 'idem-2'
      })
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'ant-1' }) })
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe('CONCURRENCIA')
  })

  it('retorna conflicto idempotente con status 409', async () => {
    const prisma = (await import('@/lib/prisma')).default as any
    const workflow = await import('@/lib/services/anticipos-workflow')
    const businessError = Object.assign(new Error('idempotencia'), {
      status: 409,
      code: 'IDEMPOTENCIA_CONFLICTO'
    })

    ;(workflow.executeAnticipo as any).mockRejectedValue(businessError)
    ;(workflow.isAnticipoWorkflowError as any).mockImplementation(
      (error: any) => error?.code === 'IDEMPOTENCIA_CONFLICTO'
    )
    prisma.$transaction.mockImplementation(async (callback: any) => callback({}))

    const { POST } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/anticipos/ant-1/ejecutar', {
      method: 'POST',
      body: JSON.stringify({
        contexto: 'FACTURA_DIRECTA',
        documentoDestinoId: 'fac-1',
        montoObjetivo: 100,
        monedaObjetivo: 'CUP',
        idempotencyKey: 'idem-3'
      })
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'ant-1' }) })
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe('IDEMPOTENCIA_CONFLICTO')
  })

  it('retorna tasa invalida con status 409', async () => {
    const prisma = (await import('@/lib/prisma')).default as any
    const workflow = await import('@/lib/services/anticipos-workflow')
    const businessError = Object.assign(new Error('tasa inválida'), {
      status: 409,
      code: 'TASA_INVALIDA'
    })

    ;(workflow.executeAnticipo as any).mockRejectedValue(businessError)
    ;(workflow.isAnticipoWorkflowError as any).mockImplementation((error: any) => error?.code === 'TASA_INVALIDA')
    prisma.$transaction.mockImplementation(async (callback: any) => callback({}))

    const { POST } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/anticipos/ant-1/ejecutar', {
      method: 'POST',
      body: JSON.stringify({
        contexto: 'FACTURA_DIRECTA',
        documentoDestinoId: 'fac-1',
        montoObjetivo: 100,
        monedaObjetivo: 'USD',
        idempotencyKey: 'idem-4'
      })
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'ant-1' }) })
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe('TASA_INVALIDA')
  })
})
