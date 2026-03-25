import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { withAuthGet, withAuthPost } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'

async function invalidateDashboardCache() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    await fetch(`${baseUrl}/api/dashboard/stats`, { method: 'DELETE' })
  } catch (error) {
    console.error('Error invalidating dashboard cache:', error)
  }
}

const ventaServicioLegacySchema = z.object({
  servicioId: z.string().min(1),
  cantidad: z.coerce.number().int().positive(),
  total: z.coerce.number().int().positive(),
  observaciones: z.string().optional().nullable(),
  clienteId: z.string().optional().nullable(),
})

const lineaMixtaSchema = z.object({
  tipoLinea: z.enum(['SERVICIO', 'PRODUCTO']),
  servicioId: z.string().optional(),
  productoId: z.string().optional(),
  cantidad: z.coerce.number().int().positive(),
  precioUnitario: z.coerce.number().int().positive(),
  observaciones: z.string().optional().nullable(),
}).superRefine((linea, ctx) => {
  if (linea.tipoLinea === 'SERVICIO' && !linea.servicioId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'servicioId requerido para línea de servicio' })
  }
  if (linea.tipoLinea === 'PRODUCTO' && !linea.productoId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'productoId requerido para línea de producto' })
  }
})

const ventaMixtaSchema = z.object({
  clienteId: z.string().optional().nullable(),
  observaciones: z.string().optional().nullable(),
  lineas: z.array(lineaMixtaSchema).min(1),
})

/**
 * @description Obtiene ventas de servicios.
 * @param {NextRequest} _request - Request entrante.
 * @returns {Promise<NextResponse>} Lista de ventas de servicios.
 */
export const GET = withAuthGet(async (_request: NextRequest) => {
  try {
    const ventasServicios = await prisma.ventaServicios.findMany({
      include: {
        servicio: true,
        cliente: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(ventasServicios)
  } catch (error) {
    console.error('Error al obtener ventas de servicios:', error)
    return NextResponse.json({ error: 'Error al obtener ventas de servicios' }, { status: 500 })
  }
})

/**
 * @description Crea venta de servicio en modo legacy o en modo líneas mixtas.
 * @param {NextRequest} request - Request de creación.
 * @returns {Promise<NextResponse>} Resultado de creación.
 */
export const POST = withAuthPost(async (request: NextRequest) => {
  try {
    const raw = await request.json()

    if (Array.isArray(raw?.lineas)) {
      const payload = ventaMixtaSchema.parse(raw)
      const lineasServicio = payload.lineas.filter((linea) => linea.tipoLinea === 'SERVICIO')
      const lineasProducto = payload.lineas.filter((linea) => linea.tipoLinea === 'PRODUCTO')

      if (lineasProducto.length > 0) {
        return NextResponse.json(
          {
            error: 'Las líneas de producto deben registrarse por /api/ventas',
            code: 'PRODUCT_LINE_NOT_SUPPORTED_IN_THIS_ENDPOINT',
          },
          { status: 400 }
        )
      }

      const created = await prisma.$transaction(
        lineasServicio.map((linea) =>
          prisma.ventaServicios.create({
            data: {
              servicioId: linea.servicioId!,
              cantidad: linea.cantidad,
              total: linea.cantidad * linea.precioUnitario,
              observaciones: linea.observaciones ?? payload.observaciones ?? null,
              clienteId: payload.clienteId ?? null,
            },
          })
        )
      )

      await invalidateDashboardCache()

      return NextResponse.json(
        {
          mode: 'MIXED_LINES',
          lineasProcesadas: created.length,
          lineasProductoPendientes: lineasProducto.length,
          ventasServicios: created,
        },
        { status: 201 }
      )
    }

    const data = ventaServicioLegacySchema.parse(raw)
    const ventaServicio = await prisma.ventaServicios.create({
      data: {
        servicioId: data.servicioId,
        cantidad: data.cantidad,
        total: data.total,
        observaciones: data.observaciones ?? null,
        clienteId: data.clienteId ?? null,
      },
    })

    await invalidateDashboardCache()
    return NextResponse.json(ventaServicio, { status: 201 })
  } catch (error) {
    console.error('Error al crear venta de servicio:', error)
    return NextResponse.json({ error: 'Error al crear venta de servicio' }, { status: 500 })
  }
})
