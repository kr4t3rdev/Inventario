import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../posting-engine', () => ({
	postEvento: vi.fn(),
}));
vi.mock('@/features/contabilidad/services/exchange-rate-provider', () => ({
	exchangeRateProvider: { getRateAsOf: vi.fn() },
}));

import { exchangeRateProvider } from '@/features/contabilidad/services/exchange-rate-provider';
import { postEvento } from '../posting-engine';
import { emitirVentaServicio } from '../service-sale-posting-service';
import type { PostingTx } from '../posting-engine';

describe('service sale posting service', () => {
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

	it('reconoce la venta de servicio contra la cuenta por cobrar', async () => {
		await emitirVentaServicio(tx, ctx, {
			ventaServicioId: 'vs-1',
			fecha,
			monto: 1500,
			moneda: 'CUP',
		});

		expect(postEvento).toHaveBeenCalledWith(tx, ctx, expect.objectContaining({
			tipo: 'VENTA_SERVICIO_CREDITO',
			origen: { tipo: 'venta_servicio', id: 'vs-1' },
			monto: 1500,
			moneda: 'CUP',
			montoFuncional: 1500,
			monedaFuncional: 'CUP',
		}));
	});

	it('omite la venta sin monto positivo', async () => {
		const result = await emitirVentaServicio(tx, ctx, {
			ventaServicioId: 'vs-cero',
			fecha,
			monto: 0,
			moneda: 'CUP',
		});

		expect(result).toEqual({ estado: 'OMITIDO', motivo: 'MONTO_NO_POSITIVO' });
		expect(postEvento).not.toHaveBeenCalled();
	});

	it('valora en la moneda funcional con la tasa publicada vigente', async () => {
		txMock.tenantAccountingPolicy.findUnique.mockResolvedValue({ functionalCurrencyCode: 'USD' });
		vi.mocked(exchangeRateProvider.getRateAsOf).mockResolvedValue({
			tasaId: 'rate-1', tasa: 0.04, fechaVigencia: fecha,
		});

		await emitirVentaServicio(tx, ctx, {
			ventaServicioId: 'vs-2',
			fecha,
			monto: 2500,
			moneda: 'CUP',
		});

		expect(exchangeRateProvider.getRateAsOf).toHaveBeenCalledWith(expect.objectContaining({
			sourceCurrency: 'CUP',
			targetCurrency: 'USD',
			boundaryAt: fecha,
		}));
		expect(postEvento).toHaveBeenCalledWith(tx, ctx, expect.objectContaining({
			tipo: 'VENTA_SERVICIO_CREDITO',
			monto: 2500,
			montoFuncional: 100,
			tasaCambio: 0.04,
			fxEvidenceFingerprint: expect.any(String),
		}));
	});

	it('deja la valoración funcional ausente cuando no hay tasa publicada', async () => {
		txMock.tenantAccountingPolicy.findUnique.mockResolvedValue({ functionalCurrencyCode: 'USD' });
		vi.mocked(exchangeRateProvider.getRateAsOf).mockResolvedValue(null);

		await emitirVentaServicio(tx, ctx, {
			ventaServicioId: 'vs-3',
			fecha,
			monto: 2500,
			moneda: 'CUP',
		});

		expect(postEvento).toHaveBeenCalledWith(tx, ctx, expect.objectContaining({
			montoFuncional: null,
			tasaCambio: null,
			fxEvidenceFingerprint: null,
		}));
	});

	it('normaliza la moneda de la operación en mayúsculas', async () => {
		await emitirVentaServicio(tx, ctx, {
			ventaServicioId: 'vs-4',
			fecha,
			monto: 100,
			moneda: 'usd',
		});

		expect(postEvento).toHaveBeenCalledWith(tx, ctx, expect.objectContaining({
			moneda: 'USD',
		}));
	});
});
