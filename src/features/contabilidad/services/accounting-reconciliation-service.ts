import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ActionError } from '@/lib/server-actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { requireTenant } from '@/lib/services/tenant-scope';
import { Prisma } from '@/generated/prisma';
import { buildAppliedFxEvidence } from '@/features/contabilidad/domain/fx-evidence';
import { getPayrollPaymentAmount } from '@/features/pago-salario/payroll-amounts';
import { guardAccountingWriteInTransaction } from './period-close-write-guard';

interface ServiceCollectionInput {
  ventaServicioId: string;
  distribuciones: Array<{
    cuentaId: string;
    tipoPagoId: string;
    monto: number;
    moneda?: string;
    tasaCambio?: number;
    observaciones?: string;
  }>;
  fechaReconciliacion?: string;
}

const serviceCollectionSchema = z.object({
  ventaServicioId: z.string().trim().min(1),
  distribuciones: z.array(z.object({
    cuentaId: z.string().trim().min(1),
    tipoPagoId: z.string().trim().min(1),
    monto: z.number().finite().positive(),
    moneda: z.string().trim().min(1).optional(),
    tasaCambio: z.number().finite().positive().optional(),
    observaciones: z.string().optional(),
  })).min(1),
  fechaReconciliacion: z.string().refine((value) =>
    value.trim().length > 0 && Number.isFinite(new Date(value).getTime()),
  ).optional(),
});

/**
 * @description Rechaza datos de cobro inválidos antes de adquirir locks o escribir saldos.
 * @param {unknown} input - Payload recibido desde web o integraciones.
 * @returns {void} Continúa solo si identificadores, importes y fecha son válidos.
 */
export function validateServiceCollectionInput(input: unknown): asserts input is ServiceCollectionInput {
  if (!serviceCollectionSchema.safeParse(input).success) {
    throw new ActionError('Datos de cobro de servicio inválidos', 'INVALID_INPUT');
  }
}

/**
 * @description Valida pertenencia tenant y cobro único bajo el lock del documento.
 * @param {Prisma.TransactionClient} tx - Transacción con locks contable y de documento adquiridos.
 * @param {string} tenantId - Tenant autenticado, nunca recibido desde el payload.
 * @param {ServiceCollectionInput} input - Cobro ya validado estructuralmente.
 * @returns {Promise<number>} Total persistido de la venta autorizada y pendiente.
 */
export async function assertServiceCollectionTargets(
  tx: Prisma.TransactionClient,
  tenantId: string,
  input: ServiceCollectionInput,
): Promise<number> {
  const sale = await tx.ventaServicios.findFirst({
    where: { ventaServicioId: input.ventaServicioId, tenantId },
    select: { total: true, reconciliado: true },
  });
  if (!sale) throw new ActionError('Servicio no encontrado', 'NOT_FOUND');
  const existing = await tx.reconciliacionServicio.findFirst({
    where: { ventaServicioId: input.ventaServicioId, tenantId },
    select: { reconciliacionId: true },
  });
  if (sale.reconciliado || existing) {
    throw new ActionError('El servicio ya está reconciliado', 'ALREADY_RECONCILED');
  }
  const accountIds = [...new Set(input.distribuciones.map((item) => item.cuentaId))];
  const paymentIds = [...new Set(input.distribuciones.map((item) => item.tipoPagoId))];
  const [accounts, payments] = await Promise.all([
    tx.cuentaBancaria.count({ where: { tenantId, cuentaId: { in: accountIds } } }),
    tx.tipoPago.count({ where: { tenantId, tipoId: { in: paymentIds } } }),
  ]);
  if (accounts !== accountIds.length || payments !== paymentIds.length) {
    throw new ActionError('Cuenta bancaria o tipo de pago no encontrado', 'NOT_FOUND');
  }
  return Number(sale.total);
}

/**
 * @description Construye los metadatos de conversión y la evidencia FX que se guardan junto a
 * una reconciliación. Para moneda extranjera exige tasa válida y fecha efectiva explícita;
 * nunca fabrica evidencia ausente.
 * @param {number} amount - Importe en la moneda de origen.
 * @param {string} currency - Moneda del importe.
 * @param {number | undefined} exchangeRate - Tasa aplicada hacia la moneda funcional.
 * @param {Date | null | undefined} effectiveAt - Fecha en que se aplicó la tasa informada.
 * @param {string | null | undefined} fxCatalogRateId - ID de la tasa usada, si está catalogada.
 * @param {string} functionalCurrency - Moneda funcional de destino.
 * @returns {{montoConvertido: number | null; tasaCambio: number | null; fxEvidence: object | null}} Metadatos y evidencia inmutable.
 */
export function buildPersistedAccountingAmount(
  amount: number,
  currency: string,
  exchangeRate?: number,
  effectiveAt?: Date | null,
  fxCatalogRateId?: string | null,
  functionalCurrency = 'CUP',
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
  const normalizedCurrency = currency.trim().toUpperCase();
  const normalizedFunctionalCurrency = functionalCurrency.trim().toUpperCase();

  if (normalizedCurrency === normalizedFunctionalCurrency) {
    const evidence = buildAppliedFxEvidence({
      originalAmount: amount,
      originalCurrency: currency,
      functionalCurrency: normalizedFunctionalCurrency,
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
      functionalCurrency: normalizedFunctionalCurrency,
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
 * @description Toma el advisory lock transaccional del documento de una venta
 * de servicio. Lo deben tomar, dentro de su transacción, todo writer que
 * emite la factura de la venta (`facturarVentaServicioAction`) y todo writer
 * que cierra sus documentos al cobrar (`cerrarDocumentoServicio`): serializa
 * facturación vs cobro/anulación para que ninguna de las dos opere sobre un
 * estado obsoleto de la venta, la factura o la CxC.
 * @param {Pick<Prisma.TransactionClient, '$executeRaw'>} tx - Transacción del writer.
 * @param {string} ventaServicioId - Venta de servicio documento/cobro.
 * @returns {Promise<void>} El lock se mantiene hasta el fin de la transacción.
 */
export async function lockDocumentoServicio(
  tx: Pick<Prisma.TransactionClient, '$executeRaw'>,
  ventaServicioId: string,
): Promise<void> {
  const lockIdentity = JSON.stringify(['venta-servicio-doc', ventaServicioId]);
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${lockIdentity}, 0))
  `;
}

/**
 * @description Cierra el ciclo del documento de una venta de servicio cobrada
 * (C-6): la Factura emitida y la CxC enlazada pasan a PAGADA. Condicional —
 * si no hay documento ni CxC, no toca nada. Las escrituras son claims
 * (`updateMany` filtrando por estado): si la factura o la CxC fue anulada
 * concurrentemente, la transacción no la resurrecta ni la sobre-escribe; si
 * ya estaba PAGADA, no hay nada que hacer. Debe llamarse dentro de la
 * transacción del writer de cobro (action web o servicio compartido móvil).
 * @param {Pick<Prisma.TransactionClient, 'factura' | 'cuentaPorCobrar' | '$executeRaw'>} tx - Transacción del writer.
 * @param {string} ventaServicioId - Venta de servicio cobrada.
 */
export async function cerrarDocumentoServicio(
  tx: Pick<Prisma.TransactionClient, 'factura' | 'cuentaPorCobrar' | '$executeRaw'>,
  ventaServicioId: string,
): Promise<void> {
  await lockDocumentoServicio(tx, ventaServicioId);
  const facturaServicio = await tx.factura.findFirst({
    where: { ventaServicioId, estado: 'PENDIENTE' },
    select: { idFactura: true },
  });
  if (facturaServicio) {
    // Claim de estado: solo cierra la factura que sigue pendiente; una
    // anulación o cobro concurrente gana y no se sobre-escribe.
    await tx.factura.updateMany({
      where: { idFactura: facturaServicio.idFactura, estado: 'PENDIENTE' },
      data: { estado: 'PAGADA' },
    });
  }
  const cxcServicio = await tx.cuentaPorCobrar.findFirst({
    where: { ventaServicioId, estado: { in: ['PENDIENTE', 'PARCIAL'] } },
    select: { id: true, montoDeuda: true },
  });
  if (cxcServicio) {
    // Claim de estado: solo cierra la deuda viva; una CxC anulada o pagada
    // concurrentemente no se resurrecta.
    await tx.cuentaPorCobrar.updateMany({
      where: { id: cxcServicio.id, estado: { in: ['PENDIENTE', 'PARCIAL'] } },
      data: { estado: 'PAGADA', montoPagado: cxcServicio.montoDeuda },
    });
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
  }) {
    const tenantId = requireTenant(user);
    validateSaleReconciliationInput(input);
    const conversion = buildPersistedAccountingAmount(
      input.monto,
      input.moneda || 'CUP',
      input.tasaCambio,
    );

    return prisma.$transaction(async (tx) => {
      await guardAccountingWriteInTransaction({
        client: tx,
        tenantId,
        businessDate: input.fechaReconciliacion ? new Date(input.fechaReconciliacion) : new Date(),
        actorId: user.userId,
      });
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
        where: { cuentaId: input.cuentaId, tenantId },
        select: { cuentaId: true, isActive: true },
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
        select: { idCC: true, montoDeuda: true, montoPagado: true, estado: true },
      });
      if (cuentaPorCobrar?.estado === 'ANULADA') {
        throw new ActionError('La venta ya está anulada', 'VALIDATION_ERROR');
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
           moneda: input.moneda || 'CUP',
           montoConvertido: conversion.montoConvertido,
           tasaCambio: conversion.tasaCambio,
          fechaReconciliacion: input.fechaReconciliacion
            ? new Date(input.fechaReconciliacion)
            : new Date(),
          observaciones: input.observaciones,
          tenantId,
          reconciliadoPor: user.userId,
        },
      });

      if (cuentaPorCobrar) {
        const reconciliaciones = await tx.reconciliacionVenta.findMany({
          where: { ventaId: input.ventaId, tenantId },
          select: { monto: true, moneda: true, tasaCambio: true },
        });

        const totalPagado = reconciliaciones.reduce((sum, rec) => {
          const tasa = rec.tasaCambio ? Number(rec.tasaCambio) : 1;
          return sum + Number(rec.monto) * tasa;
        }, 0);

        const montoDeuda = Number(cuentaPorCobrar.montoDeuda);
        const nuevoEstado =
          totalPagado >= montoDeuda - 0.01
            ? 'PAGADA'
            : totalPagado > 0
              ? 'PARCIAL'
              : 'PENDIENTE';

        if (nuevoEstado !== cuentaPorCobrar.estado) {
          await tx.cuentaPorCobrar.updateMany({
            where: { idCC: cuentaPorCobrar.idCC, tenantId },
            data: { estado: nuevoEstado, montoPagado: totalPagado },
          });
        }
      }

      return reconciliacion;
    });
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
        observaciones?: string;
      }>;
      fechaReconciliacion?: string;
    };
    user: AuthenticatedUser;
  }) {
    const tenantId = requireTenant(user);

    validateServiceCollectionInput(input);

    return prisma.$transaction(async (tx) => {
      const collectionDate = input.fechaReconciliacion
        ? new Date(input.fechaReconciliacion)
        : new Date();
      await guardAccountingWriteInTransaction({
        client: tx,
        tenantId,
        businessDate: collectionDate,
        actorId: user.userId,
      });
      // Orden común: tenant contable → documento → filas de venta y cobro.
      await lockDocumentoServicio(tx, input.ventaServicioId);
      const precioServicio = await assertServiceCollectionTargets(tx, tenantId, input);

      const montoTotalDistribuido = input.distribuciones.reduce((sum, d) => sum + d.monto, 0);

      if (Math.abs(montoTotalDistribuido - precioServicio) > 0.01) {
        throw new ActionError(
          `El monto total distribuido (${montoTotalDistribuido.toFixed(2)}) debe ser igual al precio del servicio (${precioServicio.toFixed(2)})`,
          'VALIDATION_ERROR',
        );
      }

      for (const dist of input.distribuciones) {
        await tx.cuentaBancaria.update({
          where: { cuentaId: dist.cuentaId, tenantId },
          data: { saldo: { increment: dist.monto } },
        });

        const fechaDistribucion = input.fechaReconciliacion
          ? new Date(input.fechaReconciliacion)
          : new Date();
        const conversion = buildPersistedAccountingAmount(
          dist.monto, dist.moneda || 'CUP', dist.tasaCambio,
        );
        await tx.reconciliacionServicio.create({
          data: {
            ventaServicioId: input.ventaServicioId,
            cuentaId: dist.cuentaId,
            tipoPagoId: dist.tipoPagoId,
            monto: dist.monto,
            moneda: dist.moneda || 'CUP',
            montoConvertido: conversion.montoConvertido,
            tasaCambio: conversion.tasaCambio,
            ...(conversion.fxEvidence ?? {}),
            fechaReconciliacion: fechaDistribucion,
            observaciones: dist.observaciones,
            tenantId,
            reconciliadoPor: user.userId,
          },
        });
      }

      await tx.ventaServicios.update({
        where: { ventaServicioId: input.ventaServicioId, tenantId },
        data: { reconciliado: true },
      });

      // C-6: el cobro cierra el ciclo del documento (Factura y CxC enlazadas).
      await cerrarDocumentoServicio(tx, input.ventaServicioId);

      return { reconciliado: true, distribuciones: input.distribuciones.length };
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
