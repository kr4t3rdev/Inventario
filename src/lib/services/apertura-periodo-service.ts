/**
 * @description Servicio para la apertura formal de períodos contables.
 *
 * Genera el asiento de apertura con saldos iniciales desglosados,
 * arrastrados del período anterior o derivados de datos vivos.
 *
 * @module apertura-periodo-service
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";
import { PeriodoError, TipoPeriodo } from "./periodo-contable-types";
import type { AperturaPeriodo } from "@/generated/prisma";

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
		client?: Prisma.TransactionClient,
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
		client?: Prisma.TransactionClient,
	): Promise<AperturaPeriodo> {
		const db = client ?? prisma;

		const periodo = await db.periodoContable.findUnique({
			where: { periodoId },
		});

		if (!periodo) {
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

		const saldos = await this.deriveOpeningBalances(
			tenantId,
			periodo.tipo as TipoPeriodo,
			periodo.fechaInicio,
			client,
		);

		const apertura = await db.aperturaPeriodo.create({
			data: {
				periodoId,
				tenantId,
				origenPeriodoId: saldos.origenPeriodoId,
				saldoCajaInicial: saldos.saldoCajaInicial,
				saldoBancoInicial: saldos.saldoBancoInicial,
				saldoCuentasCobrarInicial: saldos.saldoCuentasCobrarInicial,
				saldoCuentasPagarInicial: saldos.saldoCuentasPagarInicial,
				saldoInventarioInicial: saldos.saldoInventarioInicial,
				saldoCapitalInicial: saldos.saldoCapitalInicial,
				saldoResultadoAcumInicial: saldos.saldoResultadoAcumInicial,
				detalleJson: {
					...saldos.detalle,
					generadoPor: actor,
					generadoEn: new Date().toISOString(),
				},
			},
		});

		return apertura;
	}
}
