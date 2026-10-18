import { describe, it, expect, vi, beforeEach } from 'vitest'
import { expectActionFailure, expectActionSuccess } from '@/test/action-response'
import type { AuthenticatedUser } from '@/lib/auth-middleware'
import {
  bulkApplyPercentageAction,
  bulkApplyTemplateAction,
} from '../actions-bulk'

// Mock de dependencias
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// La sesion se resuelve dentro del withAction real; solo se fija el usuario.
vi.mock('@/lib/server-actions/get-current-user')

vi.mock('@/lib/prisma', () => ({
  prisma: {
    producto: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    productoCostSheetTemplate: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

// Mock parcial: solo se fija el tenant activo. La guarda de feature, el
// permiso y el resto de guardas se ejecutan de verdad contra la fixture
// (rol admin + plan con subfeature).
vi.mock('@/lib/services/tenant-scope', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/services/tenant-scope')>()),
  requireTenant: vi.fn(() => 'tenant-1'),
}))

vi.mock('@/lib/cost-history-utils', () => ({
  recordCostChange: vi.fn(() => Promise.resolve({ id: 'history-1', productoId: 'prod-1' })),
  CostChangeReason: {
    ADJUSTMENT: 'ADJUSTMENT',
    MANUAL_EDIT: 'MANUAL_EDIT',
  },
}))

import { getCurrentUser } from '@/lib/server-actions/get-current-user'
import { prisma } from '@/lib/prisma'
import { recordCostChange } from '@/lib/cost-history-utils'

const mockUser: AuthenticatedUser = {
  userId: 'user-1',
  name: 'Usuario Bulk',
  email: 'bulk@test.com',
  isActive: true,
  tenantId: 'tenant-1',
  planFeatures: { 'ficha-costo': true, 'ficha-costo-bulk': true },
  tenantRole: 'manager',
  role: 'admin',
}

describe('bulkApplyPercentageAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
  })

  it('debe validar que porcentaje sea mayor a -100', async () => {
    const failure = expectActionFailure(
      await bulkApplyPercentageAction(
        { porcentaje: -101, productoIds: ['prod-1'] },
      ),
    )
    expect(failure.error.message).toContain('porcentaje')
  })

  it('debe validar que porcentaje sea menor a 1000', async () => {
    const failure = expectActionFailure(
      await bulkApplyPercentageAction(
        { porcentaje: 1001, productoIds: ['prod-1'] },
      ),
    )
    expect(failure.error.message).toContain('porcentaje')
  })

  it('debe retornar early si no hay productoIds', async () => {
    const result = expectActionSuccess(await bulkApplyPercentageAction(
      { porcentaje: 10, productoIds: [] },
    )).data

    expect(result).toEqual({
      updated: 0,
      skipped: [],
      errors: [],
      results: [],
    })
    expect(prisma.producto.findMany).not.toHaveBeenCalled()
  })

  it('debe aplicar porcentaje a productos existentes', async () => {
    vi.mocked(prisma.producto.findMany).mockResolvedValue([
      { id: 'prod-1', precioVenta: 1000, precioCosto: 500, tenantId: 'tenant-1' },
      { id: 'prod-2', precioVenta: 2000, precioCosto: 1000, tenantId: 'tenant-1' },
    ] as any)

    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      if (typeof fn === 'function') return fn(prisma)
      return fn
    })

    vi.mocked(prisma.producto.updateMany).mockResolvedValue({ count: 1 } as any)

    const result = expectActionSuccess(await bulkApplyPercentageAction(
      { porcentaje: 10, productoIds: ['prod-1', 'prod-2'] },
    )).data

    expect(result.updated).toBe(2)
    expect(result.results).toHaveLength(2)
    expect(result.results[0].newPrecio).toBe(1100)
    expect(recordCostChange).toHaveBeenCalledTimes(2)
  })

  it('debe filtrar productos por tenantId', async () => {
    vi.mocked(prisma.producto.findMany).mockResolvedValue([
      { id: 'prod-1', precioVenta: 1000, precioCosto: 500, tenantId: 'tenant-1' },
    ] as any)

    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      if (typeof fn === 'function') return fn(prisma)
      return fn
    })

    vi.mocked(prisma.producto.updateMany).mockResolvedValue({ count: 1 } as any)

    await bulkApplyPercentageAction(
      { porcentaje: 10, productoIds: ['prod-1', 'prod-2'] },
    )

    expect(prisma.producto.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['prod-1', 'prod-2'] },
        tenantId: 'tenant-1',
      },
      select: { id: true, precioVenta: true, precioCosto: true },
    })
  })

  it('debe reportar productos no encontrados como skipped', async () => {
    vi.mocked(prisma.producto.findMany).mockResolvedValue([
      { id: 'prod-1', precioVenta: 1000, precioCosto: 500 },
    ] as any)

    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      if (typeof fn === 'function') return fn(prisma)
      return fn
    })

    vi.mocked(prisma.producto.updateMany).mockResolvedValue({ count: 1 } as any)

    const result = expectActionSuccess(await bulkApplyPercentageAction(
      { porcentaje: 10, productoIds: ['prod-1', 'prod-2'] },
    )).data

    expect(result.updated).toBe(1)
    expect(result.skipped).toHaveLength(1)
    expect(result.skipped[0]).toEqual({
      productoId: 'prod-2',
      message: 'Producto no encontrado o sin permisos',
    })
    expect(result.errors).toHaveLength(0)
  })

  it('debe usar Math.round para precios enteros', async () => {
    vi.mocked(prisma.producto.findMany).mockResolvedValue([
      { id: 'prod-1', precioVenta: 1000, precioCosto: 500, tenantId: 'tenant-1' },
    ] as any)

    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      if (typeof fn === 'function') return fn(prisma)
      return fn
    })

    vi.mocked(prisma.producto.updateMany).mockResolvedValue({ count: 1 } as any)

    await bulkApplyPercentageAction(
      { porcentaje: 3.33, productoIds: ['prod-1'] },
    )

    expect(prisma.producto.updateMany).toHaveBeenCalledWith({
      where: { id: 'prod-1', tenantId: 'tenant-1', precioVenta: 1000 },
      data: { precioVenta: 1033 },
    })
  })

  it('debe procesar transacciones atómicas por producto en chunks de 50', async () => {
    let activeTransactions = 0
    let maxActiveTransactions = 0
    const productoIds = Array.from({ length: 120 }, (_, i) => `prod-${i}`)
    const productos = productoIds.map((id) => ({
      id,
      precioVenta: 1000,
      precioCosto: 500,
      tenantId: 'tenant-1',
    }))

    vi.mocked(prisma.producto.findMany).mockResolvedValue(productos as any)
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      activeTransactions += 1
      maxActiveTransactions = Math.max(maxActiveTransactions, activeTransactions)
      try {
        await new Promise((resolve) => setTimeout(resolve, 1))
        if (typeof fn === 'function') return await fn(prisma)
        return fn
      } finally {
        activeTransactions -= 1
      }
    })
    vi.mocked(prisma.producto.updateMany).mockResolvedValue({ count: 1 } as any)

    const result = expectActionSuccess(await bulkApplyPercentageAction(
      { porcentaje: 10, productoIds },
    )).data

    expect(result.updated).toBe(120)
    expect(prisma.$transaction).toHaveBeenCalledTimes(120)
    expect(maxActiveTransactions).toBe(5)
  })

  it('debe manejar errores parciales sin abortar', async () => {
    vi.mocked(prisma.producto.findMany).mockResolvedValue([
      { id: 'prod-1', precioVenta: 1000, precioCosto: 500, tenantId: 'tenant-1' },
      { id: 'prod-2', precioVenta: 2000, precioCosto: 1000, tenantId: 'tenant-1' },
    ] as any)

    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      if (typeof fn === 'function') return fn(prisma)
      return fn
    })

    vi.mocked(prisma.producto.updateMany)
      .mockResolvedValueOnce({ count: 1 } as any)
      .mockRejectedValueOnce(new Error('DB error'))

    const result = expectActionSuccess(await bulkApplyPercentageAction(
      { porcentaje: 10, productoIds: ['prod-1', 'prod-2'] },
    )).data

    expect(result.updated).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].productoId).toBe('prod-2')
  })

  it('debe revertir el precio si falla la auditoría y permitir un reintento limpio', async () => {
    let persistedPrice = 1000
    const txClient = {
      producto: {
        updateMany: vi.fn(async ({ where, data }) => {
          if (where.precioVenta !== persistedPrice) return { count: 0 }
          persistedPrice = data.precioVenta as number
          return { count: 1 }
        }),
      },
    }
    vi.mocked(prisma.producto.findMany).mockResolvedValue([
      { id: 'prod-1', precioVenta: 1000, precioCosto: 500, tenantId: 'tenant-1' },
    ] as any)
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      const priceBeforeTransaction = persistedPrice
      try {
        if (typeof fn === 'function') return await fn(txClient as any)
        return fn
      } catch (error) {
        persistedPrice = priceBeforeTransaction
        throw error
      }
    })
    vi.mocked(recordCostChange)
      .mockRejectedValueOnce(new Error('Audit unavailable'))
      .mockResolvedValueOnce({ id: 'history-1', productoId: 'prod-1' } as any)

    const failedAttempt = expectActionSuccess(await bulkApplyPercentageAction(
      { porcentaje: 10, productoIds: ['prod-1'] },
    )).data

    expect(failedAttempt).toEqual(expect.objectContaining({
      updated: 0,
      results: [],
      errors: [{ productoId: 'prod-1', message: 'Audit unavailable' }],
    }))
    expect(persistedPrice).toBe(1000)
    expect(recordCostChange).toHaveBeenCalledWith(txClient, expect.anything())
    expect(prisma.producto.updateMany).not.toHaveBeenCalled()

    const retry = expectActionSuccess(await bulkApplyPercentageAction(
      { porcentaje: 10, productoIds: ['prod-1'] },
    )).data

    expect(retry.updated).toBe(1)
    expect(persistedPrice).toBe(1100)
  })

  it('debe rechazar un precio que cambió después de la lectura sin crear historial', async () => {
    const txClient = {
      producto: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    }
    vi.mocked(prisma.producto.findMany).mockResolvedValue([
      { id: 'prod-1', precioVenta: 1000, precioCosto: 500, tenantId: 'tenant-1' },
    ] as any)
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      if (typeof fn === 'function') return fn(txClient as any)
      return fn
    })

    const result = expectActionSuccess(await bulkApplyPercentageAction(
      { porcentaje: 10, productoIds: ['prod-1'] },
    )).data

    expect(txClient.producto.updateMany).toHaveBeenCalledWith({
      where: { id: 'prod-1', tenantId: 'tenant-1', precioVenta: 1000 },
      data: { precioVenta: 1100 },
    })
    expect(recordCostChange).not.toHaveBeenCalled()
    expect(result.updated).toBe(0)
    expect(result.errors[0]).toEqual({
      productoId: 'prod-1',
      message: 'El precio cambió durante el ajuste; vuelve a intentarlo',
    })
  })
})

describe('bulkApplyTemplateAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
  })

  it('debe retornar early si no hay productoIds', async () => {
    const result = expectActionSuccess(await bulkApplyTemplateAction(
      { plantillaId: 'template-1', productoIds: [] },
    )).data

    expect(result).toEqual({
      updated: 0,
      skipped: [],
      errors: [],
      results: [],
    })
  })

  it('debe buscar plantilla una sola vez', async () => {
    vi.mocked(prisma.productoCostSheetTemplate.findFirst).mockResolvedValue({
      id: 'template-1',
      precioSugerido: 1500,
      tenantId: 'tenant-1',
    } as any)

    vi.mocked(prisma.producto.findMany).mockResolvedValue([
      { id: 'prod-1', precioVenta: 1000, precioCosto: 500, tenantId: 'tenant-1' },
      { id: 'prod-2', precioVenta: 2000, precioCosto: 1000, tenantId: 'tenant-1' },
    ] as any)

    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      if (typeof fn === 'function') return fn(prisma)
      return fn
    })

    vi.mocked(prisma.producto.updateMany).mockResolvedValue({ count: 1 } as any)

    await bulkApplyTemplateAction(
      { plantillaId: 'template-1', productoIds: ['prod-1', 'prod-2'] },
    )

    expect(prisma.productoCostSheetTemplate.findFirst).toHaveBeenCalledTimes(1)
  })

  it('debe filtrar plantilla por tenantId', async () => {
    vi.mocked(prisma.productoCostSheetTemplate.findFirst).mockResolvedValue({
      id: 'template-1',
      precioSugerido: 1500,
      tenantId: 'tenant-1',
    } as any)

    vi.mocked(prisma.producto.findMany).mockResolvedValue([])

    await bulkApplyTemplateAction(
      { plantillaId: 'template-1', productoIds: ['prod-1'] },
    )

    expect(prisma.productoCostSheetTemplate.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'template-1',
        tenantId: 'tenant-1',
      },
      select: { id: true, precioSugerido: true, tenantId: true },
    })
  })

  it('debe lanzar error si plantilla no existe', async () => {
    vi.mocked(prisma.productoCostSheetTemplate.findFirst).mockResolvedValue(null)

    const failure = expectActionFailure(
      await bulkApplyTemplateAction(
        { plantillaId: 'template-1', productoIds: ['prod-1'] },
      ),
    )
    expect(failure.error.message).toContain('Plantilla no encontrada')
  })

  it('debe aplicar precioSugerido a todos los productos', async () => {
    vi.mocked(prisma.productoCostSheetTemplate.findFirst).mockResolvedValue({
      id: 'template-1',
      precioSugerido: 1500,
      tenantId: 'tenant-1',
    } as any)

    vi.mocked(prisma.producto.findMany).mockResolvedValue([
      { id: 'prod-1', precioVenta: 1000, precioCosto: 500, tenantId: 'tenant-1' },
      { id: 'prod-2', precioVenta: 2000, precioCosto: 1000, tenantId: 'tenant-1' },
    ] as any)

    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      if (typeof fn === 'function') return fn(prisma)
      return fn
    })

    vi.mocked(prisma.producto.updateMany).mockResolvedValue({ count: 1 } as any)

    const result = expectActionSuccess(await bulkApplyTemplateAction(
      { plantillaId: 'template-1', productoIds: ['prod-1', 'prod-2'] },
    )).data

    expect(result.updated).toBe(2)
    expect(prisma.producto.updateMany).toHaveBeenCalledWith({
      where: { id: 'prod-1', tenantId: 'tenant-1', precioVenta: 1000 },
      data: { precioVenta: 1500 },
    })
  })

  it('debe usar CostChangeReason.MANUAL_EDIT con nota descriptiva', async () => {
    vi.mocked(prisma.productoCostSheetTemplate.findFirst).mockResolvedValue({
      id: 'template-1',
      precioSugerido: 1500,
      tenantId: 'tenant-1',
    } as any)

    vi.mocked(prisma.producto.findMany).mockResolvedValue([
      { id: 'prod-1', precioVenta: 1000, precioCosto: 500, tenantId: 'tenant-1' },
    ] as any)

    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      if (typeof fn === 'function') return fn(prisma)
      return fn
    })

    vi.mocked(prisma.producto.updateMany).mockResolvedValue({ count: 1 } as any)

    await bulkApplyTemplateAction(
      { plantillaId: 'template-1', productoIds: ['prod-1'] },
    )

    expect(recordCostChange).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        reason: 'MANUAL_EDIT',
        notes: 'Plantilla aplicada masivamente',
      })
    )
  })

  it('debe reportar productos no encontrados como skipped', async () => {
    vi.mocked(prisma.productoCostSheetTemplate.findFirst).mockResolvedValue({
      id: 'template-1',
      precioSugerido: 1500,
      tenantId: 'tenant-1',
    } as any)

    vi.mocked(prisma.producto.findMany).mockResolvedValue([
      { id: 'prod-1', precioVenta: 1000, precioCosto: 500 },
    ] as any)

    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      if (typeof fn === 'function') return fn(prisma)
      return fn
    })

    vi.mocked(prisma.producto.updateMany).mockResolvedValue({ count: 1 } as any)

    const result = expectActionSuccess(await bulkApplyTemplateAction(
      { plantillaId: 'template-1', productoIds: ['prod-1', 'prod-2'] },
    )).data

    expect(result.updated).toBe(1)
    expect(result.skipped).toHaveLength(1)
    expect(result.skipped[0].productoId).toBe('prod-2')
    expect(result.errors).toHaveLength(0)
  })

  it('debe revertir el precio de plantilla si falla la auditoría', async () => {
    let persistedPrice = 1000
    const txClient = {
      producto: {
        updateMany: vi.fn(async ({ data }) => {
          persistedPrice = data.precioVenta as number
          return { count: 1 }
        }),
      },
    }
    vi.mocked(prisma.productoCostSheetTemplate.findFirst).mockResolvedValue({
      id: 'template-1',
      precioSugerido: 1500,
      tenantId: 'tenant-1',
    } as any)
    vi.mocked(prisma.producto.findMany).mockResolvedValue([
      { id: 'prod-1', precioVenta: 1000, precioCosto: 500, tenantId: 'tenant-1' },
    ] as any)
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      const priceBeforeTransaction = persistedPrice
      try {
        if (typeof fn === 'function') return await fn(txClient as any)
        return fn
      } catch (error) {
        persistedPrice = priceBeforeTransaction
        throw error
      }
    })
    vi.mocked(recordCostChange).mockRejectedValueOnce(new Error('Audit unavailable'))

    const result = expectActionSuccess(await bulkApplyTemplateAction(
      { plantillaId: 'template-1', productoIds: ['prod-1'] },
    )).data

    expect(result).toEqual(expect.objectContaining({
      updated: 0,
      results: [],
      errors: [{ productoId: 'prod-1', message: 'Audit unavailable' }],
    }))
    expect(persistedPrice).toBe(1000)
    expect(recordCostChange).toHaveBeenCalledWith(txClient, expect.anything())
    expect(prisma.producto.updateMany).not.toHaveBeenCalled()
  })

  it('debe rechazar una plantilla si el precio cambió concurrentemente', async () => {
    const txClient = {
      producto: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    }
    vi.mocked(prisma.productoCostSheetTemplate.findFirst).mockResolvedValue({
      id: 'template-1',
      precioSugerido: 1500,
      tenantId: 'tenant-1',
    } as any)
    vi.mocked(prisma.producto.findMany).mockResolvedValue([
      { id: 'prod-1', precioVenta: 1000, precioCosto: 500, tenantId: 'tenant-1' },
    ] as any)
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      if (typeof fn === 'function') return fn(txClient as any)
      return fn
    })

    const result = expectActionSuccess(await bulkApplyTemplateAction(
      { plantillaId: 'template-1', productoIds: ['prod-1'] },
    )).data

    expect(recordCostChange).not.toHaveBeenCalled()
    expect(result.updated).toBe(0)
    expect(result.errors[0].message).toContain('precio cambió')
  })
})

describe('Feature gate estricto: ficha-costo-bulk', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
  })

  it('deniega bulk si falta la subfeature antes de consultar Prisma', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      ...mockUser,
      planFeatures: { 'ficha-costo': true, 'ficha-costo-bulk': false },
    })

    const failure = expectActionFailure(
      await bulkApplyPercentageAction(
        { porcentaje: 10, productoIds: ['prod-1'] },
      ),
    )
    expect(failure.error.message).toContain('plan actual no incluye')
    expect(prisma.producto.findMany).not.toHaveBeenCalled()
  })

  it('prioriza el plan sobre el rol y no consulta Prisma', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      ...mockUser,
      tenantRole: 'economico',
      planFeatures: { 'ficha-costo': true, 'ficha-costo-bulk': false },
    })

    const failure = expectActionFailure(
      await bulkApplyPercentageAction(
        { porcentaje: 10, productoIds: ['prod-1'] },
      ),
    )
    expect(failure.error).toMatchObject({ code: 'FEATURE_NOT_AVAILABLE' })
    expect(prisma.producto.findMany).not.toHaveBeenCalled()
  })
})
