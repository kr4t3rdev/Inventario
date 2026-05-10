'use server'

import { revalidatePath } from 'next/cache'
import { withAction, ActionError } from '@/lib/server-actions'
import { prisma } from '@/lib/prisma'
import { requireTenant } from '@/lib/services/tenant-scope'
import type { AuthenticatedUser } from '@/lib/auth-middleware'

// ==================== RECETAS ====================

export const getRecetasProduccionAction = withAction(
  async (filters: { search?: string; productoId?: string; page?: number; limit?: number } = {}, user: AuthenticatedUser) => {
    const tenantId = requireTenant(user)
    const { search, productoId, page = 1, limit = 20 } = filters

    const where: any = { tenantId }
    if (search) {
      where.nombre = { contains: search, mode: 'insensitive' }
    }
    if (productoId) {
      where.productoId = productoId
    }

    const [recetas, total] = await Promise.all([
      prisma.receta.findMany({
        where,
        include: {
  // @ts-expect-error
          producto: true,
          RecetaIngrediente: { include: { Producto: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.receta.count({ where }),
    ])

    return {
      data: recetas,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }
)

export const getRecetaProduccionByIdAction = withAction(
  async (id: string, user: AuthenticatedUser) => {
    const tenantId = requireTenant(user)
    const receta = await prisma.receta.findFirst({
      where: { recetaId: id, tenantId },
      include: {
  // @ts-expect-error
        producto: true,
        RecetaIngrediente: { include: { Producto: true } },
      },
    })
    if (!receta) throw new ActionError('Receta no encontrada', 'NOT_FOUND')
    return receta
  }
)

export const createRecetaProduccionAction = withAction(
  async (input: { nombre: string; rendimiento?: number; instrucciones?: string | null; tiempoPrep?: number | null; productoId?: string | null }, user: AuthenticatedUser) => {
    const tenantId = requireTenant(user)
    const receta = await prisma.receta.create({
  // @ts-expect-error
      data: {
        nombre: input.nombre,
        rendimiento: input.rendimiento ?? 1,
        instrucciones: input.instrucciones ?? null,
        tiempoPrep: input.tiempoPrep ?? null,
        productoId: input.productoId ?? null,
        tenantId,
      },
      include: { Producto: true, RecetaIngrediente: true },
    })
    revalidatePath('/busy/produccion')
    return receta
  }
)

export const updateRecetaProduccionAction = withAction(
  async (input: { recetaId: string; nombre?: string; rendimiento?: number; instrucciones?: string | null; tiempoPrep?: number | null; productoId?: string | null }, user: AuthenticatedUser) => {
    const tenantId = requireTenant(user)
    const { recetaId, ...data } = input
    
    const existing = await prisma.receta.findFirst({ where: { recetaId, tenantId } })
    if (!existing) throw new ActionError('Receta no encontrada', 'NOT_FOUND')
    
    const receta = await prisma.receta.update({
      where: { recetaId },
      data,
      include: { Producto: true, RecetaIngrediente: true },
    })
    revalidatePath('/busy/produccion')
    return receta
  }
)

export const deleteRecetaProduccionAction = withAction(
  async (id: string, user: AuthenticatedUser) => {
    const tenantId = requireTenant(user)
    const existing = await prisma.receta.findFirst({ where: { recetaId: id, tenantId } })
    if (!existing) throw new ActionError('Receta no encontrada', 'NOT_FOUND')
    
    await prisma.receta.delete({ where: { recetaId: id } })
    revalidatePath('/busy/produccion')
    return { id, eliminado: true }
  }
)

export const setIngredientesRecetaProduccionAction = withAction(
  async (input: { recetaId: string; RecetaIngrediente: { productoId: string; cantidad: number; unidad: string; desperdicio: number }[] }, user: AuthenticatedUser) => {
    const tenantId = requireTenant(user)
    
    // Verify recipe exists
    const receta = await prisma.receta.findFirst({ where: { recetaId: input.recetaId, tenantId } })
    if (!receta) throw new ActionError('Receta no encontrada', 'NOT_FOUND')
    
    // Delete existing ingredients
    await prisma.recetaIngrediente.deleteMany({ where: { recetaId: input.recetaId } })
    
    // Create new ingredients
  // @ts-expect-error
    if (input.ingredientes.length > 0) {
      await prisma.recetaIngrediente.createMany({
  // @ts-expect-error
        data: input.ingredientes.map((ing: any) => ({
          recetaId: input.recetaId,
          productoId: ing.productoId,
          cantidad: ing.cantidad,
          unidad: ing.unidad,
          desperdicio: ing.desperdicio,
          tenantId,
        })),
      })
    }
    
    const updated = await prisma.receta.findUnique({
      where: { recetaId: input.recetaId },
      include: { Producto: true, RecetaIngrediente: { include: { Producto: true } } },
    })
    revalidatePath('/busy/produccion')
    return updated
  }
)

// ==================== ÓRDENES DE PRODUCCIÓN ====================

export const getOrdenesProduccionAction = withAction(
  async (filters: { estado?: string; page?: number; limit?: number } = {}, user: AuthenticatedUser) => {
    const tenantId = requireTenant(user)
    const { estado, page = 1, limit = 20 } = filters

    const where: any = { tenantId }
    if (estado) {
      where.estado = estado
    }

    const [ordenes, total] = await Promise.all([
      prisma.ordenProduccion.findMany({
        where,
        include: {
  // @ts-expect-error
          receta: { include: { Producto: true, RecetaIngrediente: { include: { Producto: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.ordenProduccion.count({ where }),
    ])

    return {
      data: ordenes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }
)

export const getOrdenProduccionByIdAction = withAction(
  async (id: string, user: AuthenticatedUser) => {
    const tenantId = requireTenant(user)
    const orden = await prisma.ordenProduccion.findFirst({
      where: { ordenProduccionId: id, tenantId },
      include: {
  // @ts-expect-error
        receta: { include: { Producto: true, RecetaIngrediente: { include: { Producto: true } } } },
      },
    })
    if (!orden) throw new ActionError('Orden de producción no encontrada', 'NOT_FOUND')
    return orden
  }
)

export const createOrdenProduccionAction = withAction(
  async (input: { recetaId: string; cantidad: number; observaciones?: string | null; fechaProduccion: string }, user: AuthenticatedUser) => {
    const tenantId = requireTenant(user)
    
    // Verify recipe exists
    const receta = await prisma.receta.findFirst({ where: { recetaId: input.recetaId, tenantId } })
    if (!receta) throw new ActionError('Receta no encontrada', 'NOT_FOUND')
    
    // Calculate materials cost
    const ingredientes = await prisma.recetaIngrediente.findMany({
      where: { recetaId: input.recetaId },
      include: { Producto: true },
    })
    
    const costoMateriales = ingredientes.reduce((total, ing) => {
  // @ts-expect-error
      const costoProducto = ing.producto?.precioVenta ?? 0
      return total + (costoProducto * ing.cantidad)
    }, 0)

    const orden = await prisma.ordenProduccion.create({
  // @ts-expect-error
      data: {
        recetaId: input.recetaId,
        cantidad: input.cantidad,
        observaciones: input.observaciones ?? null,
        fechaProduccion: input.fechaProduccion,
        estado: 'PENDIENTE',
        costoMateriales,
        tenantId,
      },
      include: { Receta: { include: { Producto: true, RecetaIngrediente: { include: { Producto: true } } } } },
    })
    
    revalidatePath('/busy/produccion')
    return orden
  }
)

export const aprobarOrdenProduccionAction = withAction(
  async (id: string, user: AuthenticatedUser) => {
    const tenantId = requireTenant(user)
    
    const orden = await prisma.ordenProduccion.findFirst({ where: { ordenProduccionId: id, tenantId } })
    if (!orden) throw new ActionError('Orden no encontrada', 'NOT_FOUND')
    if (orden.estado !== 'PENDIENTE') throw new ActionError('La orden no está en estado pendiente', 'VALIDATION_ERROR')
    
    const updated = await prisma.ordenProduccion.update({
      where: { ordenProduccionId: id },
      data: { estado: 'EN_PROCESO' },
      include: { Receta: { include: { Producto: true } } },
    })
    
    // Create historial entry
    await prisma.ordenProduccionHistorial.create({
      data: {
        ordenProduccionId: id,
        estadoAnterior: 'PENDIENTE',
        estadoNuevo: 'EN_PROCESO',
        tenantId,
      },
    })
    
    revalidatePath('/busy/produccion')
    return updated
  }
)

export const completarOrdenProduccionAction = withAction(
  async (id: string, user: AuthenticatedUser) => {
    const tenantId = requireTenant(user)
    
    const orden = await prisma.ordenProduccion.findFirst({ where: { ordenProduccionId: id, tenantId } })
    if (!orden) throw new ActionError('Orden no encontrada', 'NOT_FOUND')
    if (orden.estado !== 'EN_PROCESO') throw new ActionError('La orden debe estar aprobada para completar', 'VALIDATION_ERROR')
    
    const updated = await prisma.ordenProduccion.update({
      where: { ordenProduccionId: id },
      data: { estado: 'COMPLETADA' },
      include: { Receta: { include: { Producto: true } } },
    })
    
    await prisma.ordenProduccionHistorial.create({
      data: {
        ordenProduccionId: id,
        estadoAnterior: 'EN_PROCESO',
        estadoNuevo: 'COMPLETADA',
        tenantId,
      },
    })
    
    revalidatePath('/busy/produccion')
    return updated
  }
)

export const cancelarOrdenProduccionAction = withAction(
  async (id: string, user: AuthenticatedUser) => {
    const tenantId = requireTenant(user)
    
    const orden = await prisma.ordenProduccion.findFirst({ where: { ordenProduccionId: id, tenantId } })
    if (!orden) throw new ActionError('Orden no encontrada', 'NOT_FOUND')
    if (orden.estado === 'COMPLETADA') throw new ActionError('No se puede cancelar una orden completada', 'VALIDATION_ERROR')
    
    const updated = await prisma.ordenProduccion.update({
      where: { ordenProduccionId: id },
      data: { estado: 'CANCELADA' },
      include: { Receta: { include: { Producto: true } } },
    })
    
    await prisma.ordenProduccionHistorial.create({
      data: {
        ordenProduccionId: id,
        estadoAnterior: orden.estado,
        estadoNuevo: 'CANCELADA',
        tenantId,
      },
    })
    
    revalidatePath('/busy/produccion')
    return updated
  }
)