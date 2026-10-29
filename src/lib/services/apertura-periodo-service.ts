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
	 * Deriva los saldos de apertura para un nuevo período.
	 *
	 * La evidencia actualmente disponible no permite verificar de forma completa
	 * todos los rubros iniciales ni asignarlos a una moneda definida. Se rechaza
	 * la apertura en lugar de persistir ceros o sumar monedas heterogéneas.
	 *
	 * @param {string} tenantId - ID del tenant.
	 * @param {TipoPeriodo} tipo - Tipo de período.
	 * @param {Date} fechaInicio - Fecha de inicio del nuevo período.
	 * @returns {Promise<SaldosApertura>} Saldos derivados para la apertura.
	 */
	static async deriveOpeningBalances(
		tenantId: string,
		tipo: TipoPeriodo,
		fechaInicio: Date,
	client?: PrismaTypes.TransactionClient,
	): Promise<never> {
		void tenantId;
		void tipo;
		void fechaInicio;
		void client;
		throw new PeriodoError(
			"No se puede abrir el período: la evidencia disponible no permite verificar todos los saldos iniciales y su moneda. Solicite una revisión contable antes de reintentar.",
			"APERTURA_SALDOS_NO_VERIFICABLES",
		);
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
				"El período ya tiene un asiento de apertura.",
				"PERIODO_YA_ABIERTO",
			);
		}

		void actor;
		return this.deriveOpeningBalances(
			tenantId,
			periodo.tipo as TipoPeriodo,
			periodo.fechaInicio,
			client,
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
