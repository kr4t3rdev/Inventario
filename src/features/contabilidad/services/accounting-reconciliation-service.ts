import { prisma } from '@/lib/prisma';
import { ActionError } from '@/lib/server-actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { requireFeature, requirePermission, requireTenant } from '@/lib/services/tenant-scope';
import { Prisma } from '@/generated/prisma';
import { buildAppliedFxEvidence } from '@/features/contabilidad/domain/fx-evidence';
import { getPayrollPaymentAmount } from '@/features/pago-salario/payroll-amounts';
import { postEvento } from '@/features/contabilidad-formal/services/posting-engine';
import {
  buildEventoCobroCxc,
  buildEventoServicio,
  buildEventoVentaContado,
} from '@/features/contabilidad-formal/lib/event-builders';
import { acquireAccountingTenantLock } from './accounting-tenant-lock-service';
import { bloquearClienteCredito } from '@/features/ventas/services/credito-override';
import { valueAnticipoApplication } from '@/lib/services/anticipo-valuation';

/**
 * @description Construye los metadatos de conversión y la evidencia FX que se guardan junto a
 * una reconciliación. Para moneda extranjera exige tasa válida y fecha efectiva explícita;
 * nunca fabrica evidencia ausente.
 * @param {number} amount - Importe en la moneda de origen.
 * @param {string} currency - Moneda del importe.
 * @param {number | undefined} exchangeRate - Tasa aplicada hacia CUP.
 * @param {Date | null | undefined} effectiveAt - Fecha en que se aplicó la tasa informada.
 * @returns {{montoConvertido: number | null; tasaCambio: number | null; fxEvidence: object | null}} Metadatos y evidencia inmutable.
 */
export function buildPersistedAccountingAmount(
  amount: number,
  currency: string,
  exchangeRate?: number,
  effectiveAt?: Date | null,
  fxCatalogRateId?: string | null,
): {
  montoConvertido: number | null;
  tasaCambio: number | null;
  fxEvidence:
    | {
        functionalCurrency: string;
        rateEffectiveAt?: Date;
        fxProvenanceKind: string;
        fxProvenanceSource: string;
        fxCatalogRateId: null;
        fxEvidenceFingerprint: string;
        fxEvidenceVersion: number;
      }
    | null;
} {
  const source = 'accounting-reconciliation-service';

  if (currency.trim().toUpperCase() === 'CUP') {
    const evidence = buildAppliedFxEvidence({
      originalAmount: amount,
      originalCurrency: currency,
      functionalCurrency: 'CUP',
      source,
    });
    return {
      montoConvertido: amount,
      tasaCambio: 1,
      fxEvidence: {
        functionalCurrency: evidence.functionalCurrency,
        fxProvenanceKind: evidence.fxProvenanceKind,
        fxProvenanceSource: evidence.fxProvenanceSource,
        fxCatalogRateId: evidence.fxCatalogRateId,
        fxEvidenceFingerprint: evidence.fxEvidenceFingerprint,
        fxEvidenceVersion: evidence.fxEvidenceVersion,
      } as any,
    };
  }

  if (exchangeRate == null || !Number.isFinite(exchangeRate) || exchangeRate <= 0) {
    return { montoConvertido: null, tasaCambio: null, fxEvidence: null };
  }

  if (effectiveAt == null || Number.isNaN(effectiveAt.getTime())) {
    return { montoConvertido: null, tasaCambio: null, fxEvidence: null };
  }

  try {
    const evidence = buildAppliedFxEvidence({
      originalAmount: amount,
      originalCurrency: currency,
      functionalCurrency: 'CUP',
      exchangeRate,
      convertedAmount: amount * exchangeRate,
      rateEffectiveAt: effectiveAt,
      source,
      fxCatalogRateId: fxCatalogRateId ?? null,
    });
    return {
      montoConvertido: amount * exchangeRate,
      tasaCambio: exchangeRate,
      fxEvidence: {
        functionalCurrency: evidence.functionalCurrency,
        rateEffectiveAt: new Date(effectiveAt.getTime()),
        fxProvenanceKind: evidence.fxProvenanceKind,
        fxProvenanceSource: evidence.fxProvenanceSource,
        fxCatalogRateId: evidence.fxCatalogRateId,
        fxEvidenceFingerprint: evidence.fxEvidenceFingerprint,
        fxEvidenceVersion: evidence.fxEvidenceVersion,
      } as any,
    };
  } catch {
    return { montoConvertido: null, tasaCambio: null, fxEvidence: null };
  }
}

export function validateSaleReconciliationInput(input: {
  ventaId?: unknown;
  cuentaId?: unknown;
  tipoPagoId?: unknown;
  monto?: unknown;
}): asserts input is {
  ventaId: string;
  cuentaId: string;
  tipoPagoId: string;
  monto: number;
  moneda?: string;
  tasaCambio?: number;
} {
  if (
    typeof input.ventaId !== 'string' || input.ventaId.trim() === '' ||
    typeof input.cuentaId !== 'string' || input.cuentaId.trim() === '' ||
    typeof input.tipoPagoId !== 'string' || input.tipoPagoId.trim() === '' ||
    typeof input.monto !== 'number' || !Number.isFinite(input.monto) || input.monto <= 0
  ) {
    throw new ActionError('Datos de reconciliación inválidos', 'VALIDATION_ERROR');
  }
}

/**
 * @description Shared service for accounting reconciliation flows used by web and mobile adapters.
 */
export const AccountingReconciliationService = {
  async listPendingSales(params: {
    tenantId: string;
    fechaInicio?: string | null;
    fechaFin?: string | null;
    puntoDeVentaId?: string | null;
    page?: number;
    limit?: number;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const skip = (page - 1) * limit;

    const whereParts: Prisma.Sql[] = [
      Prisma.sql`v."tenantId" = ${params.tenantId}`,
      Prisma.sql`v."deletedAt" IS NULL`,
    ];
    if (params.fechaInicio) {
      whereParts.push(Prisma.sql`v."createdAt" >= ${new Date(params.fechaInicio)}`);
    }
    if (params.fechaFin) {
      const fechaFinDate = new Date(params.fechaFin);
      fechaFinDate.setUTCHours(23, 59, 59, 999);
      whereParts.push(Prisma.sql`v."createdAt" <= ${fechaFinDate}`);
    }
    if (params.puntoDeVentaId) {
      whereParts.push(Prisma.sql`v."puntoDeVentaId" = ${params.puntoDeVentaId}`);
    }

    const whereSql =
      whereParts.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(whereParts, ' AND ')}`
        : Prisma.sql``;

    const pendingRows = await prisma.$queryRaw<Array<{ ventaId: string; totalPagado: number }>>(Prisma.sql`
      SELECT v."ventaId",
        COALESCE(SUM(
          CASE
            WHEN rv."moneda" = 'CUP' THEN rv."monto"
            WHEN rv."tasaCambio" IS NOT NULL AND rv."tasaCambio" > 0 THEN rv."monto" * rv."tasaCambio"
            ELSE rv."monto"
          END
        ), 0)::double precision AS "totalPagado"
      FROM "Venta" v
      LEFT JOIN "ReconciliacionVenta" rv ON rv."ventaId" = v."ventaId"
      ${whereSql}
      GROUP BY v."ventaId", v."total", v."createdAt"
      HAVING (COALESCE(v."total", 0) - COALESCE(SUM(
        CASE
          WHEN rv."moneda" = 'CUP' THEN rv."monto"
          WHEN rv."tasaCambio" IS NOT NULL AND rv."tasaCambio" > 0 THEN rv."monto" * rv."tasaCambio"
          ELSE rv."monto"
        END
      ), 0)) > 0.1
      ORDER BY v."createdAt" DESC
      OFFSET ${skip} LIMIT ${limit}
    `);

    const totalRows = await prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS total FROM (
        SELECT v."ventaId"
        FROM "Venta" v
        LEFT JOIN "ReconciliacionVenta" rv ON rv."ventaId" = v."ventaId"
        ${whereSql}
        GROUP BY v."ventaId", v."total"
        HAVING (COALESCE(v."total", 0) - COALESCE(SUM(
          CASE
            WHEN rv."moneda" = 'CUP' THEN rv."monto"
            WHEN rv."tasaCambio" IS NOT NULL AND rv."tasaCambio" > 0 THEN rv."monto" * rv."tasaCambio"
            ELSE rv."monto"
          END
        ), 0)) > 0.1
      ) AS pendientes
    `);

    const total = Number(totalRows[0]?.total || 0);
    const ventaIds = pendingRows.map((r) => r.ventaId);

    if (ventaIds.length === 0) {
      return {
        ventas: [],
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    }

    const ventasRaw = await prisma.venta.findMany({
      where: { ventaId: { in: ventaIds }, deletedAt: null },
      include: {
        cliente: { select: { nombre: true } },
        puntoDeVenta: { select: { nombre: true } },
      },
    });

    const pagosMap = new Map(
      pendingRows.map((r) => [r.ventaId, Number(r.totalPagado || 0)]),
    );
    const ventasMap = new Map(ventasRaw.map((v) => [v.ventaId, v]));

    const ventas = ventaIds
      .map((ventaId) => {
        const venta = ventasMap.get(ventaId);
        if (!venta) return null;
        const totalVenta = Number(venta.total || 0);
        const totalPagado = pagosMap.get(ventaId) || 0;
        return {
          ...venta,
          total: totalVenta,
          totalPagado,
          saldoPendiente: Math.max(0, totalVenta - totalPagado),
        };
      })
      .filter(Boolean);

    return {
      ventas,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async getSalesHistory(params: {
    tenantId: string;
    fechaInicio?: string | null;
    fechaFin?: string | null;
    cuentaId?: string | null;
  }) {
    const where: Record<string, unknown> = { tenantId: params.tenantId };
    if (params.cuentaId) where.cuentaId = params.cuentaId;
    if (params.fechaInicio || params.fechaFin) {
      const fechaReconciliacion: Record<string, Date> = {};
      if (params.fechaInicio) fechaReconciliacion.gte = new Date(params.fechaInicio);
      if (params.fechaFin) fechaReconciliacion.lte = new Date(params.fechaFin);
      where.fechaReconciliacion = fechaReconciliacion;
    }

    const reconciliaciones = await prisma.reconciliacionVenta.findMany({
      where,
      orderBy: { fechaReconciliacion: 'desc' },
      take: 100,
      include: {
        venta: { select: { ventaId: true, total: true } },
        cuentaBancaria: { select: { nombreBanco: true } },
        tipoPago: { select: { nombre: true } },
      },
    });

    const porMoneda = await prisma.reconciliacionVenta.groupBy({
      by: ['moneda'],
      where,
      _sum: { monto: true },
    });
    const porTipoDePago = await prisma.reconciliacionVenta.groupBy({
      by: ['tipoPagoId'],
      where,
      _sum: { monto: true },
    });

    return {
      reconciliaciones: reconciliaciones.map((r) => ({
        ...r,
        monto: Number(r.monto),
        tasaCambio: r.tasaCambio ? Number(r.tasaCambio) : null,
        montoConvertido: r.montoConvertido ? Number(r.montoConvertido) : null,
        venta: r.venta ? { ...r.venta, total: Number(r.venta.total) } : undefined,
      })),
      estadisticas: {
        montoTotal: reconciliaciones.reduce((s, r) => s + Number(r.monto), 0),
        montoConvertidoTotal: reconciliaciones.reduce(
          (s, r) => s + Number(r.montoConvertido ?? 0),
          0,
        ),
        porMoneda,
        porTipoDePago,
      },
      pagination: {},
    };
  },

  async reconcileSale({
    input,
    user,
    fxCatalogRateId,
  }: {
    input: {
      ventaId: string;
      cuentaId: string;
      tipoPagoId: string;
      monto: number;
      moneda?: string;
      tasaCambio?: number;
      fechaReconciliacion?: string;
      observaciones?: string;
    };
    user: AuthenticatedUser;
    fxCatalogRateId?: string | null;
  }) {
    const tenantId = requireTenant(user);
    requireFeature(user, 'contabilidad', 'reconciliar ventas');
    requirePermission(user, 'financiero.contabilidad.acceder', 'reconciliar ventas');
    validateSaleReconciliationInput(input);
    const fechaReconciliacion = input.fechaReconciliacion
      ? new Date(input.fechaReconciliacion)
      : new Date();
    if (Number.isNaN(fechaReconciliacion.getTime())) {
      throw new ActionError('Fecha de reconciliación inválida', 'VALIDATION_ERROR');
    }
    const moneda = input.moneda || 'CUP';
    const fechaEfectivaTasa = moneda.trim().toUpperCase() === 'CUP'
      ? fechaReconciliacion
      : input.fechaReconciliacion ? fechaReconciliacion : null;
    const conversion = buildPersistedAccountingAmount(
      input.monto,
      moneda,
      input.tasaCambio,
      fechaEfectivaTasa,
      fxCatalogRateId,
    );
    if (!conversion.fxEvidence || conversion.montoConvertido == null) {
      throw new ActionError('Falta evidencia de conversión para la venta', 'FX_INSUFICIENTE');
    }

    return prisma.$transaction(async (tx) => {
      await acquireAccountingTenantLock(tx, tenantId);
      const ventaPrevia = await tx.venta.findUnique({
        where: { ventaId: input.ventaId },
        select: { tenantId: true, deletedAt: true, clienteId: true },
      });
      if (!ventaPrevia || ventaPrevia.tenantId !== tenantId) {
        throw new ActionError('Venta no encontrada', 'NOT_FOUND');
      }
      if (ventaPrevia.deletedAt) {
        throw new ActionError('La venta ya está anulada', 'VALIDATION_ERROR');
      }
      if (ventaPrevia.clienteId) {
        await bloquearClienteCredito(tx, tenantId, ventaPrevia.clienteId);
      }
      await tx.$queryRaw`
        SELECT "ventaId" FROM "Venta"
        WHERE "ventaId" = ${input.ventaId} AND "tenantId" = ${tenantId}
        FOR UPDATE
      `;
      const venta = await tx.venta.findUnique({
        where: { ventaId: input.ventaId },
        select: {
          tenantId: true,
          deletedAt: true,
          factura: { select: { idFactura: true } },
        },
      });
      if (!venta || venta.tenantId !== tenantId) {
        throw new ActionError('Venta no encontrada', 'NOT_FOUND');
      }
      if (venta.deletedAt) {
        throw new ActionError('La venta ya está anulada', 'VALIDATION_ERROR');
      }

      const cuentaBancaria = await tx.cuentaBancaria.findFirst({
          where: { cuentaId: input.cuentaId, tenantId, isActive: true },
          select: { cuentaId: true, isActive: true, tipoCuenta: true },
      });
      if (!cuentaBancaria || !cuentaBancaria.isActive) {
        throw new ActionError('Cuenta bancaria no encontrada o inactiva', 'NOT_FOUND');
      }
      const tipoPago = await tx.tipoPago.findFirst({
        where: { tipoId: input.tipoPagoId, tenantId },
        select: { tipoId: true, isActive: true },
      });
      if (!tipoPago || !tipoPago.isActive) {
        throw new ActionError('Tipo de pago no encontrado o inactivo', 'NOT_FOUND');
      }

      const cuentaPorCobrar = await tx.cuentaPorCobrar.findFirst({
        where: {
          OR: [
            { facturaId: input.ventaId },
            ...(venta.factura?.idFactura ? [{ facturaId: venta.factura.idFactura }] : []),
          ],
          tenantId,
        },
        select: {
          idCC: true,
          montoDeuda: true,
          montoPagado: true,
          montoOriginal: true,
          montoDeudaFuncional: true,
          montoPagadoFuncional: true,
          monedaOriginal: true,
          monedaFuncional: true,
          tasaCambio: true,
          fxEvidenceFingerprint: true,
          fxEvidenceVersion: true,
          estado: true,
        },
      });
      if (cuentaPorCobrar?.estado === 'ANULADA') {
        throw new ActionError('La venta ya está anulada', 'VALIDATION_ERROR');
      }
      let diferenciaFx = new Prisma.Decimal(0);
      let actualizacionCxc: {
        idCC: number;
        data: {
          estado: 'PENDIENTE' | 'PARCIAL' | 'PAGADA';
          montoPagado: Prisma.Decimal;
          montoPagadoFuncional: Prisma.Decimal;
        };
      } | null = null;
      if (cuentaPorCobrar) {
        const reconciliacionesPrevias = await tx.reconciliacionVenta.findMany({
          where: { ventaId: input.ventaId, tenantId },
          select: {
            monto: true,
            moneda: true,
            montoConvertido: true,
            functionalCurrency: true,
            fxEvidenceFingerprint: true,
          },
        });
        const reconciliaciones = [
          ...reconciliacionesPrevias,
          {
            monto: new Prisma.Decimal(input.monto),
            moneda,
            montoConvertido: new Prisma.Decimal(conversion.montoConvertido!),
            functionalCurrency: conversion.fxEvidence!.functionalCurrency,
            fxEvidenceFingerprint: conversion.fxEvidence!.fxEvidenceFingerprint,
          },
        ];
        const monedaOriginal = cuentaPorCobrar.monedaOriginal?.trim().toUpperCase();
        const monedaFuncional = cuentaPorCobrar.monedaFuncional?.trim().toUpperCase();
        if (!monedaOriginal || !monedaFuncional) {
          throw new ActionError(
            'La cuenta por cobrar o sus cobros no tienen valoración FX homogénea verificable',
            'FX_INSUFICIENTE',
          );
        }
        if (moneda !== monedaOriginal) {
          throw new ActionError(
            'La cuenta por cobrar requiere valoración FX compatible con la moneda del cobro',
            'FX_INSUFICIENTE',
          );
        }
        if (reconciliaciones.some((rec) =>
          rec.moneda.trim().toUpperCase() !== monedaOriginal ||
          rec.functionalCurrency?.trim().toUpperCase() !== monedaFuncional ||
          rec.montoConvertido == null || !rec.fxEvidenceFingerprint)) {
          throw new ActionError(
            'La cuenta por cobrar o sus cobros no tienen valoración FX homogénea verificable',
            'FX_INSUFICIENTE',
          );
        }
        const montoPagado = reconciliaciones.reduce(
          (sum, rec) => sum.plus(rec.monto), new Prisma.Decimal(0),
        );
        const montoPagadoFuncional = reconciliaciones.reduce(
          (sum, rec) => sum.plus(rec.montoConvertido!), new Prisma.Decimal(0),
        );
        const montoPagadoPreviamente = reconciliacionesPrevias.reduce(
          (sum, rec) => sum.plus(rec.monto), new Prisma.Decimal(0),
        );
        diferenciaFx = this.calcularDiferenciaFxCxc(
          cuentaPorCobrar,
          moneda,
          montoPagadoPreviamente,
          montoPagado,
          conversion,
        );
        const montoDeuda = new Prisma.Decimal(cuentaPorCobrar.montoDeuda);
        if (montoPagado.gt(montoDeuda)) {
          throw new ActionError('El cobro excede el saldo nominal de la cuenta por cobrar', 'VALIDATION_ERROR');
        }
        const estado = montoPagado.gte(montoDeuda)
          ? 'PAGADA'
          : montoPagado.gt(0)
            ? 'PARCIAL'
            : 'PENDIENTE';
        actualizacionCxc = {
          idCC: cuentaPorCobrar.idCC,
          data: { estado, montoPagado, montoPagadoFuncional },
        };
      }

      const saldoActualizado = await tx.cuentaBancaria.updateMany({
        where: { cuentaId: input.cuentaId, tenantId },
        data: { saldo: { increment: input.monto } },
      });
      if (saldoActualizado.count !== 1) {
        throw new ActionError('Cuenta bancaria no encontrada', 'NOT_FOUND');
      }

      const reconciliacion = await tx.reconciliacionVenta.create({
        data: {
          ventaId: input.ventaId,
          cuentaId: input.cuentaId,
          tipoPagoId: input.tipoPagoId,
          monto: input.monto,
          moneda,
          montoConvertido: conversion.montoConvertido,
          tasaCambio: conversion.tasaCambio,
          ...conversion.fxEvidence,
          fechaReconciliacion,
          observaciones: input.observaciones,
          tenantId,
          reconciliadoPor: user.userId,
        },
      });
      if (
        reconciliacion.montoConvertido == null ||
        !reconciliacion.fxEvidenceFingerprint ||
        !reconciliacion.functionalCurrency
      ) {
        throw new ActionError('La reconciliación no conserva evidencia FX verificable', 'FX_INSUFICIENTE');
      }

      await postEvento(tx, { tenantId, userId: user.userId },
        (cuentaPorCobrar ? buildEventoCobroCxc : buildEventoVentaContado)({
          reconciliacionId: reconciliacion.reconciliacionId,
          descripcion: input.observaciones ?? undefined,
          fecha: reconciliacion.fechaReconciliacion,
          tesoreria: {
            monto: reconciliacion.monto,
            moneda: reconciliacion.moneda,
            montoFuncional: reconciliacion.montoConvertido,
            tasaCambio: reconciliacion.tasaCambio,
            fxEvidenceFingerprint: reconciliacion.fxEvidenceFingerprint,
            diferenciaFx,
            tipoCuenta: cuentaBancaria.tipoCuenta,
            monedaFuncionalCodigo: reconciliacion.functionalCurrency ?? 'CUP',
            referencia: `Venta ${input.ventaId}`,
          },
        }));

      if (actualizacionCxc) {
        await tx.cuentaPorCobrar.updateMany({
          where: { idCC: actualizacionCxc.idCC, tenantId },
          data: actualizacionCxc.data,
        });
      }

      return reconciliacion;
    });
  },

  /**
   * @description Calcula la diferencia FX de una liquidación CxC solo con snapshots homogéneos.
   * @param {object} cxc - Snapshot FX persistido en la cuenta por cobrar.
   * @param {string} monedaCobro - Moneda del cobro.
   * @param {number} montoCobro - Importe nominal del cobro.
   * @param {object} conversion - Conversión funcional persistida para el cobro.
   * @returns {Prisma.Decimal} Diferencia funcional favorable positiva o desfavorable negativa.
  */
  calcularDiferenciaFxCxc(
    cxc: {
      montoDeuda: Prisma.Decimal;
      montoOriginal: Prisma.Decimal | null;
      montoDeudaFuncional: Prisma.Decimal | null;
      monedaOriginal: string | null;
      monedaFuncional: string | null;
      tasaCambio: Prisma.Decimal | null;
      fxEvidenceFingerprint: string | null;
      fxEvidenceVersion: number | null;
    },
    monedaCobro: string,
    montoPagadoPreviamente: Prisma.Decimal,
    montoPagadoActual: Prisma.Decimal,
    conversion: ReturnType<typeof buildPersistedAccountingAmount>,
  ): Prisma.Decimal {
    const original = cxc.monedaOriginal?.trim().toUpperCase();
    const funcional = cxc.monedaFuncional?.trim().toUpperCase();
    if (
      !original || !funcional || !cxc.fxEvidenceFingerprint || cxc.fxEvidenceVersion == null ||
      cxc.montoOriginal == null || cxc.montoDeudaFuncional == null ||
      monedaCobro.trim().toUpperCase() !== original ||
      conversion.fxEvidence?.functionalCurrency.trim().toUpperCase() !== funcional ||
      conversion.montoConvertido == null
    ) {
      throw new ActionError(
        'La cuenta por cobrar requiere valoración FX compatible con la moneda del cobro',
        'FX_INSUFICIENTE',
      );
    }

    const tasaInicial = original === funcional
      ? new Prisma.Decimal(1)
      : cxc.tasaCambio == null
        ? null
        : new Prisma.Decimal(cxc.tasaCambio);
    const montoOriginal = cxc.montoOriginal == null
      ? null
      : new Prisma.Decimal(cxc.montoOriginal);
    const montoDeudaFuncional = cxc.montoDeudaFuncional == null
      ? null
      : new Prisma.Decimal(cxc.montoDeudaFuncional);
    const montoDeudaFuncionalCalculado = montoOriginal?.mul(tasaInicial ?? 0)
      .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
    if (
      tasaInicial == null || !tasaInicial.gt(0) ||
      montoOriginal == null || !montoOriginal.gt(0) ||
      montoDeudaFuncional == null || !montoDeudaFuncional.gt(0) ||
      !montoOriginal.eq(new Prisma.Decimal(cxc.montoDeuda)) ||
      !montoDeudaFuncionalCalculado?.eq(montoDeudaFuncional)
    ) {
      throw new ActionError('La cuenta por cobrar no tiene tasa de reconocimiento válida', 'FX_INSUFICIENTE');
    }
    const montoCobroFuncional = new Prisma.Decimal(conversion.montoConvertido)
      .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
    const valorEnLibrosAcumulado = (montoPrincipal: Prisma.Decimal) => {
      if (montoPrincipal.lte(0)) return new Prisma.Decimal(0);
      if (montoPrincipal.gte(montoOriginal)) return montoDeudaFuncional;
      return montoDeudaFuncional.mul(montoPrincipal).div(montoOriginal)
        .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
    };
    const montoCobradoAlValorEnLibros = valorEnLibrosAcumulado(montoPagadoActual)
      .minus(valorEnLibrosAcumulado(montoPagadoPreviamente));
    return montoCobroFuncional.minus(montoCobradoAlValorEnLibros);
  },

  async listPendingServices(params: {
    tenantId: string;
    fechaDesde?: string | null;
    fechaHasta?: string | null;
    page?: number;
    limit?: number;
  }) {
    const where: Record<string, unknown> = {
      tenantId: params.tenantId,
      reconciliado: null,
    };
    if (params.fechaDesde || params.fechaHasta) {
      const createdAt: Record<string, Date> = {};
      if (params.fechaDesde) createdAt.gte = new Date(params.fechaDesde);
      if (params.fechaHasta) createdAt.lte = new Date(params.fechaHasta);
      where.createdAt = createdAt;
    }
    const page = params.page || 1;
    const limit = params.limit || 50;

    const [ventaServicios, total] = await Promise.all([
      prisma.ventaServicios.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          cliente: { select: { nombre: true } },
          servicio: {
            select: { nombre: true, descripcion: true, precio: true, moneda: true },
          },
        },
      }),
      prisma.ventaServicios.count({ where }),
    ]);

    return {
      ventaServicios: ventaServicios.map((vs) => ({
        ...vs,
        servicio: vs.servicio ? { ...vs.servicio, precio: Number(vs.servicio.precio) } : undefined,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async getServicesHistory(params: {
    tenantId: string;
    fechaDesde?: string | null;
    fechaHasta?: string | null;
    cuentaId?: string | null;
  }) {
    const where: Record<string, unknown> = { tenantId: params.tenantId };
    if (params.cuentaId) where.cuentaId = params.cuentaId;
    if (params.fechaDesde || params.fechaHasta) {
      const fechaReconciliacion: Record<string, Date> = {};
      if (params.fechaDesde) fechaReconciliacion.gte = new Date(params.fechaDesde);
      if (params.fechaHasta) fechaReconciliacion.lte = new Date(params.fechaHasta);
      where.fechaReconciliacion = fechaReconciliacion;
    }

    const reconciliaciones = await prisma.reconciliacionServicio.findMany({
      where,
      orderBy: { fechaReconciliacion: 'desc' },
      take: 100,
      include: {
        ventasServicio: { select: { ventaServicioId: true } },
        cuentaBancaria: { select: { nombreBanco: true } },
        tipoPago: { select: { nombre: true } },
      },
    });

    return {
      reconciliaciones: reconciliaciones.map((r) => ({
        ...r,
        monto: Number(r.monto),
        tasaCambio: r.tasaCambio ? Number(r.tasaCambio) : null,
        montoConvertido: r.montoConvertido ? Number(r.montoConvertido) : null,
      })),
      estadisticas: {},
      pagination: {},
    };
  },

  async reconcileService({
    input,
    user,
  }: {
    input: {
      ventaServicioId: string;
      distribuciones: Array<{
        cuentaId: string;
        tipoPagoId: string;
          monto: number;
          moneda?: string;
           tasaCambio?: number;
           fechaTasa?: string;
        observaciones?: string;
      }>;
      fechaReconciliacion?: string;
    };
    user: AuthenticatedUser;
  }) {
    const tenantId = requireTenant(user);
    requireFeature(user, 'servicios', 'reconciliar servicios');
    requirePermission(user, 'financiero.contabilidad.acceder', 'reconciliar servicios');

    if (!input.distribuciones?.length) {
      throw new ActionError('Debe incluir al menos una distribución', 'INVALID_INPUT');
    }

    const fechaPreflight = input.fechaReconciliacion
      ? new Date(input.fechaReconciliacion)
      : new Date();
    if (Number.isNaN(fechaPreflight.getTime())) {
      throw new ActionError('Fecha de reconciliación inválida', 'VALIDATION_ERROR');
    }
    const tiposPagoPreflight = new Map<string, { requiereCuenta: boolean; cuentaDefecto: string | null }>();
    const saldosOrigenNecesarios = new Map<string, Prisma.Decimal>();
    for (const dist of input.distribuciones) {
      if (!Number.isFinite(dist.monto) || dist.monto <= 0) {
        throw new ActionError('El monto de cada distribución debe ser positivo', 'INVALID_INPUT');
      }
      if (!tiposPagoPreflight.has(dist.tipoPagoId)) {
        const tipoPago = await prisma.tipoPago.findFirst({
          where: { tipoId: dist.tipoPagoId, tenantId, isActive: true },
          select: { requiereCuenta: true, cuentaDefecto: true },
        });
        if (!tipoPago) {
          throw new ActionError('Cuenta o tipo de pago no encontrado', 'NOT_FOUND');
        }
        tiposPagoPreflight.set(dist.tipoPagoId, tipoPago);
      }

      const tipoPago = tiposPagoPreflight.get(dist.tipoPagoId)!;
      const cuentaOrigenId = tipoPago.requiereCuenta ? tipoPago.cuentaDefecto : null;
      if (!cuentaOrigenId || cuentaOrigenId === dist.cuentaId) continue;

      const fechaTasa = dist.fechaTasa
        ? new Date(dist.fechaTasa)
        : input.fechaReconciliacion ? fechaPreflight : null;
      if (fechaTasa && Number.isNaN(fechaTasa.getTime())) {
        throw new ActionError('Fecha de tasa inválida', 'VALIDATION_ERROR');
      }
      const conversion = buildPersistedAccountingAmount(
        dist.monto, dist.moneda || 'CUP', dist.tasaCambio, fechaTasa,
      );
      if (conversion.montoConvertido == null || !conversion.fxEvidence) {
        throw new ActionError('Falta evidencia de conversión para el servicio', 'FX_INSUFICIENTE');
      }
      const importeFuncional = new Prisma.Decimal(conversion.montoConvertido)
        .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
      saldosOrigenNecesarios.set(
        cuentaOrigenId,
        (saldosOrigenNecesarios.get(cuentaOrigenId) ?? new Prisma.Decimal(0))
          .plus(importeFuncional),
      );
    }

    for (const [cuentaOrigenId, importeNecesario] of saldosOrigenNecesarios) {
      const cuentaOrigen = await prisma.cuentaBancaria.findFirst({
        where: { cuentaId: cuentaOrigenId, tenantId, isActive: true },
        select: { saldo: true },
      });
      if (!cuentaOrigen) {
        throw new ActionError('Cuenta bancaria de origen no encontrada o inactiva', 'NOT_FOUND');
      }
      if (new Prisma.Decimal(cuentaOrigen.saldo).lt(importeNecesario)) {
        throw new ActionError('Saldo insuficiente en la cuenta de origen', 'SALDO_INSUFICIENTE');
      }
    }

    return prisma.$transaction(async (tx) => {
      await acquireAccountingTenantLock(tx, tenantId);
      const servicio = await tx.ventaServicios.findFirst({
        where: { ventaServicioId: input.ventaServicioId, tenantId },
        select: { total: true, reconciliado: true, clienteId: true },
      });
      if (!servicio) {
        throw new ActionError('Servicio no encontrado', 'NOT_FOUND');
      }
      if (servicio.reconciliado) {
        throw new ActionError('Servicio ya reconciliado', 'VALIDATION_ERROR');
      }
      if (servicio.clienteId) {
        await bloquearClienteCredito(tx, tenantId, servicio.clienteId);
      }

      const cxc = await tx.cuentaPorCobrar.findFirst({
        where: { tenantId, ventaServicioId: input.ventaServicioId },
        select: {
          idCC: true,
          montoDeuda: true,
          montoPagado: true,
          montoOriginal: true,
          montoDeudaFuncional: true,
          montoPagadoFuncional: true,
          monedaOriginal: true,
          monedaFuncional: true,
          tasaCambio: true,
          fxEvidenceFingerprint: true,
          fxEvidenceVersion: true,
          estado: true,
        },
      });
      if (cxc?.estado === 'ANULADA' || cxc?.estado === 'PAGADA') {
        throw new ActionError('La cuenta por cobrar no tiene saldo pendiente', 'VALIDATION_ERROR');
      }

      const fechaOperacion = input.fechaReconciliacion
        ? new Date(input.fechaReconciliacion)
        : new Date();
      if (Number.isNaN(fechaOperacion.getTime())) {
        throw new ActionError('Fecha de reconciliación inválida', 'VALIDATION_ERROR');
      }
      const distribuciones = input.distribuciones.map((dist) => {
        if (!Number.isFinite(dist.monto) || dist.monto <= 0) {
          throw new ActionError('El monto de cada distribución debe ser positivo', 'INVALID_INPUT');
        }
        const montoOriginal = new Prisma.Decimal(dist.monto);
        if (cxc && !montoOriginal.mul(10000).isInteger()) {
          throw new ActionError(
            'El importe nominal del cobro excede cuatro decimales',
            'VALIDATION_ERROR',
          );
        }
        const fecha = input.fechaReconciliacion ? fechaOperacion : new Date();
        const fechaTasa = dist.fechaTasa
          ? new Date(dist.fechaTasa)
          : (input.fechaReconciliacion ? fecha : null);
        let conversion = buildPersistedAccountingAmount(
          dist.monto, dist.moneda || 'CUP', dist.tasaCambio, fechaTasa,
        );
        if (cxc && conversion.montoConvertido != null && conversion.fxEvidence) {
          const montoFuncional = new Prisma.Decimal(conversion.montoConvertido)
            .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
          if (!montoFuncional.gt(0)) {
            throw new ActionError('El importe convertido es menor a la precisión funcional', 'INVALID_INPUT');
          }
          const fxEvidence = buildAppliedFxEvidence({
            originalAmount: dist.monto,
            originalCurrency: dist.moneda || 'CUP',
            functionalCurrency: conversion.fxEvidence.functionalCurrency,
            exchangeRate: conversion.tasaCambio,
            convertedAmount: montoFuncional.toNumber(),
            rateEffectiveAt: fechaTasa,
            source: conversion.fxEvidence.fxProvenanceSource,
            fxCatalogRateId: conversion.fxEvidence.fxCatalogRateId,
          });
          conversion = {
            montoConvertido: montoFuncional.toNumber(),
            tasaCambio: conversion.tasaCambio,
            fxEvidence: {
              functionalCurrency: fxEvidence.functionalCurrency,
              ...(fechaTasa ? { rateEffectiveAt: fechaTasa } : {}),
              fxProvenanceKind: fxEvidence.fxProvenanceKind,
              fxProvenanceSource: fxEvidence.fxProvenanceSource,
              fxCatalogRateId: fxEvidence.fxCatalogRateId,
              fxEvidenceFingerprint: fxEvidence.fxEvidenceFingerprint,
              fxEvidenceVersion: fxEvidence.fxEvidenceVersion,
            } as NonNullable<typeof conversion.fxEvidence>,
          };
        }
        if (!conversion.fxEvidence || conversion.montoConvertido == null) {
          throw new ActionError('Falta evidencia de conversión para el servicio', 'FX_INSUFICIENTE');
        }
        return { dist, fecha, conversion };
      });
      const montoTotalDistribuido = distribuciones.reduce(
        (sum, { dist }) => sum.plus(new Prisma.Decimal(dist.monto)),
        new Prisma.Decimal(0),
      );

      const precioServicio = new Prisma.Decimal(servicio.total);

      if (!cxc && montoTotalDistribuido.minus(precioServicio).abs().gt('0.01')) {
        throw new ActionError(
          `El monto total distribuido (${montoTotalDistribuido.toFixed(2)}) debe ser igual al precio del servicio (${precioServicio.toFixed(2)})`,
          'VALIDATION_ERROR',
        );
      }

      let cxcActualizacion: {
        idCC: number;
        montoPagado: Prisma.Decimal;
        montoPagadoFuncional: Prisma.Decimal;
        estado: 'PENDIENTE' | 'PARCIAL' | 'PAGADA';
        completa: boolean;
        diferenciasFx: Prisma.Decimal[];
      } | null = null;
      if (cxc) {
        const monedaOriginal = cxc.monedaOriginal?.trim().toUpperCase();
        const monedaFuncional = cxc.monedaFuncional?.trim().toUpperCase();
        if (!monedaOriginal || !monedaFuncional) {
          throw new ActionError('La cuenta por cobrar no tiene valoración FX verificable', 'FX_INSUFICIENTE');
        }
        const cobrosPrevios = await tx.reconciliacionServicio.findMany({
          where: { tenantId, ventaServicioId: input.ventaServicioId },
          select: {
            monto: true,
            moneda: true,
            montoConvertido: true,
            functionalCurrency: true,
            fxEvidenceFingerprint: true,
            fxEvidenceVersion: true,
          },
        });
        // La aplicación de un anticipo ya pagó parte de la obligación, pero no
        // es otro cobro bancario. Su movimiento persistido es la fuente del pago.
        const aplicaciones = await tx.anticipoMovimiento.findMany({
          where: { documentoDestinoId: input.ventaServicioId,
            contexto: 'FACTURA_DIRECTA', tipoMovimiento: 'EJECUCION',
            anticipo: { tenantId, tipo: 'COBRO' } },
          include: { anticipo: { select: {
            anticipoId: true, fxSnapshot: true, montoOriginal: true, moneda: true,
          } } },
        });
        const pagosAnticipo = aplicaciones.map((movimiento) => {
          const applied = valueAnticipoApplication(movimiento.anticipo.fxSnapshot,
            new Prisma.Decimal(movimiento.anticipo.montoOriginal),
            movimiento.anticipo.moneda, new Prisma.Decimal(movimiento.monto));
          const stored = movimiento.fxSnapshot;
          if (!stored || typeof stored !== 'object' || Array.isArray(stored) ||
            stored.fxEvidenceFingerprint !== applied.fxEvidenceFingerprint ||
            movimiento.montoConvertido == null ||
            !new Prisma.Decimal(movimiento.montoConvertido).eq(applied.functionalAmount)) {
            throw new ActionError('La aplicación no conserva una valoración verificable',
              'FX_INSUFICIENTE');
          }
          return { monto: movimiento.monto, moneda: movimiento.moneda,
            montoConvertido: new Prisma.Decimal(applied.functionalAmount),
            functionalCurrency: applied.functionalCurrency,
            fxEvidenceFingerprint: applied.fxEvidenceFingerprint,
            fxEvidenceVersion: applied.fxEvidenceVersion };
        });
        const reconciliacionesPrevias = [...cobrosPrevios, ...pagosAnticipo];
        if (reconciliacionesPrevias.some((rec) =>
          rec.moneda.trim().toUpperCase() !== monedaOriginal ||
          rec.functionalCurrency?.trim().toUpperCase() !== monedaFuncional ||
          rec.montoConvertido == null || !rec.fxEvidenceFingerprint ||
          rec.fxEvidenceVersion == null)) {
          throw new ActionError(
            'La cuenta por cobrar o sus cobros no tienen valoración FX homogénea verificable',
            'FX_INSUFICIENTE',
          );
        }
        if (distribuciones.some(({ dist, conversion }) =>
          (dist.moneda || 'CUP').trim().toUpperCase() !== monedaOriginal ||
          conversion.fxEvidence?.functionalCurrency.trim().toUpperCase() !== monedaFuncional)) {
          throw new ActionError(
            'La cuenta por cobrar requiere valoración FX compatible con la moneda del cobro',
            'FX_INSUFICIENTE',
          );
        }

        const montoPagadoPreviamente = reconciliacionesPrevias.reduce(
          (sum, rec) => sum.plus(rec.monto), new Prisma.Decimal(0),
        );
        const montoPagadoFuncionalPreviamente = reconciliacionesPrevias.reduce(
          (sum, rec) => sum.plus(rec.montoConvertido!), new Prisma.Decimal(0),
        );
        const montoPagadoPersistido = new Prisma.Decimal(cxc.montoPagado);
        const montoPagadoFuncionalPersistido = cxc.montoPagadoFuncional == null
          ? null
          : new Prisma.Decimal(cxc.montoPagadoFuncional);
        if (
          !montoPagadoPersistido.eq(montoPagadoPreviamente) ||
          (reconciliacionesPrevias.length === 0 &&
            montoPagadoFuncionalPersistido != null &&
            !montoPagadoFuncionalPersistido.isZero()) ||
          (reconciliacionesPrevias.length > 0 &&
            (montoPagadoFuncionalPersistido == null ||
              !montoPagadoFuncionalPersistido.eq(montoPagadoFuncionalPreviamente)))
        ) {
          throw new ActionError(
            'El saldo pagado de la cuenta por cobrar no coincide con sus cobros verificables',
            'FX_INSUFICIENTE',
          );
        }

        const montoDeuda = new Prisma.Decimal(cxc.montoDeuda);
        const montoPagado = montoPagadoPreviamente.plus(montoTotalDistribuido);
        if (montoPagado.gt(montoDeuda)) {
          throw new ActionError('El cobro excede el saldo nominal de la cuenta por cobrar', 'VALIDATION_ERROR');
        }
        const conversionFuncionalActual = distribuciones.reduce(
          (sum, { conversion }) => sum.plus(conversion.montoConvertido!),
          new Prisma.Decimal(0),
        );
        const montoPagadoFuncional = montoPagadoFuncionalPreviamente.plus(conversionFuncionalActual);
        let saldoNominalAcumulado = montoPagadoPreviamente;
        const diferenciasFx = distribuciones.map(({ dist, conversion }) => {
          const saldoNominalAnterior = saldoNominalAcumulado;
          saldoNominalAcumulado = saldoNominalAcumulado.plus(new Prisma.Decimal(dist.monto));
          return this.calcularDiferenciaFxCxc(
            cxc,
            dist.moneda || 'CUP',
            saldoNominalAnterior,
            saldoNominalAcumulado,
            conversion,
          );
        });
        const completa = montoPagado.gte(montoDeuda);
        cxcActualizacion = {
          idCC: cxc.idCC,
          montoPagado,
          montoPagadoFuncional,
          estado: completa ? 'PAGADA' : montoPagado.gt(0) ? 'PARCIAL' : 'PENDIENTE',
          completa,
          diferenciasFx,
        };
      }

      for (const [index, { dist, fecha, conversion }] of distribuciones.entries()) {
        const cuenta = await tx.cuentaBancaria.findFirst({
          where: { cuentaId: dist.cuentaId, tenantId, isActive: true },
          select: { tipoCuenta: true },
        });
        const tipoPago = await tx.tipoPago.findFirst({
          where: { tipoId: dist.tipoPagoId, tenantId, isActive: true },
          select: { tipoId: true, requiereCuenta: true, cuentaDefecto: true },
        });
        if (!cuenta || !tipoPago) {
          throw new ActionError('Cuenta o tipo de pago no encontrado', 'NOT_FOUND');
        }
        const importeFuncional = new Prisma.Decimal(conversion.montoConvertido!);
        const cuentaOrigenId = tipoPago.requiereCuenta ? tipoPago.cuentaDefecto : null;
        if (cuentaOrigenId && cuentaOrigenId !== dist.cuentaId) {
          const debitoOrigen = await tx.cuentaBancaria.updateMany({
            where: {
              cuentaId: cuentaOrigenId,
              tenantId,
              isActive: true,
              saldo: { gte: importeFuncional.toNumber() },
            },
            data: { saldo: { decrement: importeFuncional.toNumber() } },
          });
          if (debitoOrigen.count !== 1) {
            throw new ActionError('Saldo insuficiente en la cuenta de origen', 'SALDO_INSUFICIENTE');
          }
        }
        const saldo = await tx.cuentaBancaria.updateMany({
          where: { cuentaId: dist.cuentaId, tenantId, isActive: true },
          data: { saldo: { increment: importeFuncional.toNumber() } },
        });
        if (saldo.count !== 1) {
          throw new ActionError('Cuenta bancaria no encontrada', 'NOT_FOUND');
        }

        const reconciliacion = await tx.reconciliacionServicio.create({
          data: {
            ventaServicioId: input.ventaServicioId,
            cuentaId: dist.cuentaId,
            tipoPagoId: dist.tipoPagoId,
            monto: dist.monto,
            moneda: dist.moneda || 'CUP',
            montoConvertido: conversion.montoConvertido,
            tasaCambio: conversion.tasaCambio,
            ...conversion.fxEvidence,
            fechaReconciliacion: fecha,
            observaciones: dist.observaciones,
            tenantId,
            reconciliadoPor: user.userId,
          },
        });
        if (reconciliacion.montoConvertido == null) {
          throw new ActionError('Falta evidencia de conversión para el servicio', 'FX_INSUFICIENTE');
        }
        if (cxcActualizacion &&
          (!reconciliacion.fxEvidenceFingerprint || !reconciliacion.functionalCurrency ||
            reconciliacion.fxEvidenceVersion == null)) {
          throw new ActionError('Falta evidencia de conversión para el servicio', 'FX_INSUFICIENTE');
        }
        if (!cxcActualizacion && reconciliacion.moneda !== 'CUP' &&
          (!reconciliacion.fxEvidenceFingerprint || !reconciliacion.tasaCambio)) {
          throw new ActionError('Falta evidencia de conversión para el servicio', 'FX_INSUFICIENTE');
        }
        const evento = buildEventoServicio({
          cobro: true,
          reconciliacionId: reconciliacion.reconciliacionId,
          fecha: reconciliacion.fechaReconciliacion,
          tesoreria: {
            monto: reconciliacion.monto,
            moneda: reconciliacion.moneda,
            montoFuncional: reconciliacion.montoConvertido,
            tasaCambio: reconciliacion.tasaCambio,
            fxEvidenceFingerprint: reconciliacion.fxEvidenceFingerprint,
            ...(cxcActualizacion ? { diferenciaFx: cxcActualizacion.diferenciasFx[index] } : {}),
            tipoCuenta: cuenta.tipoCuenta,
          },
        });
        await postEvento(tx, { tenantId, userId: user.userId }, cxcActualizacion
          ? {
            ...evento,
            auxiliares: {
              ...(evento.auxiliares ?? {}),
              diferenciaFx: cxcActualizacion.diferenciasFx[index],
            },
          }
          : evento);
      }

      if (cxcActualizacion) {
        const actualizadoCxc = await tx.cuentaPorCobrar.updateMany({
          where: { idCC: cxcActualizacion.idCC, tenantId },
          data: {
            montoPagado: cxcActualizacion.montoPagado,
            montoPagadoFuncional: cxcActualizacion.montoPagadoFuncional,
            estado: cxcActualizacion.estado,
          },
        });
        if (actualizadoCxc.count !== 1) {
          throw new ActionError('Cuenta por cobrar no encontrada', 'NOT_FOUND');
        }
      }

      const completa = !cxcActualizacion || cxcActualizacion.completa;
      if (completa) {
        const actualizado = await tx.ventaServicios.updateMany({
          where: {
            ventaServicioId: input.ventaServicioId,
            tenantId,
            OR: [{ reconciliado: null }, { reconciliado: false }],
          },
          data: { reconciliado: true },
        });
        if (actualizado.count !== 1) {
          throw new ActionError('Servicio ya reconciliado', 'VALIDATION_ERROR');
        }
      }

      return { reconciliado: completa, distribuciones: input.distribuciones.length };
    });
  },

  async listPendingExpenses(params: {
    tenantId: string;
    fechaDesde?: string | null;
    fechaHasta?: string | null;
    tipoGasto?: string | null;
    soloNoReconciliados?: boolean;
    page?: number;
    limit?: number;
  }) {
    const whereDE: Record<string, any> = { tenantId: params.tenantId };
    if (params.soloNoReconciliados) whereDE.reconciliaciones = { none: {} };
    if (params.fechaDesde || params.fechaHasta) {
      whereDE.createdAt = {};
      if (params.fechaDesde) whereDE.createdAt.gte = new Date(params.fechaDesde);
      if (params.fechaHasta) whereDE.createdAt.lte = new Date(params.fechaHasta);
    }

    const whereGC: Record<string, any> = { tenantId: params.tenantId, deletedAt: null };
    if (params.soloNoReconciliados) whereGC.reconciliaciones = { none: {} };
    if (params.fechaDesde || params.fechaHasta) {
      whereGC.fechaCompra = {};
      if (params.fechaDesde) whereGC.fechaCompra.gte = new Date(params.fechaDesde);
      if (params.fechaHasta) whereGC.fechaCompra.lte = new Date(params.fechaHasta);
    }

    const wherePS: Record<string, any> = { tenantId: params.tenantId };
    if (params.soloNoReconciliados) wherePS.ReconciliacionGasto = { none: {} };
    if (params.fechaDesde || params.fechaHasta) {
      wherePS.createdAt = {};
      if (params.fechaDesde) wherePS.createdAt.gte = new Date(params.fechaDesde);
      if (params.fechaHasta) wherePS.createdAt.lte = new Date(params.fechaHasta);
    }

    const whereCS: Record<string, any> = { tenantId: params.tenantId };
    if (params.fechaDesde || params.fechaHasta) {
      whereCS.fechaServicio = {};
      if (params.fechaDesde) whereCS.fechaServicio.gte = new Date(params.fechaDesde);
      if (params.fechaHasta) whereCS.fechaServicio.lte = new Date(params.fechaHasta);
    }

    const whereVS: Record<string, any> = { tenantId: params.tenantId, costo: { gt: 0 } };
    if (params.fechaDesde || params.fechaHasta) {
      whereVS.createdAt = {};
      if (params.fechaDesde) whereVS.createdAt.gte = new Date(params.fechaDesde);
      if (params.fechaHasta) whereVS.createdAt.lte = new Date(params.fechaHasta);
    }

    const page = params.page || 1;
    const limit = params.limit || 50;

    const [
      gastosDE,
      gastosCompra,
      pagosSalario,
      comprasServicio,
      ventasServicio,
      reconciliadosServicioIds,
      reconciliadosVentaServicioIds,
    ] = await Promise.all([
      prisma.gastosDE.findMany({
        where: whereDE,
        orderBy: { createdAt: 'desc' },
        include: { reconciliaciones: { select: { reconciliacionId: true } } },
      }),
      prisma.gastoCompra.findMany({
        where: whereGC,
        orderBy: { fechaCompra: 'desc' },
        include: {
          reconciliaciones: { select: { reconciliacionId: true } },
          vendor: { select: { nombre: true } },
          producto: { select: { nombre: true } },
        },
      }),
      prisma.pagosalario.findMany({
        where: wherePS,
        orderBy: { createdAt: 'desc' },
        include: {
          ReconciliacionGasto: { select: { reconciliacionId: true } },
          empleado: { select: { nombre: true, apellido: true, cargo: true } },
        },
      }),
      prisma.compraServicio.findMany({
        where: whereCS,
        orderBy: { fechaServicio: 'desc' },
        include: {
          servicio: { select: { nombre: true } },
          proveedor: { select: { nombre: true } },
        },
      }),
      prisma.ventaServicios.findMany({
        where: whereVS,
        orderBy: { createdAt: 'desc' },
        include: {
          servicio: { select: { nombre: true } },
          cliente: { select: { nombre: true } },
        },
      }),
      params.soloNoReconciliados
        ? prisma.reconciliacionGasto
            .findMany({
              where: { tenantId: params.tenantId, tipoGasto: 'servicio' },
              select: { referenciaId: true },
              distinct: ['referenciaId'],
            })
            .then((r) => r.map((x) => x.referenciaId))
        : Promise.resolve([] as string[]),
      params.soloNoReconciliados
        ? prisma.reconciliacionGasto
            .findMany({
              where: { tenantId: params.tenantId, tipoGasto: 'venta_servicio' },
              select: { referenciaId: true },
              distinct: ['referenciaId'],
            })
            .then((r) => r.map((x) => x.referenciaId))
        : Promise.resolve([] as string[]),
    ]);

    const comprasServicioFiltradas = params.soloNoReconciliados
      ? comprasServicio.filter((g: any) => !reconciliadosServicioIds.includes(g.compraServicioId))
      : comprasServicio;

    const ventasServicioFiltradas = params.soloNoReconciliados
      ? ventasServicio.filter((g: any) => !reconciliadosVentaServicioIds.includes(g.ventaServicioId))
      : ventasServicio;

    const gastos = [
      ...gastosDE.map((g: any) => ({
        tipo: 'gastoDE' as const,
        referenciaId: g.gastosDEId,
        descripcion: g.descripcion || `Gasto DE #${g.gastosDEId.slice(0, 8)}`,
        monto: Number(g.monto || g.total || 0),
        periodo: g.periodo || undefined,
        detalles: {
          proveedor: g.proveedor || undefined,
          descripcionOriginal: g.descripcion || undefined,
          isPagado: g.isPagado || undefined,
        },
        createdAt: g.createdAt.toISOString(),
        updatedAt: g.updatedAt.toISOString(),
      })),
      ...gastosCompra.map((g: any) => ({
        tipo: 'compra' as const,
        referenciaId: g.gastoCompraId,
        descripcion: g.descripcion || `Compra #${g.gastoCompraId.slice(0, 8)}`,
        monto: Number(g.total || 0),
        periodo: g.periodo || undefined,
        detalles: {
          vendor: g.vendor?.nombre || undefined,
          producto: g.producto?.nombre || undefined,
          cantidad: g.cantidad || undefined,
          precioUnitario: g.precioUnitario || undefined,
          fechaCompra: g.fechaCompra?.toISOString() || undefined,
        },
        createdAt: g.createdAt.toISOString(),
        updatedAt: g.updatedAt.toISOString(),
      })),
      ...pagosSalario.map((g: any) => ({
        tipo: 'salario' as const,
        referenciaId: g.pgId,
        descripcion:
          `Salario de ${g.empleado?.nombre || ''} ${g.empleado?.apellido || ''}`.trim() ||
          `Pago #${g.pgId.slice(0, 8)}`,
        monto: getPayrollPaymentAmount({
          salario: Number(g.salario || 0),
          bonificaciones: Number(g.bonificaciones || 0),
          deducciones: Number(g.deducciones || 0),
          montoHorasExtras: Number(g.montoHorasExtras || 0),
        }),
        periodo: g.periodo || undefined,
        detalles: {
          empleado: g.empleado
            ? {
                nombre: g.empleado.nombre,
                apellido: g.empleado.apellido,
                cargo: g.empleado.cargo,
              }
            : undefined,
          salarioBases: g.salario || undefined,
          bonificaciones: g.bonificaciones || undefined,
          deducciones: g.deducciones || undefined,
          horasExtras: (g.horasExtrasHoras ?? g.horasExtras) || undefined,
          montoHorasExtras: g.montoHorasExtras || undefined,
        },
        createdAt: g.createdAt.toISOString(),
        updatedAt: g.updatedAt.toISOString(),
      })),
      ...comprasServicioFiltradas.map((g: any) => ({
        tipo: 'servicio' as const,
        referenciaId: g.compraServicioId,
        descripcion: `${g.servicio?.nombre || 'Servicio'} - ${g.proveedor?.nombre || 'Sin proveedor'}`,
        monto: Number(g.total || 0),
        periodo: undefined,
        detalles: {
          servicio: g.servicio?.nombre || undefined,
          proveedorNombre: g.proveedor?.nombre || undefined,
          cantidad: g.cantidad || undefined,
          costoUnitario: g.costoUnitario || undefined,
          numeroFactura: g.numeroFactura || undefined,
        },
        createdAt: g.fechaServicio?.toISOString?.() || g.createdAt?.toISOString?.() || new Date().toISOString(),
        updatedAt: g.updatedAt?.toISOString?.() || new Date().toISOString(),
      })),
      ...ventasServicioFiltradas.map((g: any) => ({
        tipo: 'venta_servicio' as const,
        referenciaId: g.ventaServicioId,
        descripcion: `Costo: ${g.servicio?.nombre || 'Servicio'} - ${g.cliente?.nombre || 'Sin cliente'}`,
        monto: Number(g.costo * g.cantidad || 0),
        periodo: g.createdAt?.toISOString?.()?.slice(0, 7) || undefined,
        detalles: {
          servicio: g.servicio?.nombre || undefined,
          clienteNombre: g.cliente?.nombre || undefined,
          cantidad: g.cantidad || undefined,
          costoUnitario: g.costo || undefined,
        },
        createdAt: g.createdAt?.toISOString?.() || new Date().toISOString(),
        updatedAt: g.updatedAt?.toISOString?.() || new Date().toISOString(),
      })),
    ]
      .filter((gasto) => !params.tipoGasto || gasto.tipo === params.tipoGasto)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = gastos.length;
    const paginated = gastos.slice((page - 1) * limit, page * limit);

    return {
      gastos: paginated,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async getExpensesHistory(params: {
    tenantId: string;
    tipoGasto?: string | null;
    cuentaId?: string | null;
    fechaDesde?: string | null;
    fechaHasta?: string | null;
    periodo?: string | null;
    reconciliadoPor?: string | null;
    page?: number;
    limit?: number;
  }) {
    const whereClause: Record<string, any> = { tenantId: params.tenantId };
    if (params.tipoGasto) whereClause.tipoGasto = params.tipoGasto;
    if (params.cuentaId) whereClause.cuentaId = params.cuentaId;
    if (params.periodo) whereClause.periodo = params.periodo;
    if (params.reconciliadoPor) whereClause.reconciliadoPor = params.reconciliadoPor;
    if (params.fechaDesde || params.fechaHasta) {
      whereClause.fechaReconciliacion = {};
      if (params.fechaDesde) whereClause.fechaReconciliacion.gte = new Date(params.fechaDesde);
      if (params.fechaHasta) whereClause.fechaReconciliacion.lte = new Date(params.fechaHasta);
    }

    const page = params.page || 1;
    const limit = params.limit || 50;
    const skip = (page - 1) * limit;

    const [reconciliaciones, total] = await Promise.all([
      prisma.reconciliacionGasto.findMany({
        where: whereClause,
        include: {
          cuentaBancaria: {
            select: {
              cuentaId: true,
              nombreBanco: true,
              numeroCuenta: true,
              tipoCuenta: true,
              moneda: true,
            },
          },
          tipoPago: {
            select: { tipoId: true, nombre: true, descripcion: true },
          },
          pagoSalario: {
            include: {
              empleado: {
                select: {
                  empleadoId: true,
                  nombre: true,
                  apellido: true,
                  cargo: true,
                },
              },
            },
          },
          gastoDE: {
            select: {
              gastosDEId: true,
              tipo: true,
              proveedor: true,
              monto: true,
              periodo: true,
            },
          },
          gastoCompra: {
            select: {
              gastoCompraId: true,
              cantidad: true,
              precioUnitario: true,
              total: true,
              fechaCompra: true,
              producto: { select: { nombre: true } },
              vendor: { select: { nombre: true } },
            },
          },
        },
        orderBy: { fechaReconciliacion: 'desc' },
        skip,
        take: limit,
      }),
      prisma.reconciliacionGasto.count({ where: whereClause }),
    ]);

    const estadisticas = await prisma.reconciliacionGasto.groupBy({
      by: ['tipoGasto', 'moneda'],
      where: whereClause,
      _sum: { monto: true, montoConvertido: true },
      _count: { reconciliacionId: true },
    });

    return {
      reconciliaciones: reconciliaciones.map((r) => ({
        ...r,
        monto: Number(r.monto),
        tasaCambio: r.tasaCambio ? Number(r.tasaCambio) : null,
        montoConvertido: r.montoConvertido ? Number(r.montoConvertido) : null,
      })),
      estadisticas,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },
};
