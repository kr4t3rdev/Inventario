import { createHash } from 'node:crypto';
import type { TipoEventoClave } from '@/features/contabilidad-formal/lib/plan-default';

export const REPLAY_SOURCE_MANIFEST_VERSION = 'formal-replay-sources-v1';
export const REPLAY_SOURCE_COLLECTOR_ID = 'replay-source-collector';

/** Source queries executed by the replay collector; IDs are recorded at invocation time. */
export const REPLAY_COLLECTOR_QUERY_IDS = [
	'reconciliacionVenta', 'reconciliacionServicio', 'transferenciaBancaria', 'factura',
	'cuentaPorCobrar', 'cuentaBancaria', 'reconciliacionGasto', 'compraDocumento',
	'compraServicio', 'ventaServicios', 'anticipoMovimiento', 'devolucionVenta',
	'ajusteBancario', 'inyeccionCapital', 'deudaCash', 'prestamoCash', 'ajusteInventarioMerma',
	'asientoMerma', 'cuentaRolTenantMerma', 'fxEvidenceMermaReversada', 'tenantAccountingPolicy',
	'ventaConCosto', 'ordenProduccion',
] as const;
export type ReplayCollectorQueryId = (typeof REPLAY_COLLECTOR_QUERY_IDS)[number];

type ReplayManifestEntry =
	| {
		disposition: 'replay';
		collectorId: typeof REPLAY_SOURCE_COLLECTOR_ID;
		originTypes: readonly string[];
		collectorQueryIds: readonly ReplayCollectorQueryId[];
	}
	| { disposition: 'programmatic'; originTypes: readonly string[] }
	| { disposition: 'template-only'; originTypes: readonly [] };

/** Exhaustive accounting event-to-source contract for global replay coverage. */
export const REPLAY_SOURCE_MANIFEST = {
	VENTA_CONTADO: { disposition: 'replay', collectorId: REPLAY_SOURCE_COLLECTOR_ID, originTypes: ['reconciliacion_venta'], collectorQueryIds: ['reconciliacionVenta', 'factura', 'cuentaPorCobrar', 'cuentaBancaria'] },
	VENTA_CREDITO: { disposition: 'replay', collectorId: REPLAY_SOURCE_COLLECTOR_ID, originTypes: ['factura'], collectorQueryIds: ['factura', 'cuentaPorCobrar'] },
	COBRO_CXC: { disposition: 'replay', collectorId: REPLAY_SOURCE_COLLECTOR_ID, originTypes: ['reconciliacion_venta'], collectorQueryIds: ['reconciliacionVenta', 'factura', 'cuentaPorCobrar', 'cuentaBancaria'] },
	COSTO_VENTA_DEVENGADO: { disposition: 'replay', collectorId: REPLAY_SOURCE_COLLECTOR_ID, originTypes: ['venta_costo'], collectorQueryIds: ['ventaConCosto', 'tenantAccountingPolicy'] },
	DEVOLUCION_VENTA: { disposition: 'replay', collectorId: REPLAY_SOURCE_COLLECTOR_ID, originTypes: ['devolucion_venta'], collectorQueryIds: ['devolucionVenta', 'tenantAccountingPolicy'] },
	VENTA_SERVICIO: { disposition: 'template-only', originTypes: [] },
	VENTA_SERVICIO_CREDITO: { disposition: 'replay', collectorId: REPLAY_SOURCE_COLLECTOR_ID, originTypes: ['venta_servicio'], collectorQueryIds: ['ventaServicios'] },
	COBRO_SERVICIO: { disposition: 'replay', collectorId: REPLAY_SOURCE_COLLECTOR_ID, originTypes: ['reconciliacion_servicio'], collectorQueryIds: ['reconciliacionServicio', 'cuentaBancaria'] },
	COMPRA_CONTADO: { disposition: 'template-only', originTypes: [] },
	COMPRA_CREDITO: { disposition: 'replay', collectorId: REPLAY_SOURCE_COLLECTOR_ID, originTypes: ['compra_documento'], collectorQueryIds: ['compraDocumento'] },
	PAGO_CXP: { disposition: 'replay', collectorId: REPLAY_SOURCE_COLLECTOR_ID, originTypes: ['reconciliacion_gasto'], collectorQueryIds: ['reconciliacionGasto'] },
	GASTO_CONTADO: { disposition: 'template-only', originTypes: [] },
	GASTO_CREDITO: { disposition: 'replay', collectorId: REPLAY_SOURCE_COLLECTOR_ID, originTypes: ['compra_servicio'], collectorQueryIds: ['compraServicio'] },
	PAGO_GASTO_CREDITO: { disposition: 'template-only', originTypes: [] },
	PAGO_NOMINA: { disposition: 'template-only', originTypes: [] },
	ANTICIPO_CLIENTE_RECIBIDO: { disposition: 'replay', collectorId: REPLAY_SOURCE_COLLECTOR_ID, originTypes: ['anticipo_movimiento'], collectorQueryIds: ['anticipoMovimiento'] },
	ANTICIPO_CLIENTE_APLICADO: { disposition: 'replay', collectorId: REPLAY_SOURCE_COLLECTOR_ID, originTypes: ['anticipo_movimiento'], collectorQueryIds: ['anticipoMovimiento'] },
	ANTICIPO_CLIENTE_APLICACION_REVERSADA: { disposition: 'replay', collectorId: REPLAY_SOURCE_COLLECTOR_ID, originTypes: ['anticipo_movimiento'], collectorQueryIds: ['anticipoMovimiento'] },
	ANTICIPO_CLIENTE_DEVUELTO: { disposition: 'replay', collectorId: REPLAY_SOURCE_COLLECTOR_ID, originTypes: ['anticipo_movimiento'], collectorQueryIds: ['anticipoMovimiento'] },
	ANTICIPO_PROVEEDOR_ENTREGADO: { disposition: 'replay', collectorId: REPLAY_SOURCE_COLLECTOR_ID, originTypes: ['anticipo_movimiento'], collectorQueryIds: ['anticipoMovimiento'] },
	ANTICIPO_PROVEEDOR_APLICADO: { disposition: 'replay', collectorId: REPLAY_SOURCE_COLLECTOR_ID, originTypes: ['anticipo_movimiento'], collectorQueryIds: ['anticipoMovimiento'] },
	ANTICIPO_PROVEEDOR_APLICACION_REVERSADA: { disposition: 'replay', collectorId: REPLAY_SOURCE_COLLECTOR_ID, originTypes: ['anticipo_movimiento'], collectorQueryIds: ['anticipoMovimiento'] },
	ANTICIPO_PROVEEDOR_REINTEGRADO: { disposition: 'replay', collectorId: REPLAY_SOURCE_COLLECTOR_ID, originTypes: ['anticipo_movimiento'], collectorQueryIds: ['anticipoMovimiento'] },
	PRESTAMO_OTORGADO: { disposition: 'replay', collectorId: REPLAY_SOURCE_COLLECTOR_ID, originTypes: ['prestamo_cash', 'desembolso_prestamo_no_verificado'], collectorQueryIds: ['prestamoCash', 'reconciliacionVenta', 'cuentaPorCobrar', 'cuentaBancaria'] },
	COBRO_PRESTAMO: { disposition: 'replay', collectorId: REPLAY_SOURCE_COLLECTOR_ID, originTypes: ['reconciliacion_venta'], collectorQueryIds: ['reconciliacionVenta', 'prestamoCash'] },
	DEUDA_RECIBIDA: { disposition: 'replay', collectorId: REPLAY_SOURCE_COLLECTOR_ID, originTypes: ['deuda_cash', 'desembolso_deuda_no_verificado', 'inyeccion_capital'], collectorQueryIds: ['deudaCash', 'inyeccionCapital', 'reconciliacionVenta', 'cuentaBancaria', 'tenantAccountingPolicy'] },
	PAGO_DEUDA: { disposition: 'replay', collectorId: REPLAY_SOURCE_COLLECTOR_ID, originTypes: ['reconciliacion_gasto'], collectorQueryIds: ['reconciliacionGasto', 'deudaCash'] },
	AJUSTE_BANCARIO_CARGO: { disposition: 'replay', collectorId: REPLAY_SOURCE_COLLECTOR_ID, originTypes: ['ajuste_bancario'], collectorQueryIds: ['ajusteBancario', 'tenantAccountingPolicy'] },
	AJUSTE_BANCARIO_ABONO: { disposition: 'replay', collectorId: REPLAY_SOURCE_COLLECTOR_ID, originTypes: ['ajuste_bancario'], collectorQueryIds: ['ajusteBancario', 'tenantAccountingPolicy'] },
	TRANSFERENCIA_BANCARIA: { disposition: 'replay', collectorId: REPLAY_SOURCE_COLLECTOR_ID, originTypes: ['transferencia_bancaria'], collectorQueryIds: ['transferenciaBancaria'] },
	INYECCION_CAPITAL: { disposition: 'replay', collectorId: REPLAY_SOURCE_COLLECTOR_ID, originTypes: ['inyeccion_capital'], collectorQueryIds: ['inyeccionCapital', 'tenantAccountingPolicy'] },
	PAGO_DEUDA_CAPITAL: { disposition: 'template-only', originTypes: [] },
	MERMA_INVENTARIO: { disposition: 'replay', collectorId: REPLAY_SOURCE_COLLECTOR_ID, originTypes: ['ajuste_merma'], collectorQueryIds: ['ajusteInventarioMerma', 'asientoMerma', 'cuentaRolTenantMerma', 'tenantAccountingPolicy'] },
	MERMA_INVENTARIO_REVERSADA: { disposition: 'replay', collectorId: REPLAY_SOURCE_COLLECTOR_ID, originTypes: ['ajuste_merma_reversado'], collectorQueryIds: ['ajusteInventarioMerma', 'asientoMerma', 'cuentaRolTenantMerma', 'fxEvidenceMermaReversada', 'tenantAccountingPolicy'] },
	PRODUCCION_SALIDA: { disposition: 'replay', collectorId: REPLAY_SOURCE_COLLECTOR_ID, originTypes: ['orden_produccion'], collectorQueryIds: ['ordenProduccion', 'tenantAccountingPolicy'] },
	GASTO_CON_ANTICIPO_PROVEEDOR: { disposition: 'template-only', originTypes: [] },
	DIFERENCIA_CAMBIARIA: { disposition: 'template-only', originTypes: [] },
	APERTURA_PERIODO: { disposition: 'programmatic', originTypes: ['apertura_manual'] },
	CIERRE_PERIODO: { disposition: 'programmatic', originTypes: ['cierre_periodo'] },
} as const satisfies Record<TipoEventoClave, ReplayManifestEntry>;

export interface ReplayManifestSnapshot {
	version: string;
	fingerprint: string;
	requiredEventTypes: string[];
	evaluatedEventTypes: string[];
	requiredQueryIds: string[];
	evaluatedQueryIds: string[];
	unclassifiedCount: number;
}

export interface ReplayManifestEvidence extends ReplayManifestSnapshot {
	complete: boolean;
}

interface ReplayManifestCandidate {
	tipo: string;
	origenTipo: string;
}

/**
 * @description Builds digestable evidence that every required family was evaluated.
 * @param {ReplayManifestCandidate[]} candidates - Sources returned by the collector.
 * @param {readonly string[]} evaluatedEventTypes - Collector registry evaluated in this pass.
 * @returns {ReplayManifestEvidence} Manifest evidence and completeness status.
 */
export function buildReplayManifestEvidence(
	candidates: readonly ReplayManifestCandidate[],
	evaluatedQueryIds: readonly string[] = [],
): ReplayManifestEvidence {
	const requiredEventTypes = Object.entries(REPLAY_SOURCE_MANIFEST)
		.filter(([, entry]) => entry.disposition === 'replay')
		.map(([eventType]) => eventType)
		.sort();
	const requiredQueryIds = [...new Set(Object.values(REPLAY_SOURCE_MANIFEST)
		.filter((entry) => entry.disposition === 'replay')
		.flatMap((entry) => entry.collectorQueryIds))].sort();
	const evaluatedQueries = [...new Set(evaluatedQueryIds)].sort();
	const queryIdsValid = evaluatedQueries.length === evaluatedQueryIds.length &&
		evaluatedQueries.every((queryId) =>
			(REPLAY_COLLECTOR_QUERY_IDS as readonly string[]).includes(queryId));
	const evaluated = requiredEventTypes.filter((eventType) => {
		const entry = REPLAY_SOURCE_MANIFEST[eventType as TipoEventoClave];
		return entry.disposition === 'replay' && entry.collectorQueryIds.every((queryId) =>
			evaluatedQueries.includes(queryId));
	});
	const unclassifiedCount = candidates.filter(({ tipo, origenTipo }) => {
		const entry = REPLAY_SOURCE_MANIFEST[tipo as TipoEventoClave];
		return !entry || entry.disposition !== 'replay' ||
			!entry.originTypes.some((originType) => originType === origenTipo);
	}).length;
	return {
		version: REPLAY_SOURCE_MANIFEST_VERSION,
		fingerprint: replaySourceManifestFingerprint(),
		requiredEventTypes,
		evaluatedEventTypes: evaluated,
		requiredQueryIds,
		evaluatedQueryIds: evaluatedQueries,
		unclassifiedCount,
		complete: queryIdsValid && evaluated.length === requiredEventTypes.length &&
			requiredQueryIds.every((queryId) => evaluatedQueries.includes(queryId)) && unclassifiedCount === 0,
	};
}

/** @description Validates persisted manifest evidence against the current registry. */
export function isReplayManifestSnapshotComplete(value: unknown): boolean {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
	const snapshot = value as Partial<ReplayManifestSnapshot>;
	const expected = Object.entries(REPLAY_SOURCE_MANIFEST)
		.filter(([, entry]) => entry.disposition === 'replay')
		.map(([eventType]) => eventType)
		.sort();
	const requiredQueryIds = [...new Set(Object.values(REPLAY_SOURCE_MANIFEST)
		.filter((entry) => entry.disposition === 'replay')
		.flatMap((entry) => entry.collectorQueryIds))].sort();
	return snapshot.version === REPLAY_SOURCE_MANIFEST_VERSION &&
		snapshot.fingerprint === replaySourceManifestFingerprint() &&
			Array.isArray(snapshot.requiredEventTypes) &&
			Array.isArray(snapshot.evaluatedEventTypes) &&
			Array.isArray(snapshot.requiredQueryIds) &&
			Array.isArray(snapshot.evaluatedQueryIds) &&
		snapshot.requiredEventTypes.length === expected.length &&
		snapshot.requiredEventTypes.every((eventType, index) => eventType === expected[index]) &&
			snapshot.evaluatedEventTypes.length === expected.length &&
			snapshot.evaluatedEventTypes.every((eventType, index) => eventType === expected[index]) &&
			snapshot.requiredQueryIds.length === requiredQueryIds.length &&
			snapshot.requiredQueryIds.every((queryId, index) => queryId === requiredQueryIds[index]) &&
			snapshot.evaluatedQueryIds.length === requiredQueryIds.length &&
			snapshot.evaluatedQueryIds.every((queryId, index) => queryId === requiredQueryIds[index]) &&
			snapshot.unclassifiedCount === 0;
}

/** @description Returns a stable fingerprint of classifications, collectors and origins. */
function replaySourceManifestFingerprint(): string {
	const canonical = {
		collectorId: REPLAY_SOURCE_COLLECTOR_ID,
		collectorQueryIds: [...REPLAY_COLLECTOR_QUERY_IDS].sort(),
		eventMappings: Object.entries(REPLAY_SOURCE_MANIFEST)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([eventType, entry]) => ({
				eventType,
				disposition: entry.disposition,
				collectorId: entry.disposition === 'replay' ? entry.collectorId : null,
				originTypes: [...entry.originTypes].sort(),
				collectorQueryIds: entry.disposition === 'replay'
					? [...entry.collectorQueryIds].sort() : [],
			})),
	};
	return createHash('sha256').update(JSON.stringify(canonical), 'utf8').digest('hex');
}
