/**
 * @description Server Actions para gestión de períodos contables.
 *
 * Proporciona queries y mutations para apertura, cierre, reapertura
 * y aprobación de períodos contables. Usa el patrón withAction + requireTenant
 * para autenticación y aislamiento multi-tenant.
 *
 * @module actions-periodos
 */

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { withAction, ActionError } from "@/lib/server-actions";
import { hasPermission, requireFeature, requirePermission, requireTenant } from "@/lib/services/tenant-scope";
import type { AuthenticatedUser } from "@/lib/auth-middleware";
import { PeriodoContableService } from "@/lib/services/periodo-contable-service";
import { AperturaPeriodoService } from "@/lib/services/apertura-periodo-service";
import { AuditLogService } from "@/lib/services/audit-log-service";
import { invalidateCache } from "@/lib/services/periodo-contable-guard";
import {
	TipoPeriodo,
	EstadoPeriodo,
	CategoriaPeriodo,
	ModoContable,
} from "@/lib/services/periodo-contable-types";
import { getAccountingYear } from "@/lib/services/fecha-operacion-registry";
import { isTenantAdminRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { Prisma, type Prisma as PrismaTypes } from "@/generated/prisma";
import { getCurrentBalance } from "@/features/contabilidad/services/current-balance-service";
import { getReconciledResultForYear } from "@/features/contabilidad/services/reconciled-result-service";
import {
	captureFinancialAuxiliaryCheckpoint,
	collectFinancialAuxiliaryEvidence,
	type FinancialAuxiliaryCheckpointPayload,
	} from "@/features/contabilidad/services/financial-auxiliary-checkpoint-service";
import { acquireAccountingTenantLock } from "@/features/contabilidad/services/accounting-tenant-lock-service";
import {
	approveFinancialSnapshotV3,
	captureFinancialSnapshotV3,
} from "@/features/contabilidad/services/financial-snapshot-v3-service";
import { hashImmutableFinancialEvidence } from "@/features/contabilidad/services/immutable-financial-evidence";
import { buildAppliedFxEvidence, verifyAppliedFxEvidence } from "@/features/contabilidad/domain/fx-evidence";
import { exchangeRateProvider } from "@/features/contabilidad/services/exchange-rate-provider";
import { insertarAsientoConNumeracion } from "@/features/contabilidad-formal/services/posting-engine";
import { isFinancialV3CaptureEnabled } from "@/features/contabilidad/config/financial-v3-capture";
import { getRequiredTenantAccountingPolicy } from "@/features/contabilidad/services/tenant-accounting-policy-service";
import {
	obtenerBalanceConVariacion,
	obtenerVentasVsReconciliado,
	obtenerResumenDiario,
	obtenerOperacionesPeriodo,
} from "@/features/contabilidad/cuadre-queries";

// ── Period Lock Check (para bloqueos visuales en UI) ─────────────────────


function requirePeriodManagementAccess(user: AuthenticatedUser, action: string): void {
  requireFeature(user, 'contabilidad', action);
}
 


const checkLockSchema = z.object({
	fecha: z.string().min(1, "Fecha requerida"),
});

/**
 * @description Verifica si una fecha (ISO string) está bloqueada por un período contable cerrado.
 * Útil para bloqueos visuales en formularios client-side.
 *
 * @param {Object} params - { fecha: string } — fecha ISO o "YYYY-MM".
 * @param {AuthenticatedUser} user - Usuario autenticado (inyectado por withAction).
 * @returns {Promise<{ isLocked: boolean; message: string | null; periodo: { nombre: string; estado: string } | null }>}
 */
export const checkPeriodLockAction = withAction(
	async (params: z.infer<typeof checkLockSchema>, user: AuthenticatedUser) => {
		const parsed = checkLockSchema.parse(params);
		const tenantId = requireTenant(user);

		// Si es formato YYYY-MM, usar el primer día del mes
		const fecha = /^\d{4}-\d{2}$/.test(parsed.fecha)
			? new Date(`${parsed.fecha}-01`)
			: new Date(parsed.fecha);

		const result = await PeriodoContableService.validarEscritura(
			fecha,
			tenantId,
		);

		if (!result.permitido && result.periodo) {
			return {
				isLocked: true,
				periodo: {
					nombre: result.periodo.label,
					estado: result.periodo.estado,
				},
				message: `El período ${result.periodo.label} está en estado ${result.periodo.estado === "CERRADO" ? "Cerrado" : result.periodo.estado === "APROBADO" ? "Aprobado" : result.periodo.estado}. No permite escrituras.`,
			};
		}

		return { isLocked: false, message: null, periodo: null };
	},
);

// ── Schemas de validación ─────────────────────────────────────────────────

/**
 * Schema para abrir un nuevo período contable.
 * Valida tipo, fechas ISO y observaciones opcionales.
 */
const abrirPeriodoSchema = z.object({
	tipo: z.enum(["DIARIO", "MENSUAL", "TRIMESTRAL", "SEMESTRAL", "ANUAL"]),
	fechaInicio: z
		.string()
		.datetime({ message: "La fecha de inicio debe ser una fecha válida" }),
	fechaFin: z
		.string()
		.datetime({ message: "La fecha de fin debe ser una fecha válida" }),
	observaciones: z.string().max(500).optional(),
	categoria: z.enum(["ORDINARIO", "EXTRAORDINARIO", "RECTIFICATIVO"]).optional(),
	modoContable: z.nativeEnum(ModoContable).optional(),
});

const manualOpeningLineFields = {
	cuentaCodigo: z.string().trim().min(1).max(32),
	moneda: z.string().trim().regex(/^[A-Z]{3,8}$/),
	debito: z.string().regex(/^\d+(\.\d{1,4})?$/),
	credito: z.string().regex(/^\d+(\.\d{1,4})?$/),
	lineId: z.string().min(1).optional(),
	fxEvidenceId: z.string().trim().min(1).optional(),
};
const validateManualOpeningLine = (line: { debito: string; credito: string }, ctx: z.RefinementCtx) => {
	if ((Number(line.debito) > 0) === (Number(line.credito) > 0)) {
		ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Indique débito o crédito, no ambos" });
	}
};
const manualOpeningLineSchema = z.object(manualOpeningLineFields).superRefine(validateManualOpeningLine);

const manualOpeningLineInputSchema = z.object({
	cuentaCodigo: manualOpeningLineFields.cuentaCodigo,
	moneda: manualOpeningLineFields.moneda,
	debito: manualOpeningLineFields.debito,
	credito: manualOpeningLineFields.credito,
}).strict().superRefine(validateManualOpeningLine);

const solicitudAperturaSchema = abrirPeriodoSchema.extend({
	idempotencyKey: z.string().trim().min(1).max(64),
	lineas: z.array(manualOpeningLineInputSchema).min(2).max(500),
});

const solicitudIdSchema = z.object({ solicitudId: z.string().min(1) });

/** @description Lista solicitudes persistidas para el responsable contable. */
export const listarSolicitudesAperturaManualAction = withAction(
	async (_input: Record<string, never> = {}, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);
		requirePeriodManagementAccess(user, "consultar solicitudes de apertura manual");
		const canReviewAll = hasPermission(user, "financiero.apertura.aprobar");
		const solicitudes = await prisma.aperturaPeriodoSolicitud.findMany({
			where: {
				tenantId,
				...(!canReviewAll ? { solicitadaPor: user.userId } : {}),
				estado: { in: ["PENDIENTE", "APROBADA"] },
			},
			orderBy: { createdAt: "desc" },
			take: 50,
			select: {
				solicitudId: true,
				tipo: true,
				fechaInicio: true,
				fechaFin: true,
				functionalCurrencyCode: true,
				estado: true,
				solicitadaPor: true,
				aprobadaPor: true,
				createdAt: true,
			},
		});
		return { solicitudes };
	},
);

/** @description Lee el detalle persistido de una solicitud aprobable del tenant. */
export const obtenerSolicitudAperturaManualAction = withAction(
	async (input: z.infer<typeof solicitudIdSchema>, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);
		requirePeriodManagementAccess(user, "revisar solicitud de apertura manual");
		const { solicitudId } = solicitudIdSchema.parse(input);
		return prisma.$transaction(async (tx) => {
		const solicitud = await tx.aperturaPeriodoSolicitud.findFirst({
			where: { solicitudId, tenantId, estado: { in: ["PENDIENTE", "APROBADA"] } },
			select: {
				solicitudId: true,
				tipo: true,
				fechaInicio: true,
				fechaFin: true,
				observaciones: true,
				categoria: true,
				modoContable: true,
				functionalCurrencyCode: true,
				lineas: true,
				estado: true,
				solicitadaPor: true,
				aprobadaPor: true,
				aprobadaAt: true,
				hashAprobacion: true,
				createdAt: true,
				tenantId: true,
			},
		});
		if (!solicitud) throw new ActionError("Solicitud no encontrada", "NOT_FOUND");
		if (!hasPermission(user, "financiero.apertura.aprobar") && solicitud.solicitadaPor !== user.userId) {
			throw new ActionError("Solicitud no encontrada", "NOT_FOUND");
		}
		const policy = await getRequiredTenantAccountingPolicy(tenantId, tx);
		if (policy.functionalCurrencyCode !== solicitud.functionalCurrencyCode) {
			throw new ActionError("La moneda funcional cambió; revise la solicitud", "APERTURA_SALDOS_NO_VERIFICABLES");
		}
		const lines = z.array(manualOpeningLineSchema).parse(solicitud.lineas);
		const verification = await verifyManualOpening(
			tx, tenantId, policy.functionalCurrencyCode, solicitud.solicitudId, solicitud.fechaInicio, lines,
		);
		const previewHash = hashImmutableFinancialEvidence({
			solicitudId, tenantId, functionalCurrencyCode: policy.functionalCurrencyCode,
			fechaInicio: solicitud.fechaInicio.toISOString(), fechaFin: solicitud.fechaFin.toISOString(),
			tipo: solicitud.tipo, categoria: solicitud.categoria, modoContable: solicitud.modoContable,
			observaciones: solicitud.observaciones, lineas: solicitud.lineas,
			fxFingerprints: verification.fingerprints, lineasValuadas: verification.valuedLines,
		});
		if (solicitud.estado === "APROBADA") {
			const approvedHash = hashImmutableFinancialEvidence({
				solicitudId, tenantId, solicitedBy: solicitud.solicitadaPor,
				approvedBy: solicitud.aprobadaPor, approvedAt: solicitud.aprobadaAt?.toISOString(),
				functionalCurrencyCode: policy.functionalCurrencyCode,
				fechaInicio: solicitud.fechaInicio.toISOString(), fechaFin: solicitud.fechaFin.toISOString(),
				tipo: solicitud.tipo, categoria: solicitud.categoria, modoContable: solicitud.modoContable,
				observaciones: solicitud.observaciones, lineas: solicitud.lineas,
				fxFingerprints: verification.fingerprints, lineasValuadas: verification.valuedLines,
			});
			if (!solicitud.hashAprobacion || approvedHash !== solicitud.hashAprobacion) {
				throw new ActionError("La evidencia aprobada ya no se puede verificar", "APERTURA_SALDOS_NO_VERIFICABLES");
			}
		}
		return { solicitud: { ...solicitud, lineasValuadas: verification.valuedLines, previewHash } };
		}, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
	},
);

async function verifyManualOpening(
	db: PrismaTypes.TransactionClient | typeof prisma,
	tenantId: string,
	functionalCurrencyCode: string,
	solicitudId: string,
	fechaInicio: Date,
	lineas: z.infer<typeof manualOpeningLineSchema>[],
) {
	const accounts = await db.cuentaContable.findMany({
		where: { tenantId, codigo: { in: lineas.map((line) => line.cuentaCodigo) }, activa: true, aceptaMovimiento: true },
		select: { cuentaContableId: true, codigo: true },
	});
	if (new Set(accounts.map((account) => account.codigo)).size !== new Set(lineas.map((line) => line.cuentaCodigo)).size) {
		throw new ActionError("Una o más cuentas no existen, no pertenecen a la empresa o no aceptan movimientos", "APERTURA_SALDOS_NO_VERIFICABLES");
	}
	let debitos = new Prisma.Decimal(0);
	let creditos = new Prisma.Decimal(0);
	const valuedLines: Array<{
		cuentaCodigo: string; cuentaContableId: string; moneda: string; debito: string; credito: string;
		debitoFuncional: string; creditoFuncional: string; tasaCambio: string | null;
		fxEvidenceId: string | null; fxEvidenceFingerprint: string | null;
		monedaFuncional: string; fxEvidence: null | {
			sourceType: string; sourceId: string; originalAmount: string; originalCurrency: string;
			functionalAmount: string; functionalCurrency: string; rateEffectiveAt: string;
			cutoffAt: string; provenance: string; source: string; fxCatalogRateId: string | null;
			evidenceFingerprint: string; evidenceVersion: number;
		};
	}> = [];
	const accountByCode = new Map(accounts.map((account) => [account.codigo, account.cuentaContableId]));
	const usedFxEvidenceIds = new Set<string>();
	for (const line of lineas) {
		const debit = new Prisma.Decimal(line.debito);
		const credit = new Prisma.Decimal(line.credito);
		if (line.moneda === functionalCurrencyCode) {
			if (line.fxEvidenceId) throw new ActionError("No se admite FX para la moneda funcional", "APERTURA_SALDOS_NO_VERIFICABLES");
			debitos = debitos.add(debit);
			creditos = creditos.add(credit);
			valuedLines.push({
				cuentaCodigo: line.cuentaCodigo, cuentaContableId: accountByCode.get(line.cuentaCodigo)!,
				moneda: line.moneda, debito: debit.toString(), credito: credit.toString(),
				monedaFuncional: functionalCurrencyCode,
				debitoFuncional: debit.toString(), creditoFuncional: credit.toString(),
				tasaCambio: null, fxEvidenceId: null, fxEvidenceFingerprint: null, fxEvidence: null,
			});
			continue;
		}
		if (!line.fxEvidenceId || usedFxEvidenceIds.has(line.fxEvidenceId)) {
			throw new ActionError("No se admite reutilizar una evidencia FX en varias líneas", "APERTURA_SALDOS_NO_VERIFICABLES");
		}
		if (!line.lineId) throw new ActionError("La línea FX no está vinculada a una solicitud verificable", "APERTURA_SALDOS_NO_VERIFICABLES");
		usedFxEvidenceIds.add(line.fxEvidenceId);
		const accountId = accountByCode.get(line.cuentaCodigo)!;
		const expectedSourceId = `${solicitudId}:${line.lineId}:${accountId}`;
		const fx = await db.fxEvidence.findFirst({
			where: {
				fxEvidenceId: line.fxEvidenceId,
				tenantId,
				sourceType: "MANUAL_OPENING_LINE",
				sourceId: expectedSourceId,
				originalAmount: debit.greaterThan(0) ? debit : credit,
				originalCurrency: line.moneda,
				functionalCurrency: functionalCurrencyCode,
			cutoffAt: { lte: fechaInicio },
			},
			select: {
				fxEvidenceId: true, sourceType: true, sourceId: true, originalAmount: true, originalCurrency: true,
				functionalAmount: true, functionalCurrency: true, exchangeRate: true, rateEffectiveAt: true,
				cutoffAt: true, fxCatalogRateId: true, provenance: true, source: true,
				evidence: true, evidenceFingerprint: true, evidenceVersion: true,
			},
		});
		if (!fx || fx.sourceType !== "MANUAL_OPENING_LINE" || fx.sourceId !== expectedSourceId) {
			throw new ActionError("La evidencia FX no corresponde a esta solicitud, línea, cuenta, fecha o moneda", "APERTURA_SALDOS_NO_VERIFICABLES");
		}
		if (fx.rateEffectiveAt > fx.cutoffAt || fx.rateEffectiveAt > fechaInicio) {
			throw new ActionError("La fecha efectiva de la tasa no corresponde al corte de la evidencia", "APERTURA_SALDOS_NO_VERIFICABLES");
		}
		const verifiedFx = verifyAppliedFxEvidence({
			originalAmount: Number(fx.originalAmount), originalCurrency: fx.originalCurrency,
			functionalCurrency: fx.functionalCurrency, convertedAmount: Number(fx.functionalAmount),
			exchangeRate: Number(fx.exchangeRate), rateEffectiveAt: fx.rateEffectiveAt,
			fxProvenanceKind: fx.provenance, fxProvenanceSource: fx.source,
			fxCatalogRateId: fx.fxCatalogRateId, fxEvidenceFingerprint: fx.evidenceFingerprint,
			fxEvidenceVersion: fx.evidenceVersion,
		});
		const embeddedEvidence = fx.evidence as Record<string, unknown>;
		if (!verifiedFx || embeddedEvidence?.fxEvidenceFingerprint !== fx.evidenceFingerprint ||
			embeddedEvidence?.fxProvenanceKind !== fx.provenance ||
			embeddedEvidence?.fxProvenanceSource !== fx.source ||
			embeddedEvidence?.fxEvidenceVersion !== fx.evidenceVersion ||
			embeddedEvidence?.solicitudId !== solicitudId ||
			embeddedEvidence?.lineId !== line.lineId ||
			embeddedEvidence?.cuentaContableId !== accountId ||
			embeddedEvidence?.cutoffAt !== fx.cutoffAt.toISOString() ||
			embeddedEvidence?.originalAmount !== fx.originalAmount.toString() ||
			embeddedEvidence?.functionalAmount !== fx.functionalAmount.toString() ||
			embeddedEvidence?.exchangeRate !== fx.exchangeRate.toString()) {
			throw new ActionError("La evidencia FX no coincide con la conversión y huella canónicas", "APERTURA_SALDOS_NO_VERIFICABLES");
		}
		const catalogRate = fx.fxCatalogRateId ? await db.tasaCambio.findUnique({
			where: { tasaId: fx.fxCatalogRateId },
			select: { monedaOrigenId: true, monedaDestino: true, tasa: true, fechaVigencia: true },
		}) : null;
		if (!catalogRate || catalogRate.monedaOrigenId !== fx.originalCurrency ||
			catalogRate.monedaDestino !== fx.functionalCurrency ||
			!catalogRate.tasa.equals(fx.exchangeRate) || catalogRate.fechaVigencia.getTime() !== fx.rateEffectiveAt.getTime() ||
			catalogRate.fechaVigencia > fechaInicio) {
			throw new ActionError("La tasa de catálogo ya no coincide con la evidencia FX aprobada", "APERTURA_SALDOS_NO_VERIFICABLES");
		}
		const selectedRate = await exchangeRateProvider.getRateAsOf({
			sourceCurrency: fx.originalCurrency,
			targetCurrency: fx.functionalCurrency,
			boundaryAt: fx.cutoffAt,
			client: db as PrismaTypes.TransactionClient,
		});
		if (!selectedRate || selectedRate.tasaId !== fx.fxCatalogRateId ||
			!new Prisma.Decimal(selectedRate.tasa).equals(fx.exchangeRate) ||
			selectedRate.fechaVigencia.getTime() !== fx.rateEffectiveAt.getTime()) {
			throw new ActionError("La evidencia no corresponde a la tasa canónica más reciente al corte", "APERTURA_SALDOS_NO_VERIFICABLES");
		}
		if (fx.functionalAmount.decimalPlaces() > 4 || fx.exchangeRate.decimalPlaces() > 10) {
			throw new ActionError("La evidencia FX excede la precisión admitida por el libro mayor", "APERTURA_SALDOS_NO_VERIFICABLES");
		}
		const functionalDebit = debit.greaterThan(0) ? fx.functionalAmount : new Prisma.Decimal(0);
		const functionalCredit = credit.greaterThan(0) ? fx.functionalAmount : new Prisma.Decimal(0);
		debitos = debitos.add(functionalDebit);
		creditos = creditos.add(functionalCredit);
		valuedLines.push({
			cuentaCodigo: line.cuentaCodigo, cuentaContableId: accountByCode.get(line.cuentaCodigo)!,
			moneda: line.moneda, debito: debit.toString(), credito: credit.toString(),
			monedaFuncional: functionalCurrencyCode,
			debitoFuncional: functionalDebit.toString(), creditoFuncional: functionalCredit.toString(),
			tasaCambio: fx.exchangeRate.toString(), fxEvidenceId: line.fxEvidenceId ?? null,
			fxEvidenceFingerprint: fx.evidenceFingerprint,
			fxEvidence: {
				sourceType: fx.sourceType, sourceId: fx.sourceId,
				originalAmount: fx.originalAmount.toString(), originalCurrency: fx.originalCurrency,
				functionalAmount: fx.functionalAmount.toString(), functionalCurrency: fx.functionalCurrency,
				rateEffectiveAt: fx.rateEffectiveAt.toISOString(), cutoffAt: fx.cutoffAt.toISOString(),
				provenance: fx.provenance, source: fx.source, fxCatalogRateId: fx.fxCatalogRateId,
				evidenceFingerprint: fx.evidenceFingerprint, evidenceVersion: fx.evidenceVersion,
			},
		});
	}
	if (!debitos.equals(creditos)) throw new ActionError("El cuadre manual no balancea en moneda funcional", "APERTURA_SALDOS_NO_VERIFICABLES");
	return {
		valuedLines,
		fingerprints: valuedLines.map((line) => line.fxEvidenceFingerprint).filter((value): value is string => value !== null).sort(),
	};
}

/** @description Registra líneas manuales de apertura pendientes de aprobación. */
export const solicitarAperturaManualAction = withAction(
	async (input: z.infer<typeof solicitudAperturaSchema>, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);
		requirePeriodManagementAccess(user, "solicitar apertura contable manual");
		const parsed = solicitudAperturaSchema.parse(input);
		if (new Date(parsed.fechaInicio) > new Date(parsed.fechaFin)) {
			throw new ActionError("La fecha de inicio no puede ser posterior a la fecha de fin", "FECHAS_INVALIDAS");
		}
		const policy = await getRequiredTenantAccountingPolicy(tenantId);
		const idempotencyPayloadHash = hashImmutableFinancialEvidence({
			tenantId, solicitadaPor: user.userId,
			tipo: parsed.tipo,
			fechaInicio: new Date(parsed.fechaInicio).toISOString(),
			fechaFin: new Date(parsed.fechaFin).toISOString(),
			observaciones: parsed.observaciones ?? null,
			categoria: parsed.categoria ?? CategoriaPeriodo.ORDINARIO,
			modoContable: parsed.modoContable ?? ModoContable.CAJA,
			functionalCurrencyCode: policy.functionalCurrencyCode,
			lineas: parsed.lineas,
		});
		let result: { solicitud: { solicitudId: string; estado: string }; replayed: boolean };
		try {
			result = await prisma.$transaction(async (tx) => {
			await acquireAccountingTenantLock(tx, tenantId);
			const existing = await tx.aperturaPeriodoSolicitud.findFirst({
				where: { tenantId, solicitadaPor: user.userId, idempotencyKey: parsed.idempotencyKey },
			});
			if (existing) {
				if (existing.idempotencyPayloadHash !== idempotencyPayloadHash) {
					throw new ActionError("La clave de idempotencia ya se usó con otra solicitud", "IDEMPOTENCY_CONFLICT");
				}
				return { solicitud: existing, replayed: true };
			}
			const initialLines = parsed.lineas.map((line, index) => ({ ...line, lineId: `line-${index + 1}` }));
			const created = await tx.aperturaPeriodoSolicitud.create({
				data: {
				tenantId,
				tipo: parsed.tipo as never,
				fechaInicio: new Date(parsed.fechaInicio),
				fechaFin: new Date(parsed.fechaFin),
				observaciones: parsed.observaciones,
				categoria: parsed.categoria as never,
				modoContable: parsed.modoContable,
				functionalCurrencyCode: policy.functionalCurrencyCode,
				lineas: initialLines as unknown as Prisma.InputJsonValue,
				idempotencyKey: parsed.idempotencyKey,
				idempotencyPayloadHash,
				solicitadaPor: user.userId,
				},
			});
			const accounts = await tx.cuentaContable.findMany({
				where: { tenantId, codigo: { in: parsed.lineas.map((line) => line.cuentaCodigo) }, activa: true, aceptaMovimiento: true },
				select: { cuentaContableId: true, codigo: true },
			});
			const accountByCode = new Map(accounts.map((account) => [account.codigo, account.cuentaContableId]));
			if (accountByCode.size !== new Set(parsed.lineas.map((line) => line.cuentaCodigo)).size) {
				throw new ActionError("Una o más cuentas no existen, no pertenecen a la empresa o no aceptan movimientos", "APERTURA_SALDOS_NO_VERIFICABLES");
			}
			const openingStart = new Date(parsed.fechaInicio);
			const captureCutoffAt = new Date(Math.min(openingStart.getTime(), Date.now() - 1_000));
			const rateByCurrency = new Map<string, ReturnType<typeof exchangeRateProvider.getRateAsOf>>();
			const getRate = (currency: string) => {
				let ratePromise = rateByCurrency.get(currency);
				if (!ratePromise) {
					ratePromise = exchangeRateProvider.getRateAsOf({
						sourceCurrency: currency,
						targetCurrency: policy.functionalCurrencyCode,
						boundaryAt: captureCutoffAt,
						client: tx,
					});
					rateByCurrency.set(currency, ratePromise);
				}
				return ratePromise;
			};
			const persistedLines = await Promise.all(initialLines.map(async (line) => {
				if (line.moneda === policy.functionalCurrencyCode) return line;
				const accountId = accountByCode.get(line.cuentaCodigo)!;
				const rate = await getRate(line.moneda);
				if (!rate || rate.fechaVigencia > captureCutoffAt || rate.fechaVigencia > openingStart) {
					throw new ActionError("No existe una tasa de cambio canónica vigente para la fecha de apertura", "APERTURA_SALDOS_NO_VERIFICABLES");
				}
				const amount = new Prisma.Decimal(line.debito).greaterThan(0)
					? new Prisma.Decimal(line.debito) : new Prisma.Decimal(line.credito);
				const rateDecimal = new Prisma.Decimal(rate.tasa).toDecimalPlaces(10);
				const functionalAmount = amount.mul(rateDecimal).toDecimalPlaces(4);
				if (!functionalAmount.greaterThan(0)) {
					throw new ActionError("La conversión FX no produce un importe funcional válido", "APERTURA_SALDOS_NO_VERIFICABLES");
				}
				const sourceId = `${created.solicitudId}:${line.lineId}:${accountId}`;
				const canonical = buildAppliedFxEvidence({
					originalAmount: amount.toNumber(), originalCurrency: line.moneda,
					functionalCurrency: policy.functionalCurrencyCode,
					exchangeRate: rateDecimal.toNumber(), convertedAmount: functionalAmount.toNumber(),
					rateEffectiveAt: rate.fechaVigencia, source: "TasaCambio catalog",
					fxCatalogRateId: rate.tasaId,
				});
				const evidence = {
					...canonical, solicitudId: created.solicitudId, lineId: line.lineId,
					cuentaContableId: accountId, originalAmount: amount.toString(), originalCurrency: line.moneda,
					functionalAmount: functionalAmount.toString(), functionalCurrency: policy.functionalCurrencyCode,
					exchangeRate: rateDecimal.toString(), cutoffAt: captureCutoffAt.toISOString(),
				};
				const stored = await tx.fxEvidence.create({ data: {
					tenantId, sourceType: "MANUAL_OPENING_LINE", sourceId,
					originalAmount: amount, originalCurrency: line.moneda,
					functionalAmount, functionalCurrency: policy.functionalCurrencyCode,
					exchangeRate: rateDecimal, rateEffectiveAt: rate.fechaVigencia,
					cutoffAt: captureCutoffAt, fxCatalogRateId: rate.tasaId,
					provenance: canonical.fxProvenanceKind, source: canonical.fxProvenanceSource,
					evidence, evidenceFingerprint: canonical.fxEvidenceFingerprint,
					evidenceVersion: canonical.fxEvidenceVersion,
				} });
				return { ...line, fxEvidenceId: stored.fxEvidenceId };
			}));
			await tx.aperturaPeriodoSolicitud.update({
				where: { solicitudId: created.solicitudId, tenantId },
				data: { lineas: persistedLines as unknown as Prisma.InputJsonValue },
			});
			await AuditLogService.logStrict({ accion: "CREATE", entidad: "CIERRE_CONTABLE", entidadId: created.solicitudId, usuarioId: user.userId, detalles: { accion: "SOLICITAR_APERTURA_MANUAL", functionalCurrencyCode: policy.functionalCurrencyCode } }, tx);
			return { solicitud: created, replayed: false };
			}, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
		} catch (error) {
			if (!(error && typeof error === "object" && "code" in error && error.code === "P2002")) throw error;
			const concurrentReplay = await prisma.aperturaPeriodoSolicitud.findFirst({
				where: { tenantId, solicitadaPor: user.userId, idempotencyKey: parsed.idempotencyKey },
			});
			if (!concurrentReplay) throw error;
			if (concurrentReplay.idempotencyPayloadHash !== idempotencyPayloadHash) {
				throw new ActionError("La clave de idempotencia ya se usó con otra solicitud", "IDEMPOTENCY_CONFLICT");
			}
			result = { solicitud: concurrentReplay, replayed: true };
		}
		return { solicitudId: result.solicitud.solicitudId, estado: result.solicitud.estado, replayed: result.replayed };
	},
);

/** @description Aprueba una solicitud inmutable de apertura; aún no crea el período. */
export const aprobarAperturaManualAction = withAction(
	async (input: z.infer<typeof solicitudIdSchema>, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);
		requirePeriodManagementAccess(user, "aprobar apertura contable manual");
		requirePermission(user, "financiero.apertura.aprobar", "aprobar aperturas contables");
		const { solicitudId } = solicitudIdSchema.parse(input);
		const approval = await prisma.$transaction(async (tx) => {
			const solicitud = await tx.aperturaPeriodoSolicitud.findFirst({
				where: { solicitudId, tenantId, estado: "PENDIENTE" },
			});
			if (!solicitud) throw new ActionError("Solicitud pendiente no encontrada", "NOT_FOUND");
			const policy = await getRequiredTenantAccountingPolicy(tenantId, tx);
			if (policy.functionalCurrencyCode !== solicitud.functionalCurrencyCode) {
				throw new ActionError("La moneda funcional cambió; revise la solicitud", "APERTURA_SALDOS_NO_VERIFICABLES");
			}
			const lines = z.array(manualOpeningLineSchema).parse(solicitud.lineas);
			const verification = await verifyManualOpening(tx, tenantId, policy.functionalCurrencyCode, solicitud.solicitudId, solicitud.fechaInicio, lines);
			const approvedAt = new Date();
			const approvalHash = hashImmutableFinancialEvidence({
				solicitudId, tenantId, solicitedBy: solicitud.solicitadaPor, approvedBy: user.userId,
				approvedAt: approvedAt.toISOString(), functionalCurrencyCode: policy.functionalCurrencyCode,
				fechaInicio: solicitud.fechaInicio.toISOString(), fechaFin: solicitud.fechaFin.toISOString(),
				tipo: solicitud.tipo, categoria: solicitud.categoria, modoContable: solicitud.modoContable,
				observaciones: solicitud.observaciones, lineas: solicitud.lineas,
				fxFingerprints: verification.fingerprints, lineasValuadas: verification.valuedLines,
			});
			const updated = await tx.aperturaPeriodoSolicitud.updateMany({
				where: { solicitudId, tenantId, estado: "PENDIENTE", hashAprobacion: null },
				data: { estado: "APROBADA", aprobadaPor: user.userId, aprobadaAt: approvedAt, hashAprobacion: approvalHash },
			});
			if (updated.count !== 1) throw new ActionError("La solicitud cambió durante la aprobación", "APERTURA_SALDOS_NO_VERIFICABLES");
			await AuditLogService.logStrict({ accion: "CREATE", entidad: "CIERRE_CONTABLE", entidadId: solicitudId, usuarioId: user.userId, detalles: { accion: "APROBAR_SOLICITUD", hashAprobacion: approvalHash, functionalCurrencyCode: policy.functionalCurrencyCode } }, tx);
			return { hashAprobacion: approvalHash };
		}, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
		return { solicitudId, estado: "APROBADA", hashAprobacion: approval.hashAprobacion };
	},
);

/** @description Consume atómicamente una aprobación y abre el período sin asientos automáticos. */
export const abrirPeriodoManualAprobadoAction = withAction(
	async (input: z.infer<typeof solicitudIdSchema>, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);
		requirePeriodManagementAccess(user, "abrir período con cuadre manual aprobado");
		requirePermission(user, "financiero.apertura.aprobar", "abrir períodos contables manuales");
		const { solicitudId } = solicitudIdSchema.parse(input);
		const periodo = await prisma.$transaction(async (tx) => {
			await acquireAccountingTenantLock(tx, tenantId);
			const solicitud = await tx.aperturaPeriodoSolicitud.findFirst({ where: { solicitudId, tenantId, estado: "APROBADA" } });
			if (!solicitud || !solicitud.hashAprobacion || !solicitud.aprobadaAt) {
				throw new ActionError("La solicitud no cuenta con aprobación verificable", "APERTURA_SALDOS_NO_VERIFICABLES");
			}
			const policy = await getRequiredTenantAccountingPolicy(tenantId, tx);
			const lines = z.array(manualOpeningLineSchema).parse(solicitud.lineas);
			const verification = await verifyManualOpening(tx, tenantId, policy.functionalCurrencyCode, solicitud.solicitudId, solicitud.fechaInicio, lines);
			const expectedHash = hashImmutableFinancialEvidence({
				solicitudId, tenantId, solicitedBy: solicitud.solicitadaPor,
				approvedBy: solicitud.aprobadaPor, approvedAt: solicitud.aprobadaAt.toISOString(),
				functionalCurrencyCode: policy.functionalCurrencyCode,
				fechaInicio: solicitud.fechaInicio.toISOString(), fechaFin: solicitud.fechaFin.toISOString(),
				tipo: solicitud.tipo, categoria: solicitud.categoria, modoContable: solicitud.modoContable,
				observaciones: solicitud.observaciones,
				lineas: solicitud.lineas, fxFingerprints: verification.fingerprints,
				lineasValuadas: verification.valuedLines,
			});
			if (expectedHash !== solicitud.hashAprobacion) throw new ActionError("La evidencia cambió desde la aprobación", "APERTURA_SALDOS_NO_VERIFICABLES");
			const p = await PeriodoContableService.abrirPeriodo({
				tenantId, tipo: solicitud.tipo as unknown as TipoPeriodo, fechaInicio: solicitud.fechaInicio, fechaFin: solicitud.fechaFin,
				observaciones: solicitud.observaciones ?? undefined, categoria: solicitud.categoria as never, modoContable: solicitud.modoContable,
			}, user.userId, tx);
			const diario = await tx.diario.findFirst({
				where: { tenantId, tipo: "APERTURA_CIERRE", activo: true },
			});
			if (!diario) throw new ActionError("No existe un diario de apertura/cierre activo", "DIARIO_NO_ENCONTRADO");
			const asiento = await insertarAsientoConNumeracion(tx, { tenantId, userId: user.userId }, {
				diarioId: diario.diarioId,
				periodoId: p.periodoId,
				fecha: solicitud.fechaInicio,
				descripcion: "Asiento de apertura manual aprobado",
				origenTipo: "apertura_manual",
				origenId: solicitudId,
				createdBy: user.userId,
				lineas: verification.valuedLines.map((line, index) => ({
					orden: index + 1,
					cuentaId: line.cuentaContableId,
					debe: new Prisma.Decimal(line.debitoFuncional),
					haber: new Prisma.Decimal(line.creditoFuncional),
					monedaOriginal: line.moneda,
					montoOriginal: new Prisma.Decimal(line.debito).greaterThan(0)
						? new Prisma.Decimal(line.debito)
						: new Prisma.Decimal(line.credito),
					tasaCambio: line.tasaCambio ? new Prisma.Decimal(line.tasaCambio) : null,
					fxEvidenceFingerprint: line.fxEvidenceFingerprint,
					referencia: line.fxEvidenceId ? `FX ${line.fxEvidenceId}` : "Apertura manual",
				})),
			});
			await AperturaPeriodoService.createManualApertura(
				p.periodoId,
				tenantId,
				user.userId,
				{ ...solicitud, fxFingerprints: verification.fingerprints, lineasValuadas: verification.valuedLines, asientoId: asiento.asientoId },
				tx,
			);
			const consumed = await tx.aperturaPeriodoSolicitud.updateMany({
				where: { solicitudId, tenantId, estado: "APROBADA", hashAprobacion: solicitud.hashAprobacion },
				data: { estado: "CONSUMIDA", consumidaAt: new Date(), periodoId: p.periodoId },
			});
			if (consumed.count !== 1) throw new ActionError("La aprobación ya fue consumida", "APERTURA_SALDOS_NO_VERIFICABLES");
			await AuditLogService.logStrict({ accion: "CREATE", entidad: "CIERRE_CONTABLE", entidadId: p.periodoId, usuarioId: user.userId, detalles: { accion: "ABRIR_MANUAL", solicitudId, hashAprobacion: solicitud.hashAprobacion, aprobadaPor: solicitud.aprobadaPor, asientoId: asiento.asientoId } }, tx);
			return p;
		});
		await invalidateCache(tenantId);
		revalidatePath("/busy/contabilidad/periodos");
		return { periodo };
	},
);

/**
 * Schema para cerrar un período existente.
 */
const cerrarPeriodoSchema = z.object({
	periodoId: z.string().min(1, "El ID del período es obligatorio"),
});

/**
 * Schema para reaperturar un período aprobado.
 * El motivo es obligatorio con mínimo 10 caracteres.
 */
const reabrirPeriodoSchema = z.object({
	periodoId: z.string().min(1, "El ID del período es obligatorio"),
	motivo: z.string().min(10, "El motivo debe tener al menos 10 caracteres"),
});

/**
 * Schema para aprobar un período cerrado.
 */
const aprobarPeriodoSchema = z.object({
	periodoId: z.string().min(1, "El ID del período es obligatorio"),
});

// ── Queries ───────────────────────────────────────────────────────────────

/**
 * @description Lista los períodos contables del tenant con filtros opcionales.
 *
 * @param {Object} input - Parámetros de filtrado y paginación.
 * @param {TipoPeriodo} [input.tipo] - Filtrar por tipo de período.
 * @param {EstadoPeriodo} [input.estado] - Filtrar por estado.
 * @param {number} [input.page=1] - Página actual.
 * @param {number} [input.limit=50] - Items por página.
 * @param {AuthenticatedUser} user - Usuario autenticado (inyectado por withAction).
 * @returns {Object} Lista de períodos con paginación.
 */
export const listarPeriodosAction = withAction(
	async (
		input: {
			tipo?: TipoPeriodo;
			estado?: EstadoPeriodo;
			page?: number;
			limit?: number;
		} = {},
		user: AuthenticatedUser,
	) => {
		requirePeriodManagementAccess(user, 'gestionar períodos contables');
		const tenantId = requireTenant(user);
		const { tipo, estado, page = 1, limit = 50 } = input;

		const where: Record<string, unknown> = { tenantId };
		if (tipo) where.tipo = tipo;
		if (estado) where.estado = estado;

		const [periodos, total] = await Promise.all([
			prisma.periodoContable.findMany({
				where,
				orderBy: [{ fechaInicio: "desc" }],
				skip: (page - 1) * limit,
				take: limit,
				include: {
					auditoria: {
						orderBy: { timestamp: "desc" },
						take: 1,
						select: { evento: true, timestamp: true, actor: true },
					},
					_count: {
						select: { subperiodos: true },
					},
				},
			}),
			prisma.periodoContable.count({ where }),
		]);

		// Enriquecer cada período con stats y blockers
		const periodosConStats = await Promise.all(
			periodos.map(async (p) => {
				const blockers: string[] = [];

				// Verificar si tiene hash de integridad cuando está cerrado
				if (
					(p.estado === EstadoPeriodo.CERRADO ||
						p.estado === EstadoPeriodo.APROBADO) &&
					!p.hashIntegridad
				) {
					blockers.push("El período no tiene hash de integridad");
				}

				const ultimaAuditoria = p.auditoria[0] ?? null;

				return {
					...p,
					codigo: p.codigo ?? undefined,
					categoria: p.categoria,
					resumenJson: undefined, // no enviar datos pesados al cliente
					hashIntegridad: p.hashIntegridad ?? null,
					tieneHash: Boolean(p.hashIntegridad),
					subperiodosCount: p._count.subperiodos,
					periodoPadreId: p.periodoPadreId,
					abiertoPorId: p.abiertoPorId,
					fechaApertura: p.fechaApertura?.toISOString() ?? null,
					cerradoPor: p.cerradoPor,
					cerradoAt: p.cerradoAt?.toISOString() ?? null,
					aprobadoPor: p.aprobadoPor,
					aprobadoAt: p.aprobadoAt?.toISOString() ?? null,
					reabiertoPorId: p.reabiertoPorId,
					fechaReapertura: p.fechaReapertura?.toISOString() ?? null,
					segundoAprobadorId: p.segundoAprobadorId,
					ultimaAuditoria: ultimaAuditoria
						? {
								evento: ultimaAuditoria.evento,
								timestamp: ultimaAuditoria.timestamp.toISOString(),
								actor: ultimaAuditoria.actor,
							}
						: null,
					blockers,
				};
			}),
		);

		return {
			periodos: periodosConStats,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		};
	},
);

/**
 * @description Obtiene el detalle de un período con su timeline de auditoría.
 *
 * @param {string} periodoId - ID del período a consultar.
 * @param {AuthenticatedUser} user - Usuario autenticado (inyectado por withAction).
 * @returns {Object} Detalle del período con auditoría.
 */
export const obtenerPeriodoAction = withAction(
	async (periodoId: string, user: AuthenticatedUser) => {
		requirePeriodManagementAccess(user, 'consultar períodos contables');
			requirePeriodManagementAccess(user, 'verificar operaciones pendientes del período');
		const tenantId = requireTenant(user);

		const periodo = await prisma.periodoContable.findFirst({
			where: { periodoId, tenantId },
			include: {
				snapshots: { orderBy: { createdAt: "desc" } },
				auditoria: { orderBy: { timestamp: "desc" } },
				apertura: true,
				subperiodos: {
					select: {
						periodoId: true,
						codigo: true,
						tipo: true,
						estado: true,
						fechaInicio: true,
						fechaFin: true,
					},
					orderBy: { fechaInicio: "asc" },
				},
				periodoPadre: {
					select: {
						periodoId: true,
						codigo: true,
						tipo: true,
						estado: true,
					},
				},
			},
		});

		if (!periodo) {
			throw new ActionError("Período no encontrado", "NOT_FOUND");
		}

		const timeline = await PeriodoContableService.obtenerTimeline(periodoId);

		return {
			periodo,
			timeline,
		};
	},
);

/**
 * @description Obtiene el timeline de eventos de auditoría de un período.
 *
 * @param {string} periodoId - ID del período.
 * @param {AuthenticatedUser} user - Usuario autenticado (inyectado por withAction).
 * @returns {Array} Timeline de eventos de auditoría ordenado cronológicamente.
 */
export const obtenerTimelineAction = withAction(
	async (periodoId: string, user: AuthenticatedUser) => {
			requirePeriodManagementAccess(user, 'consultar el timeline de períodos contables');
		const tenantId = requireTenant(user);

		// Verificar que el período pertenece al tenant
		const periodo = await prisma.periodoContable.findFirst({
			where: { periodoId, tenantId },
			select: { periodoId: true },
		});

		if (!periodo) {
			throw new ActionError("Período no encontrado", "NOT_FOUND");
		}

		const timeline = await PeriodoContableService.obtenerTimeline(periodoId);

		return { timeline };
	},
);

// ── Mutations ─────────────────────────────────────────────────────────────

/**
 * @description Abre un nuevo período contable con validación de solapamiento.
 *
 * El período se crea directamente en estado ABIERTO.
 * Valida que no exista otro período del mismo tipo con fechas solapadas.
 *
 * @param {Object} input - Datos del período a crear.
 * @param {TipoPeriodo} input.tipo - Tipo de período (DIARIO, MENSUAL, TRIMESTRAL, SEMESTRAL, ANUAL).
 * @param {string} input.fechaInicio - Fecha de inicio (ISO string).
 * @param {string} input.fechaFin - Fecha de fin (ISO string).
 * @param {string} [input.observaciones] - Observaciones opcionales.
 * @param {AuthenticatedUser} user - Usuario autenticado (inyectado por withAction).
 * @returns {Object} El período creado.
 */
export const abrirPeriodoAction = withAction(
	async (
		input: z.infer<typeof abrirPeriodoSchema>,
		user: AuthenticatedUser,
	) => {
		const tenantId = requireTenant(user);
		requirePeriodManagementAccess(user, 'abrir períodos contables');
		const parsed = abrirPeriodoSchema.parse(input);

		const fechaInicio = new Date(parsed.fechaInicio);
		const fechaFin = new Date(parsed.fechaFin);

		if (fechaInicio > fechaFin) {
			throw new ActionError(
				"La fecha de inicio no puede ser posterior a la fecha de fin",
				"FECHAS_INVALIDAS",
			);
		}

		// Transacción: período + apertura se crean juntos o nada
		const { periodo } = await prisma.$transaction(async (tx) => {
			await acquireAccountingTenantLock(tx, tenantId);
			const p = await PeriodoContableService.abrirPeriodo(
				{
					tenantId,
					tipo: parsed.tipo as unknown as TipoPeriodo,
					fechaInicio,
					fechaFin,
					observaciones: parsed.observaciones,
					categoria: parsed.categoria as never,
					modoContable: parsed.modoContable,
				},
				user.userId,
				tx,
			);

			await AperturaPeriodoService.createAperturaPeriodo(
				p.periodoId,
				tenantId,
				user.userId,
				tx,
			);

			await AuditLogService.logStrict({
				accion: "CREATE",
				entidad: "CIERRE_CONTABLE",
				entidadId: p.periodoId,
				usuarioId: user.userId,
				detalles: {
					tipo: parsed.tipo,
					fechaInicio: parsed.fechaInicio,
					fechaFin: parsed.fechaFin,
					accion: "ABRIR",
				},
			}, tx);

			return { periodo: p };
		});

		await invalidateCache(tenantId);
		revalidatePath("/busy/contabilidad/periodos");

		return { periodo };
	},
);

/**
 * @description Cierra un período contable generando un snapshot automático.
 *
 * Flujo: valida transición → valida hijos → cierra período → genera snapshot.
 * Para períodos mensuales o anuales, verifica que no haya hijos abiertos.
 *
 * @param {Object} input - ID del período a cerrar.
 * @param {string} input.periodoId - ID del período.
 * @param {AuthenticatedUser} user - Usuario autenticado (inyectado por withAction).
 * @returns {Object} El período cerrado con snapshot generado.
 */
export const cerrarPeriodoAction = withAction(
	async (
		input: z.infer<typeof cerrarPeriodoSchema>,
		user: AuthenticatedUser,
	) => {
		const tenantId = requireTenant(user);
		requirePeriodManagementAccess(user, 'cerrar períodos contables');
		const parsed = cerrarPeriodoSchema.parse(input);

		// Verificar ownership del tenant
		const periodo = await prisma.periodoContable.findFirst({
			where: { periodoId: parsed.periodoId, tenantId },
		});

		if (!periodo) {
			throw new ActionError("Período no encontrado", "NOT_FOUND");
		}

		// Usar modo contable del período (CAJA | DEVENGO)
		const esAdminTenant = isTenantAdminRole(user.tenantRole);
		if (periodo.tipo === TipoPeriodo.ANUAL && !isFinancialV3CaptureEnabled()) {
			throw new ActionError(
				"La captura financiera v3 no está habilitada para este entorno",
				"CUTOFF_EVIDENCE_UNAVAILABLE",
			);
		}
		let snapshotsCount = 0;
		// Cerrar período y persistir su evidencia en una sola transacción.
		// Managers y admins del tenant auto-aprueban al cerrar.
			const { cerrado } = await prisma.$transaction(async (tx) => {
				await acquireAccountingTenantLock(tx, tenantId);
				let resultadoCierre;

				if (periodo.tipo === TipoPeriodo.ANUAL) {
					const year = getAccountingYear(periodo.fechaInicio);
					let collectedResult: Awaited<ReturnType<typeof getReconciledResultForYear>> | undefined;
					let collectedBalance: Awaited<ReturnType<typeof getCurrentBalance>> | undefined;

					const checkpoint = await captureFinancialAuxiliaryCheckpoint({
						tenantId,
						capturedBy: user.userId,
						schemaVersion: 3,
						client: tx,
						collectEvidence: async (checkpointClient, checkpointCutoffAt) => {
							collectedResult = await getReconciledResultForYear({
								tenantId,
								year,
								cutoffAt: checkpointCutoffAt,
								client: checkpointClient,
							});
							collectedBalance = await getCurrentBalance({
								tenantId,
								asOf: checkpointCutoffAt,
								currentResult: collectedResult.annual.reconciledResult,
								currentResultYear: year,
								client: checkpointClient,
							});
							const auxiliaries = await collectFinancialAuxiliaryEvidence({
								client: checkpointClient,
								tenantId,
								cutoffAt: checkpointCutoffAt,
								functionalCurrency: collectedBalance.functionalCurrency,
							});

							const resultRecord = collectedResult as unknown as Record<string, unknown>;
							const resultCoverage = resultRecord.coverage as
								| { complete?: boolean }
								| undefined;
							const balanceCoverage = collectedBalance.coverage as
								{ complete?: boolean } | undefined;
							const incidents = resultRecord.incidents;
							const estimates = resultRecord.estimates;
							if (
								balanceCoverage?.complete !== true ||
								resultCoverage?.complete === false ||
								(Array.isArray(incidents) && incidents.length > 0) ||
								(Array.isArray(estimates) && estimates.length > 0)
							) {
								throw new ActionError(
									"No existe evidencia canónica completa para capturar el cierre anual",
									"CUTOFF_EVIDENCE_UNAVAILABLE",
								);
							}

							return {
								functionalCurrency: collectedBalance.functionalCurrency,
								balance: collectedBalance,
								result: collectedResult,
								resultThrough: periodo.fechaFin.toISOString(),
								sourceFingerprints: {
									reconciledPeriods: String(collectedResult.monthly.length),
								},
								appliedFxEvidence: [],
								auxiliaries,
							};
						},
					});

					const checkpointPayload = checkpoint.payload as unknown as
						FinancialAuxiliaryCheckpointPayload;
					const result = (collectedResult ?? checkpointPayload.result) as Awaited<
						ReturnType<typeof getReconciledResultForYear>
					>;
					const balance = (collectedBalance ?? checkpointPayload.balance) as Awaited<
						ReturnType<typeof getCurrentBalance>
					>;
					const checkpointCutoffAt = new Date(checkpointPayload.cutoffAt);
					const checkpointCapturedAt = new Date(checkpointPayload.capturedAt);
					const auxiliaries = checkpointPayload.version === 3
						? checkpointPayload.auxiliaries
						: undefined;
					if (!auxiliaries) {
						throw new ActionError(
							"La evidencia auxiliar v3 no está disponible para el cierre anual",
							"CUTOFF_EVIDENCE_UNAVAILABLE",
						);
					}
					const resultRecord = result as unknown as Record<string, unknown>;
					const incidents = Array.isArray(resultRecord.incidents)
						? resultRecord.incidents
						: [];
					const estimates = Array.isArray(resultRecord.estimates)
						? resultRecord.estimates
						: [];
					const cashFlow = resultRecord.annual;
					const annualCashFlow = cashFlow && typeof cashFlow === "object"
						? (cashFlow as Record<string, unknown>).cashFlow
						: undefined;
					if (!annualCashFlow || typeof annualCashFlow !== "object") {
						throw new ActionError(
							"El resultado canónico no contiene flujo de caja auditable",
							"CUTOFF_EVIDENCE_UNAVAILABLE",
						);
					}
					const sourceFingerprints = Object.fromEntries(
						Object.entries(auxiliaries).map(([source, entries]) => [
							source,
							hashImmutableFinancialEvidence(entries),
						]),
					);
					const snapshotPayload = {
						cutoffAt: checkpointCutoffAt,
						capturedAt: checkpointCapturedAt,
						range: {
							gte: periodo.fechaInicio.toISOString(),
							lt: checkpointCutoffAt.toISOString(),
						},
						functionalCurrency: balance.functionalCurrency,
						canonicalContractVersion: "financial-report.v3",
						balance: balance as unknown as Record<string, unknown>,
						result: result as unknown as Record<string, unknown>,
						cashFlow: annualCashFlow as Record<string, unknown>,
						coverage: {
							balance: balance.coverage,
							result: {
								complete: incidents.length === 0 && estimates.length === 0,
								incidentCount: incidents.length,
								estimateCount: estimates.length,
							},
						},
						provenance: {
							appliedFxEvidence: checkpointPayload.appliedFxEvidence,
							sourceFingerprints,
						},
					};
					let approved: Awaited<ReturnType<typeof approveFinancialSnapshotV3>>;
					try {
						const captured = await captureFinancialSnapshotV3({
							tenantId,
							periodoId: parsed.periodoId,
							version: 1,
							...snapshotPayload,
						}, tx);
						approved = captured.status === "APPROVED"
							? captured
							: await approveFinancialSnapshotV3({
								tenantId,
								snapshotId: captured.snapshotId,
								approvedAt: new Date(),
								approvedBy: user.userId,
							}, tx);
					} catch (error) {
						if (error instanceof ActionError) throw error;
						throw new ActionError(
							"No fue posible aprobar la evidencia financiera v3",
							"FINANCIAL_V3_APPROVAL_FAILED",
						);
					}

					await tx.periodoContable.update({
						where: { periodoId: parsed.periodoId },
						data: {
							resumenJson: approved.resumenJson as unknown as Prisma.InputJsonValue,
							hashIntegridad: approved.hashIntegridad,
						},
					});
					snapshotsCount = 1;
				}

				resultadoCierre = await PeriodoContableService.cerrarPeriodo(
					parsed.periodoId,
					user.userId,
					{ snapshotsCount },
					esAdminTenant,
					tx,
				);

				return { cerrado: resultadoCierre };
			}, { isolationLevel: "Serializable" });

		AuditLogService.log({
			accion: "UPDATE",
			entidad: "CIERRE_CONTABLE",
			entidadId: parsed.periodoId,
			usuarioId: user.userId,
			detalles: { accion: "CERRAR", snapshotsCount },
		}).catch((err) => console.error("[AuditLog] Error logging cerrar periodo:", err));

		// Invalidar caché del guard
		await invalidateCache(tenantId);

		revalidatePath("/busy/contabilidad/periodos");

		return {
			periodo: cerrado,
			snapshots: snapshotsCount,
		};
	},
);

/**
 * @description Reabre un período APROBADO con motivo obligatorio.
 *
 * Requiere un motivo de al menos 10 caracteres para trazabilidad.
 * Transición: APROBADO → REABIERTO.
 *
 * @param {Object} input - ID del período y motivo de reapertura.
 * @param {string} input.periodoId - ID del período.
 * @param {string} input.motivo - Motivo de reapertura (mínimo 10 caracteres).
 * @param {AuthenticatedUser} user - Usuario autenticado (inyectado por withAction).
 * @returns {Object} El período reabierto.
 */
export const reabrirPeriodoAction = withAction(
	async (
		input: z.infer<typeof reabrirPeriodoSchema>,
		user: AuthenticatedUser,
	) => {
		const tenantId = requireTenant(user);
		requirePeriodManagementAccess(user, 'reabrir períodos contables');
		const parsed = reabrirPeriodoSchema.parse(input);

		// Verificar ownership del tenant
		const periodo = await prisma.periodoContable.findFirst({
			where: { periodoId: parsed.periodoId, tenantId },
		});

		if (!periodo) {
			throw new ActionError("Período no encontrado", "NOT_FOUND");
		}

		const reabierto = await PeriodoContableService.reabrirPeriodo(
			parsed.periodoId,
			user.userId,
			parsed.motivo,
		);

		AuditLogService.log({
			accion: "UPDATE",
			entidad: "CIERRE_CONTABLE",
			entidadId: parsed.periodoId,
			usuarioId: user.userId,
			detalles: { accion: "REABRIR", motivo: parsed.motivo },
		}).catch((err) => console.error("[AuditLog] Error logging reopen periodo:", err));

		// Invalidar caché del guard
		await invalidateCache(tenantId);

		revalidatePath("/busy/contabilidad/periodos");

		return { periodo: reabierto };
	},
);

/**
 * @description Aprueba un período CERRADO.
 *
 * Transición: CERRADO → APROBADO.
 * Esta acción es irreversible excepto vía reapertura con motivo.
 *
 * @param {Object} input - ID del período a aprobar.
 * @param {string} input.periodoId - ID del período.
 * @param {AuthenticatedUser} user - Usuario autenticado (inyectado por withAction).
 * @returns {Object} El período aprobado.
 */
export const aprobarPeriodoAction = withAction(
	async (
		input: z.infer<typeof aprobarPeriodoSchema>,
		user: AuthenticatedUser,
	) => {
		const tenantId = requireTenant(user);
		requirePeriodManagementAccess(user, 'aprobar períodos contables');
		const parsed = aprobarPeriodoSchema.parse(input);

		// Verificar ownership del tenant
		const periodo = await prisma.periodoContable.findFirst({
			where: { periodoId: parsed.periodoId, tenantId },
		});

		if (!periodo) {
			throw new ActionError("Período no encontrado", "NOT_FOUND");
		}

		const aprobado = await PeriodoContableService.aprobarPeriodo(
			parsed.periodoId,
			user.userId,
		);

		AuditLogService.log({
			accion: "UPDATE",
			entidad: "CIERRE_CONTABLE",
			entidadId: parsed.periodoId,
			usuarioId: user.userId,
			detalles: { accion: "APROBAR" },
		}).catch((err) => console.error("[AuditLog] Error logging approve periodo:", err));

		revalidatePath("/busy/contabilidad/periodos");

		return { periodo: aprobado };
	},
);

// ── Dashboard ──────────────────────────────────────────────────────────────

/**
 * @description Retorna estadísticas agregadas para el dashboard de períodos.
 *
 * Incluye: conteo por estado, períodos listos para cerrar, períodos con issues,
 * y timeline de eventos recientes.
 *
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Object} Dashboard stats.
 */
export const obtenerDashboardPeriodosAction = withAction(
	async (_input: Record<string, never> = {}, user: AuthenticatedUser) => {
			requirePeriodManagementAccess(user, 'consultar períodos contables');
		const tenantId = requireTenant(user);

		// 1. Conteo por estado
		const periodos = await prisma.periodoContable.findMany({
			where: { tenantId },
			select: {
				periodoId: true,
				tipo: true,
				codigo: true,
				estado: true,
				fechaInicio: true,
				fechaFin: true,
				hashIntegridad: true,
				periodoPadreId: true,
				cerradoPor: true,
				aprobadoPor: true,
				createdAt: true,
				_count: { select: { subperiodos: true } },
			},
			orderBy: { fechaInicio: "desc" },
		});

		const conteoPorEstado: Record<string, number> = {};
		for (const p of periodos) {
			const estado = p.estado as string;
			conteoPorEstado[estado] = (conteoPorEstado[estado] ?? 0) + 1;
		}

		// 2. Períodos listos para cerrar (ABIERTO/REABIERTO sin blockers)
		const listosParaCerrar = periodos.filter((p) => {
			const estado = p.estado as string;
			if (estado !== "ABIERTO" && estado !== "REABIERTO") return false;

			// Sin blockers: tiene hash si está listo para cerrar
			const blockers: string[] = [];
			if (!p.hashIntegridad) blockers.push("Sin hash de integridad");

			return blockers.length === 0;
		});

		// 3. Períodos con issues (sin hash estando CERRADO/APROBADO)
		const periodosConIssues = periodos.filter((p) => {
			const estado = p.estado as string;
			if (estado !== "CERRADO" && estado !== "APROBADO") return false;
			return !p.hashIntegridad;
		});

		// 4. Timeline de eventos recientes (últimos 10 cierres/aprobaciones)
		const eventosRecientes = await prisma.auditoriaPeriodo.findMany({
			where: {
				tenantId,
				evento: {
					in: ["CIERRE", "APROBACION", "APERTURA", "REAPERTURA"] as never[],
				},
			},
			orderBy: { timestamp: "desc" },
			take: 10,
			select: {
				auditoriaId: true,
				evento: true,
				actor: true,
				timestamp: true,
				motivo: true,
				periodoId: true,
			},
		});

		return {
			stats: {
				total: periodos.length,
				porEstado: conteoPorEstado,
				listosParaCerrar: listosParaCerrar.length,
				conIssues: periodosConIssues.length,
			},
			periodos,
			eventosRecientes: eventosRecientes.map((e) => ({
				...e,
				timestamp: e.timestamp.toISOString(),
			})),
		};
	},
);

/**
 * @description Integra todos los arqueos de caja de un período contable.
 * Recorre los arqueos no contabilizados dentro del rango del período,
 * los acumula y actualiza AperturaPeriodo.detalleJson.
 *
 * @param {string} periodoId - ID del período contable
 * @param {AuthenticatedUser} user - Usuario autenticado
 * @returns {Promise<{ arqueosIntegrados: number }>}
 * @throws {ActionError} Si el período no existe o no pertenece al tenant
 */
export const integrarArqueosEnPeriodoAction = withAction(
	async (periodoId: string, user: AuthenticatedUser) => {
			requirePeriodManagementAccess(user, 'integrar arqueos en períodos contables');
		const tenantId = requireTenant(user);

		const periodo = await prisma.periodoContable.findFirst({
			where: { periodoId, tenantId },
			include: { apertura: true },
		});
		if (!periodo) {
			throw new ActionError("Período no encontrado", "NOT_FOUND");
		}

		// Obtener arqueos del período no contabilizados
		const arqueos = await prisma.arqueoCaja.findMany({
			where: {
				tenantId,
				createdAt: { gte: periodo.fechaInicio, lte: periodo.fechaFin },
				contabilizado: false,
			},
		});

		if (arqueos.length === 0) {
			return { arqueosIntegrados: 0 };
		}

		if (!periodo.apertura) {
			throw new ActionError(
				"No se pueden integrar arqueos sin una apertura contable existente y verificable. Revise los saldos iniciales antes de reintentar.",
				"APERTURA_SALDOS_NO_VERIFICABLES",
			);
		}

		// Calcular agregados
		const detalle = {
			arqueos: arqueos.map((a) => ({
				arqueoId: a.id,
				puntoDeVentaId: a.puntoDeVentaId,
				totalEfectivoCup: a.totalEfectivoCup,
				totalEfectivoUsd: a.totalEfectivoUsd,
				totalTarjeta: a.totalTarjeta,
				totalTransferencia: a.totalTransferencia,
				totalCredito: a.totalCredito,
				diferenciaCup: a.diferenciaCup,
				diferenciaUsd: a.diferenciaUsd,
			})),
			ventasPorMetodoPago: {} as Record<string, number>,
		};

		// Acumular ventas por metodoPago del período
		const ventasPeriodo = await prisma.venta.findMany({
			where: {
				tenantId,
				createdAt: { gte: periodo.fechaInicio, lte: periodo.fechaFin },
				metodoPago: { not: null },
			},
			select: { metodoPago: true, total: true },
		});

		for (const v of ventasPeriodo) {
			const mp = v.metodoPago?.toLowerCase() ?? "sin_dato";
			detalle.ventasPorMetodoPago[mp] =
				(detalle.ventasPorMetodoPago[mp] ?? 0) + (v.total ?? 0);
		}

		// Actualizar AperturaPeriodo.detalleJson
		await prisma.aperturaPeriodo.update({
			where: { periodoId },
			data: { detalleJson: detalle as unknown as Prisma.InputJsonValue },
		});

		// Marcar arqueos como contabilizados
		await prisma.arqueoCaja.updateMany({
			where: { id: { in: arqueos.map((a) => a.id) } },
			data: { contabilizado: true },
		});

		return { arqueosIntegrados: arqueos.length };
	},
);

// ── Cuadre para cierre de período ────────────────────────────────────────

const obtenerCuadreSchema = z.object({
	periodoId: z.string().min(1),
	pageVentas: z.number().int().positive().default(1),
	pageOperaciones: z.number().int().positive().default(1),
	pageSize: z.number().int().positive().max(50).default(20),
	filtroOperacion: z
		.enum(["todas", "venta", "servicio", "gasto", "transferencia", "ajuste"])
		.default("todas"),
});

/**
 * @description Obtiene el cuadre completo de un período para la pantalla de cierre.
 *
 * Retorna balance (saldos por cuenta con variación), ventas vs reconciliado
 * (operación por operación), resumen diario (agregado por día) y operaciones
 * del período. Los datos reflejan el estado en vivo de la base de datos.
 *
 * @param {Object} input - Parámetros de consulta.
 * @param {string} input.periodoId - ID del período.
 * @param {number} [input.pageVentas=1] - Página de ventas.
 * @param {number} [input.pageOperaciones=1] - Página de operaciones.
 * @param {number} [input.pageSize=20] - Items por página.
 * @param {string} [input.filtroOperacion="todas"] - Filtro por tipo.
 * @param {AuthenticatedUser} user - Usuario autenticado (inyectado por withAction).
 * @returns {Promise<Object>} Cuadre completo del período.
 */
export const obtenerCuadrePeriodoAction = withAction(
	async (
		input: z.infer<typeof obtenerCuadreSchema>,
		user: AuthenticatedUser,
	) => {
			requirePeriodManagementAccess(user, 'consultar el cuadre de períodos contables');
		const tenantId = requireTenant(user);
		const parsed = obtenerCuadreSchema.parse(input);

		const periodo = await prisma.periodoContable.findFirst({
			where: { periodoId: parsed.periodoId, tenantId },
		});

		if (!periodo) {
			throw new ActionError("Período no encontrado", "NOT_FOUND");
		}

		if (periodo.estado !== "ABIERTO" && periodo.estado !== "REABIERTO") {
			throw new ActionError(
				"El período debe estar abierto para ver el cuadre",
				"INVALID_STATE",
			);
		}

		const modoContable = periodo.modoContable ?? "CAJA";
		const rango = { gte: periodo.fechaInicio, lte: periodo.fechaFin };

		// Debug: ejecutar cada query por separado para identificar cuál falla
		let balance, ventasVsReconciliado, resumenDiario, operaciones;
		try {
			balance = await obtenerBalanceConVariacion(tenantId, rango, modoContable);
		} catch (e) {
			console.error("[cuadre] FAILED obtenerBalanceConVariacion:", e);
			throw e;
		}
		try {
			ventasVsReconciliado = await obtenerVentasVsReconciliado(
				tenantId,
				rango,
				modoContable,
				parsed.pageVentas,
				parsed.pageSize,
			);
		} catch (e) {
			console.error("[cuadre] FAILED obtenerVentasVsReconciliado:", e);
			throw e;
		}
		try {
			resumenDiario = await obtenerResumenDiario(tenantId, rango, modoContable);
		} catch (e) {
			console.error("[cuadre] FAILED obtenerResumenDiario:", e);
			throw e;
		}
		try {
			operaciones = await obtenerOperacionesPeriodo(
				tenantId,
				rango,
				modoContable,
				parsed.pageOperaciones,
				parsed.pageSize,
				parsed.filtroOperacion,
			);
		} catch (e) {
			console.error("[cuadre] FAILED obtenerOperacionesPeriodo:", e);
			throw e;
		}

		return {
			periodo: {
				periodoId: periodo.periodoId,
				codigo: periodo.codigo,
				tipo: periodo.tipo,
				estado: periodo.estado,
				modoContable: periodo.modoContable,
				fechaInicio: periodo.fechaInicio.toISOString(),
				fechaFin: periodo.fechaFin.toISOString(),
				abiertoPorId: periodo.abiertoPorId,
				fechaApertura: periodo.fechaApertura?.toISOString() ?? null,
			},
			balance,
			ventasVsReconciliado,
			resumenDiario,
			operaciones,
		};
	},
);

const obtenerOperacionesDiaSchema = z.object({
	periodoId: z.string().min(1),
	fecha: z.string().min(10), // YYYY-MM-DD
});

/**
 * @description Obtiene las operaciones detalladas de un día específico dentro de un período.
 * Usado por el tab de Resumen Diario para lazy loading al expandir un día.
 *
 * @param {Object} input - { periodoId, fecha }.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<OperacionItem[]>} Operaciones del día.
 */
export const obtenerOperacionesDiaAction = withAction(
	async (
		input: z.infer<typeof obtenerOperacionesDiaSchema>,
		user: AuthenticatedUser,
	) => {
			requirePeriodManagementAccess(user, 'consultar operaciones de períodos contables');
		const tenantId = requireTenant(user);
		const parsed = obtenerOperacionesDiaSchema.parse(input);

		const periodo = await prisma.periodoContable.findFirst({
			where: { periodoId: parsed.periodoId, tenantId },
		});
		if (!periodo) {
			throw new ActionError("Período no encontrado", "NOT_FOUND");
		}

		const modoContable = periodo.modoContable ?? "CAJA";
		const inicio = new Date(`${parsed.fecha}T00:00:00.000Z`);
		const fin = new Date(`${parsed.fecha}T23:59:59.999Z`);
		const rango = { gte: inicio, lte: fin };

		const result = await obtenerOperacionesPeriodo(
			tenantId,
			rango,
			modoContable,
			1,
			500,
			"todas",
		);

		return result.items;
	},
);

/**
 * @description Verifica si quedan operaciones pendientes (sin reconciliar) en el período.
 *
 * Revisa ventas, servicios y gastos dentro del rango de fechas del período
 * que no tienen reconciliación bancaria asociada. Si hay alguna, el período
 * no puede cerrarse.
 *
 * @param {string} periodoId - ID del período contable.
 * @param {AuthenticatedUser} user - Usuario autenticado (inyectado por withAction).
 * @returns {Promise<{ ventasSinReconciliar: number; serviciosSinReconciliar: number; gastosSinReconciliar: number }>}
 */
export const verificarOperacionesPendientesAction = withAction(
	async (periodoId: string, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);

		const periodo = await prisma.periodoContable.findFirst({
			where: { periodoId, tenantId },
		});

		if (!periodo) {
			throw new ActionError("Período no encontrado", "NOT_FOUND");
		}

		const rango = { gte: periodo.fechaInicio, lte: periodo.fechaFin };

		// Ventas sin reconciliar
		const ventasSinReconciliar = await prisma.venta.count({
			where: {
				tenantId,
				createdAt: rango,
				deletedAt: null,
				reconciliaciones: { none: {} },
			},
		});

		// Servicios sin reconciliar
		const serviciosSinReconciliar = await prisma.ventaServicios.count({
			where: {
				tenantId,
				createdAt: rango,
				reconciliaciones: { none: {} },
			},
		});

		// Gastos sin reconciliar (GastosDE + GastoCompra)
		const gastosSinReconciliar =
			(await prisma.gastosDE.count({
				where: {
					tenantId,
					createdAt: rango,
					reconciliaciones: { none: {} },
				},
			})) +
			(await prisma.gastoCompra.count({
				where: {
					tenantId,
					createdAt: rango,
					deletedAt: null,
					reconciliaciones: { none: {} },
				},
			}));

		// CompraServicio sin reconciliar (vía ReconciliacionGasto tipoGasto="servicio")
		const reconciliadosCS = await prisma.reconciliacionGasto.findMany({
			where: {
				tenantId,
				tipoGasto: "servicio",
				fechaReconciliacion: rango,
			},
			select: { referenciaId: true },
			distinct: ["referenciaId"],
		});
		const idsReconciliadosCS = reconciliadosCS
			.map((r) => r.referenciaId)
			.filter(Boolean);
		const compraServicioSinReconciliar = await prisma.compraServicio.count({
			where: {
				tenantId,
				createdAt: rango,
				compraServicioId:
					idsReconciliadosCS.length > 0
						? { notIn: idsReconciliadosCS }
						: undefined,
			},
		});

		// Costo de servicios vendidos sin reconciliar (vía ReconciliacionGasto tipoGasto="venta_servicio")
		const reconciliadosVSCosto = await prisma.reconciliacionGasto.findMany({
			where: {
				tenantId,
				tipoGasto: "venta_servicio",
				fechaReconciliacion: rango,
			},
			select: { referenciaId: true },
			distinct: ["referenciaId"],
		});
		const idsReconciliadosVSCosto = reconciliadosVSCosto
			.map((r) => r.referenciaId)
			.filter(Boolean);
		const ventaServicioCostoSinReconciliar = await prisma.ventaServicios.count({
			where: {
				tenantId,
				createdAt: rango,
				costo: { gt: 0 },
				ventaServicioId:
					idsReconciliadosVSCosto.length > 0
						? { notIn: idsReconciliadosVSCosto }
						: undefined,
			},
		});

		return {
			ventasSinReconciliar,
			serviciosSinReconciliar,
			gastosSinReconciliar:
				gastosSinReconciliar +
				compraServicioSinReconciliar +
				ventaServicioCostoSinReconciliar,
		};
	},
);
