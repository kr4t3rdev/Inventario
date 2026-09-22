/**
 * @description Libro diario de la capa de contabilidad formal (CTA-2):
 * asientos del período (o rango de fechas) con sus líneas, paginados por
 * desplazamiento. Moneda de presentación: funcional.
 * @module src/features/contabilidad-formal/services/libro-diario-service
 */

import { prisma } from '@/lib/prisma';

/** Filtros del libro diario. */
export interface FiltrosLibroDiario {
	periodoId?: string;
	diarioId?: string;
	fechaDesde?: Date;
	fechaHasta?: Date;
	page?: number;
	limit?: number;
}

export interface LineaDiario {
	orden: number;
	cuentaCodigo: string;
	cuentaNombre: string;
	debe: number;
	haber: number;
	monedaOriginal: string;
	montoOriginal: number;
	referencia: string | null;
}

export interface AsientoDiario {
	asientoId: string;
	/** Etiqueta legible: `VTA-42` (código del diario + número). */
	etiqueta: string;
	numero: number;
	diarioCodigo: string;
	diarioNombre: string;
	fecha: Date;
	descripcion: string;
	origenTipo: string;
	origenId: string;
	estado: string;
	lineas: LineaDiario[];
	totalDebe: number;
	totalHaber: number;
}

export interface ResultadoLibroDiario {
	asientos: AsientoDiario[];
	total: number;
	page: number;
	paginas: number;
	limit: number;
	totales: { debe: number; haber: number };
}

const LIMIT_DEFAULT = 50;
const LIMIT_MAX = 200;

/**
 * @description Devuelve el libro diario del tenant paginado.
 * @param {string} tenantId - Tenant dueño de los asientos.
 * @param {FiltrosLibroDiario} filtros - Período/diario/fechas + paginación.
 * @returns {Promise<ResultadoLibroDiario>} Asientos con líneas y totales.
 */
export async function obtenerLibroDiario(
	tenantId: string,
	filtros: FiltrosLibroDiario,
): Promise<ResultadoLibroDiario> {
	const page = Math.max(1, filtros.page ?? 1);
	const limit = Math.min(Math.max(1, filtros.limit ?? LIMIT_DEFAULT), LIMIT_MAX);

	const where: Record<string, unknown> = { tenantId };
	if (filtros.periodoId) where.periodoId = filtros.periodoId;
	if (filtros.diarioId) where.diarioId = filtros.diarioId;
	if (filtros.fechaDesde || filtros.fechaHasta) {
		where.fecha = {
			...(filtros.fechaDesde ? { gte: filtros.fechaDesde } : {}),
			...(filtros.fechaHasta ? { lte: filtros.fechaHasta } : {}),
		};
	}

	const [filas, total] = await Promise.all([
		prisma.asiento.findMany({
			where,
			orderBy: [{ fecha: 'asc' }, { numero: 'asc' }],
			skip: (page - 1) * limit,
			take: limit,
			include: {
				diario: { select: { codigo: true, nombre: true } },
				lineas: {
					orderBy: { orden: 'asc' },
					include: {
						cuenta: { select: { codigo: true, nombre: true } },
					},
				},
			},
		}),
		prisma.asiento.count({ where }),
	]);

	const asientos: AsientoDiario[] = filas.map((a) => {
		const lineas: LineaDiario[] = a.lineas.map((l) => ({
			orden: l.orden,
			cuentaCodigo: l.cuenta.codigo,
			cuentaNombre: l.cuenta.nombre,
			debe: Number(l.debe),
			haber: Number(l.haber),
			monedaOriginal: l.monedaOriginal,
			montoOriginal: Number(l.montoOriginal),
			referencia: l.referencia,
		}));
		return {
			asientoId: a.asientoId,
			etiqueta: `${a.diario.codigo}-${a.numero}`,
			numero: a.numero,
			diarioCodigo: a.diario.codigo,
			diarioNombre: a.diario.nombre,
			fecha: a.fecha,
			descripcion: a.descripcion,
			origenTipo: a.origenTipo,
			origenId: a.origenId,
			estado: a.estado,
			lineas,
			totalDebe: lineas.reduce((s, l) => s + l.debe, 0),
			totalHaber: lineas.reduce((s, l) => s + l.haber, 0),
		};
	});

	return {
		asientos,
		total,
		page,
		paginas: Math.max(1, Math.ceil(total / limit)),
		limit,
		totales: {
			debe: asientos.reduce((s, a) => s + a.totalDebe, 0),
			haber: asientos.reduce((s, a) => s + a.totalHaber, 0),
		},
	};
}
