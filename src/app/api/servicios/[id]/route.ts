import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth-middleware'

const patchServicioSchema = z.object({
  nombre: z.string().min(1).optional(),
  descripcion: z.string().max(500).optional(),
  precio: z.coerce.number().int().nonnegative().optional(),
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
    const servicio = await prisma.servicios.findUnique({
      where: {
        servicioId: id,
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

    const servicioExistente = await prisma.servicios.findUnique({
      where: { servicioId: id },
    })

    if (!servicioExistente) {
      return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })
    }

    const data: {
      nombre?: string
      descripcion?: string
      precio?: number
    } = {}

    if (payload.nombre !== undefined) {
      data.nombre = payload.nombre
    }

    if (payload.descripcion !== undefined) {
      data.descripcion = payload.descripcion
    }

    if (payload.precio !== undefined) {
      data.precio = payload.precio
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 })
    }

    const servicio = await prisma.servicios.update({
      where: { servicioId: id },
      data,
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

    const servicioExistente = await prisma.servicios.findUnique({
      where: { servicioId: id },
    })

    if (!servicioExistente) {
      return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })
    }

    await prisma.servicios.delete({
      where: { servicioId: id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error al eliminar el Servicio:', error)
    return NextResponse.json({ error: 'Error al eliminar el Servicio' }, { status: 500 })
  }
})
