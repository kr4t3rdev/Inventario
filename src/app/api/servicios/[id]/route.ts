import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth-middleware'

const patchServicioSchema = z.object({
  nombre: z.string().min(1).optional(),
  descripcion: z.string().max(500).optional().nullable(),
  precio: z.coerce.number().int().nonnegative().optional(),
  precioCosto: z.coerce.number().int().nonnegative().optional().nullable(),
  precioVenta: z.coerce.number().int().nonnegative().optional().nullable(),
  codigoInterno: z.string().max(11).optional().nullable(),
  codigoNegocio: z.string().max(40).optional().nullable(),
  proveedorCodigo: z.string().max(2).optional().nullable(),
  idSeccionCodigo: z.string().max(2).optional().nullable(),
  especificoCodigo: z.string().max(4).optional().nullable(),
  surtidoCodigo: z.string().max(4).optional().nullable(),
  dcCodigo: z.string().max(1).optional().nullable(),
  categoriaId: z.string().optional().nullable(),
  subcategoriaId: z.string().optional().nullable(),
  unidadId: z.string().optional().nullable(),
  vendorId: z.string().optional().nullable(),
  activo: z.boolean().optional(),
})

/**
 * @description Obtiene un servicio por su identificador.
 * @param {NextRequest} _request - Request entrante.
 * @param {{ params: Promise<{ id: string }> }} context - Contexto de ruta.
 * @returns {Promise<NextResponse>} Servicio solicitado.
 */
export const GET = withAuth(async (_request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await context.params
    const servicio = await prisma.servicios.findFirst({
      where: {
        servicioId: id,
        deletedAt: null,
      },
    })

    if (!servicio) {
      return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })
    }

    return NextResponse.json(servicio)
  } catch (error) {
    console.error('Error al obtener Servicio:', error)
    return NextResponse.json({ error: 'Error al obtener Servicio' }, { status: 500 })
  }
})

/**
 * @description Actualiza campos de un servicio del catálogo.
 * @param {NextRequest} request - Request entrante con payload parcial.
 * @param {{ params: Promise<{ id: string }> }} context - Contexto de ruta.
 * @returns {Promise<NextResponse>} Servicio actualizado.
 */
export const PATCH = withAuth(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await context.params
    const payload = patchServicioSchema.parse(await request.json())

    const servicio = await prisma.servicios.update({
      where: { servicioId: id },
      data: {
        ...payload,
        precio: payload.precio ?? payload.precioVenta ?? undefined,
        precioVenta: payload.precioVenta ?? payload.precio ?? undefined,
      },
    })

    return NextResponse.json(servicio)
  } catch (error) {
    console.error('Error al actualizar el Servicio:', error)
    return NextResponse.json({ error: 'Error al actualizar el Servicio' }, { status: 500 })
  }
})

/**
 * @description Elimina lógicamente un servicio del catálogo.
 * @param {NextRequest} _request - Request entrante.
 * @param {{ params: Promise<{ id: string }> }} context - Contexto de ruta.
 * @returns {Promise<NextResponse>} Resultado de la operación.
 */
export const DELETE = withAuth(async (_request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await context.params
    await prisma.servicios.update({
      where: { servicioId: id },
      data: { deletedAt: new Date() },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error al eliminar el Servicio:', error)
    return NextResponse.json({ error: 'Error al eliminar el Servicio' }, { status: 500 })
  }
})
