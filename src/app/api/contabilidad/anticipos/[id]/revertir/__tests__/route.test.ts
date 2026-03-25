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

vi.mock('@/lib/services/anticipos-workflow', () => ({
  reverseAnticipo: vi.fn(),
  isAnticipoWorkflowError: vi.fn()
}))

describe('API contabilidad/anticipos/[id]/revertir', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('revierte anticipo y retorna 200', async () => {
    const prisma = (await import('@/lib/prisma')).default as any
    const workflow = await import('@/lib/services/anticipos-workflow')

    ;(workflow.reverseAnticipo as any).mockResolvedValue({
      anticipoId: 'ant-1',
      estado: 'RESERVADO',
      saldoDisponible: 100,
      movimientoId: 'mov-r-1'
    })
    ;(workflow.isAnticipoWorkflowError as any).mockReturnValue(false)
    prisma.$transaction.mockImplementation(async (callback: any) => callback({}))

    const { POST } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/anticipos/ant-1/revertir', {
      method: 'POST',
      body: JSON.stringify({
        documentoDestinoId: 'fac-1',
        montoReverso: 100
      })
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'ant-1' }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.result.estado).toBe('RESERVADO')
  })

  it('retorna error de negocio en reverso', async () => {
    const prisma = (await import('@/lib/prisma')).default as any
    const workflow = await import('@/lib/services/anticipos-workflow')
    const businessError = Object.assign(new Error('anulado'), { status: 409, code: 'ANTICIPO_ANULADO' })

    ;(workflow.reverseAnticipo as any).mockRejectedValue(businessError)
    ;(workflow.isAnticipoWorkflowError as any).mockImplementation((error: any) => error?.code === 'ANTICIPO_ANULADO')
    prisma.$transaction.mockImplementation(async (callback: any) => callback({}))

    const { POST } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/anticipos/ant-1/revertir', {
      method: 'POST',
      body: JSON.stringify({
        documentoDestinoId: 'fac-1',
        montoReverso: 100
      })
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'ant-1' }) })
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe('ANTICIPO_ANULADO')
  })
})
