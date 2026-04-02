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
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn()
    },
    cuentaPorCobrar: {
      create: vi.fn()
    },
    $transaction: vi.fn()
  }
}))

vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: { log: vi.fn() }
}))

describe('API contabilidad/prestamos-cash', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_ENABLE_PRESTAMOS_CASH', 'true')
  })

  it('GET lista préstamos con status 200', async () => {
    const prisma = (await import('@/lib/prisma')).default as any
    const mockPrestamos = [
      { id: 'p-1', montoCapital: 1000, estado: 'ACTIVO', cliente: { clienteId: 'c-1', nombre: 'Test' } }
    ]
    prisma.prestamoCash.findMany.mockResolvedValue(mockPrestamos)
    prisma.prestamoCash.count.mockResolvedValue(1)

    const { GET } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/prestamos-cash')
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.prestamos).toHaveLength(1)
    expect(body.pagination.total).toBe(1)
  })

  it('GET filtra por estado', async () => {
    const prisma = (await import('@/lib/prisma')).default as any
    prisma.prestamoCash.findMany.mockResolvedValue([])
    prisma.prestamoCash.count.mockResolvedValue(0)

    const { GET } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/prestamos-cash?estado=ACTIVO')
    await GET(request)

    expect(prisma.prestamoCash.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ estado: 'ACTIVO' })
      })
    )
  })

  it('GET devuelve 404 si módulo deshabilitado', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_PRESTAMOS_CASH', 'false')

    const { GET } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/prestamos-cash')
    const response = await GET(request)

    expect(response.status).toBe(404)
  })

  it('POST crea préstamo con status 201', async () => {
    const prisma = (await import('@/lib/prisma')).default as any

    const mockCuenta = { id: 'cxc-1' }
    const mockPrestamo = {
      id: 'p-new',
      montoCapital: 500,
      moneda: 'CUP',
      clienteId: 'c-1',
      cliente: { clienteId: 'c-1', nombre: 'Test' },
      cuentaPorCobrar: mockCuenta
    }

    prisma.$transaction.mockImplementation(async (callback: any) => {
      const tx = {
        cuentaPorCobrar: { create: vi.fn().mockResolvedValue(mockCuenta) },
        prestamoCash: { create: vi.fn().mockResolvedValue(mockPrestamo) }
      }
      return callback(tx)
    })

    const { POST } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/prestamos-cash', {
      method: 'POST',
      body: JSON.stringify({
        clienteId: 'c-1',
        montoCapital: 500,
        moneda: 'CUP'
      })
    })

    const response = await POST(request, {})
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.prestamo.id).toBe('p-new')
  })

  it('POST devuelve 400 con body inválido', async () => {
    const { POST } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/prestamos-cash', {
      method: 'POST',
      body: JSON.stringify({ montoCapital: -10 })
    })

    const response = await POST(request, {})

    expect(response.status).toBe(400)
  })
})
