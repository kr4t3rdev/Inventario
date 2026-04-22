import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  anticipo: {
    findMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  $transaction: vi.fn(),
}))

const createAnticipoMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth-middleware', () => ({
  withAuthGet: (handler: any) => handler,
  withAuthPost: (handler: any) => handler,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
  default: prismaMock,
}))

vi.mock('@/lib/services/anticipos-workflow', () => ({
  createAnticipo: createAnticipoMock,
  isAnticipoWorkflowError: () => false,
}))

describe('API /anticipos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => Promise<unknown>) =>
      callback(prismaMock)
    )
  })

  it('GET devuelve la lista de anticipos', async () => {
    prismaMock.anticipo.findMany.mockResolvedValue([
      { anticipoId: 'ant-1', tipo: 'PAGO', estado: 'RESERVADO' },
    ])

    const { GET } = await import('../route')
    const request = new NextRequest('http://localhost/api/anticipos')

    const response = await GET(request, {})
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.anticipos).toHaveLength(1)
  })

  it('POST crea un anticipo', async () => {
    createAnticipoMock.mockResolvedValue({ anticipoId: 'ant-1' })

    const { POST } = await import('../route')
    const request = new NextRequest('http://localhost/api/anticipos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tipo: 'PAGO',
        contratoId: 'ctr-1',
        proveedorId: 'prov-1',
        monto: 100,
        moneda: 'CUP',
      }),
    })

    const response = await POST(request, {}, { userId: 'user-1' })
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.anticipo.anticipoId).toBe('ant-1')
  })

  it('POST acepta el payload del formulario con monto y fecha como strings', async () => {
    createAnticipoMock.mockResolvedValue({ anticipoId: 'ant-2' })

    const { POST } = await import('../route')
    const request = new NextRequest('http://localhost/api/anticipos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tipo: 'COBRO',
        contratoId: 'ctr-2',
        clienteId: 'cli-1',
        monto: '250.50',
        moneda: 'USD',
        cuentaOrigenId: 'cta-1',
        tipoPagoOrigenId: 'tp-1',
        vigenciaHasta: '2026-12-31',
      }),
    })

    const response = await POST(request, {}, { userId: 'user-1' })
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.anticipo.anticipoId).toBe('ant-2')
    expect(createAnticipoMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tipo: 'COBRO',
        monto: 250.5,
        vigenciaHasta: '2026-12-31',
      }),
    )
  })
})
