/**
 * @description Balance de comprobación (CTA-2): sumas y saldos por cuenta con
 * movimiento en el período. Cuatro columnas: sumas debe/haber y saldos
 * deudor/acreedor; los totales cuadran por construcción.
 * @module src/features/contabilidad-formal/services/balance-comprobacion-service
 */

import { prisma } from '@/lib/prisma';

export interface FiltrosComprobacion {
	periodoId?: string;
	fechaDesde?: Date;
	fechaHasta?: Date;
}

export interface FilaComprobacion {
	cuentaId: string;
	codigo: string;
	nombre: string;
	tipo: string;
	naturaleza: string;
	sumaDebe: number;
	sumaHaber: number;
	saldoDeudor: number;
	saldoAcreedor: number;
}

export interface ResultadoComprobacion {
	filas: FilaComprobacion[];
	totales: {
		debe: number;
		haber: number;
		saldoDeudor: number;
		saldoAcreedor: number;
	};
}

/**
 * @description Genera el balance de comprobación del período/rango indicado.
 * @param {string} tenantId - Tenant propietario.
 * @param {FiltrosComprobacion} filtros - Período o rango de fechas.
 * @returns {Promise<ResultadoComprobacion>} Filas por cuenta y totales.
 */
export async function obtenerBalanceComprobacion(
	tenantId: string,
	filtros: FiltrosComprobacion,
): Promise<ResultadoComprobacion> {
	const whereAsiento: Record<string, unknown> = {
		tenantId,
		estado: 'CONTABILIZADO',
	};
	if (filtros.periodoId) whereAsiento.periodoId = filtros.periodoId;
	if (filtros.fechaDesde || filtros.fechaHasta) {
		whereAsiento.fecha = {
			...(filtros.fechaDesde ? { gte: filtros.fechaDesde } : {}),
			...(filtros.fechaHasta ? { lte: filtros.fechaHasta } : {}),
		};
	}

	const agregados = await prisma.asientoLinea.groupBy({
		by: ['cuentaId'],
		where: { asiento: whereAsiento },
		_sum: { debe: true, haber: true },
	});

	const cuentasConMovimiento = agregados.map((a) => a.cuentaId);
	const cuentas = cuentasConMovimiento.length
		? await prisma.cuentaContable.findMany({
				where: { cuentaContableId: { in: cuentasConMovimiento }, tenantId },
				orderBy: { codigo: 'asc' },
			})
		: [];
	const porId = new Map(cuentas.map((c) => [c.cuentaContableId, c]));

	const filas: FilaComprobacion[] = agregados
		.map((a) => {
			const cuenta = porId.get(a.cuentaId);
			const sumaDebe = Number(a._sum.debe ?? 0);
			const sumaHaber = Number(a._sum.haber ?? 0);
			const diferencial = sumaDebe - sumaHaber;
			return {
				cuentaId: a.cuentaId,
				codigo: cuenta?.codigo ?? '—',
				nombre: cuenta?.nombre ?? 'Cuenta desconocida',
				tipo: cuenta?.tipo ?? '',
				naturaleza: cuenta?.naturaleza ?? '',
				sumaDebe,
				sumaHaber,
				saldoDeudor: diferencial > 0 ? diferencial : 0,
				saldoAcreedor: diferencial < 0 ? -diferencial : 0,
			};
		})
		.sort((a, b) => a.codigo.localeCompare(b.codigo));

	return {
		filas,
		totales: {
			debe: filas.reduce((s, f) => s + f.sumaDebe, 0),
			haber: filas.reduce((s, f) => s + f.sumaHaber, 0),
			saldoDeudor: filas.reduce((s, f) => s + f.saldoDeudor, 0),
			saldoAcreedor: filas.reduce((s, f) => s + f.saldoAcreedor, 0),
		},
	};
}
