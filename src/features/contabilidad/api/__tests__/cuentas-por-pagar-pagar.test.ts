import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pagarCuentaPorPagarAction } from '@/features/contabilidad/actions-cuentas'

const prismaMock = vi.hoisted(() => ({
  cuentaPorPagar: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

const getCurrentUserMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/server-actions/get-current-user', () => ({
  getCurrentUser: getCurrentUserMock,
}))

vi.mock('@/lib/services/pago-gastos-workflow', () => ({
  applyPagoGastoWorkflow: vi.fn(),
  isGastoWorkflowError: vi.fn((error: unknown) => {
    const candidate = error as { status?: unknown; code?: unknown } | null
    return Boolean(
      candidate &&
      typeof candidate === 'object' &&
      typeof candidate.status === 'number' &&
      typeof candidate.code === 'string'
    )
  }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

describe('Cuentas por Pagar — pagarCuentaPorPagarAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna AUTH_REQUIRED cuando el usuario no está autenticado', async () => {
    getCurrentUserMock.mockResolvedValue(null)

    const result = await pagarCuentaPorPagarAction({
      numeroFactura: 'FAC-1',
      tipo: 'compra',
      monto: 10,
      numeroTransaccion: 'TRX-1',
      cuentaProveedor: '123',
    })

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('AUTH_REQUIRED')
  })

  it('retorna NOT_FOUND cuando la CxP no existe para el tenant', async () => {
    getCurrentUserMock.mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      name: 'Test',
      email: 'test@test.com',
      role: 'ADMIN' as const,
      isActive: true,
    })

    prismaMock.cuentaPorPagar.findFirst.mockResolvedValue(null)

    const result = await pagarCuentaPorPagarAction({
      numeroFactura: 'FAC-404',
      tipo: 'compra',
      monto: 10,
      numeroTransaccion: 'TRX-2',
      cuentaProveedor: '123',
    })

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('NOT_FOUND')
    expect(result.error?.message).toBe('Compra no encontrada')
  })

  it('retorna CUENTA_YA_PAGADA cuando la CxP ya está en estado PAGADA', async () => {
    getCurrentUserMock.mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      name: 'Test',
      email: 'test@test.com',
      role: 'ADMIN' as const,
      isActive: true,
    })

    prismaMock.cuentaPorPagar.findFirst.mockResolvedValue({
      cuentaPorPagarId: 'cxp-1',
      gastoCompraId: 'gc-1',
      gastosDEId: null,
      tipo: 'compra',
      moneda: 'CUP',
      estado: 'PAGADA',
      saldoPendiente: 0,
    })

    const result = await pagarCuentaPorPagarAction({
      numeroFactura: 'FAC-1',
      tipo: 'compra',
      monto: 10,
      numeroTransaccion: 'TRX-1',
      cuentaProveedor: '123',
    })

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('CUENTA_YA_PAGADA')
  })

  it('retorna MONTO_EXCEDE_SALDO cuando el monto supera el saldo', async () => {
    getCurrentUserMock.mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      name: 'Test',
      email: 'test@test.com',
      role: 'ADMIN' as const,
      isActive: true,
    })

    prismaMock.cuentaPorPagar.findFirst.mockResolvedValue({
      cuentaPorPagarId: 'cxp-1',
      gastoCompraId: 'gc-1',
      gastosDEId: null,
      tipo: 'compra',
      moneda: 'CUP',
      estado: 'PENDIENTE',
      saldoPendiente: 50,
    })

    const result = await pagarCuentaPorPagarAction({
      numeroFactura: 'FAC-1',
      tipo: 'compra',
      monto: 100,
      numeroTransaccion: 'TRX-3',
      cuentaProveedor: '123',
    })

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('MONTO_EXCEDE_SALDO')
  })

  it('mapea errores del workflow con status/code', async () => {
    const { applyPagoGastoWorkflow } = await import('@/lib/services/pago-gastos-workflow')

    getCurrentUserMock.mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      name: 'Test',
      email: 'test@test.com',
      role: 'ADMIN' as const,
      isActive: true,
    })

    prismaMock.cuentaPorPagar.findFirst.mockResolvedValue({
      cuentaPorPagarId: 'cxp-1',
      gastoCompraId: 'gc-1',
      gastosDEId: null,
      tipo: 'compra',
      moneda: 'CUP',
      estado: 'PENDIENTE',
      saldoPendiente: 1000,
    })

    vi.mocked(applyPagoGastoWorkflow as any).mockRejectedValue({
      message: 'Saldo insuficiente en la cuenta',
      status: 400,
      code: 'SALDO_INSUFICIENTE',
    })

    prismaMock.$transaction.mockImplementation(async (callback: any) => {
      return callback({})
    })

    const result = await pagarCuentaPorPagarAction({
      numeroFactura: 'FAC-1',
      tipo: 'compra',
      monto: 500,
      numeroTransaccion: 'TRX-3',
      cuentaProveedor: '123',
    })

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('SALDO_INSUFICIENTE')
  })

  it('retorna cuenta y pago cuando el workflow se aplica correctamente', async () => {
    const { applyPagoGastoWorkflow } = await import('@/lib/services/pago-gastos-workflow')

    getCurrentUserMock.mockResolvedValue({
      userId: 'user-9',
      tenantId: 'tenant-1',
      name: 'Test',
      email: 'test@test.com',
      role: 'ADMIN' as const,
      isActive: true,
    })

    prismaMock.cuentaPorPagar.findFirst.mockResolvedValue({
      cuentaPorPagarId: 'cxp-9',
      gastoCompraId: null,
      gastosDEId: 'gde-9',
      tipo: 'servicio',
      moneda: 'CUP',
      estado: 'PENDIENTE',
      saldoPendiente: 200,
    })

    vi.mocked(applyPagoGastoWorkflow as any).mockResolvedValue({
      reconciliaciones: [{
        reconciliacionId: 'rec-9',
        cuentaId: 'cb-1',
        monto: 100,
        moneda: 'CUP',
        montoConvertido: 100,
        descripcion: 'Pago FAC-9',
      }],
      cuentaPorPagar: {
        cuentaPorPagarId: 'cxp-9',
        estado: 'PAGADA',
        montoPagado: 100,
        saldoPendiente: 0,
      },
      pagoCuentaPorPagar: {
        pagoCuentaPorPagarId: 'pago-9',
        numeroTransaccion: 'TRX-9',
        monto: 100,
      },
    })

    prismaMock.cuentaPorPagar.findUnique.mockResolvedValue({
      cuentaPorPagarId: 'cxp-9',
      numeroFactura: 'FAC-9',
      tipo: 'servicio',
      gastoCompraId: null,
      gastosDEId: 'gde-9',
      proveedorId: 'prov-1',
      proveedorNombre: 'Proveedor Demo',
      montoDeuda: 200,
      montoPagado: 100,
      saldoPendiente: 0,
      moneda: 'CUP',
      fechaEmision: new Date('2026-01-01'),
      fechaVencimiento: null,
      estado: 'PAGADA',
      tipoDeuda: null,
      proveedor: { vendorId: 'prov-1', nombre: 'Proveedor Demo', cuentaCUP: null, cuentaUSD: null },
      pagos: [],
      deudaCash: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    })

    prismaMock.$transaction.mockImplementation(async (callback: any) => {
      return callback({})
    })

    const result = await pagarCuentaPorPagarAction({
      numeroFactura: 'FAC-9',
      tipo: 'servicio',
      monto: 100,
      numeroTransaccion: 'TRX-9',
      cuentaProveedor: '123',
    })

    expect(result.success).toBe(true)
    expect(result.data?.cuenta.cuentaPorPagarId).toBe('cxp-9')
    expect(result.data?.cuenta.estado).toBe('PAGADA')
    expect(result.data?.pago.pagoCuentaPorPagarId).toBe('pago-9')
    expect(applyPagoGastoWorkflow).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        cuentaPorPagarId: 'cxp-9',
        referenciaId: 'gde-9',
        tipoGasto: 'gastoDE',
      })
    )
  })
})
