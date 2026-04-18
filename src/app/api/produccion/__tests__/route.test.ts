import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { NextRequest } from 'next/server'

const { prismaMock, transactionClientMock } = vi.hoisted(() => {
  const transactionClientMock = {
    receta: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    ordenProduccion: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    valeSalida: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    valeSalidaItem: {
      create: vi.fn(),
    },
    producto: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    reconciliacionGasto: {
      create: vi.fn(),
    },
    ordenProduccionHistorial: {
      create: vi.fn(),
    },
  }

  const prismaMock = {
    receta: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    ordenProduccion: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    valeSalida: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    valeSalidaItem: {
      create: vi.fn(),
    },
    producto: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    reconciliacionGasto: {
      create: vi.fn(),
    },
    ordenProduccionHistorial: {
      create: vi.fn(),
    },
    $transaction: vi.fn((fn: Function) => fn(transactionClientMock)),
  }

  return { prismaMock, transactionClientMock }
})

// Mock prisma module - must use importOriginal to get all exports
vi.mock('@/lib/prisma', async () => {
  const actual = await vi.importActual('@/lib/prisma')
  return {
    ...actual,
    default: prismaMock,
    prisma: prismaMock,
  }
})

// Mock auth middleware
vi.mock('@/lib/auth-middleware', () => ({
  withAuthGet: (fn: Function) => async (request: NextRequest, context?: unknown, user?: unknown) => fn(request, context, user),
  withAuthPost: (fn: Function) => async (request: NextRequest, context?: unknown, user?: unknown) => fn(request, context, user),
}))

// Import after mocking
import prisma from '@/lib/prisma'
import { GET as getRecetas, POST as createReceta } from '../recetas/route'
import { GET as getOrden } from '../ordenes/[id]/route'
import { POST as aprobarOrden } from '../ordenes/[id]/aprobar/route'
import { POST as completarOrden } from '../ordenes/[id]/completar/route'
import { GET as getVales, POST as createVale } from '../vales/route'

describe('Production Module API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/produccion/recetas', () => {
    it('debe retornar lista de recetas', async () => {
      const mockRecetas = [
        { recetaId: '1', nombre: 'Pan', rendimiento: 10 },
        { recetaId: '2', nombre: 'Pastel', rendimiento: 5 },
      ]
      ;(prisma.receta.findMany as Mock).mockResolvedValue(mockRecetas)

      const request = new NextRequest('http://localhost:3000/api/produccion/recetas')
      const response = await getRecetas(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual(mockRecetas)
    })

    it('debe filtrar recetas por búsqueda', async () => {
      const mockRecetas = [
        { recetaId: '1', nombre: 'Pan Dulce', rendimiento: 10 },
      ]
      ;(prisma.receta.findMany as Mock).mockResolvedValue(mockRecetas)

      const request = new NextRequest('http://localhost:3000/api/produccion/recetas?search=Pan')
      const response = await getRecetas(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(prisma.receta.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            nombre: expect.objectContaining({
              contains: 'Pan',
              mode: 'insensitive',
            }),
          }),
        })
      )
    })

    it('debe manejar errores de base de datos', async () => {
      ;(prisma.receta.findMany as Mock).mockRejectedValue(new Error('DB Error'))

      const request = new NextRequest('http://localhost:3000/api/produccion/recetas')
      const response = await getRecetas(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBeDefined()
    })
  })

  describe('POST /api/produccion/recetas', () => {
    it('debe crear una receta exitosamente', async () => {
      const mockReceta = {
        recetaId: 'test-uuid',
        nombre: 'Nueva Receta',
        rendimiento: 10,
        createdAt: new Date(),
      }
      ;(prisma.producto.findUnique as Mock).mockResolvedValue({ precioCosto: 20 })
      ;(prisma.receta.create as Mock).mockResolvedValue(mockReceta)

      const request = new NextRequest('http://localhost:3000/api/produccion/recetas', {
        method: 'POST',
        body: JSON.stringify({ nombre: 'Nueva Receta', rendimiento: 10, productoId: 'prod-1' }),
      })
      const response = await createReceta(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.nombre).toBe('Nueva Receta')
    })

    it('debe validar datos de entrada', async () => {
      const request = new NextRequest('http://localhost:3000/api/produccion/recetas', {
        method: 'POST',
        body: JSON.stringify({}), // Invalid: missing required fields
      })
      const response = await createReceta(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBeDefined()
    })
  })

  describe('GET /api/produccion/ordenes/[id]', () => {
    it('debe retornar una orden específica', async () => {
      const mockOrden = {
        ordenProduccionId: 'orden-1',
        estado: 'PENDIENTE',
        cantidad: 10,
      }
      ;(prisma.ordenProduccion.findUnique as Mock).mockResolvedValue(mockOrden)

      const request = new NextRequest('http://localhost:3000/api/produccion/ordenes/orden-1')
      
      // Simulate params
      const params = Promise.resolve({ id: 'orden-1' })
      const response = await getOrden(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.ordenProduccionId).toBe('orden-1')
    })

    it('debe retornar 404 si no existe la orden', async () => {
      ;(prisma.ordenProduccion.findUnique as Mock).mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/produccion/ordenes/no-existe')
      const params = Promise.resolve({ id: 'no-existe' })
      const response = await getOrden(request, { params })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Orden de producción no encontrada.')
    })
  })

  describe('POST /api/produccion/ordenes/[id]/aprobar', () => {
    it('debe aprobar una orden y reservar materiales', async () => {
      const mockOrden = {
        ordenProduccionId: 'orden-1',
        estado: 'PENDIENTE',
        cantidad: 10,
        Receta: {
          RecetaIngrediente: [
            { productoId: 'prod-1', cantidad: 2, desperdicio: null, unidadSimbolo: null },
          ],
        },
      }
      const mockUpdatedOrden = {
        ...mockOrden,
        estado: 'EN_PROCESO',
        Receta: {
          Producto: { id: 'prod-terminado', nombre: 'Pan' },
          RecetaIngrediente: [
            {
              productoId: 'prod-1',
              cantidad: 2,
              desperdicio: null,
              unidadSimbolo: null,
              Producto: { id: 'prod-1', nombre: 'Harina', precioCosto: 10, stock: 100 },
            },
          ],
        },
      }
      
      ;(prisma.ordenProduccion.findUnique as Mock).mockResolvedValue(mockOrden)
      ;(prisma.ordenProduccion.update as Mock).mockResolvedValue(mockUpdatedOrden)
      ;(prisma.producto.findUnique as Mock).mockResolvedValue({ id: 'prod-1', nombre: 'Harina', stock: 100 })
      ;(prisma.producto.update as Mock).mockResolvedValue({})
      ;(prisma.ordenProduccionHistorial.create as Mock).mockResolvedValue({})

      const request = new NextRequest('http://localhost:3000/api/produccion/ordenes/orden-1/aprobar', {
        method: 'POST',
        body: JSON.stringify({ userId: 'user-1' }),
      })
      const params = Promise.resolve({ id: 'orden-1' })
      const response = await aprobarOrden(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.estado).toBe('EN_PROCESO')
    })

    it('debe rechazar si la orden no está pendiente', async () => {
      const mockOrden = {
        ordenProduccionId: 'orden-1',
        estado: 'COMPLETADA',
        cantidad: 10,
        receta: { ingredientes: [] },
      }
      ;(prisma.ordenProduccion.findUnique as Mock).mockResolvedValue(mockOrden)

      const request = new NextRequest('http://localhost:3000/api/produccion/ordenes/orden-1/aprobar', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      const params = Promise.resolve({ id: 'orden-1' })
      const response = await aprobarOrden(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('La orden ya no está en estado pendiente.')
    })

    it('debe rechazar si no hay materiales suficientes', async () => {
      const mockOrden = {
        ordenProduccionId: 'orden-1',
        estado: 'PENDIENTE',
        cantidad: 10,
        Receta: {
          RecetaIngrediente: [
            { productoId: 'prod-1', cantidad: 2, desperdicio: null, unidadSimbolo: null },
          ],
        },
      }
      ;(prisma.ordenProduccion.findUnique as Mock).mockResolvedValue(mockOrden)
      ;(prisma.producto.findUnique as Mock).mockResolvedValue({ id: 'prod-1', nombre: 'Harina', stock: 5 })

      const request = new NextRequest('http://localhost:3000/api/produccion/ordenes/orden-1/aprobar', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      const params = Promise.resolve({ id: 'orden-1' })
      const response = await aprobarOrden(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Materiales insuficientes.')
    })
  })

  describe('POST /api/produccion/ordenes/[id]/completar', () => {
    it('debe completar una orden y crear registro contable', async () => {
      const mockOrden = {
        ordenProduccionId: 'orden-1',
        estado: 'EN_PROCESO',
        cantidad: 10,
        costoMateriales: 0,
        costoUnitario: 0,
        Receta: {
          nombre: 'Pan',
          productoId: 'prod-terminado',
          rendimiento: 10,
          RecetaIngrediente: [
            {
              productoId: 'prod-1',
              cantidad: 2,
              desperdicio: null,
              Producto: { id: 'prod-1', nombre: 'Harina', precioCosto: 10, stock: 100 },
            },
          ],
          Producto: { id: 'prod-terminado', nombre: 'Pan' },
        },
      }
      const mockUpdatedOrden = { ...mockOrden, estado: 'COMPLETADA', costoMateriales: 200, costoUnitario: 20 }
      
      ;(prisma.ordenProduccion.findUnique as Mock).mockResolvedValue(mockOrden)
      ;(prisma.ordenProduccion.update as Mock).mockResolvedValue(mockUpdatedOrden)
      ;(prisma.producto.findUnique as Mock)
        .mockResolvedValueOnce({ id: 'prod-terminado', nombre: 'Pan', stock: 0, precioCosto: 20 })
        .mockResolvedValueOnce({ id: 'prod-1', nombre: 'Harina', stock: 100, precioCosto: 10 })
      ;(prisma.producto.update as Mock).mockResolvedValue({})
      ;(prisma.ordenProduccionHistorial.create as Mock).mockResolvedValue({})
      ;(prisma.reconciliacionGasto.create as Mock).mockResolvedValue({})
      ;(prisma.$transaction as Mock).mockImplementation(async (fn: Function) => {
        const tx = {
          producto: {
            update: prisma.producto.update,
          },
          ordenProduccion: {
            update: prisma.ordenProduccion.update,
          },
          ordenProduccionHistorial: {
            create: prisma.ordenProduccionHistorial.create,
          },
          reconciliacionGasto: {
            create: prisma.reconciliacionGasto.create,
          },
        }
        return fn(tx)
      })

      const request = new NextRequest('http://localhost:3000/api/produccion/ordenes/orden-1/completar', {
        method: 'POST',
        body: JSON.stringify({ userId: 'user-1', cuentaId: 'cuenta-1', tipoPagoId: 'efectivo' }),
      })
      const params = Promise.resolve({ id: 'orden-1' })
      const response = await completarOrden(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.estado).toBe('COMPLETADA')
      expect(prisma.reconciliacionGasto.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tipoGasto: 'produccion',
            referenciaId: 'orden-1',
            monto: 200,
          }),
        })
      )
    })

    it('debe rechazar si la orden no está en proceso', async () => {
      const mockOrden = {
        ordenProduccionId: 'orden-1',
        estado: 'PENDIENTE',
        cantidad: 10,
        receta: { ingredientes: [], productoId: null },
      }
      ;(prisma.ordenProduccion.findUnique as Mock).mockResolvedValue(mockOrden)

      const request = new NextRequest('http://localhost:3000/api/produccion/ordenes/orden-1/completar', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      const params = Promise.resolve({ id: 'orden-1' })
      const response = await completarOrden(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('La orden no está en proceso.')
    })
  })

  describe('GET /api/produccion/vales', () => {
    it('debe retornar lista de vales', async () => {
      const mockVales = [
        { valeSalidaId: '1', concepto: 'Materia Prima', estado: 'COMPLETADA' },
        { valeSalidaId: '2', concepto: 'Insumos', estado: 'PENDIENTE' },
      ]
      ;(prisma.valeSalida.findMany as Mock).mockResolvedValue(mockVales)

      const request = new NextRequest('http://localhost:3000/api/produccion/vales')
      const response = await getVales(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual(mockVales)
    })

    it('debe filtrar vales por concepto', async () => {
      const mockVales = [
        { valeSalidaId: '1', concepto: 'Materia Prima', estado: 'COMPLETADA' },
      ]
      ;(prisma.valeSalida.findMany as Mock).mockResolvedValue(mockVales)

      const request = new NextRequest('http://localhost:3000/api/produccion/vales?concepto=Materia')
      const response = await getVales(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(prisma.valeSalida.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            concepto: expect.objectContaining({
              contains: 'Materia',
              mode: 'insensitive',
            }),
          }),
        })
      )
    })
  })

  describe('POST /api/produccion/vales', () => {
    it('debe crear un vale y decrementar stock', async () => {
      const mockProducto = { id: 'prod-1', nombre: 'Harina', stock: 100, precioCosto: 10 }
      const mockVale = {
        valeSalidaId: 'vale-1',
        concepto: 'Materia Prima',
        estado: 'COMPLETADA',
        items: [{ productoId: 'prod-1', cantidad: 10, producto: mockProducto }],
      }
      
      ;(prisma.producto.findUnique as Mock).mockResolvedValue(mockProducto)
      ;(prisma.valeSalida.create as Mock).mockResolvedValue(mockVale)
      ;(prisma.valeSalidaItem.create as Mock).mockResolvedValue({})
      ;(prisma.producto.update as Mock).mockResolvedValue({})
      ;(prisma.valeSalida.findUnique as Mock).mockResolvedValue(mockVale)

      // Mock transaction
      const mockTransaction = vi.fn(async (fn: Function) => {
        const tx = {
          valeSalida: {
            create: prisma.valeSalida.create,
            findUnique: prisma.valeSalida.findUnique,
          },
          valeSalidaItem: {
            create: prisma.valeSalidaItem.create,
          },
          producto: {
            findUnique: prisma.producto.findUnique,
            update: prisma.producto.update,
          },
        }
        return fn(tx)
      })
      ;(prisma.$transaction as Mock).mockImplementation(mockTransaction)

      const request = new NextRequest('http://localhost:3000/api/produccion/vales', {
        method: 'POST',
        body: JSON.stringify({
          concepto: 'Materia Prima',
          items: [{ productoId: 'prod-1', cantidad: 10 }],
        }),
      })
      const response = await createVale(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.concepto).toBe('Materia Prima')
    })

    it('debe rechazar si no hay stock suficiente', async () => {
      const mockProducto = { id: 'prod-1', nombre: 'Harina', stock: 5, precioCosto: 10 }
      ;(prisma.producto.findUnique as Mock).mockResolvedValue(mockProducto)

      const request = new NextRequest('http://localhost:3000/api/produccion/vales', {
        method: 'POST',
        body: JSON.stringify({
          concepto: 'Materia Prima',
          items: [{ productoId: 'prod-1', cantidad: 10 }],
        }),
      })
      const response = await createVale(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Stock insuficiente.')
    })

    it('debe validar datos de entrada', async () => {
      const request = new NextRequest('http://localhost:3000/api/produccion/vales', {
        method: 'POST',
        body: JSON.stringify({}), // Invalid: missing required fields
      })
      const response = await createVale(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBeDefined()
    })
  })
})
