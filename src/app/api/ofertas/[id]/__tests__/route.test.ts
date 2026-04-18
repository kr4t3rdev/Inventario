import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { DELETE } from '../route'

vi.mock('@/lib/prisma', () => ({
  default: {
    oferta: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn(),
}))

describe('Ofertas API - DELETE', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('debe eliminar una oferta pendiente exitosamente', async () => {
    const { authenticateUser } = await import('@/lib/auth-middleware')
    const prisma = (await import('@/lib/prisma')).default

    vi.mocked(authenticateUser).mockResolvedValue({ user: { userId: 'user-123' } } as any)
    vi.mocked(prisma.oferta.findUnique).mockResolvedValue({
      id: 'oferta-123',
      estado: 'PENDIENTE',
    } as any)
    vi.mocked(prisma.oferta.delete).mockResolvedValue({ id: 'oferta-123' } as any)

    const request = new NextRequest('http://localhost/api/ofertas/oferta-123')
    const response = await DELETE(request, { params: Promise.resolve({ id: 'oferta-123' }) })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.message).toBe('Oferta eliminada exitosamente')
  })

  it('debe rechazar eliminar una oferta facturada', async () => {
    const { authenticateUser } = await import('@/lib/auth-middleware')
    const prisma = (await import('@/lib/prisma')).default

    vi.mocked(authenticateUser).mockResolvedValue({ user: { userId: 'user-123' } } as any)
    vi.mocked(prisma.oferta.findUnique).mockResolvedValue({
      id: 'oferta-123',
      estado: 'FACTURADA',
    } as any)

    const request = new NextRequest('http://localhost/api/ofertas/oferta-123')
    const response = await DELETE(request, { params: Promise.resolve({ id: 'oferta-123' }) })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('No se puede eliminar una oferta facturada')
  })

  it('debe retornar 404 si la oferta no existe', async () => {
    const { authenticateUser } = await import('@/lib/auth-middleware')
    const prisma = (await import('@/lib/prisma')).default

    vi.mocked(authenticateUser).mockResolvedValue({ user: { userId: 'user-123' } } as any)
    vi.mocked(prisma.oferta.findUnique).mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/ofertas/oferta-123')
    const response = await DELETE(request, { params: Promise.resolve({ id: 'oferta-123' }) })

    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error).toBe('Oferta no encontrada')
  })

  it('debe retornar 401 si no hay usuario autenticado', async () => {
    const { authenticateUser } = await import('@/lib/auth-middleware')

    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) as any
    )

    const request = new NextRequest('http://localhost/api/ofertas/oferta-123')
    const response = await DELETE(request, { params: Promise.resolve({ id: 'oferta-123' }) })

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Unauthorized')
  })
})
