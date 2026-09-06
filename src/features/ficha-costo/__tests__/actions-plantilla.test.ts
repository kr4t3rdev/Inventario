import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/server-actions/get-current-user')
vi.mock('@/lib/services/tenant-scope', () => ({
  requireTenant: vi.fn((u: any) => u.tenantId),
  requireFeature: vi.fn(),
  requireManagerRole: vi.fn(),
  requirePermission: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/prisma', () => {
  const mockTx = {
    productoCostSheetTemplate: {
      findFirst: vi.fn(),
      findFirstOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
  }
  return {
    prisma: {
      $transaction: vi.fn((arg: any) => {
        if (typeof arg === 'function') return arg(mockTx)
        return Promise.all(arg)
      }),
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
  }
})

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
  planFeatures: { 'ficha-costo': true, 'ficha-costo-bulk': true },
  tenantRole: 'manager',
}

const LINE_ITEMS_BASE = [
  {
    id: 'li-1',
    concepto: 'Tela',
    descripcion: 'Algodón premium',
    cantidad: 2,
    costoUnitario: 30,
    categoria: 'materiales',
  },
  {
    id: 'li-2',
    concepto: 'Corte y confección',
    cantidad: 1,
    costoUnitario: 40,
    categoria: 'mano-obra',
  },
  {
    id: 'li-3',
    concepto: 'Logística',
    cantidad: 1,
    costoUnitario: 15,
    categoria: 'transporte',
  },
] as const

const LEGACY_NOTAS_JSON = JSON.stringify({
  _v: 1,
  lineItems: LINE_ITEMS_BASE,
  notas: 'Notas legacy',
})

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

  it('getPlantillasAction: hidrata lineItems, userNotes y costeTotal al listar', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({ id: 'prod-1' } as any)
    vi.mocked(prisma.productoCostSheetTemplate.findMany).mockResolvedValue([
      {
        ...PLANTILLA_BASE,
        notas: 'Nota visible para usuarios',
        lineItems: LINE_ITEMS_BASE,
      },
      {
        ...PLANTILLA_BASE,
        id: 'tpl-2',
        version: 2,
        esActiva: true,
        notas: 'Segunda nota',
        lineItems: LINE_ITEMS_BASE,
      },
    ] as any)

    const result = await getPlantillasAction({ productoId: 'prod-1' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toHaveLength(2)
      expect(result.data[1].esActiva).toBe(true)
      expect(result.data[0].lineItems).toEqual(LINE_ITEMS_BASE)
      expect(result.data[0].userNotes).toBe('Nota visible para usuarios')
      expect(result.data[0].costeTotal).toBe(115)
    }
  })

  it('getPlantillaActivaAction: devuelve la plantilla activa hidratada desde el documento real', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({
      id: 'prod-1',
      precioCosto: 90,
      precioVenta: 180,
    } as any)
    vi.mocked(prisma.productoCostSheetTemplate.findFirst).mockResolvedValue({
      ...PLANTILLA_BASE,
      esActiva: true,
      notas: 'Nota activa',
      lineItems: LINE_ITEMS_BASE,
      precioSugerido: 164.29,
    } as any)

    const result = await getPlantillaActivaAction({ productoId: 'prod-1' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.plantilla).not.toBeNull()
      expect(result.data.plantilla?.esActiva).toBe(true)
      expect(result.data.plantilla?.lineItems).toEqual(LINE_ITEMS_BASE)
      expect(result.data.plantilla?.userNotes).toBe('Nota activa')
      expect(result.data.costoTotal).toBe(115)
      expect(result.data.precioSugerido).toBeCloseTo(164.29, 2)
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

  it('getPlantillasAction: usa notas legacy serializadas cuando lineItems JSON sigue vacío', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({ id: 'prod-1' } as any)
    vi.mocked(prisma.productoCostSheetTemplate.findMany).mockResolvedValue([
      {
        ...PLANTILLA_BASE,
        notas: LEGACY_NOTAS_JSON,
        lineItems: [],
      },
    ] as any)

    const result = await getPlantillasAction({ productoId: 'prod-1' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data[0].lineItems).toEqual(LINE_ITEMS_BASE)
      expect(result.data[0].userNotes).toBe('Notas legacy')
      expect(result.data[0].userNotes).not.toContain('"_v":1')
      expect(result.data[0].costeTotal).toBe(115)
    }
  })

  it('getPlantillasAction: si una fila legacy no tiene documento, cae a los campos legacy para el total', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({ id: 'prod-1' } as any)
    vi.mocked(prisma.productoCostSheetTemplate.findMany).mockResolvedValue([
      {
        ...PLANTILLA_BASE,
        notas: 'Fila legacy sin documento',
        lineItems: null,
        costoMateriales: 80,
        costoManoObra: 30,
        costoIndirectos: 10,
      },
    ] as any)

    const result = await getPlantillasAction({ productoId: 'prod-1' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data[0].userNotes).toBe('Fila legacy sin documento')
      expect(result.data[0].costeTotal).toBe(120)
      expect(result.data[0].lineItems).toEqual([
        expect.objectContaining({ categoria: 'materiales', costoUnitario: 80 }),
        expect.objectContaining({ categoria: 'mano-obra', costoUnitario: 30 }),
        expect.objectContaining({ categoria: 'indirectos', costoUnitario: 10 }),
      ])
    }
  })

  it('versionado de plantillas: el schema permite historico y la migracion SQL fuerza una sola activa de forma atomica', async () => {
    const { readFile } = await import('node:fs/promises')
    const schemaPath = `${process.cwd()}/prisma/schema.prisma`
    const migrationPath = `${process.cwd()}/prisma/migrations/20260629030500_fix_cost_sheet_versioning/migration.sql`
    const [schema, migrationSql] = await Promise.all([
      readFile(schemaPath, 'utf8'),
      readFile(migrationPath, 'utf8'),
    ])

    expect(schema).toContain('@@unique([productoId, version])')
    expect(schema).not.toContain('@@unique([productoId, esActiva])')

    expect(migrationSql).toContain('BEGIN;')
    expect(migrationSql).toContain('COMMIT;')
    expect(migrationSql).toContain(
      'DROP INDEX IF EXISTS "ProductoCostSheetTemplate_productoId_esActiva_key"',
    )
    expect(migrationSql).toContain(
      'CREATE UNIQUE INDEX "ProductoCostSheetTemplate_productoId_version_key"',
    )
    expect(migrationSql).toContain(
      'ON "ProductoCostSheetTemplate"("productoId", "version")',
    )
    expect(migrationSql).toContain(
      'CREATE UNIQUE INDEX "ProductoCostSheetTemplate_productoId_active_key"',
    )
    expect(migrationSql).toContain('ON "ProductoCostSheetTemplate"("productoId")')
    expect(migrationSql).toContain('WHERE "esActiva" = true')
  })

  it('createPlantillaAction: persiste lineItems, deriva legacy fields y mantiene notas humanas', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({ id: 'prod-1' } as any)
    // Mock the transaction callback's inner findFirst
    vi.mocked(prisma.$transaction).mockImplementation(async (arg: any) => {
      if (typeof arg === 'function') {
        const tx = {
          productoCostSheetTemplate: {
            findFirst: vi.fn().mockResolvedValue({ version: 2 } as any),
            create: vi.fn().mockImplementation(async ({ data }: any) => ({
              ...PLANTILLA_BASE,
              ...data,
              id: 'tpl-new',
              version: 3,
              precioSugerido: 164.29,
              notas: data.notas,
              lineItems: data.lineItems,
            })),
          },
        }
        return arg(tx)
      }
      return Promise.all(arg)
    })

    const result = await createPlantillaAction({
      productoId: 'prod-1',
      nombre: 'Nueva plantilla',
      notas: 'Notas del usuario',
      lineItems: [...LINE_ITEMS_BASE],
      margenObjetivo: 0.30,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.version).toBe(3)
      expect(result.data.precioSugerido).toBeCloseTo(164.29, 1)
      expect(result.data.lineItems).toEqual(LINE_ITEMS_BASE)
      expect(result.data.userNotes).toBe('Notas del usuario')
      expect(result.data.costeTotal).toBe(115)
      expect(result.data.costoMateriales).toBe(60)
      expect(result.data.costoManoObra).toBe(40)
      expect(result.data.costoIndirectos).toBe(15)
    }
  })

  it('createPlantillaAction: si recibe solo costos legacy genera lineItems coherentes', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({ id: 'prod-1' } as any)
    vi.mocked(prisma.$transaction).mockImplementation(async (arg: any) => {
      if (typeof arg === 'function') {
        const tx = {
          productoCostSheetTemplate: {
            findFirst: vi.fn().mockResolvedValue({ version: 2 } as any),
            create: vi.fn().mockImplementation(async ({ data }: any) => ({
              ...PLANTILLA_BASE,
              ...data,
              id: 'tpl-legacy-create',
              version: 3,
              notas: data.notas,
              lineItems: data.lineItems,
            })),
          },
        }
        return arg(tx)
      }
      return Promise.all(arg)
    })

    const result = await createPlantillaAction({
      productoId: 'prod-1',
      nombre: 'Plantilla legacy normalizada',
      notas: 'Notas humanas',
      costoMateriales: 80,
      costoManoObra: 30,
      costoIndirectos: 10,
      margenObjetivo: 0.2,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.lineItems).toEqual([
        expect.objectContaining({ categoria: 'materiales', costoUnitario: 80 }),
        expect.objectContaining({ categoria: 'mano-obra', costoUnitario: 30 }),
        expect.objectContaining({ categoria: 'indirectos', costoUnitario: 10 }),
      ])
      expect(result.data.costeTotal).toBe(120)
      expect(result.data.userNotes).toBe('Notas humanas')
    }
  })

  it('updatePlantillaAction: rechaza editar costos legacy si la plantilla ya usa lineItems reales', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.productoCostSheetTemplate.findFirst).mockResolvedValue({
      ...PLANTILLA_BASE,
      notas: 'Notas actuales',
      lineItems: LINE_ITEMS_BASE,
    } as any)

    const result = await updatePlantillaAction({
      plantillaId: 'tpl-1',
      costoMateriales: 999,
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR')
    }
  })

  it('updatePlantillaAction: permite editar costos legacy cuando la fila solo hidrata lineItems sinteticos', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.productoCostSheetTemplate.findFirst).mockResolvedValue({
      ...PLANTILLA_BASE,
      notas: 'Fila legacy sin documento',
      lineItems: [],
      costoMateriales: 80,
      costoManoObra: 30,
      costoIndirectos: 10,
    } as any)
    vi.mocked(prisma.productoCostSheetTemplate.update).mockResolvedValue({
      ...PLANTILLA_BASE,
      notas: 'Fila legacy sin documento',
      lineItems: [
        {
          id: 'legacy-materiales',
          concepto: 'Materiales (legacy)',
          cantidad: 1,
          costoUnitario: 90,
          categoria: 'materiales',
        },
        {
          id: 'legacy-mano-obra',
          concepto: 'Mano de obra (legacy)',
          cantidad: 1,
          costoUnitario: 35,
          categoria: 'mano-obra',
        },
        {
          id: 'legacy-indirectos',
          concepto: 'Costos indirectos (legacy)',
          cantidad: 1,
          costoUnitario: 15,
          categoria: 'indirectos',
        },
      ],
      costoMateriales: 90,
      costoManoObra: 35,
      costoIndirectos: 15,
      precioSugerido: 200,
    } as any)

    const result = await updatePlantillaAction({
      plantillaId: 'tpl-1',
      costoMateriales: 90,
      costoManoObra: 35,
      costoIndirectos: 15,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.lineItems).toEqual([
        expect.objectContaining({ categoria: 'materiales', costoUnitario: 90 }),
        expect.objectContaining({ categoria: 'mano-obra', costoUnitario: 35 }),
        expect.objectContaining({ categoria: 'indirectos', costoUnitario: 15 }),
      ])
      expect(result.data.costeTotal).toBe(140)
      expect(prisma.productoCostSheetTemplate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            notas: 'Fila legacy sin documento',
            lineItems: [
              expect.objectContaining({ categoria: 'materiales', costoUnitario: 90 }),
              expect.objectContaining({ categoria: 'mano-obra', costoUnitario: 35 }),
              expect.objectContaining({ categoria: 'indirectos', costoUnitario: 15 }),
            ],
          }),
        }),
      )
    }
  })

  it('updatePlantillaAction: preserva costos legacy no enviados en updates parciales', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.productoCostSheetTemplate.findFirst).mockResolvedValue({
      ...PLANTILLA_BASE,
      notas: 'Fila legacy parcial',
      lineItems: [],
      costoMateriales: 80,
      costoManoObra: 30,
      costoIndirectos: 10,
    } as any)
    vi.mocked(prisma.productoCostSheetTemplate.update).mockResolvedValue({
      ...PLANTILLA_BASE,
      notas: 'Fila legacy parcial',
      lineItems: [
        {
          id: 'legacy-materiales',
          concepto: 'Materiales (legacy)',
          cantidad: 1,
          costoUnitario: 95,
          categoria: 'materiales',
        },
        {
          id: 'legacy-mano-obra',
          concepto: 'Mano de obra (legacy)',
          cantidad: 1,
          costoUnitario: 30,
          categoria: 'mano-obra',
        },
        {
          id: 'legacy-indirectos',
          concepto: 'Costos indirectos (legacy)',
          cantidad: 1,
          costoUnitario: 10,
          categoria: 'indirectos',
        },
      ],
      costoMateriales: 95,
      costoManoObra: 30,
      costoIndirectos: 10,
      precioSugerido: 192.86,
    } as any)

    const result = await updatePlantillaAction({
      plantillaId: 'tpl-1',
      costoMateriales: 95,
    })

    expect(result.success).toBe(true)
    expect(prisma.productoCostSheetTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          costoMateriales: 95,
          costoManoObra: 30,
          costoIndirectos: 10,
          lineItems: [
            expect.objectContaining({ categoria: 'materiales', costoUnitario: 95 }),
            expect.objectContaining({ categoria: 'mano-obra', costoUnitario: 30 }),
            expect.objectContaining({ categoria: 'indirectos', costoUnitario: 10 }),
          ],
        }),
      }),
    )
  })

  it('updatePlantillaAction: al editar solo notas en una fila legacy preserva y migra el documento existente', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.productoCostSheetTemplate.findFirst).mockResolvedValue({
      ...PLANTILLA_BASE,
      notas: LEGACY_NOTAS_JSON,
      lineItems: [],
      costoMateriales: 60,
      costoManoObra: 40,
      costoIndirectos: 15,
    } as any)
    vi.mocked(prisma.productoCostSheetTemplate.update).mockResolvedValue({
      ...PLANTILLA_BASE,
      notas: 'Notas migradas',
      lineItems: LINE_ITEMS_BASE,
      costoMateriales: 60,
      costoManoObra: 40,
      costoIndirectos: 15,
      precioSugerido: 164.29,
    } as any)

    const result = await updatePlantillaAction({
      plantillaId: 'tpl-1',
      notas: 'Notas migradas',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(prisma.productoCostSheetTemplate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            notas: 'Notas migradas',
            lineItems: LINE_ITEMS_BASE,
            costoMateriales: 60,
            costoManoObra: 40,
            costoIndirectos: 15,
          }),
        }),
      )
      expect(result.data.userNotes).toBe('Notas migradas')
      expect(result.data.lineItems).toEqual(LINE_ITEMS_BASE)
    }
  })

  it('updatePlantillaAction: al editar solo margen en una fila legacy migra lineItems y notas humanas', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.productoCostSheetTemplate.findFirst).mockResolvedValue({
      ...PLANTILLA_BASE,
      notas: LEGACY_NOTAS_JSON,
      lineItems: [],
      costoMateriales: 60,
      costoManoObra: 40,
      costoIndirectos: 15,
      margenObjetivo: 0.3,
    } as any)
    vi.mocked(prisma.productoCostSheetTemplate.update).mockResolvedValue({
      ...PLANTILLA_BASE,
      notas: 'Notas legacy',
      lineItems: LINE_ITEMS_BASE,
      costoMateriales: 60,
      costoManoObra: 40,
      costoIndirectos: 15,
      margenObjetivo: 0.35,
      precioSugerido: 176.92,
    } as any)

    const result = await updatePlantillaAction({
      plantillaId: 'tpl-1',
      margenObjetivo: 0.35,
    })

    expect(result.success).toBe(true)
    expect(prisma.productoCostSheetTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          margenObjetivo: 0.35,
          notas: 'Notas legacy',
          lineItems: LINE_ITEMS_BASE,
          costoMateriales: 60,
          costoManoObra: 40,
          costoIndirectos: 15,
        }),
      }),
    )
    if (result.success) {
      expect(result.data.userNotes).toBe('Notas legacy')
      expect(result.data.lineItems).toEqual(LINE_ITEMS_BASE)
    }
  })

  it('createPlantillaAction: rechaza lineItems con categoria invalida', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({ id: 'prod-1' } as any)

    const result = await createPlantillaAction({
      productoId: 'prod-1',
      nombre: 'Plantilla inválida',
      notas: 'Notas',
      margenObjetivo: 0.3,
      lineItems: [
        {
          id: 'li-invalid',
          concepto: 'Concepto inválido',
          cantidad: 1,
          costoUnitario: 10,
          categoria: 'categoria-invalida' as any,
        },
      ],
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR')
    }
  })

  it('createPlantillaAction: rechaza lineItems con estructura invalida', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({ id: 'prod-1' } as any)

    const result = await createPlantillaAction({
      productoId: 'prod-1',
      nombre: 'Plantilla inválida por shape',
      notas: 'Notas',
      margenObjetivo: 0.3,
      lineItems: [
        {
          id: '',
          concepto: 123,
          cantidad: 1,
          costoUnitario: 10,
          categoria: 'materiales',
        } as any,
      ],
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR')
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
