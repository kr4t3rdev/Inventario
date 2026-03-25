import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import prisma from '@/lib/prisma'
import { withAuthPost } from '@/lib/auth-middleware'
import { applyPagoGastoWorkflow } from '@/lib/services/pago-gastos-workflow'
import { reconciliarVentaDirecta } from '@/lib/services/facturacion-ventas-workflow'
import { executeAnticipo, isAnticipoWorkflowError } from '@/lib/services/anticipos-workflow'
import { AuditLogService } from '@/lib/services/audit-log-service'

const executeSchema = z.object({
  contexto: z.enum(['COMPRA_PRODUCTO', 'COMPRA_SERVICIO', 'FACTURA_OFERTA', 'FACTURA_DIRECTA']),
  documentoDestinoId: z.string().min(1),
  montoObjetivo: z.coerce.number().positive(),
  monedaObjetivo: z.string().min(1),
  tasaAplicada: z.coerce.number().positive().optional(),
  idempotencyKey: z.string().min(1),
  observaciones: z.string().optional()
})

function anticiposEnabled(): boolean {
  return process.env.ENABLE_ANTICIPOS !== 'false'
}

async function executeCompraContext(
  tx: any,
  documentoDestinoId: string,
  usuarioId: string,
  observaciones?: string
): Promise<{ reconciliacionGastoId?: string }> {
  const compra = await tx.compraProducto.findUnique({
    where: { compraProductoId: documentoDestinoId },
    select: {
      compraProductoId: true,
      total: true,
      estado: true,
      gastoCompraId: true,
      cuentaPorPagarId: true
    }
  })

  if (!compra) {
    throw new Error('COMPRA_DESTINO_NO_ENCONTRADA')
  }

  if (!compra.gastoCompraId) {
    throw new Error('COMPRA_SIN_GASTO')
  }

  const workflowResult = await applyPagoGastoWorkflow(tx, {
    tipoGasto: 'compra',
    referenciaId: compra.gastoCompraId,
    reconciliadoPor: usuarioId,
    descripcion: observaciones || `Ejecución de anticipo en compra ${compra.compraProductoId}`,
    monto: Number(compra.total),
    moneda: 'CUP',
    estado: 'PAGADA',
    cuentaPorPagarId: compra.cuentaPorPagarId || undefined,
    gastoCompraId: compra.gastoCompraId
  })

  return {
    reconciliacionGastoId: workflowResult.reconciliaciones[0]?.reconciliacionId
  }
}

async function executeFacturaContext(
  tx: any,
  documentoDestinoId: string,
  usuarioId: string,
  observaciones?: string
): Promise<{ reconciliacionVentaId?: string }> {
  const factura = await tx.factura.findUnique({
    where: { idFactura: documentoDestinoId },
    select: {
      idFactura: true,
      ventaId: true,
      total: true,
      cuentaBancariaId: true
    }
  })

  if (!factura || !factura.ventaId) {
    throw new Error('FACTURA_DESTINO_NO_ENCONTRADA')
  }

  const reconciliacionVentaId = await reconciliarVentaDirecta(tx, {
    ventaId: factura.ventaId,
    montoTotal: Number(factura.total),
    usuarioId,
    observaciones: observaciones || `Ejecución de anticipo en factura ${factura.idFactura}`,
    cuentaBancariaId: factura.cuentaBancariaId || undefined
  })

  await tx.factura.update({
    where: { idFactura: factura.idFactura },
    data: {
      estado: 'PAGADA',
      fechaVencimiento: null
    }
  })

  return { reconciliacionVentaId }
}

export const POST = withAuthPost(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }, user: any) => {
    try {
      if (!anticiposEnabled()) {
        return NextResponse.json({ error: 'Módulo de anticipos deshabilitado' }, { status: 404 })
      }

      const { id } = await context.params
      const payload = executeSchema.parse(await request.json())

      const result = await prisma.$transaction(async (tx) => {
        return executeAnticipo(
          tx,
          {
            anticipoId: id,
            contexto: payload.contexto,
            documentoDestinoId: payload.documentoDestinoId,
            montoObjetivo: payload.montoObjetivo,
            monedaObjetivo: payload.monedaObjetivo,
            tasaAplicada: payload.tasaAplicada,
            idempotencyKey: payload.idempotencyKey,
            observaciones: payload.observaciones,
            usuarioId: user.userId
          },
          async (trx) => {
            if (payload.contexto === 'COMPRA_PRODUCTO' || payload.contexto === 'COMPRA_SERVICIO') {
              return executeCompraContext(
                trx,
                payload.documentoDestinoId,
                user.userId,
                payload.observaciones
              )
            }
            return executeFacturaContext(
              trx,
              payload.documentoDestinoId,
              user.userId,
              payload.observaciones
            )
          }
        )
      })

      await AuditLogService.log({
        accion: 'EXECUTE',
        entidad: 'ANTICIPO',
        entidadId: result.anticipoId,
        usuarioId: user.userId,
        detalles: {
          contexto: payload.contexto,
          documentoDestinoId: payload.documentoDestinoId,
          movimientoId: result.movimientoId,
          idempotentReplay: result.idempotentReplay,
          reconciliacionVentaId: result.reconciliacionVentaId,
          reconciliacionGastoId: result.reconciliacionGastoId
        }
      })

      return NextResponse.json({ result })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
      }
      if (isAnticipoWorkflowError(error)) {
        return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
      }
      if (error instanceof Error) {
        if (error.message === 'COMPRA_DESTINO_NO_ENCONTRADA') {
          return NextResponse.json({ error: 'Compra destino no encontrada' }, { status: 404 })
        }
        if (error.message === 'COMPRA_SIN_GASTO') {
          return NextResponse.json(
            { error: 'La compra seleccionada no tiene gasto vinculado para reconciliar' },
            { status: 400 }
          )
        }
        if (error.message === 'FACTURA_DESTINO_NO_ENCONTRADA') {
          return NextResponse.json({ error: 'Factura destino no encontrada' }, { status: 404 })
        }
      }
      console.error('Error ejecutando anticipo:', error)
      return NextResponse.json({ error: 'Error ejecutando anticipo' }, { status: 500 })
    }
  }
)
