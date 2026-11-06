import type { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';

/** Período contable con evidencia en el mayor formal. */
export interface FormalPeriodSummary {
	/** Identificador del período. */
	periodoId: string;
	/** Código legible del período, si existe. */
	codigo: string | null;
	/** Tipo de período contable. */
	tipo: string;
	/** Estado del período contable. */
	estado: string;
	/** Inicio del período. */
	fechaInicio: string;
	/** Fin del período. */
	fechaFin: string;
	/** Asientos formales persistidos en el período. */
	asientos: number;
}

/** Parámetros del listado de períodos formales. */
export interface FormalPeriodsParams {
	/** Tenant propietario de los períodos. */
	tenantId: string;
	/** Cliente transaccional opcional para leer en el mismo contexto. */
	client?: Prisma.TransactionClient;
}

/**
 * @description Lista los períodos del tenant que tienen asientos en el mayor
 * formal.
 *
 * Solo se listan los períodos con evidencia contable: un período sin asientos
 * formales no puede sostener un reporte, así que no se ofrece como opción.
 *
 * @param {FormalPeriodsParams} params - Tenant y cliente transaccional opcional.
 * @returns {Promise<FormalPeriodSummary[]>} Períodos con evidencia, del más reciente al más antiguo.
 */
export async function listFormalPeriods(
	params: FormalPeriodsParams,
): Promise<FormalPeriodSummary[]> {
	if (!params.tenantId.trim()) {
		throw new Error('El tenant es obligatorio para listar los períodos formales');
	}

	const db = params.client ?? prisma;
	const periodos = await db.periodoContable.findMany({
		where: { tenantId: params.tenantId, asientos: { some: {} } },
		select: {
			periodoId: true,
			codigo: true,
			tipo: true,
			estado: true,
			fechaInicio: true,
			fechaFin: true,
			_count: { select: { asientos: true } },
		},
		orderBy: [{ fechaInicio: 'desc' }],
	});

	return periodos.map((periodo) => ({
		periodoId: periodo.periodoId,
		codigo: periodo.codigo,
		tipo: periodo.tipo,
		estado: periodo.estado,
		fechaInicio: periodo.fechaInicio.toISOString(),
		fechaFin: periodo.fechaFin.toISOString(),
		asientos: periodo._count.asientos,
	}));
}
