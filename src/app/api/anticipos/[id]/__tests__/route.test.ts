import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  anticipo: {
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('@/lib/auth-middleware', () => ({
  withAuthGet: (handler: any) => handler,
  withAuthPost: (handler: any) => handler,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
  default: prismaMock,
}))

describe('API /anticipos/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET devuelve un anticipo por id', async () => {
    prismaMock.anticipo.findUnique.mockResolvedValue({ anticipoId: 'ant-1', tipo: 'PAGO' })

    const { GET } = await import('../route')
    const request = new NextRequest('http://localhost/api/anticipos/ant-1')

    const response = await GET(request, { params: Promise.resolve({ id: 'ant-1' }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.anticipo.anticipoId).toBe('ant-1')
  })

  it('PUT actualiza un anticipo', async () => {
    prismaMock.anticipo.findUnique.mockResolvedValue({ anticipoId: 'ant-1' })
    prismaMock.anticipo.update.mockResolvedValue({ anticipoId: 'ant-1', estado: 'ANULADO' })

    const { PUT } = await import('../route')
    const request = new NextRequest('http://localhost/api/anticipos/ant-1', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ estado: 'ANULADO' }),
    })

    const response = await PUT(request, { params: Promise.resolve({ id: 'ant-1' }) }, { userId: 'user-1' })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.anticipo.estado).toBe('ANULADO')
  })

  it('DELETE elimina un anticipo', async () => {
    prismaMock.anticipo.findUnique.mockResolvedValue({ anticipoId: 'ant-1' })
    prismaMock.anticipo.delete.mockResolvedValue({ anticipoId: 'ant-1' })

    const { DELETE } = await import('../route')
    const request = new NextRequest('http://localhost/api/anticipos/ant-1', { method: 'DELETE' })

    const response = await DELETE(request, { params: Promise.resolve({ id: 'ant-1' }) }, { userId: 'user-1' })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.message).toContain('eliminado')
  })
})
