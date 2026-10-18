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
  // El wrapper real expone (request, context); el handler interno recibe
  // ademas el usuario resuelto.
  withAuthGet: (handler: unknown) => (request: any, context: any) =>
    (handler as Function)(request, context, mockAuthUser),
  withAuth:
    (handler: unknown) =>
    (request: any, _context?: any, user: any = mockAuthUser) =>
      (handler as Function)(request, {}, user),
}))

const mockAuthUser = {
  userId: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-1',
  tenantRole: 'manager',
}

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

    const response = await PUT(request, {})
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

    // El wrapper publico expone (request, context); este caso necesita ademas
    // inyectar un usuario NO admin, que es el 3er parametro del handler interno.
    const response = await (PUT as (...a: any[]) => Promise<Response>)(
      request, {}, { ...mockAuthUser, role: 'regularUser' },
    )
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

    const response = await PUT(request, {})
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.modoClasificacion).toBe('estructura_usuario')
    expect(mockPrisma.catalogoReparacionConfig.upsert).toHaveBeenCalled()
  })
})
