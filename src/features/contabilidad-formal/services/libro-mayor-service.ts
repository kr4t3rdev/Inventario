/**
 * @description Libro mayor de una cuenta (CTA-2): saldo inicial del período +
 * movimientos con saldo corrido según la naturaleza de la cuenta.
 * @module src/features/contabilidad-formal/services/libro-mayor-service
 */

import { prisma } from '@/lib/prisma';

/** Filtros del libro mayor (rango de fechas obligatorio). */
export interface FiltrosLibroMayor {
	cuentaId: string;
	fechaDesde: string;
	fechaHasta: string;
}

export interface MovimientoMayor {
	asientoId: string;
	etiqueta: string;
	fecha: Date;
	descripcion: string;
	origenTipo: string;
	origenId: string;
	debe: number;
	haber: number;
	saldoCorrido: number;
}

export interface ResultadoLibroMayor {
	cuenta: {
		codigo: string;
		nombre: string;
		tipo: string;
		naturaleza: string;
	};
	saldoInicial: number;
	movimientos: MovimientoMayor[];
	saldoFinal: number;
	moneda: string;
	totales: { debe: number; haber: number };
}

/**
 * @description Libro mayor de una cuenta con saldo corrido.
 * @param {string} tenantId - Tenant propietario.
 * @param {FiltrosLibroMayor} filtros - Cuenta y rango de fechas.
 * @returns {Promise<ResultadoLibroMayor>} Movimientos y saldos.
 */
export async function obtenerLibroMayor(
	tenantId: string,
	filtros: FiltrosLibroMayor,
): Promise<ResultadoLibroMayor> {
	const cuenta = await prisma.cuentaContable.findFirst({
		where: { cuentaContableId: filtros.cuentaId, tenantId },
	});
	if (!cuenta) {
		throw new Error('Cuenta contable no encontrada');
	}

	const policy = await prisma.tenantAccountingPolicy.findUnique({
		where: { tenantId },
		select: { functionalCurrencyCode: true },
	});
	const monedaFuncional = policy?.functionalCurrencyCode?.trim().toUpperCase() ?? 'CUP';

	const desde = new Date(filtros.fechaDesde);
	const hasta = new Date(filtros.fechaHasta);

	// Saldo inicial: agregado de todos los asientos anteriores al período.
	const [agregadoPrevio] = await prisma.asientoLinea.groupBy({
		by: ['cuentaId'],
		where: {
			cuentaId: cuenta.cuentaContableId,
			asiento: { tenantId, fecha: { lt: desde }, estado: 'CONTABILIZADO' },
		},
		_sum: { debe: true, haber: true },
	});
	const debePrev = Number(agregadoPrevio?._sum.debe ?? 0);
	const haberPrev = Number(agregadoPrevio?._sum.haber ?? 0);
	const saldoInicial =
		cuenta.naturaleza === 'DEUDORA' ? debePrev - haberPrev : haberPrev - debePrev;

	const lineas = await prisma.asientoLinea.findMany({
		where: {
			cuentaId: cuenta.cuentaContableId,
			asiento: { tenantId, fecha: { gte: desde, lte: hasta }, estado: 'CONTABILIZADO' },
		},
		orderBy: [{ asiento: { fecha: 'asc' } }, { asiento: { numero: 'asc' } }, { orden: 'asc' }],
		include: {
			asiento: {
				select: {
					asientoId: true,
					numero: true,
					fecha: true,
					descripcion: true,
					origenTipo: true,
					origenId: true,
					diario: { select: { codigo: true } },
				},
			},
		},
	});

	let corrido = saldoInicial;
	const movimientos: MovimientoMayor[] = lineas.map((l) => {
		const debe = Number(l.debe);
		const haber = Number(l.haber);
		corrido += cuenta.naturaleza === 'DEUDORA' ? debe - haber : haber - debe;
		return {
			asientoId: l.asiento.asientoId,
			etiqueta: `${l.asiento.diario.codigo}-${l.asiento.numero}`,
			fecha: l.asiento.fecha,
			descripcion: l.asiento.descripcion,
			origenTipo: l.asiento.origenTipo,
			origenId: l.asiento.origenId,
			debe,
			haber,
			saldoCorrido: Math.round(corrido * 10000) / 10000,
		};
	});

	const totalDebe = movimientos.reduce((s, m) => s + m.debe, 0);
	const totalHaber = movimientos.reduce((s, m) => s + m.haber, 0);

	return {
		cuenta: {
			codigo: cuenta.codigo,
			nombre: cuenta.nombre,
			tipo: cuenta.tipo,
			naturaleza: cuenta.naturaleza,
		},
		saldoInicial,
		movimientos,
		saldoFinal: corrido,
		moneda: monedaFuncional,
		totales: { debe: totalDebe, haber: totalHaber },
	};
}
