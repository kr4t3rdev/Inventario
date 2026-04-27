
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { authenticateUser } from "@/lib/auth-middleware"
import { Prisma } from '@/generated/prisma'
import {
  applyFacturacionCobroWorkflow,
  reconciliarVentaDirecta
} from '@/lib/services/facturacion-ventas-workflow'
import { applyAnticipoAllocations } from '@/lib/services/anticipos-workflow'
import { isAnticipoWorkflowError } from '@/lib/services/anticipos-workflow'
import { assertOperationAllowed, isPeriodoOperacionError, serializePeriodoOperacionError } from '@/lib/services/periodo-operacion-guard'
import { registrarEventoContable } from '@/lib/services/evento-contable-integration'

const facturarSchema = z.object({
  puntoDeVentaId: z.string().min(1, "Punto de Venta requerido"),
  empleadoId: z.string().optional(),
  observaciones: z.string().optional(),
  cargoTransporte: z.number().optional(),
  serieId: z.string().optional(),
  cuentaBancariaId: z.string().optional(),
  fechaVencimiento: z.string().nullable().optional(),
  tipoVencimiento: z.string().optional(),
  anticipoCobroId: z.string().optional(),
  formaPagoAnticipo: z.enum(['ANTICIPO_COBRO']).optional(),
  idempotencyKey: z.string().optional()
}).refine(
  (data) => (data.anticipoCobroId ? !!data.idempotencyKey : true),
  {
    message: 'idempotencyKey es obligatorio cuando se ejecuta cobro anticipado',
    path: ['idempotencyKey']
  }
).refine(
  (data) => (data.anticipoCobroId ? data.formaPagoAnticipo === 'ANTICIPO_COBRO' : true),
  {
    message: 'formaPagoAnticipo debe ser ANTICIPO_COBRO cuando se usa anticipo',
    path: ['formaPagoAnticipo']
  }
)

/**
 * @description Crea una factura de oferta y ejecuta workflow de cobro según vencimiento.
 * @param {Prisma.TransactionClient} tx - Cliente transaccional de Prisma.
 * @param {string} ventaId - ID de la venta.
 * @param {string} clienteId - ID del cliente.
 * @param {number} subtotal - Subtotal de factura.
 * @param {number} descuento - Descuento aplicado.
 * @param {number} impuestos - Impuestos aplicados.
 * @param {number} cargoTransporte - Cargo de transporte.
 * @param {number} total - Total de factura.
 * @param {string | null} observaciones - Observaciones opcionales.
 * @param {string} creadoPor - Usuario creador.
 * @param {string | undefined} serieId - Serie de facturación opcional.
 * @param {string | null | undefined} fechaVencimiento - Fecha de vencimiento opcional.
 * @param {string | undefined} tipoVencimiento - Tipo de vencimiento.
 * @param {string | undefined} cuentaBancariaId - Cuenta bancaria opcional para cobro directo.
 * @returns {Promise<any>} Factura creada.
 */
async function crearFacturaParaVenta(
  tx: Prisma.TransactionClient,
  ventaId: string,
  clienteId: string,
  subtotal: number,
  descuento: number,
  impuestos: number,
  cargoTransporte: number,
  total: number,
  observaciones: string | null,
  creadoPor: string,
  serieId?: string,
  fechaVencimiento?: string | null,
  tipoVencimiento?: string,
  cuentaBancariaId?: string,
  anticipoCobroId?: string,
  idempotencyKey?: string
) {
  // Determinar qué serie usar
  let serie
  if (serieId) {
    serie = await tx.serieFacturacion.findUnique({
      where: { serieId }
    })
    if (!serie || !serie.activa) {
      throw new Error('Serie de facturación no disponible')
    }
  } else {
    // Obtener la serie por defecto "SD"
    serie = await tx.serieFacturacion.findFirst({
      where: { esPorDefecto: true }
    })

    if (!serie) {
      // Crear serie por defecto si no existe
      serie = await tx.serieFacturacion.create({
        data: {
          prefijo: "SD",
          descripcion: "Serie por defecto para ventas",
          consecutivo: 1,
          activa: true,
          esPorDefecto: true
        }
      })
    }
  }

  // Incrementar de forma atómica y usar el valor previo como número emitido
  const serieActualizada = await tx.serieFacturacion.update({
    where: { serieId: serie.serieId },
    data: {
      consecutivo: { increment: 1 }
    }
  })
  const numeroConsecutivoSerie = serieActualizada.consecutivo - 1

  // Crear la factura con el número final directamente
  const factura = await tx.factura.create({
    data: {
      ventaId,
      clienteId,
      serieId: serie.serieId,
      subtotal: Number(subtotal),
      impuestos: Number(impuestos || 0),
      descuento: Number(descuento || 0),
      cargoTransporte: Number(cargoTransporte || 0),
      total: Number(total),
      observaciones,
      creadoPor,
      estado: 'PENDIENTE',
      numeroFactura: `${serie.prefijo}-${numeroConsecutivoSerie}`,
      fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
    },
  })

  if (anticipoCobroId && idempotencyKey) {
    // Consumir anticipo y crear reconciliación dentro de la transacción
    await applyAnticipoAllocations(
      tx,
      [{ anticipoId: anticipoCobroId, montoAplicado: Number(total) }],
      {
        documentoDestinoId: factura.idFactura,
        contexto: 'FACTURA_OFERTA',
        usuarioId: creadoPor,
        idempotencyKey,
        observaciones: observaciones || `Cobro anticipado factura ${factura.idFactura}`,
      }
    )

    // Reconciliar la venta directa
    await reconciliarVentaDirecta(tx, {
      ventaId,
      montoTotal: Number(total),
      usuarioId: creadoPor,
      observaciones: observaciones || `Cobro anticipado factura ${factura.idFactura}`,
      cuentaBancariaId
    })

    await tx.factura.update({
      where: { idFactura: factura.idFactura },
      data: {
        estado: 'PAGADA',
        fechaVencimiento: null
      }
    })
  } else {
    await applyFacturacionCobroWorkflow(tx, {
      ventaId,
      facturaId: factura.idFactura,
      clienteId,
      montoTotal: Number(total),
      usuarioId: creadoPor,
      observaciones,
      tipoVencimiento,
      fechaVencimiento,
      cuentaBancariaId
    })
  }

  return factura
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    const body = await request.json()
    const validatedData = facturarSchema.parse(body)

    const oferta = await prisma.oferta.findUnique({
      where: { id },
      include: { items: true }
    })

    if (!oferta) {
      return NextResponse.json({ error: 'Oferta no encontrada' }, { status: 404 })
    }

    if (oferta.estado === 'FACTURADA') {
      return NextResponse.json({ error: 'Esta oferta ya ha sido facturada' }, { status: 400 })
    }

    if (oferta.estado !== 'ACEPTADA') {
      return NextResponse.json({ error: 'Solo se pueden facturar ofertas aceptadas' }, { status: 400 })
    }

    await assertOperationAllowed(new Date(), 'VENTA')

    // Calcular total incluyendo cargo de transporte
    const cargoTransporteOferta = validatedData.cargoTransporte || 0
    const totalVentaConTransporte = Number(oferta.total) + cargoTransporteOferta

    // Start transaction
    const result = await prisma.$transaction(async (tx: any) => {
      const itemsVenta = oferta.items
        .filter((item: any) => item.productoId)
        .map((item: any) => ({
          productoId: item.productoId,
          cantidad: Number(item.cantidad),
          precioUnitario: Number(item.precioUnitario),
          total: Number(item.total),
        }))

      // Create Venta principal (sin producto específico)
      const venta = await tx.venta.create({
        data: {
          ofertaId: oferta.id,
          clienteId: oferta.clienteId,
          puntoDeVentaId: validatedData.puntoDeVentaId,
          empleadoId: validatedData.empleadoId,
          cantidad: oferta.items.reduce((sum: number, item: { cantidad: number }) => sum + item.cantidad, 0),
          total: totalVentaConTransporte,
          observaciones: validatedData.observaciones || `Facturación de Oferta ${oferta.numeroOferta}`,
          esVentaUnica: true,
          ...(itemsVenta.length > 0
            ? {
                items: {
                  create: itemsVenta,
                },
              }
            : {})
        }
      })

      // Update Oferta status
      await tx.oferta.update({
        where: { id: oferta.id },
        data: {
          estado: 'FACTURADA'
        }
      })

      if (oferta.clienteId && user.userId) {
        // Calcular totales
        const subtotalOferta = Number(oferta.subtotal)
        const descuentoOferta = 0
        const impuestosOferta = Number(oferta.impuestos || 0)
        const cargoTransporteFinal = validatedData.cargoTransporte || 0
        const totalOferta = Number(oferta.total) + cargoTransporteFinal

        await crearFacturaParaVenta(
          tx,
          venta.ventaId,
          oferta.clienteId,
          subtotalOferta,
          descuentoOferta,
          impuestosOferta,
          cargoTransporteFinal,
          totalOferta,
          validatedData.observaciones || null,
          user.userId,
          validatedData.serieId,
          validatedData.fechaVencimiento,
          validatedData.tipoVencimiento,
          validatedData.cuentaBancariaId,
          validatedData.anticipoCobroId,
          validatedData.idempotencyKey
        )
      }

      return venta
    })

    await registrarEventoContable({
      origenTipo: 'VENTA',
      origenId: result.ventaId,
      monto: Number(result.total),
      fechaOperacion: new Date(),
      descripcion: `Facturación de oferta ${oferta.id} → venta ${result.ventaId}`,
      usuarioId: user.userId || user.id || 'system',
    })

    return NextResponse.json({ 
      message: 'Oferta facturada exitosamente', 
      venta: result 
    }, { status: 201 })

  } catch (error) {
    if (isPeriodoOperacionError(error)) {
      return NextResponse.json(serializePeriodoOperacionError(error), { status: error.status })
    }
    console.error('Error facturando oferta:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    if (isAnticipoWorkflowError(error)) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }

    const errorMessage = error instanceof Error ? error.message : ''
    const shouldReturnBadRequest =
      errorMessage.includes('Serie de facturación no disponible') ||
      errorMessage.includes('No hay tipos de pago activos') ||
      errorMessage.includes('No hay cuentas bancarias activas') ||
      errorMessage.includes('La fecha de vencimiento es obligatoria') ||
      errorMessage.includes('Fecha de vencimiento inválida') ||
      errorMessage.includes('El monto total de la factura debe ser mayor que cero')

    if (shouldReturnBadRequest) {
      return NextResponse.json({ error: errorMessage }, { status: 400 })
    }

    return NextResponse.json({ error: 'Error facturando oferta' }, { status: 500 })
  }
}
