/**
 * @description Servicio para la apertura formal de períodos contables.
 *
 * Genera el asiento de apertura con saldos iniciales desglosados,
 * arrastrados del período anterior o derivados de datos vivos.
 *
 * @module apertura-periodo-service
 */

import { prisma } from "@/lib/prisma";
import { Prisma, type Prisma as PrismaTypes } from "@/generated/prisma";
import { PeriodoError, TipoPeriodo } from "./periodo-contable-types";
import type { AperturaPeriodo } from "@/generated/prisma";
import { collectFinancialAuxiliaryEvidence } from "@/features/contabilidad/services/financial-auxiliary-checkpoint-service";
import { hashImmutableFinancialEvidence } from "@/features/contabilidad/services/immutable-financial-evidence";

export interface ManualOpeningLineInput {
	cuentaContableId: string;
	currency: string;
	debit: string;
	credit: string;
	fxRate: string;
	fxSource: string;
}

/**
 * @description Valida líneas manuales de apertura y su balance en moneda funcional.
 * @param {ManualOpeningLineInput[]} lines - Líneas explícitas de débito/crédito.
 * @param {string} functionalCurrency - Moneda funcional aprobada del tenant.
 * @returns {ManualOpeningLineInput[]} Líneas normalizadas para persistencia.
 */
export function validateManualOpeningLines(
	lines: ManualOpeningLineInput[],
	functionalCurrency: string,
): ManualOpeningLineInput[] {
	const fail = (): never => {
		throw new PeriodoError(
			"Las líneas manuales de apertura deben tener cuentas, moneda y FX verificables, y balancear en moneda funcional.",
			"APERTURA_SALDOS_NO_VERIFICABLES",
		);
	};
	if (!/^[A-Z]{3,8}$/.test(functionalCurrency) || lines.length === 0) fail();
	let debits = new Prisma.Decimal(0);
	let credits = new Prisma.Decimal(0);
	const unique = new Set<string>();
	for (const line of lines) {
		if (!line.cuentaContableId?.trim() || !/^[A-Z]{3,8}$/.test(line.currency) ||
			!line.fxSource?.trim()) fail();
		const uniqueKey = `${line.cuentaContableId}:${line.currency}`;
		if (unique.has(uniqueKey)) fail();
		unique.add(uniqueKey);
		let debit: Prisma.Decimal;
		let credit: Prisma.Decimal;
		let rate: Prisma.Decimal;
		try {
			debit = new Prisma.Decimal(line.debit);
			credit = new Prisma.Decimal(line.credit);
			rate = new Prisma.Decimal(line.fxRate);
		} catch {
			return fail();
		}
		if (!debit.isFinite() || !credit.isFinite() || !rate.isFinite() ||
			debit.isNegative() || credit.isNegative() || !rate.greaterThan(0) ||
			debit.isZero() === credit.isZero()) fail();
		const functionalDebit = line.currency === functionalCurrency ? debit : debit.mul(rate);
		const functionalCredit = line.currency === functionalCurrency ? credit : credit.mul(rate);
		debits = debits.add(functionalDebit);
		credits = credits.add(functionalCredit);
	}
	if (!debits.equals(credits)) fail();
	return lines.map((line) => ({ ...line }));
}

/**
 * @description Servicio de apertura de períodos contables.
 */
export class AperturaPeriodoService {
	/**
	 * Deriva una apertura desde un cierre inmutable o comprueba que el tenant está vacío.
	 *
	 * @param {string} tenantId - ID del tenant.
	 * @param {Date} fechaInicio - Fecha de inicio del nuevo período.
	 * @returns {Promise<AperturaPeriodo>} Apertura auditada sin duplicar asientos.
	 */
	static async deriveOpeningBalances(
		tenantId: string,
		fechaInicio: Date,
		client?: PrismaTypes.TransactionClient,
		periodoId?: string,
	): Promise<AperturaPeriodo> {
		const db = client ?? prisma;
		const tx = db as PrismaTypes.TransactionClient;
		const periodo = periodoId
			? { periodoId }
			: await db.periodoContable.findFirst({
				where: { tenantId, fechaInicio },
				select: { periodoId: true },
			});
		if (!periodo) {
			throw new PeriodoError("Período no encontrado para crear apertura.", "PERIODO_NO_EXISTE");
		}

		const existente = await db.aperturaPeriodo.findUnique({ where: { periodoId: periodo.periodoId } });
		if (existente) {
			throw new PeriodoError("El período ya tiene un asiento de apertura.", "PERIODO_YA_ABIERTO");
		}

		const politica = await db.tenantAccountingPolicy.findUnique({
			where: { tenantId },
			select: { functionalCurrencyCode: true },
		});
		const functionalCurrency = politica?.functionalCurrencyCode?.trim().toUpperCase();
		if (!functionalCurrency || !/^[A-Z]{3,8}$/.test(functionalCurrency)) {
			throw new PeriodoError(
				"No se puede abrir el período: no se pudo verificar la moneda funcional. Solicite una revisión contable.",
				"APERTURA_SALDOS_NO_VERIFICABLES",
			);
		}

		const auxiliary = await collectFinancialAuxiliaryEvidence({
			client: tx,
			tenantId,
			cutoffAt: new Date(),
			functionalCurrency,
		});
		const auxiliaryHash = hashImmutableFinancialEvidence(auxiliary);
		const anterior = await db.periodoContable.findFirst({
			where: {
				tenantId,
				fechaFin: { lt: fechaInicio },
			},
			orderBy: [{ fechaFin: "desc" }, { periodoId: "desc" }],
			select: { periodoId: true, estado: true, resumenJson: true, hashIntegridad: true },
		});

		if (!anterior) {
			const asientos = await db.asiento.count({ where: { tenantId } });
			const hasAuxiliary = Object.values(auxiliary).some((entries) => entries.length > 0);
			if (asientos > 0 || hasAuxiliary) {
				throw new PeriodoError(
					"La primera apertura requiere un cuadre manual aprobado porque hay saldos previos.",
					"APERTURA_SALDOS_NO_VERIFICABLES",
				);
			}
			return db.aperturaPeriodo.create({
				data: {
					periodoId: periodo.periodoId,
					tenantId,
					saldoCajaInicial: 0,
					saldoBancoInicial: 0,
					saldoCuentasCobrarInicial: 0,
					saldoCuentasPagarInicial: 0,
					saldoInventarioInicial: 0,
					saldoCapitalInicial: 0,
					saldoResultadoAcumInicial: 0,
					detalleJson: {
						version: 1,
						origen: "INICIO_VACIO_VERIFICADO",
						functionalCurrency,
						auxiliaryHash,
						capturedAt: new Date().toISOString(),
					},
				},
			});
		}
		if (anterior.estado !== "CERRADO" && anterior.estado !== "APROBADO") {
			throw new PeriodoError(
				"El período anterior debe estar cerrado antes de trasladar sus saldos.",
				"APERTURA_SALDOS_NO_VERIFICABLES",
			);
		}

		const summary = asRecord(anterior.resumenJson);
		const continuity = asRecord(summary?.continuityCheckpoint);
		let cutoffValue = continuity?.cutoffAt;
		let expectedCheckpointHash = continuity?.checkpointHash;
		let expectedAuxiliaryHash = continuity?.auxiliaryHash;
		let sourceFingerprints: Record<string, unknown> | null = null;
		if (!continuity) {
			const snapshot = await db.snapshotPeriodo.findFirst({
				where: { periodoId: anterior.periodoId, tenantId, schemaVersion: 3, status: "APPROVED" },
				orderBy: { version: "desc" },
				select: { cutoffAt: true, resumenJson: true, hashIntegridad: true },
			});
			const snapshotSummary = asRecord(snapshot?.resumenJson);
			const provenance = asRecord(snapshotSummary?.provenance);
			sourceFingerprints = asRecord(provenance?.sourceFingerprints);
			if (!snapshot || !snapshotSummary || !sourceFingerprints ||
				typeof snapshot.hashIntegridad !== "string" ||
				hashImmutableFinancialEvidence(snapshot.resumenJson) !== snapshot.hashIntegridad) {
				throw new PeriodoError(
					"El cierre anterior no contiene evidencia de continuidad verificable.",
					"APERTURA_SALDOS_NO_VERIFICABLES",
				);
			}
			cutoffValue = snapshot.cutoffAt?.toISOString();
			expectedCheckpointHash = undefined;
			expectedAuxiliaryHash = undefined;
		} else if (!summary || typeof anterior.hashIntegridad !== "string" ||
			hashImmutableFinancialEvidence(anterior.resumenJson) !== anterior.hashIntegridad) {
			throw new PeriodoError(
				"El cierre anterior no contiene evidencia de continuidad verificable.",
				"APERTURA_SALDOS_NO_VERIFICABLES",
			);
		}
		const cutoffAt = typeof cutoffValue === "string" ? new Date(cutoffValue) : null;
		if (!cutoffAt || !Number.isFinite(cutoffAt.getTime()) ||
			(expectedCheckpointHash !== undefined && typeof expectedCheckpointHash !== "string") ||
			(expectedAuxiliaryHash !== undefined && typeof expectedAuxiliaryHash !== "string")) {
			throw new PeriodoError(
				"El cierre anterior no contiene evidencia de continuidad verificable.",
				"APERTURA_SALDOS_NO_VERIFICABLES",
			);
		}

		const checkpoint = await db.financialAuxiliaryCheckpoint.findUnique({
			where: { tenantId_cutoffAt: { tenantId, cutoffAt } },
		});
		const checkpointPayload = asRecord(checkpoint?.payload);
		const checkpointAuxiliary = checkpointPayload?.auxiliaries;
		if (!checkpoint || (expectedCheckpointHash && checkpoint.hashIntegridad !== expectedCheckpointHash) ||
			hashImmutableFinancialEvidence(checkpoint.payload) !== checkpoint.hashIntegridad ||
			checkpointPayload?.version !== 3 || checkpointPayload.tenantId !== tenantId ||
			!checkpointAuxiliary || typeof checkpointAuxiliary !== "object" ||
			(expectedAuxiliaryHash && hashImmutableFinancialEvidence(checkpointAuxiliary) !== expectedAuxiliaryHash) ||
			(sourceFingerprints && !matchesSourceFingerprints(checkpointAuxiliary, sourceFingerprints)) ||
			auxiliaryHash !== hashImmutableFinancialEvidence(checkpointAuxiliary)) {
			throw new PeriodoError(
				"Los saldos auxiliares cambiaron o la evidencia del cierre anterior no es íntegra.",
				"APERTURA_SALDOS_NO_VERIFICABLES",
			);
		}

		const receivableBalances = aggregateAuxiliaryBalances(
			auxiliary.receivables,
			functionalCurrency,
			false,
			true,
		);
		const payableBalances = aggregateAuxiliaryBalances(
			auxiliary.payables,
			functionalCurrency,
			false,
			true,
		);
		const bankBalances = aggregateAuxiliaryBalances(auxiliary.bankAccounts, functionalCurrency, true);
		return db.aperturaPeriodo.create({
			data: {
				periodoId: periodo.periodoId,
				tenantId,
				origenPeriodoId: anterior.periodoId,
				saldoBancoInicial: bankBalances.functionalTotal,
				saldoCuentasCobrarInicial: receivableBalances.functionalTotal,
				saldoCuentasPagarInicial: payableBalances.functionalTotal,
				detalleJson: {
					version: 1,
					origen: "CONTINUIDAD_CHECKPOINT",
					functionalCurrency,
						checkpointHash: checkpoint.hashIntegridad,
						auxiliaryHash: hashImmutableFinancialEvidence(checkpointAuxiliary),
					cutoffAt: cutoffAt.toISOString(),
					capturedAt: checkpoint.capturedAt.toISOString(),
					auxiliaries: checkpointAuxiliary,
						balancesByOriginalCurrency: {
							receivables: receivableBalances.byCurrency,
							payables: payableBalances.byCurrency,
						},
				},
			},
		});
	}

	/**
	 * Crea el registro de apertura formal para un período contable.
	 *
	 * @param {string} periodoId - ID del período a aperturar.
	 * @param {string} tenantId - ID del tenant.
	 * @param {string} actor - ID del usuario que apertura.
	 * @returns {Promise<AperturaPeriodo>} Registro de apertura creado.
	 * @throws {PeriodoError} Si el período no existe o ya tiene apertura.
	 */
	static async createAperturaPeriodo(
		periodoId: string,
		tenantId: string,
		actor: string,
		client?: PrismaTypes.TransactionClient,
	): Promise<AperturaPeriodo> {
		const db = client ?? prisma;

		const periodo = await db.periodoContable.findUnique({
			where: { periodoId },
		});

		if (!periodo || periodo.tenantId !== tenantId) {
			throw new PeriodoError(
				"Período no encontrado para crear apertura.",
				"PERIODO_NO_EXISTE",
			);
		}

		const aperturaExistente = await db.aperturaPeriodo.findUnique({
			where: { periodoId },
		});

		if (aperturaExistente) {
			throw new PeriodoError(
			"El período ya tiene un registro de apertura.",
				"PERIODO_YA_ABIERTO",
			);
		}

		void actor;
		return this.deriveOpeningBalances(
			tenantId,
			periodo.fechaInicio,
			client,
			periodoId,
		);
	}

	/**
	 * @description Persiste únicamente el cuadre manual previamente aprobado, sin mapear rubros.
	 * @param {string} periodoId - Período creado en la transacción de consumo.
	 * @param {string} tenantId - Tenant propietario.
	 * @param {string} actor - Usuario que consume la aprobación.
	 * @param {object} solicitud - Solicitud aprobada con hash y líneas inmutables.
	 * @param {Prisma.TransactionClient} client - Transacción obligatoria.
	 * @returns {Promise<AperturaPeriodo>} Apertura persistida.
	 */
	static async createManualApertura(
		periodoId: string,
		tenantId: string,
		actor: string,
		solicitud: {
			solicitudId: string;
			hashAprobacion: string | null;
			aprobadaPor: string | null;
			functionalCurrencyCode: string;
			lineas: unknown;
			fxFingerprints: string[];
			lineasValuadas: unknown;
			asientoId: string;
		},
		client: PrismaTypes.TransactionClient,
	): Promise<AperturaPeriodo> {
		const periodo = await client.periodoContable.findFirst({ where: { periodoId, tenantId } });
		if (!periodo || !solicitud.hashAprobacion || !solicitud.aprobadaPor) {
			throw new PeriodoError("Aprobación manual no verificable para el tenant/período.", "APERTURA_SALDOS_NO_VERIFICABLES");
		}
		const exists = await client.aperturaPeriodo.findUnique({ where: { periodoId } });
		if (exists) throw new PeriodoError("El período ya tiene una apertura.", "PERIODO_YA_ABIERTO");
		if (!Array.isArray(solicitud.lineas) || solicitud.lineas.length < 2) {
			throw new PeriodoError("Las líneas de apertura aprobadas no son válidas.", "APERTURA_SALDOS_NO_VERIFICABLES");
		}
		const lines = solicitud.lineas;
		if (!Array.isArray(solicitud.lineasValuadas) || solicitud.lineasValuadas.length !== lines.length) {
			throw new PeriodoError("La valuación aprobada no coincide con las líneas de apertura.", "APERTURA_SALDOS_NO_VERIFICABLES");
		}
		return client.aperturaPeriodo.create({
			data: {
				periodoId,
				tenantId,
				detalleJson: {
					version: 1,
					origen: "CUADRE_MANUAL_APROBADO",
					solicitudId: solicitud.solicitudId,
					hashAprobacion: solicitud.hashAprobacion,
					asientoId: solicitud.asientoId,
					aprobadaPor: solicitud.aprobadaPor,
					consumidaPor: actor,
					functionalCurrencyCode: solicitud.functionalCurrencyCode,
					lineas: solicitud.lineasValuadas,
					fxFingerprints: solicitud.fxFingerprints,
				} as unknown as PrismaTypes.InputJsonValue,
			},
		});
	}
}

/** @description Convierte un valor JSON en un objeto para validación estructural. */
function asRecord(value: unknown): Record<string, unknown> | null {
	return value !== null && typeof value === "object" && !Array.isArray(value)
		? value as Record<string, unknown>
		: null;
}

/** @description Confirma que cada grupo auxiliar coincide con las huellas del snapshot anual. */
function matchesSourceFingerprints(
	auxiliary: unknown,
	fingerprints: Record<string, unknown>,
): boolean {
	const groups = asRecord(auxiliary);
	if (!groups) return false;
	return Object.entries(fingerprints).every(([source, fingerprint]) => {
		const entries = groups[source];
		return Array.isArray(entries) && typeof fingerprint === "string" &&
			hashImmutableFinancialEvidence(entries) === fingerprint;
	});
}

/** @description Suma solo importes funcionales completos y expresados en la moneda del tenant. */
function aggregateAuxiliaryBalances(
	entries: Array<{
		functionalAmount: string | null;
		functionalCurrency: string;
		originalAmount: string;
			originalCurrency: string;
		status: string;
	}>,
	functionalCurrency: string,
		allowNegative = false,
	requireFunctional = false,
): { functionalTotal: Prisma.Decimal | null; byCurrency: Record<string, string> } {
	let total = new Prisma.Decimal(0);
	let functionalComplete = true;
	const byCurrency = new Map<string, Prisma.Decimal>();
	for (const entry of entries) {
		const amount = new Prisma.Decimal(entry.originalAmount);
		if (!amount.isFinite() || (!allowNegative && amount.isNegative())) {
			throw new PeriodoError(
				"El saldo auxiliar contiene un importe inválido o negativo.",
				"APERTURA_SALDOS_NO_VERIFICABLES",
			);
		}
		if (amount.isZero()) {
			if (entry.functionalAmount !== null) {
				const functionalAmount = new Prisma.Decimal(entry.functionalAmount);
				if (!functionalAmount.isFinite() || !functionalAmount.isZero()) {
					throw new PeriodoError(
						"El saldo auxiliar tiene un importe funcional sin saldo original verificable.",
						"APERTURA_SALDOS_NO_VERIFICABLES",
					);
				}
			}
			continue;
		}
		const status = entry.status.trim().toUpperCase();
		if (!allowNegative && !["PENDIENTE", "PARCIAL", "PARCIALMENTE_PAGADA"].includes(status)) {
			throw new PeriodoError(
				"El estado del saldo auxiliar no permite confirmar su continuidad.",
				"APERTURA_SALDOS_NO_VERIFICABLES",
			);
		}
		const currency = entry.originalCurrency.trim().toUpperCase();
		byCurrency.set(currency, (byCurrency.get(currency) ?? new Prisma.Decimal(0)).add(amount));
		if (entry.functionalAmount === null || entry.functionalCurrency !== functionalCurrency) {
			functionalComplete = false;
		} else {
			const functionalAmount = new Prisma.Decimal(entry.functionalAmount);
			if (!functionalAmount.isFinite() || (!allowNegative && functionalAmount.isNegative())) {
				throw new PeriodoError(
					"La valuación funcional contiene un importe inválido.",
					"APERTURA_SALDOS_NO_VERIFICABLES",
				);
			}
			total = total.add(functionalAmount);
		}
	}
	if (!functionalComplete && requireFunctional) {
		throw new PeriodoError(
			"El saldo de CxC o CxP no cuenta con una valuación funcional FX verificable.",
			"APERTURA_SALDOS_NO_VERIFICABLES",
		);
	}
	return {
		functionalTotal: functionalComplete ? total : null,
		byCurrency: Object.fromEntries([...byCurrency].map(([currency, amount]) => [currency, amount.toString()])),
	};
}
