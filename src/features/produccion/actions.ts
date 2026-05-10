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
      prisma.recetaProduccion.findMany({
        where,
        include: {
          producto: true,
          ingredientes: { include: { producto: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.recetaProduccion.count({ where }),
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
    const receta = await prisma.recetaProduccion.findFirst({
      where: { recetaId: id, tenantId },
      include: {
        producto: true,
        ingredientes: { include: { producto: true } },
      },
    })
    if (!receta) throw new ActionError('Receta no encontrada', 'NOT_FOUND')
    return receta
  }
)

export const createRecetaProduccionAction = withAction(
  async (input: { nombre: string; rendimiento?: number; instrucciones?: string | null; tiempoPrep?: number | null; productoId?: string | null }, user: AuthenticatedUser) => {
    const tenantId = requireTenant(user)
    const receta = await prisma.recetaProduccion.create({
      data: {
        nombre: input.nombre,
        rendimiento: input.rendimiento ?? 1,
        instrucciones: input.instrucciones ?? null,
        tiempoPrep: input.tiempoPrep ?? null,
        productoId: input.productoId ?? null,
        tenantId,
      },
      include: { producto: true, ingredientes: true },
    })
    revalidatePath('/busy/produccion')
    return receta
  }
)

export const updateRecetaProduccionAction = withAction(
  async (input: { recetaId: string; nombre?: string; rendimiento?: number; instrucciones?: string | null; tiempoPrep?: number | null; productoId?: string | null }, user: AuthenticatedUser) => {
    const tenantId = requireTenant(user)
    const { recetaId, ...data } = input
    
    const existing = await prisma.recetaProduccion.findFirst({ where: { recetaId, tenantId } })
    if (!existing) throw new ActionError('Receta no encontrada', 'NOT_FOUND')
    
    const receta = await prisma.recetaProduccion.update({
      where: { recetaId },
      data,
      include: { producto: true, ingredientes: true },
    })
    revalidatePath('/busy/produccion')
    return receta
  }
)

export const deleteRecetaProduccionAction = withAction(
  async (id: string, user: AuthenticatedUser) => {
    const tenantId = requireTenant(user)
    const existing = await prisma.recetaProduccion.findFirst({ where: { recetaId: id, tenantId } })
    if (!existing) throw new ActionError('Receta no encontrada', 'NOT_FOUND')
    
    await prisma.recetaProduccion.delete({ where: { recetaId: id } })
    revalidatePath('/busy/produccion')
    return { id, eliminado: true }
  }
)

export const setIngredientesRecetaProduccionAction = withAction(
  async (input: { recetaId: string; ingredientes: { productoId: string; cantidad: number; unidad: string; desperdicio: number }[] }, user: AuthenticatedUser) => {
    const tenantId = requireTenant(user)
    
    // Verify recipe exists
    const receta = await prisma.recetaProduccion.findFirst({ where: { recetaId: input.recetaId, tenantId } })
    if (!receta) throw new ActionError('Receta no encontrada', 'NOT_FOUND')
    
    // Delete existing ingredients
    await prisma.recetaProduccionIngrediente.deleteMany({ where: { recetaId: input.recetaId } })
    
    // Create new ingredients
    if (input.ingredientes.length > 0) {
      await prisma.recetaProduccionIngrediente.createMany({
        data: input.ingredientes.map((ing) => ({
          recetaId: input.recetaId,
          productoId: ing.productoId,
          cantidad: ing.cantidad,
          unidad: ing.unidad,
          desperdicio: ing.desperdicio,
          tenantId,
        })),
      })
    }
    
    const updated = await prisma.recetaProduccion.findUnique({
      where: { recetaId: input.recetaId },
      include: { producto: true, ingredientes: { include: { producto: true } } },
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
          receta: { include: { producto: true, ingredientes: { include: { producto: true } } } },
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
        receta: { include: { producto: true, ingredientes: { include: { producto: true } } } },
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
    const receta = await prisma.recetaProduccion.findFirst({ where: { recetaId: input.recetaId, tenantId } })
    if (!receta) throw new ActionError('Receta no encontrada', 'NOT_FOUND')
    
    // Calculate materials cost
    const ingredientes = await prisma.recetaProduccionIngrediente.findMany({
      where: { recetaId: input.recetaId },
      include: { producto: true },
    })
    
    const costoMateriales = ingredientes.reduce((total, ing) => {
      const costoProducto = ing.producto?.precioVenta ?? 0
      return total + (costoProducto * ing.cantidad)
    }, 0)

    const orden = await prisma.ordenProduccion.create({
      data: {
        recetaId: input.recetaId,
        cantidad: input.cantidad,
        observaciones: input.observaciones ?? null,
        fechaProduccion: input.fechaProduccion,
        estado: 'PENDIENTE',
        costoMateriales,
        tenantId,
      },
      include: { receta: { include: { producto: true, ingredientes: { include: { producto: true } } } } },
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
      data: { estado: 'APROBADA' },
      include: { receta: { include: { producto: true } } },
    })
    
    // Create historial entry
    await prisma.ordenProduccionHistorial.create({
      data: {
        ordenProduccionId: id,
        estadoAnterior: 'PENDIENTE',
        estadoNuevo: 'APROBADA',
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
    if (orden.estado !== 'APROBADA') throw new ActionError('La orden debe estar aprobada para completar', 'VALIDATION_ERROR')
    
    const updated = await prisma.ordenProduccion.update({
      where: { ordenProduccionId: id },
      data: { estado: 'COMPLETADA' },
      include: { receta: { include: { producto: true } } },
    })
    
    await prisma.ordenProduccionHistorial.create({
      data: {
        ordenProduccionId: id,
        estadoAnterior: 'APROBADA',
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
      include: { receta: { include: { producto: true } } },
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