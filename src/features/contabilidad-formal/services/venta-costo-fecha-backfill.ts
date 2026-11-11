/**
 * @description Backfill de la fecha efectiva del devengo del costo de venta
 * (`Venta.costoVentaFecha`, CT-1).
 *
 * La columna la persiste el writer en el momento del devengo: en POS al
 * crear la venta y en el PVE al entregarla. Las ventas que ya existian antes
 * de la columna no la tienen, y sin ella el replay historico las omite con
 * `FECHA_COSTO_FIFO_NO_PERSISTIDA`: los periodos previos nunca se acreditan.
 *
 * **Criterio de reposicion.** Se repone la fecha solo cuando la venta nunca
 * fue modificada despues de crearse (`updatedAt = createdAt`): en ese caso el
 * devengo ocurrio en el acto (venta POS creada ya entregada) y la fecha del
 * devengo es la de creacion. Es exactamente la poblacion que el criterio
 * anterior (`updatedAt = createdAt`) admitia, de modo que el backfill restaura
 * la paridad en vez de cambiar el alcance del replay.
 *
 * Las ventas PVE entregadas mas tarde tienen la fecha de devengo realmente
 * desconocida: se dejan sin backfill y el replay las omite de forma
 * explicita. Rellenarlas exigiria una fuente externa que el repositorio no
 * tiene.
 *
 * @module src/features/contabilidad-formal/services/venta-costo-fecha-backfill
 */

/** Estados de venta en los que el costo ya se devengó. */
export const ESTADOS_CON_DEVENGO = ['ENTREGADA', 'FACTURADA'] as const;

/** Motivo por el que la fecha de devengo puede o no reponerse. */
export type CausaFechaDevengo =
	| 'DEVENGO_EN_ACTO'
	| 'FECHA_DEVENGO_DESCONOCIDA';

/** Venta candidata a la reposición de su fecha de devengo. */
export interface VentaCostoFechaCandidata {
	/** Identificador de la venta. */
	ventaId: string;
	/** Tenant propietario de la venta. */
	tenantId: string;
	/** Fecha de creación de la venta. */
	createdAt: Date;
	/** Fecha de la última modificación de la fila. */
	updatedAt: Date;
}

/** Resultado de clasificar una venta candidata. */
export interface ClasificacionVentaCostoFecha {
	/** Fecha de devengo repuesta, o null si no se puede determinar. */
	fechaDevengo: Date | null;
	/** Motivo de la clasificación. */
	causa: CausaFechaDevengo;
}

/** Base de datos mínima que necesita el backfill. */
export interface VentaCostoFechaDb {
	venta: {
		findMany(args: {
			where: {
				costoVentaFecha: null;
				deletedAt: null;
				estado: { in: readonly string[] };
			};
			select: {
				ventaId: true;
				tenantId: true;
				createdAt: true;
				updatedAt: true;
			};
		}): Promise<VentaCostoFechaCandidata[]>;
		updateMany(args: {
			where: {
				ventaId: string;
				tenantId: string;
				costoVentaFecha: null;
			};
			data: { costoVentaFecha: Date };
		}): Promise<{ count: number }>;
	};
}

/** Resumen del backfill por tenant. */
export interface ResumenBackfillVentaCostoFecha {
	/** Vendas evaluadas (sin fecha de devengo persistida). */
	evaluadas: number;
	/** Vendas cuya fecha de devengo se repuso. */
	repostas: number;
	/** Vendas sin fecha determinable: se quedan fuera del replay. */
	omitidas: number;
	/** Vendas efectivamente actualizadas (0 en modo simulación). */
	actualizadas: number;
	/** Reposiciones por tenant. */
	porTenant: Array<{ tenantId: string; repostas: number; omitidas: number }>;
}

/**
 * @description Clasifica una venta candidata a la reposición de su fecha de
 * devengo.
 * @param {VentaCostoFechaCandidata} venta - Venta sin fecha de devengo.
 * @returns {ClasificacionVentaCostoFecha} Fecha de devengo y su motivo.
 */
export function clasificarVentaCostoFecha(
	venta: VentaCostoFechaCandidata,
): ClasificacionVentaCostoFecha {
	// La fila nunca fue modificada despues de crearse: el devengo ocurrio en
	// el acto y su fecha es la de creacion.
	if (venta.updatedAt.getTime() === venta.createdAt.getTime()) {
		return { fechaDevengo: venta.createdAt, causa: 'DEVENGO_EN_ACTO' };
	}
	return { fechaDevengo: null, causa: 'FECHA_DEVENGO_DESCONOCIDA' };
}

/**
 * @description Repone la fecha de devengo de las ventas que ya la-tenian
 * pendiente, sin tocar las que no se pueden determinar.
 * @param {VentaCostoFechaDb} db - Cliente de base de datos.
 * @param {object} options - `simular` no escribe (por defecto el script corre
 * en simulación y solo escribe con `--apply`).
 * @returns {Promise<ResumenBackfillVentaCostoFecha>} Resumen de la corrida.
 */
export async function aplicarBackfillVentaCostoFecha(
	db: VentaCostoFechaDb,
	options: { simular?: boolean } = {},
): Promise<ResumenBackfillVentaCostoFecha> {
	const simular = options.simular ?? true;
	const candidatas = await db.venta.findMany({
		where: {
			costoVentaFecha: null,
			deletedAt: null,
			estado: { in: ESTADOS_CON_DEVENGO },
		},
		select: {
			ventaId: true,
			tenantId: true,
			createdAt: true,
			updatedAt: true,
		},
	});
	const resumenPorTenant = new Map<string, { repostas: number; omitidas: number }>();
	let repostas = 0;
	let omitidas = 0;
	let actualizadas = 0;
	for (const venta of candidatas) {
		const clasificacion = clasificarVentaCostoFecha(venta);
		const contadores = resumenPorTenant.get(venta.tenantId) ?? { repostas: 0, omitidas: 0 };
		if (clasificacion.fechaDevengo === null) {
			omitidas += 1;
			contadores.omitidas += 1;
			resumenPorTenant.set(venta.tenantId, contadores);
			continue;
		}
		repostas += 1;
		contadores.repostas += 1;
		resumenPorTenant.set(venta.tenantId, contadores);
		if (simular) continue;
		// Comparación y escritura atómicas: si otra corrida repuso la fecha
		// entre la lectura y la escritura, el `count` es 0 y no se sobrescribe.
		const resultado = await db.venta.updateMany({
			where: {
				ventaId: venta.ventaId,
				tenantId: venta.tenantId,
				costoVentaFecha: null,
			},
			data: { costoVentaFecha: clasificacion.fechaDevengo },
		});
		actualizadas += resultado.count;
	}
	return {
		evaluadas: candidatas.length,
		repostas,
		omitidas,
		actualizadas,
		porTenant: [...resumenPorTenant.entries()]
			.map(([tenantId, contadores]) => ({ tenantId, ...contadores }))
			.sort((a, b) => a.tenantId.localeCompare(b.tenantId)),
	};
}
