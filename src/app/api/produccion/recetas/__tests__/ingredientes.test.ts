import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as setIngredientesHandler } from '../[id]/ingredientes/route'
import { prisma } from '@/lib/prisma'
import { calculateCostoUnitarioReceta } from '@/lib/utils/produccion'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
    receta: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    recetaIngrediente: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    producto: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))

// Mock auth middleware
vi.mock('@/lib/auth-middleware', () => ({
  withAuthPost: (handler: Function) => handler,
}))

// Mock utility function
vi.mock('@/lib/utils/produccion', () => ({
  calculateCostoUnitarioReceta: vi.fn(),
  filterProductos: vi.fn(),
}))

// Mock unit converter
vi.mock('@/lib/utils/unit-converter', () => ({
  MASS_UNITS: ['g', 'kg', 'lb', 'oz'],
  VOLUME_UNITS: ['ml', 'L', 'fl oz', 'tsp', 'tbsp', 'cup'],
  convertToBase: (cantidad: number) => cantidad,
  convertBetweenUnits: (cantidad: number, from: string | null, to: string | null) => {
    if (from === 'g' && to === 'kg') return cantidad / 1000
    return cantidad
  },
}))

const FIXED_DATE = new Date('2024-01-01T00:00:00.000Z')

function createIngredientesRequest(
  recetaId: string,
  ingredientes: Array<Record<string, unknown>>
): NextRequest {
  return new NextRequest(`http://localhost/api/produccion/recetas/${recetaId}/ingredientes`, {
    method: 'POST',
    body: JSON.stringify({ ingredientes }),
  })
}

function paramsFor(recetaId: string): Promise<{ id: string }> {
  return Promise.resolve({ id: recetaId })
}

function buildRecetaBase({
  recetaId = 'receta-123',
  nombre = 'Receta Test',
  rendimiento = 1,
  costoUnitario = 0,
  precioCostoProductoFinal = 100,
}: {
  recetaId?: string
  nombre?: string
  rendimiento?: number
  costoUnitario?: number
  precioCostoProductoFinal?: number
} = {}) {
  return {
    recetaId,
    nombre,
    rendimiento,
    costoUnitario,
    productoId: 'prod-final',
    instrucciones: null,
    tiempoPrep: null,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    Producto: {
      id: 'prod-final',
      nombre: 'Producto Final',
      precioCosto: precioCostoProductoFinal,
    },
  }
}

describe('POST /api/produccion/recetas/[id]/ingredientes - Agregar Ingredientes', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(prisma as never))
    vi.mocked(prisma.producto.findMany).mockResolvedValue([])
  })

  it('debe agregar ingredientes y recalcular costoUnitario', async () => {
    const recetaId = 'receta-123'
    const productoId = 'prod-1'

    vi.mocked(prisma.receta.findUnique).mockResolvedValueOnce(buildRecetaBase({
      recetaId,
      nombre: 'Receta Test',
      rendimiento: 2,
      precioCostoProductoFinal: 100,
    }))

    vi.mocked(prisma.recetaIngrediente.deleteMany).mockResolvedValueOnce({
      count: 0,
    })

    vi.mocked(prisma.recetaIngrediente.createMany).mockResolvedValueOnce({
      count: 1,
    })

    vi.mocked(prisma.producto.findMany).mockResolvedValueOnce([
      {
      id: productoId,
      nombre: 'Harina',
      precioCosto: 50,
      unidad: null,
      },
    ])

    // Mock calculateCostoUnitarioReceta to return 75 ((100 + 50) / 2)
    vi.mocked(calculateCostoUnitarioReceta).mockReturnValueOnce(75)

    const mockRecetaActualizada = {
      recetaId,
      nombre: 'Receta Test',
      rendimiento: 2,
      costoUnitario: 75,
      productoId: 'prod-final',
      instrucciones: null,
      tiempoPrep: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      Producto: {
        id: 'prod-final',
        nombre: 'Producto Final',
      },
      RecetaIngrediente: [
        {
          id: 'ing-1',
          recetaId,
          productoId,
          cantidad: 1,
          unidadSimbolo: null,
          desperdicio: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          Producto: {
            id: productoId,
            nombre: 'Harina',
            precioCosto: 50,
            stock: 100,
          },
        },
      ],
    }

    vi.mocked(prisma.receta.update).mockResolvedValueOnce(mockRecetaActualizada)

    const request = createIngredientesRequest(recetaId, [
      {
        productoId,
        cantidad: 1,
        unidadSimbolo: null,
        desperdicio: 0,
      },
    ])

    const params = paramsFor(recetaId)

    const response = await setIngredientesHandler(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.costoUnitario).toBe(75)
    expect(data.RecetaIngrediente).toHaveLength(1)
    expect(vi.mocked(calculateCostoUnitarioReceta)).toHaveBeenCalled()
  })

  it('debe retornar 404 si la receta no existe', async () => {
    const recetaId = 'receta-inexistente'

    vi.mocked(prisma.receta.findUnique).mockResolvedValueOnce(null)

    const request = createIngredientesRequest(recetaId, [])

    const params = paramsFor(recetaId)

    const response = await setIngredientesHandler(request, { params })

    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error).toContain('no encontrada')
  })

  it('debe rechazar payload inválido con status 400', async () => {
    const recetaId = 'receta-123'

    const request = createIngredientesRequest(recetaId, [
      {
        productoId: 'prod-1',
        cantidad: -1,
      },
    ])

    const params = paramsFor(recetaId)

    const response = await setIngredientesHandler(request, { params })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toContain('inválido')
  })

  it('debe manejar múltiples ingredientes correctamente', async () => {
    const recetaId = 'receta-123'

    vi.mocked(prisma.receta.findUnique).mockResolvedValueOnce(buildRecetaBase({
      recetaId,
      nombre: 'Receta Compleja',
      rendimiento: 4,
      precioCostoProductoFinal: 200,
    }))

    vi.mocked(prisma.recetaIngrediente.deleteMany).mockResolvedValueOnce({
      count: 0,
    })

    vi.mocked(prisma.recetaIngrediente.createMany).mockResolvedValueOnce({
      count: 2,
    })

    // Mock multiple producto lookups
    vi.mocked(prisma.producto.findMany).mockResolvedValueOnce([
      {
        id: 'prod-1',
        nombre: 'Harina',
        precioCosto: 100,
        unidad: { simbolo: 'kg' },
      },
      {
        id: 'prod-2',
        nombre: 'Azúcar',
        precioCosto: 150,
        unidad: { simbolo: 'kg' },
      },
    ])

    // Mock calculateCostoUnitarioReceta to return 112.5 ((200 + 100 + 150) / 4)
    vi.mocked(calculateCostoUnitarioReceta).mockReturnValueOnce(112.5)

    const mockRecetaActualizada = {
      recetaId,
      nombre: 'Receta Compleja',
      rendimiento: 4,
      costoUnitario: 112.5,
      productoId: 'prod-final',
      instrucciones: null,
      tiempoPrep: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      Producto: {
        id: 'prod-final',
        nombre: 'Producto Final',
      },
      RecetaIngrediente: [
        {
          id: 'ing-1',
          recetaId,
          productoId: 'prod-1',
          cantidad: 2,
          unidadSimbolo: 'kg',
          desperdicio: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          Producto: {
            id: 'prod-1',
            nombre: 'Harina',
            precioCosto: 100,
            stock: 500,
          },
        },
        {
          id: 'ing-2',
          recetaId,
          productoId: 'prod-2',
          cantidad: 1,
          unidadSimbolo: 'kg',
          desperdicio: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          Producto: {
            id: 'prod-2',
            nombre: 'Azúcar',
            precioCosto: 150,
            stock: 300,
          },
        },
      ],
    }

    vi.mocked(prisma.receta.update).mockResolvedValueOnce(mockRecetaActualizada)

    const request = createIngredientesRequest(recetaId, [
      {
        productoId: 'prod-1',
        cantidad: 2,
        unidadSimbolo: 'kg',
        desperdicio: 0,
      },
      {
        productoId: 'prod-2',
        cantidad: 1,
        unidadSimbolo: 'kg',
        desperdicio: 0,
      },
    ])

    const params = paramsFor(recetaId)

    const response = await setIngredientesHandler(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.costoUnitario).toBe(112.5)
    expect(data.RecetaIngrediente).toHaveLength(2)
  })

  it('debe manejar array vacío de ingredientes', async () => {
    const recetaId = 'receta-123'

    vi.mocked(prisma.receta.findUnique).mockResolvedValueOnce(buildRecetaBase({
      recetaId,
      nombre: 'Receta Vacía',
      rendimiento: 1,
      precioCostoProductoFinal: 100,
    }))

    vi.mocked(prisma.recetaIngrediente.deleteMany).mockResolvedValueOnce({
      count: 2,
    })

    // Mock calculateCostoUnitarioReceta to return 100 (solo producto final)
    vi.mocked(calculateCostoUnitarioReceta).mockReturnValueOnce(100)

    const mockRecetaActualizada = {
      recetaId,
      nombre: 'Receta Vacía',
      rendimiento: 1,
      costoUnitario: 100,
      productoId: 'prod-final',
      instrucciones: null,
      tiempoPrep: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      Producto: {
        id: 'prod-final',
        nombre: 'Producto Final',
      },
      RecetaIngrediente: [],
    }

    vi.mocked(prisma.receta.update).mockResolvedValueOnce(mockRecetaActualizada)

    const request = createIngredientesRequest(recetaId, [])

    const params = paramsFor(recetaId)

    const response = await setIngredientesHandler(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.costoUnitario).toBe(100)
    expect(data.RecetaIngrediente).toHaveLength(0)
  })

  it('debe persistir en unidad canónica y retornar unitNormalizations', async () => {
    const recetaId = 'receta-123'

    vi.mocked(prisma.receta.findUnique).mockResolvedValueOnce(buildRecetaBase({
      recetaId,
      nombre: 'Receta Normalizada',
      rendimiento: 1,
      precioCostoProductoFinal: 10,
    }))

    vi.mocked(prisma.recetaIngrediente.deleteMany).mockResolvedValueOnce({ count: 0 })
    vi.mocked(prisma.recetaIngrediente.createMany).mockResolvedValueOnce({ count: 1 })
    vi.mocked(prisma.producto.findMany).mockResolvedValueOnce([
      {
        id: 'prod-1',
        nombre: 'Harina',
        precioCosto: 20,
        unidad: { simbolo: 'kg' },
      },
    ])
    vi.mocked(calculateCostoUnitarioReceta).mockReturnValueOnce(20)
    vi.mocked(prisma.receta.update).mockResolvedValueOnce({
      recetaId,
      nombre: 'Receta Normalizada',
      rendimiento: 1,
      costoUnitario: 20,
      productoId: 'prod-final',
      instrucciones: null,
      tiempoPrep: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      Producto: {
        id: 'prod-final',
        nombre: 'Producto Final',
      },
      RecetaIngrediente: [
        {
          id: 'ing-1',
          recetaId,
          productoId: 'prod-1',
          cantidad: 0.5,
          unidadSimbolo: 'kg',
          desperdicio: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          Producto: {
            id: 'prod-1',
            nombre: 'Harina',
            precioCosto: 20,
            stock: 30,
          },
        },
      ],
    })

    const request = createIngredientesRequest(recetaId, [
      {
        productoId: 'prod-1',
        cantidad: 500,
        unidadSimbolo: 'g',
        desperdicio: 0,
      },
    ])

    const response = await setIngredientesHandler(request, { params: paramsFor(recetaId) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.unitNormalizations).toEqual([
      {
        productoId: 'prod-1',
        productoNombre: 'Harina',
        providedUnit: 'g',
        canonicalUnit: 'kg',
        originalCantidad: 500,
        normalizedCantidad: 0.5,
      },
    ])
    expect(vi.mocked(calculateCostoUnitarioReceta)).toHaveBeenCalledWith(
      10,
      [
        expect.objectContaining({
          productoId: 'prod-1',
          cantidad: 0.5,
          unidadSimbolo: 'kg',
        }),
      ],
      1
    )
  })

  it('debe rechazar ingredientes incompatibles con unitErrors y sin persistir cambios', async () => {
    const recetaId = 'receta-123'

    vi.mocked(prisma.receta.findUnique).mockResolvedValueOnce(buildRecetaBase({
      recetaId,
      nombre: 'Receta Inválida',
      rendimiento: 1,
      precioCostoProductoFinal: 10,
    }))

    vi.mocked(prisma.producto.findMany).mockResolvedValueOnce([
      {
        id: 'prod-1',
        nombre: 'Harina',
        precioCosto: 20,
        unidad: { simbolo: 'kg' },
      },
    ])

    const request = createIngredientesRequest(recetaId, [
      {
        productoId: 'prod-1',
        cantidad: 1,
        unidadSimbolo: 'L',
        desperdicio: 0,
      },
    ])

    const response = await setIngredientesHandler(request, { params: paramsFor(recetaId) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('unidades')
    expect(data.unitErrors).toEqual([
      {
        productoId: 'prod-1',
        productoNombre: 'Harina',
        providedUnit: 'L',
        canonicalUnit: 'kg',
        reason: 'incompatible_category',
      },
    ])
    expect(vi.mocked(prisma.$transaction)).not.toHaveBeenCalled()
    expect(vi.mocked(prisma.recetaIngrediente.deleteMany)).not.toHaveBeenCalled()
  })
})
