/**
 * @description Test focal del emisor formal de la venta de productos (S4(a)).
 *
 * Cubre el reconocimiento a credito (que abre la cuenta por cobrar) y el
 * reconocimiento al contado (que debita la tesoreria), incluida la valoracion
 * funcional, el medio de cobro y las guardas de monto.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../posting-engine', () => ({
	postEvento: vi.fn(),
}));
vi.mock('@/features/contabilidad/services/exchange-rate-provider', () => ({
	exchangeRateProvider: { getRateAsOf: vi.fn() },
}));

import { exchangeRateProvider } from '@/features/contabilidad/services/exchange-rate-provider';
import { postEvento } from '../posting-engine';
import { emitirVentaContado, emitirVentaCredito } from '../sale-posting-service';
import type { PostingTx } from '../posting-engine';

describe('sale posting service', () => {
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

	it('reconoce la venta a crédito contra la cuenta por cobrar', async () => {
		await emitirVentaCredito(tx, ctx, {
			facturaId: 'factura-1',
			fecha,
			monto: 5000,
		});

		expect(postEvento).toHaveBeenCalledWith(tx, ctx, expect.objectContaining({
			tipo: 'VENTA_CREDITO',
			origen: { tipo: 'factura', id: 'factura-1' },
			monto: 5000,
			moneda: 'CUP',
			montoFuncional: 5000,
			monedaFuncional: 'CUP',
		}));
	});

	it('reconoce la venta al contado con la tesorería como contrapartida', async () => {
		await emitirVentaContado(tx, ctx, {
			reconciliacionId: 'recon-1',
			fecha,
			monto: 3000,
			moneda: 'CUP',
			montoFuncional: 3000,
			monedaFuncional: 'CUP',
			tasaCambio: 1,
			fxEvidenceFingerprint: 'fx-1',
			treasuryAccountType: 'EFECTIVO',
			referencia: 'AUTO-1234',
		});

		expect(postEvento).toHaveBeenCalledWith(tx, ctx, expect.objectContaining({
			tipo: 'VENTA_CONTADO',
			origen: { tipo: 'reconciliacion_venta', id: 'recon-1' },
			monto: 3000,
			moneda: 'CUP',
			montoFuncional: 3000,
			medioCobro: 'CAJA',
			referencia: 'AUTO-1234',
		}));
	});

	it('deriva el medio de cobro en BANCOS cuando la cuenta no es de efectivo', async () => {
		await emitirVentaContado(tx, ctx, {
			reconciliacionId: 'recon-2',
			fecha,
			monto: 3000,
			moneda: 'CUP',
			montoFuncional: 3000,
			monedaFuncional: 'CUP',
			treasuryAccountType: 'CORRIENTE',
		});

		expect(postEvento).toHaveBeenCalledWith(tx, ctx, expect.objectContaining({
			medioCobro: 'BANCOS',
		}));
	});

	it('consume la valoración persistida en la conciliación sin recalcularla', async () => {
		await emitirVentaContado(tx, ctx, {
			reconciliacionId: 'recon-3',
			fecha,
			monto: 2500,
			moneda: 'USD',
			montoFuncional: 250000,
			monedaFuncional: 'CUP',
			tasaCambio: 100,
			fxEvidenceFingerprint: 'fx-3',
		});

		expect(txMock.tenantAccountingPolicy.findUnique).not.toHaveBeenCalled();
		expect(exchangeRateProvider.getRateAsOf).not.toHaveBeenCalled();
		expect(postEvento).toHaveBeenCalledWith(tx, ctx, expect.objectContaining({
			monto: 2500,
			moneda: 'USD',
			montoFuncional: 250000,
			monedaFuncional: 'CUP',
			tasaCambio: 100,
			fxEvidenceFingerprint: 'fx-3',
		}));
	});

	it('omite el reconocimiento sin monto positivo', async () => {
		const credito = await emitirVentaCredito(tx, ctx, {
			facturaId: 'factura-cero',
			fecha,
			monto: 0,
		});
		const contado = await emitirVentaContado(tx, ctx, {
			reconciliacionId: 'recon-cero',
			fecha,
			monto: 0,
			moneda: 'CUP',
		});

		expect(credito).toEqual({ estado: 'OMITIDO', motivo: 'MONTO_NO_POSITIVO' });
		expect(contado).toEqual({ estado: 'OMITIDO', motivo: 'MONTO_NO_POSITIVO' });
		expect(postEvento).not.toHaveBeenCalled();
	});

	it('valora la venta a crédito con la tasa publicada vigente', async () => {
		txMock.tenantAccountingPolicy.findUnique.mockResolvedValue({ functionalCurrencyCode: 'USD' });
		vi.mocked(exchangeRateProvider.getRateAsOf).mockResolvedValue({
			tasaId: 'rate-1', tasa: 0.04, fechaVigencia: fecha,
		});

		await emitirVentaCredito(tx, ctx, {
			facturaId: 'factura-2',
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
			monto: 2500,
			montoFuncional: 100,
			tasaCambio: 0.04,
			fxEvidenceFingerprint: expect.any(String),
		}));
	});

	it('deja la valoración funcional ausente cuando no hay tasa publicada', async () => {
		txMock.tenantAccountingPolicy.findUnique.mockResolvedValue({ functionalCurrencyCode: 'USD' });
		vi.mocked(exchangeRateProvider.getRateAsOf).mockResolvedValue(null);

		await emitirVentaCredito(tx, ctx, {
			facturaId: 'factura-3',
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
});
