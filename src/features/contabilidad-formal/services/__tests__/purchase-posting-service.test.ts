import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../posting-engine', () => ({
	postEvento: vi.fn(),
}));

import { postEvento } from '../posting-engine';
import { emitirReconocimientoCompra } from '../purchase-posting-service';
import type { PostingTx } from '../posting-engine';

describe('emitirReconocimientoCompra', () => {
	const txMock = {
		tenantAccountingPolicy: {
			findUnique: vi.fn(),
		},
	};
	const tx = txMock as unknown as PostingTx;
	const ctx = { tenantId: 'tenant-1', userId: 'user-1' };

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(postEvento).mockResolvedValue({ estado: 'OMITIDO', motivo: 'modo_off' });
	});

	it('construye COMPRA_CREDITO desde el documento dentro de la transacción', async () => {
		txMock.tenantAccountingPolicy.findUnique.mockResolvedValue({
			functionalCurrencyCode: 'CUP',
		});
		const fecha = new Date('2026-11-02T12:00:00.000Z');

		await emitirReconocimientoCompra(tx, ctx, {
			compraDocumentoId: 'compra-1',
			fecha,
			monto: 850,
			moneda: 'CUP',
		});

		expect(postEvento).toHaveBeenCalledWith(
			tx,
			ctx,
			expect.objectContaining({
				tipo: 'COMPRA_CREDITO',
				fecha,
				origen: { tipo: 'compra_documento', id: 'compra-1' },
				monto: 850,
				moneda: 'CUP',
				montoFuncional: 850,
				monedaFuncional: 'CUP',
			}),
		);
	});

	it('no inventa una valoración funcional para compras en moneda extranjera', async () => {
		txMock.tenantAccountingPolicy.findUnique.mockResolvedValue({
			functionalCurrencyCode: 'CUP',
		});

		await emitirReconocimientoCompra(tx, ctx, {
			compraDocumentoId: 'compra-usd',
			fecha: new Date('2026-11-02T12:00:00.000Z'),
			monto: 100,
			moneda: 'USD',
		});

		expect(postEvento).toHaveBeenCalledWith(
			tx,
			ctx,
			expect.objectContaining({
				tipo: 'COMPRA_CREDITO',
				montoFuncional: null,
				monedaFuncional: 'CUP',
			}),
		);
	});

	it('persiste la valoración FX informada para el reconocimiento', async () => {
		txMock.tenantAccountingPolicy.findUnique.mockResolvedValue({
			functionalCurrencyCode: 'CUP',
		});

		await emitirReconocimientoCompra(tx, ctx, {
			compraDocumentoId: 'compra-usd-fx',
			fecha: new Date('2026-11-02T12:00:00.000Z'),
			monto: 100,
			moneda: 'USD',
			tasaCambio: 25,
		});

		expect(postEvento).toHaveBeenCalledWith(
			tx,
			ctx,
			expect.objectContaining({
				tipo: 'COMPRA_CREDITO',
				montoFuncional: 2500,
				monedaFuncional: 'CUP',
				tasaCambio: 25,
				fxEvidenceFingerprint: expect.any(String),
			}),
		);
	});
});
