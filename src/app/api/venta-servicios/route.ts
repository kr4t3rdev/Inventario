import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { withAuthGet, withAuthPost } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'
import { applyAnticipoAllocations, isAnticipoWorkflowError } from '@/lib/services/anticipos-workflow'
import { assertOperationAllowed, isPeriodoOperacionError, serializePeriodoOperacionError } from '@/lib/services/periodo-operacion-guard'
import { registrarEventoContable } from '@/lib/services/evento-contable-integration'

async function invalidateDashboardCache() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    await fetch(`${baseUrl}/api/dashboard/stats`, { method: 'DELETE' })
  } catch (error) {
    console.error('Error invalidating dashboard cache:', error)
  }
}

const anticipoAllocationSchema = z.object({
  anticipoId: z.string().min(1),
  montoAplicado: z.number().positive(),
})

const ventaServicioLegacySchema = z.object({
  servicioId: z.string().min(1),
  cantidad: z.coerce.number().int().positive(),
  total: z.coerce.number().int().positive(),
  observaciones: z.string().optional().nullable(),
  clienteId: z.string().optional().nullable(),
  anticipos: z.array(anticipoAllocationSchema).optional(),
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
export const POST = withAuthPost(async (request: NextRequest, _context: unknown, user: { userId?: string }) => {
  try {
    const raw = await request.json()

    await assertOperationAllowed(new Date(), 'VENTA_SERVICIO')

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

      for (const vs of created) {
        await registrarEventoContable({
          origenTipo: 'VENTA_SERVICIO',
          origenId: vs.ventaServicioId,
          monto: vs.total,
          fechaOperacion: new Date(),
          descripcion: `Venta de servicio ${vs.ventaServicioId}`,
          usuarioId: user.userId || 'system',
        })
      }

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

    // Crear todo dentro de transacción: documento + anticipos + reconciliación
    const resultado = await prisma.$transaction(async (tx) => {
      const ventaServicio = await tx.ventaServicios.create({
        data: {
          servicioId: data.servicioId,
          cantidad: data.cantidad,
          total: data.total,
          observaciones: data.observaciones ?? null,
          clienteId: data.clienteId ?? null,
        },
      })

      // Si hay anticipos, consumirlos
      let allocationsResult = []
      if (data.anticipos && data.anticipos.length > 0) {
        // Obtener tipo de pago y cuenta por defecto para anticipos
        const tipoPagoDefault = await tx.tipoPago.findFirst({
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
        })
        const cuentaDefault = await tx.cuentaBancaria.findFirst({
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
        })

        allocationsResult = await applyAnticipoAllocations(tx, data.anticipos, {
          documentoDestinoId: ventaServicio.ventaServicioId,
          contexto: 'FACTURA_DIRECTA',
          usuarioId: data.clienteId || 'system',
          observaciones: `Anticipo aplicado a venta de servicio ${ventaServicio.ventaServicioId}`,
        })

        // Crear ReconciliacionServicio por cada allocation
        for (const alloc of allocationsResult) {
          const anticipo = await tx.anticipo.findUnique({
            where: { anticipoId: alloc.anticipoId },
            select: {
              tipo: true,
              cuentaOrigenId: true,
              tipoPagoOrigenId: true,
              clienteId: true,
            },
          })

          await tx.reconciliacionServicio.create({
            data: {
              ventaServicioId: ventaServicio.ventaServicioId,
              cuentaId: anticipo?.cuentaOrigenId || cuentaDefault?.cuentaId || '',
              tipoPagoId: anticipo?.tipoPagoOrigenId || tipoPagoDefault?.tipoId || '',
              monto: alloc.montoAplicado,
              moneda: anticipo?.tipo === 'COBRO' ? 'CUP' : 'USD',
              observaciones: `Cobro anticipado en servicio ${ventaServicio.ventaServicioId}`,
              reconciliadoPor: data.clienteId || 'system',
            },
          })
        }
      }

      return { ventaServicio, allocationsResult }
    })

    await invalidateDashboardCache()

    await registrarEventoContable({
      origenTipo: 'VENTA_SERVICIO',
      origenId: resultado.ventaServicio.ventaServicioId,
      monto: resultado.ventaServicio.total,
      fechaOperacion: new Date(),
      descripcion: `Venta de servicio ${resultado.ventaServicio.ventaServicioId}`,
      usuarioId: user.userId || 'system',
    })

    return NextResponse.json(resultado, { status: 201 })
  } catch (error) {
    if (isPeriodoOperacionError(error)) {
      return NextResponse.json(serializePeriodoOperacionError(error), { status: error.status })
    }
    if (isAnticipoWorkflowError(error)) {
      return NextResponse.json({ error: (error as Error).message }, { status: (error as Record<string, number>).status || 400 })
    }
    console.error('Error al crear venta de servicio:', error)
    return NextResponse.json({ error: 'Error al crear venta de servicio' }, { status: 500 })
  }
})
