import { prisma } from '@/lib/prisma';
import { buildPersistedAccountingAmount } from '@/features/contabilidad/services/accounting-reconciliation-service';
import { ActionError } from '@/lib/server-actions';
import { AuditLogService } from '@/lib/services/audit-log-service';
import {
  auditarCreditoOverride,
  bloquearClienteCredito,
  validarCreditoOrigen,
} from '@/features/ventas/services/credito-override';
import { calcularSaldoPendientePrestamo } from '@/lib/utils/prestamo-cash';
import {
  calcularSaldoPendienteDeuda,
  calcularTotalDeudaConInteres,
} from '@/lib/utils/deuda-cash';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { requireFeature, requirePermission, requireTenant } from '@/lib/services/tenant-scope';
import { acquireAccountingTenantLock } from './accounting-tenant-lock-service';
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
        select: { cuentaId: true, saldo: true, isActive: true, tipoCuenta: true },
      }),
    ]);
    if (!cliente) throw new ActionError('Cliente no encontrado', 'NOT_FOUND');
    if (!cuentaOrigen) {
      throw new ActionError('Cuenta bancaria no encontrada o inactiva', 'VALIDATION_ERROR');
    }
    if (cuentaOrigen.saldo < input.montoCapital) {
      throw new ActionError(
        `Saldo insuficiente en la cuenta. Disponible: ${cuentaOrigen.saldo}`,
        'VALIDATION_ERROR',
      );
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
    const conversion = buildPersistedAccountingAmount(
      Number(input.montoCapital),
      moneda,
      input.tasaCambioAlCrear,
      fechaReconciliacion,
    );
    const montoFuncional = conversion.montoConvertido;
    const evidenciaFx = conversion.fxEvidence;
    if (montoFuncional == null || !evidenciaFx) {
      throw new ActionError('Falta evidencia de conversión para el préstamo', 'FX_INSUFICIENTE');
    }

    const prestamo = await prisma.$transaction(async (tx: any) => {
      await acquireAccountingTenantLock(tx, tenantId);

      const montoDeuda = input.tasaInteres
        ? Number((input.montoCapital * (1 + input.tasaInteres / 100)).toFixed(2))
        : input.montoCapital;

      // Cupo común: el desembolso nace como deuda PRESTAMO_CASH completa. Exceso
      // requiere override explícito del origen con motivo y auditoría en la misma tx.
      const decisionCredito = await validarCreditoOrigen({
        tx,
        user,
        tenantId,
        clienteId: input.clienteId,
        moneda,
        montoNuevo: montoDeuda,
        permiso: 'financiero.prestamos-cash.credito-override',
        solicitarCreditoOverride: input.solicitarCreditoOverride,
        motivoCreditoOverride: input.motivoCreditoOverride,
      });

      const debito = await tx.cuentaBancaria.updateMany({
        where: {
          cuentaId: input.cuentaBancariaId,
          tenantId,
          isActive: true,
          saldo: { gte: input.montoCapital },
        },
        data: { saldo: { decrement: input.montoCapital } },
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
        tipoCuenta: 'PRESTAMO_CASH',
        estado: 'PENDIENTE',
      };
      if (input.fechaVencimiento) cxcData.fechaVencimiento = new Date(input.fechaVencimiento);

      const cxc = await tx.cuentaPorCobrar.create({ data: cxcData });

      const reconciliacionData: Record<string, unknown> = {
        tenant: { connect: { tenantId } },
        cuentaBancaria: { connect: { cuentaId: input.cuentaBancariaId } },
        tipoPago: { connect: { tipoId: tp.tipoId } },
        monto: input.montoCapital,
        moneda,
        montoConvertido: montoFuncional,
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
          monto: Number(reconciliacion.monto),
          moneda: reconciliacion.moneda,
          montoFuncional: Number(reconciliacion.montoConvertido),
          monedaFuncionalCodigo: reconciliacion.functionalCurrency ?? 'CUP',
          tasaCambio: reconciliacion.tasaCambio == null ? null : Number(reconciliacion.tasaCambio),
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
        montoNuevo: montoDeuda,
      });

      return prestamoCreado;
    });

    await AuditLogService.log({
      accion: 'CREATE',
      entidad: 'PRESTAMO_CASH',
      entidadId: prestamo.id,
      usuarioId: user.userId,
      detalles: {
        clienteId: input.clienteId,
        montoCapital: input.montoCapital,
        moneda: input.moneda || 'CUP',
      },
    });

    return prestamo;
  },

  async updateCashLoan({ input, user }: { input: { id: string; fechaVencimiento?: string; tasaInteres?: number; observaciones?: string }; user: AuthenticatedUser }) {
    if (!prestamosCashEnabled()) {
      throw new ActionError('Módulo de préstamos cash deshabilitado', 'DISABLED');
    }

    const existing = await prisma.prestamoCash.findFirst({ where: { id: input.id, deletedAt: null } });
    if (!existing) throw new ActionError('Préstamo no encontrado', 'NOT_FOUND');

    const prestamo = await prisma.prestamoCash.update({
      where: { id: input.id },
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
    };
    user: AuthenticatedUser;
  }) {
    if (!prestamosCashEnabled()) {
      throw new ActionError('Módulo de préstamos cash deshabilitado', 'DISABLED');
    }

    const tenantId = requireTenant(user);
    requireCashLoanMutationAccess(user, 'registrar pagos de préstamos cash');

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
        select: { id: true, montoDeuda: true, montoPagado: true, estado: true },
      });
      if (!cxcVigente || cxcVigente.estado === 'ANULADA') {
        throw new ActionError('La cuenta por cobrar del préstamo ya no está disponible', 'CREDITO_CONFLICTO');
      }

      const saldoPendiente = calcularSaldoPendientePrestamo(
        Number(cxcVigente.montoDeuda),
        Number(cxcVigente.montoPagado),
      );
      if (input.monto > saldoPendiente) {
        throw new ActionError('El saldo del préstamo cambió; vuelve a consultar', 'CREDITO_CONFLICTO');
      }

      const [cuenta, tipoPago] = await Promise.all([
        tx.cuentaBancaria.findFirst({
          where: { cuentaId: input.cuentaId, tenantId, isActive: true },
          select: { cuentaId: true, tipoCuenta: true },
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
      const conversion = buildPersistedAccountingAmount(
        Number(input.monto),
        moneda,
        input.tasaCambio ?? undefined,
        fechaReconciliacion,
      );
      const montoFuncional = conversion.montoConvertido;
      const evidenciaFx = conversion.fxEvidence;
      if (montoFuncional == null || !evidenciaFx) {
        throw new ActionError('Falta evidencia de conversión para el pago del préstamo', 'FX_INSUFICIENTE');
      }
      const pagoData: Record<string, unknown> = {
        tenant: { connect: { tenantId } },
        cuentaBancaria: { connect: { cuentaId: input.cuentaId } },
        tipoPago: { connect: { tipoId: input.tipoPagoId } },
        prestamoCash: { connect: { id: prestamo.id } },
        monto: input.monto,
        moneda,
        montoConvertido: montoFuncional,
        fechaReconciliacion,
        ...evidenciaFx,
        reconciliadoPor: user.userId,
        tipoReconciliacion: 'PRESTAMO_CASH',
      };
      if (conversion.tasaCambio != null) pagoData.tasaCambio = conversion.tasaCambio;
      if (input.observaciones != null) pagoData.observaciones = input.observaciones;

      const reconciliacion = await tx.reconciliacionVenta.create({ data: pagoData });
      const credito = await tx.cuentaBancaria.updateMany({
        where: { cuentaId: input.cuentaId, tenantId, isActive: true },
        data: { saldo: { increment: input.monto } },
      });
      if (credito.count !== 1) {
        throw new ActionError('La cuenta bancaria no pertenece al tenant', 'VALIDATION_ERROR');
      }
      const nuevoMontoPagado = Number((Number(cxcVigente.montoPagado) + input.monto).toFixed(2));
      const totalDeuda = Number(cxcVigente.montoDeuda);
      const nuevoSaldo = calcularSaldoPendientePrestamo(totalDeuda, nuevoMontoPagado);
      const nuevoEstadoCuenta = nuevoSaldo <= 0.01 ? 'PAGADA' : 'PARCIAL';
      const cuentaActualizada = await tx.cuentaPorCobrar.updateMany({
        where: {
          id: prestamo.cuentaPorCobrarId,
          tenantId,
          montoPagado: cxcVigente.montoPagado,
        },
        data: { montoPagado: nuevoMontoPagado, estado: nuevoEstadoCuenta },
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
          monto: Number(input.monto),
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
      return { reconciliacion, prestamoId: prestamo.id };
    });

    await AuditLogService.log({
      accion: 'CREATE',
      entidad: 'PAGO_PRESTAMO',
      entidadId: resultado.reconciliacion.reconciliacionId,
      usuarioId: user.userId,
      detalles: {
        prestamoId: resultado.prestamoId,
        monto: input.monto,
        moneda: input.moneda,
      },
    });

    return resultado.reconciliacion;
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
    const conversion = buildPersistedAccountingAmount(
      Number(input.montoCapital),
      moneda,
      input.tasaCambio,
      fechaReconciliacion,
    );
    if (conversion.montoConvertido == null || !conversion.fxEvidence) {
      throw new ActionError('Falta evidencia de conversión para la deuda', 'FX_INSUFICIENTE');
    }

    const deuda = await prisma.$transaction(async (tx: any) => {
      await acquireAccountingTenantLock(tx, tenantId);
      const tp =
        (await tx.tipoPago.findFirst({ where: { nombre: 'Transferencia', isActive: true, tenantId } })) ||
        (await tx.tipoPago.findFirst({ where: { nombre: 'Efectivo', isActive: true, tenantId } }));
      if (!tp) {
        throw new ActionError('No existe un tipo de pago válido para el desembolso de deuda', 'VALIDATION_ERROR');
      }

      const cuentaActualizada = await tx.cuentaBancaria.updateMany({
        where: { cuentaId: input.cuentaBancariaId, tenantId, isActive: true },
        data: { saldo: { increment: input.montoCapital } },
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
          monto: input.montoCapital,
          moneda,
          montoConvertido: conversion.montoConvertido,
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
          monto: Number(reconciliacion.monto),
          moneda: reconciliacion.moneda,
          montoFuncional: Number(reconciliacion.montoConvertido),
          monedaFuncionalCodigo: reconciliacion.functionalCurrency ?? 'CUP',
          tasaCambio: reconciliacion.tasaCambio == null ? null : Number(reconciliacion.tasaCambio),
          fxEvidenceFingerprint: reconciliacion.fxEvidenceFingerprint ?? null,
        },
        tipoCuenta: cuentaOrigen.tipoCuenta,
        fecha: fechaReconciliacion,
        descripcion: input.observaciones || `Desembolso de deuda cash para proveedor ${input.proveedorId}`,
      }));

      return deudaCreada;
    });

    await AuditLogService.log({
      accion: 'CREATE',
      entidad: 'DEUDA_CASH',
      entidadId: deuda.id,
      usuarioId: user.userId,
      detalles: { proveedorId: input.proveedorId, montoCapital: input.montoCapital, moneda: input.moneda || 'CUP' },
    });

    return deuda;
  },

  async updateCashDebt({ input, user }: { input: { id: string; fechaVencimiento?: string; tasaInteres?: number; observaciones?: string }; user: AuthenticatedUser }) {
    if (!deudasCashEnabled()) {
      throw new ActionError('Módulo de deudas cash deshabilitado', 'DISABLED');
    }

    const existing = await prisma.deudaCash.findFirst({ where: { id: input.id, deletedAt: null } });
    if (!existing) throw new ActionError('Deuda no encontrada', 'NOT_FOUND');

    const deuda = await prisma.deudaCash.update({
      where: { id: input.id },
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
    const deuda = await prisma.deudaCash.findFirst({
      where: { id: input.id, tenantId, deletedAt: null },
      include: { cuentaPorPagar: true },
    });
    if (!deuda) throw new ActionError('Deuda no encontrada', 'NOT_FOUND');
    if (deuda.estado === 'PAGADO' || deuda.estado === 'CANCELADO') {
      throw new ActionError('La deuda no admite más pagos', 'VALIDATION_ERROR');
    }

    const saldoPendiente = calcularSaldoPendienteDeuda(
      Number(deuda.cuentaPorPagar.montoDeuda),
      Number(deuda.cuentaPorPagar.montoPagado),
    );
    if (input.monto > saldoPendiente) {
      throw new ActionError(`El monto excede el saldo pendiente de ${saldoPendiente}`, 'VALIDATION_ERROR');
    }

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
    const moneda = input.moneda || deuda.moneda;
    const conversion = buildPersistedAccountingAmount(
      Number(input.monto),
      moneda,
      input.tasaCambio,
      fechaReconciliacion,
    );
    const montoFuncional = conversion.montoConvertido;
    const evidenciaFx = conversion.fxEvidence;
    if (montoFuncional == null || !evidenciaFx) {
      throw new ActionError('Falta evidencia de conversión para el pago de la deuda', 'FX_INSUFICIENTE');
    }

    const resultado = await prisma.$transaction(async (tx: any) => {
      await acquireAccountingTenantLock(tx, tenantId);
      const reconciliacion = await tx.reconciliacionVenta.create({
        data: {
          tenant: { connect: { tenantId } },
          cuentaBancaria: { connect: { cuentaId: input.cuentaId } },
          tipoPago: { connect: { tipoId: input.tipoPagoId } },
          monto: input.monto,
          moneda,
          montoConvertido: conversion.montoConvertido,
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
        where: { cuentaId: input.cuentaId, tenantId, isActive: true },
        data: { saldo: { decrement: input.monto } },
      });
      if (cuentaActualizada.count !== 1) {
        throw new ActionError('La cuenta bancaria no pertenece al tenant', 'VALIDATION_ERROR');
      }
      const nuevoMontoPagado = Number((Number(deuda.cuentaPorPagar.montoPagado) + input.monto).toFixed(2));
      const totalDeuda = Number(deuda.cuentaPorPagar.montoDeuda);
      const nuevoSaldoPendiente = calcularSaldoPendienteDeuda(totalDeuda, nuevoMontoPagado);
      const nuevoEstadoCuenta = nuevoSaldoPendiente <= 0.01 ? 'PAGADA' : 'PARCIAL';
      await tx.cuentaPorPagar.update({
        where: { cuentaPorPagarId: deuda.cuentaPorPagarId },
        data: {
          montoPagado: nuevoMontoPagado,
          saldoPendiente: nuevoSaldoPendiente,
          estado: nuevoEstadoCuenta,
        },
      });
      if (nuevoEstadoCuenta === 'PAGADA') {
        await tx.deudaCash.update({ where: { id: deuda.id }, data: { estado: 'PAGADO' } });
      }
      await postEvento(tx, { tenantId, userId: user.userId }, buildEventoPagoDeuda({
        reconciliacionId: reconciliacion.reconciliacionId,
        valoracion: {
          monto: Number(input.monto),
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
      return reconciliacion;
    });

    await AuditLogService.log({
      accion: 'CREATE',
      entidad: 'PAGO_DEUDA',
      entidadId: resultado.reconciliacionId,
      usuarioId: user.userId,
      detalles: { deudaId: deuda.id, monto: input.monto, moneda: input.moneda || deuda.moneda },
    });

    return resultado;
  },
};
