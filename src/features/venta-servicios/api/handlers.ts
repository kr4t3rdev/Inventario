import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import type { AuthenticatedUser } from '@/lib/auth-middleware'
import { withAuthGet, withAuthPost, authenticateUser } from '@/lib/auth-middleware'
import { requireTenant } from '@/lib/services/tenant-scope'
import { applyAnticipoAllocations, isAnticipoWorkflowError } from '@/lib/services/anticipos-workflow'

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
  costo: z.coerce.number().int().optional().default(0),
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

export async function getVentaServiciosHandler(_request: NextRequest, _ctx: unknown, user: AuthenticatedUser): Promise<NextResponse> {
  try {
    const tenantId = requireTenant(user);
    const ventasServicios = await prisma.ventaServicios.findMany({
      where: { tenantId },
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
}

export async function createVentaServicioHandler(request: NextRequest, _ctx: unknown, user: AuthenticatedUser): Promise<NextResponse> {
  try {
    const tenantId = requireTenant(user);
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
              tenantId,
              servicioId: linea.servicioId!,
              cantidad: linea.cantidad,
              costo: 0,
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

    const resultado = await prisma.$transaction(async (tx) => {
      const ventaServicio = await tx.ventaServicios.create({
        data: {
          tenantId,
          servicioId: data.servicioId,
          cantidad: data.cantidad,
          costo: data.costo ?? 0,
          total: data.total,
          observaciones: data.observaciones ?? null,
          clienteId: data.clienteId ?? null,
        },
      })

      let allocationsResult: any[] = []
      if (data.anticipos && data.anticipos.length > 0) {
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
              tenantId,
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
    return NextResponse.json(resultado, { status: 201 })
  } catch (error) {
    console.error('Error al crear venta de servicio:', error)
    return NextResponse.json({ error: 'Error al crear venta de servicio' }, { status: 500 })
  }
}

export async function getVentaServicioByIdHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response

    const id = (await params).id

    const ventaServicio = await prisma.ventaServicios.findUnique({
      where: { ventaServicioId: id },
      include: {
        servicio: true,
        cliente: true
      }
    })

    if (!ventaServicio) {
      return NextResponse.json(
        { error: 'Venta de servicio no encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json(ventaServicio)
  } catch (error) {
    console.error('Error al obtener venta de servicio:', error)
    return NextResponse.json(
      { error: 'Error al obtener venta de servicio' },
      { status: 500 }
    )
  }
}

export async function updateVentaServicioHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response

    const id = (await params).id
    const data = await request.json()

    if (!data.cantidad || !data.total) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      )
    }

    const ventaServicio = await prisma.ventaServicios.update({
      where: { ventaServicioId: id },
      data: {
        cantidad: data.cantidad,
        costo: data.costo ?? 0,
        total: data.total,
        observaciones: data.observaciones,
        clienteId: data.clienteId
      }
    })

    return NextResponse.json(ventaServicio)
  } catch (error) {
    console.error('Error al actualizar venta de servicio:', error)
    return NextResponse.json(
      { error: 'Error al actualizar venta de servicio' },
      { status: 500 }
    )
  }
}

export async function deleteVentaServicioHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response

    const id = (await params).id

    await prisma.ventaServicios.delete({
      where: { ventaServicioId: id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error al eliminar venta de servicio:', error)
    return NextResponse.json(
      { error: 'Error al eliminar venta de servicio' },
      { status: 500 }
    )
  }
}
