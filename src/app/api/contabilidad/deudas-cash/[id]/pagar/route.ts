import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import prisma from '@/lib/prisma'
import { Prisma } from '@/generated/prisma'
import { withAuthPost, type AuthenticatedUser } from '@/lib/auth-middleware'
import { requireFeature, requirePermission, requireTenant } from '@/lib/services/tenant-scope'
import { ActionError } from '@/lib/server-actions'
import { AuditLogService } from '@/lib/services/audit-log-service'
import { validarEscrituraPeriodo, extraerFechaDeBody } from '@/lib/services/validate-period-write'
import { calcularSaldoPendienteDeuda } from '@/lib/utils/deuda-cash'
import { buildPersistedAccountingAmount } from '@/features/contabilidad/services/accounting-reconciliation-service'
import { postEvento } from '@/features/contabilidad-formal/services/posting-engine'
import { buildEventoPagoDeuda } from '@/features/contabilidad-formal/lib/event-builders'
import { acquireAccountingTenantLock } from '@/features/contabilidad/services/accounting-tenant-lock-service'
import { resolveCashDebtCurrencyAmounts } from '@/features/contabilidad/services/cash-debt-payment-valuation'
import { getRequiredTenantAccountingPolicy } from '@/features/contabilidad/services/tenant-accounting-policy-service'
import { AccountingCashOperationsMutationService } from '@/features/contabilidad/services/accounting-cash-operations-mutation-service'

const pagoSchema = z.object({
  monto: z.coerce.number().positive('El monto debe ser positivo'),
  cuentaId: z.string().min(1, 'La cuenta bancaria es requerida'),
  tipoPagoId: z.string().min(1, 'El tipo de pago es requerido'),
  moneda: z.string().optional(),
  tasaCambio: z.coerce.number().positive().optional(),
  observaciones: z.string().optional(),
  idempotencyKey: z.string().trim().min(1).max(64).optional(),
})

/** @description Resuelve la clave del cuerpo antes que la cabecera y aplica sus límites. */
function resolveIdempotencyKey(bodyKey: string | undefined, headerKey: string | null): string | undefined {
  if (bodyKey !== undefined) return bodyKey;
  if (headerKey === null) return undefined;
  const key = headerKey.trim();
  if (!key || key.length > 64) {
    throw new ActionError('La clave de idempotencia no es válida', 'VALIDATION_ERROR');
  }
  return key;
}

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
export const POST = withAuthPost(async (request: NextRequest, context: unknown, user: AuthenticatedUser) => {
  try {
    if (!deudasCashEnabled()) {
      return NextResponse.json({ error: 'Módulo de deudas cash deshabilitado' }, { status: 404 })
    }

    const tenantId = requireTenant(user);
    requireFeature(user, 'deudas-cash', 'registrar pagos de deudas cash');
    requirePermission(user, 'financiero.contabilidad.acceder', 'registrar pagos de deudas cash');
    const { params } = context as { params: Promise<{ id: string }> }
    const { id } = await params
    const body = pagoSchema.parse(await request.json())
    const idempotencyKey = resolveIdempotencyKey(
      body.idempotencyKey,
      request.headers.get('idempotency-key'),
    );

    if (idempotencyKey) {
      const input = { ...body, id, idempotencyKey };
      const replay = await AccountingCashOperationsMutationService.findCashDebtPaymentReplay({
        input,
        user,
      });
      if (replay) return NextResponse.json({ reconciliacion: replay }, { status: 201 });

      const operationDate = extraerFechaDeBody(body as unknown as Record<string, unknown>) ?? new Date();
      const validacionPeriodo = await validarEscrituraPeriodo({
        fecha: operationDate,
        tenantId,
        tipoOperacion: 'pago_deuda_cash',
        actor: user.userId,
      });
      if (!validacionPeriodo.permitido) {
        const replayAfterGate = await AccountingCashOperationsMutationService.findCashDebtPaymentReplay({
          input,
          user,
        });
        if (replayAfterGate) return NextResponse.json({ reconciliacion: replayAfterGate }, { status: 201 });
        return NextResponse.json(
          { error: validacionPeriodo.error?.message ?? 'Período contable cerrado', code: validacionPeriodo.error?.code ?? 'PERIODO_CERRADO' },
          { status: 400 },
        );
      }
      const reconciliacion = await AccountingCashOperationsMutationService.registerCashDebtPayment({
        input,
        user,
        operationDate,
      });
      return NextResponse.json({ reconciliacion }, { status: 201 });
    }

    // Validar período contable antes de registrar el pago
    const fechaOperacion = extraerFechaDeBody(body as unknown as Record<string, unknown>) ?? new Date()
    const validacionPeriodo = await validarEscrituraPeriodo({
      fecha: fechaOperacion,
      tenantId,
      tipoOperacion: 'pago_deuda_cash',
      actor: user.userId,
    })
    if (!validacionPeriodo.permitido) {
      return NextResponse.json(
        { error: validacionPeriodo.error?.message ?? 'Período contable cerrado', code: validacionPeriodo.error?.code ?? 'PERIODO_CERRADO' },
        { status: 400 }
      )
    }

    const deudaPrevia = await prisma.deudaCash.findFirst({
      where: { id, deletedAt: null, tenantId },
      include: { cuentaPorPagar: true },
    })
    if (!deudaPrevia) return NextResponse.json({ error: 'Deuda no encontrada' }, { status: 404 })
    const cuenta = await prisma.cuentaBancaria.findFirst({
      where: { cuentaId: body.cuentaId, tenantId, isActive: true },
      select: { cuentaId: true, moneda: true },
    })
    if (!cuenta) {
      return NextResponse.json({ error: 'Cuenta bancaria no encontrada o inactiva' }, { status: 400 })
    }

    const fechaReconciliacion = new Date()
    const moneda = body.moneda || String(deudaPrevia.moneda)

    const resultado = await prisma.$transaction(async (tx) => {
      await acquireAccountingTenantLock(tx, tenantId)
      const policy = await getRequiredTenantAccountingPolicy(tenantId, tx)
      const functionalCurrency = policy.functionalCurrencyCode.trim().toUpperCase()
      const conversion = buildPersistedAccountingAmount(
        body.monto, moneda, body.tasaCambio, fechaReconciliacion,
        undefined, functionalCurrency,
      )
      if (conversion.montoConvertido == null || !conversion.fxEvidence) {
        throw new ActionError(
          'Falta evidencia FX funcional para el pago de la deuda', 'FX_INSUFICIENTE',
        )
      }
      const deuda = await tx.deudaCash.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: { cuentaPorPagar: true },
      })
      if (!deuda) throw new ActionError('Deuda no encontrada', 'NOT_FOUND')
      if (deuda.estado === 'PAGADO' || deuda.estado === 'CANCELADO') {
        throw new ActionError('La deuda no admite más pagos', 'VALIDATION_ERROR')
      }

      if (deuda.cuentaPorPagar.moneda !== deuda.moneda) {
        throw new ActionError(
          'La moneda de la obligación no coincide con la deuda', 'FX_INSUFICIENTE',
        )
      }
      const tipoPago = await tx.tipoPago.findFirst({
        where: { tipoId: body.tipoPagoId, tenantId, isActive: true },
        select: { tipoId: true },
      });
      if (!tipoPago) {
        throw new ActionError('Tipo de pago no encontrado o inactivo', 'NOT_FOUND');
      }
      const importes = resolveCashDebtCurrencyAmounts({
        monedaObligacion: deuda.cuentaPorPagar.moneda,
        monedaFondos: moneda,
        monedaCuenta: cuenta.moneda,
        montoFondos: body.monto,
        montoFuncional: conversion.montoConvertido!,
        functionalCurrency,
      })
      const saldoPendiente = calcularSaldoPendienteDeuda(
        deuda.cuentaPorPagar.montoDeuda, deuda.cuentaPorPagar.montoPagado,
      )
      if (importes.montoObligacion.gt(saldoPendiente)) {
        throw new ActionError(
          `El monto excede el saldo pendiente de ${saldoPendiente}`, 'CREDITO_CONFLICTO',
        )
      }

      const debit = await tx.cuentaBancaria.updateMany({
        where: {
          cuentaId: body.cuentaId,
          tenantId,
          isActive: true,
          moneda: cuenta.moneda,
          saldo: { gte: importes.montoCuenta.toNumber() },
        },
        data: { saldo: { decrement: importes.montoCuenta.toNumber() } },
      })
      if (debit.count !== 1) {
        throw new ActionError('Cuenta bancaria no disponible o saldo insuficiente', 'VALIDATION_ERROR')
      }

      const reconciliacion = await tx.reconciliacionVenta.create({
        data: {
          tenantId,
          cuentaId: body.cuentaId,
          tipoPagoId: body.tipoPagoId,
          monto: body.monto,
          moneda,
          montoConvertido: conversion.montoConvertido,
          montoCuenta: importes.montoCuenta,
          monedaCuenta: cuenta.moneda.trim().toUpperCase(),
          ...(conversion.tasaCambio != null ? { tasaCambio: conversion.tasaCambio } : {}),
          fechaReconciliacion,
          ...conversion.fxEvidence,
          ...(body.observaciones != null ? { observaciones: body.observaciones } : {}),
          reconciliadoPor: user.userId,
          deudaCashId: deuda.id,
          tipoReconciliacion: 'DEUDA_CASH',
        },
      })

      // A5: sin redondeo a 2 decimales; se preservan los 4 decimales
      // significativos acordados en R0.1.
      const nuevoMontoPagado = new Prisma.Decimal(deuda.cuentaPorPagar.montoPagado)
        .plus(importes.montoObligacion);
      const nuevoMontoPagadoFuncional = new Prisma.Decimal(deuda.cuentaPorPagar.montoPagadoFuncional ?? 0)
        .plus(conversion.montoConvertido ?? importes.montoObligacion);
      const totalDeuda = deuda.cuentaPorPagar.montoDeuda
      const nuevoSaldoPendiente = calcularSaldoPendienteDeuda(totalDeuda, nuevoMontoPagado)
      const nuevoEstadoCuenta = nuevoSaldoPendiente.lte(0) ? 'PAGADA' : 'PARCIAL'
      const actualizadoCxP = await tx.cuentaPorPagar.updateMany({
        where: {
          cuentaPorPagarId: deuda.cuentaPorPagarId,
          tenantId,
          montoPagado: deuda.cuentaPorPagar.montoPagado,
          estado: deuda.cuentaPorPagar.estado,
        },
        data: {
          montoPagado: nuevoMontoPagado,
          montoPagadoFuncional: nuevoMontoPagadoFuncional,
          saldoPendiente: nuevoSaldoPendiente,
          estado: nuevoEstadoCuenta,
        },
      })
      if (actualizadoCxP.count !== 1) {
        throw new ActionError('El saldo de la deuda cambió; vuelve a consultar', 'CREDITO_CONFLICTO')
      }

      if (nuevoEstadoCuenta === 'PAGADA') {
        const actualizadaDeuda = await tx.deudaCash.updateMany({
          where: { id: deuda.id, tenantId, estado: deuda.estado, deletedAt: null },
          data: { estado: 'PAGADO' },
        })
        if (actualizadaDeuda.count !== 1) {
          throw new ActionError('El estado de la deuda cambió; vuelve a consultar', 'CREDITO_CONFLICTO')
        }
      }

      await postEvento(tx, { tenantId, userId: user.userId }, buildEventoPagoDeuda({
        reconciliacionId: reconciliacion.reconciliacionId,
        valoracion: {
          monto: reconciliacion.monto,
          moneda: reconciliacion.moneda,
          montoFuncional: reconciliacion.montoConvertido ?? undefined,
          monedaFuncionalCodigo: functionalCurrency,
          tasaCambio: reconciliacion.tasaCambio ?? undefined,
          fxEvidenceFingerprint: reconciliacion.fxEvidenceFingerprint ?? undefined,
        },
        fecha: reconciliacion.fechaReconciliacion,
        descripcion: body.observaciones || `Pago de deuda ${deuda.id}`,
      }))
      await AuditLogService.logStrict({
        accion: 'CREATE',
        entidad: 'PAGO_DEUDA',
        entidadId: reconciliacion.reconciliacionId,
        usuarioId: user.userId,
        detalles: { deudaId: deuda.id, monto: body.monto, moneda },
      }, tx)
      return { reconciliacion, deudaId: deuda.id, moneda }
    })

    return NextResponse.json({ reconciliacion: resultado.reconciliacion }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros inválidos', details: error.errors }, { status: 400 })
    }
    if (error instanceof ActionError) {
      const status = ['FORBIDDEN', 'FEATURE_NOT_AVAILABLE', 'TENANT_REQUIRED'].includes(error.code)
        ? 403
        : error.code === 'NOT_FOUND'
          ? 404
          : error.code === 'IDEMPOTENCY_CONFLICT'
            ? 409
          : error.code === 'CREDITO_CONFLICTO'
            ? 409
            : 400
      return NextResponse.json({ error: error.message, code: error.code }, { status })
    }
    console.error('Error registrando pago de deuda:', error)
    return NextResponse.json({ error: 'Error registrando pago de deuda' }, { status: 500 })
  }
})
