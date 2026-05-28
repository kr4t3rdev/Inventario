import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCuentaPorPagarAction } from '@/features/contabilidad/actions-cuentas'

const prismaMock = vi.hoisted(() => ({
  cuentaPorPagar: {
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

const AUTH_USER = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  name: 'Test',
  email: 'test@test.com',
  role: 'ADMIN' as const,
  isActive: true,
}

const PROVEEDOR_A = { vendorId: 'prov-1', nombre: 'Proveedor A' }
const PROVEEDOR_B = { vendorId: 'prov-2', nombre: 'Proveedor B' }

describe('Cuentas por Pagar — createCuentaPorPagarAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getCurrentUserMock.mockResolvedValue(AUTH_USER)
  })

  it('retorna DUPLICATE cuando existe factura con mismo numero y mismo proveedor', async () => {
    prismaMock.cuentaPorPagar.findFirst.mockResolvedValue({
      cuentaPorPagarId: 'cxp-1',
      numeroFactura: 'FAC-001',
      proveedorId: 'prov-1',
    })

    const result = await createCuentaPorPagarAction({
      numeroFactura: 'FAC-001',
      tipo: 'compra',
      proveedorId: 'prov-1',
      montoDeuda: 100,
    })

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('DUPLICATE')
    expect(result.error?.message).toBe('Ya existe una cuenta por pagar con ese número de factura')
  })

  it('permite crear cuando existe factura con mismo numero pero diferente proveedor', async () => {
    // Simular que existe una CxP con FAC-001 para proveedor A
    prismaMock.cuentaPorPagar.findFirst
      .mockResolvedValueOnce(null) // No hay duplicado porque el proveedor es diferente

    prismaMock.cuentaPorPagar.create.mockResolvedValue({
      cuentaPorPagarId: 'cxp-2',
      tenantId: 'tenant-1',
      numeroFactura: 'FAC-001',
      tipo: 'compra',
      proveedorId: 'prov-2',
      proveedorNombre: 'Proveedor B',
      montoDeuda: 200,
      montoPagado: 0,
      saldoPendiente: 200,
      moneda: 'CUP',
      fechaEmision: new Date(),
      fechaVencimiento: null,
      estado: 'PENDIENTE',
      tipoDeuda: null,
      proveedor: null,
      pagos: [],
      deudaCash: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      compraProducto: null,
      compraDocumento: null,
      gastoCompra: null,
      gastosDE: null,
      reconciliaciones: [],
      tenant: null,
      gastoCompraId: null,
      gastosDEId: null,
    })

    const result = await createCuentaPorPagarAction({
      numeroFactura: 'FAC-001',
      tipo: 'compra',
      proveedorId: 'prov-2',
      proveedorNombre: 'Proveedor B',
      montoDeuda: 200,
    })

    expect(result.success).toBe(true)
    // Verificar que findFirst buscó con proveedorId
    const findCall = prismaMock.cuentaPorPagar.findFirst.mock.calls[0][0]
    expect(findCall.where.proveedorId).toBe('prov-2')
    expect(findCall.where.numeroFactura).toBe('FAC-001')
  })

  it('retorna AUTH_REQUIRED cuando el usuario no está autenticado', async () => {
    getCurrentUserMock.mockResolvedValue(null)

    const result = await createCuentaPorPagarAction({
      numeroFactura: 'FAC-002',
      tipo: 'compra',
      proveedorId: 'prov-1',
      montoDeuda: 100,
    })

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('AUTH_REQUIRED')
  })
})
