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
 * @description Resultado de la derivación de saldos de apertura.
 */
interface SaldosApertura {
	saldoCajaInicial: number;
	saldoBancoInicial: number;
	saldoCuentasCobrarInicial: number;
	saldoCuentasPagarInicial: number;
	saldoInventarioInicial: number;
	saldoCapitalInicial: number;
	saldoResultadoAcumInicial: number;
	origenPeriodoId: string | null;
	detalle: {
		origen: "periodo_anterior" | "datos_vivos";
		cuentasBancarias: number;
		totalCuentasPorCobrar?: number;
		totalCuentasPorPagar?: number;
		valorInventario?: number;
		periodoOrigen?: string;
	};
}

/**
 * @description Servicio de apertura de períodos contables.
 */
export class AperturaPeriodoService {
	/**
	 * Deriva los saldos de apertura para un nuevo período.
	 *
	 * Estrategia:
	 * 1. Busca el período anterior (misma jerarquía, inmediatamente anterior por fechaFin).
	 * 2. Si el período anterior está cerrado/aprobado y tiene resumenJson, usa sus saldos.
	 * 3. Si no hay período anterior, deriva de datos vivos (saldos bancarios actuales).
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
	): Promise<SaldosApertura> {
		const db = client ?? prisma;

		const periodoAnterior = await db.periodoContable.findFirst({
			where: {
				tenantId,
				tipo,
				fechaFin: { lt: fechaInicio },
			},
			orderBy: { fechaFin: "desc" },
		});

		// 2. Si hay período anterior cerrado/aprobado con resumen, derivar de ahí
		if (
			periodoAnterior &&
			(periodoAnterior.estado === "CERRADO" ||
				periodoAnterior.estado === "APROBADO") &&
			periodoAnterior.resumenJson
		) {
			const resumen = periodoAnterior.resumenJson as Record<string, unknown>;
			const saldosPorMoneda = resumen.saldosPorMoneda as
				| Record<string, number>
				| undefined;
			const totalSaldosBancarios = saldosPorMoneda
				? Object.values(saldosPorMoneda).reduce(
						(sum, val) => sum + (typeof val === "number" ? val : 0),
						0,
					)
				: 0;

			return {
				saldoCajaInicial: 0,
				saldoBancoInicial: totalSaldosBancarios,
				saldoCuentasCobrarInicial: 0,
				saldoCuentasPagarInicial: 0,
				saldoInventarioInicial: 0,
				saldoCapitalInicial: 0,
				saldoResultadoAcumInicial: 0,
				origenPeriodoId: periodoAnterior.periodoId,
				detalle: {
					origen: "periodo_anterior",
					cuentasBancarias: (resumen.totalCuentas as number) ?? 0,
					periodoOrigen: periodoAnterior.codigo ?? periodoAnterior.periodoId,
				},
			};
		}

		// 3. No hay período anterior → derivar de datos vivos
		// Saldos bancarios actuales
		const cuentas = await db.cuentaBancaria.findMany({
			where: { tenantId, isActive: true },
			select: { saldo: true },
		});

		const totalBancario = cuentas.reduce((sum, c) => sum + Number(c.saldo), 0);

		// Cuentas por cobrar
		const totalCxC = await db.cuentaPorCobrar.aggregate({
			_sum: { saldoPendiente: true },
			where: { tenantId, estado: { not: "cancelada" } },
		});

		// Cuentas por pagar
		const totalCxP = await db.cuentaPorPagar.aggregate({
			_sum: { saldoPendiente: true },
			where: { tenantId, estado: { not: "cancelada" } },
		});

		return {
			saldoCajaInicial: 0,
			saldoBancoInicial: totalBancario,
			saldoCuentasCobrarInicial: Number(totalCxC._sum.saldoPendiente ?? 0),
			saldoCuentasPagarInicial: Number(totalCxP._sum.saldoPendiente ?? 0),
			saldoInventarioInicial: 0,
			saldoCapitalInicial: 0,
			saldoResultadoAcumInicial: 0,
			origenPeriodoId: null,
			detalle: {
				origen: "datos_vivos",
				cuentasBancarias: cuentas.length,
				totalCuentasPorCobrar: Number(totalCxC._sum.saldoPendiente ?? 0),
				totalCuentasPorPagar: Number(totalCxP._sum.saldoPendiente ?? 0),
			},
		};
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
