import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import prisma from '@/lib/prisma'
import { Prisma } from '@/generated/prisma'
import { withAuthPost, type AuthenticatedUser } from '@/lib/auth-middleware'
import { requireFeature, requirePermission, requireTenant } from '@/lib/services/tenant-scope'
import { AuditLogService } from '@/lib/services/audit-log-service'
import { validarEscrituraPeriodo, extraerFechaDeBody } from '@/lib/services/validate-period-write'
import { calcularSaldoPendientePrestamo } from '@/lib/utils/prestamo-cash'
import { buildPersistedAccountingAmount } from '@/features/contabilidad/services/accounting-reconciliation-service';
import { postEvento } from '@/features/contabilidad-formal/services/posting-engine';
import { buildEventoCobroPrestamo } from '@/features/contabilidad-formal/lib/event-builders';
import { ActionError } from '@/lib/server-actions';
import { bloquearClienteCredito } from '@/features/ventas/services/credito-override';
import { resolveCashDebtCurrencyAmounts } from '@/features/contabilidad/services/cash-debt-payment-valuation';
import { getRequiredTenantAccountingPolicy } from '@/features/contabilidad/services/tenant-accounting-policy-service';

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
    requireFeature(user, 'prestamos-cash', 'registrar pagos de préstamos cash');
    requirePermission(user, 'financiero.contabilidad.acceder', 'registrar pagos de préstamos cash');
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

    // Referencia de la cuenta resuelta antes de abrir la transacción.
    const cuentaOrigen = await prisma.cuentaBancaria.findFirst({
      where: { cuentaId: body.cuentaId, tenantId, isActive: true },
      select: { cuentaId: true, moneda: true }
    })
    if (!cuentaOrigen) {
      return NextResponse.json({ error: 'Cuenta bancaria no encontrada o inactiva' }, { status: 400 })
    }

    // Valoración funcional desde la política del tenant dentro de la transacción.
    const fechaReconciliacion = new Date();
    const moneda = body.moneda || String(prestamo.moneda);

    const resultado = await prisma.$transaction(async (tx) => {
      const policy = await getRequiredTenantAccountingPolicy(tenantId, tx);
      const functionalCurrency = policy.functionalCurrencyCode.trim().toUpperCase();
      const conversion = buildPersistedAccountingAmount(
        new Prisma.Decimal(body.monto),
        moneda,
        body.tasaCambio ?? undefined,
        fechaReconciliacion,
        undefined,
        functionalCurrency,
      );
      if (conversion.montoConvertido == null || !conversion.fxEvidence) {
        throw new ActionError(
          'Falta evidencia FX funcional para el pago del préstamo', 'FX_INSUFICIENTE',
        );
      }
      await bloquearClienteCredito(tx, tenantId, prestamo.clienteId);
      const cxcVigente = await tx.cuentaPorCobrar.findFirst({
        where: { id: prestamo.cuentaPorCobrarId, tenantId },
        select: {
          id: true, montoDeuda: true, montoPagado: true, estado: true, monedaOriginal: true,
        },
      });
      if (!cxcVigente || cxcVigente.estado === 'ANULADA') {
        throw new ActionError('La cuenta por cobrar ya no está disponible', 'CREDITO_CONFLICTO');
      }
      const tipoPago = await tx.tipoPago.findFirst({
        where: { tipoId: body.tipoPagoId, tenantId, isActive: true },
        select: { tipoId: true },
      });
      if (!tipoPago) {
        throw new ActionError('Tipo de pago no encontrado o inactivo', 'NOT_FOUND');
      }
      const monedaObligacion = cxcVigente.monedaOriginal || prestamo.moneda;
      if (monedaObligacion !== prestamo.moneda) {
        throw new ActionError('La moneda de la obligación no coincide con el préstamo', 'FX_INSUFICIENTE');
      }
      const importes = resolveCashDebtCurrencyAmounts({
        monedaObligacion,
        monedaFondos: moneda,
        monedaCuenta: cuentaOrigen.moneda,
        montoFondos: body.monto,
        montoFuncional: conversion.montoConvertido!,
        functionalCurrency,
      });
      const saldoVigente = calcularSaldoPendientePrestamo(
        cxcVigente.montoDeuda, cxcVigente.montoPagado,
      );
      if (importes.montoObligacion.gt(saldoVigente)) {
        throw new ActionError('El saldo del préstamo cambió; vuelve a consultar', 'CREDITO_CONFLICTO');
      }

      const credit = await tx.cuentaBancaria.updateMany({
        where: {
          cuentaId: body.cuentaId, tenantId, isActive: true,
          moneda: cuentaOrigen.moneda,
        },
        data: { saldo: { increment: importes.montoCuenta.toNumber() } }
      })
      if (credit.count !== 1) throw new Error('Cuenta bancaria no disponible')

      const reconciliacion = await tx.reconciliacionVenta.create({
        data: {
          tenantId,
          cuentaId: body.cuentaId,
          tipoPagoId: body.tipoPagoId,
          monto: body.monto,
          moneda,
          ...(conversion.montoConvertido != null ? { montoConvertido: conversion.montoConvertido } : {}),
          montoCuenta: importes.montoCuenta,
          monedaCuenta: cuentaOrigen.moneda.trim().toUpperCase(),
          ...(conversion.tasaCambio != null ? { tasaCambio: conversion.tasaCambio } : {}),
          fechaReconciliacion,
          ...(conversion.fxEvidence ?? {}),
          ...(body.observaciones != null && { observaciones: body.observaciones }),
          reconciliadoPor: user.userId,
          prestamoCashId: prestamo.id,
          tipoReconciliacion: 'PRESTAMO_CASH'
        }
      })

      const nuevoMontoPagado = new Prisma.Decimal(cxcVigente.montoPagado)
        .plus(importes.montoObligacion)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
      const totalDeuda = cxcVigente.montoDeuda
      const nuevoSaldo = calcularSaldoPendientePrestamo(totalDeuda, nuevoMontoPagado)
      const nuevoEstadoCuenta = nuevoSaldo.lte('0.01') ? 'PAGADA' : 'PARCIAL'

      const actualizadaCxc = await tx.cuentaPorCobrar.updateMany({
        where: {
          id: prestamo.cuentaPorCobrarId,
          tenantId,
          montoPagado: cxcVigente.montoPagado,
          estado: cxcVigente.estado,
        },
        data: {
          montoPagado: nuevoMontoPagado,
          estado: nuevoEstadoCuenta
        }
      })
      if (actualizadaCxc.count !== 1) {
        throw new ActionError('El saldo del préstamo cambió; vuelve a consultar', 'CREDITO_CONFLICTO')
      }

      if (nuevoEstadoCuenta === 'PAGADA') {
        const actualizadoPrestamo = await tx.prestamoCash.updateMany({
          where: { id: prestamo.id, tenantId, estado: prestamo.estado, deletedAt: null },
          data: { estado: 'PAGADO' }
        })
        if (actualizadoPrestamo.count !== 1) {
          throw new ActionError('El estado del préstamo cambió; vuelve a consultar', 'CREDITO_CONFLICTO')
        }
      }

      // Capa de contabilidad formal (CTA-1/R6): cobro de préstamo, una vez por
      // origen dentro de la misma transacción; valoración heredada de la fila de
      // caja persistida, sin recalcular la tasa. Sin split capital/intereses
      // (decisión v1): el cobro contabiliza el monto total cobrado.
      await postEvento(tx, { tenantId, userId: user.userId }, buildEventoCobroPrestamo({
        reconciliacionId: reconciliacion.reconciliacionId,
        valoracion: {
          monto: reconciliacion.monto,
          moneda: reconciliacion.moneda || 'CUP',
          montoFuncional: reconciliacion.montoConvertido ?? undefined,
          monedaFuncionalCodigo: functionalCurrency,
          tasaCambio: reconciliacion.tasaCambio ?? undefined,
          fxEvidenceFingerprint: reconciliacion.fxEvidenceFingerprint ?? undefined,
        },
        fecha: reconciliacion.fechaReconciliacion,
        descripcion: body.observaciones || `Cobro de préstamo ${prestamo.id}`,
      }))

      await AuditLogService.logStrict({
        accion: 'CREATE',
        entidad: 'PAGO_PRESTAMO',
        entidadId: reconciliacion.reconciliacionId,
        usuarioId: user.userId,
        detalles: {
          prestamoId: prestamo.id,
          monto: body.monto,
          moneda: body.moneda || prestamo.moneda,
        },
      }, tx)

      return reconciliacion
    })

    return NextResponse.json({ reconciliacion: resultado }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros inválidos', details: error.errors }, { status: 400 })
    }
    if (error instanceof ActionError) {
      const status = error.code === 'FORBIDDEN' || error.code === 'FEATURE_NOT_AVAILABLE'
        ? 403
        : error.code === 'NOT_FOUND'
          ? 404
          : error.code === 'FX_INSUFICIENTE'
            ? 400
            : 409
      return NextResponse.json({ error: error.message, code: error.code }, { status })
    }
    console.error('Error registrando pago de préstamo:', error)
    return NextResponse.json({ error: 'Error registrando pago de préstamo' }, { status: 500 })
  }
})
