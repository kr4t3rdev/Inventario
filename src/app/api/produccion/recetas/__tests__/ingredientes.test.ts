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
}))

describe('POST /api/produccion/recetas/[id]/ingredientes - Agregar Ingredientes', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(prisma as never))
    vi.mocked(prisma.producto.findMany).mockResolvedValue([])
  })

  it('debe agregar ingredientes y recalcular costoUnitario', async () => {
    const recetaId = 'receta-123'
    const productoId = 'prod-1'

    vi.mocked(prisma.receta.findUnique).mockResolvedValueOnce({
      recetaId,
      nombre: 'Receta Test',
      rendimiento: 2,
      costoUnitario: 0,
      productoId: 'prod-final',
      instrucciones: null,
      tiempoPrep: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      Producto: {
        id: 'prod-final',
        nombre: 'Producto Final',
        precioCosto: 100,
      },
    })

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

    const request = new NextRequest(
      `http://localhost/api/produccion/recetas/${recetaId}/ingredientes`,
      {
        method: 'POST',
        body: JSON.stringify({
          ingredientes: [
            {
              productoId,
              cantidad: 1,
              unidadSimbolo: null,
              desperdicio: 0,
            },
          ],
        }),
      }
    )

    // Mock params
    const params = Promise.resolve({ id: recetaId })

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

    const request = new NextRequest(
      `http://localhost/api/produccion/recetas/${recetaId}/ingredientes`,
      {
        method: 'POST',
        body: JSON.stringify({
          ingredientes: [],
        }),
      }
    )

    const params = Promise.resolve({ id: recetaId })

    const response = await setIngredientesHandler(request, { params })

    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error).toContain('no encontrada')
  })

  it('debe rechazar payload inválido con status 400', async () => {
    const recetaId = 'receta-123'

    const request = new NextRequest(
      `http://localhost/api/produccion/recetas/${recetaId}/ingredientes`,
      {
        method: 'POST',
        body: JSON.stringify({
          ingredientes: [
            {
              productoId: 'prod-1',
              cantidad: -1, // Inválido - debe ser positivo
            },
          ],
        }),
      }
    )

    const params = Promise.resolve({ id: recetaId })

    const response = await setIngredientesHandler(request, { params })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toContain('inválido')
  })

  it('debe manejar múltiples ingredientes correctamente', async () => {
    const recetaId = 'receta-123'

    vi.mocked(prisma.receta.findUnique).mockResolvedValueOnce({
      recetaId,
      nombre: 'Receta Compleja',
      rendimiento: 4,
      costoUnitario: 0,
      productoId: 'prod-final',
      instrucciones: null,
      tiempoPrep: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      Producto: {
        id: 'prod-final',
        nombre: 'Producto Final',
        precioCosto: 200,
      },
    })

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

    const request = new NextRequest(
      `http://localhost/api/produccion/recetas/${recetaId}/ingredientes`,
      {
        method: 'POST',
        body: JSON.stringify({
          ingredientes: [
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
          ],
        }),
      }
    )

    const params = Promise.resolve({ id: recetaId })

    const response = await setIngredientesHandler(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.costoUnitario).toBe(112.5)
    expect(data.RecetaIngrediente).toHaveLength(2)
  })

  it('debe manejar array vacío de ingredientes', async () => {
    const recetaId = 'receta-123'

    vi.mocked(prisma.receta.findUnique).mockResolvedValueOnce({
      recetaId,
      nombre: 'Receta Vacía',
      rendimiento: 1,
      costoUnitario: 0,
      productoId: 'prod-final',
      instrucciones: null,
      tiempoPrep: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      Producto: {
        id: 'prod-final',
        nombre: 'Producto Final',
        precioCosto: 100,
      },
    })

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

    const request = new NextRequest(
      `http://localhost/api/produccion/recetas/${recetaId}/ingredientes`,
      {
        method: 'POST',
        body: JSON.stringify({
          ingredientes: [],
        }),
      }
    )

    const params = Promise.resolve({ id: recetaId })

    const response = await setIngredientesHandler(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.costoUnitario).toBe(100)
    expect(data.RecetaIngrediente).toHaveLength(0)
  })
})
