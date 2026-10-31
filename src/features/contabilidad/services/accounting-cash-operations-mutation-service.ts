import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma';
import { buildPersistedAccountingAmount } from '@/features/contabilidad/services/accounting-reconciliation-service';
import { ActionError } from '@/lib/server-actions';
import { AuditLogService } from '@/lib/services/audit-log-service';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { requireFeature, requirePermission, requireTenant } from '@/lib/services/tenant-scope';
import { acquireAccountingTenantLock } from './accounting-tenant-lock-service';
import { getRequiredTenantAccountingPolicy } from './tenant-accounting-policy-service';
import { buildAppliedFxEvidence } from '@/features/contabilidad/domain/fx-evidence';
import { resolveCashDebtCurrencyAmounts } from '@/features/contabilidad/services/cash-debt-payment-valuation';
import { buildCashPaymentEvent } from '@/features/contabilidad-formal/lib/cash-payment-event-builder';
import { calculateCashObligationPaymentAllocation } from '@/features/contabilidad-formal/lib/cash-obligation-payment-allocation';
import { postEvento } from '@/features/contabilidad-formal/services/posting-engine';
import { validarEscrituraPeriodo } from '@/lib/services/validate-period-write';
import {
  cashCreatePayloadHash,
  normalizeCashCreateIdempotencyKey,
} from '@/lib/services/cash-create-idempotency';

function prestamosCashEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_PRESTAMOS_CASH !== 'false';
}

function deudasCashEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_DEUDAS_CASH !== 'false';
}

function requireAnnualRate(value: number | undefined, field: string): Prisma.Decimal {
  if (value === undefined) {
    throw new ActionError(`La tasa anual ${field} es obligatoria`, 'INTEREST_POLICY_REQUIRED');
  }
  const rate = new Prisma.Decimal(value);
  if (!rate.isFinite() || rate.isNegative() || rate.decimalPlaces() > 10) {
    throw new ActionError(`La tasa anual ${field} no es válida`, 'VALIDATION_ERROR');
  }
  return rate;
}

function dateOnly(value: Date): Date {
  if (!Number.isFinite(value.getTime())) {
    throw new ActionError('La fecha de la operación no es válida', 'VALIDATION_ERROR');
  }
  return new Date(`${value.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

function dateOnlyInput(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ActionError('La fecha de vencimiento debe usar YYYY-MM-DD', 'VALIDATION_ERROR');
  }
  const result = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(result.getTime()) || result.toISOString().slice(0, 10) !== value) {
    throw new ActionError('La fecha de vencimiento no es válida', 'VALIDATION_ERROR');
  }
  return result;
}

function roundedAccruedDelta(carryBefore: Prisma.Decimal, accruedThisPeriod: Prisma.Decimal) {
  const posting = carryBefore.plus(accruedThisPeriod)
    .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
  const previouslyPosted = carryBefore.toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
  return posting.minus(previouslyPosted);
}

function buildCashInterestAllocationRecord(input: {
  tenantId: string;
  obligationType: 'loan' | 'debt';
  reconciliationId: string;
  asientoId: string | null;
  interestAllocation: ReturnType<typeof calculateCashObligationPaymentAllocation>;
  paymentAmount: Prisma.Decimal;
  functionalAmount: Prisma.Decimal;
  moratoryFunctional: Prisma.Decimal;
  ordinaryFunctional: Prisma.Decimal;
  principalFunctional: Prisma.Decimal;
  functionalCurrency: string;
  fxEvidenceFingerprint: string | null;
}) {
  const { interestAllocation: calculation } = input;
  return {
    tenantId: input.tenantId,
    reconciliacionId: input.reconciliationId,
    asientoId: input.asientoId,
    obligationType: input.obligationType,
    policyVersion: 1,
    grantDate: calculation.grantDate,
    maturityDate: calculation.maturityDate,
    paymentDate: calculation.paymentDate,
    accrualCheckpointDate: calculation.accruedThroughDate,
    ordinaryElapsedDays: calculation.ordinaryElapsedDays,
    moratoryElapsedDays: calculation.moratoryElapsedDays,
    ordinaryAnnualRate: calculation.ordinaryAnnualRate,
    moratoryAnnualRate: calculation.moratoryAnnualRate,
    principalBefore: calculation.principalBefore,
    overduePrincipalBefore: calculation.overduePrincipalBefore,
    ordinaryCarryBefore: calculation.ordinaryCarryBefore,
    moratoryCarryBefore: calculation.moratoryCarryBefore,
    ordinaryAccruedThisPeriod: calculation.ordinaryAccruedThisPeriod,
    moratoryAccruedThisPeriod: calculation.moratoryAccruedThisPeriod,
    paymentAmount: input.paymentAmount,
    moratoryAllocated: calculation.allocation.allocated.moratoryInterest,
    ordinaryAllocated: calculation.allocation.allocated.ordinaryInterest,
    principalAllocated: calculation.allocation.allocated.principal,
    principalAfter: calculation.principalAfter,
    ordinaryCarryAfter: calculation.ordinaryCarryAfter,
    moratoryCarryAfter: calculation.moratoryCarryAfter,
    functionalAmount: input.functionalAmount,
    moratoryFunctional: input.moratoryFunctional,
    ordinaryFunctional: input.ordinaryFunctional,
    principalFunctional: input.principalFunctional,
    functionalCurrency: input.functionalCurrency,
    fxEvidenceFingerprint: input.fxEvidenceFingerprint,
    eventFingerprint: cashCreatePayloadHash({
      reconciliationId: input.reconciliationId,
      obligationType: input.obligationType,
      policyVersion: 1,
      paymentDate: calculation.paymentDate.toISOString().slice(0, 10),
      principalBefore: calculation.principalBefore.toFixed(4),
      ordinaryAnnualRate: calculation.ordinaryAnnualRate.toFixed(10),
      moratoryAnnualRate: calculation.moratoryAnnualRate.toFixed(10),
      ordinaryCarryBefore: calculation.ordinaryCarryBefore.toString(),
      moratoryCarryBefore: calculation.moratoryCarryBefore.toString(),
      paymentAmount: input.paymentAmount.toFixed(4),
      functionalAmount: input.functionalAmount.toFixed(4),
      fxEvidenceFingerprint: input.fxEvidenceFingerprint,
      ordinaryAllocated: calculation.allocation.allocated.ordinaryInterest.toFixed(4),
      moratoryAllocated: calculation.allocation.allocated.moratoryInterest.toFixed(4),
      principalAllocated: calculation.allocation.allocated.principal.toFixed(4),
    }),
  };
}

export function validateCashPaymentAmount(amount: number): Prisma.Decimal {
  let decimal: Prisma.Decimal;
  try {
    decimal = new Prisma.Decimal(amount);
  } catch {
    throw new ActionError('El monto del pago no es válido', 'INVALID_AMOUNT');
  }
  if (!decimal.isFinite() || decimal.lte(0) || decimal.decimalPlaces() > 4) {
    throw new ActionError('El monto debe ser positivo y tener máximo cuatro decimales', 'INVALID_AMOUNT');
  }
  return decimal;
}

function cashPaymentIdempotencyKey(value: unknown): string | null {
  if (value === undefined) return null;
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 64) {
    throw new ActionError('La clave de idempotencia no es válida', 'VALIDATION_ERROR');
  }
  return `cash-payment:${value.trim()}`;
}

function cashPaymentPayloadHash(input: {
  operation: 'CASH_DEBT_PAYMENT' | 'CASH_LOAN_PAYMENT';
  id: string;
  monto: Prisma.Decimal;
  cuentaId: string;
  tipoPagoId: string;
  moneda: string;
  tasaCambio?: number;
  observaciones?: string;
}): string {
  return cashCreatePayloadHash({
    ...input,
    monto: input.monto.toFixed(),
    moneda: input.moneda.trim().toUpperCase(),
    tasaCambio: input.tasaCambio == null
      ? null
      : new Prisma.Decimal(input.tasaCambio).toFixed(),
    observaciones: input.observaciones ?? null,
  });
}

async function buildObligationFxSnapshot(
  tx: any,
  tenantId: string,
  amount: Prisma.Decimal,
  currencyValue: string,
  exchangeRate: number | undefined,
  effectiveAt: Date,
  source: string,
) {
  const currency = currencyValue.trim().toUpperCase();
  const policy = await getRequiredTenantAccountingPolicy(tenantId, tx);
  const functionalCurrency = policy.functionalCurrencyCode.trim().toUpperCase();
  const sameCurrency = currency === functionalCurrency;
  const rate = sameCurrency
    ? new Prisma.Decimal(1)
    : exchangeRate == null ? null : new Prisma.Decimal(exchangeRate);
  if (!rate || !rate.isFinite() || rate.lte(0)) {
    throw new ActionError('Se requiere una tasa válida para la moneda funcional', 'FX_EVIDENCE_REQUIRED');
  }
  const functionalAmount = sameCurrency
    ? amount
    : amount.mul(rate).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
  const evidence = buildAppliedFxEvidence({
    originalAmount: amount.toNumber(),
    originalCurrency: currency,
    functionalCurrency,
    exchangeRate: rate.toNumber(),
    convertedAmount: functionalAmount.toNumber(),
    rateEffectiveAt: effectiveAt,
    source,
  });
  const evidenceJson = {
    ...evidence,
    originalAmount: amount.toFixed(4),
    originalCurrency: currency,
    functionalAmount: functionalAmount.toFixed(4),
    functionalCurrency,
    exchangeRate: rate.toFixed(10),
    rateEffectiveAt: effectiveAt.toISOString(),
  };
  return {
    amount: functionalAmount,
    functionalCurrency,
    fields: {
      montoDeudaFuncional: functionalAmount,
      montoPagadoFuncional: new Prisma.Decimal(0),
      monedaOriginal: currency,
      monedaFuncional: functionalCurrency,
      tasaCambio: rate,
      rateEffectiveAt: effectiveAt,
      fxProvenanceKind: evidence.fxProvenanceKind,
      fxProvenanceSource: source,
      fxCatalogRateId: null,
      fxEvidenceJson: evidenceJson,
      fxEvidenceFingerprint: evidence.fxEvidenceFingerprint,
      fxEvidenceVersion: evidence.fxEvidenceVersion,
    },
  };
}

/**
 * @description Servicio compartido de mutaciones para préstamos/deudas cash reutilizable por web y mobile.
 */
export const AccountingCashOperationsMutationService = {
  async findCashLoanCreateReplay({
    input,
    user,
  }: {
    input: {
      clienteId: string;
      montoCapital: number;
      moneda?: string;
      tasaInteres?: number;
      tasaInteresMoratorio?: number;
      tasaCambioAlCrear?: number;
      fechaVencimiento?: string;
      observaciones?: string;
      cuentaBancariaId: string;
      idempotencyKey?: string;
    };
    user: AuthenticatedUser;
  }) {
    if (!prestamosCashEnabled()) {
      throw new ActionError('Módulo de préstamos cash deshabilitado', 'DISABLED');
    }

    const tenantId = requireTenant(user);
    const idempotencyKey = normalizeCashCreateIdempotencyKey(input.idempotencyKey);
    if (!idempotencyKey) return null;
    const payloadHash = cashCreatePayloadHash({
      operation: 'CREATE_PRESTAMO_CASH',
      clienteId: input.clienteId,
      montoCapital: input.montoCapital,
      moneda: input.moneda ?? 'CUP',
      tasaInteres: input.tasaInteres ?? null,
      tasaInteresMoratorio: input.tasaInteresMoratorio,
      tasaCambioAlCrear: input.tasaCambioAlCrear ?? null,
      fechaVencimiento: input.fechaVencimiento ?? null,
      observaciones: input.observaciones ?? null,
      cuentaBancariaId: input.cuentaBancariaId,
    });

    return prisma.$transaction(async (tx: any) => {
      await acquireAccountingTenantLock(tx, tenantId);
      const existing = await tx.reconciliacionVenta.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
      });
      if (!existing) return null;
      if (
        existing.idempotencyPayloadHash !== payloadHash ||
        typeof existing.prestamoCashId !== 'string' || !existing.prestamoCashId
      ) {
        throw new ActionError(
          'La clave de idempotencia ya fue usada con datos diferentes',
          'IDEMPOTENCY_CONFLICT',
        );
      }
      const replay = await tx.prestamoCash.findFirst({
        where: { id: existing.prestamoCashId, tenantId, deletedAt: null },
        include: { cliente: { select: { clienteId: true, nombre: true } }, cuentaPorCobrar: true },
      });
      if (!replay) {
        throw new ActionError('La operación idempotente no está disponible', 'IDEMPOTENCY_CONFLICT');
      }
      return replay;
    });
  },

  async createCashLoan({
    input,
    user,
    operationDate,
  }: {
    input: {
      clienteId: string;
      montoCapital: number;
      moneda?: string;
      tasaInteres?: number;
      tasaInteresMoratorio?: number;
      tasaCambioAlCrear?: number;
      fechaVencimiento?: string;
      observaciones?: string;
      cuentaBancariaId: string;
      idempotencyKey?: string;
    };
    user: AuthenticatedUser;
    operationDate?: Date;
  }) {
    if (!prestamosCashEnabled()) {
      throw new ActionError('Módulo de préstamos cash deshabilitado', 'DISABLED');
    }

    const ordinaryAnnualRate = requireAnnualRate(input.tasaInteres, 'ordinaria');
    const moratoryAnnualRate = requireAnnualRate(input.tasaInteresMoratorio, 'moratoria');
    const grantDate = dateOnly(operationDate ?? new Date());
    const maturityDate = input.fechaVencimiento ? dateOnlyInput(input.fechaVencimiento) : null;

    const tenantId = requireTenant(user);
    const idempotencyKey = normalizeCashCreateIdempotencyKey(input.idempotencyKey);
    const idempotencyPayloadHash = idempotencyKey
      ? cashCreatePayloadHash({
          operation: 'CREATE_PRESTAMO_CASH',
          clienteId: input.clienteId,
          montoCapital: input.montoCapital,
          moneda: input.moneda ?? 'CUP',
          tasaInteres: input.tasaInteres ?? null,
          tasaInteresMoratorio: input.tasaInteresMoratorio,
          tasaCambioAlCrear: input.tasaCambioAlCrear ?? null,
          fechaVencimiento: input.fechaVencimiento ?? null,
          observaciones: input.observaciones ?? null,
          cuentaBancariaId: input.cuentaBancariaId,
        })
      : null;

    const { prestamo } = await prisma.$transaction(async (tx: any) => {
      await acquireAccountingTenantLock(tx, tenantId);
      if (idempotencyKey) {
        const existing = await tx.reconciliacionVenta.findUnique({
          where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
        });
        if (existing) {
          if (
            existing.idempotencyPayloadHash !== idempotencyPayloadHash ||
            typeof existing.prestamoCashId !== 'string' || !existing.prestamoCashId
          ) {
            throw new ActionError(
              'La clave de idempotencia ya fue usada con datos diferentes',
              'IDEMPOTENCY_CONFLICT',
            );
          }
          const existingLoan = await tx.prestamoCash.findFirst({
            where: { id: existing.prestamoCashId, tenantId, deletedAt: null },
            include: { cliente: { select: { clienteId: true, nombre: true } }, cuentaPorCobrar: true },
          });
          if (!existingLoan) {
            throw new ActionError(
              'La operación idempotente no está disponible',
              'IDEMPOTENCY_CONFLICT',
            );
          }
          return { prestamo: existingLoan, replayed: true };
        }
      }

      requireFeature(user, 'prestamos-cash', 'crear préstamos cash');

      const cliente = await tx.cliente.findFirst({
        where: { clienteId: input.clienteId, tenantId },
        select: { clienteId: true },
      });
      if (!cliente) throw new ActionError('Cliente no encontrado', 'NOT_FOUND');

      const cuentaOrigen = await tx.cuentaBancaria.findFirst({
        where: { cuentaId: input.cuentaBancariaId, tenantId },
        select: { cuentaId: true, saldo: true, isActive: true },
      });
      if (!cuentaOrigen || !cuentaOrigen.isActive) {
        throw new ActionError('Cuenta bancaria no encontrada o inactiva', 'VALIDATION_ERROR');
      }
      if (cuentaOrigen.saldo < input.montoCapital) {
        throw new ActionError(
          `Saldo insuficiente en la cuenta. Disponible: ${cuentaOrigen.saldo}`,
          'VALIDATION_ERROR',
        );
      }

      const debit = await tx.cuentaBancaria.updateMany({
        where: {
          cuentaId: input.cuentaBancariaId,
          tenantId,
          isActive: true,
          saldo: { gte: input.montoCapital },
        },
        data: { saldo: { decrement: input.montoCapital } },
      });
      if (debit.count !== 1) {
        throw new ActionError(
          'Saldo insuficiente o cuenta bancaria no disponible',
          'VALIDATION_ERROR',
        );
      }

      const tp =
        (await tx.tipoPago.findFirst({ where: { nombre: 'Transferencia', isActive: true, tenantId } })) ||
        (await tx.tipoPago.findFirst({ where: { nombre: 'Efectivo', isActive: true, tenantId } }));
      if (!tp) {
        throw new ActionError(
          'No existe un tipo de pago válido para registrar el desembolso',
          'VALIDATION_ERROR',
        );
      }

      const montoDeuda = input.montoCapital;
      const fechaReconciliacion = operationDate ?? new Date();
      const monedaObligacion = (input.moneda || 'CUP').trim().toUpperCase();
      const obligationFx = await buildObligationFxSnapshot(
        tx,
        tenantId,
        new Prisma.Decimal(montoDeuda),
        monedaObligacion,
        input.tasaCambioAlCrear,
        fechaReconciliacion,
        'cash-loan-obligation',
      );

      const cxcData: Record<string, unknown> = {
        tenant: { connect: { tenantId } },
        cliente: { connect: { clienteId: input.clienteId } },
        montoDeuda,
        montoPagado: 0,
        montoOriginal: new Prisma.Decimal(montoDeuda),
        ...obligationFx.fields,
        tipoCuenta: 'PRESTAMO_CASH',
        estado: 'PENDIENTE',
      };
      if (maturityDate) cxcData.fechaVencimiento = maturityDate;

      const cxc = await tx.cuentaPorCobrar.create({ data: cxcData });

      const conversion = buildPersistedAccountingAmount(
        Number(input.montoCapital),
        input.moneda || 'CUP',
        input.tasaCambioAlCrear ?? undefined,
        fechaReconciliacion,
      );
      const reconciliacionData: Record<string, unknown> = {
        tenant: { connect: { tenantId } },
        cuentaBancaria: { connect: { cuentaId: input.cuentaBancariaId } },
        tipoPago: { connect: { tipoId: tp.tipoId } },
        monto: input.montoCapital,
        moneda: input.moneda || 'CUP',
        montoConvertido: conversion.montoConvertido,
        fechaReconciliacion,
        ...(conversion.fxEvidence ?? {}),
        observaciones:
          input.observaciones || `Desembolso de préstamo cash para cliente ${input.clienteId}`,
        reconciliadoPor: user.userId,
        tipoReconciliacion: 'PRESTAMO_CASH_DESEMBOLSO',
        ...(idempotencyKey ? { idempotencyKey, idempotencyPayloadHash } : {}),
      };
      if (conversion.tasaCambio != null) {
        reconciliacionData.tasaCambio = conversion.tasaCambio;
      }

      const reconciliacion = await tx.reconciliacionVenta.create({ data: reconciliacionData });

      const prestamoData: Record<string, unknown> = {
        tenant: { connect: { tenantId } },
        cliente: { connect: { clienteId: input.clienteId } },
        cuentaPorCobrar: { connect: { id: cxc.id } },
        montoCapital: input.montoCapital,
        moneda: input.moneda || 'CUP',
        createdById: user.userId,
        cuentaBancariaId: input.cuentaBancariaId,
      };
      if (input.tasaInteres !== undefined) prestamoData.tasaInteres = input.tasaInteres;
      prestamoData.ordinaryAnnualRate = ordinaryAnnualRate;
      prestamoData.moratoryAnnualRate = moratoryAnnualRate;
      prestamoData.cashInterestPolicyVersion = 1;
      prestamoData.cashInterestGrantDate = grantDate;
      prestamoData.cashInterestMaturityDate = maturityDate;
      prestamoData.cashInterestAccruedThroughDate = grantDate;
      prestamoData.cashInterestPrincipalRemaining = new Prisma.Decimal(input.montoCapital);
      prestamoData.cashInterestOrdinaryCarry = new Prisma.Decimal(0);
      prestamoData.cashInterestMoratoryCarry = new Prisma.Decimal(0);
      if (input.tasaCambioAlCrear !== undefined) prestamoData.tasaCambioAlCrear = input.tasaCambioAlCrear;
      if (maturityDate) prestamoData.fechaVencimiento = maturityDate;
      if (input.observaciones) prestamoData.observaciones = input.observaciones;

      const createdLoan = await tx.prestamoCash.create({
        data: prestamoData,
        include: { cliente: { select: { clienteId: true, nombre: true } }, cuentaPorCobrar: true },
      });
      if (idempotencyKey) {
        await tx.reconciliacionVenta.update({
          where: { reconciliacionId: reconciliacion.reconciliacionId },
          data: { prestamoCashId: createdLoan.id },
        });
      }
      await AuditLogService.logStrict({
        accion: 'CREATE',
        entidad: 'PRESTAMO_CASH',
        entidadId: createdLoan.id,
        usuarioId: user.userId,
        detalles: {
          clienteId: input.clienteId,
          montoCapital: input.montoCapital,
          moneda: input.moneda || 'CUP',
        },
      }, tx);
      return { prestamo: createdLoan, replayed: false };
    });

    return prestamo;
  },

  async updateCashLoan({ input, user }: { input: { id: string; fechaVencimiento?: string; tasaInteres?: number; observaciones?: string }; user: AuthenticatedUser }) {
    if (!prestamosCashEnabled()) {
      throw new ActionError('Módulo de préstamos cash deshabilitado', 'DISABLED');
    }

    const tenantId = requireTenant(user);
    requirePermission(user, 'financiero.contabilidad.acceder', 'editar préstamos cash');
    requireFeature(user, 'prestamos-cash', 'editar préstamos cash');

    const existing = await prisma.prestamoCash.findFirst({
      where: { id: input.id, tenantId, deletedAt: null },
    });
    if (!existing) throw new ActionError('Préstamo no encontrado', 'NOT_FOUND');

    const prestamo = await prisma.prestamoCash.update({
      where: { id: input.id, tenantId },
      data: {
        ...(input.fechaVencimiento ? { fechaVencimiento: new Date(input.fechaVencimiento) } : {}),
        ...(input.tasaInteres !== undefined ? { tasaInteres: input.tasaInteres } : {}),
        ...(input.observaciones !== undefined ? { observaciones: input.observaciones } : {}),
      },
      include: { cliente: { select: { clienteId: true, nombre: true } }, cuentaPorCobrar: true },
    });

    await AuditLogService.log({
      accion: 'UPDATE',
      entidad: 'PRESTAMO_CASH',
      entidadId: input.id,
      usuarioId: user.userId,
      detalles: { cambios: { ...input } },
    });

    return prestamo;
  },

  async findCashLoanPaymentReplay({
    input,
    user,
  }: {
    input: {
      id: string;
      monto: number;
      cuentaId: string;
      tipoPagoId: string;
      moneda?: string;
      tasaCambio?: number;
      observaciones?: string;
      idempotencyKey?: string;
    };
    user: AuthenticatedUser;
  }) {
    const tenantId = requireTenant(user);
    const idempotencyKey = cashPaymentIdempotencyKey(input.idempotencyKey);
    if (!idempotencyKey) return null;
    const payloadHash = cashPaymentPayloadHash({
      operation: 'CASH_LOAN_PAYMENT',
      id: input.id,
      monto: validateCashPaymentAmount(input.monto),
      cuentaId: input.cuentaId,
      tipoPagoId: input.tipoPagoId,
      moneda: input.moneda ?? 'CUP',
      tasaCambio: input.tasaCambio,
      observaciones: input.observaciones,
    });
    return prisma.$transaction(async (tx: any) => {
      await acquireAccountingTenantLock(tx, tenantId);
      const existing = await tx.reconciliacionVenta.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
      });
      if (!existing) return null;
      if (
        existing.idempotencyPayloadHash !== payloadHash ||
        existing.prestamoCashId !== input.id ||
        existing.tipoReconciliacion !== 'PRESTAMO_CASH'
      ) {
        throw new ActionError(
          'La clave de idempotencia ya fue usada con datos diferentes',
          'IDEMPOTENCY_CONFLICT',
        );
      }
      return existing;
    });
  },

  async registerCashLoanPayment({
    input,
    user,
    clock = () => new Date(),
  }: {
    input: {
      id: string;
      monto: number;
      cuentaId: string;
      tipoPagoId: string;
      moneda?: string;
      tasaCambio?: number;
      observaciones?: string;
      idempotencyKey?: string;
    };
    user: AuthenticatedUser;
    clock?: () => Date;
  }) {
    if (!prestamosCashEnabled()) {
      throw new ActionError('Módulo de préstamos cash deshabilitado', 'DISABLED');
    }

    const tenantId = requireTenant(user);
    const paymentAmount = validateCashPaymentAmount(input.monto);
    const idempotencyKey = cashPaymentIdempotencyKey(input.idempotencyKey);
    const payloadHash = cashPaymentPayloadHash({
      operation: 'CASH_LOAN_PAYMENT',
      id: input.id,
      monto: paymentAmount,
      cuentaId: input.cuentaId,
      tipoPagoId: input.tipoPagoId,
      moneda: input.moneda ?? 'CUP',
      tasaCambio: input.tasaCambio,
      observaciones: input.observaciones,
    });

    const resultado = await prisma.$transaction(async (tx: any) => {
      await acquireAccountingTenantLock(tx, tenantId);
      if (idempotencyKey) {
        const existing = await tx.reconciliacionVenta.findUnique({
          where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
        });
        if (existing) {
          if (
            existing.idempotencyPayloadHash !== payloadHash ||
            existing.prestamoCashId !== input.id ||
            existing.tipoReconciliacion !== 'PRESTAMO_CASH'
          ) {
            throw new ActionError(
              'La clave de idempotencia ya fue usada con datos diferentes',
              'IDEMPOTENCY_CONFLICT',
            );
          }
          return { reconciliacion: existing, replayed: true };
        }
      }
      const paymentOperationDate = clock();
      const periodValidation = await validarEscrituraPeriodo({
        fecha: paymentOperationDate,
        tenantId,
        tipoOperacion: 'pago_prestamo_cash',
        actor: user.userId,
      }, tx);
      if (!periodValidation.permitido) {
        throw new ActionError(
          periodValidation.error?.message ?? 'El período contable no permite nuevas escrituras',
          periodValidation.error?.code ?? 'PERIODO_CERRADO',
        );
      }
      const prestamo = await tx.prestamoCash.findFirst({
        where: { id: input.id, tenantId, deletedAt: null },
        include: { cuentaPorCobrar: true },
      });
      if (!prestamo) throw new ActionError('Préstamo no encontrado', 'NOT_FOUND');
      if (prestamo.estado === 'PAGADO' || prestamo.estado === 'CANCELADO') {
        throw new ActionError('El préstamo no admite más pagos', 'VALIDATION_ERROR');
      }
      let interestAllocation: ReturnType<typeof calculateCashObligationPaymentAllocation>;
      try {
        interestAllocation = calculateCashObligationPaymentAllocation({
          obligation: {
            policyVersion: prestamo.cashInterestPolicyVersion,
            grantDate: prestamo.cashInterestGrantDate,
            maturityDate: prestamo.cashInterestMaturityDate,
            accruedThroughDate: prestamo.cashInterestAccruedThroughDate,
            principalRemaining: prestamo.cashInterestPrincipalRemaining,
            ordinaryAnnualRate: prestamo.ordinaryAnnualRate,
            moratoryAnnualRate: prestamo.moratoryAnnualRate,
            ordinaryCarry: prestamo.cashInterestOrdinaryCarry,
            moratoryCarry: prestamo.cashInterestMoratoryCarry,
          },
          paymentAmount,
          paymentDate: dateOnly(paymentOperationDate),
        });
      } catch (error) {
        const code = error instanceof Error && 'code' in error
          ? String((error as Error & { code: string }).code)
          : 'INVALID_ACCRUAL_INPUT';
        throw new ActionError(
          error instanceof Error ? error.message : 'No se pudo calcular el interés de la obligación',
          code,
        );
      }
      const monedaPago = (input.moneda || prestamo.moneda).trim().toUpperCase();
      const monedaObligacion = String(prestamo.moneda).trim().toUpperCase();
      const monedaFuncional = String(prestamo.cuentaPorCobrar.monedaFuncional ?? '')
        .trim().toUpperCase();
      if (monedaPago !== monedaObligacion) {
        throw new ActionError('La moneda del pago debe coincidir con la obligación', 'VALIDATION_ERROR');
      }
      if (!monedaFuncional) {
        throw new ActionError('La valuación funcional histórica no está disponible', 'FX_EVIDENCE_REQUIRED');
      }
      const tasaAplicada = monedaPago === monedaFuncional ? new Prisma.Decimal(1) :
        input.tasaCambio == null ? null : new Prisma.Decimal(input.tasaCambio);
      if (!tasaAplicada || !tasaAplicada.isFinite() || tasaAplicada.lte(0)) {
        throw new ActionError('La tasa funcional aplicada no es válida', 'FX_EVIDENCE_REQUIRED');
      }
      const montoFuncional = paymentAmount.mul(tasaAplicada)
        .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
      const cuentaBancaria = await tx.cuentaBancaria.findFirst({
        where: { cuentaId: input.cuentaId, tenantId, isActive: true },
        select: { cuentaId: true, moneda: true, tipoCuenta: true },
      });
      if (!cuentaBancaria) {
        throw new ActionError('Cuenta bancaria no encontrada o inactiva', 'VALIDATION_ERROR');
      }
      const monedaCuenta = String(cuentaBancaria.moneda).trim().toUpperCase();
      const montoCuenta = monedaCuenta === monedaPago
        ? paymentAmount
        : monedaCuenta === monedaFuncional
          ? montoFuncional
          : null;
      if (!montoCuenta) {
        throw new ActionError('No existe conversión respaldada para la moneda de la cuenta', 'FX_EVIDENCE_REQUIRED');
      }
      const totalDeuda = new Prisma.Decimal(prestamo.cuentaPorCobrar.montoDeuda);
      const interesOrdinarioRegistrado = roundedAccruedDelta(
        interestAllocation.ordinaryCarryBefore,
        interestAllocation.ordinaryAccruedThisPeriod,
      );
      const interesMoratorioRegistrado = roundedAccruedDelta(
        interestAllocation.moratoryCarryBefore,
        interestAllocation.moratoryAccruedThisPeriod,
      );
      const nuevoTotalDeuda = totalDeuda.plus(interesOrdinarioRegistrado).plus(interesMoratorioRegistrado);
      const totalFuncional = prestamo.cuentaPorCobrar.montoDeudaFuncional;
      const pagadoFuncional = prestamo.cuentaPorCobrar.montoPagadoFuncional;
      if (
        pagadoFuncional == null ||
        prestamo.cuentaPorCobrar.montoDeudaFuncional == null ||
        String(prestamo.cuentaPorCobrar.monedaOriginal ?? '').trim().toUpperCase() !== monedaObligacion
      ) {
        throw new ActionError('La valuación funcional histórica no está disponible', 'FX_EVIDENCE_REQUIRED');
      }
      const interesFuncional = interesOrdinarioRegistrado.plus(interesMoratorioRegistrado)
        .mul(tasaAplicada).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
      const nuevoTotalFuncional = new Prisma.Decimal(totalFuncional).plus(interesFuncional);
      const nuevoPagadoFuncional = new Prisma.Decimal(pagadoFuncional)
        .plus(montoFuncional).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
      if (nuevoPagadoFuncional.gt(nuevoTotalFuncional)) {
        throw new ActionError('El pago excede el saldo funcional pendiente', 'VALIDATION_ERROR');
      }
      const moratoryFunctional = interestAllocation.allocation.allocated.moratoryInterest
        .mul(tasaAplicada).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
      const ordinaryFunctional = interestAllocation.allocation.allocated.ordinaryInterest
        .mul(tasaAplicada).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
      const principalFunctional = montoFuncional.minus(moratoryFunctional).minus(ordinaryFunctional);
      if (principalFunctional.isNegative()) {
        throw new ActionError('La distribución funcional del pago no conserva el total', 'FX_EVIDENCE_REQUIRED');
      }
      const fechaReconciliacion = paymentOperationDate;
      const evidenciaFxPago = buildAppliedFxEvidence({
        originalAmount: paymentAmount.toNumber(),
        originalCurrency: monedaPago,
        functionalCurrency: monedaFuncional,
        exchangeRate: tasaAplicada.toNumber(),
        convertedAmount: montoFuncional.toNumber(),
        rateEffectiveAt: fechaReconciliacion,
        source: 'cash-loan-payment',
      });
      const pagoData: Record<string, unknown> = {
        tenant: { connect: { tenantId } },
        cuentaBancaria: { connect: { cuentaId: input.cuentaId } },
        tipoPago: { connect: { tipoId: input.tipoPagoId } },
        prestamoCash: { connect: { id: prestamo.id } },
        monto: paymentAmount,
        montoCuenta,
        monedaCuenta,
        moneda: monedaPago,
        montoConvertido: montoFuncional,
        functionalCurrency: monedaFuncional,
        tasaCambio: tasaAplicada,
        rateEffectiveAt: fechaReconciliacion,
        fxProvenanceKind: evidenciaFxPago.fxProvenanceKind,
        fxProvenanceSource: evidenciaFxPago.fxProvenanceSource,
        fxEvidenceJson: {
          ...evidenciaFxPago,
          originalAmount: paymentAmount.toFixed(4),
          originalCurrency: monedaPago,
          functionalAmount: montoFuncional.toFixed(4),
          functionalCurrency: monedaFuncional,
          exchangeRate: tasaAplicada.toFixed(10),
          rateEffectiveAt: fechaReconciliacion.toISOString(),
        },
        fxEvidenceFingerprint: evidenciaFxPago.fxEvidenceFingerprint,
        fxEvidenceVersion: evidenciaFxPago.fxEvidenceVersion,
        ...(idempotencyKey ? { idempotencyKey, idempotencyPayloadHash: payloadHash } : {}),
        fechaReconciliacion,
        reconciliadoPor: user.userId,
        tipoReconciliacion: 'PRESTAMO_CASH',
      };
      if (input.observaciones != null) pagoData.observaciones = input.observaciones;

      const reconciliacion = await tx.reconciliacionVenta.create({ data: pagoData });
      await tx.cuentaBancaria.update({
        where: { cuentaId: input.cuentaId },
        data: { saldo: { increment: montoCuenta.toNumber() } },
      });
      const nuevoMontoPagado = new Prisma.Decimal(prestamo.cuentaPorCobrar.montoPagado)
        .plus(paymentAmount).toDecimalPlaces(4).toNumber();
      const nuevoSaldo = nuevoTotalDeuda.minus(nuevoMontoPagado).toDecimalPlaces(4).toNumber();
      const nuevoEstadoCuenta = nuevoSaldo === 0 ? 'PAGADA' : 'PARCIAL';
      await tx.cuentaPorCobrar.update({
        where: { id: prestamo.cuentaPorCobrarId },
        data: {
          montoDeuda: nuevoTotalDeuda,
          montoDeudaFuncional: nuevoTotalFuncional,
          montoPagado: nuevoMontoPagado,
          montoPagadoFuncional: nuevoPagadoFuncional,
          estado: nuevoEstadoCuenta,
        },
      });
      if (nuevoEstadoCuenta === 'PAGADA') {
        await tx.prestamoCash.update({
          where: { id: prestamo.id },
          data: {
            estado: 'PAGADO',
            cashInterestPrincipalRemaining: interestAllocation.principalAfter,
            cashInterestOrdinaryCarry: interestAllocation.ordinaryCarryAfter,
            cashInterestMoratoryCarry: interestAllocation.moratoryCarryAfter,
            cashInterestAccruedThroughDate: interestAllocation.accruedThroughDate,
          },
        });
      } else {
        await tx.prestamoCash.update({
          where: { id: prestamo.id },
          data: {
            cashInterestPrincipalRemaining: interestAllocation.principalAfter,
            cashInterestOrdinaryCarry: interestAllocation.ordinaryCarryAfter,
            cashInterestMoratoryCarry: interestAllocation.moratoryCarryAfter,
            cashInterestAccruedThroughDate: interestAllocation.accruedThroughDate,
          },
        });
      }
      await AuditLogService.logStrict({
        accion: 'CREATE',
        entidad: 'PAGO_PRESTAMO',
        entidadId: reconciliacion.reconciliacionId,
        usuarioId: user.userId,
        detalles: {
          prestamoId: prestamo.id,
          monto: paymentAmount.toFixed(4),
          moneda: monedaPago,
          montoFuncional: montoFuncional.toFixed(4),
          monedaFuncional,
          interesOrdinario: interestAllocation.allocation.allocated.ordinaryInterest.toFixed(4),
          interesMoratorio: interestAllocation.allocation.allocated.moratoryInterest.toFixed(4),
          principal: interestAllocation.allocation.allocated.principal.toFixed(4),
        },
      }, tx);
      const postingResult = await postEvento(tx, { tenantId, userId: user.userId }, buildCashPaymentEvent({
        obligation: 'loan',
        reconciliationId: reconciliacion.reconciliacionId,
        amount: reconciliacion.monto,
        currency: reconciliacion.moneda,
        functionalAmount: reconciliacion.montoConvertido ?? montoFuncional,
        functionalCurrency: reconciliacion.functionalCurrency ?? monedaFuncional,
        exchangeRate: reconciliacion.tasaCambio,
        fxEvidenceFingerprint: reconciliacion.fxEvidenceFingerprint,
        interest: interestAllocation.allocation.allocated.ordinaryInterest,
        moratoryInterest: interestAllocation.allocation.allocated.moratoryInterest,
        treasuryAccountType: cuentaBancaria.tipoCuenta,
        fecha: reconciliacion.fechaReconciliacion,
        reference: idempotencyKey ?? reconciliacion.reconciliacionId,
      }));
      await tx.cashPaymentInterestAllocation.create({
        data: buildCashInterestAllocationRecord({
          tenantId,
          obligationType: 'loan',
          reconciliationId: reconciliacion.reconciliacionId,
          asientoId: ('asientoId' in postingResult ? postingResult.asientoId : null) ?? null,
          interestAllocation,
          paymentAmount,
          functionalAmount: montoFuncional,
          moratoryFunctional,
          ordinaryFunctional,
          principalFunctional,
          functionalCurrency: monedaFuncional,
          fxEvidenceFingerprint: evidenciaFxPago.fxEvidenceFingerprint,
        }),
      });
      return { reconciliacion, replayed: false };
    });

    return resultado.reconciliacion;
  },

  async findCashDebtCreateReplay({
    input,
    user,
  }: {
    input: {
      proveedorId: string;
      montoCapital: number;
      moneda?: string;
      tasaInteres?: number;
      tasaInteresMoratorio?: number;
      tasaCambio?: number;
      fechaVencimiento?: string;
      observaciones?: string;
      comprobanteUrl?: string;
      comprobanteAsset?: Record<string, unknown> | null;
      cuentaBancariaId: string;
      idempotencyKey?: string;
    };
    user: AuthenticatedUser;
  }) {
    if (!deudasCashEnabled()) {
      throw new ActionError('Módulo de deudas cash deshabilitado', 'DISABLED');
    }
    const tenantId = requireTenant(user);
    const idempotencyKey = normalizeCashCreateIdempotencyKey(input.idempotencyKey);
    if (!idempotencyKey) return null;
    const payloadHash = cashCreatePayloadHash({
      operation: 'CREATE_DEUDA_CASH',
      proveedorId: input.proveedorId,
      montoCapital: input.montoCapital,
      moneda: input.moneda ?? 'CUP',
      tasaInteres: input.tasaInteres ?? null,
      tasaInteresMoratorio: input.tasaInteresMoratorio,
      tasaCambio: input.tasaCambio ?? null,
      fechaVencimiento: input.fechaVencimiento ?? null,
      observaciones: input.observaciones ?? null,
      comprobanteUrl: input.comprobanteUrl ?? null,
      comprobanteAsset: input.comprobanteAsset ?? null,
      cuentaBancariaId: input.cuentaBancariaId,
    });

    return prisma.$transaction(async (tx: any) => {
      await acquireAccountingTenantLock(tx, tenantId);
      const existing = await tx.reconciliacionVenta.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
      });
      if (!existing) return null;
      if (
        existing.idempotencyPayloadHash !== payloadHash ||
        typeof existing.deudaCashId !== 'string' || !existing.deudaCashId
      ) {
        throw new ActionError(
          'La clave de idempotencia ya fue usada con datos diferentes',
          'IDEMPOTENCY_CONFLICT',
        );
      }
      const replay = await tx.deudaCash.findFirst({
        where: { id: existing.deudaCashId, tenantId, deletedAt: null },
        include: { proveedor: { select: { vendorId: true, nombre: true } }, cuentaPorPagar: true },
      });
      if (!replay) {
        throw new ActionError('La operación idempotente no está disponible', 'IDEMPOTENCY_CONFLICT');
      }
      return replay;
    });
  },

  async createCashDebt({
    input,
    user,
    operationDate,
  }: {
    input: {
      proveedorId: string;
      montoCapital: number;
      moneda?: string;
      tasaInteres?: number;
      tasaInteresMoratorio?: number;
      tasaCambio?: number;
      fechaVencimiento?: string;
      observaciones?: string;
      comprobanteUrl?: string;
      comprobanteAsset?: Record<string, unknown> | null;
      cuentaBancariaId: string;
      idempotencyKey?: string;
    };
    user: AuthenticatedUser;
    operationDate?: Date;
  }) {
    if (!deudasCashEnabled()) {
      throw new ActionError('Módulo de deudas cash deshabilitado', 'DISABLED');
    }

    const ordinaryAnnualRate = requireAnnualRate(input.tasaInteres, 'ordinaria');
    const moratoryAnnualRate = requireAnnualRate(input.tasaInteresMoratorio, 'moratoria');
    const grantDate = dateOnly(operationDate ?? new Date());
    const maturityDate = input.fechaVencimiento ? dateOnlyInput(input.fechaVencimiento) : null;

    const tenantId = requireTenant(user);
    const idempotencyKey = normalizeCashCreateIdempotencyKey(input.idempotencyKey);
    const idempotencyPayloadHash = idempotencyKey
      ? cashCreatePayloadHash({
          operation: 'CREATE_DEUDA_CASH',
          proveedorId: input.proveedorId,
          montoCapital: input.montoCapital,
          moneda: input.moneda ?? 'CUP',
          tasaInteres: input.tasaInteres ?? null,
          tasaInteresMoratorio: input.tasaInteresMoratorio,
          tasaCambio: input.tasaCambio ?? null,
          fechaVencimiento: input.fechaVencimiento ?? null,
          observaciones: input.observaciones ?? null,
          comprobanteUrl: input.comprobanteUrl ?? null,
          comprobanteAsset: input.comprobanteAsset ?? null,
          cuentaBancariaId: input.cuentaBancariaId,
        })
      : null;
    const fechaReconciliacion = operationDate ?? new Date();
    const totalDeuda = input.montoCapital;

    const { deuda } = await prisma.$transaction(async (tx: any) => {
      await acquireAccountingTenantLock(tx, tenantId);

      if (idempotencyKey) {
        const existing = await tx.reconciliacionVenta.findUnique({
          where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
        });
        if (existing) {
          if (
            existing.idempotencyPayloadHash !== idempotencyPayloadHash ||
            typeof existing.deudaCashId !== 'string' || !existing.deudaCashId
          ) {
            throw new ActionError(
              'La clave de idempotencia ya fue usada con datos diferentes',
              'IDEMPOTENCY_CONFLICT',
            );
          }
          const existingDebt = await tx.deudaCash.findFirst({
            where: { id: existing.deudaCashId, tenantId, deletedAt: null },
            include: { proveedor: { select: { vendorId: true, nombre: true } }, cuentaPorPagar: true },
          });
          if (!existingDebt) {
            throw new ActionError(
              'La operación idempotente no está disponible',
              'IDEMPOTENCY_CONFLICT',
            );
          }
          return { deuda: existingDebt, replayed: true };
        }
      }

      requireFeature(user, 'deudas-cash', 'crear deudas cash');

      const proveedor = await tx.vendor.findFirst({
        where: { vendorId: input.proveedorId, tenantId },
        select: { vendorId: true, nombre: true },
      });
      if (!proveedor) throw new ActionError('Proveedor no encontrado', 'NOT_FOUND');

      const cuentaOrigen = await tx.cuentaBancaria.findFirst({
        where: { cuentaId: input.cuentaBancariaId, tenantId },
        select: { cuentaId: true, isActive: true, moneda: true },
      });
      if (!cuentaOrigen || !cuentaOrigen.isActive) {
        throw new ActionError('Cuenta bancaria no encontrada o inactiva', 'VALIDATION_ERROR');
      }

      const tp =
        (await tx.tipoPago.findFirst({ where: { nombre: 'Transferencia', isActive: true, tenantId } })) ||
        (await tx.tipoPago.findFirst({ where: { nombre: 'Efectivo', isActive: true, tenantId } }));
      if (!tp) {
        throw new ActionError('No existe un tipo de pago válido para el desembolso de deuda', 'VALIDATION_ERROR');
      }

      const lastDeuda = await tx.deudaCash.findFirst({ orderBy: { idNumerico: 'desc' }, select: { idNumerico: true } });
      const nextNum = (lastDeuda?.idNumerico ?? 0) + 1;
      const monedaObligacion = (input.moneda || 'CUP').trim().toUpperCase();
      const obligationFx = await buildObligationFxSnapshot(
        tx,
        tenantId,
        new Prisma.Decimal(totalDeuda),
        monedaObligacion,
        input.tasaCambio,
        fechaReconciliacion,
        'cash-debt-obligation',
      );
      const amount = resolveCashDebtCurrencyAmounts({
        monedaObligacion,
        monedaFondos: monedaObligacion,
        monedaCuenta: cuentaOrigen.moneda,
        montoFondos: input.montoCapital,
        montoFuncional: obligationFx.amount.toNumber(),
        functionalCurrency: obligationFx.functionalCurrency,
      });
      const accountUpdate = await tx.cuentaBancaria.updateMany({
        where: {
          cuentaId: input.cuentaBancariaId,
          tenantId,
          isActive: true,
          moneda: cuentaOrigen.moneda,
        },
        data: { saldo: { increment: amount.montoCuenta.toNumber() } },
      });
      if (accountUpdate.count !== 1) {
        throw new ActionError('Cuenta bancaria no encontrada o inactiva', 'VALIDATION_ERROR');
      }

      const cxp = await tx.cuentaPorPagar.create({
        data: {
          tenantId,
          numeroFactura: `DC-${nextNum}`,
          proveedorId: input.proveedorId,
          proveedorNombre: proveedor.nombre,
          montoDeuda: totalDeuda,
          montoPagado: 0,
          ...obligationFx.fields,
          saldoPendiente: totalDeuda,
          moneda: input.moneda || 'CUP',
          tipo: 'compra',
          tipoDeuda: 'DEUDA_CASH',
          estado: 'PENDIENTE',
          fechaVencimiento: maturityDate ?? undefined,
        },
      });

      const deuda = await tx.deudaCash.create({
        data: {
          tenantId,
          proveedorId: input.proveedorId,
          cuentaPorPagarId: cxp.cuentaPorPagarId,
          montoCapital: input.montoCapital,
          moneda: input.moneda || 'CUP',
          tasaInteres: input.tasaInteres,
          ordinaryAnnualRate,
          moratoryAnnualRate,
          cashInterestPolicyVersion: 1,
          cashInterestGrantDate: grantDate,
          cashInterestMaturityDate: maturityDate,
          cashInterestAccruedThroughDate: grantDate,
          cashInterestPrincipalRemaining: new Prisma.Decimal(input.montoCapital),
          cashInterestOrdinaryCarry: new Prisma.Decimal(0),
          cashInterestMoratoryCarry: new Prisma.Decimal(0),
          fechaVencimiento: maturityDate ?? undefined,
          observaciones: input.observaciones,
          comprobanteUrl: input.comprobanteUrl,
          cuentaBancariaId: input.cuentaBancariaId,
          createdById: user.userId,
        },
        include: { proveedor: { select: { vendorId: true, nombre: true } }, cuentaPorPagar: true },
      });

      const reconciliacion = await tx.reconciliacionVenta.create({
        data: {
          tenant: { connect: { tenantId } },
          cuentaBancaria: { connect: { cuentaId: input.cuentaBancariaId } },
          tipoPago: { connect: { tipoId: tp.tipoId } },
          deudaCash: { connect: { id: deuda.id } },
          monto: input.montoCapital,
          moneda: input.moneda || 'CUP',
          montoConvertido: obligationFx.amount,
          functionalCurrency: obligationFx.functionalCurrency,
          tasaCambio: obligationFx.fields.tasaCambio,
          rateEffectiveAt: obligationFx.fields.rateEffectiveAt,
          fxProvenanceKind: obligationFx.fields.fxProvenanceKind,
          fxProvenanceSource: obligationFx.fields.fxProvenanceSource,
          fxCatalogRateId: obligationFx.fields.fxCatalogRateId,
          fxEvidenceJson: obligationFx.fields.fxEvidenceJson,
          fxEvidenceFingerprint: obligationFx.fields.fxEvidenceFingerprint,
          fxEvidenceVersion: obligationFx.fields.fxEvidenceVersion,
          montoCuenta: amount.montoCuenta,
          monedaCuenta: cuentaOrigen.moneda.trim().toUpperCase(),
          fechaReconciliacion,
          observaciones:
            input.observaciones || `Desembolso de deuda cash para proveedor ${input.proveedorId}`,
          reconciliadoPor: user.userId,
          tipoReconciliacion: 'DEUDA_CASH_DESEMBOLSO',
          ...(idempotencyKey ? { idempotencyKey, idempotencyPayloadHash } : {}),
        },
      });

      await postEvento(tx, { tenantId, userId: user.userId }, {
        tipo: 'DEUDA_RECIBIDA',
        fecha: fechaReconciliacion,
        descripcion: input.observaciones || `Deuda recibida de proveedor ${input.proveedorId}`,
        origen: { tipo: 'deuda_cash', id: deuda.id },
        monto: input.montoCapital,
        moneda: monedaObligacion,
        montoFuncional: obligationFx.amount,
        monedaFuncional: obligationFx.functionalCurrency,
        tasaCambio: obligationFx.fields.tasaCambio,
        fxEvidenceFingerprint: obligationFx.fields.fxEvidenceFingerprint,
        medioCobro: 'BANCOS',
      });

      await AuditLogService.logStrict({
        accion: 'CREATE',
        entidad: 'DEUDA_CASH',
        entidadId: deuda.id,
        usuarioId: user.userId,
        detalles: {
          proveedorId: input.proveedorId,
          montoCapital: input.montoCapital,
          moneda: input.moneda || 'CUP',
        },
      }, tx);

      return { deuda, replayed: false };
    });

    return deuda;
  },

  async updateCashDebt({ input, user }: { input: { id: string; fechaVencimiento?: string; tasaInteres?: number; observaciones?: string }; user: AuthenticatedUser }) {
    if (!deudasCashEnabled()) {
      throw new ActionError('Módulo de deudas cash deshabilitado', 'DISABLED');
    }

    const tenantId = requireTenant(user);

    const existing = await prisma.deudaCash.findFirst({
      where: { id: input.id, tenantId, deletedAt: null },
    });
    if (!existing) throw new ActionError('Deuda no encontrada', 'NOT_FOUND');

    const deuda = await prisma.deudaCash.update({
      where: { id: input.id, tenantId },
      data: {
        ...(input.fechaVencimiento ? { fechaVencimiento: new Date(input.fechaVencimiento) } : {}),
        ...(input.tasaInteres !== undefined ? { tasaInteres: input.tasaInteres } : {}),
        ...(input.observaciones !== undefined ? { observaciones: input.observaciones } : {}),
      },
      include: { proveedor: { select: { vendorId: true, nombre: true } }, cuentaPorPagar: true },
    });

    await AuditLogService.log({
      accion: 'UPDATE',
      entidad: 'DEUDA_CASH',
      entidadId: input.id,
      usuarioId: user.userId,
      detalles: { cambios: { ...input } },
    });

    return deuda;
  },

  async findCashDebtPaymentReplay({
    input,
    user,
  }: {
    input: {
      id: string;
      monto: number;
      cuentaId: string;
      tipoPagoId: string;
      moneda?: string;
      tasaCambio?: number;
      observaciones?: string;
      idempotencyKey?: string;
    };
    user: AuthenticatedUser;
  }) {
    const tenantId = requireTenant(user);
    const idempotencyKey = cashPaymentIdempotencyKey(input.idempotencyKey);
    if (!idempotencyKey) return null;
    const payloadHash = cashPaymentPayloadHash({
      operation: 'CASH_DEBT_PAYMENT',
      id: input.id,
      monto: validateCashPaymentAmount(input.monto),
      cuentaId: input.cuentaId,
      tipoPagoId: input.tipoPagoId,
      moneda: input.moneda ?? 'CUP',
      tasaCambio: input.tasaCambio,
      observaciones: input.observaciones,
    });
    return prisma.$transaction(async (tx: any) => {
      await acquireAccountingTenantLock(tx, tenantId);
      const existing = await tx.reconciliacionVenta.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
      });
      if (!existing) return null;
      if (
        existing.idempotencyPayloadHash !== payloadHash ||
        existing.deudaCashId !== input.id ||
        existing.tipoReconciliacion !== 'DEUDA_CASH'
      ) {
        throw new ActionError(
          'La clave de idempotencia ya fue usada con datos diferentes',
          'IDEMPOTENCY_CONFLICT',
        );
      }
      return existing;
    });
  },

  async registerCashDebtPayment({
    input,
    user,
    clock = () => new Date(),
  }: {
    input: {
      id: string;
      monto: number;
      cuentaId: string;
      tipoPagoId: string;
      moneda?: string;
      tasaCambio?: number;
      observaciones?: string;
      idempotencyKey?: string;
    };
    user: AuthenticatedUser;
    clock?: () => Date;
  }) {
    if (!deudasCashEnabled()) {
      throw new ActionError('Módulo de deudas cash deshabilitado', 'DISABLED');
    }

    const tenantId = requireTenant(user);
    const paymentAmount = validateCashPaymentAmount(input.monto);
    const idempotencyKey = cashPaymentIdempotencyKey(input.idempotencyKey);
    const payloadHash = cashPaymentPayloadHash({
      operation: 'CASH_DEBT_PAYMENT',
      id: input.id,
      monto: paymentAmount,
      cuentaId: input.cuentaId,
      tipoPagoId: input.tipoPagoId,
      moneda: input.moneda ?? 'CUP',
      tasaCambio: input.tasaCambio,
      observaciones: input.observaciones,
    });

    const resultado = await prisma.$transaction(async (tx: any) => {
      await acquireAccountingTenantLock(tx, tenantId);
      if (idempotencyKey) {
        const existing = await tx.reconciliacionVenta.findUnique({
          where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
        });
        if (existing) {
          if (
            existing.idempotencyPayloadHash !== payloadHash ||
            existing.deudaCashId !== input.id ||
            existing.tipoReconciliacion !== 'DEUDA_CASH'
          ) {
            throw new ActionError(
              'La clave de idempotencia ya fue usada con datos diferentes',
              'IDEMPOTENCY_CONFLICT',
            );
          }
          return { reconciliacion: existing, replayed: true };
        }
      }
      const paymentOperationDate = clock();
      const periodValidation = await validarEscrituraPeriodo({
        fecha: paymentOperationDate,
        tenantId,
        tipoOperacion: 'pago_deuda_cash',
        actor: user.userId,
      }, tx);
      if (!periodValidation.permitido) {
        throw new ActionError(
          periodValidation.error?.message ?? 'El período contable no permite nuevas escrituras',
          periodValidation.error?.code ?? 'PERIODO_CERRADO',
        );
      }
      const deuda = await tx.deudaCash.findFirst({
        where: { id: input.id, tenantId, deletedAt: null },
        include: { cuentaPorPagar: true },
      });
      if (!deuda) throw new ActionError('Deuda no encontrada', 'NOT_FOUND');
      if (deuda.estado === 'PAGADO' || deuda.estado === 'CANCELADO') {
        throw new ActionError('La deuda no admite más pagos', 'VALIDATION_ERROR');
      }
      let interestAllocation: ReturnType<typeof calculateCashObligationPaymentAllocation>;
      try {
        interestAllocation = calculateCashObligationPaymentAllocation({
          obligation: {
            policyVersion: deuda.cashInterestPolicyVersion,
            grantDate: deuda.cashInterestGrantDate,
            maturityDate: deuda.cashInterestMaturityDate,
            accruedThroughDate: deuda.cashInterestAccruedThroughDate,
            principalRemaining: deuda.cashInterestPrincipalRemaining,
            ordinaryAnnualRate: deuda.ordinaryAnnualRate,
            moratoryAnnualRate: deuda.moratoryAnnualRate,
            ordinaryCarry: deuda.cashInterestOrdinaryCarry,
            moratoryCarry: deuda.cashInterestMoratoryCarry,
          },
          paymentAmount,
          paymentDate: dateOnly(paymentOperationDate),
        });
      } catch (error) {
        const code = error instanceof Error && 'code' in error
          ? String((error as Error & { code: string }).code)
          : 'INVALID_ACCRUAL_INPUT';
        throw new ActionError(
          error instanceof Error ? error.message : 'No se pudo calcular el interés de la obligación',
          code,
        );
      }
      const monedaPago = (input.moneda || deuda.moneda).trim().toUpperCase();
      const monedaObligacion = String(deuda.moneda).trim().toUpperCase();
      const monedaFuncional = String(deuda.cuentaPorPagar.monedaFuncional ?? '')
        .trim().toUpperCase();
      if (monedaPago !== monedaObligacion) {
        throw new ActionError('La moneda del pago debe coincidir con la obligación', 'VALIDATION_ERROR');
      }
      if (!monedaFuncional) {
        throw new ActionError('La valuación funcional histórica no está disponible', 'FX_EVIDENCE_REQUIRED');
      }
      const tasaAplicada = monedaPago === monedaFuncional ? new Prisma.Decimal(1) :
        input.tasaCambio == null ? null : new Prisma.Decimal(input.tasaCambio);
      if (!tasaAplicada || !tasaAplicada.isFinite() || tasaAplicada.lte(0)) {
        throw new ActionError('La tasa funcional aplicada no es válida', 'FX_EVIDENCE_REQUIRED');
      }
      const montoFuncional = paymentAmount.mul(tasaAplicada)
        .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
      const cuentaBancaria = await tx.cuentaBancaria.findFirst({
        where: { cuentaId: input.cuentaId, tenantId, isActive: true },
        select: { cuentaId: true, moneda: true, tipoCuenta: true },
      });
      if (!cuentaBancaria) {
        throw new ActionError('Cuenta bancaria no encontrada o inactiva', 'VALIDATION_ERROR');
      }
      const monedaCuenta = String(cuentaBancaria.moneda).trim().toUpperCase();
      const montoCuenta = monedaCuenta === monedaPago
        ? paymentAmount
        : monedaCuenta === monedaFuncional
          ? montoFuncional
          : null;
      if (!montoCuenta) {
        throw new ActionError('No existe conversión respaldada para la moneda de la cuenta', 'FX_EVIDENCE_REQUIRED');
      }
      const totalDeuda = new Prisma.Decimal(deuda.cuentaPorPagar.montoDeuda);
      const interesOrdinarioRegistrado = roundedAccruedDelta(
        interestAllocation.ordinaryCarryBefore,
        interestAllocation.ordinaryAccruedThisPeriod,
      );
      const interesMoratorioRegistrado = roundedAccruedDelta(
        interestAllocation.moratoryCarryBefore,
        interestAllocation.moratoryAccruedThisPeriod,
      );
      const nuevoTotalDeuda = totalDeuda.plus(interesOrdinarioRegistrado).plus(interesMoratorioRegistrado);
      const totalFuncional = deuda.cuentaPorPagar.montoDeudaFuncional;
      const pagadoFuncional = deuda.cuentaPorPagar.montoPagadoFuncional;
      if (
        pagadoFuncional == null ||
        deuda.cuentaPorPagar.montoDeudaFuncional == null ||
        String(deuda.cuentaPorPagar.monedaOriginal ?? '').trim().toUpperCase() !== monedaObligacion
      ) {
        throw new ActionError('La valuación funcional histórica no está disponible', 'FX_EVIDENCE_REQUIRED');
      }
      const interesFuncional = interesOrdinarioRegistrado.plus(interesMoratorioRegistrado)
        .mul(tasaAplicada).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
      const nuevoTotalFuncional = new Prisma.Decimal(totalFuncional).plus(interesFuncional);
      const nuevoPagadoFuncional = new Prisma.Decimal(pagadoFuncional)
        .plus(montoFuncional).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
      if (nuevoPagadoFuncional.gt(nuevoTotalFuncional)) {
        throw new ActionError('El pago excede el saldo funcional pendiente', 'VALIDATION_ERROR');
      }
      const moratoryFunctional = interestAllocation.allocation.allocated.moratoryInterest
        .mul(tasaAplicada).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
      const ordinaryFunctional = interestAllocation.allocation.allocated.ordinaryInterest
        .mul(tasaAplicada).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
      const principalFunctional = montoFuncional.minus(moratoryFunctional).minus(ordinaryFunctional);
      if (principalFunctional.isNegative()) {
        throw new ActionError('La distribución funcional del pago no conserva el total', 'FX_EVIDENCE_REQUIRED');
      }
      const fechaReconciliacion = paymentOperationDate;
      const evidenciaFxPago = buildAppliedFxEvidence({
        originalAmount: paymentAmount.toNumber(),
        originalCurrency: monedaPago,
        functionalCurrency: monedaFuncional,
        exchangeRate: tasaAplicada.toNumber(),
        convertedAmount: montoFuncional.toNumber(),
        rateEffectiveAt: fechaReconciliacion,
        source: 'cash-debt-payment',
      });
      const reconciliacion = await tx.reconciliacionVenta.create({
        data: {
          tenant: { connect: { tenantId } },
          cuentaBancaria: { connect: { cuentaId: input.cuentaId } },
          tipoPago: { connect: { tipoId: input.tipoPagoId } },
          monto: paymentAmount,
          montoCuenta,
          monedaCuenta,
          moneda: monedaPago,
          montoConvertido: montoFuncional,
          functionalCurrency: monedaFuncional,
          tasaCambio: tasaAplicada,
          rateEffectiveAt: fechaReconciliacion,
          fxProvenanceKind: evidenciaFxPago.fxProvenanceKind,
          fxProvenanceSource: evidenciaFxPago.fxProvenanceSource,
          fxEvidenceJson: {
            ...evidenciaFxPago,
            originalAmount: paymentAmount.toFixed(4),
            originalCurrency: monedaPago,
            functionalAmount: montoFuncional.toFixed(4),
            functionalCurrency: monedaFuncional,
            exchangeRate: tasaAplicada.toFixed(10),
            rateEffectiveAt: fechaReconciliacion.toISOString(),
          },
          fxEvidenceFingerprint: evidenciaFxPago.fxEvidenceFingerprint,
          fxEvidenceVersion: evidenciaFxPago.fxEvidenceVersion,
          ...(idempotencyKey ? { idempotencyKey, idempotencyPayloadHash: payloadHash } : {}),
          ...(input.observaciones != null && { observaciones: input.observaciones }),
          fechaReconciliacion,
          reconciliadoPor: user.userId,
          deudaCash: { connect: { id: deuda.id } },
          tipoReconciliacion: 'DEUDA_CASH',
        },
      });
      await tx.cuentaBancaria.update({
        where: { cuentaId: input.cuentaId },
        data: { saldo: { decrement: montoCuenta.toNumber() } },
      });
      const nuevoMontoPagado = new Prisma.Decimal(deuda.cuentaPorPagar.montoPagado)
        .plus(paymentAmount).toDecimalPlaces(4).toNumber();
      const nuevoSaldoPendiente = nuevoTotalDeuda.minus(nuevoMontoPagado).toDecimalPlaces(4).toNumber();
      const nuevoEstadoCuenta = nuevoSaldoPendiente === 0 ? 'PAGADA' : 'PARCIAL';
      await tx.cuentaPorPagar.update({
        where: { cuentaPorPagarId: deuda.cuentaPorPagarId },
        data: {
          montoDeuda: nuevoTotalDeuda,
          montoDeudaFuncional: nuevoTotalFuncional,
          montoPagado: nuevoMontoPagado,
          montoPagadoFuncional: nuevoPagadoFuncional,
          saldoPendiente: nuevoSaldoPendiente,
          estado: nuevoEstadoCuenta,
        },
      });
      await tx.deudaCash.update({
        where: { id: deuda.id },
        data: {
          ...(nuevoEstadoCuenta === 'PAGADA' ? { estado: 'PAGADO' } : {}),
          cashInterestPrincipalRemaining: interestAllocation.principalAfter,
          cashInterestOrdinaryCarry: interestAllocation.ordinaryCarryAfter,
          cashInterestMoratoryCarry: interestAllocation.moratoryCarryAfter,
          cashInterestAccruedThroughDate: interestAllocation.accruedThroughDate,
        },
      });
      await AuditLogService.logStrict({
        accion: 'CREATE',
        entidad: 'PAGO_DEUDA',
        entidadId: reconciliacion.reconciliacionId,
        usuarioId: user.userId,
        detalles: {
          deudaId: deuda.id,
          monto: paymentAmount.toFixed(4),
          moneda: monedaPago,
          montoFuncional: montoFuncional.toFixed(4),
          monedaFuncional,
          interesOrdinario: interestAllocation.allocation.allocated.ordinaryInterest.toFixed(4),
          interesMoratorio: interestAllocation.allocation.allocated.moratoryInterest.toFixed(4),
          principal: interestAllocation.allocation.allocated.principal.toFixed(4),
        },
      }, tx);
      const postingResult = await postEvento(tx, { tenantId, userId: user.userId }, buildCashPaymentEvent({
        obligation: 'debt',
        reconciliationId: reconciliacion.reconciliacionId,
        amount: reconciliacion.monto,
        currency: reconciliacion.moneda,
        functionalAmount: reconciliacion.montoConvertido ?? montoFuncional,
        functionalCurrency: reconciliacion.functionalCurrency ?? monedaFuncional,
        exchangeRate: reconciliacion.tasaCambio,
        fxEvidenceFingerprint: reconciliacion.fxEvidenceFingerprint,
        interest: interestAllocation.allocation.allocated.ordinaryInterest,
        moratoryInterest: interestAllocation.allocation.allocated.moratoryInterest,
        treasuryAccountType: cuentaBancaria.tipoCuenta,
        fecha: reconciliacion.fechaReconciliacion,
        reference: idempotencyKey ?? reconciliacion.reconciliacionId,
      }));
      await tx.cashPaymentInterestAllocation.create({
        data: buildCashInterestAllocationRecord({
          tenantId,
          obligationType: 'debt',
          reconciliationId: reconciliacion.reconciliacionId,
          asientoId: ('asientoId' in postingResult ? postingResult.asientoId : null) ?? null,
          interestAllocation,
          paymentAmount,
          functionalAmount: montoFuncional,
          moratoryFunctional,
          ordinaryFunctional,
          principalFunctional,
          functionalCurrency: monedaFuncional,
          fxEvidenceFingerprint: evidenciaFxPago.fxEvidenceFingerprint,
        }),
      });
      return { reconciliacion, replayed: false };
    });

    return resultado.reconciliacion;
  },
};
