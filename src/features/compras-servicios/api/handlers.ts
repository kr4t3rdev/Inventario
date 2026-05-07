import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import type { AuthenticatedUser } from '@/lib/auth-middleware'
import { requireTenant } from '@/lib/services/tenant-scope'
import { applyAnticipoAllocations, isAnticipoWorkflowError } from '@/lib/services/anticipos-workflow'
import type { AnticipoAllocation } from '@/lib/services/anticipos-workflow.types'

const anticipoAllocationSchema = z.object({
  anticipoId: z.string().min(1),
  montoAplicado: z.number().positive(),
})

const createCompraServicioSchema = z.object({
  servicioId: z.string().min(1, 'Seleccione un servicio'),
  proveedorId: z.string().optional().nullable(),
  numeroFactura: z.string().optional().nullable(),
  costoUnitario: z.coerce.number().int().positive('El costo unitario debe ser mayor a 0'),
  cantidad: z.coerce.number().int().positive('La cantidad debe ser mayor a 0'),
  formaPago: z.enum(['PAGO_PARCIAL', 'PAGO_COMPLETO', 'ANTICIPO_PAGO']),
  estado: z.enum(['PENDIENTE', 'PAGADA']),
  descripcion: z.string().optional().nullable(),
  fechaServicio: z.string().datetime().optional().nullable(),
  fechaVencimiento: z.string().datetime().optional().nullable(),
  anticipos: z.array(anticipoAllocationSchema).optional(),
})

export async function getComprasServiciosHandler(_request: NextRequest, _ctx: unknown, user: AuthenticatedUser): Promise<NextResponse> {
  try {
    const tenantId = requireTenant(user);
    const comprasServicios = await prisma.compraServicio.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        servicio: true,
        proveedor: true,
      },
    })

    return NextResponse.json(comprasServicios)
  } catch (error) {
    console.error('Error al obtener servicios recibidos:', error)
    return NextResponse.json({ error: 'Error al obtener servicios recibidos' }, { status: 500 })
  }
}

export async function createCompraServicioHandler(request: NextRequest, _context: unknown, user: AuthenticatedUser): Promise<NextResponse> {
  try {
    const tenantId = requireTenant(user);
    if (user.role === 'dependiente') {
      return NextResponse.json(
        { error: 'Acceso restringido', message: 'Los dependientes no pueden registrar servicios recibidos' },
        { status: 403 }
      )
    }

    const payload = createCompraServicioSchema.parse(await request.json())

    const servicio = await prisma.servicios.findUnique({
      where: { servicioId: payload.servicioId },
    })

    if (!servicio) {
      return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })
    }

    if (payload.proveedorId) {
      const proveedor = await prisma.vendor.findUnique({
        where: { vendorId: payload.proveedorId },
      })

      if (!proveedor) {
        return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
      }
    }

    const total = payload.costoUnitario * payload.cantidad
    const fechaServicio = payload.fechaServicio ? new Date(payload.fechaServicio) : new Date()
    const fechaVencimiento = payload.fechaVencimiento ? new Date(payload.fechaVencimiento) : null

    if (Number.isNaN(fechaServicio.getTime())) {
      return NextResponse.json({ error: 'Fecha de servicio inválida' }, { status: 400 })
    }

    if (fechaVencimiento && Number.isNaN(fechaVencimiento.getTime())) {
      return NextResponse.json({ error: 'Fecha de vencimiento inválida' }, { status: 400 })
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const compraServicio = await tx.compraServicio.create({
        data: {
          tenantId,
          servicioId: payload.servicioId,
          proveedorId: payload.proveedorId || null,
          numeroFactura: payload.numeroFactura || null,
          costoUnitario: payload.costoUnitario,
          cantidad: payload.cantidad,
          total,
          formaPago: payload.formaPago,
          estado: payload.estado,
          descripcion: payload.descripcion || null,
          fechaServicio,
          fechaVencimiento,
        },
        include: {
          servicio: true,
          proveedor: true,
        },
      })

      let allocationsResult: any[] = []
      if (payload.anticipos && payload.anticipos.length > 0) {
        const tipoPagoDefault = await tx.tipoPago.findFirst({
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
        })
        const cuentaDefault = await tx.cuentaBancaria.findFirst({
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
        })

        allocationsResult = await applyAnticipoAllocations(tx, payload.anticipos, {
          documentoDestinoId: compraServicio.compraServicioId,
          contexto: 'COMPRA_SERVICIO',
          usuarioId: user.userId || 'system',
          observaciones: `Anticipo aplicado a servicio recibido ${compraServicio.compraServicioId}`,
        })

        for (const alloc of allocationsResult) {
          const anticipo = await tx.anticipo.findUnique({
            where: { anticipoId: alloc.anticipoId },
            select: {
              tipo: true,
              cuentaOrigenId: true,
              tipoPagoOrigenId: true,
              proveedorId: true,
            },
          })

          await tx.reconciliacionGasto.create({
            data: {
              tenantId,
              tipoGasto: 'COMPRA_SERVICIO',
              referenciaId: compraServicio.compraServicioId,
              cuentaId: anticipo?.cuentaOrigenId || cuentaDefault?.cuentaId || '',
              tipoPagoId: anticipo?.tipoPagoOrigenId || tipoPagoDefault?.tipoId || '',
              monto: alloc.montoAplicado,
              moneda: anticipo?.tipo === 'PAGO' ? 'CUP' : 'USD',
              descripcion: `Pago anticipado de servicio ${compraServicio.compraServicioId}`,
              reconciliadoPor: user.userId || 'system',
              gastoCompraId: null,
              gastosDEId: null,
            },
          })
        }
      }

      return { compraServicio, allocationsResult }
    })

    return NextResponse.json(resultado, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos de entrada inválidos', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error al crear servicio recibido:', error)
    return NextResponse.json({ error: 'Error al crear servicio recibido' }, { status: 500 })
  }
}

export async function getCompraServicioByIdHandler(_request: NextRequest, context: { params: Promise<{ id: string }> }, user: AuthenticatedUser): Promise<NextResponse> {
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
}

export async function updateCompraServicioHandler(request: NextRequest, context: { params: Promise<{ id: string }> }, user: AuthenticatedUser): Promise<NextResponse> {
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
}

export async function deleteCompraServicioHandler(_request: NextRequest, context: { params: Promise<{ id: string }> }, user: AuthenticatedUser): Promise<NextResponse> {
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
}
