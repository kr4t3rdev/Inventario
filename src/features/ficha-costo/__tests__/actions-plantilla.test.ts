import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/server-actions/get-current-user')
vi.mock('@/lib/services/tenant-scope', () => ({
  requireTenant: vi.fn((u: any) => u.tenantId),
  requireFeature: vi.fn(),
  requireManagerRole: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn((ops: any[]) => Promise.all(ops)),
    producto: { findFirst: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    productoCostSheetTemplate: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findFirstOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}))

import { getCurrentUser } from '@/lib/server-actions/get-current-user'
import { prisma } from '@/lib/prisma'
import {
  getPlantillasAction,
  getPlantillaActivaAction,
  createPlantillaAction,
  updatePlantillaAction,
  activarPlantillaAction,
  deletePlantillaAction,
  aplicarPrecioSugeridoAction,
} from '../actions-plantilla'
import type { AuthenticatedUser } from '@/lib/auth-middleware'

const mockUser: AuthenticatedUser = {
  userId: 'u-1',
  name: 'Tester',
  email: 't@test.com',
  role: 'admin' as AuthenticatedUser['role'],
  isActive: true,
  tenantId: 'tenant-A',
  tenantRole: 'manager',
}

const PLANTILLA_BASE = {
  id: 'tpl-1',
  tenantId: 'tenant-A',
  productoId: 'prod-1',
  version: 1,
  nombre: 'Plantilla base',
  costoMateriales: 100,
  costoManoObra: 50,
  costoIndirectos: 25,
  margenObjetivo: 0.30,
  precioSugerido: 250,
  esActiva: false,
  notas: null,
  createdAt: new Date('2026-06-01'),
  updatedAt: new Date('2026-06-01'),
  createdById: 'u-1',
}

describe('actions-plantilla', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getPlantillasAction: lista plantillas de un producto', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({ id: 'prod-1' } as any)
    vi.mocked(prisma.productoCostSheetTemplate.findMany).mockResolvedValue([
      PLANTILLA_BASE,
      { ...PLANTILLA_BASE, id: 'tpl-2', version: 2, esActiva: true },
    ] as any)

    const result = await getPlantillasAction({ productoId: 'prod-1' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toHaveLength(2)
      expect(result.data[1].esActiva).toBe(true)
    }
  })

  it('getPlantillaActivaAction: devuelve la plantilla activa', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({ id: 'prod-1' } as any)
    vi.mocked(prisma.productoCostSheetTemplate.findFirst).mockResolvedValue({
      ...PLANTILLA_BASE,
      esActiva: true,
    } as any)

    const result = await getPlantillaActivaAction({ productoId: 'prod-1' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.plantilla).not.toBeNull()
      expect(result.data.plantilla?.esActiva).toBe(true)
      expect(result.data.costoTotal).toBe(175)
    }
  })

  it('getPlantillaActivaAction: sin plantilla activa devuelve null', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({ id: 'prod-1' } as any)
    vi.mocked(prisma.productoCostSheetTemplate.findFirst).mockResolvedValue(null)

    const result = await getPlantillaActivaAction({ productoId: 'prod-1' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.plantilla).toBeNull()
    }
  })

  it('createPlantillaAction: crea plantilla y calcula precio sugerido', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({ id: 'prod-1' } as any)
    vi.mocked(prisma.productoCostSheetTemplate.count).mockResolvedValue(2)
    vi.mocked(prisma.productoCostSheetTemplate.create).mockResolvedValue({
      ...PLANTILLA_BASE,
      id: 'tpl-new',
      version: 3,
      precioSugerido: 285.71,
    } as any)

    const result = await createPlantillaAction({
      productoId: 'prod-1',
      nombre: 'Nueva plantilla',
      costoMateriales: 150,
      costoManoObra: 50,
      costoIndirectos: 25,
      margenObjetivo: 0.30,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.version).toBe(3)
      expect(result.data.precioSugerido).toBeCloseTo(285.71, 1)
    }
  })

  it('updatePlantillaAction: actualiza notas de plantilla', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.productoCostSheetTemplate.findFirst).mockResolvedValue({
      ...PLANTILLA_BASE,
      tenantId: 'tenant-A',
    } as any)
    vi.mocked(prisma.productoCostSheetTemplate.update).mockResolvedValue({
      ...PLANTILLA_BASE,
      notas: 'Notas actualizadas',
    } as any)

    const result = await updatePlantillaAction({
      plantillaId: 'tpl-1',
      notas: 'Notas actualizadas',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.notas).toBe('Notas actualizadas')
    }
  })

  it('activarPlantillaAction: activa una y desactiva la anterior', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.productoCostSheetTemplate.findFirst).mockResolvedValue({
      ...PLANTILLA_BASE,
      tenantId: 'tenant-A',
      productoId: 'prod-1',
    } as any)
    vi.mocked(prisma.productoCostSheetTemplate.updateMany).mockResolvedValue({ count: 1 } as any)
    vi.mocked(prisma.productoCostSheetTemplate.update).mockResolvedValue({
      ...PLANTILLA_BASE,
      esActiva: true,
    } as any)
    vi.mocked(prisma.productoCostSheetTemplate.findFirstOrThrow).mockResolvedValue({
      ...PLANTILLA_BASE,
      esActiva: true,
    } as any)

    const result = await activarPlantillaAction({
      plantillaId: 'tpl-1',
      productoId: 'prod-1',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.esActiva).toBe(true)
      expect(prisma.productoCostSheetTemplate.updateMany).toHaveBeenCalled()
    }
  })

  it('deletePlantillaAction: elimina plantilla no activa', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.productoCostSheetTemplate.findFirst).mockResolvedValue({
      ...PLANTILLA_BASE,
      tenantId: 'tenant-A',
      esActiva: false,
    } as any)
    vi.mocked(prisma.productoCostSheetTemplate.delete).mockResolvedValue(PLANTILLA_BASE as any)

    const result = await deletePlantillaAction({ plantillaId: 'tpl-1' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.id).toBe('tpl-1')
    }
  })

  it('deletePlantillaAction: rechaza eliminar plantilla activa', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.productoCostSheetTemplate.findFirst).mockResolvedValue({
      ...PLANTILLA_BASE,
      tenantId: 'tenant-A',
      esActiva: true,
    } as any)

    const result = await deletePlantillaAction({ plantillaId: 'tpl-1' })
    expect(result.success).toBe(false)
  })

  it('aplicarPrecioSugeridoAction: actualiza precioVenta del producto', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.productoCostSheetTemplate.findFirst).mockResolvedValue({
      ...PLANTILLA_BASE,
      tenantId: 'tenant-A',
      productoId: 'prod-1',
      esActiva: true,
      precioSugerido: 250,
    } as any)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({
      id: 'prod-1',
      tenantId: 'tenant-A',
      precioCosto: 100,
      precioVenta: 200,
    } as any)
    vi.mocked(prisma.producto.update).mockResolvedValue({
      id: 'prod-1',
      precioVenta: 250,
    } as any)

    const result = await aplicarPrecioSugeridoAction({
      plantillaId: 'tpl-1',
      productoId: 'prod-1',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.precioVenta).toBe(250)
      expect(prisma.producto.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ precioVenta: 250 }),
        }),
      )
    }
  })

  it('multi-tenant: producto de otro tenant → NOT_FOUND', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue(null)

    const result = await getPlantillasAction({ productoId: 'prod-otro' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.code).toBe('NOT_FOUND')
  })
})
