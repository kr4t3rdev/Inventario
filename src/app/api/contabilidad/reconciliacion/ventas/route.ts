import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@/generated/prisma";
import { buildAppliedFxEvidenceExact } from '@/features/contabilidad/domain/fx-evidence';
import { authenticateUser } from "@/lib/auth-middleware";
import { AuditLogService } from "@/lib/services/audit-log-service";
import { postEvento } from "@/features/contabilidad-formal/services/posting-engine";
import { buildEventoCobroCxc, buildEventoVentaContado } from "@/features/contabilidad-formal/lib/event-builders";
import { requireFeature, requirePermission, requireTenant } from "@/lib/services/tenant-scope";
import { ActionError } from "@/lib/server-actions";
import {
	AccountingReconciliationService,
	buildPersistedAccountingAmount,
} from '@/features/contabilidad/services/accounting-reconciliation-service';
import { resolveAccountingAccountMovement } from '@/features/contabilidad/services/accounting-account-movement-valuation';
import { getRequiredTenantAccountingPolicy } from '@/features/contabilidad/services/tenant-accounting-policy-service';
import {
	auditarCreditoOverride,
	bloquearClienteCredito,
	validarCreditoOrigen,
} from "@/features/ventas/services/credito-override";
import {
	validarEscrituraPeriodo,
	extraerFechaDeBody,
} from "@/lib/services/validate-period-write";

// Schema para validar la reconciliación de ventas
const reconciliacionVentaSchema = z.object({
	ventaId: z.string().min(1, "ID de venta es requerido"),
	cuentaId: z.string().min(1, "ID de cuenta bancaria es requerido"),
	tipoPagoId: z.string().min(1, "Tipo de pago es requerido"),
	monto: z.number().positive("El monto debe ser positivo"),
	moneda: z.string().default("CUP"),
	tasaCambio: z.number().positive().optional(),
	verificacionTransferenciaId: z.string().optional(),
	idTransferencia: z.string().optional(),
	observaciones: z.string().optional(),
	solicitarCreditoOverride: z.boolean().optional(),
	motivoCreditoOverride: z.string().trim().max(500).optional(),
});

/**
 * @description Crea un error de validación con status HTTP para el flujo de reconciliación.
 * @param {number} status - Código HTTP a devolver.
 * @param {string} code - Código de negocio.
 * @param {string} message - Mensaje legible de error.
 * @returns {Error & { status: number; code: string }} Error enriquecido.
 */
function createReconciliacionError(
	status: number,
	code: string,
	message: string,
): Error & { status: number; code: string } {
	const error = new Error(message) as Error & { status: number; code: string };
	error.status = status;
	error.code = code;
	return error;
}

/**
 * @description Serializa un valor con claves ordenadas para huella determinista.
 * @param {unknown} value - Valor a serializar.
 * @returns {string} Texto JSON canónico.
 */
function stableStringify(value: unknown): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
	if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
	const entries = Object.entries(value as Record<string, unknown>)
		.sort(([a], [b]) => a.localeCompare(b));
	return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
}

/**
 * @description Calcula la huella SHA-256 del payload validado de una reconciliación.
 * @param {unknown} payload - Payload validado por Zod.
 * @returns {string} Huella hexadecimal del payload.
 */
function hashReconciliacionPayload(payload: unknown): string {
	return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

/**
 * @description Obtiene candidatos de número de factura válidos para fallback en CxC.
 * @param {string | null | undefined} ordenId - Identificador de orden/venta.
 * @param {string | null | undefined} numeroFactura - Número de factura asociado.
 * @returns {string[]} Números de factura únicos no vacíos.
 */
function getNumeroFacturaCandidates(
	ordenId?: string | null,
	numeroFactura?: string | null,
): string[] {
	return Array.from(
		new Set(
			[ordenId, numeroFactura]
				.map((value) => (typeof value === "string" ? value.trim() : ""))
				.filter((value): value is string => value.length > 0),
		),
	);
}

// GET - Obtener ventas pendientes de reconciliar
export async function GET(request: NextRequest) {
	try {
		const authResultUser = await authenticateUser(request);
		if ("status" in authResultUser) return authResultUser as Response;
		const user = authResultUser.user;
		const tenantId = requireTenant(user);

		const { searchParams } = new URL(request.url);
		const fechaDesde =
			searchParams.get("fechaDesde") || searchParams.get("fechaInicio");
		const fechaHasta =
			searchParams.get("fechaHasta") || searchParams.get("fechaFin");
		const puntoDeVentaId = searchParams.get("puntoDeVentaId");
		const pageParam = parseInt(searchParams.get("page") || "1", 10);
		const limitParam = parseInt(searchParams.get("limit") || "50", 10);
		const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
		const normalizedLimit =
			Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 50;
		const limit = Math.min(200, normalizedLimit);
		const skip = (page - 1) * limit;

		const whereParts: Prisma.Sql[] = [
			Prisma.sql`v."tenantId" = ${tenantId}`,
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
			Prisma.sql`EXISTS (
        SELECT 1 FROM "PuntoDeVenta" pv_scope
        WHERE pv_scope."pvId" = v."puntoDeVentaId"
          AND pv_scope."tenantId" = v."tenantId"
      )`,
			Prisma.sql`(
        v."productoId" IS NULL OR EXISTS (
          SELECT 1 FROM "Producto" producto_scope
          WHERE producto_scope."id" = v."productoId"
            AND producto_scope."tenantId" = v."tenantId"
        )
      )`,
			Prisma.sql`(
        v."empleadoId" IS NULL OR EXISTS (
          SELECT 1 FROM "Empleado" empleado_scope
          WHERE empleado_scope."empleadoId" = v."empleadoId"
            AND empleado_scope."tenantId" = v."tenantId"
        )
      )`,
			Prisma.sql`(
        v."clienteId" IS NULL OR EXISTS (
          SELECT 1 FROM "Cliente" cliente_scope
          WHERE cliente_scope."clienteId" = v."clienteId"
            AND cliente_scope."tenantId" = v."tenantId"
        )
      )`,
		];

		if (fechaDesde) {
			whereParts.push(Prisma.sql`v."createdAt" >= ${new Date(fechaDesde)}`);
		}

		if (fechaHasta) {
			const fechaHastaDate = new Date(fechaHasta);
			fechaHastaDate.setUTCHours(23, 59, 59, 999);
			whereParts.push(Prisma.sql`v."createdAt" <= ${fechaHastaDate}`);
		}

		if (puntoDeVentaId) {
			whereParts.push(Prisma.sql`v."puntoDeVentaId" = ${puntoDeVentaId}`);
		}

		const whereSql =
			whereParts.length > 0
				? Prisma.sql`WHERE ${Prisma.join(whereParts, " AND ")}`
				: Prisma.sql``;

		// Paginación en DB para evitar truncar resultados cuando hay muchos registros.
		const ventasPendientesRows = await prisma.$queryRaw<
			Array<{
				ventaId: string;
				totalPagado: number;
			}>
		>(Prisma.sql`
      SELECT
        v."ventaId",
        COALESCE(
          SUM(
            CASE
              WHEN rv."moneda" = 'CUP' THEN rv."monto"
              WHEN rv."tasaCambio" IS NOT NULL AND rv."tasaCambio" > 0
                THEN rv."monto" * rv."tasaCambio"
              ELSE rv."monto"
            END
          ),
          0
        )::double precision AS "totalPagado"
      FROM "Venta" v
      LEFT JOIN "ReconciliacionVenta" rv
        ON rv."ventaId" = v."ventaId"
        AND rv."tenantId" = v."tenantId"
      ${whereSql}
      GROUP BY v."ventaId", v."total", v."createdAt"
      HAVING (
        COALESCE(v."total", 0) - COALESCE(
          SUM(
            CASE
              WHEN rv."moneda" = 'CUP' THEN rv."monto"
              WHEN rv."tasaCambio" IS NOT NULL AND rv."tasaCambio" > 0
                THEN rv."monto" * rv."tasaCambio"
              ELSE rv."monto"
            END
          ),
          0
        )
      ) > 0.1
      ORDER BY v."createdAt" DESC
      OFFSET ${skip}
      LIMIT ${limit}
    `);

		const totalRows = await prisma.$queryRaw<
			Array<{ total: bigint }>
		>(Prisma.sql`
      SELECT COUNT(*)::bigint AS total
      FROM (
        SELECT v."ventaId"
        FROM "Venta" v
        LEFT JOIN "ReconciliacionVenta" rv
          ON rv."ventaId" = v."ventaId"
          AND rv."tenantId" = v."tenantId"
        ${whereSql}
        GROUP BY v."ventaId", v."total"
        HAVING (
          COALESCE(v."total", 0) - COALESCE(
            SUM(
              CASE
                WHEN rv."moneda" = 'CUP' THEN rv."monto"
                WHEN rv."tasaCambio" IS NOT NULL AND rv."tasaCambio" > 0
                  THEN rv."monto" * rv."tasaCambio"
                ELSE rv."monto"
              END
            ),
            0
          )
        ) > 0.1
      ) AS pendientes
    `);

		const total = Number(totalRows[0]?.total || 0);
		const ventaIds = ventasPendientesRows.map((row) => row.ventaId);

		if (ventaIds.length === 0) {
			return NextResponse.json({
				ventas: [],
				pagination: {
					page,
					limit,
					total,
					totalPages: Math.ceil(total / limit),
				},
			});
		}

		const ventasRaw = await prisma.venta.findMany({
			where: {
				tenantId,
				ventaId: {
					in: ventaIds,
				},
				puntoDeVenta: { is: { tenantId } },
				AND: [
					{ OR: [{ productoId: null }, { producto: { is: { tenantId } } }] },
					{ OR: [{ empleadoId: null }, { empleado: { is: { tenantId } } }] },
					{ OR: [{ clienteId: null }, { cliente: { is: { tenantId } } }] },
				],
			},
			include: {
				producto: {
					select: {
						nombre: true,
						precioVenta: true,
					},
				},
				puntoDeVenta: {
					select: {
						nombre: true,
					},
				},
				empleado: {
					select: {
						nombre: true,
						apellido: true,
					},
				},
				cliente: {
					select: {
						nombre: true,
					},
				},
				reconciliaciones: {
					where: { tenantId },
					select: {
						monto: true,
					},
				},
			},
		});

		const pagosMap = new Map(
			ventasPendientesRows.map((row) => [
				row.ventaId,
				Number(row.totalPagado || 0),
			]),
		);
		const ventasMap = new Map(ventasRaw.map((venta) => [venta.ventaId, venta]));
		const ventasPaginadas = ventaIds
			.map((ventaId) => {
				const venta = ventasMap.get(ventaId);
				if (!venta) {
					return null;
				}

				const totalVenta = Number(venta.total || 0);
				const totalPagado = pagosMap.get(ventaId) || 0;
				const saldoPendiente = Math.max(0, totalVenta - totalPagado);

				return {
					...venta,
					saldoPendiente,
					totalPagado,
				};
			})
			.filter(Boolean);

		return NextResponse.json({
			ventas: ventasPaginadas,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		});
	} catch (error) {
		console.error("Error fetching pending sales:", error);
		return NextResponse.json(
			{ error: "Error interno del servidor", code: "INTERNAL_ERROR" },
			{ status: 500 },
		);
	}
}

// POST - Reconciliar venta con cuenta bancaria
export async function POST(request: NextRequest) {
	try {
		const authResultUser = await authenticateUser(request);
		if ("status" in authResultUser) return authResultUser as Response;
		const user = authResultUser.user;
		const tenantId = requireTenant(user);
		requireFeature(user, 'contabilidad', 'reconciliar ventas');
		requirePermission(user, 'financiero.contabilidad.acceder', 'reconciliar ventas');

		const body = await request.json();
		const validatedData = reconciliacionVentaSchema.parse(body);

		// Idempotencia durable: el reintento con la misma clave devuelve el
		// resultado previo; la misma clave con payload distinto se rechaza.
		const idempotencyKey = request.headers.get('Idempotency-Key')?.trim() || undefined;
		const idempotencyPayloadHash = idempotencyKey
			? hashReconciliacionPayload(validatedData)
			: undefined;
		if (idempotencyKey) {
			const existingByKey = await prisma.reconciliacionVenta.findFirst({
				where: { tenantId, idempotencyKey },
			});
			if (existingByKey) {
				if (existingByKey.idempotencyPayloadHash !== idempotencyPayloadHash) {
					return NextResponse.json(
						{
							error: 'La clave de idempotencia ya fue usada con otro payload',
							code: 'IDEMPOTENCY_CONFLICT',
						},
						{ status: 409 },
					);
				}
				return NextResponse.json(
					{
						message: 'Venta reconciliada exitosamente',
						reconciliacion: existingByKey,
					},
					{ status: 200 },
				);
			}
		}

		// Validar período contable antes de escribir
		const fechaOperacion = extraerFechaDeBody(body) ?? new Date();
		const validacionPeriodo = await validarEscrituraPeriodo({
			fecha: fechaOperacion,
			tenantId,
			tipoOperacion: "reconciliacion_ventas",
			actor: user.userId,
		});
		if (!validacionPeriodo.permitido) {
			return NextResponse.json(
				{
					error: validacionPeriodo.error?.message ?? "Período contable cerrado",
					code: validacionPeriodo.error?.code ?? "PERIODO_CERRADO",
				},
				{ status: 400 },
			);
		}

		const referenciaTransferenciaRaw =
			validatedData.verificacionTransferenciaId ||
			validatedData.idTransferencia;
		const referenciaTransferencia =
			referenciaTransferenciaRaw?.trim() || undefined;

		// Verificar que la venta existe
		const venta = await prisma.venta.findFirst({
			where: {
				ventaId: validatedData.ventaId,
				tenantId,
				AND: [
					{ OR: [{ productoId: null }, { producto: { is: { tenantId } } }] },
					{ puntoDeVenta: { is: { tenantId } } },
					{ OR: [{ empleadoId: null }, { empleado: { is: { tenantId } } }] },
					{ OR: [{ clienteId: null }, { cliente: { is: { tenantId } } }] },
					{ OR: [{ factura: null }, { factura: { is: { tenantId } } }] },
				],
			},
			include: {
				factura: true,
				cliente: true,
			},
		});

		if (!venta) {
			return NextResponse.json(
				{ error: "Venta no encontrada", code: "VENTA_NO_ENCONTRADA" },
				{ status: 404 },
			);
		}

		// Verificar que la cuenta bancaria existe y está activa
		const cuentaBancaria = await prisma.cuentaBancaria.findFirst({
			where: { cuentaId: validatedData.cuentaId, tenantId },
		});

		if (!cuentaBancaria || !cuentaBancaria.isActive) {
			return NextResponse.json(
				{
					error: "Cuenta bancaria no encontrada o inactiva",
					code: "CUENTA_NO_ENCONTRADA",
				},
				{ status: 404 },
			);
		}

		// Verificar que el tipo de pago existe y está activo
		const tipoPago = await prisma.tipoPago.findFirst({
			where: { tipoId: validatedData.tipoPagoId, tenantId },
		});

		if (!tipoPago || !tipoPago.isActive) {
			return NextResponse.json(
				{
					error: "Tipo de pago no encontrado o inactivo",
					code: "TIPO_PAGO_INACTIVO",
				},
				{ status: 404 },
			);
		}

		const tasaCambio = validatedData.tasaCambio
			? Number(validatedData.tasaCambio)
			: undefined;
		const montoBase = Number(validatedData.monto);
		const fechaReconciliacion = fechaOperacion;

		// Si el tipo de pago requiere cuenta, verificar cuenta defecto
		let cuentaOrigen = null;
		if (tipoPago.requiereCuenta && tipoPago.cuentaDefecto) {
			cuentaOrigen = await prisma.cuentaBancaria.findFirst({
				where: { cuentaId: tipoPago.cuentaDefecto, tenantId },
			});

			if (!cuentaOrigen || !cuentaOrigen.isActive) {
				return NextResponse.json(
					{
						error: "Cuenta bancaria de origen no encontrada o inactiva",
						code: "CUENTA_ORIGEN_INACTIVA",
					},
					{ status: 404 },
				);
			}
		}

		// Realizar la reconciliación en una transacción
		const result = await prisma.$transaction(
			async (tx: Prisma.TransactionClient) => {
				const policy = await getRequiredTenantAccountingPolicy(tenantId, tx);
				const functionalCurrency = policy.functionalCurrencyCode.trim().toUpperCase();
				const conversion = buildPersistedAccountingAmount(
					montoBase,
					validatedData.moneda,
					tasaCambio,
					fechaReconciliacion,
					undefined,
					functionalCurrency,
				);
				if (!conversion.fxEvidence || conversion.montoConvertido == null) {
					throw createReconciliacionError(
						400,
					'FX_INSUFICIENTE',
					'Falta evidencia FX funcional para el cobro',
					);
				}

				// Idempotencia por referencia de transferencia si fue enviada
				if (referenciaTransferencia) {
					const existingByReference = await tx.reconciliacionVenta.findFirst({
						where: {
							tenantId,
							ventaId: validatedData.ventaId,
							idTransferencia: referenciaTransferencia,
						},
						include: {
							venta: {
								include: {
									producto: true,
									puntoDeVenta: true,
									empleado: true,
									factura: true,
									cliente: true,
								},
							},
							cuentaBancaria: true,
							tipoPago: true,
						},
					});

					if (existingByReference) {
						return existingByReference;
					}
				}

				// Lock de filas críticas para evitar condiciones de carrera en sobrepago/saldos.
				if (venta.clienteId) {
					await bloquearClienteCredito(tx, tenantId, venta.clienteId);
				}
				await tx.$queryRaw`
        SELECT 1 FROM "Venta"
        WHERE "ventaId" = ${validatedData.ventaId}
          AND "tenantId" = ${tenantId}
        FOR UPDATE
      `;
				await tx.$queryRaw`
        SELECT 1 FROM "CuentaBancaria"
        WHERE "cuentaId" = ${validatedData.cuentaId}
          AND "tenantId" = ${tenantId}
        FOR UPDATE
      `;
				if (cuentaOrigen) {
					await tx.$queryRaw`
          SELECT 1 FROM "CuentaBancaria"
          WHERE "cuentaId" = ${cuentaOrigen.cuentaId}
            AND "tenantId" = ${tenantId}
          FOR UPDATE
        `;
				}

				const cuentaDestinoLocked = await tx.cuentaBancaria.findFirst({
					where: { cuentaId: validatedData.cuentaId, tenantId },
				});

				if (!cuentaDestinoLocked || !cuentaDestinoLocked.isActive) {
					throw createReconciliacionError(
						404,
						"CUENTA_NO_ENCONTRADA",
						"Cuenta bancaria no encontrada o inactiva",
					);
				}

				const movimientoDestino = resolveAccountingAccountMovement({
					tenderAmount: montoBase,
					tenderCurrency: validatedData.moneda,
					functionalAmount: conversion.montoConvertido,
					functionalCurrency,
					accountCurrency: cuentaDestinoLocked.moneda,
				});
				const montoDestino = movimientoDestino.amount.toNumber();

				let cuentaOrigenLocked: {
					cuentaId: string;
					saldo: number;
					moneda: string;
				} | null = null;
				let movimientoOrigen: ReturnType<typeof resolveAccountingAccountMovement> | null = null;
				if (cuentaOrigen) {
					cuentaOrigenLocked = await tx.cuentaBancaria.findFirst({
						where: { cuentaId: cuentaOrigen.cuentaId, tenantId },
						select: {
							cuentaId: true,
							saldo: true,
							moneda: true,
						},
					});

					if (!cuentaOrigenLocked) {
						throw createReconciliacionError(
							404,
							"CUENTA_ORIGEN_INACTIVA",
							"Cuenta bancaria de origen no encontrada o inactiva",
						);
					}

					movimientoOrigen = resolveAccountingAccountMovement({
						tenderAmount: montoBase,
						tenderCurrency: validatedData.moneda,
						functionalAmount: conversion.montoConvertido,
						functionalCurrency,
						accountCurrency: cuentaOrigenLocked.moneda,
					});
					const montoOrigen = movimientoOrigen.amount.toNumber();

					if (cuentaOrigenLocked.saldo < montoOrigen) {
						throw createReconciliacionError(
							400,
							"SALDO_INSUFICIENTE",
							"Saldo insuficiente en la cuenta de origen",
						);
					}
				}

				const facturaId = venta.factura?.idFactura;
				let existingCxC = facturaId
					? await tx.cuentaPorCobrar.findFirst({ where: { facturaId, tenantId } })
					: null;
				if (!existingCxC) {
					const numeroFacturaCandidates = getNumeroFacturaCandidates(
						venta.ordenId,
						venta.factura?.numeroFactura,
					);
					if (numeroFacturaCandidates.length > 0) {
						existingCxC = await tx.cuentaPorCobrar.findFirst({
							where: {
								tenantId,
								numeroFactura: { in: numeroFacturaCandidates },
							},
							orderBy: { updatedAt: 'desc' },
						});
					}
				}
				if (existingCxC?.estado === 'ANULADA') {
					throw createReconciliacionError(400, 'CXC_ANULADA', 'La cuenta por cobrar está anulada');
				}
				const modoFormal = process.env.CONTABILIDAD_FORMAL_MODE;

				const reconciliacionesPrevias = await tx.reconciliacionVenta.findMany({
					where: { ventaId: validatedData.ventaId, tenantId },
					select: {
						monto: true,
						moneda: true,
						montoConvertido: true,
						functionalCurrency: true,
						fxEvidenceFingerprint: true,
					},
				});

				const monedaFuncionalCxC = existingCxC?.monedaFuncional?.trim().toUpperCase() ||
					conversion.fxEvidence?.functionalCurrency.trim().toUpperCase() || 'CUP';
				const monedaOriginalCxC = existingCxC?.monedaOriginal?.trim().toUpperCase() ||
					monedaFuncionalCxC;
				const cxcTieneSnapshot = existingCxC != null &&
					Boolean(existingCxC.monedaOriginal && existingCxC.monedaFuncional &&
						existingCxC.montoOriginal != null && existingCxC.montoDeudaFuncional != null &&
						existingCxC.tasaCambio != null && existingCxC.fxEvidenceFingerprint &&
						existingCxC.fxEvidenceVersion === 2);
				if (existingCxC && !cxcTieneSnapshot &&
					(modoFormal === 'enforce' || modoFormal === 'shadow')) {
					throw createReconciliacionError(
						400,
						'FX_INSUFICIENTE',
						'La cuenta por cobrar no conserva una valoración funcional verificable',
					);
				}

				if (existingCxC && cxcTieneSnapshot) {
					try {
						const canonical = buildAppliedFxEvidenceExact({
							originalAmount: existingCxC.montoOriginal!,
							originalCurrency: monedaOriginalCxC,
							functionalCurrency: monedaFuncionalCxC,
							exchangeRate: existingCxC.tasaCambio!,
							convertedAmount: existingCxC.montoDeudaFuncional!,
							rateEffectiveAt: existingCxC.rateEffectiveAt,
							source: existingCxC.fxProvenanceSource!,
							fxCatalogRateId: existingCxC.fxCatalogRateId,
							fxProvenanceKind: monedaOriginalCxC === monedaFuncionalCxC
								? undefined
								: existingCxC.fxProvenanceKind as 'CATALOG_RATE' | 'MANUAL_GOVERNED',
						});
						if (
							canonical.evidence.fxEvidenceFingerprint !== existingCxC.fxEvidenceFingerprint ||
							canonical.evidence.fxEvidenceVersion !== existingCxC.fxEvidenceVersion ||
							!new Prisma.Decimal(existingCxC.montoOriginal!).eq(existingCxC.montoDeuda)
						) {
							throw new Error('SNAPSHOT_CXC_FINGERPRINT_MISMATCH');
						}
					} catch {
						throw createReconciliacionError(
							400,
							'FX_INSUFICIENTE',
							'La evidencia de la cuenta por cobrar no coincide con su saldo reconocido',
						);
					}
				}

				if (existingCxC && monedaOriginalCxC !== monedaFuncionalCxC &&
					validatedData.moneda.trim().toUpperCase() !== monedaOriginalCxC) {
					throw createReconciliacionError(
						400,
						'FX_INSUFICIENTE',
						'El cobro debe coincidir con la moneda original de la cuenta por cobrar',
					);
				}

				const reconciliacionesFuncionales: Prisma.Decimal[] = [];
				for (const previo of reconciliacionesPrevias) {
					if (
						previo.montoConvertido == null ||
						!previo.fxEvidenceFingerprint ||
						previo.functionalCurrency?.trim().toUpperCase() !== monedaFuncionalCxC ||
						(existingCxC && monedaOriginalCxC !== monedaFuncionalCxC &&
							previo.moneda.trim().toUpperCase() !== monedaOriginalCxC)
					) {
						if (modoFormal === 'enforce' || modoFormal === 'shadow') {
							throw createReconciliacionError(
								400,
								'FX_INSUFICIENTE',
								'Un cobro previo no conserva una valoración funcional homogénea',
							);
						}
						if (previo.moneda.trim().toUpperCase() !== functionalCurrency) {
							throw createReconciliacionError(
								400,
								'FX_INSUFICIENTE',
								'Un cobro histórico sin evidencia funcional no se puede convertir de forma segura',
							);
						}
						reconciliacionesFuncionales.push(new Prisma.Decimal(previo.monto));
						continue;
					}
					reconciliacionesFuncionales.push(new Prisma.Decimal(previo.montoConvertido));
				}
				const totalPagadoFuncionalPrevio = reconciliacionesFuncionales.reduce(
					(sum, monto) => sum.plus(monto),
					new Prisma.Decimal(0),
				);
				const totalPagadoNominalPrevio = reconciliacionesPrevias.reduce(
					(sum, rec, index) => sum.plus(
						existingCxC && monedaOriginalCxC !== monedaFuncionalCxC
							? rec.monto
							: reconciliacionesFuncionales[index],
					),
					new Prisma.Decimal(0),
				);
				const montoPagoNominalCxC = existingCxC &&
					monedaOriginalCxC !== monedaFuncionalCxC
					? new Prisma.Decimal(validatedData.monto)
					: new Prisma.Decimal(conversion.montoConvertido!);
				const totalPagadoNominal = totalPagadoNominalPrevio.plus(montoPagoNominalCxC);
				const totalPagadoFuncional = totalPagadoFuncionalPrevio.plus(conversion.montoConvertido!);
				const totalVenta = new Prisma.Decimal(venta.total || 0);
				const deudaNominal = existingCxC
					? new Prisma.Decimal(existingCxC.montoDeuda)
					: totalVenta;
				const nuevoTotalPagado = totalPagadoNominal;
				if (nuevoTotalPagado.gt(deudaNominal.plus('0.1'))) {
					throw createReconciliacionError(
						400,
						"MONTO_EXCEDIDO",
						`El monto excede el saldo pendiente. Total: ${deudaNominal.toFixed(2)} ${monedaOriginalCxC}, ` +
							`Pagado: ${totalPagadoNominalPrevio.toFixed(2)}, ` +
							`Intento: ${montoPagoNominalCxC.toFixed(2)}`,
					);
				}
				const saldoRestante = existingCxC
					? Math.max(deudaNominal.minus(totalPagadoNominal).toNumber(), 0)
					: Math.max(totalVenta.minus(totalPagadoFuncional).toNumber(), 0);
				const nuevoEstado: 'PENDIENTE' | 'PARCIAL' | 'PAGADA' = saldoRestante <= 0.01
					? 'PAGADA'
					: totalPagadoNominal.gt(0) ? 'PARCIAL' : 'PENDIENTE';
				let diferenciaFxCxc = new Prisma.Decimal(0);
				if (existingCxC && cxcTieneSnapshot && monedaOriginalCxC !== monedaFuncionalCxC) {
					diferenciaFxCxc = AccountingReconciliationService.calcularDiferenciaFxCxc(
						existingCxC,
						validatedData.moneda,
						totalPagadoNominalPrevio,
						totalPagadoNominal,
						conversion,
					);
				}
				// Crear la reconciliación
				let reconciliacion;
				try {
					reconciliacion = await tx.reconciliacionVenta.create({
						data: {
							tenantId: venta.tenantId,
							ventaId: validatedData.ventaId,
							cuentaId: validatedData.cuentaId,
							tipoPagoId: validatedData.tipoPagoId,
						monto: validatedData.monto,
						moneda: validatedData.moneda,
						montoCuenta: movimientoDestino.amount,
						monedaCuenta: movimientoDestino.currency,
						...(movimientoOrigen && cuentaOrigenLocked
							? {
								cuentaOrigenId: cuentaOrigenLocked.cuentaId,
								montoCuentaOrigen: movimientoOrigen.amount,
								monedaCuentaOrigen: movimientoOrigen.currency,
							}
							: {}),
						tasaCambio: conversion.tasaCambio,
							montoConvertido: conversion.montoConvertido,
							fechaReconciliacion,
							...conversion.fxEvidence,
							verificacionTransferenciaId: referenciaTransferencia,
							...(validatedData.observaciones != null && {
								observaciones: validatedData.observaciones,
							}),
							idTransferencia: referenciaTransferencia,
							idempotencyKey,
							idempotencyPayloadHash,
							reconciliadoPor: user.userId,
						},
						include: {
							venta: {
								include: {
									producto: true,
									puntoDeVenta: true,
									empleado: true,
									factura: true,
									cliente: true,
								},
							},
							cuentaBancaria: true,
							tipoPago: true,
						},
					});
				} catch (createError) {
					if (
						createError instanceof Prisma.PrismaClientKnownRequestError &&
						createError.code === 'P2002' &&
						idempotencyKey
					) {
						const replay = await tx.reconciliacionVenta.findFirst({
							where: { tenantId, idempotencyKey },
						});
						if (replay && replay.idempotencyPayloadHash === idempotencyPayloadHash) {
							return replay;
						}
						throw createReconciliacionError(
							409,
							'IDEMPOTENCY_CONFLICT',
							'La clave de idempotencia ya fue usada con otro payload',
						);
					}
					throw createError;
				}

					// Capa de contabilidad formal (CTA-1): cobro legacy de venta.
					await postEvento(
						tx,
						{ tenantId: venta.tenantId, userId: user.userId },
						(venta.factura ? buildEventoCobroCxc : buildEventoVentaContado)({
							reconciliacionId: reconciliacion.reconciliacionId,
							fecha: reconciliacion.fechaReconciliacion,
						tesoreria: {
							monto: reconciliacion.monto,
							moneda: reconciliacion.moneda || 'CUP',
								montoFuncional: reconciliacion.montoConvertido ?? reconciliacion.monto,
								tasaCambio: reconciliacion.tasaCambio ?? null,
									
								fxEvidenceFingerprint: reconciliacion.fxEvidenceFingerprint,
								diferenciaFx: diferenciaFxCxc,
								monedaFuncionalCodigo: reconciliacion.functionalCurrency ?? functionalCurrency,
								tipoCuenta: cuentaDestinoLocked?.tipoCuenta ?? null,
								referencia: referenciaTransferencia,
							},
							descripcion: validatedData.observaciones ?? undefined,
						}),
					);

					// Actualizar el saldo de las cuentas bancarias
				const saldoIncrementoDestino = parseFloat(montoDestino.toString());

				if (cuentaOrigen && tipoPago.cuentaDefecto !== validatedData.cuentaId) {
					const montoOrigen = movimientoOrigen?.amount.toNumber();
					if (montoOrigen == null) {
						throw createReconciliacionError(
							400,
						'FX_INSUFICIENTE',
						'No se pudo resolver el movimiento de la cuenta origen',
						);
					}
					const saldoDecrementoOrigen = montoOrigen;

					// Transferir: decrementar de cuenta origen e incrementar en cuenta destino
					const cuentaOrigenUpdate = await tx.cuentaBancaria.updateMany({
						where: { cuentaId: tipoPago.cuentaDefecto!, tenantId },
						data: {
							saldo: {
								decrement: saldoDecrementoOrigen,
							},
						},
					});
					if (cuentaOrigenUpdate.count !== 1) {
						throw createReconciliacionError(
							404,
							"CUENTA_ORIGEN_INACTIVA",
							"Cuenta bancaria de origen no encontrada o inactiva",
						);
					}

					const cuentaDestinoUpdate = await tx.cuentaBancaria.updateMany({
						where: { cuentaId: validatedData.cuentaId, tenantId },
						data: {
							saldo: {
								increment: saldoIncrementoDestino,
							},
						},
					});
					if (cuentaDestinoUpdate.count !== 1) {
						throw createReconciliacionError(
							404,
							"CUENTA_NO_ENCONTRADA",
							"Cuenta bancaria no encontrada o inactiva",
						);
					}
				} else {
					// Solo incrementar en la cuenta destino
					const cuentaDestinoUpdate = await tx.cuentaBancaria.updateMany({
						where: { cuentaId: validatedData.cuentaId, tenantId },
						data: {
							saldo: {
								increment: saldoIncrementoDestino,
							},
						},
					});
					if (cuentaDestinoUpdate.count !== 1) {
						throw createReconciliacionError(
							404,
							"CUENTA_NO_ENCONTRADA",
							"Cuenta bancaria no encontrada o inactiva",
						);
					}
				}

				// Registrar la transacción de moneda si hubo tasa de cambio
				if (validatedData.tasaCambio) {
					await tx.transaccionMoneda.create({
						data: {
							tenantId,
							tipoTransaccion: "venta",
							referenciaId: validatedData.ventaId,
							monedaId: validatedData.moneda,
							montoOriginal: validatedData.monto,
							tasaCambio: validatedData.tasaCambio,
							montoConvertido: montoDestino,
						},
					});
				}

				// --- Lógica de Cuentas por Cobrar ---
				// Buscar si existe CuentaPorCobrar
				const ventaRec = venta;
				if (!ventaRec) {
					throw createReconciliacionError(
						500,
						"VENTA_NOT_FOUND",
						"Venta no encontrada tras reconciliación",
					);
				}
				// Solo procedemos si hay cliente (requisito de CxC)
				if (ventaRec.clienteId) {
					// Delta neto de exposición dentro de la tx: materializar una CxC
					// faltante o cambios que eleven el saldo vivo (p. ej. reactivar una
					// cuenta ANULADA) consumen cupo del origen probado (venta de
					// productos) y exigen override explícito auditado.
					const saldoPrevioCxc = existingCxC
						? Math.max(Number(existingCxC.montoDeuda) - Number(existingCxC.montoPagado), 0)
						: 0;
					const saldoPosteriorCxc = existingCxC
						? Math.max(Number(existingCxC.montoDeuda) - totalPagadoNominal.toNumber(), 0)
						: saldoRestante;
					const deltaNetoCxc = saldoPosteriorCxc - saldoPrevioCxc;
					const decisionCredito = deltaNetoCxc > 0.01
						? await validarCreditoOrigen({
							tx,
							user,
							tenantId,
							clienteId: ventaRec.clienteId,
							moneda: existingCxC?.monedaOriginal ?? "CUP",
							montoNuevo: deltaNetoCxc,
							permiso: 'ventas.venta.credito-override',
							solicitarCreditoOverride: validatedData.solicitarCreditoOverride,
							motivoCreditoOverride: validatedData.motivoCreditoOverride,
							clienteLockAdquirido: true,
						})
						: null;

					if (existingCxC) {
						// Actualizar existente
						const updatedCxC = await tx.cuentaPorCobrar.updateMany({
							where: { id: existingCxC.id, tenantId },
							data: {
								montoPagado: totalPagadoNominal,
								montoPagadoFuncional: totalPagadoFuncional,
								estado: nuevoEstado,
								// Actualizamos idTransferencia con el último pago para referencia rápida
								idTransferencia:
									referenciaTransferencia || existingCxC.idTransferencia,
							},
						});
						if (updatedCxC.count !== 1) {
							throw createReconciliacionError(404, 'CXC_NO_ENCONTRADA', 'Cuenta por cobrar no encontrada');
						}
					} else if (saldoRestante > 0.01) {
						// La nueva obligación se crea en moneda funcional con evidencia de identidad.
						const monedaDeuda = monedaFuncionalCxC;
						const montoDeudaFuncional = totalVenta;
						const snapshotCxC = buildAppliedFxEvidenceExact({
							originalAmount: totalVenta,
							originalCurrency: monedaDeuda,
							functionalCurrency: monedaDeuda,
							source: 'legacy-reconciliacion-ventas-cxc',
						});
						await tx.cuentaPorCobrar.create({
							data: {
								tenantId: venta.tenantId,
								clienteId: ventaRec.clienteId,
								facturaId: facturaId,
								numeroFactura:
									ventaRec.ordenId || ventaRec.factura?.numeroFactura, // Usar ordenId o factura
								montoDeuda: montoDeudaFuncional,
								montoPagado: totalPagadoFuncional,
								montoPagadoFuncional: totalPagadoFuncional,
								monedaOriginal: monedaDeuda,
								montoOriginal: montoDeudaFuncional,
								montoDeudaFuncional,
								monedaFuncional: monedaDeuda,
								tasaCambio: snapshotCxC.tasaCambio,
								fxProvenanceKind: snapshotCxC.evidence.fxProvenanceKind,
								fxProvenanceSource: snapshotCxC.evidence.fxProvenanceSource,
								fxCatalogRateId: snapshotCxC.evidence.fxCatalogRateId,
								fxEvidenceJson: { ...snapshotCxC.evidence },
								fxEvidenceFingerprint: snapshotCxC.evidence.fxEvidenceFingerprint,
								fxEvidenceVersion: snapshotCxC.evidence.fxEvidenceVersion,
								estado: nuevoEstado,
								idTransferencia: referenciaTransferencia,
							},
						});
					}

					if (decisionCredito) {
						await auditarCreditoOverride({
							tx,
							user,
							decision: decisionCredito,
							tenantId,
							clienteId: ventaRec.clienteId,
							origen: 'RECONCILIACION_VENTA',
							origenId: reconciliacion.reconciliacionId,
							montoNuevo: deltaNetoCxc,
						});
					}
				}

				await AuditLogService.logStrict({
					accion: 'CREATE',
					entidad: 'RECONCILIACION',
					entidadId: reconciliacion.reconciliacionId,
					usuarioId: user.userId,
					detalles: {
						tipo: 'VENTA',
						ventaId: reconciliacion.ventaId,
						cuentaId: reconciliacion.cuentaId,
						tipoPagoId: reconciliacion.tipoPagoId,
						monto: Number(reconciliacion.monto),
						moneda: reconciliacion.moneda,
						montoConvertido: Number(reconciliacion.montoConvertido),
					},
				}, tx);

				return reconciliacion;
			},
		);

		// Invalidar caché de Next.js para que RSC y Server Actions vean datos frescos
		revalidatePath("/busy/contabilidad/reconciliacion");
		revalidatePath("/busy/contabilidad/cuentas-por-cobrar");

		return NextResponse.json(
			{
				message: "Venta reconciliada exitosamente",
				reconciliacion: result,
			},
			{ status: 201 },
		);
	} catch (error) {
		if (error instanceof ActionError) {
			const status = error.code === 'FORBIDDEN'
				? 403
				: error.code === 'NOT_FOUND'
					? 404
					: 400;
			return NextResponse.json(
				{ error: error.message, code: error.code },
				{ status },
			);
		}

		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{ error: "Datos de entrada inválidos", details: error.errors },
				{ status: 400 },
			);
		}

		const maybeValidationError = error as Error & {
			status?: number;
			code?: string;
		};
		if (maybeValidationError.status && maybeValidationError.code) {
			return NextResponse.json(
				{
					error: maybeValidationError.message,
					code: maybeValidationError.code,
				},
				{ status: maybeValidationError.status },
			);
		}

		console.error("Error reconciling sale:", error);
		return NextResponse.json(
			{ error: "Error interno del servidor", code: "INTERNAL_ERROR" },
			{ status: 500 },
		);
	}
}
