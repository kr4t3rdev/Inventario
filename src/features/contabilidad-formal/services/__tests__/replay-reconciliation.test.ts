/**
 * @description Test focal del verificador forense del replay.
 *
 * El verificador confronta el snapshot aprobado con la evidencia persistida en
 * el libro: cada fuente aprobada debe tener un unico asiento contabilizado en
 * el periodo, con las lineas cuadradas y la valoracion aprobada.
 */
import { describe, expect, it } from 'vitest';

import { Prisma } from '@/generated/prisma';
import { reconcileReplaySnapshot, type ReplayLedgerEvidence } from '../replay-reconciliation';
import type { ReplayPreflightDigestSnapshot } from '../replay-preflight-digest';

const snapshot: ReplayPreflightDigestSnapshot = {
	tenantId: 'tenant-1',
	period: {
		periodId: 'periodo-1',
		startsAt: new Date('2026-10-01T00:00:00.000Z'),
		endsAt: new Date('2026-10-31T00:00:00.000Z'),
	},
	sources: [
		{
			identity: { sourceType: 'factura', sourceId: 'factura-1' },
			classification: 'REPLAYABLE',
			omissionCause: null,
			semantics: {
				tipo: 'VENTA_CREDITO',
				fecha: new Date('2026-10-05T00:00:00.000Z'),
				descripcion: 'Venta a credito factura-1',
				medioCobro: null,
				referencia: null,
				auxiliares: {
					costoFifo: null,
					intereses: null,
					montoPagado: null,
					diferenciaFx: null,
				},
			},
			valuation: {
				originalAmount: '100',
				originalCurrency: 'CUP',
				functionalAmount: '100',
				functionalCurrency: 'CUP',
				fxRate: null,
				fxEvidenceFingerprint: null,
			},
		},
	],
};

function entrada(overrides: Partial<ReplayLedgerEvidence> = {}): ReplayLedgerEvidence {
	return {
		tenantId: 'tenant-1',
		periodoId: 'periodo-1',
		replayRunId: 'run-1',
		estado: 'CONTABILIZADO',
		origenTipo: 'factura',
		origenId: 'factura-1',
		fecha: new Date('2026-10-05T00:00:00.000Z'),
		descripcion: 'Venta a credito factura-1',
		lineas: [
			{
				debe: new Prisma.Decimal(100),
				haber: new Prisma.Decimal(0),
				monedaOriginal: 'CUP',
				montoOriginal: new Prisma.Decimal(100),
				tasaCambio: null,
				fxEvidenceFingerprint: null,
			},
			{
				debe: new Prisma.Decimal(0),
				haber: new Prisma.Decimal(100),
				monedaOriginal: 'CUP',
				montoOriginal: new Prisma.Decimal(100),
				tasaCambio: null,
				fxEvidenceFingerprint: null,
			},
		],
		...overrides,
	};
}

describe('reconcileReplaySnapshot', () => {
	it('confirma el asiento cuando coincide con la fuente aprobada', () => {
		const resultado = reconcileReplaySnapshot(snapshot, [entrada()], 'run-1');

		expect(resultado.status).toBe('CONFORME');
		expect(resultado.expectedCount).toBe(1);
		expect(resultado.matchedCount).toBe(1);
		expect(resultado.differences).toHaveLength(0);
	});

	it('detecta la fuente sin asiento', () => {
		const resultado = reconcileReplaySnapshot(snapshot, [], 'run-1');

		expect(resultado.status).toBe('NO_CONFORME');
		expect(resultado.differences).toEqual([
			{ sourceType: 'factura', sourceId: 'factura-1', cause: 'MISSING_ENTRY' },
		]);
	});

	it('detecta el asiento duplicado', () => {
		const resultado = reconcileReplaySnapshot(snapshot, [entrada(), entrada()], 'run-1');

		expect(resultado.status).toBe('NO_CONFORME');
		expect(resultado.differences[0]?.cause).toBe('DUPLICATE_ENTRY');
	});

	it('detecta el asiento sin el linaje de la ejecucion', () => {
		const resultado = reconcileReplaySnapshot(
			snapshot,
			[entrada({ replayRunId: null })],
			'run-1',
		);

		expect(resultado.status).toBe('NO_CONFORME');
		expect(resultado.differences.map((diferencia) => diferencia.cause)).toContain(
			'REPLAY_LINEAGE_MISMATCH',
		);
	});

	it('detecta el asiento descuadrado', () => {
		const entradaDescuadrada = entrada();
		entradaDescuadrada.lineas = [
			{
				debe: new Prisma.Decimal(100),
				haber: new Prisma.Decimal(0),
				monedaOriginal: 'CUP',
				montoOriginal: new Prisma.Decimal(100),
				tasaCambio: null,
				fxEvidenceFingerprint: null,
			},
		];

		const resultado = reconcileReplaySnapshot(snapshot, [entradaDescuadrada], 'run-1');

		expect(resultado.status).toBe('NO_CONFORME');
		expect(resultado.differences.map((diferencia) => diferencia.cause)).toContain(
			'UNBALANCED_ENTRY',
		);
	});

	it('detecta la valoracion distinta de la aprobada', () => {
		const entradaConOtroMonto = entrada();
		entradaConOtroMonto.lineas = entradaConOtroMonto.lineas.map((linea) => ({
			...linea,
			montoOriginal: new Prisma.Decimal(90),
		}));

		const resultado = reconcileReplaySnapshot(snapshot, [entradaConOtroMonto], 'run-1');

		expect(resultado.status).toBe('NO_CONFORME');
		expect(resultado.differences.map((diferencia) => diferencia.cause)).toContain(
			'SOURCE_VALUATION_MISMATCH',
		);
	});

	it('detecta el asiento de otro periodo', () => {
		const resultado = reconcileReplaySnapshot(
			snapshot,
			[entrada({ periodoId: 'periodo-otro' })],
			'run-1',
		);

		expect(resultado.status).toBe('NO_CONFORME');
		expect(resultado.differences.map((diferencia) => diferencia.cause)).toContain(
			'ENTRY_SCOPE_OR_SEMANTICS_MISMATCH',
		);
	});
});
