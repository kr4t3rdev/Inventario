import prisma from '@/lib/prisma'
import type { EquipoReparacion, PiezaReparacion } from '@/app/models/model'
import { getAuthenticatedContext } from '@/lib/api/client'
import { ServerActionError } from '@/lib/api/errors'

function requireTenant(ctx: { tenantId?: string }): string {
  if (!ctx.tenantId) {
    throw new ServerActionError('EquiposReparacion', 'UNKNOWN', 403, 'Se requiere un tenant activo')
  }
  return ctx.tenantId
}

function requireNotDependiente(role?: string) {
  if (role === 'dependiente') {
    throw new ServerActionError('EquiposReparacion', 'UNKNOWN', 403, 'Los dependientes no pueden realizar esta acción')
  }
}

export async function getEquiposReparacion(): Promise<(EquipoReparacion & { piezas: PiezaReparacion[] })[]> {
  const ctx = await getAuthenticatedContext()
  const tenantId = requireTenant(ctx)

  try {
    return await prisma.equipoReparacion.findMany({
      where: { tenantId },
      include: { piezas: true },
      orderBy: { nombre: 'asc' },
    }) as any
  } catch (error) {
    throw new ServerActionError('getEquiposReparacion', 'GET', 500, error instanceof Error ? error.message : 'Error al obtener equipos')
  }
}

export async function getEquipoReparacion(id: string): Promise<EquipoReparacion & { piezas: PiezaReparacion[] }> {
  await getAuthenticatedContext()

  try {
    const equipo = await prisma.equipoReparacion.findUnique({
      where: { id },
      include: { piezas: true },
    })

    if (!equipo) {
      throw new ServerActionError('getEquipoReparacion', 'GET', 404, 'Equipo no encontrado')
    }

    return equipo as any
  } catch (error) {
    if (error instanceof ServerActionError) throw error
    throw new ServerActionError('getEquipoReparacion', 'GET', 500, error instanceof Error ? error.message : 'Error al obtener equipo')
  }
}

export async function createEquipoReparacion(data: { nombre: string; descripcion?: string }): Promise<EquipoReparacion> {
  const ctx = await getAuthenticatedContext()
  const tenantId = requireTenant(ctx)
  requireNotDependiente(ctx.tenantRole)

  try {
    return await prisma.equipoReparacion.create({
      data: { tenantId, nombre: data.nombre, descripcion: data.descripcion },
    }) as any
  } catch (error) {
    throw new ServerActionError('createEquipoReparacion', 'POST', 500, error instanceof Error ? error.message : 'Error al crear equipo')
  }
}

export async function updateEquipoReparacion(id: string, data: { nombre?: string; descripcion?: string }): Promise<EquipoReparacion> {
  const ctx = await getAuthenticatedContext()
  requireNotDependiente(ctx.tenantRole)

  try {
    return await prisma.equipoReparacion.update({
      where: { id },
      data: {
        ...(data.nombre !== undefined && { nombre: data.nombre }),
        ...(data.descripcion !== undefined && { descripcion: data.descripcion }),
      },
    }) as any
  } catch (error) {
    throw new ServerActionError('updateEquipoReparacion', 'PUT', 500, error instanceof Error ? error.message : 'Error al actualizar equipo')
  }
}

export async function deleteEquipoReparacion(id: string): Promise<{ success: boolean; id: string }> {
  const ctx = await getAuthenticatedContext()
  requireNotDependiente(ctx.tenantRole)

  try {
    await prisma.equipoReparacion.delete({ where: { id } })
    return { success: true, id }
  } catch (error) {
    throw new ServerActionError('deleteEquipoReparacion', 'DELETE', 500, error instanceof Error ? error.message : 'Error al eliminar equipo')
  }
}
