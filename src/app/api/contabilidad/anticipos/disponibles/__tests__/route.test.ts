import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth-middleware', () => ({
  withAuthGet: (handler: any) => handler
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    anticipo: {
      findMany: vi.fn()
    }
  }
}))

describe('API contabilidad/anticipos/disponibles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna anticipos de compra con status 200', async () => {
    const prisma = (await import('@/lib/prisma')).default as any
    prisma.anticipo.findMany.mockResolvedValue([{ anticipoId: 'ant-1', tipo: 'PAGO' }])

    const { GET } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/anticipos/disponibles?contexto=compra&proveedorId=v-1')
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.anticipos).toHaveLength(1)
    expect(prisma.anticipo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tipo: 'PAGO',
          proveedorId: 'v-1'
        })
      })
    )
  })
})
