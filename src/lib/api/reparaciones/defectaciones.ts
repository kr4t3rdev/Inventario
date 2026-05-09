import prisma from '@/lib/prisma'
import type { DefectacionCatalogo } from '@/app/models/model'
import { getAuthenticatedContext } from '@/lib/api/client'
import { ServerActionError } from '@/lib/api/errors'

export async function getDefectaciones(): Promise<DefectacionCatalogo[]> {
  const ctx = await getAuthenticatedContext()
  if (!ctx.tenantId) throw new ServerActionError('getDefectaciones', 'GET', 403, 'Se requiere un tenant activo')

  try {
    return await prisma.defectacionCatalogo.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: 'desc' },
    }) as any
  } catch (error) {
    throw new ServerActionError('getDefectaciones', 'GET', 500, error instanceof Error ? error.message : 'Error al obtener defectaciones')
  }
}

export async function createDefectacion(data: { defecto: string; costo: number }): Promise<DefectacionCatalogo> {
  const ctx = await getAuthenticatedContext()
  if (!ctx.tenantId) throw new ServerActionError('createDefectacion', 'POST', 403, 'Se requiere un tenant activo')

  try {
    return await prisma.defectacionCatalogo.create({
      data: { tenantId: ctx.tenantId, ...data },
    }) as any
  } catch (error) {
    throw new ServerActionError('createDefectacion', 'POST', 500, error instanceof Error ? error.message : 'Error al crear defectación')
  }
}

export async function updateDefectacion(id: string, data: { defecto?: string; costo?: number }): Promise<DefectacionCatalogo> {
  await getAuthenticatedContext()

  try {
    return await prisma.defectacionCatalogo.update({ where: { id }, data }) as any
  } catch (error) {
    throw new ServerActionError('updateDefectacion', 'PUT', 500, error instanceof Error ? error.message : 'Error al actualizar defectación')
  }
}

export async function deleteDefectacion(id: string): Promise<{ success: boolean; id: string }> {
  await getAuthenticatedContext()

  try {
    await prisma.defectacionCatalogo.delete({ where: { id } })
    return { success: true, id }
  } catch (error) {
    throw new ServerActionError('deleteDefectacion', 'DELETE', 500, error instanceof Error ? error.message : 'Error al eliminar defectación')
  }
}
