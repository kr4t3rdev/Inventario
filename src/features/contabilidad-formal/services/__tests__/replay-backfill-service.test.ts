/**
 * @description Test focal del recolector de candidatos del replay.
 *
 * El recolector decide que evento formal corresponde a cada operacion
 * historica. Las reglas son conservadoras: una fuente ambigua se omite con su
 * causa en lugar de contabilizar un asiento que el writer no habria emitido.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolverValuacionOperativa = vi.hoisted(() =>
	vi.fn().mockResolvedValue({
		monedaFuncional: 'CUP',
		montoFuncional: 100,
		tasaCambio: null,
		fxEvidenceFingerprint: null,
	}),
);

vi.mock('@/features/contabilidad-formal/lib/functional-valuation-resolver', () => ({
	resolverValuacionOperativa,
}));

import { Prisma } from '@/generated/prisma';
import { recolectarCandidatos } from '../replay-backfill-service';

describe('recolectarCandidatos', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		resolverValuacionOperativa.mockResolvedValue({
			monedaFuncional: 'CUP',
			montoFuncional: 100,
			tasaCambio: null,
			fxEvidenceFingerprint: null,
		});
	});

	function crearClient(overrides: Record<string, unknown> = {}) {
		return {
			reconciliacionVenta: { findMany: vi.fn().mockResolvedValue([]) },
			factura: { findMany: vi.fn().mockResolvedValue([]) },
			cuentaPorCobrar: { findMany: vi.fn().mockResolvedValue([]) },
			cuentaBancaria: {
				findMany: vi.fn().mockResolvedValue([
					{ cuentaId: 'cuenta-1', tipoCuenta: 'EFECTIVO' },
				]),
			},
			tenantAccountingPolicy: {
				findUnique: vi.fn().mockResolvedValue({ functionalCurrencyCode: 'CUP' }),
			},
			...overrides,
		};
	}

	function conciliacion(overrides: Record<string, unknown> = {}) {
		return {
			reconciliacionId: 'rec-1',
			ventaId: 'venta-1',
			cuentaId: 'cuenta-1',
			monto: new Prisma.Decimal(100),
			moneda: 'CUP',
			montoConvertido: new Prisma.Decimal(100),
			functionalCurrency: 'CUP',
			tasaCambio: null,
			fxEvidenceFingerprint: null,
			fechaReconciliacion: new Date('2026-10-10T00:00:00.000Z'),
			observaciones: 'Cobro de venta',
			idTransferencia: 'AUTO-factura1',
			venta: {
				ventaId: 'venta-1',
				deletedAt: null,
				factura: { idFactura: 'factura-1' },
			},
			...overrides,
		};
	}

	function factura(overrides: Record<string, unknown> = {}) {
		return {
			idFactura: 'factura-1',
			ventaId: 'venta-1',
			total: new Prisma.Decimal(100),
			estado: 'PENDIENTE',
			fechaEmision: new Date('2026-10-05T00:00:00.000Z'),
			...overrides,
		};
	}

	it('reconoce la venta a credito y el cobro de su cuenta por cobrar', async () => {
		const client = crearClient({
			reconciliacionVenta: {
				findMany: vi.fn().mockResolvedValue([conciliacion()]),
			},
			factura: { findMany: vi.fn().mockResolvedValue([factura()]) },
			cuentaPorCobrar: {
				findMany: vi.fn().mockResolvedValue([
					{ id: 'cx-1', facturaId: 'factura-1', estado: 'PENDIENTE' },
				]),
			},
		});

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		expect(candidatos).toHaveLength(2);
		const credito = candidatos.find((c) => c.origenTipo === 'factura');
		expect(credito?.causaOmision).toBeUndefined();
		expect(credito).toMatchObject({
			origenId: 'factura-1',
			evento: {
				tipo: 'VENTA_CREDITO',
				origen: { tipo: 'factura', id: 'factura-1' },
				moneda: 'CUP',
			},
		});
		const cobro = candidatos.find((c) => c.origenTipo === 'reconciliacion_venta');
		expect(cobro?.causaOmision).toBeUndefined();
		expect(cobro).toMatchObject({
			origenId: 'rec-1',
			evento: {
				tipo: 'COBRO_CXC',
				origen: { tipo: 'reconciliacion_venta', id: 'rec-1' },
				medioCobro: 'CAJA',
			},
		});
	});

	it('reconoce la venta cobrada al contado con la valoracion persistida', async () => {
		const client = crearClient({
			reconciliacionVenta: {
				findMany: vi.fn().mockResolvedValue([
					conciliacion({ observaciones: 'Cobro total por contra pago' }),
				]),
			},
			factura: { findMany: vi.fn().mockResolvedValue([factura({ estado: 'PAGADA' })]) },
		});

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		expect(candidatos).toHaveLength(1);
		expect(candidatos[0].causaOmision).toBeUndefined();
		expect(candidatos[0]).toMatchObject({
			origenTipo: 'reconciliacion_venta',
			origenId: 'rec-1',
			evento: {
				tipo: 'VENTA_CONTADO',
				montoFuncional: new Prisma.Decimal(100),
				monedaFuncional: 'CUP',
				referencia: 'AUTO-factura1',
			},
		});
	});

	it('omite la venta cobrada al contado cuando tiene mas de una conciliacion', async () => {
		const client = crearClient({
			reconciliacionVenta: {
				findMany: vi.fn().mockResolvedValue([
					conciliacion(),
					conciliacion({ reconciliacionId: 'rec-2' }),
				]),
			},
			factura: { findMany: vi.fn().mockResolvedValue([factura({ estado: 'PAGADA' })]) },
		});

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		expect(candidatos).toHaveLength(2);
		expect(candidatos.every((c) => c.causaOmision === 'IDENTIDAD_AMBIGUA')).toBe(true);
	});

	it('omite la venta anulada', async () => {
		const client = crearClient({
			reconciliacionVenta: {
				findMany: vi.fn().mockResolvedValue([
					conciliacion({
						venta: {
							ventaId: 'venta-1',
							deletedAt: new Date('2026-10-11T00:00:00.000Z'),
							factura: { idFactura: 'factura-1' },
						},
					}),
				]),
			},
			factura: { findMany: vi.fn().mockResolvedValue([factura()]) },
		});

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		expect(candidatos.every((c) => c.causaOmision === 'VENTA_ANULADA')).toBe(true);
	});

	it('no inventa un asiento para la venta directa sin factura', async () => {
		const client = crearClient({
			reconciliacionVenta: {
				findMany: vi.fn().mockResolvedValue([
					conciliacion({ venta: { ventaId: 'venta-1', deletedAt: null, factura: null } }),
				]),
			},
		});

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		expect(candidatos).toHaveLength(0);
	});

	it('ordena los candidatos por fecha de negocio', async () => {
		const client = crearClient({
			reconciliacionVenta: {
				findMany: vi.fn().mockResolvedValue([
					conciliacion({
						fechaReconciliacion: new Date('2026-10-20T00:00:00.000Z'),
					}),
				]),
			},
			factura: {
				findMany: vi.fn().mockResolvedValue([
					factura({ fechaEmision: new Date('2026-10-01T00:00:00.000Z') }),
				]),
			},
			cuentaPorCobrar: {
				findMany: vi.fn().mockResolvedValue([
					{ id: 'cx-1', facturaId: 'factura-1', estado: 'PENDIENTE' },
				]),
			},
		});

		const candidatos = await recolectarCandidatos('tenant-1', client as never);

		expect(candidatos.map((c) => c.evento.tipo)).toEqual(['VENTA_CREDITO', 'COBRO_CXC']);
	});
});
