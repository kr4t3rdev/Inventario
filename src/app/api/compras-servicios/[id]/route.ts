import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { withAuth } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'
import { hasUnrevertedAnticipoExecution } from '@/lib/services/anticipos-guards'

const patchSchema = z.object({
  proveedorId: z.string().optional().nullable(),
  numeroFactura: z.string().optional().nullable(),
  costoUnitario: z.coerce.number().int().positive().optional(),
  cantidad: z.coerce.number().int().positive().optional(),
  formaPago: z.enum(['PAGO_PARCIAL', 'PAGO_COMPLETO']).optional(),
  estado: z.enum(['PENDIENTE', 'PAGADA']).optional(),
  descripcion: z.string().max(500).optional().nullable(),
  fechaServicio: z.string().optional().nullable(),
  fechaVencimiento: z.string().optional().nullable(),
})

/**
 * @description Obtiene una compra de servicio por ID.
 * @param {NextRequest} _request - Request entrante.
 * @param {{ params: Promise<{ id: string }> }} context - Contexto de ruta.
 * @returns {Promise<NextResponse>} Compra de servicio encontrada.
 */
export const GET = withAuth(async (_request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await context.params
    const compra = await prisma.compraServicio.findFirst({
      where: { compraServicioId: id, deletedAt: null },
      include: {
        servicio: true,
        proveedor: { select: { vendorId: true, nombre: true } },
      },
    })

    if (!compra) {
      return NextResponse.json({ error: 'Servicio recibido no encontrado' }, { status: 404 })
    }

    return NextResponse.json(compra)
  } catch (error) {
    console.error('Error al obtener servicio recibido:', error)
    return NextResponse.json({ error: 'Error al obtener servicio recibido' }, { status: 500 })
  }
})

/**
 * @description Actualiza una compra de servicio.
 * @param {NextRequest} request - Request con payload parcial.
 * @param {{ params: Promise<{ id: string }> }} context - Contexto de ruta.
 * @param {any} user - Usuario autenticado.
 * @returns {Promise<NextResponse>} Compra de servicio actualizada.
 */
export const PATCH = withAuth(async (request: NextRequest, context: { params: Promise<{ id: string }> }, user: any) => {
  try {
    const { id } = await context.params
    const payload = patchSchema.parse(await request.json())

    const compraActual = await prisma.compraServicio.findUnique({
      where: { compraServicioId: id },
      select: { cantidad: true, costoUnitario: true },
    })

    if (!compraActual) {
      return NextResponse.json({ error: 'Servicio recibido no encontrado' }, { status: 404 })
    }

    const cantidad = payload.cantidad ?? compraActual.cantidad
    const costoUnitario = payload.costoUnitario ?? compraActual.costoUnitario
    const total = cantidad * costoUnitario

    const compra = await prisma.compraServicio.update({
      where: { compraServicioId: id },
      data: {
        ...payload,
        total,
        fechaServicio: payload.fechaServicio ? new Date(payload.fechaServicio) : undefined,
        fechaVencimiento: payload.fechaVencimiento
          ? new Date(payload.fechaVencimiento)
          : payload.fechaVencimiento === null
            ? null
            : undefined,
        updatedById: user.userId ?? user.id ?? null,
      },
      include: {
        servicio: true,
        proveedor: { select: { vendorId: true, nombre: true } },
      },
    })

    return NextResponse.json(compra)
  } catch (error) {
    console.error('Error al actualizar servicio recibido:', error)
    return NextResponse.json({ error: 'Error al actualizar servicio recibido' }, { status: 500 })
  }
})

/**
 * @description Elimina lógicamente una compra de servicio.
 * @param {NextRequest} _request - Request entrante.
 * @param {{ params: Promise<{ id: string }> }} context - Contexto de ruta.
 * @returns {Promise<NextResponse>} Resultado de operación.
 */
export const DELETE = withAuth(async (_request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await context.params
    const requiresReversion = await hasUnrevertedAnticipoExecution(prisma, id)
    if (requiresReversion) {
      return NextResponse.json(
        { error: 'Debe revertir el anticipo ejecutado antes de eliminar la compra de servicio' },
        { status: 409 }
      )
    }
    await prisma.compraServicio.update({
      where: { compraServicioId: id },
      data: { deletedAt: new Date() },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error al eliminar servicio recibido:', error)
    return NextResponse.json({ error: 'Error al eliminar servicio recibido' }, { status: 500 })
  }
})
