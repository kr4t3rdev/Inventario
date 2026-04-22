import { NextRequest, NextResponse } from 'next/server'

import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth-middleware'

/**
 * @description Obtiene un servicio recibido por identificador.
 * @param {NextRequest} _request - Request entrante.
 * @param {{ params: Promise<{ id: string }> }} context - Contexto de ruta.
 * @returns {Promise<NextResponse>} Servicio recibido solicitado.
 */
export const GET = withAuth(async (_request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await context.params

    const compraServicio = await prisma.compraServicio.findUnique({
      where: { compraServicioId: id },
      include: {
        servicio: true,
        proveedor: true,
      },
    })

    if (!compraServicio) {
      return NextResponse.json({ error: 'Servicio recibido no encontrado' }, { status: 404 })
    }

    return NextResponse.json(compraServicio)
  } catch (error) {
    console.error('Error al obtener servicio recibido:', error)
    return NextResponse.json({ error: 'Error al obtener servicio recibido' }, { status: 500 })
  }
})

/**
 * @description Actualiza un servicio recibido.
 * @param {NextRequest} request - Request entrante.
 * @param {{ params: Promise<{ id: string }> }} context - Contexto de ruta.
 * @returns {Promise<NextResponse>} Servicio recibido actualizado.
 */
export const PATCH = withAuth(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await context.params
    const body = await request.json()

    const compraServicio = await prisma.compraServicio.findUnique({
      where: { compraServicioId: id },
    })

    if (!compraServicio) {
      return NextResponse.json({ error: 'Servicio recibido no encontrado' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}

    if (typeof body.numeroFactura !== 'undefined') data.numeroFactura = body.numeroFactura || null
    if (typeof body.descripcion !== 'undefined') data.descripcion = body.descripcion || null
    if (typeof body.formaPago !== 'undefined') data.formaPago = body.formaPago
    if (typeof body.estado !== 'undefined') data.estado = body.estado
    if (typeof body.costoUnitario !== 'undefined') data.costoUnitario = Number(body.costoUnitario)
    if (typeof body.cantidad !== 'undefined') data.cantidad = Number(body.cantidad)
    if (typeof body.proveedorId !== 'undefined') data.proveedorId = body.proveedorId || null
    if (typeof body.fechaServicio !== 'undefined') data.fechaServicio = body.fechaServicio ? new Date(body.fechaServicio) : undefined
    if (typeof body.fechaVencimiento !== 'undefined') data.fechaVencimiento = body.fechaVencimiento ? new Date(body.fechaVencimiento) : null

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 })
    }

    const updated = await prisma.compraServicio.update({
      where: { compraServicioId: id },
      data,
      include: {
        servicio: true,
        proveedor: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error al actualizar servicio recibido:', error)
    return NextResponse.json({ error: 'Error al actualizar servicio recibido' }, { status: 500 })
  }
})

/**
 * @description Elimina un servicio recibido.
 * @param {NextRequest} _request - Request entrante.
 * @param {{ params: Promise<{ id: string }> }} context - Contexto de ruta.
 * @returns {Promise<NextResponse>} Resultado de la operación.
 */
export const DELETE = withAuth(async (_request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await context.params

    const compraServicio = await prisma.compraServicio.findUnique({
      where: { compraServicioId: id },
    })

    if (!compraServicio) {
      return NextResponse.json({ error: 'Servicio recibido no encontrado' }, { status: 404 })
    }

    await prisma.compraServicio.delete({
      where: { compraServicioId: id },
    })

    return NextResponse.json({ success: true, id })
  } catch (error) {
    console.error('Error al eliminar servicio recibido:', error)
    return NextResponse.json({ error: 'Error al eliminar servicio recibido' }, { status: 500 })
  }
})
