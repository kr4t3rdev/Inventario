import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import prisma from '@/lib/prisma'
import { withAuthPost } from '@/lib/auth-middleware'
import { AuditLogService } from '@/lib/services/audit-log-service'
import { validarEscrituraPeriodo, extraerFechaDeBody } from '@/lib/services/validate-period-write'
import { calcularSaldoPendienteDeuda } from '@/lib/utils/deuda-cash'
import { buildPersistedAccountingAmount } from '@/features/contabilidad/services/accounting-reconciliation-service';

const pagoSchema = z.object({
  monto: z.coerce.number().positive('El monto debe ser positivo'),
  cuentaId: z.string().min(1, 'La cuenta bancaria es requerida'),
  tipoPagoId: z.string().min(1, 'El tipo de pago es requerido'),
  moneda: z.string().optional(),
  tasaCambio: z.coerce.number().positive().optional(),
  observaciones: z.string().optional()
})

/**
 * @description Verifica si el módulo de deudas cash está habilitado
 * @returns {boolean} true si está habilitado
 */
function deudasCashEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_DEUDAS_CASH !== 'false'
}

/**
 * @description Registra un pago parcial o total sobre una deuda cash
 * @param {NextRequest} request - Request con body: monto, cuentaId, tipoPagoId, moneda?, tasaCambio?, observaciones?
 * @returns {NextResponse} Reconciliación creada con status 201
 */
export const POST = withAuthPost(async (request: NextRequest, context: unknown, user: { userId: string }) => {
  try {
    if (!deudasCashEnabled()) {
      return NextResponse.json({ error: 'Módulo de deudas cash deshabilitado' }, { status: 404 })
    }

    const { params } = context as { params: Promise<{ id: string }> }
    const { id } = await params
    const body = pagoSchema.parse(await request.json())

    const deuda = await prisma.deudaCash.findFirst({
      where: { id, deletedAt: null },
      include: { cuentaPorPagar: true }
    })

    if (!deuda) {
      return NextResponse.json({ error: 'Deuda no encontrada' }, { status: 404 })
    }

    // Validar período contable antes de registrar el pago
    const fechaOperacion = extraerFechaDeBody(body as unknown as Record<string, unknown>) ?? new Date()
    const validacionPeriodo = await validarEscrituraPeriodo({
      fecha: fechaOperacion,
      tenantId: deuda.tenantId,
      tipoOperacion: 'pago_deuda_cash',
      actor: user.userId,
    })
    if (!validacionPeriodo.permitido) {
      return NextResponse.json(
        { error: validacionPeriodo.error?.message ?? 'Período contable cerrado', code: validacionPeriodo.error?.code ?? 'PERIODO_CERRADO' },
        { status: 400 }
      )
    }

    if (deuda.estado === 'PAGADO' || deuda.estado === 'CANCELADO') {
      return NextResponse.json({ error: 'La deuda no admite más pagos' }, { status: 400 })
    }

    const saldoPendiente = calcularSaldoPendienteDeuda(
      Number(deuda.cuentaPorPagar.montoDeuda),
      Number(deuda.cuentaPorPagar.montoPagado)
    )

    if (body.monto > saldoPendiente) {
      return NextResponse.json(
        { error: `El monto excede el saldo pendiente de ${saldoPendiente}` },
        { status: 400 }
      )
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const fechaReconciliacion = new Date();
      const conversion = buildPersistedAccountingAmount(
        Number(body.monto),
        body.moneda || String(deuda.moneda),
        body.tasaCambio ?? undefined,
        fechaReconciliacion,
      );
      const reconciliacion = await tx.reconciliacionVenta.create({
        data: {
          tenantId: deuda.tenantId,
          cuentaId: body.cuentaId,
          tipoPagoId: body.tipoPagoId,
          monto: body.monto,
          moneda: body.moneda || deuda.moneda,
          ...(conversion.montoConvertido != null ? { montoConvertido: conversion.montoConvertido } : {}),
          ...(conversion.tasaCambio != null ? { tasaCambio: conversion.tasaCambio } : {}),
          fechaReconciliacion,
          ...(conversion.fxEvidence ?? {}),
          ...(body.observaciones != null && { observaciones: body.observaciones }),
          reconciliadoPor: user.userId,
          deudaCashId: deuda.id,
          tipoReconciliacion: 'DEUDA_CASH'
        }
      })

      await tx.cuentaBancaria.update({
        where: { cuentaId: body.cuentaId },
        data: { saldo: { decrement: body.monto } }
      })

      const nuevoMontoPagado = Number((Number(deuda.cuentaPorPagar.montoPagado) + body.monto).toFixed(2))
      const totalDeuda = Number(deuda.cuentaPorPagar.montoDeuda)
      const nuevoSaldoPendiente = calcularSaldoPendienteDeuda(totalDeuda, nuevoMontoPagado)
      const nuevoEstadoCuenta = nuevoSaldoPendiente <= 0.01 ? 'PAGADA' : 'PARCIAL'

      await tx.cuentaPorPagar.update({
        where: { cuentaPorPagarId: deuda.cuentaPorPagarId },
        data: {
          montoPagado: nuevoMontoPagado,
          saldoPendiente: nuevoSaldoPendiente,
          estado: nuevoEstadoCuenta
        }
      })

      if (nuevoEstadoCuenta === 'PAGADA') {
        await tx.deudaCash.update({
          where: { id: deuda.id },
          data: { estado: 'PAGADO' }
        })
      }

      return reconciliacion
    })

    await AuditLogService.log({
      accion: 'CREATE',
      entidad: 'PAGO_DEUDA',
      entidadId: resultado.reconciliacionId,
      usuarioId: user.userId,
      detalles: {
        deudaId: deuda.id,
        monto: body.monto,
        moneda: body.moneda || deuda.moneda
      }
    })

    return NextResponse.json({ reconciliacion: resultado }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros inválidos', details: error.errors }, { status: 400 })
    }
    console.error('Error registrando pago de deuda:', error)
    return NextResponse.json({ error: 'Error registrando pago de deuda' }, { status: 500 })
  }
})
