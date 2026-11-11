/**
 * @description Test focal de la valoración del costo FIFO de una venta.
 *
 * El costo se devenga en la moneda funcional del tenant: cada porción del
 * FIFO se valora con la tasa publicada vigente en la fecha de su fuente. Sin
 * tasa, el costo funcional queda sin completar en lugar de estimarse.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/contabilidad/services/exchange-rate-provider', () => ({
	exchangeRateProvider: { getRateAsOf: vi.fn() },
}));

import { exchangeRateProvider } from '@/features/contabilidad/services/exchange-rate-provider';
import { buildAppliedFxEvidence } from '@/features/contabilidad/domain/fx-evidence';
import { getCostoFifoVentaValorado } from '@/lib/services/fifo-allocation';

describe('getCostoFifoVentaValorado', () => {
	const txMock = {
		purchaseAllocation: { findMany: vi.fn() },
		tenantAccountingPolicy: { findUnique: vi.fn() },
	};
	const tx = txMock as never;
	const fechaCompra = new Date('2026-10-01T00:00:00.000Z');

	beforeEach(() => {
		vi.clearAllMocks();
		txMock.tenantAccountingPolicy.findUnique.mockResolvedValue({ functionalCurrencyCode: 'CUP' });
		vi.mocked(exchangeRateProvider.getRateAsOf).mockResolvedValue(null);
	});

	it('devuelve null cuando la venta no tiene asignaciones FIFO', async () => {
		txMock.purchaseAllocation.findMany.mockResolvedValue([]);

		await expect(getCostoFifoVentaValorado(tx, 'tenant-1', 'venta-1')).resolves.toBeNull();
		expect(exchangeRateProvider.getRateAsOf).not.toHaveBeenCalled();
	});

	it('valora el costo en la moneda funcional sin consultar tasa cuando la fuente esta en CUP', async () => {
		txMock.purchaseAllocation.findMany.mockResolvedValue([
			{
				cantidad: 3,
				costoUnitarioSnapshot: null,
				compraDocumentoItem: {
					precioUnitario: 250,
					compraDocumento: { moneda: 'CUP', fechaCompra },
				},
			},
		]);

		const costo = await getCostoFifoVentaValorado(tx, 'tenant-1', 'venta-1');

		expect(costo).toEqual({
			montoFuncional: 750,
			monedaFuncional: 'CUP',
			cantidad: 3,
			fuentesSinTasa: [],
		});
		expect(exchangeRateProvider.getRateAsOf).not.toHaveBeenCalled();
	});

	it('no atribuye CUP al costo de recepcion sin moneda acreditada', async () => {
		txMock.purchaseAllocation.findMany.mockResolvedValue([
			{
				cantidad: 2,
				costoUnitarioSnapshot: 400,
				compraDocumentoItem: null,
			},
		]);

		const costo = await getCostoFifoVentaValorado(tx, 'tenant-1', 'venta-1');

		expect(costo?.montoFuncional).toBeNull();
		expect(costo?.cantidad).toBe(2);
	});

	it('no presenta un costo parcial cuando una porcion carece de procedencia', async () => {
		txMock.purchaseAllocation.findMany.mockResolvedValue([
			{ cantidad: 1, costoUnitarioSnapshot: 20, compraDocumentoItem: {
				precioUnitario: 20, compraDocumento: { moneda: 'CUP', fechaCompra } } },
			{ cantidad: 2, costoUnitarioSnapshot: 400, compraDocumentoItem: null },
		]);
		const costo = await getCostoFifoVentaValorado(tx, 'tenant-1', 'venta-1');
		expect(costo?.montoFuncional).toBeNull();
		expect(costo?.cantidad).toBe(3);
	});

	it('convierte una fuente extranjera con la tasa publicada de su fecha', async () => {
		txMock.purchaseAllocation.findMany.mockResolvedValue([
			{
				cantidad: 2,
				costoUnitarioSnapshot: null,
				compraDocumentoItem: {
					precioUnitario: 10,
					compraDocumento: { moneda: 'USD', fechaCompra },
				},
			},
		]);
		vi.mocked(exchangeRateProvider.getRateAsOf).mockResolvedValue({
			tasaId: 'rate-1',
			tasa: 320,
			fechaVigencia: fechaCompra,
		});

		const costo = await getCostoFifoVentaValorado(tx, 'tenant-1', 'venta-1');

		expect(exchangeRateProvider.getRateAsOf).toHaveBeenCalledWith(expect.objectContaining({
			sourceCurrency: 'USD',
			targetCurrency: 'CUP',
			boundaryAt: fechaCompra,
			client: tx,
		}));
		expect(costo?.montoFuncional).toBe(6400);
		expect(costo?.fuentesSinTasa).toEqual([]);
	});

	it('usa el snapshot FX canónico sin volver a consultar la tasa', async () => {
		const fx = buildAppliedFxEvidence({ originalAmount: 250, originalCurrency: 'USD',
			functionalCurrency: 'CUP', exchangeRate: 0.04, convertedAmount: 10,
			rateEffectiveAt: fechaCompra, fxCatalogRateId: 'rate-fx', source: 'fifo-allocation' });
		txMock.purchaseAllocation.findMany.mockResolvedValue([{
			cantidad: 2, costoUnitarioSnapshot: 125, fifoMonedaOrigen: 'USD', fifoFechaFuente: fechaCompra,
			fifoMonedaFuncional: 'CUP', fifoCostoFuncional: 10, fifoTasaCambio: 0.04,
			fifoFechaTasa: fechaCompra,
			fifoEvidenciaFx: JSON.stringify({ ...fx, rawConvertedAmount: 10, rawExchangeRate: 0.04 }),
			compraDocumentoItem: { precioUnitario: 125, compraDocumento: { moneda: 'USD', fechaCompra } },
		}]);

		const costo = await getCostoFifoVentaValorado(tx, 'tenant-1', 'venta-1');

		expect(costo).toEqual({ montoFuncional: 10, monedaFuncional: 'CUP', cantidad: 2, fuentesSinTasa: [] });
		expect(exchangeRateProvider.getRateAsOf).not.toHaveBeenCalled();
	});

	it('fails closed when a receipt snapshot has no invoice-to-receipt provenance', async () => {
		const fx = buildAppliedFxEvidence({ originalAmount: 500, originalCurrency: 'USD',
			functionalCurrency: 'CUP', exchangeRate: 0.04, convertedAmount: 20,
			rateEffectiveAt: fechaCompra, fxCatalogRateId: null, source: 'fifo-allocation' });
		txMock.purchaseAllocation.findMany.mockResolvedValue([{
			cantidad: 2, recepcionItemId: 'receipt-without-invoice-link',
			costoUnitarioSnapshot: 250, fifoMonedaOrigen: 'USD', fifoFechaFuente: fechaCompra,
			fifoMonedaFuncional: 'CUP', fifoCostoFuncional: 20, fifoTasaCambio: 0.04,
			fifoFechaTasa: fechaCompra,
			fifoEvidenciaFx: JSON.stringify({ ...fx, rawConvertedAmount: 20, rawExchangeRate: 0.04 }),
			compraDocumentoItem: null,
			recepcionItem: { id: 'receipt-without-invoice-link' },
			purchaseReceiptInvoiceAllocation: null,
		}]);

		const costo = await getCostoFifoVentaValorado(tx, 'tenant-1', 'venta-1');

		expect(costo?.montoFuncional).toBeNull();
		expect(costo?.fuentesSinTasa).toContain('PROCEDENCIA_FIFO_NO_VERIFICABLE');
	});

	it('values a billed receipt only through its canonical invoice-line provenance', async () => {
		const date = new Date('2026-09-01T00:00:00.000Z');
		const sourceEvidence = buildAppliedFxEvidence({
			originalAmount: 240, originalCurrency: 'USD', functionalCurrency: 'CUP',
			exchangeRate: 25, convertedAmount: 6000, rateEffectiveAt: date,
			fxCatalogRateId: null, source: 'purchase-receipt-invoice-allocation',
		});
		const saleEvidence = buildAppliedFxEvidence({
			originalAmount: 240, originalCurrency: 'USD', functionalCurrency: 'CUP',
			exchangeRate: 25, convertedAmount: 6000, rateEffectiveAt: date,
			fxCatalogRateId: null, source: 'fifo-allocation',
		});
		txMock.purchaseAllocation.findMany.mockResolvedValue([{
			tenantId: 'tenant-1', recepcionItemId: 'receipt-1',
			purchaseReceiptInvoiceAllocationId: 'invoice-receipt-1', cantidad: 2,
			costoUnitarioSnapshot: 120, fifoMonedaOrigen: 'USD', fifoFechaFuente: date,
			fifoMonedaFuncional: 'CUP', fifoCostoFuncional: 6000,
			fifoTasaCambio: 25, fifoFechaTasa: date,
			fifoEvidenciaFx: JSON.stringify({ ...saleEvidence,
				rawConvertedAmount: 6000, rawExchangeRate: 25 }),
			recepcionItem: { id: 'receipt-1', tenantId: 'tenant-1', productoId: 'product-1',
				ordenItem: { tenantId: 'tenant-1', ordenId: 'order-1', productoId: 'product-1' } },
			purchaseReceiptInvoiceAllocation: {
				id: 'invoice-receipt-1', tenantId: 'tenant-1', recepcionItemId: 'receipt-1',
				compraDocumentoItemId: 'invoice-line-1', cantidad: 2,
				costoUnitarioSnapshot: 120, fifoMonedaOrigen: 'USD', fifoFechaFuente: date,
				fifoMonedaFuncional: 'CUP', fifoCostoFuncional: 6000,
				fifoTasaCambio: 25, fifoFechaTasa: date,
				fifoEvidenciaFx: JSON.stringify({ ...sourceEvidence,
					rawConvertedAmount: 6000, rawExchangeRate: 25 }),
				compraDocumentoItem: {
					compraDocumentoItemId: 'invoice-line-1', tenantId: 'tenant-1', productoId: 'product-1',
					cantidad: 2, precioUnitario: 120,
					compraDocumento: { tenantId: 'tenant-1', ordenCompraId: 'order-1', estado: 'PAGADA',
						deletedAt: null, moneda: 'USD', fechaCompra: date },
				},
			},
		}]);

		await expect(getCostoFifoVentaValorado(tx, 'tenant-1', 'venta-1')).resolves.toMatchObject({
			montoFuncional: 6000, monedaFuncional: 'CUP', cantidad: 2, fuentesSinTasa: [],
		});
		expect(exchangeRateProvider.getRateAsOf).not.toHaveBeenCalled();
	});

	it('fails closed when invoice provenance ID exists without its receipt ID', async () => {
		const fx = buildAppliedFxEvidence({ originalAmount: 500, originalCurrency: 'USD',
			functionalCurrency: 'CUP', exchangeRate: 25, convertedAmount: 12500,
			rateEffectiveAt: fechaCompra, fxCatalogRateId: null, source: 'fifo-allocation' });
		txMock.purchaseAllocation.findMany.mockResolvedValue([{
			tenantId: 'tenant-1', purchaseReceiptInvoiceAllocationId: 'invoice-receipt-1', cantidad: 2,
			costoUnitarioSnapshot: 250, fifoMonedaOrigen: 'USD', fifoFechaFuente: fechaCompra,
			fifoMonedaFuncional: 'CUP', fifoCostoFuncional: 12500, fifoTasaCambio: 25,
			fifoFechaTasa: fechaCompra,
			fifoEvidenciaFx: JSON.stringify({ ...fx, rawConvertedAmount: 12500, rawExchangeRate: 25 }),
			purchaseReceiptInvoiceAllocation: { id: 'invoice-receipt-1', tenantId: 'tenant-1' },
		}]);

		const costo = await getCostoFifoVentaValorado(tx, 'tenant-1', 'venta-1');

		expect(costo?.montoFuncional).toBeNull();
		expect(costo?.fuentesSinTasa).toContain('PROCEDENCIA_FIFO_NO_VERIFICABLE');
	});

	it('rechaza campos canónicos alterados aunque la huella se conserve', async () => {
		const fx = buildAppliedFxEvidence({ originalAmount: 250, originalCurrency: 'USD',
			functionalCurrency: 'CUP', exchangeRate: 0.04, convertedAmount: 10,
			rateEffectiveAt: fechaCompra, fxCatalogRateId: 'rate-fx', source: 'fifo-allocation' });
		txMock.purchaseAllocation.findMany.mockResolvedValue([{
			cantidad: 2, costoUnitarioSnapshot: 125, fifoMonedaOrigen: 'USD', fifoFechaFuente: fechaCompra,
			fifoMonedaFuncional: 'CUP', fifoCostoFuncional: 10, fifoTasaCambio: 0.04,
			fifoFechaTasa: fechaCompra,
			fifoEvidenciaFx: JSON.stringify({ ...fx, functionalCurrency: 'EUR',
				rawConvertedAmount: 10, rawExchangeRate: 0.04 }),
			compraDocumentoItem: { precioUnitario: 125, compraDocumento: { moneda: 'USD', fechaCompra } },
		}]);

		const costo = await getCostoFifoVentaValorado(tx, 'tenant-1', 'venta-1');

		expect(costo?.montoFuncional).toBeNull();
		expect(costo?.fuentesSinTasa).toContain('PROCEDENCIA_FIFO_NO_VERIFICABLE');
	});

	it('conserva moneda y fecha capturadas aunque cambie el documento de compra', async () => {
		txMock.purchaseAllocation.findMany.mockResolvedValue([{ cantidad: 2, costoUnitarioSnapshot: 10,
			fifoMonedaOrigen: 'USD', fifoFechaFuente: fechaCompra,
			compraDocumentoItem: { precioUnitario: 20, compraDocumento: { moneda: 'CUP', fechaCompra: new Date('2026-11-01') } } }]);
		vi.mocked(exchangeRateProvider.getRateAsOf).mockResolvedValue({ tasaId: 'rate-1', tasa: 300, fechaVigencia: fechaCompra });
		const costo = await getCostoFifoVentaValorado(tx, 'tenant-1', 'venta-1');
		expect(costo?.montoFuncional).toBe(6000);
		expect(exchangeRateProvider.getRateAsOf).toHaveBeenCalledWith(expect.objectContaining({
			sourceCurrency: 'USD', boundaryAt: fechaCompra }));
	});

	it('rechaza una captura parcial en lugar de mezclarla con la compra actual', async () => {
		txMock.purchaseAllocation.findMany.mockResolvedValue([{ cantidad: 1, costoUnitarioSnapshot: null,
			fifoMonedaOrigen: 'USD', fifoFechaFuente: fechaCompra,
			compraDocumentoItem: { precioUnitario: 20, compraDocumento: { moneda: 'CUP', fechaCompra } } }]);
		expect((await getCostoFifoVentaValorado(tx, 'tenant-1', 'venta-1'))?.montoFuncional).toBeNull();
	});

	it('no completa un costo capturado sin moneda y fecha con el documento actual', async () => {
		txMock.purchaseAllocation.findMany.mockResolvedValue([{ cantidad: 1, costoUnitarioSnapshot: 10,
			fifoMonedaOrigen: null, fifoFechaFuente: null,
			compraDocumentoItem: { precioUnitario: 20, compraDocumento: { moneda: 'CUP', fechaCompra } } }]);
		expect((await getCostoFifoVentaValorado(tx, 'tenant-1', 'venta-1'))?.montoFuncional).toBeNull();
	});

	it('deja el costo funcional sin completar cuando la fuente extranjera no tiene tasa', async () => {
		txMock.purchaseAllocation.findMany.mockResolvedValue([
			{
				cantidad: 2,
				costoUnitarioSnapshot: null,
				compraDocumentoItem: {
					precioUnitario: 10,
					compraDocumento: { moneda: 'USD', fechaCompra },
				},
			},
		]);

		const costo = await getCostoFifoVentaValorado(tx, 'tenant-1', 'venta-1');

		expect(costo?.montoFuncional).toBeNull();
		expect(costo?.fuentesSinTasa).toHaveLength(1);
	});

	it('consulta una tasa por fuente y suma el costo de varias fuentes', async () => {
		const otraFecha = new Date('2026-10-15T00:00:00.000Z');
		txMock.purchaseAllocation.findMany.mockResolvedValue([
			{
				cantidad: 1,
				costoUnitarioSnapshot: null,
				compraDocumentoItem: {
					precioUnitario: 100,
					compraDocumento: { moneda: 'CUP', fechaCompra },
				},
			},
			{
				cantidad: 2,
				costoUnitarioSnapshot: null,
				compraDocumentoItem: {
					precioUnitario: 10,
					compraDocumento: { moneda: 'USD', fechaCompra: otraFecha },
				},
			},
		]);
		vi.mocked(exchangeRateProvider.getRateAsOf).mockResolvedValue({
			tasaId: 'rate-1',
			tasa: 300,
			fechaVigencia: otraFecha,
		});

		const costo = await getCostoFifoVentaValorado(tx, 'tenant-1', 'venta-1');

		// Solo la fuente extranjera consulta tasa; la de CUP usa la misma moneda.
		expect(exchangeRateProvider.getRateAsOf).toHaveBeenCalledTimes(1);
		expect(costo?.montoFuncional).toBe(6100);
		expect(costo?.cantidad).toBe(3);
	});

	it('deja el costo sin completar cuando el tenant no tiene moneda funcional', async () => {
		txMock.tenantAccountingPolicy.findUnique.mockResolvedValue({ functionalCurrencyCode: null });
		txMock.purchaseAllocation.findMany.mockResolvedValue([
			{
				cantidad: 1,
				costoUnitarioSnapshot: null,
				compraDocumentoItem: {
					precioUnitario: 100,
					compraDocumento: { moneda: 'CUP', fechaCompra },
				},
			},
		]);

		const costo = await getCostoFifoVentaValorado(tx, 'tenant-1', 'venta-1');

		expect(costo?.montoFuncional).toBeNull();
		expect(costo?.monedaFuncional).toBeNull();
	});
});
