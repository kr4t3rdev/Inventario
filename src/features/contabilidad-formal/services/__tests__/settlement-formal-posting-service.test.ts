/**
 * @description Tests del emisor formal de liquidaciones (modo global).
 *
 * El emisor comparte la valoracion con el emisor no-Cash y solo difiere en el
 * gate: no depende de `CONTABILIDAD_FORMAL_NO_CASH_MODE` y delega el modo al
 * motor global.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../posting-engine', () => ({
	postEvento: vi.fn(),
}));

import { postEvento } from '../posting-engine';
import { emitirLiquidacionFormal } from '../settlement-formal-posting-service';
import type { PostingTx } from '../posting-engine';

describe('settlement formal posting service', () => {
	const txMock = {
		tenantAccountingPolicy: { findUnique: vi.fn() },
	};
	const tx = txMock as unknown as PostingTx;
	const ctx = { tenantId: 'tenant-1', userId: 'user-1' };
	const fecha = new Date('2026-11-03T10:00:00.000Z');

	beforeEach(() => {
		vi.clearAllMocks();
		txMock.tenantAccountingPolicy.findUnique.mockResolvedValue({ functionalCurrencyCode: 'CUP' });
		vi.mocked(postEvento).mockResolvedValue({ estado: 'CONTABILIZADO', asientoId: 'asiento-1' });
	});

	it('emite COBRO_CXC con la conciliacion persistida', async () => {
		await emitirLiquidacionFormal(tx, ctx, {
			tipo: 'COBRO_CXC',
			reconciliacion: {
				reconciliacionId: 'recon-1',
				monto: 5000,
				moneda: 'CUP',
				montoConvertido: 5000,
				functionalCurrency: 'CUP',
				tasaCambio: 1,
				fxEvidenceFingerprint: 'fx-hash',
				fechaReconciliacion: fecha,
			},
			treasuryAccountType: 'BANCOS',
		});

		expect(postEvento).toHaveBeenCalledWith(tx, ctx, expect.objectContaining({
			tipo: 'COBRO_CXC',
			monto: 5000,
			moneda: 'CUP',
			montoFuncional: 5000,
		}));
	});

	it('emite COBRO_SERVICIO con su evidencia FX', async () => {
		await emitirLiquidacionFormal(tx, ctx, {
			tipo: 'COBRO_SERVICIO',
			reconciliacion: {
				reconciliacionId: 'recon-2',
				monto: 2500,
				moneda: 'USD',
				montoConvertido: 250000,
				functionalCurrency: 'CUP',
				tasaCambio: 100,
				fxEvidenceFingerprint: 'fx-hash-2',
				fechaReconciliacion: fecha,
			},
			treasuryAccountType: 'EFECTIVO',
		});

		expect(postEvento).toHaveBeenCalledWith(tx, ctx, expect.objectContaining({
			tipo: 'COBRO_SERVICIO',
			monto: 2500,
			moneda: 'USD',
			montoFuncional: 250000,
			tasaCambio: 100,
		}));
	});

	it('emite PAGO_CXP', async () => {
		await emitirLiquidacionFormal(tx, ctx, {
			tipo: 'PAGO_CXP',
			reconciliacion: {
				reconciliacionId: 'recon-3',
				monto: 1000,
				moneda: 'CUP',
				montoConvertido: 1000,
				functionalCurrency: 'CUP',
				tasaCambio: 1,
				fxEvidenceFingerprint: 'fx-hash-3',
				fechaReconciliacion: fecha,
			},
			treasuryAccountType: 'BANCOS',
		});

		expect(postEvento).toHaveBeenCalledWith(tx, ctx, expect.objectContaining({
			tipo: 'PAGO_CXP',
			monto: 1000,
			moneda: 'CUP',
		}));
	});

	it('omite liquidaciones con monto cero', async () => {
		const result = await emitirLiquidacionFormal(tx, ctx, {
			tipo: 'COBRO_CXC',
			reconciliacion: {
				reconciliacionId: 'recon-zero',
				monto: 0,
				moneda: 'CUP',
				montoConvertido: 0,
				functionalCurrency: 'CUP',
				tasaCambio: 1,
				fxEvidenceFingerprint: 'fx-zero',
				fechaReconciliacion: fecha,
			},
			treasuryAccountType: 'BANCOS',
		});

		expect(result).toEqual({ estado: 'OMITIDO', motivo: 'MONTO_NO_POSITIVO' });
		expect(postEvento).not.toHaveBeenCalled();
	});

	it('resuelve la moneda funcional del tenant cuando la conciliacion no la trae', async () => {
		await emitirLiquidacionFormal(tx, ctx, {
			tipo: 'COBRO_CXC',
			reconciliacion: {
				reconciliacionId: 'recon-4',
				monto: 700,
				moneda: 'CUP',
				fechaReconciliacion: fecha,
			},
		});

		expect(txMock.tenantAccountingPolicy.findUnique).toHaveBeenCalledWith({
			where: { tenantId: 'tenant-1' },
			select: { functionalCurrencyCode: true },
		});
		expect(postEvento).toHaveBeenCalledWith(tx, ctx, expect.objectContaining({
			montoFuncional: 700,
			monedaFuncional: 'CUP',
		}));
	});

	it('deja la valoracion funcional ausente cuando la moneda difiere y no hay conversion', async () => {
		txMock.tenantAccountingPolicy.findUnique.mockResolvedValue({ functionalCurrencyCode: 'USD' });

		await emitirLiquidacionFormal(tx, ctx, {
			tipo: 'COBRO_CXC',
			reconciliacion: {
				reconciliacionId: 'recon-5',
				monto: 700,
				moneda: 'CUP',
				fechaReconciliacion: fecha,
			},
		});

		expect(postEvento).toHaveBeenCalledWith(tx, ctx, expect.objectContaining({
			montoFuncional: null,
			monedaFuncional: 'USD',
		}));
	});
});
