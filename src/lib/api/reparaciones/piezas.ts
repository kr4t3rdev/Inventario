import prisma from '@/lib/prisma'
import type { PiezaReparacion } from '@/app/models/model'
import { getAuthenticatedContext } from '@/lib/api/client'
import { ServerActionError } from '@/lib/api/errors'

export async function createPiezaReparacion(data: {
  nombre: string
  equipoId: string
  costoPequeno: number
  costoMediano: number
  costoGrande: number
}): Promise<PiezaReparacion> {
  await getAuthenticatedContext()

  try {
  // @ts-expect-error
    return await prisma.piezaReparacion.create({ data }) as any
  } catch (error) {
    throw new ServerActionError('createPiezaReparacion', 'POST', 500, error instanceof Error ? error.message : 'Error al crear pieza')
  }
}

export async function updatePiezaReparacion(
  id: string,
  data: { nombre?: string; costoPequeno?: number; costoMediano?: number; costoGrande?: number }
): Promise<PiezaReparacion> {
  await getAuthenticatedContext()

  try {
    return await prisma.piezaReparacion.update({ where: { id }, data }) as any
  } catch (error) {
    throw new ServerActionError('updatePiezaReparacion', 'PUT', 500, error instanceof Error ? error.message : 'Error al actualizar pieza')
  }
}

export async function deletePiezaReparacion(id: string): Promise<{ success: boolean; id: string }> {
  await getAuthenticatedContext()

  try {
    await prisma.piezaReparacion.delete({ where: { id } })
    return { success: true, id }
  } catch (error) {
    throw new ServerActionError('deletePiezaReparacion', 'DELETE', 500, error instanceof Error ? error.message : 'Error al eliminar pieza')
  }
}
