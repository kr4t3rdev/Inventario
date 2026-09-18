import prisma from '@/lib/prisma'
import { getAuthenticatedContext } from '@/lib/api/client'
import { ServerActionError } from '@/lib/api/errors'
import type { OrdenProduccion, CreateOrdenProduccionPayload, PaginatedResponse, OrdenesPaginationMeta } from '@/app/models/model'

function requireTenant(ctx: { tenantId?: string }): string {
  if (!ctx.tenantId) throw new ServerActionError('Produccion', 'UNKNOWN', 403, 'Se requiere un tenant activo')
  return ctx.tenantId
}

export async function getOrdenesProduccion(params?: {
  estado?: string
  page?: number
  limit?: number
}): Promise<PaginatedResponse<OrdenProduccion, OrdenesPaginationMeta>> {
  const ctx = await getAuthenticatedContext()
  const tenantId = requireTenant(ctx)

  const page = Math.max(1, params?.page || 1)
  const limit = Math.min(100, Math.max(1, params?.limit || 20))
  const skip = (page - 1) * limit
  const whereClause: any = { tenantId }

  if (params?.estado) whereClause.estado = params.estado

  try {
    const [ordenes, total, pendientes, enProceso, completadas] = await Promise.all([
      prisma.ordenProduccion.findMany({
        where: whereClause,
        include: { Receta: { select: { nombre: true } } },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.ordenProduccion.count({ where: { tenantId } }),
      prisma.ordenProduccion.count({ where: { tenantId, estado: 'PENDIENTE' } }),
      prisma.ordenProduccion.count({ where: { tenantId, estado: 'EN_PROCESO' } }),
      prisma.ordenProduccion.count({ where: { tenantId, estado: 'COMPLETADA' } }),
    ])

    return {
      data: ordenes as any,
      meta: {
        total, page, limit,
        totalPages: Math.ceil(total / limit),
        stats: { pendientes, enProceso, completadas },
      },
    }
  } catch (error) {
    throw new ServerActionError('getOrdenesProduccion', 'GET', 500, error instanceof Error ? error.message : 'Error al obtener órdenes')
  }
}

export async function getOrdenProduccion(ordenProduccionId: string): Promise<OrdenProduccion> {
  await getAuthenticatedContext()

  try {
    const orden = await prisma.ordenProduccion.findUnique({
      where: { ordenProduccionId },
      include: { Receta: { include: { RecetaIngrediente: true } } },
    })

    if (!orden) throw new ServerActionError('getOrdenProduccion', 'GET', 404, 'Orden no encontrada')
    return orden as any
  } catch (error) {
    if (error instanceof ServerActionError) throw error
    throw new ServerActionError('getOrdenProduccion', 'GET', 500, error instanceof Error ? error.message : 'Error al obtener orden')
  }
}

export async function createOrdenProduccion(payload: CreateOrdenProduccionPayload): Promise<OrdenProduccion> {
  const ctx = await getAuthenticatedContext()
  const tenantId = requireTenant(ctx)

  try {
    const orden = await prisma.ordenProduccion.create({
  // @ts-expect-error TODO: fix prisma create data type
      data: {
        ordenProduccionId: crypto.randomUUID(),
        tenantId,
        recetaId: payload.recetaId,
        cantidad: payload.cantidad,
        observaciones: payload.observaciones || null,
        fechaProduccion: payload.fechaProduccion ? new Date(payload.fechaProduccion) : new Date(),
      },
      include: { Receta: { select: { nombre: true } } },
    })

    return orden as any
  } catch (error) {
    throw new ServerActionError('createOrdenProduccion', 'POST', 500, error instanceof Error ? error.message : 'Error al crear orden')
  }
}

async function transitionOrden(
  ordenProduccionId: string,
  nuevoEstado: string,
  extra?: { userId?: string; observaciones?: string }
): Promise<OrdenProduccion> {
  const ctx = await getAuthenticatedContext()
  const tenantId = requireTenant(ctx)

  try {
    return await prisma.$transaction(async (tx: any) => {
      const orden = await tx.ordenProduccion.findUnique({
        where: { ordenProduccionId },
      })

      if (!orden) throw new ServerActionError('transitionOrden', 'POST', 404, 'Orden no encontrada')

      const estadoAnterior = orden.estado

      const updated = await tx.ordenProduccion.update({
        where: { ordenProduccionId },
        data: { estado: nuevoEstado },
      })

      await tx.ordenProduccionHistorial.create({
        data: {
          id: crypto.randomUUID(),
          tenantId,
          ordenProduccionId,
          estadoAnterior,
          estadoNuevo: nuevoEstado,
          observaciones: extra?.observaciones || null,
          usuarioId: extra?.userId || ctx.userId,
        },
      })

      return updated
    }) as any
  } catch (error) {
    if (error instanceof ServerActionError) throw error
    throw new ServerActionError('transitionOrden', 'POST', 500, error instanceof Error ? error.message : 'Error al cambiar estado de orden')
  }
}

export async function aprobarOrdenProduccion(data: { ordenProduccionId: string; userId?: string }): Promise<OrdenProduccion> {
  return transitionOrden(data.ordenProduccionId, 'EN_PROCESO', { userId: data.userId })
}

export async function completarOrdenProduccion(data: { ordenProduccionId: string; userId?: string }): Promise<OrdenProduccion> {
  return transitionOrden(data.ordenProduccionId, 'COMPLETADA', { userId: data.userId })
}

export async function cancelarOrdenProduccion(data: { ordenProduccionId: string; userId?: string; observaciones?: string }): Promise<OrdenProduccion> {
  return transitionOrden(data.ordenProduccionId, 'CANCELADA', { userId: data.userId, observaciones: data.observaciones })
}
