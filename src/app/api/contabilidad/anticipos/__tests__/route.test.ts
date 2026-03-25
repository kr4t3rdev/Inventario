import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth-middleware', () => ({
  withAuthGet: (handler: any) => handler,
  withAuthPost: (handler: any) => async (request: NextRequest, context: any) =>
    handler(request, context, { userId: 'user-test' })
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    anticipo: {
      findMany: vi.fn()
    },
    $transaction: vi.fn()
  }
}))

vi.mock('@/lib/services/anticipos-workflow', () => ({
  createAnticipo: vi.fn(),
  isAnticipoWorkflowError: vi.fn()
}))

describe('API contabilidad/anticipos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET lista anticipos con status 200', async () => {
    const prisma = (await import('@/lib/prisma')).default as any
    prisma.anticipo.findMany.mockResolvedValue([{ anticipoId: 'ant-1' }])

    const { GET } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/anticipos?tipo=PAGO')
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.anticipos).toHaveLength(1)
    expect(prisma.anticipo.findMany).toHaveBeenCalled()
  })

  it('POST crea anticipo con status 201', async () => {
    const prisma = (await import('@/lib/prisma')).default as any
    const workflow = await import('@/lib/services/anticipos-workflow')

    ;(workflow.createAnticipo as any).mockResolvedValue({ anticipoId: 'ant-new' })
    ;(workflow.isAnticipoWorkflowError as any).mockReturnValue(false)
    prisma.$transaction.mockImplementation(async (callback: any) => callback({}))

    const { POST } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/anticipos', {
      method: 'POST',
      body: JSON.stringify({
        tipo: 'PAGO',
        contratoId: 'c-1',
        proveedorId: 'v-1',
        monto: 100,
        moneda: 'CUP'
      })
    })

    const response = await POST(request, {})
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.anticipo.anticipoId).toBe('ant-new')
  })

  it('POST devuelve status del error de negocio', async () => {
    const prisma = (await import('@/lib/prisma')).default as any
    const workflow = await import('@/lib/services/anticipos-workflow')

    const businessError = Object.assign(new Error('conflicto'), { status: 409, code: 'CONCURRENCIA' })
    ;(workflow.createAnticipo as any).mockRejectedValue(businessError)
    ;(workflow.isAnticipoWorkflowError as any).mockImplementation((error: any) => error?.code === 'CONCURRENCIA')
    prisma.$transaction.mockImplementation(async (callback: any) => callback({}))

    const { POST } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/anticipos', {
      method: 'POST',
      body: JSON.stringify({
        tipo: 'PAGO',
        contratoId: 'c-1',
        proveedorId: 'v-1',
        monto: 100,
        moneda: 'CUP'
      })
    })

    const response = await POST(request, {})
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe('CONCURRENCIA')
  })
})
