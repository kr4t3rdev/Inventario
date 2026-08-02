import { beforeEach, describe, expect, it, vi } from 'vitest'
import { updateCuentaPorCobrarAction } from '@/features/contabilidad/actions-cuentas'

const prismaMock = vi.hoisted(() => ({
  cuentaPorCobrar: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
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

describe('Cuentas por Cobrar — updateCuentaPorCobrarAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna AUTH_REQUIRED cuando el usuario no está autenticado', async () => {
    getCurrentUserMock.mockResolvedValue(null)

    const result = await updateCuentaPorCobrarAction({ id: 'cxc-1', estado: 'PAGADA' })

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('AUTH_REQUIRED')
  })

  it('retorna NOT_FOUND cuando la cuenta no pertenece al tenant', async () => {
    getCurrentUserMock.mockResolvedValue({
      userId: 'user-123',
      tenantId: 'tenant-1',
      name: 'Test',
      email: 'test@test.com',
      role: 'ADMIN' as const,
      isActive: true,
      planFeatures: { 'cuentas-cobrar': true },
    })

    prismaMock.cuentaPorCobrar.findFirst.mockResolvedValue(null)

    const result = await updateCuentaPorCobrarAction({ id: 'cxc-1', estado: 'PAGADA' })

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('NOT_FOUND')
    expect(prismaMock.cuentaPorCobrar.updateMany).not.toHaveBeenCalled()
  })

  it('actualiza estado y monto correctamente con tenant isolation', async () => {
    getCurrentUserMock.mockResolvedValue({
      userId: 'user-123',
      tenantId: 'tenant-1',
      name: 'Test',
      email: 'test@test.com',
      role: 'ADMIN' as const,
      isActive: true,
      planFeatures: { 'cuentas-cobrar': true },
    })

    prismaMock.cuentaPorCobrar.findFirst.mockResolvedValue({
      id: 'cxc-1',
      tenantId: 'tenant-1',
      montoPagado: 0,
      estado: 'PENDIENTE',
    } as any)

    prismaMock.cuentaPorCobrar.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.cuentaPorCobrar.findFirst.mockResolvedValueOnce({
      id: 'cxc-1',
      tenantId: 'tenant-1',
      montoPagado: 0,
      estado: 'PENDIENTE',
    } as any).mockResolvedValueOnce({
      id: 'cxc-1',
      idCC: 1,
      facturaId: 'fac-1',
      numeroFactura: 'SD-100',
      clienteId: 'cli-1',
      montoDeuda: 1000,
      montoPagado: 450,
      moneda: 'CUP',
      estado: 'PARCIAL',
      tipoCuenta: 'VENTA',
      idTransferencia: null,
      fechaVencimiento: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      cliente: { clienteId: 'cli-1', nombre: 'Cliente' },
      factura: null,
      prestamoCash: null,
    } as any)

    const result = await updateCuentaPorCobrarAction({
      id: 'cxc-1',
      montoPagado: 450,
      estado: 'PARCIAL',
      idTransferencia: 'TRF-001',
      fechaVencimiento: '2026-03-20T00:00:00.000Z',
    })

    expect(result.success).toBe(true)
    expect(prismaMock.cuentaPorCobrar.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cxc-1', tenantId: 'tenant-1' },
      })
    )
    expect(prismaMock.cuentaPorCobrar.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cxc-1', tenantId: 'tenant-1', estado: { not: 'ANULADA' } },
        data: expect.objectContaining({
          montoPagado: 450,
          estado: 'PARCIAL',
          idTransferencia: 'TRF-001',
          fechaVencimiento: expect.any(Date),
        }),
      })
    )
    expect(result.data?.montoPagado).toBe(450)
    expect(result.data?.estado).toBe('PARCIAL')
  })

  it('valida entrada con Zod — rechaza id vacío', async () => {
    getCurrentUserMock.mockResolvedValue({
      userId: 'user-123',
      tenantId: 'tenant-1',
      name: 'Test',
      email: 'test@test.com',
      role: 'ADMIN' as const,
      isActive: true,
      planFeatures: { 'cuentas-cobrar': true },
    })

    const result = await updateCuentaPorCobrarAction({ id: '', estado: 'PAGADA' })

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('VALIDATION_ERROR')
  })

  it('does not reactivate an annulled receivable through the generic update action', async () => {
    getCurrentUserMock.mockResolvedValue({
      userId: 'user-123',
      tenantId: 'tenant-1',
      name: 'Test',
      email: 'test@test.com',
      role: 'ADMIN' as const,
      isActive: true,
      planFeatures: { 'cuentas-cobrar': true },
    })
    prismaMock.cuentaPorCobrar.findFirst.mockResolvedValue({
      id: 'cxc-1',
      tenantId: 'tenant-1',
      montoPagado: 250,
      estado: 'ANULADA',
    } as any)

    const result = await updateCuentaPorCobrarAction({ id: 'cxc-1', estado: 'PARCIAL' })

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('VALIDATION_ERROR')
    expect(prismaMock.cuentaPorCobrar.updateMany).not.toHaveBeenCalled()
  })

  it('rejects a concurrent annulment when the atomic update claims no row', async () => {
    getCurrentUserMock.mockResolvedValue({
      userId: 'user-123',
      tenantId: 'tenant-1',
      name: 'Test',
      email: 'test@test.com',
      role: 'ADMIN' as const,
      isActive: true,
      planFeatures: { 'cuentas-cobrar': true },
    })
    prismaMock.cuentaPorCobrar.findFirst.mockResolvedValue({
      id: 'cxc-1',
      tenantId: 'tenant-1',
      estado: 'PARCIAL',
    } as any)
    prismaMock.cuentaPorCobrar.updateMany.mockResolvedValue({ count: 0 })

    const result = await updateCuentaPorCobrarAction({ id: 'cxc-1', estado: 'PAGADA' })

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('VALIDATION_ERROR')
    expect(prismaMock.cuentaPorCobrar.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cxc-1', tenantId: 'tenant-1', estado: { not: 'ANULADA' } },
      }),
    )
  })
})
