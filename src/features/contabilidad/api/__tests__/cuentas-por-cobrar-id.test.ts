import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { updateCuentaPorCobrarHandler } from '@/features/contabilidad/api/handlers'

vi.mock('@/lib/prisma', () => ({
  default: {
    cuentaPorCobrar: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}))

vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: {
    log: vi.fn().mockResolvedValue(null),
  },
}))

describe('Cuentas por Cobrar API - PATCH [id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('debe retornar 401 cuando no hay usuario autenticado', async () => {
    const { authenticateUser } = await import('@/lib/auth-middleware')
    vi.mocked(authenticateUser).mockResolvedValue(
      Response.json({ error: 'Unauthorized' }, { status: 401 }) as unknown as never
    )

    const request = new NextRequest('http://localhost/api/contabilidad/cuentas-por-cobrar/cxc-1', {
      method: 'PATCH',
      body: JSON.stringify({ montoPagado: 10 }),
      headers: { 'content-type': 'application/json' },
    })
    const response = await updateCuentaPorCobrarHandler(request, { params: Promise.resolve({ id: 'cxc-1' }) })
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('debe retornar 400 cuando el id no está presente', async () => {
    const { authenticateUser } = await import('@/lib/auth-middleware')
    vi.mocked(authenticateUser).mockResolvedValue({ user: { userId: 'user-123' } } as never)

    const request = new NextRequest('http://localhost/api/contabilidad/cuentas-por-cobrar/', {
      method: 'PATCH',
      body: JSON.stringify({ montoPagado: 10 }),
      headers: { 'content-type': 'application/json' },
    })
    const response = await updateCuentaPorCobrarHandler(request, { params: Promise.resolve({ id: '' }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('ID de cuenta por cobrar no especificado')
  })

  it('debe retornar 400 cuando no se envían campos válidos', async () => {
    const { authenticateUser } = await import('@/lib/auth-middleware')
    vi.mocked(authenticateUser).mockResolvedValue({ user: { userId: 'user-123' } } as never)

    const request = new NextRequest('http://localhost/api/contabilidad/cuentas-por-cobrar/cxc-1', {
      method: 'PATCH',
      body: JSON.stringify({}),
      headers: { 'content-type': 'application/json' },
    })
    const response = await updateCuentaPorCobrarHandler(request, { params: Promise.resolve({ id: 'cxc-1' }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('No se proporcionaron campos válidos para actualizar')
  })

  it('debe actualizar una cuenta por cobrar exitosamente', async () => {
    const { authenticateUser } = await import('@/lib/auth-middleware')
    const prisma = (await import('@/lib/prisma')).default

    vi.mocked(authenticateUser).mockResolvedValue({ user: { userId: 'user-123' } } as never)
    vi.mocked(prisma.cuentaPorCobrar.findUnique).mockResolvedValue({
      id: 'cxc-1',
      montoPagado: 0,
      estado: 'PENDIENTE',
    } as any)
    vi.mocked(prisma.cuentaPorCobrar.update).mockResolvedValue({
      id: 'cxc-1',
      estado: 'PARCIAL',
      montoPagado: 450,
    } as any)

    const request = new NextRequest('http://localhost/api/contabilidad/cuentas-por-cobrar/cxc-1', {
      method: 'PATCH',
      body: JSON.stringify({
        montoPagado: 450,
        estado: 'PARCIAL',
        idTransferencia: null,
        fechaVencimiento: '2026-03-20T00:00:00.000Z',
      }),
      headers: { 'content-type': 'application/json' },
    })
    const response = await updateCuentaPorCobrarHandler(request, { params: Promise.resolve({ id: 'cxc-1' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(prisma.cuentaPorCobrar.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cxc-1' },
        data: expect.objectContaining({
          montoPagado: 450,
          estado: 'PARCIAL',
          idTransferencia: null,
          fechaVencimiento: expect.any(Date),
        }),
      })
    )
    expect(data.cuenta.id).toBe('cxc-1')
  })

  it('debe retornar 404 cuando la cuenta no existe', async () => {
    const { authenticateUser } = await import('@/lib/auth-middleware')
    const prisma = (await import('@/lib/prisma')).default

    vi.mocked(authenticateUser).mockResolvedValue({ user: { userId: 'user-123' } } as never)
    vi.mocked(prisma.cuentaPorCobrar.findUnique).mockResolvedValue(null as any)
    vi.mocked(prisma.cuentaPorCobrar.update).mockRejectedValue({ code: 'P2025' })

    const request = new NextRequest('http://localhost/api/contabilidad/cuentas-por-cobrar/cxc-x', {
      method: 'PATCH',
      body: JSON.stringify({ estado: 'PAGADA' }),
      headers: { 'content-type': 'application/json' },
    })
    const response = await updateCuentaPorCobrarHandler(request, { params: Promise.resolve({ id: 'cxc-x' }) })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Cuenta por cobrar no encontrada')
  })
})
