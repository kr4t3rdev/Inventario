import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const mockPrisma = {
  moneda: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
  },
  catalogoReparacionConfig: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
  },
}

vi.mock('@/lib/auth-middleware', () => ({
  withAuthGet: (handler: unknown) => handler,
  withAuth: (handler: unknown) => handler,
}))

vi.mock('@/lib/prisma', () => ({
  default: mockPrisma,
}))

const { PUT } = await import('../route')

describe('PUT /api/reparaciones/catalogo/config', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.moneda.findUnique.mockResolvedValue({ codigo: 'USD' })
    mockPrisma.catalogoReparacionConfig.upsert.mockResolvedValue({
      id: 1,
      monedaId: 'USD',
      modoClasificacion: 'estructura_usuario',
    })
  })

  it('rechaza modo de clasificación inválido', async () => {
    const request = new Request('http://localhost/api/reparaciones/catalogo/config', {
      method: 'PUT',
      body: JSON.stringify({
        monedaId: 'USD',
        modoClasificacion: 'modo_invalido',
      }),
    }) as NextRequest

    const response = await PUT(request, {} as never, { role: 'admin' } as never)
    expect(response.status).toBe(400)
  })

  it('rechaza actualización cuando el usuario no es admin', async () => {
    const request = new Request('http://localhost/api/reparaciones/catalogo/config', {
      method: 'PUT',
      body: JSON.stringify({
        monedaId: 'USD',
        modoClasificacion: 'estructura_usuario',
      }),
    }) as NextRequest

    const response = await PUT(request, {} as never, { role: 'user' } as never)
    expect(response.status).toBe(403)
  })

  it('permite actualizar modo global válido', async () => {
    const request = new Request('http://localhost/api/reparaciones/catalogo/config', {
      method: 'PUT',
      body: JSON.stringify({
        monedaId: 'USD',
        modoClasificacion: 'estructura_usuario',
      }),
    }) as NextRequest

    const response = await PUT(request, {} as never, { role: 'admin' } as never)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.modoClasificacion).toBe('estructura_usuario')
    expect(mockPrisma.catalogoReparacionConfig.upsert).toHaveBeenCalled()
  })
})
