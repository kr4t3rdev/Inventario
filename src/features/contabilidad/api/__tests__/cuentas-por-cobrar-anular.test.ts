import { beforeEach, describe, expect, it, vi } from 'vitest'
import { anularCuentaPorCobrarAction } from '@/features/contabilidad/actions-cuentas'

const prismaMock = vi.hoisted(() => ({
  cuentaPorCobrar: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
}))

const auditLogMock = vi.hoisted(() => ({ log: vi.fn() }))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/services/audit-log-service', () => ({ AuditLogService: auditLogMock }))

const getCurrentUserMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/server-actions/get-current-user', () => ({
  getCurrentUser: getCurrentUserMock,
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

describe('Cuentas por Cobrar — anularCuentaPorCobrarAction', () => {
  const user = {
    userId: 'user-123',
    tenantId: 'tenant-1',
    name: 'Test',
    email: 'test@test.com',
    role: 'ADMIN' as const,
    isActive: true,
    planFeatures: { 'cuentas-cobrar': true },
  }

  const cuenta = {
    id: 'cxc-1',
    idCC: 1,
    tenantId: 'tenant-1',
    facturaId: null,
    numeroFactura: 'MAN-1',
    clienteId: 'cli-1',
    montoDeuda: 1000,
    montoPagado: 250,
    idTransferencia: 'trf-1',
    estado: 'PARCIAL',
    tipoCuenta: null,
    fechaVencimiento: null,
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    moneda: 'CUP',
    cliente: { clienteId: 'cli-1', nombre: 'Cliente' },
    factura: null,
    prestamoCash: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    getCurrentUserMock.mockResolvedValue(user)
    auditLogMock.log.mockResolvedValue(null)
  })

  it('requires authentication', async () => {
    getCurrentUserMock.mockResolvedValue(null)

    const result = await anularCuentaPorCobrarAction({ id: 'cxc-1' })

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('AUTH_REQUIRED')
    expect(prismaMock.cuentaPorCobrar.findFirst).not.toHaveBeenCalled()
  })

  it('enforces tenant isolation', async () => {
    prismaMock.cuentaPorCobrar.findFirst.mockResolvedValue(null)

    const result = await anularCuentaPorCobrarAction({ id: 'cxc-1' })

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('NOT_FOUND')
    expect(prismaMock.cuentaPorCobrar.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'cxc-1', tenantId: 'tenant-1' } }),
    )
    expect(prismaMock.cuentaPorCobrar.updateMany).not.toHaveBeenCalled()
  })

  it('marks the receivable as ANULADA while preserving historical amounts and payment link', async () => {
    prismaMock.cuentaPorCobrar.findFirst
      .mockResolvedValueOnce(cuenta)
      .mockResolvedValueOnce({ ...cuenta, estado: 'ANULADA' })
    prismaMock.cuentaPorCobrar.updateMany.mockResolvedValue({ count: 1 })

    const result = await anularCuentaPorCobrarAction({ id: 'cxc-1', motivo: 'Venta anulada' })

    expect(result.success).toBe(true)
    expect(result.data?.estado).toBe('ANULADA')
    expect(result.data?.montoDeuda).toBe(1000)
    expect(result.data?.montoPagado).toBe(250)
    expect(prismaMock.cuentaPorCobrar.updateMany).toHaveBeenCalledWith({
      where: { id: 'cxc-1', tenantId: 'tenant-1', estado: { not: 'ANULADA' } },
      data: { estado: 'ANULADA' },
    })
    expect(auditLogMock.log).toHaveBeenCalledWith(expect.objectContaining({
      accion: 'UPDATE',
      entidad: 'CUENTA_POR_COBRAR',
      entidadId: 'cxc-1',
      usuarioId: 'user-123',
      detalles: expect.objectContaining({ motivo: 'Venta anulada', estadoNuevo: 'ANULADA' }),
    }))
  })

  it('is idempotent and does not write or audit an already annulled receivable', async () => {
    prismaMock.cuentaPorCobrar.findFirst.mockResolvedValue({ ...cuenta, estado: 'ANULADA' })

    const result = await anularCuentaPorCobrarAction({ id: 'cxc-1' })

    expect(result.success).toBe(true)
    expect(result.data?.estado).toBe('ANULADA')
    expect(prismaMock.cuentaPorCobrar.updateMany).not.toHaveBeenCalled()
    expect(auditLogMock.log).not.toHaveBeenCalled()
  })

  it('returns the raced ANULADA row when another request claims the transition first', async () => {
    prismaMock.cuentaPorCobrar.findFirst
      .mockResolvedValueOnce(cuenta)
      .mockResolvedValueOnce({ ...cuenta, estado: 'ANULADA' })
    prismaMock.cuentaPorCobrar.updateMany.mockResolvedValue({ count: 0 })

    const result = await anularCuentaPorCobrarAction({ id: 'cxc-1' })

    expect(result.success).toBe(true)
    expect(result.data?.estado).toBe('ANULADA')
    expect(auditLogMock.log).not.toHaveBeenCalled()
  })
})
