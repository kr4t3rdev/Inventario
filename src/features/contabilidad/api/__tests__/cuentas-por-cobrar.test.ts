import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCuentasPorCobrarAction } from '@/features/contabilidad/actions-cuentas'

const prismaMock = vi.hoisted(() => ({
  cuentaPorCobrar: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

const getCurrentUserMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/server-actions/get-current-user', () => ({
  getCurrentUser: getCurrentUserMock,
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

describe('Cuentas por Cobrar — getCuentasPorCobrarAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna AUTH_REQUIRED cuando el usuario no está autenticado', async () => {
    getCurrentUserMock.mockResolvedValue(null)

    const result = await getCuentasPorCobrarAction({})

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('AUTH_REQUIRED')
    expect(prismaMock.cuentaPorCobrar.findMany).not.toHaveBeenCalled()
  })

  it('calcula totalPagadoFactura y saldoFactura normalizando pagos multi-moneda', async () => {
    getCurrentUserMock.mockResolvedValue({
      userId: 'user-123',
      tenantId: 'tenant-1',
      name: 'Test',
      email: 'test@test.com',
      role: 'ADMIN' as const,
      isActive: true,
      planFeatures: { 'cuentas-cobrar': true },
    })

    prismaMock.cuentaPorCobrar.findMany.mockResolvedValue([
      {
        id: 'cxc-1',
        idCC: 1,
        facturaId: 'fac-1',
        numeroFactura: 'SD-100',
        clienteId: 'cli-1',
        montoDeuda: 1000,
        montoPagado: 0,
        moneda: 'CUP',
        estado: 'PENDIENTE',
        tipoCuenta: 'VENTA',
        idTransferencia: null,
        fechaVencimiento: null,
        createdAt: new Date('2026-02-14T10:00:00.000Z'),
        updatedAt: new Date('2026-02-14T10:00:00.000Z'),
        cliente: { clienteId: 'cli-1', nombre: 'Cliente Demo' },
        factura: {
          idFactura: 'fac-1',
          numeroFactura: 'SD-100',
          total: 1000,
          venta: {
            total: 1000,
            reconciliaciones: [
              { monto: 2, moneda: 'USD', tasaCambio: 100 },
              { monto: 100, moneda: 'CUP', tasaCambio: null },
            ],
          },
        },
        prestamoCash: null,
      } as any,
    ])
    prismaMock.cuentaPorCobrar.count.mockResolvedValue(1)

    const result = await getCuentasPorCobrarAction({})

    expect(result.success).toBe(true)
    expect(result.data?.cuentas).toHaveLength(1)
    expect(result.data?.cuentas[0].totalPagadoFactura).toBe(300)  // 2*100 + 100
    expect(result.data?.cuentas[0].saldoFactura).toBe(700)        // 1000 - 300
    expect(result.data?.cuentas[0].totalFactura).toBe(1000)
  })

  it('calcula saldo usando montoDeuda cuando no existe factura relacionada', async () => {
    getCurrentUserMock.mockResolvedValue({
      userId: 'user-123',
      tenantId: 'tenant-1',
      name: 'Test',
      email: 'test@test.com',
      role: 'ADMIN' as const,
      isActive: true,
      planFeatures: { 'cuentas-cobrar': true },
    })

    prismaMock.cuentaPorCobrar.findMany.mockResolvedValue([
      {
        id: 'cxc-2',
        idCC: 2,
        facturaId: null,
        numeroFactura: 'MANUAL-1',
        clienteId: 'cli-2',
        montoDeuda: 800,
        montoPagado: 200,
        moneda: 'CUP',
        estado: 'PARCIAL',
        tipoCuenta: null,
        idTransferencia: null,
        fechaVencimiento: null,
        createdAt: new Date('2026-02-14T10:00:00.000Z'),
        updatedAt: new Date('2026-02-14T10:00:00.000Z'),
        cliente: { clienteId: 'cli-2', nombre: 'Cliente Manual' },
        factura: null,
        prestamoCash: null,
      } as any,
    ])
    prismaMock.cuentaPorCobrar.count.mockResolvedValue(1)

    const result = await getCuentasPorCobrarAction({})

    expect(result.success).toBe(true)
    expect(result.data?.cuentas).toHaveLength(1)
    expect(result.data?.cuentas[0].totalFactura).toBe(800)
    expect(result.data?.cuentas[0].totalPagadoFactura).toBe(200)
    expect(result.data?.cuentas[0].saldoFactura).toBe(600)
  })

  it('filtra por tenantId usando requireTenant', async () => {
    getCurrentUserMock.mockResolvedValue({
      userId: 'user-123',
      tenantId: 'tenant-42',
      name: 'Test',
      email: 'test@test.com',
      role: 'ADMIN' as const,
      isActive: true,
      planFeatures: { 'cuentas-cobrar': true },
    })

    prismaMock.cuentaPorCobrar.findMany.mockResolvedValue([])
    prismaMock.cuentaPorCobrar.count.mockResolvedValue(0)

    await getCuentasPorCobrarAction({})

    expect(prismaMock.cuentaPorCobrar.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-42' }),
      })
    )
  })
})
