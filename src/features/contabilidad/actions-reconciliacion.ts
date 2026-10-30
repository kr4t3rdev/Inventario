/**
 * @description Server Actions para Reconciliación (ventas, servicios, gastos).
 */
"use server";

import { revalidatePath } from "next/cache";
import { withAction, ActionError } from "@/lib/server-actions";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma";
import { requireFeature, requireTenant } from "@/lib/services/tenant-scope";
import { withPeriodValidation } from "@/lib/services/with-period-validation";
import {
	applyPagoGastoWorkflow,
	isGastoWorkflowError,
} from "@/lib/services/pago-gastos-workflow";
import { exchangeRateProvider } from "./services/exchange-rate-provider";
import { AuditLogService } from "@/lib/services/audit-log-service";
import { endOfDay } from "@/lib/date-range";
import type { AuthenticatedUser } from "@/lib/auth-middleware";
import {
	assertServiceCollectionTargets,
	validateServiceCollectionInput,
	buildPersistedAccountingAmount,
	cerrarDocumentoServicio,
	lockDocumentoServicio,
	validateSaleReconciliationInput,
} from "@/features/contabilidad/services/accounting-reconciliation-service";
import {
	getReconciliationStats,
} from "@/features/contabilidad/services/reconciliation-stats-service";
import { guardAccountingWriteInTransaction } from "@/features/contabilidad/services/period-close-write-guard";
import { getPayrollPaymentAmount } from "@/features/pago-salario/payroll-amounts";
import { resolveAppliedReconciliationAmount } from "@/features/contabilidad/domain/applied-reconciliation-amount";

const RECONCILIATION_EVIDENCE_PAGE_SIZE = 500;

interface ReconciliationEvidenceRow {
	reconciliacionId: string;
	monto: unknown;
	montoConvertido: unknown;
	moneda: string | null;
	functionalCurrency: string | null;
	tasaCambio: unknown;
	rateEffectiveAt: Date | null;
	fxProvenanceKind: string | null;
	fxProvenanceSource: string | null;
	fxCatalogRateId: string | null;
	fxEvidenceFingerprint: string | null;
	fxEvidenceVersion: number | null;
}

// ─── Stats Hub ────────────────────────────────────────────

export const getReconciliacionStatsAction = withAction(
	async (_input: void, user: AuthenticatedUser) => {
		requireFeature(user, 'contabilidad', 'consultar el estado de reconciliación');
		const tenantId = requireTenant(user);
		return getReconciliationStats({ tenantId });
	},
);

// ─── Ventas ────────────────────────────────────────────────

export const getVentasPendientesAction = withAction(
	async (
		params: {
			fechaInicio?: string;
			fechaFin?: string;
			puntoDeVentaId?: string;
			page?: number;
			limit?: number;
		} = {},
		user: AuthenticatedUser,
	) => {
		requireFeature(user, 'contabilidad', 'consultar reconciliación de ventas');
		const tenantId = requireTenant(user);
		const page = params.page || 1;
		const limit = Math.min(200, params.limit || 50);
		const skip = (page - 1) * limit;

		// Build WHERE clause for raw SQL
		const whereParts: Prisma.Sql[] = [
			Prisma.sql`v."tenantId" = ${tenantId}`,
			Prisma.sql`v."deletedAt" IS NULL`,
			Prisma.sql`NOT EXISTS (
				SELECT 1
				FROM "facturas" f
				JOIN "CuentaPorCobrar" cxc ON cxc."facturaId" = f."idFactura"
				WHERE f."ventaId" = v."ventaId"
					AND cxc."tenantId" = ${tenantId}
					AND cxc."estado" IN (
						${`PENDIENTE`}::"EstadoCuentaPorCobrar",
						${`PARCIAL`}::"EstadoCuentaPorCobrar"
					)
			)`,
		];
		if (params.fechaInicio)
			whereParts.push(
				Prisma.sql`v."createdAt" >= ${new Date(params.fechaInicio)}`,
			);
		if (params.fechaFin) {
			const fechaFinDate = new Date(params.fechaFin);
			fechaFinDate.setUTCHours(23, 59, 59, 999);
			whereParts.push(Prisma.sql`v."createdAt" <= ${fechaFinDate}`);
		}
		if (params.puntoDeVentaId)
			whereParts.push(
				Prisma.sql`v."puntoDeVentaId" = ${params.puntoDeVentaId}`,
			);

		const whereSql =
			whereParts.length > 0
				? Prisma.sql`WHERE ${Prisma.join(whereParts, " AND ")}`
				: Prisma.sql``;
		const appliedAmountSql = Prisma.sql`
      CASE
        WHEN rv."montoConvertido" IS NOT NULL
          AND rv."fxEvidenceVersion" = 1
          AND rv."fxEvidenceFingerprint" ~ '^[0-9a-f]{64}$'
          AND NULLIF(BTRIM(rv."fxProvenanceSource"), '') IS NOT NULL
          AND (
            (
              rv."moneda" IS NOT NULL
              AND rv."functionalCurrency" IS NOT NULL
              AND rv."moneda" = rv."functionalCurrency"
              AND rv."fxProvenanceKind" = 'SAME_CURRENCY'
              AND ABS(rv."montoConvertido" - rv."monto") <= 0.01
              AND (rv."tasaCambio" IS NULL OR rv."tasaCambio" = 1)
            )
            OR (
              rv."moneda" IS NOT NULL
              AND rv."functionalCurrency" IS NOT NULL
              AND rv."moneda" IS DISTINCT FROM rv."functionalCurrency"
              AND rv."fxProvenanceKind" = 'MANUAL_GOVERNED'
              AND rv."rateEffectiveAt" IS NOT NULL
              AND rv."tasaCambio" > 0
              AND ABS(rv."montoConvertido" - rv."monto" * rv."tasaCambio")
                <= GREATEST(0.01, ABS(rv."monto" * rv."tasaCambio") * 0.000001)
            )
          )
        THEN rv."montoConvertido"
        ELSE NULL
      END`;

		const { pendingRows, totalRows } = await prisma.$transaction(async (tx) => {
			let cursor: string | null = null;
			while (true) {
				const cursorSql: Prisma.Sql = cursor
					? Prisma.sql`AND rv."reconciliacionId" > ${cursor}`
					: Prisma.empty;
				const reconciliationEvidenceRows: ReconciliationEvidenceRow[] =
					await tx.$queryRaw<ReconciliationEvidenceRow[]>(Prisma.sql`
					SELECT rv."reconciliacionId", rv."monto", rv."montoConvertido",
						rv."moneda", rv."functionalCurrency", rv."tasaCambio",
						rv."rateEffectiveAt", rv."fxProvenanceKind", rv."fxProvenanceSource",
						rv."fxCatalogRateId", rv."fxEvidenceFingerprint", rv."fxEvidenceVersion"
					FROM "Venta" v
					JOIN "ReconciliacionVenta" rv
						ON rv."ventaId" = v."ventaId" AND rv."tenantId" = v."tenantId"
					${whereSql}
					${cursorSql}
					ORDER BY rv."reconciliacionId"
					LIMIT ${RECONCILIATION_EVIDENCE_PAGE_SIZE}
			`);
				if (reconciliationEvidenceRows.some(
					(row) => resolveAppliedReconciliationAmount(row) == null,
				)) {
					throw new ActionError(
						'No se puede calcular la conciliación: existe un pago sin evidencia FX verificable.',
						'FX_EVIDENCE_MISSING',
					);
				}
				if (reconciliationEvidenceRows.length < RECONCILIATION_EVIDENCE_PAGE_SIZE) break;
				cursor = reconciliationEvidenceRows.at(-1)!.reconciliacionId;
			}

		// Step 1: Get ventaIds that still have pending balance using raw SQL
		// (LEFT JOIN with ReconciliacionVenta, HAVING total - totalPagado > 0.1)
		const pendingRows = await tx.$queryRaw<
			Array<{ ventaId: string; totalPagado: number }>
		>(Prisma.sql`
    SELECT v."ventaId",
      COALESCE(SUM(
        ${appliedAmountSql}
      ), 0)::double precision AS "totalPagado"
    FROM "Venta" v
    LEFT JOIN "ReconciliacionVenta" rv
      ON rv."ventaId" = v."ventaId" AND rv."tenantId" = v."tenantId"
    ${whereSql}
    GROUP BY v."ventaId", v."total", v."createdAt"
    HAVING (COALESCE(v."total", 0) - COALESCE(SUM(
      ${appliedAmountSql}
    ), 0)) > 0.1
    ORDER BY v."createdAt" DESC
    OFFSET ${skip} LIMIT ${limit}
  `);

		// Count total pending for pagination
		const totalRows = await tx.$queryRaw<
			Array<{ total: bigint; saldoPendiente: number }>
		>(Prisma.sql`
    SELECT COUNT(*)::bigint AS total,
      COALESCE(SUM(pendientes.saldo), 0)::double precision AS "saldoPendiente"
      FROM (
      SELECT v."ventaId", COALESCE(v."total", 0) - COALESCE(SUM(
        ${appliedAmountSql}
      ), 0) AS saldo
      FROM "Venta" v
      LEFT JOIN "ReconciliacionVenta" rv
        ON rv."ventaId" = v."ventaId" AND rv."tenantId" = v."tenantId"
      ${whereSql}
      GROUP BY v."ventaId", v."total"
      HAVING (COALESCE(v."total", 0) - COALESCE(SUM(
        ${appliedAmountSql}
      ), 0)) > 0.1
    ) AS pendientes
		`);
			return { pendingRows, totalRows };
		}, {
			isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
			timeout: 30_000,
		});

		const total = Number(totalRows[0]?.total || 0);
		const saldoPendienteTotal = Number(totalRows[0]?.saldoPendiente || 0);
		const ventaIds = pendingRows.map((r) => r.ventaId);

		if (ventaIds.length === 0) {
			return {
				ventas: [],
				saldoPendienteTotal,
				pagination: {
					page,
					limit,
					total,
					totalPages: Math.ceil(total / limit),
				},
			};
		}

		// Step 2: Fetch full venta records with includes
		const ventasRaw = await prisma.venta.findMany({
			where: { ventaId: { in: ventaIds }, deletedAt: null },
			include: {
				cliente: { select: { clienteId: true, nombre: true } },
				puntoDeVenta: { select: { nombre: true } },
			},
		});

		// Step 3: Merge pending balance into each venta
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
			saldoPendienteTotal,
			pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
		};
	},
);

export const getHistorialReconciliacionVentasAction = withAction(
	async (
		params: {
			fechaInicio?: string;
			fechaFin?: string;
			cuentaId?: string;
		} = {},
		user: AuthenticatedUser,
	) => {
		requireFeature(user, 'contabilidad', 'consultar historial de reconciliación de ventas');
		const tenantId = requireTenant(user);
		const where: any = { tenantId };
		if (params.cuentaId) where.cuentaId = params.cuentaId;
		if (params.fechaInicio || params.fechaFin) {
			where.fechaReconciliacion = {};
			if (params.fechaInicio)
				where.fechaReconciliacion.gte = new Date(params.fechaInicio);
			if (params.fechaFin)
				where.fechaReconciliacion.lte = new Date(params.fechaFin);
		}
		const reconciliaciones = await prisma.reconciliacionVenta.findMany({
			where,
			orderBy: { fechaReconciliacion: "desc" },
			take: 100,
			include: {
				venta: { select: { ventaId: true, total: true } },
				cuentaBancaria: { select: { nombreBanco: true } },
				tipoPago: { select: { nombre: true } },
			},
		});
		const porMoneda = await prisma.reconciliacionVenta.groupBy({
			by: ["moneda"],
			where,
			_sum: { monto: true },
		});
		const porTipoDePago = await prisma.reconciliacionVenta.groupBy({
			by: ["tipoPagoId"],
			where,
			_sum: { monto: true },
		});
		return {
			reconciliaciones: reconciliaciones.map((r) => ({
				...r,
				monto: Number(r.monto),
				tasaCambio: r.tasaCambio ? Number(r.tasaCambio) : null,
				montoConvertido: r.montoConvertido ? Number(r.montoConvertido) : null,
				venta: r.venta
					? { ...r.venta, total: Number(r.venta.total) }
					: undefined,
			})),
			estadisticas: {
				montoTotal: reconciliaciones.reduce(
					(s: number, r: any) => s + Number(r.monto),
					0,
				),
				montoConvertidoTotal: reconciliaciones.reduce(
					(s: number, r: any) => s + Number(r.montoConvertido ?? 0),
					0,
				),
				porMoneda,
				porTipoDePago,
			},
			pagination: {},
		};
	},
);

export const reconciliarVentaAction = withAction(
	withPeriodValidation(
		(input) =>
			input.fechaReconciliacion
				? new Date(input.fechaReconciliacion)
				: new Date(),
		async (
			input: {
				ventaId: string;
				cuentaId: string;
				tipoPagoId: string;
				monto: number;
				moneda?: string;
				tasaCambio?: number;
				fechaReconciliacion?: string;
				observaciones?: string;
			},
			user: AuthenticatedUser,
		) => {
			requireFeature(user, 'contabilidad', 'reconciliar ventas');
			const tenantId = requireTenant(user);
			validateSaleReconciliationInput(input);
			const fechaReconciliacion = input.fechaReconciliacion
				? new Date(input.fechaReconciliacion)
				: new Date();
			let fxCatalogRateId: string | null = null;
			if ((input.moneda || 'CUP').trim().toUpperCase() !== 'CUP') {
				try {
					const rate = await exchangeRateProvider.getRateAsOf({
						sourceCurrency: input.moneda || 'CUP',
						boundaryAt: fechaReconciliacion,
					});
					fxCatalogRateId = rate?.tasaId ?? null;
				} catch {
					fxCatalogRateId = null;
				}
			}
			const conversion = buildPersistedAccountingAmount(
				input.monto,
				input.moneda || 'CUP',
				input.tasaCambio,
				fechaReconciliacion,
				fxCatalogRateId,
			);

			const result = await prisma.$transaction(async (tx) => {
				await guardAccountingWriteInTransaction({
					client: tx,
					tenantId,
					businessDate: fechaReconciliacion,
					actorId: user.userId,
				});
				// Re-read the sale and its receivable while holding the transaction.
				// Cancellation claims deletedAt atomically, so this prevents a late
				// reconciliation from reactivating an annulled CxC or bank balance.
				if (tx.$queryRaw) {
					await tx.$queryRaw`
						SELECT 1 FROM "Venta"
						WHERE "ventaId" = ${input.ventaId}
						  AND "tenantId" = ${tenantId}
						FOR UPDATE
					`;
				}
				const ventaWithFactura = await tx.venta.findUnique({
					where: { ventaId: input.ventaId },
					select: {
						tenantId: true,
						deletedAt: true,
						factura: { select: { idFactura: true } },
					},
				});
				if (!ventaWithFactura || ventaWithFactura.tenantId !== tenantId) {
					throw new ActionError('Venta no encontrada', 'NOT_FOUND');
				}
				if (ventaWithFactura.deletedAt) {
					throw new ActionError('La venta ya está anulada', 'VALIDATION_ERROR');
				}

				const facturaIdReal = ventaWithFactura.factura?.idFactura;
				const cuentaPorCobrar = await tx.cuentaPorCobrar.findFirst({
					where: {
						OR: [
							{ facturaId: input.ventaId },
							...(facturaIdReal ? [{ facturaId: facturaIdReal }] : []),
						],
						tenantId,
					},
					select: {
						idCC: true,
						montoDeuda: true,
						montoPagado: true,
						estado: true,
					},
				});
				if (cuentaPorCobrar?.estado === 'ANULADA') {
					throw new ActionError('La venta ya está anulada', 'VALIDATION_ERROR');
				}

				if (tx.$queryRaw) {
					await tx.$queryRaw`
						SELECT 1 FROM "CuentaBancaria"
						WHERE "cuentaId" = ${input.cuentaId}
						  AND "tenantId" = ${tenantId}
						FOR UPDATE
					`;
					await tx.$queryRaw`
						SELECT 1 FROM "TipoPago"
						WHERE "tipoId" = ${input.tipoPagoId}
						  AND "tenantId" = ${tenantId}
						FOR UPDATE
					`;
				}
				const cuentaBancaria = await tx.cuentaBancaria.findFirst({
					where: { cuentaId: input.cuentaId, tenantId },
					select: { cuentaId: true, isActive: true },
				});
				if (!cuentaBancaria || !cuentaBancaria.isActive) {
					throw new ActionError(
						'Cuenta bancaria no encontrada o inactiva',
						'NOT_FOUND',
					);
				}
				const tipoPago = await tx.tipoPago.findFirst({
					where: { tipoId: input.tipoPagoId, tenantId },
					select: { tipoId: true, isActive: true },
				});
				if (!tipoPago || !tipoPago.isActive) {
					throw new ActionError('Tipo de pago no encontrado o inactivo', 'NOT_FOUND');
				}

				// Incrementar saldo de la cuenta bancaria (ingreso por venta)
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
						moneda: input.moneda || "CUP",
						montoConvertido: conversion.montoConvertido,
						tasaCambio: conversion.tasaCambio,
						fechaReconciliacion,
						...(conversion.fxEvidence ?? {}),
						observaciones: input.observaciones,
						tenantId,
						reconciliadoPor: user.userId,
					},
				});

				if (cuentaPorCobrar) {
					// Sumar todas las reconciliaciones de esta venta para calcular el total pagado
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
							? "PAGADA"
							: totalPagado > 0
								? "PARCIAL"
								: "PENDIENTE";

					if (nuevoEstado !== cuentaPorCobrar.estado) {
						await tx.cuentaPorCobrar.updateMany({
							where: { idCC: cuentaPorCobrar.idCC, tenantId },
							data: {
								estado: nuevoEstado,
								montoPagado: totalPagado,
							},
						});
					}
				}

				return reconciliacion;
			});

			AuditLogService.log({
				accion: "CREATE",
				entidad: "RECONCILIACION",
				entidadId: result.reconciliacionId,
				usuarioId: user.userId,
				detalles: {
					tipo: "VENTA",
					ventaId: input.ventaId,
					cuentaId: input.cuentaId,
					tipoPagoId: input.tipoPagoId,
					monto: input.monto,
					moneda: input.moneda || "CUP",
				},
			}).catch((err) => console.error("[AuditLog] Error logging reconciliacion venta:", err));

			revalidatePath("/busy/contabilidad/reconciliacion");
			revalidatePath("/busy/contabilidad/cuentas-por-cobrar");
			revalidatePath("/busy/contabilidad");
			return result;
		},
	),
);

// ─── Servicios ─────────────────────────────────────────────

export const getServiciosPendientesAction = withAction(
	async (
		params: {
			fechaDesde?: string;
			fechaHasta?: string;
			page?: number;
			limit?: number;
		} = {},
		user: AuthenticatedUser,
	) => {
		requireFeature(user, 'servicios', 'consultar reconciliación de servicios');
		const tenantId = requireTenant(user);
		const where: any = {
			tenantId,
			reconciliado: null,
		};
		if (params.fechaDesde || params.fechaHasta) {
			where.createdAt = {};
			if (params.fechaDesde) where.createdAt.gte = new Date(params.fechaDesde);
			if (params.fechaHasta) where.createdAt.lte = new Date(params.fechaHasta);
		}
		const page = params.page || 1;
		const limit = params.limit || 50;
		const [ventaServicios, total] = await Promise.all([
			prisma.ventaServicios.findMany({
				where,
				orderBy: { createdAt: "desc" },
				skip: (page - 1) * limit,
				take: limit,
				include: {
					cliente: { select: { nombre: true } },
					servicio: {
						select: {
							nombre: true,
							descripcion: true,
							precio: true,
							moneda: true,
						},
					},
				},
			}),
			prisma.ventaServicios.count({
				where,
			}),
		]);
		return {
			ventaServicios: ventaServicios.map((vs) => ({
				...vs,
				servicio: vs.servicio
					? { ...vs.servicio, precio: Number(vs.servicio.precio) }
					: undefined,
			})),
			pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
		};
	},
);

export const getHistorialReconciliacionServiciosAction = withAction(
	async (
		params: {
			fechaDesde?: string;
			fechaHasta?: string;
			cuentaId?: string;
		} = {},
		user: AuthenticatedUser,
	) => {
		requireFeature(user, 'servicios', 'consultar historial de reconciliación de servicios');
		const tenantId = requireTenant(user);
		const where: any = { tenantId };
		if (params.cuentaId) where.cuentaId = params.cuentaId;
		if (params.fechaDesde || params.fechaHasta) {
			where.fechaReconciliacion = {};
			if (params.fechaDesde)
				where.fechaReconciliacion.gte = new Date(params.fechaDesde);
			if (params.fechaHasta)
				where.fechaReconciliacion.lte = new Date(params.fechaHasta);
		}
		const reconciliaciones = await prisma.reconciliacionServicio.findMany({
			where,
			orderBy: { fechaReconciliacion: "desc" },
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
);

export const reconciliarServicioAction = withAction(
	withPeriodValidation(
		(input) => {
			validateServiceCollectionInput(input);
			return input.fechaReconciliacion ? new Date(input.fechaReconciliacion) : new Date();
		},
		async (
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
			},
			user: AuthenticatedUser,
		) => {
			requireFeature(user, 'servicios', 'reconciliar servicios');
			const tenantId = requireTenant(user);

			validateServiceCollectionInput(input);

			const result = await prisma.$transaction(async (tx) => {
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

				const montoTotalDistribuido = input.distribuciones.reduce(
					(sum, d) => sum + d.monto,
					0,
				);

				if (Math.abs(montoTotalDistribuido - precioServicio) > 0.01) {
					throw new ActionError(
						`El monto total distribuido (${montoTotalDistribuido.toFixed(2)}) debe ser igual al precio del servicio (${precioServicio.toFixed(2)})`,
						"VALIDATION_ERROR",
					);
				}

				// Crear todas las reconciliaciones e incrementar saldos en una sola transacción
				for (const dist of input.distribuciones) {
					// Incrementar saldo de la cuenta bancaria (ingreso por servicio)
					await tx.cuentaBancaria.update({
						where: { cuentaId: dist.cuentaId, tenantId },
						data: { saldo: { increment: dist.monto } },
					});

					const fechaDistribucion = input.fechaReconciliacion
						? new Date(input.fechaReconciliacion)
						: new Date();
					let distRateId: string | null = null;
					if ((dist.moneda || 'CUP').trim().toUpperCase() !== 'CUP') {
						try {
							const rate = await exchangeRateProvider.getRateAsOf({
								sourceCurrency: dist.moneda || 'CUP',
								boundaryAt: fechaDistribucion,
							});
							distRateId = rate?.tasaId ?? null;
						} catch {
							distRateId = null;
						}
					}
					const conversion = buildPersistedAccountingAmount(
						dist.monto,
						dist.moneda || 'CUP',
						dist.tasaCambio,
						fechaDistribucion,
						distRateId,
					);

					await tx.reconciliacionServicio.create({
						data: {
							ventaServicioId: input.ventaServicioId,
							cuentaId: dist.cuentaId,
							tipoPagoId: dist.tipoPagoId,
							monto: dist.monto,
							moneda: dist.moneda || "CUP",
							montoConvertido: conversion.montoConvertido,
							tasaCambio: conversion.tasaCambio,
							fechaReconciliacion: fechaDistribucion,
							...(conversion.fxEvidence ?? {}),
							observaciones: dist.observaciones,
							tenantId,
							reconciliadoPor: user.userId,
						},
					});
				}

				// Marcar el servicio como reconciliado
				await tx.ventaServicios.update({
					where: { ventaServicioId: input.ventaServicioId, tenantId },
					data: { reconciliado: true },
				});

				// C-6: el cobro cierra el ciclo del documento (Factura y CxC).
				await cerrarDocumentoServicio(tx, input.ventaServicioId);

				return {
					reconciliado: true,
					distribuciones: input.distribuciones.length,
				};
			});

			AuditLogService.log({
				accion: "CREATE",
				entidad: "RECONCILIACION",
				entidadId: `SERV-${input.ventaServicioId}`,
				usuarioId: user.userId,
				detalles: {
					tipo: "SERVICIO",
					ventaServicioId: input.ventaServicioId,
					distribuciones: input.distribuciones,
					moneda: "CUP",
				},
			}).catch((err) => console.error("[AuditLog] Error logging reconciliacion servicio:", err));

			revalidatePath("/busy/contabilidad/reconciliacion");
			revalidatePath("/busy/contabilidad");
			return result;
		},
	),
);

// ─── Gastos ────────────────────────────────────────────────

interface ExpenseReconciliationAmount {
	monto: unknown;
	montoConvertido?: unknown;
	moneda?: string | null;
	functionalCurrency?: string | null;
	tasaCambio?: unknown;
	rateEffectiveAt?: Date | null;
	fxProvenanceKind?: string | null;
	fxProvenanceSource?: string | null;
	fxCatalogRateId?: string | null;
	fxEvidenceFingerprint?: string | null;
	fxEvidenceVersion?: number | null;
}

const APPLIED_EXPENSE_RECONCILIATION_STATES = [
	'PAGADA',
	'PAGADO',
	'POSTED',
	'PARCIAL',
] as const;

/**
 * @description Converts an applied expense payment to the tenant's functional currency.
 * @param {ExpenseReconciliationAmount} row - Persisted payment and optional legacy FX evidence.
 * @returns {number} Applied payment amount in the tenant's functional currency.
 */
function getAppliedExpenseAmount(row: ExpenseReconciliationAmount): number {
	const amount = resolveAppliedReconciliationAmount(row);
	if (amount == null) {
		throw new ActionError(
			'No se puede calcular el saldo: existe un gasto pagado sin evidencia de conversión.',
			'FX_EVIDENCE_MISSING',
		);
	}
	return amount;
}

/**
 * @description Calculates an expense's open balance from all persisted reconciliation rows.
 * @param {number} grossAmount - Original expense amount.
 * @param {ExpenseReconciliationAmount[]} reconciliations - Applied payments.
 * @returns {number} Non-negative open balance rounded to cents.
 */
function calculateOpenExpenseBalance(
	grossAmount: number,
	reconciliations: ExpenseReconciliationAmount[],
): number {
	const applied = reconciliations.reduce(
		(sum, row) => sum + getAppliedExpenseAmount(row),
		0,
	);
	return Math.max(0, Math.round((grossAmount - applied) * 100) / 100);
}

/**
 * @description Calculates an open balance from an already-verified functional payment total.
 * @param {number} grossAmount - Gross amount in functional currency.
 * @param {number} appliedAmount - Previously validated payment total in functional currency.
 * @returns {number} Non-negative open balance rounded to cents.
 */
function calculateOpenExpenseBalanceFromAppliedAmount(
	grossAmount: number,
	appliedAmount: number,
): number {
	return Math.max(0, Math.round((grossAmount - appliedAmount) * 100) / 100);
}

export const getGastosPendientesAction = withAction(
	async (
		params: {
			fechaDesde?: string;
			fechaHasta?: string;
			tipoGasto?: string;
			soloNoReconciliados?: boolean;
			page?: number;
			limit?: number;
		} = {},
		user: AuthenticatedUser,
	) => {
		requireFeature(user, 'contabilidad', 'consultar reconciliación de gastos');
		const tenantId = requireTenant(user);

		// ── Query GastosDE ──
		const exclusionCxP = {
			cuentaPorPagar: {
				is: { tenantId, deletedAt: null, estado: { in: ['PENDIENTE', 'PARCIAL'] } },
			},
		};
		const whereDE: any = { tenantId, NOT: exclusionCxP };
		if (params.fechaDesde || params.fechaHasta) {
			whereDE.createdAt = {};
			if (params.fechaDesde)
				whereDE.createdAt.gte = new Date(params.fechaDesde);
			if (params.fechaHasta)
					whereDE.createdAt.lte = endOfDay(params.fechaHasta);
		}

		// ── Query GastoCompra (compras de productos) ──
		const whereGC: any = {
			tenantId,
			deletedAt: null,
			NOT: exclusionCxP,
		};
		if (params.fechaDesde || params.fechaHasta) {
			whereGC.fechaCompra = {};
			if (params.fechaDesde)
				whereGC.fechaCompra.gte = new Date(params.fechaDesde);
			if (params.fechaHasta)
					whereGC.fechaCompra.lte = endOfDay(params.fechaHasta);
		}

		// ── Query PagoSalario (salarios de empleados) ──
		const wherePS: any = { tenantId };
		if (params.fechaDesde || params.fechaHasta) {
			wherePS.createdAt = {};
			if (params.fechaDesde)
				wherePS.createdAt.gte = new Date(params.fechaDesde);
			if (params.fechaHasta)
					wherePS.createdAt.lte = endOfDay(params.fechaHasta);
		}

		// ── Query CompraServicio (servicios recibidos de proveedores) ──
		const whereCS: any = { tenantId };
		if (params.fechaDesde || params.fechaHasta) {
			whereCS.fechaServicio = {};
			if (params.fechaDesde)
				whereCS.fechaServicio.gte = new Date(params.fechaDesde);
			if (params.fechaHasta)
					whereCS.fechaServicio.lte = endOfDay(params.fechaHasta);
		}

		// ── Query VentaServicios (costo de servicios vendidos) ──
		const whereVS: any = { tenantId, costo: { gt: 0 } };
		if (params.fechaDesde || params.fechaHasta) {
			whereVS.createdAt = {};
			if (params.fechaDesde)
				whereVS.createdAt.gte = new Date(params.fechaDesde);
			if (params.fechaHasta)
					whereVS.createdAt.lte = endOfDay(params.fechaHasta);
		}

		const page = params.page || 1;
		const limit = params.limit || 50;

		// Traer todos los tipos y unificarlos
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
				orderBy: { createdAt: "desc" },
				include: {
					reconciliaciones: {
						where: {
							tenantId,
							estado: { in: [...APPLIED_EXPENSE_RECONCILIATION_STATES] },
						},
						select: {
							monto: true,
							montoConvertido: true,
							functionalCurrency: true,
							rateEffectiveAt: true,
							fxProvenanceKind: true,
							fxProvenanceSource: true,
							fxCatalogRateId: true,
							fxEvidenceFingerprint: true,
							fxEvidenceVersion: true,
							moneda: true,
							tasaCambio: true,
						},
					},
				},
			}),
			prisma.gastoCompra.findMany({
				where: whereGC,
				orderBy: { fechaCompra: "desc" },
				include: {
					compraDocumento: { select: { moneda: true } },
					reconciliaciones: {
						where: {
							tenantId,
							estado: { in: [...APPLIED_EXPENSE_RECONCILIATION_STATES] },
						},
						select: {
							monto: true,
							montoConvertido: true,
							functionalCurrency: true,
							rateEffectiveAt: true,
							fxProvenanceKind: true,
							fxProvenanceSource: true,
							fxCatalogRateId: true,
							fxEvidenceFingerprint: true,
							fxEvidenceVersion: true,
							moneda: true,
							tasaCambio: true,
						},
					},
					vendor: { select: { nombre: true } },
					producto: { select: { nombre: true } },
				},
			}),
			prisma.pagosalario.findMany({
				where: wherePS,
				orderBy: { createdAt: "desc" },
				include: {
					ReconciliacionGasto: {
						where: {
							tenantId,
							estado: { in: [...APPLIED_EXPENSE_RECONCILIATION_STATES] },
						},
						select: {
							monto: true,
							montoConvertido: true,
							functionalCurrency: true,
							rateEffectiveAt: true,
							fxProvenanceKind: true,
							fxProvenanceSource: true,
							fxCatalogRateId: true,
							fxEvidenceFingerprint: true,
							fxEvidenceVersion: true,
							moneda: true,
							tasaCambio: true,
						},
					},
					empleado: { select: { nombre: true, apellido: true, cargo: true } },
				},
			}),
			prisma.compraServicio.findMany({
				where: whereCS,
				orderBy: { fechaServicio: "desc" },
				include: {
					servicio: { select: { nombre: true } },
					proveedor: { select: { nombre: true } },
				},
			}),
			prisma.ventaServicios.findMany({
				where: whereVS,
				orderBy: { createdAt: "desc" },
				include: {
					servicio: { select: { nombre: true } },
					cliente: { select: { nombre: true } },
				},
			}),
							prisma.reconciliacionGasto.findMany({
				where: {
					tenantId,
					tipoGasto: "servicio",
					estado: { in: [...APPLIED_EXPENSE_RECONCILIATION_STATES] },
				},
				select: {
					referenciaId: true,
					monto: true,
					montoConvertido: true,
					functionalCurrency: true,
					rateEffectiveAt: true,
					fxProvenanceKind: true,
					fxProvenanceSource: true,
					fxCatalogRateId: true,
					fxEvidenceFingerprint: true,
					fxEvidenceVersion: true,
					moneda: true,
					tasaCambio: true,
				},
			}),
			prisma.reconciliacionGasto.findMany({
				where: {
					tenantId,
					tipoGasto: "venta_servicio",
					estado: { in: [...APPLIED_EXPENSE_RECONCILIATION_STATES] },
				},
				select: {
					referenciaId: true,
					monto: true,
					montoConvertido: true,
					functionalCurrency: true,
					rateEffectiveAt: true,
					fxProvenanceKind: true,
					fxProvenanceSource: true,
					fxCatalogRateId: true,
					fxEvidenceFingerprint: true,
					fxEvidenceVersion: true,
					moneda: true,
					tasaCambio: true,
				},
			}),
		]);

		const policy = await prisma.tenantAccountingPolicy.findUnique({
			where: { tenantId },
			select: { functionalCurrencyCode: true },
		});
		const monedaFuncional = policy?.functionalCurrencyCode?.trim().toUpperCase() ?? 'CUP';
		const tasasPorMoneda = new Map<string, Promise<number>>();
		const convertGrossToFunctionalCurrency = async (
			amount: number,
			currency: string | null | undefined,
			boundaryAt: Date,
		): Promise<number> => {
			const monedaOrigen = currency?.trim().toUpperCase() || monedaFuncional;
			if (monedaOrigen === monedaFuncional) return amount;
			const rateKey = `${monedaOrigen}:${boundaryAt.toISOString()}`;
			let tasaPromise = tasasPorMoneda.get(rateKey);
			if (!tasaPromise) {
				tasaPromise = exchangeRateProvider.getRateAsOf({
					sourceCurrency: monedaOrigen,
					targetCurrency: monedaFuncional,
					boundaryAt,
				}).then((tasaPublicada) => {
					if (!tasaPublicada) {
						throw new ActionError(
							`No hay tasa de cambio publicada para ${monedaOrigen} → ${monedaFuncional}; no se puede calcular el saldo pendiente`,
							'VALIDATION_ERROR',
						);
					}
					return tasaPublicada.tasa;
				});
				tasasPorMoneda.set(rateKey, tasaPromise);
			}
			return amount * await tasaPromise;
		};
		const [
			totalFuncionalPorServicio,
			totalFuncionalPorCompra,
			costoFuncionalPorVentaServicio,
		] = await Promise.all([
			Promise.all(comprasServicio.map(async (row: any) => [
				row.compraServicioId,
				await convertGrossToFunctionalCurrency(
					Number(row.total ?? 0),
					row.moneda,
					row.fechaServicio ?? row.createdAt,
				),
			] as const)),
			Promise.all(gastosCompra.map(async (row: any) => [
				row.gastoCompraId,
				await convertGrossToFunctionalCurrency(
					Number(row.total ?? 0),
					row.compraDocumento?.moneda,
					row.fechaCompra,
				),
			] as const)),
			Promise.all(ventasServicio.map(async (row: any) => [
				row.ventaServicioId,
				await convertGrossToFunctionalCurrency(
					Number(row.costo ?? 0) * Number(row.cantidad ?? 1),
					row.moneda,
					row.createdAt,
				),
			] as const)),
		]);
		const totalFuncionalByService = new Map(totalFuncionalPorServicio);
		const totalFuncionalByPurchase = new Map(totalFuncionalPorCompra);
		const costoFuncionalBySaleService = new Map(costoFuncionalPorVentaServicio);

		const buildAppliedByReference = (
			rows: Array<ExpenseReconciliationAmount & { referenciaId: string | null }>,
		) => {
			const amounts = new Map<string, number>();
			for (const row of rows) {
				if (!row.referenciaId) continue;
				amounts.set(
					row.referenciaId,
					(amounts.get(row.referenciaId) ?? 0) + getAppliedExpenseAmount(row),
				);
			}
			return amounts;
		};
		const appliedByService = buildAppliedByReference(reconciliadosServicioIds);
		const appliedBySaleService = buildAppliedByReference(reconciliadosVentaServicioIds);
		const comprasServicioFiltradas = comprasServicio.filter((g: any) => {
			const balance = calculateOpenExpenseBalanceFromAppliedAmount(
				totalFuncionalByService.get(g.compraServicioId) ?? 0,
				appliedByService.get(g.compraServicioId) ?? 0,
			);
			return !params.soloNoReconciliados || balance > 0.1;
		});
		const ventasServicioFiltradas = ventasServicio.filter((g: any) => {
			const balance = calculateOpenExpenseBalanceFromAppliedAmount(
				costoFuncionalBySaleService.get(g.ventaServicioId) ?? 0,
				appliedBySaleService.get(g.ventaServicioId) ?? 0,
			);
			return !params.soloNoReconciliados || balance > 0.1;
		});

		// Mapear a GastoPendiente
		const gastos = [
			...gastosDE.map((g: any) => ({
				tipo: "gastoDE" as const,
				referenciaId: g.gastosDEId,
				descripcion: g.descripcion || `Gasto DE #${g.gastosDEId.slice(0, 8)}`,
				monto: calculateOpenExpenseBalance(Number(g.monto || g.total || 0), g.reconciliaciones),
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
				tipo: "compra" as const,
				referenciaId: g.gastoCompraId,
				descripcion: g.descripcion || `Compra #${g.gastoCompraId.slice(0, 8)}`,
				monto: calculateOpenExpenseBalance(
					totalFuncionalByPurchase.get(g.gastoCompraId) ?? 0,
					g.reconciliaciones,
				),
				periodo: g.periodo || undefined,
				detalles: {
					vendor: (g as any).vendor?.nombre || undefined,
					producto: (g as any).producto?.nombre || undefined,
					cantidad: g.cantidad || undefined,
					precioUnitario: g.precioUnitario || undefined,
					fechaCompra: g.fechaCompra?.toISOString() || undefined,
				},
				createdAt: g.createdAt.toISOString(),
				updatedAt: g.updatedAt.toISOString(),
			})),
			...pagosSalario.map((g: any) => ({
				tipo: "salario" as const,
				referenciaId: g.pgId,
				descripcion:
					`Salario de ${g.empleado?.nombre || ""} ${g.empleado?.apellido || ""}`.trim() ||
					`Pago #${g.pgId.slice(0, 8)}`,
				monto: calculateOpenExpenseBalance(getPayrollPaymentAmount({
					salario: Number(g.salario || 0),
					bonificaciones: Number(g.bonificaciones || 0),
					deducciones: Number(g.deducciones || 0),
					montoHorasExtras: Number(g.montoHorasExtras || 0),
				}), g.ReconciliacionGasto),
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
				tipo: "servicio" as const,
				referenciaId: g.compraServicioId,
				descripcion: `${g.servicio?.nombre || "Servicio"} - ${g.proveedor?.nombre || "Sin proveedor"}`,
				monto: calculateOpenExpenseBalanceFromAppliedAmount(
					totalFuncionalByService.get(g.compraServicioId) ?? 0,
					appliedByService.get(g.compraServicioId) ?? 0,
				),
				periodo: undefined,
				detalles: {
					servicio: g.servicio?.nombre || undefined,
					proveedorNombre: g.proveedor?.nombre || undefined,
					cantidad: g.cantidad || undefined,
					costoUnitario: g.costoUnitario || undefined,
					numeroFactura: g.numeroFactura || undefined,
				},
				createdAt:
					g.fechaServicio?.toISOString?.() ||
					g.createdAt?.toISOString?.() ||
					new Date().toISOString(),
				updatedAt: g.updatedAt?.toISOString?.() || new Date().toISOString(),
			})),
			...ventasServicioFiltradas.map((g: any) => ({
				tipo: "venta_servicio" as const,
				referenciaId: g.ventaServicioId,
				descripcion: `Costo: ${g.servicio?.nombre || "Servicio"} - ${g.cliente?.nombre || "Sin cliente"}`,
				monto: calculateOpenExpenseBalanceFromAppliedAmount(
					costoFuncionalBySaleService.get(g.ventaServicioId) ?? 0,
					appliedBySaleService.get(g.ventaServicioId) ?? 0,
				),
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
		];

		// Ordenar por createdAt desc
		gastos.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		);

		const gastosPendientes = params.soloNoReconciliados
			? gastos.filter((gasto) => gasto.monto > 0.1)
			: gastos;
		const total = gastosPendientes.length;
		const paginated = gastosPendientes.slice((page - 1) * limit, page * limit);

		return {
			gastos: paginated,
			pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
		};
	},
);

export const getHistorialReconciliacionGastosAction = withAction(
	async (
		params: {
			fechaInicio?: string;
			fechaFin?: string;
			cuentaId?: string;
			tipoGasto?: string;
		} = {},
		user: AuthenticatedUser,
	) => {
		requireFeature(user, 'contabilidad', 'consultar historial de reconciliación de gastos');
		const tenantId = requireTenant(user);
		const where: any = { tenantId };
		if (params.cuentaId) where.cuentaId = params.cuentaId;
		if (params.tipoGasto) where.tipoGasto = params.tipoGasto;
		if (params.fechaInicio || params.fechaFin) {
			where.fechaReconciliacion = {};
			if (params.fechaInicio)
				where.fechaReconciliacion.gte = new Date(params.fechaInicio);
			if (params.fechaFin)
				where.fechaReconciliacion.lte = new Date(params.fechaFin);
		}
		const reconciliaciones = await prisma.reconciliacionGasto.findMany({
			where,
			orderBy: { fechaReconciliacion: "desc" },
			take: 100,
			include: {
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
);

export const reconciliarGastoAction = withAction(
	withPeriodValidation(
		(input) => {
			if (input.fechaReconciliacion) return new Date(input.fechaReconciliacion);
			if (input.periodo && /^\d{4}-\d{2}$/.test(input.periodo)) {
				const [year, month] = input.periodo.split("-").map(Number);
				if (month >= 1 && month <= 12) return new Date(Date.UTC(year, month - 1, 1));
			}
			return new Date();
		},
		async (
			input: {
				gastosDEId?: string;
				gastoCompraId?: string;
				pgId?: string;
				compraServicioId?: string;
				ventaServicioId?: string;
				cuentaId: string;
				tipoPagoId: string;
				monto: number;
				moneda?: string;
				fechaReconciliacion?: string;
				periodo?: string;
				descripcion?: string;
				cuentaPorPagarId?: string;
				distribucion?: Array<{
					cuentaId: string;
					monto: number;
					tipoPagoId?: string;
					moneda?: string;
					numeroTransaccion?: string;
					observaciones?: string;
					tasaCambio?: number;
					porcentaje?: number;
				}>;
			},
			user: AuthenticatedUser,
		) => {
			requireFeature(user, 'contabilidad', 'reconciliar gastos');
			const tenantId = requireTenant(user);
			const fechaPago = input.fechaReconciliacion ??
				(input.periodo && /^\d{4}-\d{2}$/.test(input.periodo)
					? `${input.periodo}-01T00:00:00.000Z`
					: undefined);

			const referenciaId =
				input.gastosDEId ||
				input.pgId ||
				input.gastoCompraId ||
				input.compraServicioId ||
				input.ventaServicioId;
			if (!referenciaId)
				throw new Error("Se requiere referencia del gasto para pagar");
			const explicitSourceIds = [
				input.gastosDEId,
				input.pgId,
				input.gastoCompraId,
				input.compraServicioId,
				input.ventaServicioId,
			].filter(Boolean);
			if (
				explicitSourceIds.length > 1 ||
				(explicitSourceIds.length === 1 && (input as any).referenciaId && (input as any).referenciaId !== explicitSourceIds[0])
			) {
				throw new ActionError(
					"Debe proporcionar exactamente una referencia de gasto",
					"VALIDATION_ERROR",
				);
			}

			const esGastoDE = !!input.gastosDEId;
			const esVentaServicio = !!input.ventaServicioId;
			const esServicio = !!input.compraServicioId;
			const esSalario = !!input.pgId;
			const tipoGasto = esGastoDE
				? ("gastoDE" as const)
				: esVentaServicio
					? ("venta_servicio" as const)
					: esServicio
						? ("servicio" as const)
						: esSalario
							? ("salario" as const)
							: ("compra" as const);

			try {
				const result = await prisma.$transaction(async (tx) => {
					await guardAccountingWriteInTransaction({
						client: tx,
						tenantId,
						businessDate: fechaPago ? new Date(fechaPago) : new Date(),
						actorId: user.userId,
					});
					if (esServicio) {
						// Serialize against CompraServicio deletion so a late payment cannot
						// recreate reconciliation effects after the row is claimed.
						if (tx.$queryRaw) {
							await tx.$queryRaw`
								SELECT 1 FROM "CompraServicio"
								WHERE "compraServicioId" = ${referenciaId}
								  AND "tenantId" = ${tenantId}
								FOR UPDATE
							`;
						}
						const servicio = await tx.compraServicio?.findUnique({
							where: { compraServicioId: referenciaId },
							select: { compraServicioId: true, tenantId: true, estado: true },
						});
						if (!servicio || servicio.tenantId !== tenantId) {
							throw new ActionError('Servicio recibido no encontrado', 'NOT_FOUND');
						}
						if (servicio.estado === 'ELIMINANDO') {
							throw new ActionError(
								'El servicio recibido ya fue eliminado',
								'ALREADY_DELETED',
							);
						}
					}

					const distribucion =
						input.distribucion && input.distribucion.length > 0
							? input.distribucion.map((d) => ({
									cuentaId: d.cuentaId,
									monto: d.monto,
									porcentaje: d.porcentaje,
								}))
							: [{ cuentaId: input.cuentaId, monto: input.monto }];

					return applyPagoGastoWorkflow(tx as any, {
						tipoGasto,
						referenciaId,
						reconciliadoPor: user.userId,
						descripcion:
							input.descripcion ||
							`Pago ${tipoGasto} #${referenciaId.slice(-8)}`,
						monto: input.monto,
						moneda: input.moneda || "CUP",
						tenantId,
						tasaCambio: input.distribucion?.[0]?.tasaCambio,
						observaciones:
							input.distribucion?.[0]?.observaciones || input.descripcion,
						periodo: input.periodo,
						fechaPago,
						estado: "PAGADA",
						cuentaPorPagarId: input.cuentaPorPagarId,
						numeroTransaccion:
							input.distribucion?.[0]?.numeroTransaccion,
						pgId: input.pgId,
						gastosDEId: input.gastosDEId,
						gastoCompraId: input.gastoCompraId,
						tipoPagoId: input.tipoPagoId,
						distribucion,
					});
				});

				const auditReferenciaId =
					input.gastosDEId ||
					input.pgId ||
					input.gastoCompraId ||
					input.compraServicioId ||
					input.ventaServicioId;

				AuditLogService.log({
					accion: "CREATE",
					entidad: "RECONCILIACION",
					entidadId: (result as any)?.reconciliacionId || `GASTO-${auditReferenciaId}`,
					usuarioId: user.userId,
					detalles: {
						tipo: tipoGasto,
						referenciaId: auditReferenciaId,
						cuentaId: input.cuentaId,
						tipoPagoId: input.tipoPagoId,
						monto: input.monto,
						moneda: input.moneda || "CUP",
					},
				}).catch((err) => console.error("[AuditLog] Error logging reconciliacion gasto:", err));

				revalidatePath("/busy/contabilidad/reconciliacion");
				if (input.cuentaPorPagarId) {
					revalidatePath("/busy/contabilidad/cuentas-por-pagar");
				}
				return JSON.parse(JSON.stringify(result));
			} catch (error: unknown) {
				if (isGastoWorkflowError(error)) {
					throw new ActionError(error.message, error.code);
				}
				throw error;
			}
		},
	),
);
