/**
 * @description Verificador forense de la cadena de hash de la capa formal
 * (CTA-3): recorre los asientos del tenant en orden cronológico, recalcula el
 * hash esperado con el contenido canónico y detecta la primera ruptura —
 * señal inequívoca de manipulación manual.
 * @module src/features/contabilidad-formal/services/verificador-hash-service
 */

import { prisma } from '@/lib/prisma';
import { construirHashAsiento, construirHashAsientoV2 } from '@/features/contabilidad-formal/services/posting-engine';

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

	const porPredecesor = new Map<string | null, typeof asientos>();
	const hashes = new Set<string>();
	for (const asiento of asientos) {
		if (!asiento.hash || hashes.has(asiento.hash)) {
			return { integro: false, total: asientos.length, asientoCortadoId: asiento.asientoId };
		}
		hashes.add(asiento.hash);
		const predecessor = asiento.hashAnterior ?? null;
		const siblings = porPredecesor.get(predecessor) ?? [];
		siblings.push(asiento);
		porPredecesor.set(predecessor, siblings);
	}

	if (asientos.length === 0) {
		return { integro: true, total: 0, asientoCortadoId: null };
	}
	const roots = porPredecesor.get(null) ?? [];
	if (roots.length !== 1) {
		return {
			integro: false,
			total: asientos.length,
			asientoCortadoId: roots[1]?.asientoId ?? asientos[0]?.asientoId ?? null,
		};
	}

	let previoHash: string | null = null;
	const visitados = new Set<string>();
	let actual: (typeof asientos)[number] | null = roots[0] ?? null;
	while (actual !== null) {
		if (visitados.has(actual.asientoId)) {
			return { integro: false, total: asientos.length, asientoCortadoId: actual.asientoId };
		}
		visitados.add(actual.asientoId);
		const version = actual.hashVersion;
		if (!version || actual.tenantSequence == null) {
			return { integro: false, total: asientos.length, asientoCortadoId: actual.asientoId };
		}
		const datosHash = {
			tenantId: actual.tenantId,
			diarioId: actual.diarioId,
			periodoId: actual.periodoId,
			numero: actual.numero,
			fecha: actual.fecha,
			origenTipo: actual.origenTipo,
			origenId: actual.origenId,
			lineas: actual.lineas.map((l) => ({
				orden: l.orden,
				cuentaId: l.cuentaId,
				debe: version === 'legacy-number-v1' ? Number(l.debe) : String(l.debe),
				haber: version === 'legacy-number-v1' ? Number(l.haber) : String(l.haber),
			})),
			hashAnterior: actual.hashAnterior,
		};
		const esperado = version === 'canonical-v2'
			? construirHashAsientoV2({ ...datosHash, tenantSequence: BigInt(actual.tenantSequence ?? 0) })
			: (version === 'legacy-number-v1' || version === 'legacy-decimal-v1')
				? construirHashAsiento(datosHash)
				: '';
		if (esperado !== actual.hash || (actual.hashAnterior ?? null) !== previoHash) {
			return {
				integro: false,
				total: asientos.length,
				asientoCortadoId: actual.asientoId,
				detalles: { esperado, encontrado: actual.hash },
			};
		}
		if (BigInt(actual.tenantSequence) !== BigInt(visitados.size)) {
			return { integro: false, total: asientos.length, asientoCortadoId: actual.asientoId };
		}
		previoHash = actual.hash;
		const next: typeof asientos = porPredecesor.get(actual.hash) ?? [];
		if (next.length > 1) {
			return { integro: false, total: asientos.length, asientoCortadoId: next[1].asientoId };
		}
		actual = next[0] ?? null;
	}

	if (visitados.size !== asientos.length) {
		const desconectado = asientos.find((asiento) => !visitados.has(asiento.asientoId));
		return { integro: false, total: asientos.length, asientoCortadoId: desconectado?.asientoId ?? null };
	}

	return { integro: true, total: asientos.length, asientoCortadoId: null };
}
