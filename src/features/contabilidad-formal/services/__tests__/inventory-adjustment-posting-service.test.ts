import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../posting-engine', () => ({
	postEvento: vi.fn(),
}));
vi.mock('@/features/contabilidad/services/exchange-rate-provider', () => ({
	exchangeRateProvider: { getRateAsOf: vi.fn() },
}));

import { exchangeRateProvider } from '@/features/contabilidad/services/exchange-rate-provider';
import { postEvento } from '../posting-engine';
import {
	emitirProduccionInventario,
	emitirReconocimientoMerma,
	emitirReversionMermaSiContabilizada,
} from '../inventory-adjustment-posting-service';
import type { PostingTx } from '../posting-engine';

describe('inventory adjustment posting service', () => {
	const txMock = {
		tenantAccountingPolicy: { findUnique: vi.fn() },
		asiento: { findFirst: vi.fn() },
		shadowPosteoOutbox: { findFirst: vi.fn() },
	};
	const tx = txMock as unknown as PostingTx;
	const ctx = { tenantId: 'tenant-1', userId: 'user-1' };
	const fecha = new Date('2026-11-03T10:00:00.000Z');

	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubEnv('CONTABILIDAD_FORMAL_MODE', 'enforce');
		txMock.tenantAccountingPolicy.findUnique.mockResolvedValue({ functionalCurrencyCode: 'CUP' });
		txMock.asiento.findFirst.mockResolvedValue(null);
		txMock.shadowPosteoOutbox.findFirst.mockResolvedValue(null);
		vi.mocked(postEvento).mockResolvedValue({ estado: 'CONTABILIZADO', asientoId: 'asiento-1' });
	});

	it('emite MERMA_INVENTARIO anclada a la versión del ajuste', async () => {
		await emitirReconocimientoMerma(tx, ctx, {
			ajusteInventarioId: 'ajuste-1',
			fecha,
			costoTotal: 1250,
		});

		expect(postEvento).toHaveBeenCalledWith(tx, ctx, expect.objectContaining({
			tipo: 'MERMA_INVENTARIO',
			origen: { tipo: 'ajuste_merma', id: 'ajuste-1' },
			monto: 1250,
			moneda: 'CUP',
			montoFuncional: 1250,
		}));
	});

	it('emite reverso solo si hay asiento original contabilizado', async () => {
		txMock.asiento.findFirst.mockResolvedValue({ asientoId: 'asiento-1' });

		await emitirReversionMermaSiContabilizada(tx, ctx, {
			ajusteInventarioId: 'ajuste-1',
			fecha,
			costoTotal: 1250,
		});

		expect(postEvento).toHaveBeenCalledWith(tx, ctx, expect.objectContaining({
			tipo: 'MERMA_INVENTARIO_REVERSADA',
			origen: { tipo: 'ajuste_merma_reversado', id: 'ajuste-1' },
			monto: 1250,
			montoFuncional: 1250,
		}));
	});

	it('no emite reverso cuando no existe asiento original', async () => {
		txMock.asiento.findFirst.mockResolvedValue(null);

		await emitirReversionMermaSiContabilizada(tx, ctx, {
			ajusteInventarioId: 'ajuste-legacy',
			fecha,
			costoTotal: 900,
		});

		expect(postEvento).not.toHaveBeenCalled();
	});

	it('usa la tasa publicada para valorar producción en moneda funcional', async () => {
		txMock.tenantAccountingPolicy.findUnique.mockResolvedValue({ functionalCurrencyCode: 'USD' });
		vi.mocked(exchangeRateProvider.getRateAsOf).mockResolvedValue({
			tasaId: 'rate-1', tasa: 0.04, fechaVigencia: fecha,
		});

		await emitirProduccionInventario(tx, ctx, {
			ordenProduccionId: 'orden-1', fecha, costoMaterialesCUP: 2500,
		});

		expect(postEvento).toHaveBeenCalledWith(tx, ctx, expect.objectContaining({
			tipo: 'PRODUCCION_SALIDA',
			origen: { tipo: 'orden_produccion', id: 'orden-1' },
			monto: 2500,
			moneda: 'CUP',
			montoFuncional: 100,
			tasaCambio: 0.04,
			fxEvidenceFingerprint: expect.any(String),
		}));
	});

	it('omite merma y producción sin monto positivo', async () => {
		await expect(emitirReconocimientoMerma(tx, ctx, {
			ajusteInventarioId: 'ajuste-cero', fecha, costoTotal: 0,
		})).resolves.toEqual({ estado: 'OMITIDO', motivo: 'MONTO_NO_POSITIVO' });
		await expect(emitirProduccionInventario(tx, ctx, {
			ordenProduccionId: 'orden-cero', fecha, costoMaterialesCUP: 0,
		})).resolves.toEqual({ estado: 'OMITIDO', motivo: 'MONTO_NO_POSITIVO' });

		expect(postEvento).not.toHaveBeenCalled();
	});

	it('revierte un original simulado aunque el modo actual sea enforce', async () => {
		txMock.asiento.findFirst.mockResolvedValue(null);
		txMock.shadowPosteoOutbox.findFirst.mockResolvedValue({ id: 'outbox-1' });

		await emitirReversionMermaSiContabilizada(tx, ctx, {
			ajusteInventarioId: 'ajuste-1', fecha, costoTotal: 1250,
		});

		expect(postEvento).toHaveBeenCalledWith(tx, ctx, expect.objectContaining({
			tipo: 'MERMA_INVENTARIO_REVERSADA',
			origen: { tipo: 'ajuste_merma_reversado', id: 'ajuste-1' },
		}));
	});

	it('en shadow busca el evento original simulado y no depende del asiento', async () => {
		vi.stubEnv('CONTABILIDAD_FORMAL_MODE', 'shadow');
		txMock.asiento.findFirst.mockResolvedValue(null);
		txMock.shadowPosteoOutbox.findFirst.mockResolvedValue({ id: 'outbox-1' });

		await emitirReversionMermaSiContabilizada(tx, ctx, {
			ajusteInventarioId: 'ajuste-1', fecha, costoTotal: 1250,
		});

		expect(txMock.shadowPosteoOutbox.findFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					tenantId: 'tenant-1',
					tipoEvento: 'MERMA_INVENTARIO',
					origenTipo: 'ajuste_merma',
					origenId: 'ajuste-1',
					estado: 'SIMULADO',
				}),
			}),
		);
		expect(postEvento).toHaveBeenCalledWith(tx, ctx, expect.objectContaining({
			tipo: 'MERMA_INVENTARIO_REVERSADA',
		}));
	});

	it('no emite reverso si el evento original solo existe en el outbox real', async () => {
		vi.stubEnv('CONTABILIDAD_FORMAL_MODE', 'shadow');
		txMock.shadowPosteoOutbox.findFirst.mockResolvedValue(null);

		const resultado = await emitirReversionMermaSiContabilizada(tx, ctx, {
			ajusteInventarioId: 'ajuste-1', fecha, costoTotal: 1250,
		});

		expect(resultado).toBeNull();
		expect(postEvento).not.toHaveBeenCalled();
	});
});
