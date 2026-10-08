/**
 * @description Contratos del verificador forense de la cadena de hash (CTA-3):
 * recalcula cada asiento y reporta el primer punto de ruptura exacto.
 */
import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@/generated/prisma';

import { construirHashAsiento, construirHashAsientoV2 } from '@/features/contabilidad-formal/services/posting-engine';
import { inicializarMetadataCadenaHistorica, verificarCadenaAsientos } from '@/features/contabilidad-formal/services/verificador-hash-service';

const prismaMock = vi.hoisted(() => ({
	asiento: { findMany: vi.fn(), update: vi.fn() },
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/features/contabilidad/services/accounting-tenant-lock-service', () => ({
	withAccountingTenantLock: (_tx: unknown, _tenantId: string, callback: () => Promise<unknown>) => callback(),
}));

const BASE = {
	tenantId: 'tenant-v',
	diarioId: 'dia-v',
	periodoId: 'per-1',
	origenTipo: 'venta',
};

function asientoCon(numero: number, monto: number, hashAnterior: string | null, fechaIso: string, decimal = false) {
	const datos = {
		tenantId: BASE.tenantId,
		diarioId: BASE.diarioId,
		periodoId: BASE.periodoId,
		numero,
		fecha: new Date(fechaIso),
		origenTipo: BASE.origenTipo,
		origenId: `venta-${numero}`,
		origen: { tipo: BASE.origenTipo, id: `venta-${numero}` },
		lineas: [
			{ orden: 1, cuentaId: 'cta-1', debe: monto, haber: 0, monedaOriginal: 'CUP', montoOriginal: monto, tasaCambio: null, fxEvidenceFingerprint: null, referencia: null },
			{ orden: 2, cuentaId: 'cta-2', debe: 0, haber: monto, monedaOriginal: 'CUP', montoOriginal: monto, tasaCambio: null, fxEvidenceFingerprint: null, referencia: null },
		],
		hashAnterior,
		hashVersion: decimal ? 'legacy-decimal-v1' : 'legacy-number-v1',
		tenantSequence: BigInt(numero),
	};
	return {
		...datos,
		asientoId: `ast-${numero}`,
		hash: construirHashAsiento(decimal ? { ...datos, lineas: datos.lineas.map((line) => ({ ...line, debe: String(line.debe), haber: String(line.haber) })) } : datos),
		createdAt: new Date(fechaIso),
	};
}

describe('verificarCadenaAsientos', () => {
	it('cadena íntegra de 2 asientos pasa', async () => {
		const a1 = asientoCon(1, 100, null, '2026-09-01T10:00:00Z');
		const a2 = asientoCon(2, 200, a1.hash, '2026-09-01T11:00:00Z');
		prismaMock.asiento.findMany.mockResolvedValue([a1, a2]);

		const resultado = await verificarCadenaAsientos('tenant-v');
		expect(resultado.integro).toBe(true);
		expect(resultado.total).toBe(2);
		expect(resultado.asientoCortadoId).toBeNull();
	});

	it('detecta la línea alterada (cambia el monto de una línea de ast-1)', async () => {
		const a1 = asientoCon(1, 100, null, '2026-09-01T10:00:00Z');
		const a2 = asientoCon(2, 200, a1.hash, '2026-09-01T11:00:00Z');
		// Manipular la primera línea del primer asiento tras persistir
		const a1Alterado = {
			...a1,
			lineas: [
				{ ...a1.lineas[0], debe: 150 },
				a1.lineas[1],
			],
		};
		prismaMock.asiento.findMany.mockResolvedValue([a1Alterado, a2]);

		const resultado = await verificarCadenaAsientos('tenant-v');
		expect(resultado.integro).toBe(false);
		expect(resultado.asientoCortadoId).toBe('ast-1');
	});

	it('verifica por el enlace hashAnterior aunque createdAt esté invertido', async () => {
		const a1 = asientoCon(1, 100, null, '2026-09-01T11:00:00Z');
		const a2 = asientoCon(2, 200, a1.hash, '2026-09-01T10:00:00Z');
		prismaMock.asiento.findMany.mockResolvedValue([a2, a1]);

		const resultado = await verificarCadenaAsientos('tenant-v');
		expect(resultado.integro).toBe(true);
		expect(resultado.asientoCortadoId).toBeNull();
	});

	it('rechaza ramificaciones de hashAnterior en vez de ocultarlas por orden temporal', async () => {
		const a1 = asientoCon(1, 100, null, '2026-09-01T10:00:00Z');
		const a2 = asientoCon(2, 200, a1.hash, '2026-09-01T11:00:00Z');
		const a3 = asientoCon(3, 300, a1.hash, '2026-09-01T12:00:00Z');
		prismaMock.asiento.findMany.mockResolvedValue([a1, a2, a3]);

		const resultado = await verificarCadenaAsientos('tenant-v');
		expect(resultado.integro).toBe(false);
		expect(resultado.asientoCortadoId).not.toBeNull();
	});

	it('clasifica histórico solo tras hash exacto y asigna secuencia sin reescribir hashes', async () => {
		const a1 = asientoCon(1, 100, null, '2026-09-01T10:00:00Z');
		const a2 = asientoCon(2, 200, a1.hash, '2026-09-01T11:00:00Z');
		const legacyRows = [a1, a2].map(({ hash, ...row }) => ({ ...row, hash, hashVersion: null, tenantSequence: null }));
		prismaMock.asiento.findMany.mockResolvedValue(legacyRows);
		prismaMock.asiento.update.mockResolvedValue({});

		const count = await inicializarMetadataCadenaHistorica({ asiento: prismaMock.asiento } as never, 'tenant-v');

		expect(count).toBe(2);
		expect(prismaMock.asiento.update).toHaveBeenNthCalledWith(1, expect.objectContaining({
			data: { hashVersion: 'legacy-number-v1', tenantSequence: BigInt(1) },
		}));
		expect(prismaMock.asiento.update).toHaveBeenNthCalledWith(2, expect.objectContaining({
			data: { hashVersion: 'legacy-number-v1', tenantSequence: BigInt(2) },
		}));
		expect(prismaMock.asiento.update.mock.calls.map(([call]) => call.data)).not.toContainEqual(expect.objectContaining({ hash: expect.anything() }));
	});

	it('clasifica una cadena con serializers legacy mixtos fila por fila', async () => {
		const first = asientoCon(1, 100, null, '2026-09-01T10:00:00Z');
		const second = asientoCon(2, 200, first.hash, '2026-09-01T11:00:00Z', true);
		prismaMock.asiento.findMany.mockResolvedValue([first, second].map((row) => ({
			...row, hashVersion: null, tenantSequence: null,
		})));
		prismaMock.asiento.update.mockClear();
		await inicializarMetadataCadenaHistorica({ asiento: prismaMock.asiento } as never, 'tenant-v');
		expect(prismaMock.asiento.update).toHaveBeenNthCalledWith(1, expect.objectContaining({
			data: { hashVersion: 'legacy-number-v1', tenantSequence: BigInt(1) },
		}));
		expect(prismaMock.asiento.update).toHaveBeenNthCalledWith(2, expect.objectContaining({
			data: { hashVersion: 'legacy-decimal-v1', tenantSequence: BigInt(2) },
		}));
	});

	it('rechaza inicialización cuando el histórico tiene un fork y no persiste metadata', async () => {
		prismaMock.asiento.update.mockClear();
		const a1 = asientoCon(1, 100, null, '2026-09-01T10:00:00Z');
		const a2 = asientoCon(2, 200, a1.hash, '2026-09-01T11:00:00Z');
		const a3 = asientoCon(3, 300, a1.hash, '2026-09-01T12:00:00Z');
		prismaMock.asiento.findMany.mockResolvedValue([a1, a2, a3].map((row) => ({ ...row, hashVersion: null, tenantSequence: null })));

		await expect(inicializarMetadataCadenaHistorica({ asiento: prismaMock.asiento } as never, 'tenant-v'))
			.rejects.toThrow('HASH_CHAIN_FORK');
		expect(prismaMock.asiento.update).not.toHaveBeenCalled();
	});

	it('rechaza metadato versionado sin tenantSequence incluso para serializador legacy', async () => {
		const asiento = { ...asientoCon(1, 100, null, '2026-09-01T10:00:00Z'), tenantSequence: null };
		prismaMock.asiento.findMany.mockResolvedValue([asiento]);
		const resultado = await verificarCadenaAsientos('tenant-v');
		expect(resultado.integro).toBe(false);
	});

	it('rechaza inicialización repetida si el metadata existente oculta daño en hash', async () => {
		prismaMock.asiento.update.mockClear();
		const healthy = asientoCon(1, 100, null, '2026-09-01T10:00:00Z');
		const corrupt = { ...healthy, hash: 'tampered', hashVersion: 'legacy-number-v1', tenantSequence: BigInt(1) };
		prismaMock.asiento.findMany.mockResolvedValue([corrupt]);
		await expect(inicializarMetadataCadenaHistorica({ asiento: prismaMock.asiento } as never, 'tenant-v'))
			.rejects.toThrow();
		expect(prismaMock.asiento.update).not.toHaveBeenCalled();
	});

	it('verifica canonical-v2 con Decimal(20,4) sin pérdida IEEE-754', async () => {
		const debe = new Prisma.Decimal('123456789012345.0001');
		const haber = new Prisma.Decimal('123456789012345.0001');
		const data = {
			tenantId: BASE.tenantId, diarioId: BASE.diarioId, periodoId: BASE.periodoId,
			numero: 1, fecha: new Date('2026-09-01T10:00:00Z'), origenTipo: BASE.origenTipo,
			origenId: 'v2-precision', hashAnterior: null,
			lineas: [
				{ orden: 1, cuentaId: 'cta-1', debe, haber: new Prisma.Decimal(0) },
				{ orden: 2, cuentaId: 'cta-2', debe: new Prisma.Decimal(0), haber },
			],
		};
		const row = {
			...data, asientoId: 'ast-v2-precision', hashVersion: 'canonical-v2', tenantSequence: BigInt(1),
			hash: construirHashAsientoV2({ ...data, tenantSequence: BigInt(1) }),
			createdAt: data.fecha,
		};
		prismaMock.asiento.findMany.mockResolvedValue([row]);
		expect((await verificarCadenaAsientos(BASE.tenantId)).integro).toBe(true);
	});

	it('revalida metadata canonical-v2 de precisión alta sin rebajar a Number', async () => {
		const debe = new Prisma.Decimal('123456789012345.0001');
		const data = {
			tenantId: BASE.tenantId, diarioId: BASE.diarioId, periodoId: BASE.periodoId,
			numero: 1, fecha: new Date('2026-09-01T10:00:00Z'), origenTipo: BASE.origenTipo,
			origenId: 'v2-init-precision', hashAnterior: null,
			lineas: [
				{ orden: 1, cuentaId: 'cta-1', debe, haber: new Prisma.Decimal(0) },
				{ orden: 2, cuentaId: 'cta-2', debe: new Prisma.Decimal(0), haber: debe },
			],
		};
		const row = { ...data, asientoId: 'ast-v2-init', hashVersion: 'canonical-v2', tenantSequence: BigInt(1), hash: construirHashAsientoV2({ ...data, tenantSequence: BigInt(1) }) };
		prismaMock.asiento.findMany.mockResolvedValue([row]);
		expect(await inicializarMetadataCadenaHistorica({ asiento: prismaMock.asiento } as never, BASE.tenantId)).toBe(0);
		expect(prismaMock.asiento.update).not.toHaveBeenCalled();
	});

	it('rechaza secuencias con huecos durante verificación', async () => {
		const a1 = { ...asientoCon(1, 100, null, '2026-09-01T10:00:00Z'), tenantSequence: BigInt(1) };
		const a2 = { ...asientoCon(2, 200, a1.hash, '2026-09-01T11:00:00Z'), tenantSequence: BigInt(3) };
		prismaMock.asiento.findMany.mockResolvedValue([a1, a2]);
		const resultado = await verificarCadenaAsientos('tenant-v');
		expect(resultado.integro).toBe(false);
	});

	it('tenant sin asientos: cadena vacía íntegra', async () => {
		prismaMock.asiento.findMany.mockResolvedValue([]);
		const resultado = await verificarCadenaAsientos('tenant-v');
		expect(resultado.integro).toBe(true);
		expect(resultado.total).toBe(0);
	});
});
