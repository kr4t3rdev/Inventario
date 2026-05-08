import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockPrisma = {
  puntoDeVenta: { update: vi.fn() },
}

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
  default: mockPrisma,
}))

describe('PATCH /api/puntosDeVenta/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('guarda listaPrecioId cuando se envía en payload', async () => {
    const { PATCH } = await import('../route')
    mockPrisma.puntoDeVenta.update.mockResolvedValue({
      pvId: 'pv-1',
      nombre: 'PV',
      ubicacion: 'Habana',
      listaPrecioId: 'lp-1',
    })

    const req = new NextRequest('http://localhost/api/puntosDeVenta/pv-1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nombre: 'PV', ubicacion: 'Habana', listaPrecioId: 'lp-1' }),
    })

    const res = await PATCH(req, { params: Promise.resolve({ id: 'pv-1' }) } as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.listaPrecioId).toBe('lp-1')
    expect(mockPrisma.puntoDeVenta.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { pvId: 'pv-1' },
        data: expect.objectContaining({ listaPrecio: { connect: { id: 'lp-1' } } }),
      }),
    )
  })
})
