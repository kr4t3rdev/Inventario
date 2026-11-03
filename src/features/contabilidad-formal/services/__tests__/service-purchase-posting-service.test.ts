import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../posting-engine', () => ({
	postEvento: vi.fn(),
}));

import { postEvento } from '../posting-engine';
import { emitirReconocimientoCompraServicio } from '../service-purchase-posting-service';
import type { PostingTx } from '../posting-engine';

describe('emitirReconocimientoCompraServicio', () => {
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

	it('construye GASTO_CREDITO desde el documento dentro de la transacción', async () => {
		txMock.tenantAccountingPolicy.findUnique.mockResolvedValue({
			functionalCurrencyCode: 'CUP',
		});
		const fecha = new Date('2026-11-02T12:00:00.000Z');

		await emitirReconocimientoCompraServicio(tx, ctx, {
			compraServicioId: 'servicio-1',
			fecha,
			monto: 850,
			moneda: 'CUP',
		});

		expect(postEvento).toHaveBeenCalledWith(
			tx,
			ctx,
			expect.objectContaining({
				tipo: 'GASTO_CREDITO',
				fecha,
				origen: { tipo: 'compra_servicio', id: 'servicio-1' },
				monto: 850,
				moneda: 'CUP',
				montoFuncional: 850,
				monedaFuncional: 'CUP',
			}),
		);
	});

	it('no inventa una valoración funcional sin tasa publicada', async () => {
		txMock.tenantAccountingPolicy.findUnique.mockResolvedValue({
			functionalCurrencyCode: 'CUP',
		});

		await emitirReconocimientoCompraServicio(tx, ctx, {
			compraServicioId: 'servicio-usd',
			fecha: new Date('2026-11-02T12:00:00.000Z'),
			monto: 100,
			moneda: 'USD',
		});

		expect(postEvento).toHaveBeenCalledWith(
			tx,
			ctx,
			expect.objectContaining({
				tipo: 'GASTO_CREDITO',
				montoFuncional: null,
				tasaCambio: null,
				fxEvidenceFingerprint: null,
				monedaFuncional: 'CUP',
			}),
		);
	});

	it('persiste la valoración FX con la vigencia de la tasa del catálogo', async () => {
		txMock.tenantAccountingPolicy.findUnique.mockResolvedValue({
			functionalCurrencyCode: 'CUP',
		});

		await emitirReconocimientoCompraServicio(tx, ctx, {
			compraServicioId: 'servicio-usd-fx',
			fecha: new Date('2026-11-02T12:00:00.000Z'),
			monto: 100,
			moneda: 'USD',
			tasaCambio: 25,
			fechaTasa: new Date('2026-11-01T00:00:00.000Z'),
			fxCatalogRateId: 'rate-1',
		});

		expect(postEvento).toHaveBeenCalledWith(
			tx,
			ctx,
			expect.objectContaining({
				tipo: 'GASTO_CREDITO',
				montoFuncional: 2500,
				monedaFuncional: 'CUP',
				tasaCambio: 25,
				fxEvidenceFingerprint: expect.any(String),
			}),
		);
	});
});
