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

	it('emite COBRO_CXC con reconciliacion', async () => {
		await emitirLiquidacionFormal(tx, ctx, {
			tipo: 'COBRO_CXC',
			reconciliationId: 'recon-1',
			amount: 5000,
			currency: 'CUP',
			functionalAmount: 5000,
			functionalCurrency: 'CUP',
			exchangeRate: 1,
			fxEvidenceFingerprint: 'fx-hash',
			fecha: fecha,
			treasuryAccountType: 'BANCOS',
		});

		expect(postEvento).toHaveBeenCalledWith(tx, ctx, expect.objectContaining({
			tipo: 'COBRO_CXC',
			monto: 5000,
			moneda: 'CUP',
			montoFuncional: 5000,
		}), {});
	});

	it('emite COBRO_SERVICIO', async () => {
		await emitirLiquidacionFormal(tx, ctx, {
			tipo: 'COBRO_SERVICIO',
			reconciliationId: 'recon-2',
			amount: 2500,
			currency: 'USD',
			functionalAmount: 250000,
			functionalCurrency: 'CUP',
			exchangeRate: 100,
			fxEvidenceFingerprint: 'fx-hash-2',
			fecha: fecha,
			treasuryAccountType: 'EFECTIVO',
		});

		expect(postEvento).toHaveBeenCalledWith(tx, ctx, expect.objectContaining({
			tipo: 'COBRO_SERVICIO',
			monto: 2500,
			moneda: 'USD',
			montoFuncional: 250000,
			tasaCambio: 100,
		}), {});
	});

	it('emite PAGO_CXP', async () => {
		await emitirLiquidacionFormal(tx, ctx, {
			tipo: 'PAGO_CXP',
			reconciliationId: 'recon-3',
			amount: 1000,
			currency: 'CUP',
			functionalAmount: 1000,
			functionalCurrency: 'CUP',
			exchangeRate: 1,
			fxEvidenceFingerprint: 'fx-hash-3',
			fecha: fecha,
			treasuryAccountType: 'BANCOS',
		});

		expect(postEvento).toHaveBeenCalledWith(tx, ctx, expect.objectContaining({
			tipo: 'PAGO_CXP',
			monto: 1000,
			moneda: 'CUP',
		}), {});
	});

	it('omite liquidaciones con monto cero', async () => {
		const result = await emitirLiquidacionFormal(tx, ctx, {
			tipo: 'COBRO_CXC',
			reconciliationId: 'recon-zero',
			amount: 0,
			currency: 'CUP',
			functionalAmount: 0,
			functionalCurrency: 'CUP',
			exchangeRate: 1,
			fxEvidenceFingerprint: 'fx-zero',
			fecha: fecha,
			treasuryAccountType: 'BANCOS',
		});

		expect(result).toEqual({ estado: 'OMITIDO', motivo: 'MONTO_NO_POSITIVO' });
		expect(postEvento).not.toHaveBeenCalled();
	});
});