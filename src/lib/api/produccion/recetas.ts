import prisma from '@/lib/prisma'
import { getAuthenticatedContext } from '@/lib/api/client'
import { ServerActionError } from '@/lib/api/errors'
import { calculateCostoUnitarioReceta } from '@/lib/utils/produccion'
import { z } from 'zod'
import type {
  RecetaProduccion,
  CreateRecetaProduccionPayload,
  SetIngredientesPayload,
  SetIngredientesResponse,
  PaginatedResponse,
} from '@/app/models/model'

const createRecetaSchema = z.object({
  nombre: z.string().min(1).max(160),
  rendimiento: z.number().int().min(1).default(1),
  productoId: z.string().min(1),
  instrucciones: z.string().max(4000).optional(),
  tiempoPrep: z.number().int().min(1).max(1440).optional(),
})

function requireTenant(ctx: { tenantId?: string }): string {
  if (!ctx.tenantId) throw new ServerActionError('Produccion', 'UNKNOWN', 403, 'Se requiere un tenant activo')
  return ctx.tenantId
}

export async function getRecetasProduccion(params?: {
  search?: string
  productoId?: string
  page?: number
  limit?: number
}): Promise<PaginatedResponse<RecetaProduccion>> {
  await getAuthenticatedContext()

  const page = Math.max(1, params?.page || 1)
  const limit = Math.min(100, Math.max(1, params?.limit || 20))
  const skip = (page - 1) * limit
  const whereClause: any = {}

  if (params?.search?.trim()) {
    whereClause.nombre = { contains: params.search.trim(), mode: 'insensitive' }
  }
  if (params?.productoId?.trim()) {
    whereClause.productoId = params.productoId.trim()
  }

  try {
    const [recetas, total] = await Promise.all([
      prisma.receta.findMany({
        where: whereClause,
        include: {
          Producto: { select: { id: true, nombre: true, precioCosto: true, stock: true } },
          RecetaIngrediente: {
            include: { Producto: { select: { id: true, nombre: true, precioCosto: true, stock: true } } },
            orderBy: { createdAt: 'asc' },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.receta.count({ where: whereClause }),
    ])

    return {
      data: recetas as any,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    }
  } catch (error) {
    throw new ServerActionError('getRecetasProduccion', 'GET', 500, error instanceof Error ? error.message : 'Error al obtener recetas')
  }
}

export async function getRecetaProduccion(recetaId: string): Promise<RecetaProduccion> {
  await getAuthenticatedContext()

  try {
    const receta = await prisma.receta.findUnique({
      where: { recetaId },
      include: {
        Producto: { select: { id: true, nombre: true, precioCosto: true, stock: true } },
        RecetaIngrediente: {
          include: { Producto: { select: { id: true, nombre: true, precioCosto: true, stock: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!receta) throw new ServerActionError('getRecetaProduccion', 'GET', 404, 'Receta no encontrada')
    return receta as any
  } catch (error) {
    if (error instanceof ServerActionError) throw error
    throw new ServerActionError('getRecetaProduccion', 'GET', 500, error instanceof Error ? error.message : 'Error al obtener receta')
  }
}

export async function createRecetaProduccion(payload: CreateRecetaProduccionPayload): Promise<RecetaProduccion> {
  const ctx = await getAuthenticatedContext()
  const tenantId = requireTenant(ctx)

  try {
    const validated = createRecetaSchema.parse(payload)

    const productoFinal = await prisma.producto.findUnique({
      where: { id: validated.productoId },
      select: { precioCosto: true },
    })
    const precioCostoProductoFinal = productoFinal?.precioCosto || 0
    const costoUnitario = calculateCostoUnitarioReceta(precioCostoProductoFinal, [], validated.rendimiento)

    const receta = await prisma.receta.create({
      data: {
        recetaId: crypto.randomUUID(),
        tenantId,
        nombre: validated.nombre,
        rendimiento: validated.rendimiento,
        costoUnitario,
        productoId: validated.productoId,
        instrucciones: validated.instrucciones || null,
        tiempoPrep: validated.tiempoPrep || null,
        updatedAt: new Date(),
      },
      include: {
        Producto: { select: { id: true, nombre: true, precioCosto: true } },
        RecetaIngrediente: {
          include: { Producto: { select: { id: true, nombre: true, precioCosto: true, stock: true } } },
        },
      },
    })

    return receta as any
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ServerActionError('createRecetaProduccion', 'POST', 400, error.issues[0]?.message || 'Datos inválidos')
    }
    throw new ServerActionError('createRecetaProduccion', 'POST', 500, error instanceof Error ? error.message : 'Error al crear receta')
  }
}

export async function updateRecetaProduccion(recetaId: string, payload: Partial<CreateRecetaProduccionPayload>): Promise<RecetaProduccion> {
  await getAuthenticatedContext()

  try {
    const data: any = {}
    if (payload.nombre !== undefined) data.nombre = payload.nombre
    if (payload.rendimiento !== undefined) data.rendimiento = payload.rendimiento
    if (payload.productoId !== undefined) data.productoId = payload.productoId
    if (payload.instrucciones !== undefined) data.instrucciones = payload.instrucciones
    if (payload.tiempoPrep !== undefined) data.tiempoPrep = payload.tiempoPrep
    data.updatedAt = new Date()

    const receta = await prisma.receta.update({
      where: { recetaId },
      data,
      include: {
        Producto: { select: { id: true, nombre: true, precioCosto: true } },
        RecetaIngrediente: {
          include: { Producto: { select: { id: true, nombre: true, precioCosto: true, stock: true } } },
        },
      },
    })

    return receta as any
  } catch (error) {
    throw new ServerActionError('updateRecetaProduccion', 'PATCH', 500, error instanceof Error ? error.message : 'Error al actualizar receta')
  }
}

export async function deleteRecetaProduccion(recetaId: string): Promise<{ success: boolean; message: string }> {
  await getAuthenticatedContext()

  try {
    await prisma.receta.delete({ where: { recetaId } })
    return { success: true, message: 'Receta eliminada correctamente' }
  } catch (error) {
    throw new ServerActionError('deleteRecetaProduccion', 'DELETE', 500, error instanceof Error ? error.message : 'Error al eliminar receta')
  }
}

export async function setIngredientesRecetaProduccion(payload: SetIngredientesPayload): Promise<SetIngredientesResponse> {
  await getAuthenticatedContext()

  const { recetaId, ingredientes } = payload

  try {
    const recetaExistente = await prisma.receta.findUnique({
      where: { recetaId },
      include: { Producto: { select: { precioCosto: true } } },
    })

    if (!recetaExistente) throw new ServerActionError('setIngredientesRecetaProduccion', 'POST', 404, 'Receta no encontrada')

    // Fetch products
    const productosRaw = await prisma.producto.findMany({
      where: { id: { in: ingredientes.map((i) => i.productoId) } },
      select: { id: true, nombre: true, precioCosto: true, unidad: { select: { simbolo: true } } },
    })

    const productos = productosRaw.map((p) => ({ ...p, unidadSimbolo: p.unidad?.simbolo ?? null }))

    // Delete existing and create new ingredients in transaction
    await prisma.$transaction(async (tx: any) => {
      await tx.recetaIngrediente.deleteMany({ where: { recetaId } })

      if (ingredientes.length > 0) {
        await tx.recetaIngrediente.createMany({
          data: ingredientes.map((ing) => ({
            id: crypto.randomUUID(),
            recetaId,
            tenantId: recetaExistente.tenantId,
            productoId: ing.productoId,
            cantidad: ing.cantidad,
            unidadSimbolo: ing.unidadSimbolo || null,
            desperdicio: ing.desperdicio || 0,
            updatedAt: new Date(),
          })),
        })
      }

      const precioCostoProductoFinal = recetaExistente.Producto?.precioCosto || 0
      const productosAgregados = ingredientes.map((ing) => {
        const prod = productos.find((p) => p.id === ing.productoId)!
        return { productoId: ing.productoId, cantidad: ing.cantidad, unidadSimbolo: ing.unidadSimbolo || null, producto: { id: prod.id, nombre: prod.nombre, precioCosto: prod.precioCosto || 0 } }
      })
      const costoUnitario = calculateCostoUnitarioReceta(precioCostoProductoFinal, productosAgregados, recetaExistente.rendimiento || 1)

      return tx.receta.update({
        where: { recetaId },
        data: { costoUnitario },
        include: {
          Producto: { select: { id: true, nombre: true } },
          RecetaIngrediente: {
            select: {
              id: true, recetaId: true, productoId: true, cantidad: true, unidadSimbolo: true,
              desperdicio: true, createdAt: true, updatedAt: true,
              Producto: { select: { id: true, nombre: true, precioCosto: true, stock: true } },
            },
          },
        },
      }) as any
    })

    const updated = await prisma.receta.findUnique({
      where: { recetaId },
      include: {
        Producto: { select: { id: true, nombre: true } },
        RecetaIngrediente: {
          include: { Producto: { select: { id: true, nombre: true, precioCosto: true, stock: true } } },
        },
      },
    })

    return updated as any
  } catch (error) {
    if (error instanceof ServerActionError) throw error
    throw new ServerActionError('setIngredientesRecetaProduccion', 'POST', 500, error instanceof Error ? error.message : 'Error al gestionar ingredientes')
  }
}

export async function deleteIngredienteRecetaProduccion(recetaId: string, productoId: string): Promise<RecetaProduccion> {
  await getAuthenticatedContext()

  try {
    const result = await prisma.$transaction(async (tx: any) => {
      const receta = await tx.receta.findUnique({
        where: { recetaId },
        include: {
          Producto: { select: { precioCosto: true } },
          RecetaIngrediente: { include: { Producto: { select: { id: true, nombre: true, precioCosto: true } } } },
        },
      })

      if (!receta) return null

      const ingrediente = receta.RecetaIngrediente.find((ing: any) => ing.productoId === productoId)
      if (!ingrediente) throw new ServerActionError('deleteIngredienteRecetaProduccion', 'DELETE', 404, 'Ingrediente no encontrado')

      await tx.recetaIngrediente.delete({ where: { id: ingrediente.id } })

      const restantes = receta.RecetaIngrediente.filter((ing: any) => ing.productoId !== productoId)
      const precioCostoProductoFinal = receta.Producto?.precioCosto || 0
      const productosAgregados = restantes.map((ing: any) => ({
        productoId: ing.productoId,
        cantidad: ing.cantidad,
        unidadSimbolo: ing.unidadSimbolo,
        producto: { id: ing.Producto?.id ?? '', nombre: ing.Producto?.nombre ?? '', precioCosto: ing.Producto?.precioCosto || 0 },
      }))
      const costoUnitario = calculateCostoUnitarioReceta(precioCostoProductoFinal, productosAgregados, receta.rendimiento || 1)

      return tx.receta.update({
        where: { recetaId },
        data: { costoUnitario },
        include: {
          Producto: { select: { id: true, nombre: true } },
          RecetaIngrediente: {
            include: { Producto: { select: { id: true, nombre: true, precioCosto: true, stock: true } } },
          },
        },
      })
    })

    if (!result) throw new ServerActionError('deleteIngredienteRecetaProduccion', 'DELETE', 404, 'Receta no encontrada')
    return result as any
  } catch (error) {
    if (error instanceof ServerActionError) throw error
    throw new ServerActionError('deleteIngredienteRecetaProduccion', 'DELETE', 500, error instanceof Error ? error.message : 'Error al eliminar ingrediente')
  }
}
