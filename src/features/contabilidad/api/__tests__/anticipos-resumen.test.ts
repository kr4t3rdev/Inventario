import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  anticipo: {
    findMany: vi.fn(),
  },
}))

vi.mock('@/lib/auth-middleware', () => ({
  withAuthGet: (handler: any) => handler,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
  default: prismaMock,
}))

describe('GET /api/contabilidad/anticipos/reportes/resumen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('devuelve el resumen general de anticipos', async () => {
    prismaMock.anticipo.findMany.mockResolvedValue([
      { moneda: 'CUP', tipo: 'PAGO', estado: 'RESERVADO', montoOriginal: 100, saldoDisponible: 25 },
      { moneda: 'USD', tipo: 'COBRO', estado: 'EJECUTADO', montoOriginal: 50, saldoDisponible: 0 },
    ])

    const { GET } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/anticipos/reportes/resumen')

    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.resumen.totalesGenerales.totalAnticipos).toBe(150)
    expect(body.resumen.porTipo.PAGO).toBe(100)
    expect(body.resumen.porTipo.COBRO).toBe(50)
    expect(prismaMock.anticipo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({ tipo: expect.any(String) }),
      })
    )
  })
})
