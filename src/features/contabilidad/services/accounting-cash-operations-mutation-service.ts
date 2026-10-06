import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma';

function sha256Hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}
import { buildPersistedAccountingAmount } from '@/features/contabilidad/services/accounting-reconciliation-service';
import { ActionError } from '@/lib/server-actions';
import { AuditLogService } from '@/lib/services/audit-log-service';
import {
  auditarCreditoOverride,
  bloquearClienteCredito,
  validarCreditoOrigen,
} from '@/features/ventas/services/credito-override';
import { calcularMontoTotalACobrar, calcularSaldoPendientePrestamo } from '@/lib/utils/prestamo-cash';
import {
  calcularSaldoPendienteDeuda,
  calcularTotalDeudaConInteres,
} from '@/lib/utils/deuda-cash';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { requireFeature, requirePermission, requireTenant } from '@/lib/services/tenant-scope';
import { acquireAccountingTenantLock } from './accounting-tenant-lock-service';
import { resolveCashDebtCurrencyAmounts } from './cash-debt-payment-valuation';
import { getRequiredTenantAccountingPolicy } from './tenant-accounting-policy-service';
import { postEvento } from '@/features/contabilidad-formal/services/posting-engine';
import {
  buildEventoDeudaRecibida,
  buildEventoPagoDeuda,
  buildEventoPrestamoOtorgado,
  buildEventoCobroPrestamo,
} from '@/features/contabilidad-formal/lib/event-builders';

function prestamosCashEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_PRESTAMOS_CASH !== 'false';
}

function deudasCashEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_DEUDAS_CASH !== 'false';
}

/** @description Aplica los gates de plan y permiso a las mutaciones de préstamos. */
function requireCashLoanMutationAccess(user: AuthenticatedUser, action: string): void {
  requireFeature(user, 'prestamos-cash', action);
  requirePermission(user, 'financiero.contabilidad.acceder', action);
}

/** @description Aplica los gates de plan y permiso a las mutaciones de deudas. */
function requireDeudaMutationAccess(user: AuthenticatedUser, action: string): void {
  requireFeature(user, 'deudas-cash', action);
  requirePermission(user, 'financiero.contabilidad.acceder', action);
}

/**
 * @description Servicio compartido de mutaciones para préstamos/deudas cash reutilizable por web y mobile.
 */
export const AccountingCashOperationsMutationService = {
  async createCashLoan({
    input,
    user,
  }: {
    input: {
      clienteId: string;
      montoCapital: number;
      moneda?: string;
      tasaInteres?: number;
      tasaCambioAlCrear?: number;
      fechaVencimiento?: string;
      observaciones?: string;
      cuentaBancariaId: string;
      solicitarCreditoOverride?: boolean;
      motivoCreditoOverride?: string | null;
    };
    user: AuthenticatedUser;
  }) {
    if (!prestamosCashEnabled()) {
      throw new ActionError('Módulo de préstamos cash deshabilitado', 'DISABLED');
    }

    const tenantId = requireTenant(user);
    requireCashLoanMutationAccess(user, 'crear préstamos cash');

    const [cliente, cuentaOrigen] = await Promise.all([
      prisma.cliente.findFirst({
        where: { clienteId: input.clienteId, tenantId },
        select: { clienteId: true },
      }),
      prisma.cuentaBancaria.findFirst({
        where: { cuentaId: input.cuentaBancariaId, tenantId, isActive: true },
        select: { cuentaId: true, saldo: true, isActive: true, tipoCuenta: true, moneda: true },
      }),
    ]);
    if (!cliente) throw new ActionError('Cliente no encontrado', 'NOT_FOUND');
    if (!cuentaOrigen) {
      throw new ActionError('Cuenta bancaria no encontrada o inactiva', 'VALIDATION_ERROR');
    }
    const tp =
      (await prisma.tipoPago.findFirst({ where: { nombre: 'Transferencia', isActive: true, tenantId } })) ||
      (await prisma.tipoPago.findFirst({ where: { nombre: 'Efectivo', isActive: true, tenantId } }));
    if (!tp) {
      throw new ActionError(
        'No existe un tipo de pago válido para registrar el desembolso',
        'VALIDATION_ERROR',
      );
    }

    const fechaReconciliacion = new Date();
    const moneda = input.moneda || 'CUP';

    const prestamo = await prisma.$transaction(async (tx: any) => {
      await acquireAccountingTenantLock(tx, tenantId);
      const policy = await getRequiredTenantAccountingPolicy(tenantId, tx);
      const functionalCurrency = policy.functionalCurrencyCode.trim().toUpperCase();
      const conversion = buildPersistedAccountingAmount(
        new Prisma.Decimal(input.montoCapital),
        moneda,
        input.tasaCambioAlCrear,
        fechaReconciliacion,
        undefined,
        functionalCurrency,
      );
      const montoFuncional = conversion.montoConvertido;
      const evidenciaFx = conversion.fxEvidence;
      if (montoFuncional == null || !evidenciaFx) {
        throw new ActionError('Falta evidencia FX funcional para el préstamo', 'FX_INSUFICIENTE');
      }
      const importes = resolveCashDebtCurrencyAmounts({
        monedaObligacion: moneda,
        monedaFondos: moneda,
        monedaCuenta: cuentaOrigen.moneda,
        montoFondos: input.montoCapital,
        montoFuncional,
        functionalCurrency,
      });

      const montoDeuda = input.tasaInteres
        ? calcularMontoTotalACobrar(input.montoCapital, input.tasaInteres)
        : new Prisma.Decimal(input.montoCapital);

      // Monto funcional de la deuda total (con intereses si aplica)
      const conversionDeuda = buildPersistedAccountingAmount(
        montoDeuda,
        moneda,
        input.tasaCambioAlCrear,
        fechaReconciliacion,
        undefined,
        functionalCurrency,
      );
      const montoDeudaFuncional = conversionDeuda.montoConvertido;
      if (montoDeudaFuncional == null) {
        throw new ActionError('Falta evidencia FX funcional para la deuda del préstamo', 'FX_INSUFICIENTE');
      }

      // Cupo común: el desembolso nace como deuda PRESTAMO_CASH completa. Exceso
      // requiere override explícito del origen con motivo y auditoría en la misma tx.
      const decisionCredito = await validarCreditoOrigen({
        tx,
        user,
        tenantId,
        clienteId: input.clienteId,
        moneda,
        montoNuevo: montoDeuda.toNumber(),
        permiso: 'financiero.prestamos-cash.credito-override',
        solicitarCreditoOverride: input.solicitarCreditoOverride,
        motivoCreditoOverride: input.motivoCreditoOverride,
      });

      const debito = await tx.cuentaBancaria.updateMany({
        where: {
          cuentaId: input.cuentaBancariaId,
          tenantId,
          isActive: true,
          moneda: cuentaOrigen.moneda,
          saldo: { gte: importes.montoCuenta.toNumber() },
        },
        data: { saldo: { decrement: importes.montoCuenta.toNumber() } },
      });
      if (debito.count !== 1) {
        throw new ActionError('Cuenta bancaria no disponible o saldo insuficiente', 'VALIDATION_ERROR');
      }

      const cxcData: Record<string, unknown> = {
        tenant: { connect: { tenantId } },
        cliente: { connect: { clienteId: input.clienteId } },
        montoDeuda,
        montoPagado: 0,
        // Sello de moneda verificable: el cupo común la exige en validaciones futuras.
        monedaOriginal: moneda.trim().toUpperCase(),
        montoOriginal: montoDeuda,
        // Montos funcionales para valuación multi-moneda
        montoDeudaFuncional,
        montoPagadoFuncional: new Prisma.Decimal(0),
        monedaFuncional: functionalCurrency,
        tasaCambio: conversionDeuda.tasaCambio,
        rateEffectiveAt: evidenciaFx.rateEffectiveAt,
        fxProvenanceKind: evidenciaFx.fxProvenanceKind,
        fxProvenanceSource: evidenciaFx.fxProvenanceSource,
        fxCatalogRateId: evidenciaFx.fxCatalogRateId,
        fxEvidenceJson: evidenciaFx.fxEvidenceJson,
        tipoCuenta: 'PRESTAMO_CASH',
        estado: 'PENDIENTE',
      };
      if (input.fechaVencimiento) cxcData.fechaVencimiento = new Date(input.fechaVencimiento);

      const cxc = await tx.cuentaPorCobrar.create({ data: cxcData });

      const reconciliacionData: Record<string, unknown> = {
        tenant: { connect: { tenantId } },
        cuentaBancaria: { connect: { cuentaId: input.cuentaBancariaId } },
        tipoPago: { connect: { tipoId: tp.tipoId } },
        monto: new Prisma.Decimal(input.montoCapital),
        moneda,
        montoConvertido: montoFuncional,
        montoCuenta: importes.montoCuenta,
        monedaCuenta: cuentaOrigen.moneda.trim().toUpperCase(),
        fechaReconciliacion,
        ...evidenciaFx,
        observaciones:
          input.observaciones || `Desembolso de préstamo cash para cliente ${input.clienteId}`,
        reconciliadoPor: user.userId,
        tipoReconciliacion: 'PRESTAMO_CASH_DESEMBOLSO',
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
        moneda,
        createdById: user.userId,
        cuentaBancariaId: input.cuentaBancariaId,
      };
      if (input.tasaInteres !== undefined) prestamoData.tasaInteres = input.tasaInteres;
      if (input.tasaCambioAlCrear !== undefined) prestamoData.tasaCambioAlCrear = input.tasaCambioAlCrear;
      if (input.fechaVencimiento) prestamoData.fechaVencimiento = new Date(input.fechaVencimiento);
      if (input.observaciones) prestamoData.observaciones = input.observaciones;

      const prestamoCreado = await tx.prestamoCash.create({
        data: prestamoData,
        include: { cliente: { select: { clienteId: true, nombre: true } }, cuentaPorCobrar: true },
      });

      await postEvento(tx, { tenantId, userId: user.userId }, buildEventoPrestamoOtorgado({
        prestamoId: prestamoCreado.id,
        valoracion: {
          monto: reconciliacion.monto,
          moneda: reconciliacion.moneda,
          montoFuncional: reconciliacion.montoConvertido ?? undefined,
          monedaFuncionalCodigo: reconciliacion.functionalCurrency ?? 'CUP',
          tasaCambio: reconciliacion.tasaCambio,
          fxEvidenceFingerprint: reconciliacion.fxEvidenceFingerprint ?? null,
        },
        tipoCuenta: cuentaOrigen.tipoCuenta,
        fecha: fechaReconciliacion,
        descripcion: input.observaciones || `Desembolso de préstamo cash para cliente ${input.clienteId}`,
      }));

      await auditarCreditoOverride({
        tx,
        user,
        decision: decisionCredito,
        tenantId,
        clienteId: input.clienteId,
        origen: 'PRESTAMO_CASH',
        origenId: prestamoCreado.id,
        montoNuevo: montoDeuda.toNumber(),
      });

      await AuditLogService.logStrict({
        accion: 'CREATE',
        entidad: 'PRESTAMO_CASH',
        entidadId: prestamoCreado.id,
        usuarioId: user.userId,
        detalles: {
          clienteId: input.clienteId,
          montoCapital: input.montoCapital,
          moneda: input.moneda || 'CUP',
        },
      }, tx);

      return prestamoCreado;
    });

    return prestamo;
  },

  async updateCashLoan({ input, user }: { input: { id: string; fechaVencimiento?: string; tasaInteres?: number; observaciones?: string }; user: AuthenticatedUser }) {
    if (!prestamosCashEnabled()) {
      throw new ActionError('Módulo de préstamos cash deshabilitado', 'DISABLED');
    }
    const tenantId = requireTenant(user);
    requireCashLoanMutationAccess(user, 'actualizar préstamos cash');

    return prisma.$transaction(async (tx: any) => {
      const existing = await tx.prestamoCash.findFirst({
        where: { id: input.id, tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!existing) throw new ActionError('Préstamo no encontrado', 'NOT_FOUND');

      const updated = await tx.prestamoCash.updateMany({
        where: { id: input.id, tenantId, deletedAt: null },
        data: {
          ...(input.fechaVencimiento ? { fechaVencimiento: new Date(input.fechaVencimiento) } : {}),
          ...(input.tasaInteres !== undefined ? { tasaInteres: input.tasaInteres } : {}),
          ...(input.observaciones !== undefined ? { observaciones: input.observaciones } : {}),
        },
      });
      if (updated.count !== 1) throw new ActionError('Préstamo no encontrado', 'NOT_FOUND');

      const prestamo = await tx.prestamoCash.findFirst({
        where: { id: input.id, tenantId, deletedAt: null },
        include: { cliente: { select: { clienteId: true, nombre: true } }, cuentaPorCobrar: true },
      });
      if (!prestamo) throw new ActionError('Préstamo no encontrado', 'NOT_FOUND');
      await AuditLogService.logStrict({
        accion: 'UPDATE',
        entidad: 'PRESTAMO_CASH',
        entidadId: input.id,
        usuarioId: user.userId,
        detalles: { cambios: { ...input } },
      }, tx);
      return prestamo;
    });
  },

  async registerCashLoanPayment({
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
    if (!prestamosCashEnabled()) {
      throw new ActionError('Módulo de préstamos cash deshabilitado', 'DISABLED');
    }

    const tenantId = requireTenant(user);
    requireCashLoanMutationAccess(user, 'registrar pagos de préstamos cash');

    // Idempotencia: misma clave + mismo payload → devuelve el pago existente;
    // misma clave + payload distinto → 409 IDEMPOTENCY_CONFLICT.
    const idempotencyKey = input.idempotencyKey?.trim() || null;
    let idempotencyPayloadHash: string | null = null;
    if (idempotencyKey) {
      const payload = JSON.stringify({
        prestamoId: input.id,
        monto: input.monto,
        cuentaId: input.cuentaId,
        tipoPagoId: input.tipoPagoId,
        moneda: input.moneda ?? null,
      });
      idempotencyPayloadHash = sha256Hex(payload);
      const existente = await prisma.reconciliacionVenta.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
      });
      if (existente) {
        if (existente.idempotencyPayloadHash !== idempotencyPayloadHash) {
          throw new ActionError(
            'La clave de idempotencia ya fue usada con datos diferentes',
            'IDEMPOTENCY_CONFLICT',
          );
        }
        return existente;
      }
    }

    const resultado = await prisma.$transaction(async (tx: any) => {
      await acquireAccountingTenantLock(tx, tenantId);
      const prestamo = await tx.prestamoCash.findFirst({
        where: { id: input.id, tenantId, deletedAt: null },
        include: { cuentaPorCobrar: true },
      });
      if (!prestamo) throw new ActionError('Préstamo no encontrado', 'NOT_FOUND');
      if (prestamo.estado === 'PAGADO' || prestamo.estado === 'CANCELADO') {
        throw new ActionError('El préstamo no admite más pagos', 'VALIDATION_ERROR');
      }
      // Serializa el pago con nuevas obligaciones del mismo cliente.
      if (prestamo.clienteId) {
        await bloquearClienteCredito(tx, tenantId, prestamo.clienteId);
      }

      const cxcVigente = await tx.cuentaPorCobrar.findFirst({
        where: { id: prestamo.cuentaPorCobrarId, tenantId },
        select: {
          id: true, montoDeuda: true, montoPagado: true, estado: true, monedaOriginal: true,
        },
      });
      if (!cxcVigente || cxcVigente.estado === 'ANULADA') {
        throw new ActionError('La cuenta por cobrar del préstamo ya no está disponible', 'CREDITO_CONFLICTO');
      }

      const [cuenta, tipoPago] = await Promise.all([
        tx.cuentaBancaria.findFirst({
          where: { cuentaId: input.cuentaId, tenantId, isActive: true },
          select: { cuentaId: true, tipoCuenta: true, moneda: true },
        }),
        tx.tipoPago.findFirst({
          where: { tipoId: input.tipoPagoId, tenantId, isActive: true },
          select: { tipoId: true },
        }),
      ]);
      if (!cuenta || !tipoPago) {
        throw new ActionError('La cuenta o el tipo de pago no pertenecen al tenant', 'VALIDATION_ERROR');
      }

      const fechaReconciliacion = new Date();
      const moneda = input.moneda || String(prestamo.moneda);
      const policy = await getRequiredTenantAccountingPolicy(tenantId, tx);
      const functionalCurrency = policy.functionalCurrencyCode.trim().toUpperCase();
      const conversion = buildPersistedAccountingAmount(
        new Prisma.Decimal(input.monto),
        moneda,
        input.tasaCambio ?? undefined,
        fechaReconciliacion,
        undefined,
        functionalCurrency,
      );
      const montoFuncional = conversion.montoConvertido;
      const evidenciaFx = conversion.fxEvidence;
      if (montoFuncional == null || !evidenciaFx) {
        throw new ActionError('Falta evidencia de conversión para el pago del préstamo', 'FX_INSUFICIENTE');
      }
      const monedaObligacion = cxcVigente.monedaOriginal || prestamo.moneda;
      if (monedaObligacion !== prestamo.moneda) {
        throw new ActionError('La moneda de la obligación no coincide con el préstamo', 'FX_INSUFICIENTE');
      }
      const importes = resolveCashDebtCurrencyAmounts({
        monedaObligacion,
        monedaFondos: moneda,
        monedaCuenta: cuenta.moneda,
        montoFondos: new Prisma.Decimal(input.monto),
        montoFuncional,
        functionalCurrency,
      });
      const saldoPendiente = calcularSaldoPendientePrestamo(
        cxcVigente.montoDeuda, cxcVigente.montoPagado,
      );
      if (importes.montoObligacion.gt(saldoPendiente)) {
        throw new ActionError('El saldo del préstamo cambió; vuelve a consultar', 'CREDITO_CONFLICTO');
      }
      const pagoData: Record<string, unknown> = {
        tenant: { connect: { tenantId } },
        cuentaBancaria: { connect: { cuentaId: input.cuentaId } },
        tipoPago: { connect: { tipoId: input.tipoPagoId } },
        prestamoCash: { connect: { id: prestamo.id } },
        idempotencyKey,
        idempotencyPayloadHash,
        monto: new Prisma.Decimal(input.monto),
        moneda,
        montoConvertido: montoFuncional,
        montoCuenta: importes.montoCuenta,
        monedaCuenta: cuenta.moneda.trim().toUpperCase(),
        fechaReconciliacion,
        ...evidenciaFx,
        reconciliadoPor: user.userId,
        tipoReconciliacion: 'PRESTAMO_CASH',
      };
      if (conversion.tasaCambio != null) pagoData.tasaCambio = conversion.tasaCambio;
      if (input.observaciones != null) pagoData.observaciones = input.observaciones;

      const reconciliacion = await tx.reconciliacionVenta.create({ data: pagoData });
      const credito = await tx.cuentaBancaria.updateMany({
        where: { cuentaId: input.cuentaId, tenantId, isActive: true, moneda: cuenta.moneda },
        data: { saldo: { increment: importes.montoCuenta.toNumber() } },
      });
      if (credito.count !== 1) {
        throw new ActionError('La cuenta bancaria no pertenece al tenant', 'VALIDATION_ERROR');
      }
      const nuevoMontoPagado = new Prisma.Decimal(cxcVigente.montoPagado)
        .add(importes.montoObligacion)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      const nuevoMontoPagadoFuncional = new Prisma.Decimal(cxcVigente.montoPagadoFuncional ?? 0)
        .add(montoFuncional)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      const totalDeuda = cxcVigente.montoDeuda;
      const nuevoSaldo = calcularSaldoPendientePrestamo(totalDeuda, nuevoMontoPagado);
      const nuevoEstadoCuenta = nuevoSaldo.lte('0.01') ? 'PAGADA' : 'PARCIAL';
      const cuentaActualizada = await tx.cuentaPorCobrar.updateMany({
        where: {
          id: prestamo.cuentaPorCobrarId,
          tenantId,
          montoPagado: cxcVigente.montoPagado,
        },
        data: {
          montoPagado: nuevoMontoPagado,
          montoPagadoFuncional: nuevoMontoPagadoFuncional,
          estado: nuevoEstadoCuenta,
        },
      });
      if (cuentaActualizada.count !== 1) {
        throw new ActionError('El saldo del préstamo cambió; vuelve a consultar e intenta de nuevo', 'CONFLICT');
      }
      if (nuevoEstadoCuenta === 'PAGADA') {
        await tx.prestamoCash.updateMany({
          where: { id: prestamo.id, tenantId, estado: { notIn: ['PAGADO', 'CANCELADO'] } },
          data: { estado: 'PAGADO' },
        });
      }
      await postEvento(tx, { tenantId, userId: user.userId }, buildEventoCobroPrestamo({
        reconciliacionId: reconciliacion.reconciliacionId,
        valoracion: {
          monto: new Prisma.Decimal(input.monto),
          moneda,
          montoFuncional,
          monedaFuncionalCodigo: evidenciaFx.functionalCurrency,
          tasaCambio: conversion.tasaCambio ?? undefined,
          fxEvidenceFingerprint: evidenciaFx.fxEvidenceFingerprint,
        },
        tipoCuenta: cuenta.tipoCuenta,
        fecha: fechaReconciliacion,
        descripcion: input.observaciones ?? undefined,
        referencia: prestamo.id,
      }));
      await AuditLogService.logStrict({
        accion: 'CREATE',
        entidad: 'PAGO_PRESTAMO',
        entidadId: reconciliacion.reconciliacionId,
        usuarioId: user.userId,
        detalles: { prestamoId: prestamo.id, monto: input.monto, moneda },
      }, tx);
      return reconciliacion;
    });

    return resultado;
  },

  async createCashDebt({
    input,
    user,
  }: {
    input: {
      proveedorId: string;
      montoCapital: number;
      moneda?: string;
      tasaInteres?: number;
      tasaCambio?: number;
      fechaVencimiento?: string;
      observaciones?: string;
      comprobanteUrl?: string;
      cuentaBancariaId: string;
    };
    user: AuthenticatedUser;
  }) {
    if (!deudasCashEnabled()) {
      throw new ActionError('Módulo de deudas cash deshabilitado', 'DISABLED');
    }

    const tenantId = requireTenant(user);
    requireDeudaMutationAccess(user, 'registrar deudas cash');
    const totalDeuda = calcularTotalDeudaConInteres(input.montoCapital, input.tasaInteres);
    const [proveedor, cuentaOrigen] = await Promise.all([
      prisma.vendor.findFirst({
        where: { vendorId: input.proveedorId, tenantId },
        select: { nombre: true },
      }),
      prisma.cuentaBancaria.findFirst({
        where: { cuentaId: input.cuentaBancariaId, tenantId, isActive: true },
        select: { cuentaId: true, tenantId: true, moneda: true, isActive: true, tipoCuenta: true },
      }),
    ]);
    if (!proveedor) throw new ActionError('Proveedor no encontrado', 'NOT_FOUND');
    if (!cuentaOrigen) throw new ActionError('Cuenta bancaria no encontrada o inactiva', 'VALIDATION_ERROR');

    const fechaReconciliacion = new Date();
    const moneda = input.moneda || 'CUP';

    const deuda = await prisma.$transaction(async (tx: any) => {
      await acquireAccountingTenantLock(tx, tenantId);
      const policy = await getRequiredTenantAccountingPolicy(tenantId, tx);
      const functionalCurrency = policy.functionalCurrencyCode.trim().toUpperCase();
      const conversion = buildPersistedAccountingAmount(
        new Prisma.Decimal(input.montoCapital),
        moneda,
        input.tasaCambio,
        fechaReconciliacion,
        undefined,
        functionalCurrency,
      );
      if (conversion.montoConvertido == null || !conversion.fxEvidence) {
        throw new ActionError('Falta evidencia FX funcional para la deuda', 'FX_INSUFICIENTE');
      }
      const importes = resolveCashDebtCurrencyAmounts({
        monedaObligacion: moneda,
        monedaFondos: moneda,
        monedaCuenta: cuentaOrigen.moneda,
        montoFondos: new Prisma.Decimal(input.montoCapital),
        montoFuncional: conversion.montoConvertido,
        functionalCurrency,
      });
      const tp =
        (await tx.tipoPago.findFirst({ where: { nombre: 'Transferencia', isActive: true, tenantId } })) ||
        (await tx.tipoPago.findFirst({ where: { nombre: 'Efectivo', isActive: true, tenantId } }));
      if (!tp) {
        throw new ActionError('No existe un tipo de pago válido para el desembolso de deuda', 'VALIDATION_ERROR');
      }

      const cuentaActualizada = await tx.cuentaBancaria.updateMany({
        where: {
          cuentaId: input.cuentaBancariaId,
          tenantId,
          isActive: true,
          moneda: cuentaOrigen.moneda,
        },
        data: { saldo: { increment: importes.montoCuenta.toNumber() } },
      });
      if (cuentaActualizada.count !== 1) {
        throw new ActionError('Cuenta bancaria no encontrada o inactiva', 'VALIDATION_ERROR');
      }

      const lastDeuda = await tx.deudaCash.findFirst({ orderBy: { idNumerico: 'desc' }, select: { idNumerico: true } });
      const nextNum = (lastDeuda?.idNumerico ?? 0) + 1;

      const cxp = await tx.cuentaPorPagar.create({
        data: {
          tenantId,
          numeroFactura: `DC-${nextNum}`,
          proveedorId: input.proveedorId,
          proveedorNombre: proveedor.nombre,
          montoDeuda: totalDeuda,
          montoPagado: 0,
          saldoPendiente: totalDeuda,
          moneda,
          tipo: 'compra',
          tipoDeuda: 'DEUDA_CASH',
          estado: 'PENDIENTE',
          fechaVencimiento: input.fechaVencimiento ? new Date(input.fechaVencimiento) : undefined,
        },
      });

      const reconciliacion = await tx.reconciliacionVenta.create({
        data: {
          tenant: { connect: { tenantId } },
          cuentaBancaria: { connect: { cuentaId: input.cuentaBancariaId } },
          tipoPago: { connect: { tipoId: tp.tipoId } },
          monto: new Prisma.Decimal(input.montoCapital),
          moneda,
          montoConvertido: conversion.montoConvertido,
          montoCuenta: importes.montoCuenta,
          monedaCuenta: cuentaOrigen.moneda.trim().toUpperCase(),
          fechaReconciliacion,
          ...(conversion.fxEvidence ?? {}),
          observaciones:
            input.observaciones || `Desembolso de deuda cash para proveedor ${input.proveedorId}`,
          reconciliadoPor: user.userId,
          tipoReconciliacion: 'DEUDA_CASH_DESEMBOLSO',
          ...(conversion.tasaCambio != null ? { tasaCambio: conversion.tasaCambio } : {}),
        },
      });

      const deudaCreada = await tx.deudaCash.create({
        data: {
          tenantId,
          proveedorId: input.proveedorId,
          cuentaPorPagarId: cxp.cuentaPorPagarId,
          montoCapital: input.montoCapital,
          moneda,
          tasaInteres: input.tasaInteres,
          fechaVencimiento: input.fechaVencimiento ? new Date(input.fechaVencimiento) : undefined,
          observaciones: input.observaciones,
          comprobanteUrl: input.comprobanteUrl,
          cuentaBancariaId: input.cuentaBancariaId,
          createdById: user.userId,
        },
        include: { proveedor: { select: { vendorId: true, nombre: true } }, cuentaPorPagar: true },
      });

      await postEvento(tx, { tenantId, userId: user.userId }, buildEventoDeudaRecibida({
        deudaId: deudaCreada.id,
        valoracion: {
          monto: reconciliacion.monto,
          moneda: reconciliacion.moneda,
          montoFuncional: reconciliacion.montoConvertido ?? undefined,
          monedaFuncionalCodigo: reconciliacion.functionalCurrency ?? 'CUP',
          tasaCambio: reconciliacion.tasaCambio,
          fxEvidenceFingerprint: reconciliacion.fxEvidenceFingerprint ?? null,
        },
        tipoCuenta: cuentaOrigen.tipoCuenta,
        fecha: fechaReconciliacion,
        descripcion: input.observaciones || `Desembolso de deuda cash para proveedor ${input.proveedorId}`,
      }));

      await AuditLogService.logStrict({
        accion: 'CREATE',
        entidad: 'DEUDA_CASH',
        entidadId: deudaCreada.id,
        usuarioId: user.userId,
        detalles: {
          proveedorId: input.proveedorId,
          montoCapital: input.montoCapital,
          moneda: input.moneda || 'CUP',
        },
      }, tx);

      return deudaCreada;
    });

    return deuda;
  },

  async updateCashDebt({ input, user }: { input: { id: string; fechaVencimiento?: string; tasaInteres?: number; observaciones?: string }; user: AuthenticatedUser }) {
    if (!deudasCashEnabled()) {
      throw new ActionError('Módulo de deudas cash deshabilitado', 'DISABLED');
    }
    const tenantId = requireTenant(user);
    requireDeudaMutationAccess(user, 'actualizar deudas cash');

    return prisma.$transaction(async (tx: any) => {
      const existing = await tx.deudaCash.findFirst({
        where: { id: input.id, tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!existing) throw new ActionError('Deuda no encontrada', 'NOT_FOUND');

      const updated = await tx.deudaCash.updateMany({
        where: { id: input.id, tenantId, deletedAt: null },
        data: {
          ...(input.fechaVencimiento ? { fechaVencimiento: new Date(input.fechaVencimiento) } : {}),
          ...(input.tasaInteres !== undefined ? { tasaInteres: input.tasaInteres } : {}),
          ...(input.observaciones !== undefined ? { observaciones: input.observaciones } : {}),
        },
      });
      if (updated.count !== 1) throw new ActionError('Deuda no encontrada', 'NOT_FOUND');

      const deuda = await tx.deudaCash.findFirst({
        where: { id: input.id, tenantId, deletedAt: null },
        include: { proveedor: { select: { vendorId: true, nombre: true } }, cuentaPorPagar: true },
      });
      if (!deuda) throw new ActionError('Deuda no encontrada', 'NOT_FOUND');
      await AuditLogService.logStrict({
        accion: 'UPDATE',
        entidad: 'DEUDA_CASH',
        entidadId: input.id,
        usuarioId: user.userId,
        detalles: { cambios: { ...input } },
      }, tx);
      return deuda;
    });
  },

  async registerCashDebtPayment({
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
    };
    user: AuthenticatedUser;
  }) {
    if (!deudasCashEnabled()) {
      throw new ActionError('Módulo de deudas cash deshabilitado', 'DISABLED');
    }

    const tenantId = requireTenant(user);
    requireDeudaMutationAccess(user, 'registrar pagos de deuda cash');

    const [cuenta, tipoPago] = await Promise.all([
      prisma.cuentaBancaria.findFirst({
        where: { cuentaId: input.cuentaId, tenantId, isActive: true },
        select: { cuentaId: true, moneda: true, tipoCuenta: true },
      }),
      prisma.tipoPago.findFirst({
        where: { tipoId: input.tipoPagoId, tenantId, isActive: true },
        select: { tipoId: true },
      }),
    ]);
    if (!cuenta || !tipoPago) {
      throw new ActionError('La cuenta o el tipo de pago no pertenecen al tenant', 'VALIDATION_ERROR');
    }

    const fechaReconciliacion = new Date();

    const resultado = await prisma.$transaction(async (tx) => {
      await acquireAccountingTenantLock(tx, tenantId);

      // Leer deuda y obligación después del lock; nunca calcular un nuevo pago
      // desde el saldo observado antes de serializar writers del tenant.
      const deuda = await tx.deudaCash.findFirst({
        where: { id: input.id, tenantId, deletedAt: null },
        include: { cuentaPorPagar: true },
      });
      if (!deuda) throw new ActionError('Deuda no encontrada', 'NOT_FOUND');
      if (deuda.estado === 'PAGADO' || deuda.estado === 'CANCELADO') {
        throw new ActionError('La deuda no admite más pagos', 'VALIDATION_ERROR');
      }

      const moneda = input.moneda || deuda.moneda;
      const policy = await getRequiredTenantAccountingPolicy(tenantId, tx);
      const functionalCurrency = policy.functionalCurrencyCode.trim().toUpperCase();
      const conversion = buildPersistedAccountingAmount(
        new Prisma.Decimal(input.monto), moneda, input.tasaCambio, fechaReconciliacion,
        undefined, functionalCurrency,
      );
      const montoFuncional = conversion.montoConvertido;
      const evidenciaFx = conversion.fxEvidence;
      if (montoFuncional == null || !evidenciaFx) {
        throw new ActionError(
          'Falta evidencia de conversión para el pago de la deuda', 'FX_INSUFICIENTE',
        );
      }
      if (deuda.cuentaPorPagar.moneda !== deuda.moneda) {
        throw new ActionError(
          'La moneda de la obligación no coincide con la deuda', 'FX_INSUFICIENTE',
        );
      }
      const importes = resolveCashDebtCurrencyAmounts({
        monedaObligacion: deuda.cuentaPorPagar.moneda,
        monedaFondos: moneda,
        monedaCuenta: cuenta.moneda,
        montoFondos: new Prisma.Decimal(input.monto),
        montoFuncional,
        functionalCurrency,
      });
      const saldoPendiente = calcularSaldoPendienteDeuda(
        deuda.cuentaPorPagar.montoDeuda,
        deuda.cuentaPorPagar.montoPagado,
      );
      if (importes.montoObligacion.gt(saldoPendiente)) {
        throw new ActionError(
          `El monto excede el saldo pendiente de ${saldoPendiente}`,
          'CREDITO_CONFLICTO',
        );
      }

      const reconciliacion = await tx.reconciliacionVenta.create({
        data: {
          tenant: { connect: { tenantId } },
          cuentaBancaria: { connect: { cuentaId: input.cuentaId } },
          tipoPago: { connect: { tipoId: input.tipoPagoId } },
          monto: new Prisma.Decimal(input.monto),
          moneda,
          montoConvertido: conversion.montoConvertido,
          montoCuenta: importes.montoCuenta,
          monedaCuenta: cuenta.moneda.trim().toUpperCase(),
          fechaReconciliacion,
          ...(conversion.fxEvidence ?? {}),
          ...(conversion.tasaCambio != null && { tasaCambio: conversion.tasaCambio }),
          ...(input.observaciones != null && { observaciones: input.observaciones }),
          reconciliadoPor: user.userId,
          deudaCash: { connect: { id: deuda.id } },
          tipoReconciliacion: 'DEUDA_CASH',
        },
      });
      const cuentaActualizada = await tx.cuentaBancaria.updateMany({
        where: {
          cuentaId: input.cuentaId,
          tenantId,
          isActive: true,
          moneda: cuenta.moneda,
          saldo: { gte: importes.montoCuenta.toNumber() },
        },
        data: { saldo: { decrement: importes.montoCuenta.toNumber() } },
      });
      if (cuentaActualizada.count !== 1) {
        throw new ActionError('La cuenta no tiene saldo suficiente o no pertenece al tenant', 'VALIDATION_ERROR');
      }
      const nuevoMontoPagado = new Prisma.Decimal(deuda.cuentaPorPagar.montoPagado)
        .add(importes.montoObligacion)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      const totalDeuda = deuda.cuentaPorPagar.montoDeuda;
      const nuevoSaldoPendiente = calcularSaldoPendienteDeuda(totalDeuda, nuevoMontoPagado);
      const nuevoEstadoCuenta = nuevoSaldoPendiente.lte('0.01') ? 'PAGADA' : 'PARCIAL';
      const cuentaPorPagarActualizada = await tx.cuentaPorPagar.updateMany({
        where: {
          cuentaPorPagarId: deuda.cuentaPorPagarId,
          tenantId,
          montoPagado: deuda.cuentaPorPagar.montoPagado,
          estado: deuda.cuentaPorPagar.estado,
        },
        data: {
          montoPagado: nuevoMontoPagado,
          saldoPendiente: nuevoSaldoPendiente,
          estado: nuevoEstadoCuenta,
        },
      });
      if (cuentaPorPagarActualizada.count !== 1) {
        throw new ActionError('El saldo de la deuda cambió; vuelve a consultar', 'CREDITO_CONFLICTO');
      }
      if (nuevoEstadoCuenta === 'PAGADA') {
        const deudaActualizada = await tx.deudaCash.updateMany({
          where: { id: deuda.id, tenantId, estado: deuda.estado, deletedAt: null },
          data: { estado: 'PAGADO' },
        });
        if (deudaActualizada.count !== 1) {
          throw new ActionError('El estado de la deuda cambió; vuelve a consultar', 'CREDITO_CONFLICTO');
        }
      }
      await postEvento(tx, { tenantId, userId: user.userId }, buildEventoPagoDeuda({
        reconciliacionId: reconciliacion.reconciliacionId,
        valoracion: {
          monto: new Prisma.Decimal(input.monto),
          moneda,
          montoFuncional,
          monedaFuncionalCodigo: evidenciaFx.functionalCurrency,
          tasaCambio: conversion.tasaCambio ?? undefined,
          fxEvidenceFingerprint: evidenciaFx.fxEvidenceFingerprint,
        },
        tipoCuenta: cuenta.tipoCuenta,
        fecha: fechaReconciliacion,
        descripcion: input.observaciones ?? undefined,
        referencia: deuda.id,
      }));
      await AuditLogService.logStrict({
        accion: 'CREATE',
        entidad: 'PAGO_DEUDA',
        entidadId: reconciliacion.reconciliacionId,
        usuarioId: user.userId,
        detalles: { deudaId: deuda.id, monto: input.monto, moneda },
      }, tx);
      return reconciliacion;
    });

    return resultado;
  },
};
