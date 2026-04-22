import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import prisma from '@/lib/prisma'
import { withAuthPost } from '@/lib/auth-middleware'
import { AuditLogService } from '@/lib/services/audit-log-service'
import { calcularSaldoPendientePrestamo } from '@/lib/utils/prestamo-cash'

const pagoSchema = z.object({
  monto: z.coerce.number().positive('El monto debe ser positivo'),
  cuentaId: z.string().min(1, 'La cuenta bancaria es requerida'),
  tipoPagoId: z.string().min(1, 'El tipo de pago es requerido'),
  moneda: z.string().optional(),
  tasaCambio: z.coerce.number().positive().optional(),
  observaciones: z.string().optional()
})

/**
 * @description Verifica si el módulo de préstamos cash está habilitado
 * @returns {boolean} true si está habilitado
 */
function prestamosCashEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_PRESTAMOS_CASH !== 'false'
}

/**
 * @description Registra un pago parcial o total sobre un préstamo cash
 * @param {NextRequest} request - Request con body: monto, cuentaId, tipoPagoId, moneda?, tasaCambio?, observaciones?
 * @returns {NextResponse} Reconciliación creada con status 201
 */
export const POST = withAuthPost(async (request: NextRequest, context: unknown, user: { userId: string }) => {
  try {
    if (!prestamosCashEnabled()) {
      return NextResponse.json({ error: 'Módulo de préstamos cash deshabilitado' }, { status: 404 })
    }

    const { params } = context as { params: Promise<{ id: string }> }
    const { id } = await params
    const body = pagoSchema.parse(await request.json())

    const prestamo = await prisma.prestamoCash.findFirst({
      where: { id, deletedAt: null },
      include: { cuentaPorCobrar: true }
    })

    if (!prestamo) {
      return NextResponse.json({ error: 'Préstamo no encontrado' }, { status: 404 })
    }

    if (prestamo.estado === 'PAGADO' || prestamo.estado === 'CANCELADO') {
      return NextResponse.json({ error: 'El préstamo no admite más pagos' }, { status: 400 })
    }

    const saldoPendiente = calcularSaldoPendientePrestamo(
      Number(prestamo.cuentaPorCobrar.montoDeuda),
      Number(prestamo.cuentaPorCobrar.montoPagado)
    )

    if (body.monto > saldoPendiente) {
      return NextResponse.json(
        { error: `El monto excede el saldo pendiente de ${saldoPendiente}` },
        { status: 400 }
      )
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const reconciliacion = await tx.reconciliacionVenta.create({
        data: {
          cuentaId: body.cuentaId,
          tipoPagoId: body.tipoPagoId,
          monto: body.monto,
          moneda: body.moneda || prestamo.moneda,
          ...(body.tasaCambio != null && { tasaCambio: body.tasaCambio }),
          ...(body.observaciones != null && { observaciones: body.observaciones }),
          reconciliadoPor: user.userId,
          prestamoCashId: prestamo.id,
          tipoReconciliacion: 'PRESTAMO_CASH'
        }
      })

      await tx.cuentaBancaria.update({
        where: { cuentaId: body.cuentaId },
        data: { saldo: { increment: body.monto } }
      })

      const nuevoMontoPagado = Number((Number(prestamo.cuentaPorCobrar.montoPagado) + body.monto).toFixed(2))
      const totalDeuda = Number(prestamo.cuentaPorCobrar.montoDeuda)
      const nuevoSaldo = calcularSaldoPendientePrestamo(totalDeuda, nuevoMontoPagado)
      const nuevoEstadoCuenta = nuevoSaldo <= 0.01 ? 'PAGADA' : 'PARCIAL'

      await tx.cuentaPorCobrar.update({
        where: { id: prestamo.cuentaPorCobrarId },
        data: {
          montoPagado: nuevoMontoPagado,
          estado: nuevoEstadoCuenta
        }
      })

      if (nuevoEstadoCuenta === 'PAGADA') {
        await tx.prestamoCash.update({
          where: { id: prestamo.id },
          data: { estado: 'PAGADO' }
        })
      }

      return reconciliacion
    })

    await AuditLogService.log({
      accion: 'CREATE',
      entidad: 'PAGO_PRESTAMO',
      entidadId: resultado.reconciliacionId,
      usuarioId: user.userId,
      detalles: {
        prestamoId: prestamo.id,
        monto: body.monto,
        moneda: body.moneda || prestamo.moneda
      }
    })

    return NextResponse.json({ reconciliacion: resultado }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros inválidos', details: error.errors }, { status: 400 })
    }
    console.error('Error registrando pago de préstamo:', error)
    return NextResponse.json({ error: 'Error registrando pago de préstamo' }, { status: 500 })
  }
})
