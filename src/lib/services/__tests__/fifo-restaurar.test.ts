/**
 * @description Tests del helper restaurarAllocacionesFifo (DNC-T3): restaura
 * unidades a los lotes más antiguos primero y reporta el costo ponderado.
 */
import { describe, it, expect, vi } from 'vitest';
import { buildAppliedFxEvidence } from '@/features/contabilidad/domain/fx-evidence';
import { restaurarAllocacionesFifo } from '@/lib/services/fifo-allocation';

function alloc(id: string, cantidad: number, fecha: string, costo: number) {
	return {
		id,
		cantidad,
		compraDocumentoItem: { createdAt: new Date(fecha), precioUnitario: costo },
	};
}

describe('restaurarAllocacionesFifo (DNC-T3)', () => {
	it('rechaza un snapshot parcial antes de modificar la asignación', async () => {
		const tx = { purchaseAllocation: { findMany: vi.fn().mockResolvedValue([{
			id: 'a-1', cantidad: 2, costoUnitarioSnapshot: 125, fifoMonedaOrigen: 'USD', fifoFechaFuente: null,
			compraDocumentoItem: { createdAt: new Date('2026-09-01'), precioUnitario: 200 }, recepcionItem: null,
		}]), update: vi.fn(), delete: vi.fn() } };
		await expect(restaurarAllocacionesFifo(tx as never, { tenantId: 't-1', ventaItemId: 'v-1', cantidad: 1 }))
			.rejects.toThrow('PROCEDENCIA_FIFO_NO_VERIFICABLE');
		expect(tx.purchaseAllocation.update).not.toHaveBeenCalled();
		expect(tx.purchaseAllocation.delete).not.toHaveBeenCalled();
	});

	it('valida todas las asignaciones afectadas antes de escribir cualquiera', async () => {
		const fecha = new Date('2026-09-01T00:00:00.000Z');
		const evidence = buildAppliedFxEvidence({
			originalAmount: 10, originalCurrency: 'CUP', functionalCurrency: 'CUP',
			exchangeRate: 1, convertedAmount: 10, rateEffectiveAt: null,
			fxCatalogRateId: null, source: 'fifo-allocation',
		});
		const tx = {
			tenantAccountingPolicy: { findUnique: vi.fn().mockResolvedValue({ functionalCurrencyCode: 'CUP' }) },
			purchaseAllocation: {
				findMany: vi.fn().mockResolvedValue([
					{
						id: 'a-valid', cantidad: 1, costoUnitarioSnapshot: 10,
						fifoMonedaOrigen: 'CUP', fifoFechaFuente: fecha, fifoMonedaFuncional: 'CUP',
						fifoCostoFuncional: 10, fifoTasaCambio: null, fifoFechaTasa: null,
						fifoEvidenciaFx: JSON.stringify({ ...evidence,
							rawConvertedAmount: 10, rawExchangeRate: null }),
						compraDocumentoItem: { createdAt: fecha, precioUnitario: 10,
							compraDocumento: { moneda: 'CUP', fechaCompra: fecha } }, recepcionItem: null,
					},
					{
						id: 'a-partial', cantidad: 1, costoUnitarioSnapshot: 5,
						fifoMonedaOrigen: 'CUP', fifoFechaFuente: fecha, fifoMonedaFuncional: 'CUP',
						fifoCostoFuncional: 5, fifoTasaCambio: null, fifoFechaTasa: null,
						fifoEvidenciaFx: null,
						compraDocumentoItem: { createdAt: new Date(fecha.getTime() + 1), precioUnitario: 5,
							compraDocumento: { moneda: 'CUP', fechaCompra: fecha } }, recepcionItem: null,
					},
				]),
				update: vi.fn(),
				delete: vi.fn(),
			},
		};

		await expect(restaurarAllocacionesFifo(tx as never, {
			tenantId: 't-1', ventaItemId: 'v-1', cantidad: 2,
		})).rejects.toThrow('PROCEDENCIA_FIFO_NO_VERIFICABLE');
		expect(tx.purchaseAllocation.update).not.toHaveBeenCalled();
		expect(tx.purchaseAllocation.delete).not.toHaveBeenCalled();
	});
	it('usa moneda y fecha capturadas aunque el documento de compra cambie', async () => {
		const fecha = new Date('2026-09-01T00:00:00.000Z');
		const tx = { purchaseAllocation: { findMany: vi.fn().mockResolvedValue([{
			id: 'a-1', cantidad: 2, costoUnitarioSnapshot: 125, fifoMonedaOrigen: 'USD', fifoFechaFuente: fecha,
			compraDocumentoItem: { createdAt: fecha, precioUnitario: 200,
				compraDocumento: { moneda: 'CUP', fechaCompra: new Date('2026-10-01') } }, recepcionItem: null,
		}]), update: vi.fn(), delete: vi.fn() } };
		const result = await restaurarAllocacionesFifo(tx as never, {
			tenantId: 't-1', ventaItemId: 'v-1', cantidad: 1,
		});
		expect(result.fuentes).toEqual([{ moneda: 'USD', fecha, costo: 125, cantidad: 1 }]);
	});

	it('conserva el total funcional entre devoluciones parciales repetidas', async () => {
		const fecha = new Date('2026-09-01T00:00:00.000Z');
		const buildEvidence = (cantidad: number, montoFuncional: number) => {
			const fx = buildAppliedFxEvidence({ originalAmount: cantidad * 10, originalCurrency: 'USD',
				functionalCurrency: 'CUP', exchangeRate: 0.0333333333,
				convertedAmount: montoFuncional, rateEffectiveAt: fecha,
				fxCatalogRateId: 'rate-partial', source: 'fifo-allocation' });
			return JSON.stringify({ ...fx, rawConvertedAmount: montoFuncional, rawExchangeRate: 0.0333333333 });
		};
		const allocation: Record<string, unknown> = {
			id: 'a-partial', cantidad: 3, costoUnitarioSnapshot: 10,
			fifoMonedaOrigen: 'USD', fifoFechaFuente: fecha, fifoMonedaFuncional: 'CUP',
			fifoCostoFuncional: 1, fifoTasaCambio: 0.0333333333, fifoFechaTasa: fecha,
			fifoEvidenciaFx: buildEvidence(3, 1),
			compraDocumentoItem: { createdAt: fecha, precioUnitario: 10,
				compraDocumento: { moneda: 'USD', fechaCompra: fecha } }, recepcionItem: null,
		};
		const tx = {
			tenantAccountingPolicy: { findUnique: vi.fn().mockResolvedValue({ functionalCurrencyCode: 'CUP' }) },
			purchaseAllocation: {
				findMany: vi.fn().mockImplementation(async () => [{ ...allocation }]),
				update: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
					Object.assign(allocation, data);
				}),
				delete: vi.fn(),
			},
		};

		const primero = await restaurarAllocacionesFifo(tx as never, {
			tenantId: 't-1', ventaItemId: 'v-1', cantidad: 1,
		});
		expect(primero.fuentes[0]?.montoFuncional).toBe(0.3333);
		expect(String(allocation.fifoCostoFuncional)).toBe('0.6667');
		expect(allocation.fifoEvidenciaFx).not.toBe(buildEvidence(3, 1));

		const segundo = await restaurarAllocacionesFifo(tx as never, {
			tenantId: 't-1', ventaItemId: 'v-1', cantidad: 1,
		});
		expect(segundo.fuentes[0]?.montoFuncional).toBe(0.3334);
		expect(String(allocation.fifoCostoFuncional)).toBe('0.3333');

		const ultimo = await restaurarAllocacionesFifo(tx as never, {
			tenantId: 't-1', ventaItemId: 'v-1', cantidad: 1,
		});
		expect(ultimo.fuentes[0]?.montoFuncional).toBe(0.3333);
		expect((primero.fuentes[0]?.montoFuncional ?? 0)
			+ (segundo.fuentes[0]?.montoFuncional ?? 0)
			+ (ultimo.fuentes[0]?.montoFuncional ?? 0)).toBe(1);
		expect(tx.purchaseAllocation.delete).toHaveBeenCalledWith({ where: { id: 'a-partial' } });
	});
	it('restaura al lote más antiguo primero y pondera el costo', async () => {
		// Lote nuevo (300) tenía 2 consumidas; lote viejo (100) tenía 1.
		const tx = {
			purchaseAllocation: {
				findMany: vi.fn().mockResolvedValue([
					alloc('a-nueva', 2, '2026-09-10', 300),
					alloc('a-vieja', 1, '2026-09-01', 100),
				]),
				update: vi.fn(),
				delete: vi.fn(),
			},
		};

		const r = await restaurarAllocacionesFifo(tx as never, {
			tenantId: 't-1',
			ventaItemId: 'vi-1',
			cantidad: 2,
		});

		// FIFO: se borra la allocation del lote viejo y se reduce la del nuevo.
		expect(tx.purchaseAllocation.delete).toHaveBeenCalledWith({ where: { id: 'a-vieja' } });
		expect(tx.purchaseAllocation.update).toHaveBeenCalledWith({
			where: { id: 'a-nueva' },
			data: { cantidad: 1 },
		});
		expect(r.restaurado).toBe(2);
		expect(r.costoTotal).toBe(1 * 100 + 1 * 300);
		// Las fuentes conservan la moneda y la fecha con las que se valora el
		// costo restituido en moneda funcional.
		expect(r.fuentes).toEqual([
			{ moneda: 'CUP', fecha: new Date(0), costo: 400, cantidad: 2 },
		]);
	});

	it('cantidad 0 no toca nada', async () => {
		const tx = {
			purchaseAllocation: { findMany: vi.fn(), update: vi.fn(), delete: vi.fn() },
		};
		const r = await restaurarAllocacionesFifo(tx as never, {
			tenantId: 't-1',
			ventaItemId: 'vi-1',
			cantidad: 0,
		});
		expect(r).toEqual({ restaurado: 0, costoTotal: 0, fuentes: [] });
		expect(tx.purchaseAllocation.findMany).not.toHaveBeenCalled();
	});

	it('sin allocations (venta legacy) restaura 0 y el costo cae al fallback del caller', async () => {
		const tx = {
			purchaseAllocation: {
				findMany: vi.fn().mockResolvedValue([]),
				update: vi.fn(),
				delete: vi.fn(),
			},
		};
		const r = await restaurarAllocacionesFifo(tx as never, {
			tenantId: 't-1',
			ventaItemId: 'vi-1',
			cantidad: 2,
		});
		expect(r).toEqual({ restaurado: 0, costoTotal: 0, fuentes: [] });
	});

	it('rechaza una recepción cuyo costo snapshot carece de moneda y fecha', async () => {
		const tx = {
			purchaseAllocation: {
				findMany: vi.fn().mockResolvedValue([{
					id: 'allocation-recepcion',
					cantidad: 2,
					costoUnitarioSnapshot: 125,
					compraDocumentoItem: null,
					recepcionItem: {
						recepcion: { fecha: new Date('2026-09-01T00:00:00.000Z') },
						ordenItem: { createdAt: new Date('2026-08-25T00:00:00.000Z'), precioUnitario: 100 },
					},
				}]),
				update: vi.fn(),
				delete: vi.fn(),
			},
		};

		await expect(restaurarAllocacionesFifo(tx as never, {
			tenantId: 't-1',
			ventaItemId: 'vi-recepcion',
			cantidad: 1,
		})).rejects.toThrow('PROCEDENCIA_FIFO_NO_VERIFICABLE');
		expect(tx.purchaseAllocation.update).not.toHaveBeenCalled();
	});

	it('rechaza revertir una recepción sin procedencia de factura antes de escribir', async () => {
		const tx = {
			purchaseAllocation: {
				findMany: vi.fn().mockResolvedValue([{
					id: 'allocation-recepcion-sin-factura',
					cantidad: 2,
					costoUnitarioSnapshot: null,
					fifoMonedaOrigen: null,
					fifoFechaFuente: null,
					fifoMonedaFuncional: null,
					fifoCostoFuncional: null,
					fifoTasaCambio: null,
					fifoFechaTasa: null,
					fifoEvidenciaFx: null,
					compraDocumentoItem: null,
					recepcionItem: {
						recepcion: { fecha: new Date('2026-09-01T00:00:00.000Z') },
						ordenItem: { createdAt: new Date('2026-08-25T00:00:00.000Z'), precioUnitario: 100 },
					},
				}]),
				update: vi.fn(),
				delete: vi.fn(),
			},
		};

		await expect(restaurarAllocacionesFifo(tx as never, {
			tenantId: 't-1', ventaItemId: 'vi-recepcion', cantidad: 1,
		})).rejects.toThrow('PROCEDENCIA_FIFO_NO_VERIFICABLE');
		expect(tx.purchaseAllocation.update).not.toHaveBeenCalled();
		expect(tx.purchaseAllocation.delete).not.toHaveBeenCalled();
	});

	it('restores a billed receipt using the invoice-linked FX snapshot', async () => {
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
		const tx = {
			tenantAccountingPolicy: { findUnique: vi.fn().mockResolvedValue({ functionalCurrencyCode: 'CUP' }) },
			purchaseAllocation: {
				findMany: vi.fn().mockResolvedValue([{
					id: 'sale-layer-1', tenantId: 't-1', cantidad: 2,
					recepcionItemId: 'ri-1',
					purchaseReceiptInvoiceAllocationId: 'invoice-layer-1',
					costoUnitarioSnapshot: 120, fifoMonedaOrigen: 'USD', fifoFechaFuente: date,
					fifoMonedaFuncional: 'CUP', fifoCostoFuncional: 6000,
					fifoTasaCambio: 25, fifoFechaTasa: date,
					fifoEvidenciaFx: JSON.stringify({ ...saleEvidence,
						rawConvertedAmount: 6000, rawExchangeRate: 25 }),
					compraDocumentoItem: null,
					recepcionItem: {
						id: 'ri-1', tenantId: 't-1', productoId: 'p-1', recepcion: { fecha: date },
						ordenItem: { createdAt: date, tenantId: 't-1', ordenId: 'oc-1', productoId: 'p-1' },
					},
					purchaseReceiptInvoiceAllocation: {
						id: 'invoice-layer-1', tenantId: 't-1', recepcionItemId: 'ri-1',
						compraDocumentoItemId: 'invoice-line-1', cantidad: 2,
						costoUnitarioSnapshot: 120, fifoMonedaOrigen: 'USD', fifoFechaFuente: date,
						fifoMonedaFuncional: 'CUP', fifoCostoFuncional: 6000,
						fifoTasaCambio: 25, fifoFechaTasa: date,
						fifoEvidenciaFx: JSON.stringify({ ...sourceEvidence,
							rawConvertedAmount: 6000, rawExchangeRate: 25 }),
						compraDocumentoItem: {
							compraDocumentoItemId: 'invoice-line-1', tenantId: 't-1', productoId: 'p-1',
							cantidad: 2, precioUnitario: 120,
							compraDocumento: { tenantId: 't-1', ordenCompraId: 'oc-1', estado: 'PAGADA',
								deletedAt: null, moneda: 'USD', fechaCompra: date },
						},
					},
				}]),
				update: vi.fn(), delete: vi.fn(),
			},
		};

		const result = await restaurarAllocacionesFifo(tx as never, {
			tenantId: 't-1', ventaItemId: 'v-1', cantidad: 1,
		});

		expect(result).toMatchObject({
			restaurado: 1, costoTotal: 120,
			fuentes: [{ moneda: 'USD', fecha: date, costo: 120, cantidad: 1, montoFuncional: 3000 }],
		});
		expect(tx.purchaseAllocation.update).toHaveBeenCalledWith(expect.objectContaining({
			where: { id: 'sale-layer-1' },
			data: expect.objectContaining({ cantidad: 1, fifoCostoFuncional: 3000 }),
		}));
	});

	it('rechaza una relación de factura sin ID de recepción antes de escribir', async () => {
		const date = new Date('2026-09-01T00:00:00.000Z');
		const fx = buildAppliedFxEvidence({ originalAmount: 240, originalCurrency: 'USD',
			functionalCurrency: 'CUP', exchangeRate: 25, convertedAmount: 6000,
			rateEffectiveAt: date, fxCatalogRateId: null, source: 'fifo-allocation' });
		const tx = {
			tenantAccountingPolicy: { findUnique: vi.fn().mockResolvedValue({ functionalCurrencyCode: 'CUP' }) },
			purchaseAllocation: {
				findMany: vi.fn().mockResolvedValue([{
					id: 'orphan-allocation', tenantId: 't-1',
					purchaseReceiptInvoiceAllocationId: 'invoice-layer-1', cantidad: 2,
					costoUnitarioSnapshot: 120, fifoMonedaOrigen: 'USD', fifoFechaFuente: date,
					fifoMonedaFuncional: 'CUP', fifoCostoFuncional: 6000, fifoTasaCambio: 25,
					fifoFechaTasa: date,
					fifoEvidenciaFx: JSON.stringify({ ...fx, rawConvertedAmount: 6000, rawExchangeRate: 25 }),
					compraDocumentoItem: { createdAt: date, precioUnitario: 120,
						compraDocumento: { moneda: 'USD', fechaCompra: date } },
					purchaseReceiptInvoiceAllocation: { id: 'invoice-layer-1', tenantId: 't-1' },
				}]),
				update: vi.fn(), delete: vi.fn(),
			},
		};

		await expect(restaurarAllocacionesFifo(tx as never, {
			tenantId: 't-1', ventaItemId: 'v-1', cantidad: 1,
		})).rejects.toThrow('PROCEDENCIA_FIFO_NO_VERIFICABLE');
		expect(tx.purchaseAllocation.update).not.toHaveBeenCalled();
		expect(tx.purchaseAllocation.delete).not.toHaveBeenCalled();
	});
});
