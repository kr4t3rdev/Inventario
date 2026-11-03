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

	it('usa el costo snapshot de las asignaciones por recepcion', async () => {
		txMock.purchaseAllocation.findMany.mockResolvedValue([
			{
				cantidad: 2,
				costoUnitarioSnapshot: 400,
				compraDocumentoItem: null,
			},
		]);

		const costo = await getCostoFifoVentaValorado(tx, 'tenant-1', 'venta-1');

		expect(costo?.montoFuncional).toBe(800);
		expect(costo?.cantidad).toBe(2);
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
