/**
 * @description Servicio de comisiones de vendedores (Gap 5 / CMV). Regla pura y
 * testeable: la comisión se calcula sobre las ventas efectivamente cobradas del
 * período (ENTREGADA o FACTURADA, no anuladas), menos el total de las
 * devoluciones registradas sobre esas ventas, con el porcentaje configurado al
 * empleado. Nada aquí toca nómina: es un reporte informacional.
 */

export interface VentaComisionable {
	empleadoId: string;
	total: number;
	estado: string;
	deletedAt: Date | null;
}

export interface DevolucionDeVenta {
	total: number;
}

export interface EntradaComisionReporte {
	ventas: readonly VentaComisionable[];
	devoluciones: readonly DevolucionDeVenta[];
	empleadoId: string;
	comisionPct?: number;
	metaMensual?: number;
}

export interface MetaReporte {
	metaMensual: number;
	progreso: number;
	cumplida: boolean;
}

export interface ReporteComision {
	ventasElegibles: number;
	baseBruta: number;
	devolucionesElegibles: number;
	baseNeta: number;
	comisionCalculada: number;
	meta: MetaReporte | null;
}

/**
 * @description Calcula el reporte de comisión de un empleado para una ventana ya
 * filtrada por período. Devuelve la base bruta, el impacto de las devoluciones
 * (cortado al máximo de la bruta para no bajar en negativo), la base neta y la
 * comisión calculada.
 * @param {EntradaComisionReporte} params - Datos de entrada.
 * @returns {ReporteComision} Reporte agregado.
 */
export function calcularComisionReport({
	ventas,
	devoluciones,
	empleadoId,
	comisionPct = 0,
	metaMensual,
}: EntradaComisionReporte): ReporteComision {
	const elegibles = ventas.filter(
		(v) =>
			v.empleadoId === empleadoId &&
			!v.deletedAt &&
			(v.estado === 'FACTURADA' || v.estado === 'ENTREGADA'),
	);
	const baseBruta = elegibles.reduce((sum, v) => sum + v.total, 0);
	const devolucionesBrutas = devoluciones.reduce((sum, d) => sum + d.total, 0);
	const devolucionesElegibles = Math.min(devolucionesBrutas, baseBruta);
	const baseNeta = Math.max(baseBruta - devolucionesElegibles, 0);
	const comisionCalculada = Math.floor((baseNeta * comisionPct) / 100);

	let meta: MetaReporte | null = null;
	if (metaMensual != null && metaMensual > 0) {
		const progreso = Math.floor((baseNeta / metaMensual) * 100);
		meta = {
			metaMensual,
			progreso,
			cumplida: baseNeta >= metaMensual,
		};
	}

	return {
		ventasElegibles: baseNeta,
		baseBruta,
		devolucionesElegibles,
		baseNeta,
		comisionCalculada,
		meta,
	};
}

import { prisma } from '@/lib/prisma';

/**
 * @description Devuelve las ventas elegibles del empleado en el período y las
 * devoluciones registradas sobre esas ventas. Encapsula el acceso a datos para
 * no acoplar la regla pura al ORM.
 * @param {object} params - tenantId, empleadoId, período (desde/hasta).
 * @returns {Promise<{ ventas: VentaComisionable[]; devoluciones: DevolucionDeVenta[] }>}
 */
export async function getComisionEmpleado({
	tenantId,
	empleadoId,
	desde,
	hasta,
	comisionPct,
	metaMensual,
}: {
	tenantId: string;
	empleadoId: string;
	desde: Date;
	hasta: Date;
	comisionPct?: number;
	metaMensual?: number;
}): Promise<ReporteComision> {
	const ventasRaw = await prisma.venta.findMany({
		where: {
			tenantId,
			empleadoId,
			deletedAt: null,
			estado: { in: ['ENTREGADA', 'FACTURADA'] },
			createdAt: { gte: desde, lte: hasta },
		},
		select: { empleadoId: true, total: true, estado: true, deletedAt: true },
	});
	// Normalización Prisma → regla pura: el where garantiza empleadoId no nulo;
	// un total null cae a 0.
	const ventas: VentaComisionable[] = ventasRaw.map((v) => ({
		empleadoId: v.empleadoId as string,
		total: v.total ?? 0,
		estado: v.estado,
		deletedAt: v.deletedAt,
	}));

	const devoluciones = await prisma.devolucionVenta.findMany({
		where: {
			tenantId,
			estado: 'REGISTRADA',
			createdAt: { gte: desde, lte: hasta },
			venta: { empleadoId },
		},
		select: { total: true },
	});

	return calcularComisionReport({
		ventas,
		devoluciones,
		empleadoId,
		comisionPct,
		metaMensual,
	});
}
