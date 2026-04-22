import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { withAuthGet, withAuthPost } from '@/lib/auth-middleware'

const UpdateAnticipoSchema = z.object({
  estado: z.enum(['RESERVADO', 'EJECUTADO', 'ANULADO']).optional(),
  saldoDisponible: z.number().nonnegative().optional(),
  vigenciaHasta: z.string().nullable().optional(),
  referenciaExterna: z.string().nullable().optional(),
})

/**
 * @description Obtiene un anticipo por ID.
 * @param {NextRequest} _request - Request HTTP.
 * @param {{ params: Promise<{ id: string }> }} context - Parámetros de ruta.
 * @returns {Promise<NextResponse>} Anticipo encontrado.
 */
export const GET = withAuthGet(async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params

  const anticipo = await prisma.anticipo.findUnique({
    where: { anticipoId: id },
    include: {
      contrato: true,
      proveedor: true,
      cliente: true,
      movimientos: {
        orderBy: { createdAt: 'desc' },
        include: {
          anticipo: {
            select: {
              tipo: true,
              proveedor: { select: { nombre: true } },
              cliente: { select: { nombre: true } },
            },
          },
        },
      },
    },
  })

  if (!anticipo) {
    return NextResponse.json({ error: 'Anticipo no encontrado' }, { status: 404 })
  }

  // Enriquecer movimientos con información del documento destino
  const movimientosEnriquecidos = await Promise.all(
    anticipo.movimientos.map(async (mov) => {
      let documentoDestino: Record<string, unknown> | null = null

      if (mov.documentoDestinoId) {
        switch (mov.contexto) {
          case 'COMPRA_PRODUCTO': {
            const compra = await prisma.compraProducto.findUnique({
              where: { compraProductoId: mov.documentoDestinoId },
              select: {
                compraProductoId: true,
                proveedor: { select: { nombre: true } },
                total: true,
                createdAt: true,
              },
            })
            documentoDestino = compra ? {
              tipo: 'Compra de producto',
              id: compra.compraProductoId,
              proveedor: compra.proveedor?.nombre,
              total: compra.total,
              fecha: compra.createdAt,
            } : null
            break
          }
          case 'COMPRA_SERVICIO': {
            const compra = await prisma.compraServicio.findUnique({
              where: { compraServicioId: mov.documentoDestinoId },
              select: {
                compraServicioId: true,
                proveedor: { select: { nombre: true } },
                servicio: { select: { nombre: true } },
                total: true,
                createdAt: true,
              },
            })
            documentoDestino = compra ? {
              tipo: 'Compra de servicio',
              id: compra.compraServicioId,
              servicio: compra.servicio?.nombre,
              proveedor: compra.proveedor?.nombre,
              total: compra.total,
              fecha: compra.createdAt,
            } : null
            break
          }
          case 'FACTURA_OFERTA':
          case 'FACTURA_DIRECTA': {
            const factura = await prisma.factura.findUnique({
              where: { idFactura: mov.documentoDestinoId },
              select: {
                idFactura: true,
                numeroFactura: true,
                cliente: { select: { nombre: true } },
                total: true,
                estado: true,
                createdAt: true,
              },
            })
            documentoDestino = factura ? {
              tipo: 'Factura',
              id: factura.idFactura,
              numeroFactura: factura.numeroFactura,
              cliente: factura.cliente?.nombre,
              total: factura.total,
              estado: factura.estado,
              fecha: factura.createdAt,
            } : null
            break
          }
          default: {
            documentoDestino = { tipo: mov.contexto, id: mov.documentoDestinoId }
          }
        }
      }

      return {
        ...mov,
        documentoDestino,
      }
    })
  )

  return NextResponse.json({
    anticipo: {
      ...anticipo,
      movimientos: movimientosEnriquecidos,
    },
  })
})

/**
 * @description Actualiza un anticipo.
 * @param {NextRequest} request - Request HTTP.
 * @param {{ params: Promise<{ id: string }> }} context - Parámetros de ruta.
 * @param {{ userId: string }} user - Usuario autenticado.
 * @returns {Promise<NextResponse>} Anticipo actualizado.
 */
export const PUT = withAuthPost(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }, _user: { userId: string }) => {
  try {
    const { id } = await params
    const body = await request.json()
    const payload = UpdateAnticipoSchema.parse(body)

    const existing = await prisma.anticipo.findUnique({
      where: { anticipoId: id },
      select: { anticipoId: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Anticipo no encontrado' }, { status: 404 })
    }

    const anticipo = await prisma.anticipo.update({
      where: { anticipoId: id },
      data: {
        ...(payload.estado && { estado: payload.estado }),
        ...(payload.saldoDisponible !== undefined && { saldoDisponible: payload.saldoDisponible }),
        ...(payload.referenciaExterna !== undefined && { referenciaExterna: payload.referenciaExterna }),
        ...(payload.vigenciaHasta !== undefined && {
          vigenciaHasta: payload.vigenciaHasta ? new Date(payload.vigenciaHasta) : null,
        }),
      },
    })

    return NextResponse.json({ anticipo })
  } catch (error) {
    console.error('Error al actualizar anticipo:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Payload inválido', issues: error.flatten() }, { status: 400 })
    }

    return NextResponse.json({ error: 'Error al actualizar anticipo' }, { status: 500 })
  }
})

/**
 * @description Elimina un anticipo.
 * @param {NextRequest} _request - Request HTTP.
 * @param {{ params: Promise<{ id: string }> }} context - Parámetros de ruta.
 * @param {{ userId: string }} user - Usuario autenticado.
 * @returns {Promise<NextResponse>} Mensaje de eliminación.
 */
export const DELETE = withAuthPost(async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }, _user: { userId: string }) => {
  const { id } = await params

  const existing = await prisma.anticipo.findUnique({
    where: { anticipoId: id },
    select: { anticipoId: true },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Anticipo no encontrado' }, { status: 404 })
  }

  await prisma.anticipo.delete({ where: { anticipoId: id } })

  return NextResponse.json({ message: 'Anticipo eliminado' })
})
