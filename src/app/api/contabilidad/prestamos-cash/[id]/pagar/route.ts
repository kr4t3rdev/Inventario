import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import prisma from '@/lib/prisma'
import { withAuthPost, type AuthenticatedUser } from '@/lib/auth-middleware'
import { requireTenant } from '@/lib/services/tenant-scope'
import { AuditLogService } from '@/lib/services/audit-log-service'
import { validarEscrituraPeriodo, extraerFechaDeBody } from '@/lib/services/validate-period-write'
import { calcularSaldoPendientePrestamo } from '@/lib/utils/prestamo-cash'
import { buildPersistedAccountingAmount } from '@/features/contabilidad/services/accounting-reconciliation-service';
import { postEvento } from '@/features/contabilidad-formal/services/posting-engine';
import { buildEventoCobroPrestamo } from '@/features/contabilidad-formal/lib/event-builders';
import { ActionError } from '@/lib/server-actions';
import { bloquearClienteCredito } from '@/features/ventas/services/credito-override';

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
export const POST = withAuthPost(async (request: NextRequest, context: unknown, user: AuthenticatedUser) => {
  try {
    if (!prestamosCashEnabled()) {
      return NextResponse.json({ error: 'Módulo de préstamos cash deshabilitado' }, { status: 404 })
    }

    const tenantId = requireTenant(user);
    const { params } = context as { params: Promise<{ id: string }> }
    const { id } = await params
    const body = pagoSchema.parse(await request.json())

    // Búsqueda tenant-scoped: un préstamo de otro tenant es inexistente.
    const prestamo = await prisma.prestamoCash.findFirst({
      where: { id, deletedAt: null, tenantId },
      include: { cuentaPorCobrar: true }
    })

    if (!prestamo) {
      return NextResponse.json({ error: 'Préstamo no encontrado' }, { status: 404 })
    }

    // Validar período contable antes de registrar el pago
    const fechaOperacion = extraerFechaDeBody(body as unknown as Record<string, unknown>) ?? new Date()
    const validacionPeriodo = await validarEscrituraPeriodo({
      fecha: fechaOperacion,
      tenantId: prestamo.tenantId,
      tipoOperacion: 'pago_prestamo_cash',
      actor: user.userId,
    })
    if (!validacionPeriodo.permitido) {
      return NextResponse.json(
        { error: validacionPeriodo.error?.message ?? 'Período contable cerrado', code: validacionPeriodo.error?.code ?? 'PERIODO_CERRADO' },
        { status: 400 }
      )
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

    // Referencia de la cuenta resuelta antes de abrir la transacción.
    const cuentaOrigen = await prisma.cuentaBancaria.findFirst({
      where: { cuentaId: body.cuentaId, tenantId, isActive: true },
      select: { cuentaId: true }
    })
    if (!cuentaOrigen) {
      return NextResponse.json({ error: 'Cuenta bancaria no encontrada o inactiva' }, { status: 400 })
    }

    // Valoración persistida una sola vez; sin tasa explícita en moneda extranjera
    // se rechaza antes de escribir (el camino CUP legítimo siempre tiene evidencia).
    const fechaReconciliacion = new Date();
    const conversion = buildPersistedAccountingAmount(
      Number(body.monto),
      body.moneda || String(prestamo.moneda),
      body.tasaCambio ?? undefined,
      fechaReconciliacion,
    );
    if (conversion.montoConvertido == null ||
        ((body.moneda || String(prestamo.moneda)).toUpperCase() !== 'CUP' && !conversion.fxEvidence)) {
      return NextResponse.json(
        { error: 'Falta evidencia de conversión para el pago del préstamo', code: 'FX_INSUFICIENTE' },
        { status: 400 }
      )
    }

    const resultado = await prisma.$transaction(async (tx) => {
      await bloquearClienteCredito(tx, tenantId, prestamo.clienteId);
      const cxcVigente = await tx.cuentaPorCobrar.findFirst({
        where: { id: prestamo.cuentaPorCobrarId, tenantId },
        select: { id: true, montoDeuda: true, montoPagado: true, estado: true },
      });
      if (!cxcVigente || cxcVigente.estado === 'ANULADA') {
        throw new ActionError('La cuenta por cobrar ya no está disponible', 'CREDITO_CONFLICTO');
      }
      const saldoVigente = calcularSaldoPendientePrestamo(
        Number(cxcVigente.montoDeuda),
        Number(cxcVigente.montoPagado),
      );
      if (body.monto > saldoVigente) {
        throw new ActionError('El saldo del préstamo cambió; vuelve a consultar', 'CREDITO_CONFLICTO');
      }

      const credit = await tx.cuentaBancaria.updateMany({
        where: { cuentaId: body.cuentaId, tenantId, isActive: true },
        data: { saldo: { increment: body.monto } }
      })
      if (credit.count !== 1) throw new Error('Cuenta bancaria no disponible')

      const reconciliacion = await tx.reconciliacionVenta.create({
        data: {
          tenantId,
          cuentaId: body.cuentaId,
          tipoPagoId: body.tipoPagoId,
          monto: body.monto,
          moneda: body.moneda || prestamo.moneda,
          ...(conversion.montoConvertido != null ? { montoConvertido: conversion.montoConvertido } : {}),
          ...(conversion.tasaCambio != null ? { tasaCambio: conversion.tasaCambio } : {}),
          fechaReconciliacion,
          ...(conversion.fxEvidence ?? {}),
          ...(body.observaciones != null && { observaciones: body.observaciones }),
          reconciliadoPor: user.userId,
          prestamoCashId: prestamo.id,
          tipoReconciliacion: 'PRESTAMO_CASH'
        }
      })

      const nuevoMontoPagado = Number((Number(cxcVigente.montoPagado) + body.monto).toFixed(2))
      const totalDeuda = Number(cxcVigente.montoDeuda)
      const nuevoSaldo = calcularSaldoPendientePrestamo(totalDeuda, nuevoMontoPagado)
      const nuevoEstadoCuenta = nuevoSaldo <= 0.01 ? 'PAGADA' : 'PARCIAL'

      await tx.cuentaPorCobrar.update({
        where: { id: prestamo.cuentaPorCobrarId, tenantId },
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

      // Capa de contabilidad formal (CTA-1/R6): cobro de préstamo, una vez por
      // origen dentro de la misma transacción; valoración heredada de la fila de
      // caja persistida, sin recalcular la tasa. Sin split capital/intereses
      // (decisión v1): el cobro contabiliza el monto total cobrado.
      await postEvento(tx, { tenantId, userId: user.userId }, buildEventoCobroPrestamo({
        reconciliacionId: reconciliacion.reconciliacionId,
        valoracion: {
          monto: Number(reconciliacion.monto),
          moneda: reconciliacion.moneda || 'CUP',
          montoFuncional: reconciliacion.montoConvertido == null ? undefined : Number(reconciliacion.montoConvertido),
          tasaCambio: reconciliacion.tasaCambio == null ? undefined : Number(reconciliacion.tasaCambio),
          fxEvidenceFingerprint: reconciliacion.fxEvidenceFingerprint ?? undefined,
        },
        fecha: reconciliacion.fechaReconciliacion,
        descripcion: body.observaciones || `Cobro de préstamo ${prestamo.id}`,
      }))

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
    if (error instanceof ActionError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 409 })
    }
    console.error('Error registrando pago de préstamo:', error)
    return NextResponse.json({ error: 'Error registrando pago de préstamo' }, { status: 500 })
  }
})
