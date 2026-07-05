import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    reconciliacionGasto: {
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn()
    },
    empleado: {
      findFirst: vi.fn()
    },
    gastosDE: {
      findFirst: vi.fn()
    },
    gastoCompra: {
      findFirst: vi.fn()
    },
    cuentaBancaria: {
      findMany: vi.fn()
    }
  }
}))

vi.mock('@/lib/auth-middleware', () => ({
  authenticateUser: vi.fn()
}))

describe('Reconciliacion gastos historial API - GET', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna 401 cuando no hay usuario autenticado', async () => {
    const { GET } = await import('../route')
    const { authenticateUser } = await import('@/lib/auth-middleware')
    vi.mocked(authenticateUser).mockResolvedValue(
      NextResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 }) as any
    )

    const request = new NextRequest(
      'http://localhost/api/contabilidad/reconciliacion/gastos/historial?page=1&limit=10'
    )

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.code).toBe('UNAUTHORIZED')
  })

  it('filtra historial y enriquecimiento por tenantId', async () => {
    const { GET } = await import('../route')
    const prisma = (await import('@/lib/prisma')).default as any
    const { authenticateUser } = await import('@/lib/auth-middleware')

    vi.mocked(authenticateUser).mockResolvedValue({ user: { userId: 'u1', tenantId: 'tenant-h-1' } } as any)
    vi.mocked(prisma.reconciliacionGasto.findMany).mockResolvedValue([
      {
        reconciliacionId: 'rec-1',
        tipoGasto: 'gastoDE',
        referenciaId: 'g-1',
        gastosDEId: 'g-1',
        monto: 50,
        createdAt: new Date(),
        fechaReconciliacion: new Date(),
        cuentaBancaria: { nombreBanco: 'Banco' },
      },
    ] as any)
    vi.mocked(prisma.reconciliacionGasto.count).mockResolvedValue(1)
    vi.mocked(prisma.reconciliacionGasto.groupBy).mockResolvedValue([] as any)
    vi.mocked(prisma.cuentaBancaria.findMany).mockResolvedValue([] as any)
    vi.mocked(prisma.gastosDE.findFirst).mockResolvedValue({ gastosDEId: 'g-1', tipo: 'Pago' } as any)

    const response = await GET(
      new NextRequest('http://localhost/api/contabilidad/reconciliacion/gastos/historial?page=1&limit=10')
    )

    expect(response.status).toBe(200)
    expect(prisma.reconciliacionGasto.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-h-1' }),
      })
    )
    expect(prisma.gastosDE.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { gastosDEId: 'g-1', tenantId: 'tenant-h-1' },
      })
    )
  })
})
