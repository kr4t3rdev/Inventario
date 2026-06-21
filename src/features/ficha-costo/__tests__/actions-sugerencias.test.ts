import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getSugerenciasPrecioAction, aplicarSugerenciaPrecioAction } from '../actions-sugerencias'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    producto: { findMany: vi.fn(), update: vi.fn() },
    productoCostSheetTemplate: { findFirst: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock('@/lib/server-actions', () => ({ withAction: (fn: any) => fn }))
vi.mock('@/lib/services/tenant-scope', () => ({
  requireTenant: vi.fn(() => 'tenant-1'),
  requireFeature: vi.fn(),
}))
vi.mock('@/lib/cost-history-utils', () => ({
  recordCostChange: vi.fn(() => Promise.resolve({ id: 'h-1', productoId: 'p1' })),
  CostChangeReason: { MANUAL_EDIT: 'MANUAL_EDIT' },
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { recordCostChange } from '@/lib/cost-history-utils'

const mockUser = { userId: 'user-1', tenantId: 'tenant-1' } as any

describe('getSugerenciasPrecioAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.productoCostSheetTemplate.findMany).mockResolvedValue([])
  })

  it('calcula precio sugerido para productos con costo y margen objetivo', async () => {
    vi.mocked(prisma.producto.findMany).mockResolvedValue([
      { id: 'p1', nombre: 'A', precioCosto: 100, precioVenta: 120 },
      { id: 'p2', nombre: 'B', precioCosto: 200, precioVenta: 240 },
    ] as any)
    vi.mocked(prisma.productoCostSheetTemplate.findFirst).mockResolvedValue(null)

    const data = await getSugerenciasPrecioAction({}, mockUser)

    expect(data).toHaveLength(2)
    expect(data[0].precioSugerido).toBe(130) // 100 * 1.30
    expect(data[1].precioSugerido).toBe(260) // 200 * 1.30
    expect(data[0].diffPorcentaje).toBeCloseTo(8.33, 1) // (130-120)/120 * 100
  })

  it('usa margenObjetivo de plantilla activa si existe', async () => {
    vi.mocked(prisma.producto.findMany).mockResolvedValue([
      { id: 'p1', nombre: 'A', precioCosto: 100, precioVenta: 120 },
    ] as any)
    vi.mocked(prisma.productoCostSheetTemplate.findMany).mockResolvedValue([
      { productoId: 'p1', margenObjetivo: 0.40 },
    ] as any)

    const data = await getSugerenciasPrecioAction({}, mockUser)

    expect(data[0].precioSugerido).toBe(140) // 100 * 1.40
  })

  it('excluye productos sin precioCosto', async () => {
    // Prisma filtra por precioCosto > 0, así que solo retorna el válido
    vi.mocked(prisma.producto.findMany).mockResolvedValue([
      { id: 'p2', nombre: 'B', precioCosto: 100, precioVenta: 240 },
    ] as any)
    vi.mocked(prisma.productoCostSheetTemplate.findFirst).mockResolvedValue(null)

    const data = await getSugerenciasPrecioAction({}, mockUser)

    expect(data).toHaveLength(1)
    expect(data[0].productoId).toBe('p2')
  })

  it('filtra por tenantId', async () => {
    vi.mocked(prisma.producto.findMany).mockResolvedValue([])

    await getSugerenciasPrecioAction({}, mockUser)

    expect(prisma.producto.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', precioCosto: { gt: 0 } },
      select: { id: true, nombre: true, precioCosto: true, precioVenta: true, codigoInterno: true },
    })
  })
})

describe('aplicarSugerenciaPrecioAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.productoCostSheetTemplate.findMany).mockResolvedValue([])
  })

  it('aplica precio sugerido y registra auditoría', async () => {
    vi.mocked(prisma.producto.findMany).mockResolvedValue([
      { id: 'p1', nombre: 'A', precioCosto: 100, precioVenta: 120 },
    ] as any)
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
      if (typeof fn === 'function') return fn(prisma)
      return fn
    })
    vi.mocked(prisma.producto.update).mockResolvedValue({ id: 'p1', precioVenta: 130 } as any)

    const data = await aplicarSugerenciaPrecioAction({ productoIds: ['p1'] }, mockUser)

    expect(data.updated).toBe(1)
    expect(recordCostChange).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ reason: 'MANUAL_EDIT' }),
    )
  })
})
