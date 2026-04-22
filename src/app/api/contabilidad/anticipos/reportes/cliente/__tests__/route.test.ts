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

describe('GET /api/contabilidad/anticipos/reportes/cliente', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('devuelve reporte agrupado por cliente', async () => {
    prismaMock.anticipo.findMany.mockResolvedValue([
      {
        anticipoId: 'a1',
        clienteId: 'cli-1',
        cliente: { clienteId: 'cli-1', nombre: 'Cliente 1' },
        contrato: { contratoId: 'ctr-1', numeroContrato: 'C-1' },
        montoOriginal: 100,
        saldoDisponible: 25,
        moneda: 'CUP',
        estado: 'RESERVADO',
        fechaReserva: new Date('2026-01-01'),
      },
      {
        anticipoId: 'a2',
        clienteId: 'cli-1',
        cliente: { clienteId: 'cli-1', nombre: 'Cliente 1' },
        contrato: { contratoId: 'ctr-2', numeroContrato: 'C-2' },
        montoOriginal: 50,
        saldoDisponible: 0,
        moneda: 'CUP',
        estado: 'EJECUTADO',
        fechaReserva: new Date('2026-01-02'),
      },
    ])

    const { GET } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/anticipos/reportes/cliente')

    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.clientes).toHaveLength(1)
    expect(body.clientes[0].totales.totalOriginal).toBe(150)
    expect(body.clientes[0].totales.totalEjecutado).toBe(125)
    expect(body.clientes[0].totales.totalPendiente).toBe(25)
    expect(prismaMock.anticipo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tipo: 'COBRO' }),
      })
    )
  })
})
