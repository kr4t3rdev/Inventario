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

describe('GET /api/contabilidad/anticipos/reportes/proveedor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('devuelve reporte agrupado por proveedor', async () => {
    prismaMock.anticipo.findMany.mockResolvedValue([
      {
        anticipoId: 'a1',
        proveedorId: 'prov-1',
        proveedor: { vendorId: 'prov-1', nombre: 'Proveedor 1' },
        contrato: { contratoId: 'ctr-1', numeroContrato: 'C-1' },
        montoOriginal: 100,
        saldoDisponible: 25,
        moneda: 'CUP',
        estado: 'RESERVADO',
        fechaReserva: new Date('2026-01-01'),
      },
    ])

    const { GET } = await import('../route')
    const request = new NextRequest('http://localhost/api/contabilidad/anticipos/reportes/proveedor')

    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.proveedores).toHaveLength(1)
    expect(body.proveedores[0].totales.totalOriginal).toBe(100)
    expect(body.proveedores[0].totales.totalPendiente).toBe(25)
    expect(prismaMock.anticipo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tipo: 'PAGO' }),
      })
    )
  })
})
