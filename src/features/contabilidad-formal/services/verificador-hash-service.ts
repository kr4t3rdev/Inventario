/**
 * @description Verificador forense de la cadena de hash de la capa formal
 * (CTA-3): recorre los asientos del tenant en orden cronológico, recalcula el
 * hash esperado con el contenido canónico y detecta la primera ruptura —
 * señal inequívoca de manipulación manual.
 * @module src/features/contabilidad-formal/services/verificador-hash-service
 */

import { prisma } from '@/lib/prisma';
import { construirHashAsiento } from '@/features/contabilidad-formal/services/posting-engine';

/** Resultado de la verificación de cadena. */
export interface ResultadoVerificacionCadena {
	integro: boolean;
	total: number;
	/** Id del primer asiento cuya cadena se rompe (null si está íntegra). */
	asientoCortadoId: string | null;
	/** Hash esperado vs encontrado en la primer ruptura (para auditoría). */
	detalles?: { esperado: string; encontrado: string };
}

/**
 * @description Verifica la cadena de hash de todos los asientos del tenant.
 * @param {string} tenantId - Tenant a auditar.
 * @returns {Promise<ResultadoVerificacionCadena>} Resultado de la cadena.
 */
export async function verificarCadenaAsientos(
	tenantId: string,
): Promise<ResultadoVerificacionCadena> {
	const asientos = await prisma.asiento.findMany({
		where: { tenantId },
		orderBy: [{ createdAt: 'asc' }, { asientoId: 'asc' }],
		include: { lineas: { orderBy: { orden: 'asc' } } },
	});

	let previoHash: string | null = null;
	for (const asiento of asientos) {
		// La cadena se construyó con hashAnterior del asiento inmediato anterior
		// (no necesariamente por fecha: por orden de posteo bajo lock).
		const esperado = construirHashAsiento({
			tenantId: asiento.tenantId,
			diarioId: asiento.diarioId,
			periodoId: asiento.periodoId,
			numero: asiento.numero,
			fecha: asiento.fecha,
			origenTipo: asiento.origenTipo,
			origenId: asiento.origenId,
			lineas: asiento.lineas.map((l) => ({
				orden: l.orden,
				cuentaId: l.cuentaId,
				debe: Number(l.debe),
				haber: Number(l.haber),
			})),
			hashAnterior: asiento.hashAnterior,
		});
		const coincide = esperado === asiento.hash && (asiento.hashAnterior ?? null) === previoHash;
		if (!coincide) {
			return {
				integro: false,
				total: asientos.length,
				asientoCortadoId: asiento.asientoId,
				detalles: { esperado, encontrado: asiento.hash },
			};
		}
		previoHash = asiento.hash;
	}

	return { integro: true, total: asientos.length, asientoCortadoId: null };
}
