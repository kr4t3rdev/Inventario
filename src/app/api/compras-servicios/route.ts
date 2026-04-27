import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import prisma from '@/lib/prisma'
import { withAuthGet, withAuthPost } from '@/lib/auth-middleware'
import { applyAnticipoAllocations, isAnticipoWorkflowError } from '@/lib/services/anticipos-workflow'
import type { AnticipoAllocation } from '@/lib/services/anticipos-workflow.types'
import { assertOperationAllowed, isPeriodoOperacionError, serializePeriodoOperacionError } from '@/lib/services/periodo-operacion-guard'
import { registrarEventoContable } from '@/lib/services/evento-contable-integration'

const anticipoAllocationSchema = z.object({
  anticipoId: z.string().min(1),
  montoAplicado: z.number().positive(),
})

const createCompraServicioSchema = z.object({
  servicioId: z.string().min(1, 'Seleccione un servicio'),
  proveedorId: z.string().optional().nullable(),
  numeroFactura: z.string().optional().nullable(),
  costoUnitario: z.coerce.number().positive('El costo unitario debe ser mayor a 0'),
  cantidad: z.coerce.number().int().positive('La cantidad debe ser mayor a 0'),
  formaPago: z.enum(['PAGO_PARCIAL', 'PAGO_COMPLETO', 'ANTICIPO_PAGO']),
  estado: z.enum(['PENDIENTE', 'PAGADA']),
  descripcion: z.string().optional().nullable(),
  fechaServicio: z.string().datetime().optional().nullable(),
  fechaVencimiento: z.string().datetime().optional().nullable(),
  anticipos: z.array(anticipoAllocationSchema).optional(),
})

/**
 * @description Lista los servicios recibidos registrados.
 * @param {NextRequest} _request - Request entrante.
 * @returns {Promise<NextResponse>} Lista de compras de servicio.
 */
export const GET = withAuthGet(async (_request: NextRequest) => {
  try {
    const comprasServicios = await prisma.compraServicio.findMany({
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
})

/**
 * @description Registra un servicio recibido.
 * @param {NextRequest} request - Request entrante con el payload.
 * @param {unknown} _context - Contexto de ruta no utilizado.
 * @param {{ userId?: string; role?: string }} user - Usuario autenticado.
 * @returns {Promise<NextResponse>} Servicio recibido creado.
 */
export const POST = withAuthPost(async (request: NextRequest, _context: unknown, user: { userId?: string; role?: string }) => {
  try {
    if (user.role === 'dependiente') {
      return NextResponse.json(
        { error: 'Acceso restringido', message: 'Los dependientes no pueden registrar servicios recibidos' },
        { status: 403 }
      )
    }

    await assertOperationAllowed(new Date(), 'COMPRA_SERVICIO')

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

    // Crear todo dentro de una transacción: documento + anticipos + reconciliación
    const resultado = await prisma.$transaction(async (tx) => {
      const compraServicio = await tx.compraServicio.create({
        data: {
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

      // Si hay anticipos, consumirlos
      let allocationsResult = []
      if (payload.anticipos && payload.anticipos.length > 0) {
        // Obtener tipo de pago y cuenta por defecto para anticipos
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

        // Crear ReconciliacionGasto por cada allocation
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

    await registrarEventoContable({
      origenTipo: 'COMPRA_SERVICIO',
      origenId: resultado.compraServicio.compraServicioId,
      monto: total,
      fechaOperacion: fechaServicio,
      descripcion: `Compra de servicio ${resultado.compraServicio.compraServicioId}`,
      usuarioId: user.userId || 'system',
    })

    return NextResponse.json(resultado, { status: 201 })
  } catch (error) {
    if (isPeriodoOperacionError(error)) {
      return NextResponse.json(serializePeriodoOperacionError(error), { status: error.status })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos de entrada inválidos', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error al crear servicio recibido:', error)
    return NextResponse.json({ error: 'Error al crear servicio recibido' }, { status: 500 })
  }
})
