import prisma from '@/lib/prisma'
import { getAuthenticatedContext } from '@/lib/api/client'
import { ServerActionError } from '@/lib/api/errors'
import type { ValeSalida, CreateValeSalidaPayload } from '@/app/models/model'

function requireTenant(ctx: { tenantId?: string }): string {
  if (!ctx.tenantId) throw new ServerActionError('Produccion', 'UNKNOWN', 403, 'Se requiere un tenant activo')
  return ctx.tenantId
}

export async function getConceptos(): Promise<string[]> {
  const ctx = await getAuthenticatedContext()
  const tenantId = requireTenant(ctx)

  try {
    const conceptos = await prisma.gastosDE.findMany({
      where: { tenantId },
      select: { concepto: true },
  // @ts-expect-error TODO: fix prisma distinct type
      distinct: ['concepto'],
  // @ts-expect-error TODO: fix prisma orderBy type
      orderBy: {
      concepto: 'asc'
      },
    })
  // @ts-expect-error TODO: fix return type
    return conceptos.map((c: {
    concepto: string
    }) => c.concepto)
  } catch (error) {
    throw new ServerActionError('getConceptos', 'GET', 500, error instanceof Error ? error.message : 'Error al obtener conceptos')
  }
}

export async function getValesSalida(params?: {
  concepto?: string
  estado?: string
}): Promise<ValeSalida[]> {
  await getAuthenticatedContext()

  const whereClause: any = {}
  if (params?.concepto?.trim()) whereClause.concepto = params.concepto.trim()
  if (params?.estado?.trim()) whereClause.estado = params.estado.trim()

  try {
    return await prisma.valeSalida.findMany({
      where: whereClause,
      include: {
        ValeSalidaItem: {
          include: { Producto: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }) as any
  } catch (error) {
    throw new ServerActionError('getValesSalida', 'GET', 500, error instanceof Error ? error.message : 'Error al obtener vales')
  }
}

export async function getValeSalida(valeSalidaId: string): Promise<ValeSalida> {
  await getAuthenticatedContext()

  try {
    const vale = await prisma.valeSalida.findUnique({
      where: { valeSalidaId },
      include: {
        ValeSalidaItem: {
          include: { Producto: true },
        },
      },
    })

    if (!vale) throw new ServerActionError('getValeSalida', 'GET', 404, 'Vale no encontrado')
    return vale as any
  } catch (error) {
    if (error instanceof ServerActionError) throw error
    throw new ServerActionError('getValeSalida', 'GET', 500, error instanceof Error ? error.message : 'Error al obtener vale')
  }
}

export async function createValeSalida(payload: CreateValeSalidaPayload & { userId?: string }): Promise<ValeSalida> {
  const ctx = await getAuthenticatedContext()
  const tenantId = requireTenant(ctx)

  try {
    return await prisma.$transaction(async (tx: any) => {
      const vale = await tx.valeSalida.create({
        data: {
          valeSalidaId: crypto.randomUUID(),
          tenantId,
          concepto: payload.concepto,
          observaciones: payload.observaciones || null,
          estado: 'COMPLETADO',
        },
      })

      if (payload.items?.length > 0) {
        await tx.valeSalidaItem.createMany({
          data: payload.items.map((item) => ({
            valeSalidaItemId: crypto.randomUUID(),
            tenantId,
            valeSalidaId: vale.valeSalidaId,
            productoId: item.productoId,
            cantidad: item.cantidad,
          })),
        })
      }

      return tx.valeSalida.findUnique({
        where: { valeSalidaId: vale.valeSalidaId },
        include: { ValeSalidaItem: { include: { Producto: true } } },
      })
    }) as any
  } catch (error) {
    throw new ServerActionError('createValeSalida', 'POST', 500, error instanceof Error ? error.message : 'Error al crear vale')
  }
}

export async function updateValeSalida(
  valeSalidaId: string,
  data: { concepto?: string; observaciones?: string }
): Promise<ValeSalida> {
  await getAuthenticatedContext()

  try {
    return await prisma.valeSalida.update({
      where: { valeSalidaId },
      data: {
        ...(data.concepto !== undefined && { concepto: data.concepto }),
        ...(data.observaciones !== undefined && { observaciones: data.observaciones }),
      },
      include: { ValeSalidaItem: { include: { Producto: true } } },
    }) as any
  } catch (error) {
    throw new ServerActionError('updateValeSalida', 'PATCH', 500, error instanceof Error ? error.message : 'Error al actualizar vale')
  }
}

export async function anularValeSalida(valeSalidaId: string): Promise<{ success: boolean; message: string }> {
  await getAuthenticatedContext()

  try {
    await prisma.valeSalida.delete({ where: { valeSalidaId } })
    return { success: true, message: 'Vale anulado correctamente' }
  } catch (error) {
    throw new ServerActionError('anularValeSalida', 'DELETE', 500, error instanceof Error ? error.message : 'Error al anular vale')
  }
}
