/**
 * @description Verificador forense de la cadena de hash de la capa formal
 * (CTA-3): recorre los asientos del tenant en orden cronológico, recalcula el
 * hash esperado con el contenido canónico y detecta la primera ruptura —
 * señal inequívoca de manipulación manual.
 * @module src/features/contabilidad-formal/services/verificador-hash-service
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma';
import { validateHashChain } from '@/features/contabilidad-formal/services/hash-chain-integrity';
import { withAccountingTenantLock } from '@/features/contabilidad/services/accounting-tenant-lock-service';
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


/**
 * @description Clasifica y secuencia el histórico solo después de verificar la
 * cadena completa, el orden explícito de hashAnterior y una serialización v1 exacta.
 * Ejecutar únicamente dentro de la transacción aprobada y bajo lock del tenant.
 * No recalcula ni modifica hashes ni líneas históricas.
 */
export async function inicializarMetadataCadenaHistorica(
	tx: Prisma.TransactionClient,
	tenantId: string,
): Promise<number> {
	return withAccountingTenantLock(tx, tenantId, async () => {
		const rows = await tx.asiento.findMany({
			where: { tenantId },
			include: { lineas: { orderBy: { orden: 'asc' } } },
		});
		if (rows.length === 0) return 0;
		if (rows.every((row) => row.hashVersion && row.tenantSequence != null)) {
			const existing = validateHashChain(rows, (item) => {
				const input = {
					tenantId: item.tenantId, diarioId: item.diarioId, periodoId: item.periodoId,
					numero: item.numero, fecha: item.fecha, origenTipo: item.origenTipo,
					origenId: item.origenId, hashAnterior: item.hashAnterior,
					lineas: item.lineas.map((line) => ({
						orden: line.orden, cuentaId: line.cuentaId,
						debe: item.hashVersion === 'legacy-number-v1' ? Number(line.debe) : String(line.debe),
						haber: item.hashVersion === 'legacy-number-v1' ? Number(line.haber) : String(line.haber),
					})),
				};
				return item.hashVersion === 'canonical-v2'
					? construirHashAsientoV2({ ...input, tenantSequence: item.tenantSequence ?? BigInt(0) })
					: construirHashAsiento(input);
			});
			if (!existing.valid) throw new Error('HASH_CHAIN_METADATA_INVALID');
			return 0;
		}
		if (rows.some((row) => row.hashVersion || row.tenantSequence != null)) {
			throw new Error('HASH_CHAIN_METADATA_PARTIAL');
		}

		const byPredecessor = new Map<string | null, typeof rows>();
		const hashes = new Set<string>();
		for (const row of rows) {
			if (!row.hash || hashes.has(row.hash)) throw new Error('HASH_CHAIN_DUPLICATE_HASH');
			hashes.add(row.hash);
			const predecessor = row.hashAnterior ?? null;
			const children = byPredecessor.get(predecessor) ?? [];
			children.push(row);
			byPredecessor.set(predecessor, children);
		}
		const roots = byPredecessor.get(null) ?? [];
		if (roots.length !== 1) throw new Error('HASH_CHAIN_ROOT_AMBIGUOUS');

		const ordered: typeof rows = [];
		let row: (typeof rows)[number] | undefined = roots[0];
		let predecessor: string | null = null;
		while (row) {
			if (row.hashAnterior !== predecessor) throw new Error('HASH_CHAIN_PREDECESSOR_MISMATCH');
			const hashInput = {
				tenantId: row.tenantId,
				diarioId: row.diarioId,
				periodoId: row.periodoId,
				numero: row.numero,
				fecha: row.fecha,
				origenTipo: row.origenTipo,
				origenId: row.origenId,
				hashAnterior: row.hashAnterior,
			};
			const numberHash = construirHashAsiento({
				...hashInput,
				lineas: row.lineas.map((line) => ({
					orden: line.orden, cuentaId: line.cuentaId,
					debe: Number(line.debe), haber: Number(line.haber),
				})),
			});
			const decimalHash = construirHashAsiento({
				...hashInput,
				lineas: row.lineas.map((line) => ({
					orden: line.orden, cuentaId: line.cuentaId,
					debe: String(line.debe), haber: String(line.haber),
				})),
			});
			const matchesNumber = numberHash === row.hash;
			const matchesDecimal = decimalHash === row.hash;
			if (matchesNumber === matchesDecimal) throw new Error('HASH_CHAIN_LEGACY_VERSION_AMBIGUOUS');
			ordered.push(row);
			predecessor = row.hash;
			const children: typeof rows = byPredecessor.get(row.hash) ?? [];
			if (children.length > 1) throw new Error('HASH_CHAIN_FORK');
			row = children[0];
		}
		if (ordered.length !== rows.length) throw new Error('HASH_CHAIN_DISCONNECTED');

		for (const [index, item] of ordered.entries()) {
			const stringHash = construirHashAsiento({
				tenantId: item.tenantId,
				diarioId: item.diarioId,
				periodoId: item.periodoId,
				numero: item.numero,
				fecha: item.fecha,
				origenTipo: item.origenTipo,
				origenId: item.origenId,
				lineas: item.lineas.map((line) => ({
					orden: line.orden,
					cuentaId: line.cuentaId,
					debe: String(line.debe),
					haber: String(line.haber),
				})),
				hashAnterior: item.hashAnterior,
			});
			await tx.asiento.update({
				where: { asientoId: item.asientoId },
				data: {
					hashVersion: stringHash === item.hash ? 'legacy-decimal-v1' : 'legacy-number-v1',
					tenantSequence: BigInt(index + 1),
				},
			});
		}
		return ordered.length;
	});
}
