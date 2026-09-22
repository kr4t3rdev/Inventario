/**
 * @description Contratos del verificador forense de la cadena de hash (CTA-3):
 * recalcula cada asiento y reporta el primer punto de ruptura exacto.
 */
import { describe, expect, it, vi } from 'vitest';

import { construirHashAsiento } from '@/features/contabilidad-formal/services/posting-engine';
import { verificarCadenaAsientos } from '@/features/contabilidad-formal/services/verificador-hash-service';

const prismaMock = vi.hoisted(() => ({
	asiento: { findMany: vi.fn() },
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

const BASE = {
	tenantId: 'tenant-v',
	diarioId: 'dia-v',
	periodoId: 'per-1',
	origenTipo: 'venta',
};

function asientoCon(numero: number, monto: number, hashAnterior: string | null, fechaIso: string) {
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
	};
	return {
		...datos,
		asientoId: `ast-${numero}`,
		hash: construirHashAsiento(datos),
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

	it('tenant sin asientos: cadena vacía íntegra', async () => {
		prismaMock.asiento.findMany.mockResolvedValue([]);
		const resultado = await verificarCadenaAsientos('tenant-v');
		expect(resultado.integro).toBe(true);
		expect(resultado.total).toBe(0);
	});
});
