import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  bulkApplyPercentageAction,
  bulkApplyTemplateAction,
} from '../actions-bulk'

// Mock de dependencias
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    producto: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    productoCostSheetTemplate: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/server-actions', () => ({
  withAction: (fn: any) => fn,
  ActionError: class ActionError extends Error {
    code: string
    constructor(message: string, code: string) {
      super(message)
      this.code = code
    }
  },
}))

const mockRequireFeature = vi.fn()

vi.mock('@/lib/services/tenant-scope', () => ({
  requireTenant: vi.fn(() => 'tenant-1'),
  requireManagerRole: vi.fn(() => true),
  requireFeature: (...args: any[]) => mockRequireFeature(...args),
}))

vi.mock('@/lib/cost-history-utils', () => ({
  recordCostChange: vi.fn(() => Promise.resolve({ id: 'history-1', productoId: 'prod-1' })),
  CostChangeReason: {
    ADJUSTMENT: 'ADJUSTMENT',
    MANUAL_EDIT: 'MANUAL_EDIT',
  },
}))

import { prisma } from '@/lib/prisma'
import { recordCostChange } from '@/lib/cost-history-utils'

const mockUser = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  tenantRole: 'manager',
  role: 'user',
} as any

describe('bulkApplyPercentageAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('debe validar que porcentaje sea mayor a 0', async () => {
    await expect(
      bulkApplyPercentageAction(
        { porcentaje: 0, productoIds: ['prod-1'] },
        mockUser,
      ),
    ).rejects.toThrow('porcentaje')
  })

  it('debe validar que porcentaje sea menor a 1000', async () => {
    await expect(
      bulkApplyPercentageAction(
        { porcentaje: 1001, productoIds: ['prod-1'] },
        mockUser,
      ),
    ).rejects.toThrow('porcentaje')
  })

  it('debe retornar early si no hay productoIds', async () => {
    const result = await bulkApplyPercentageAction(
      { porcentaje: 10, productoIds: [] },
      mockUser,
    )

    expect(result).toEqual({
      updated: 0,
      skipped: 0,
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

    vi.mocked(prisma.producto.update).mockResolvedValue({
      id: 'prod-1',
      precioVenta: 1100,
    } as any)

    const result = await bulkApplyPercentageAction(
      { porcentaje: 10, productoIds: ['prod-1', 'prod-2'] },
      mockUser,
    )

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

    vi.mocked(prisma.producto.update).mockResolvedValue({
      id: 'prod-1',
      precioVenta: 1100,
    } as any)

    await bulkApplyPercentageAction(
      { porcentaje: 10, productoIds: ['prod-1', 'prod-2'] },
      mockUser,
    )

    expect(prisma.producto.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['prod-1', 'prod-2'] },
        tenantId: 'tenant-1',
      },
      select: { id: true, precioVenta: true, precioCosto: true, tenantId: true },
    })
  })

  it('debe reportar productos no encontrados como skipped', async () => {
    vi.mocked(prisma.producto.findMany).mockResolvedValue([
      { id: 'prod-1', precioVenta: 1000, precioCosto: 500, tenantId: 'tenant-1' },
    ] as any)

    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      if (typeof fn === 'function') return fn(prisma)
      return fn
    })

    vi.mocked(prisma.producto.update).mockResolvedValue({
      id: 'prod-1',
      precioVenta: 1100,
    } as any)

    const result = await bulkApplyPercentageAction(
      { porcentaje: 10, productoIds: ['prod-1', 'prod-2'] },
      mockUser,
    )

    expect(result.updated).toBe(1)
    expect(result.skipped).toBe(1)
    expect(result.errors).toContainEqual({
      productoId: 'prod-2',
      message: 'Producto no encontrado o sin permisos',
    })
  })

  it('debe usar Math.round para precios enteros', async () => {
    vi.mocked(prisma.producto.findMany).mockResolvedValue([
      { id: 'prod-1', precioVenta: 1000, precioCosto: 500, tenantId: 'tenant-1' },
    ] as any)

    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      if (typeof fn === 'function') return fn(prisma)
      return fn
    })

    vi.mocked(prisma.producto.update).mockResolvedValue({
      id: 'prod-1',
      precioVenta: 1033,
    } as any)

    await bulkApplyPercentageAction(
      { porcentaje: 3.33, productoIds: ['prod-1'] },
      mockUser,
    )

    expect(prisma.producto.update).toHaveBeenCalledWith({
      where: { id: 'prod-1' },
      data: { precioVenta: 1033 },
    })
  })

  it('debe procesar en chunks de 50 productos', async () => {
    const productoIds = Array.from({ length: 120 }, (_, i) => `prod-${i}`)
    const productos = productoIds.map((id) => ({
      id,
      precioVenta: 1000,
      precioCosto: 500,
      tenantId: 'tenant-1',
    }))

    vi.mocked(prisma.producto.findMany).mockResolvedValue(productos as any)
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      if (typeof fn === 'function') return fn(prisma)
      return fn
    })
    vi.mocked(prisma.producto.update).mockResolvedValue({
      id: 'prod-1',
      precioVenta: 1100,
    } as any)

    const result = await bulkApplyPercentageAction(
      { porcentaje: 10, productoIds },
      mockUser,
    )

    expect(result.updated).toBe(120)
    expect(prisma.$transaction).toHaveBeenCalledTimes(3) // 50 + 50 + 20
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

    vi.mocked(prisma.producto.update)
      .mockResolvedValueOnce({ id: 'prod-1', precioVenta: 1100 } as any)
      .mockRejectedValueOnce(new Error('DB error'))

    const result = await bulkApplyPercentageAction(
      { porcentaje: 10, productoIds: ['prod-1', 'prod-2'] },
      mockUser,
    )

    expect(result.updated).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].productoId).toBe('prod-2')
  })
})

describe('bulkApplyTemplateAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('debe retornar early si no hay productoIds', async () => {
    const result = await bulkApplyTemplateAction(
      { plantillaId: 'template-1', productoIds: [] },
      mockUser,
    )

    expect(result).toEqual({
      updated: 0,
      skipped: 0,
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

    vi.mocked(prisma.producto.update).mockResolvedValue({
      id: 'prod-1',
      precioVenta: 1500,
    } as any)

    await bulkApplyTemplateAction(
      { plantillaId: 'template-1', productoIds: ['prod-1', 'prod-2'] },
      mockUser,
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
      mockUser,
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

    await expect(
      bulkApplyTemplateAction(
        { plantillaId: 'template-1', productoIds: ['prod-1'] },
        mockUser,
      ),
    ).rejects.toThrow('Plantilla no encontrada')
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

    vi.mocked(prisma.producto.update).mockResolvedValue({
      id: 'prod-1',
      precioVenta: 1500,
    } as any)

    const result = await bulkApplyTemplateAction(
      { plantillaId: 'template-1', productoIds: ['prod-1', 'prod-2'] },
      mockUser,
    )

    expect(result.updated).toBe(2)
    expect(prisma.producto.update).toHaveBeenCalledWith({
      where: { id: 'prod-1' },
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

    vi.mocked(prisma.producto.update).mockResolvedValue({
      id: 'prod-1',
      precioVenta: 1500,
    } as any)

    await bulkApplyTemplateAction(
      { plantillaId: 'template-1', productoIds: ['prod-1'] },
      mockUser,
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
      { id: 'prod-1', precioVenta: 1000, precioCosto: 500, tenantId: 'tenant-1' },
    ] as any)

    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      if (typeof fn === 'function') return fn(prisma)
      return fn
    })

    vi.mocked(prisma.producto.update).mockResolvedValue({
      id: 'prod-1',
      precioVenta: 1500,
    } as any)

    const result = await bulkApplyTemplateAction(
      { plantillaId: 'template-1', productoIds: ['prod-1', 'prod-2'] },
      mockUser,
    )

    expect(result.updated).toBe(1)
    expect(result.skipped).toBe(1)
  })
})

describe('Feature gate: ficha-costo-bulk', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('debe invocar requireFeature con ficha-costo-bulk en bulkApplyPercentageAction', async () => {
    vi.mocked(prisma.producto.findMany).mockResolvedValue([])

    await bulkApplyPercentageAction(
      { porcentaje: 10, productoIds: ['prod-1'] },
      mockUser,
    )

    expect(mockRequireFeature).toHaveBeenCalledWith(
      mockUser,
      'ficha-costo-bulk',
      'ajustar precios masivamente',
    )
  })

  it('debe invocar requireFeature con ficha-costo-bulk en bulkApplyTemplateAction', async () => {
    vi.mocked(prisma.productoCostSheetTemplate.findFirst).mockResolvedValue({
      id: 'template-1',
      precioSugerido: 1500,
      tenantId: 'tenant-1',
    } as any)
    vi.mocked(prisma.producto.findMany).mockResolvedValue([])

    await bulkApplyTemplateAction(
      { plantillaId: 'template-1', productoIds: ['prod-1'] },
      mockUser,
    )

    expect(mockRequireFeature).toHaveBeenCalledWith(
      mockUser,
      'ficha-costo-bulk',
      'aplicar plantilla masivamente',
    )
  })

  it('debe lanzar error si requireFeature falla', async () => {
    mockRequireFeature.mockImplementationOnce(() => {
      throw new Error('Tu plan actual no incluye la funcionalidad')
    })

    await expect(
      bulkApplyPercentageAction(
        { porcentaje: 10, productoIds: ['prod-1'] },
        mockUser,
      ),
    ).rejects.toThrow('plan actual no incluye')
  })
})
