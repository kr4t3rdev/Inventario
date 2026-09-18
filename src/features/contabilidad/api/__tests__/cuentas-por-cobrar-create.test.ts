import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCuentaPorCobrarAction } from '@/features/contabilidad/actions-cuentas'

const prismaMock = vi.hoisted(() => ({
  venta: {
    findFirst: vi.fn(),
  },
  cuentaPorCobrar: {
    findFirst: vi.fn(),
    create: vi.fn(),
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

describe('Cuentas por Cobrar — createCuentaPorCobrarAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna AUTH_REQUIRED cuando el usuario no está autenticado', async () => {
    getCurrentUserMock.mockResolvedValue(null)

    const result = await createCuentaPorCobrarAction({
      ventaId: 'venta-1',
      clienteId: 'cli-1',
      monto: 1000,
      moneda: 'CUP',
    })

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('AUTH_REQUIRED')
    expect(prismaMock.venta.findFirst).not.toHaveBeenCalled()
  })

  it('retorna NOT_FOUND cuando la venta no pertenece al tenant', async () => {
    getCurrentUserMock.mockResolvedValue({
      userId: 'user-123',
      tenantId: 'tenant-1',
      name: 'Test',
      email: 'test@test.com',
      role: 'ADMIN' as const,
      isActive: true,
      planFeatures: { 'cuentas-cobrar': true },
    })

    prismaMock.venta.findFirst.mockResolvedValue(null)

    const result = await createCuentaPorCobrarAction({
      ventaId: 'venta-1',
      clienteId: 'cli-1',
      monto: 1000,
      moneda: 'CUP',
    })

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('NOT_FOUND')
    expect(prismaMock.cuentaPorCobrar.create).not.toHaveBeenCalled()
  })

  it('retorna DUPLICATE cuando ya existe una CxC para esa venta', async () => {
    getCurrentUserMock.mockResolvedValue({
      userId: 'user-123',
      tenantId: 'tenant-1',
      name: 'Test',
      email: 'test@test.com',
      role: 'ADMIN' as const,
      isActive: true,
      planFeatures: { 'cuentas-cobrar': true },
    })

    prismaMock.venta.findFirst.mockResolvedValue({
      ventaId: 'venta-1',
      factura: { idFactura: 'fac-1' },
    })

    prismaMock.cuentaPorCobrar.findFirst.mockResolvedValue({
      id: 'cxc-existente',
      tenantId: 'tenant-1',
    })

    const result = await createCuentaPorCobrarAction({
      ventaId: 'venta-1',
      clienteId: 'cli-1',
      monto: 1000,
      moneda: 'CUP',
    })

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('DUPLICATE')
    expect(prismaMock.cuentaPorCobrar.create).not.toHaveBeenCalled()
  })

  it('crea exitosamente una cuenta por cobrar con datos válidos', async () => {
    getCurrentUserMock.mockResolvedValue({
      userId: 'user-123',
      tenantId: 'tenant-1',
      name: 'Test',
      email: 'test@test.com',
      role: 'ADMIN' as const,
      isActive: true,
      planFeatures: { 'cuentas-cobrar': true },
    })

    prismaMock.venta.findFirst.mockResolvedValue({
      ventaId: 'venta-1',
      factura: { idFactura: 'fac-1' },
    })

    prismaMock.cuentaPorCobrar.findFirst.mockResolvedValue(null)

    prismaMock.cuentaPorCobrar.create.mockResolvedValue({
      id: 'cxc-new',
      idCC: 42,
      tenantId: 'tenant-1',
      facturaId: 'fac-1',
      numeroFactura: 'SD-200',
      clienteId: 'cli-1',
      montoDeuda: 1000,
      montoPagado: 0,
      idTransferencia: null,
      estado: 'PENDIENTE',
      tipoCuenta: null,
      fechaVencimiento: null,
      moneda: 'CUP',
      createdAt: new Date('2026-05-26T10:00:00.000Z'),
      updatedAt: new Date('2026-05-26T10:00:00.000Z'),
      cliente: { clienteId: 'cli-1', nombre: 'Cliente Test' },
      factura: {
        idFactura: 'fac-1',
        total: 1000,
        numeroFactura: 'SD-200',
        createdAt: new Date('2026-05-26T10:00:00.000Z'),
        venta: {
          ventaId: 'venta-1',
          total: 1000,
          reconciliaciones: [],
          cliente: { nombre: 'Cliente Test' },
        },
      },
      prestamoCash: null,
    } as any)

    const result = await createCuentaPorCobrarAction({
      ventaId: 'venta-1',
      clienteId: 'cli-1',
      monto: 1000,
      moneda: 'CUP',
      numeroFactura: 'SD-200',
    })

    expect(result.success).toBe(true)
    expect(result.data?.id).toBe('cxc-new')
    expect(result.data?.montoDeuda).toBe(1000)
    expect(result.data?.estado).toBe('PENDIENTE')
    expect(result.data?.totalFactura).toBe(1000)
    expect(result.data?.saldoFactura).toBe(1000)

    // Verificar tenant isolation en findFirst de venta
    expect(prismaMock.venta.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ventaId: 'venta-1', tenantId: 'tenant-1' },
      })
    )

    // Verificar que create recibió datos correctos
    expect(prismaMock.cuentaPorCobrar.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          clienteId: 'cli-1',
          montoDeuda: 1000,
          estado: 'PENDIENTE',
          facturaId: 'fac-1',
          numeroFactura: 'SD-200',
        }),
      })
    )
  })
})
