/**
 * @description Tests de la valoración del costo FIFO de una venta ya
 * contabilizada (`getCostoFifoVentaValorado`) y de la valoración por fuentes.
 *
 * Esta función decide si el costo de una venta entra al libro formal: la
 * procedencia consumida por una venta debe seguir siendo verificable aunque
 * la factura de origen se anule después (anular libera unidades, no borra el
 * consumo), y una factura eliminada sí invalida la procedencia.
 */
import { describe, expect, it, vi } from 'vitest';
import { buildAppliedFxEvidence } from '@/features/contabilidad/domain/fx-evidence';
import {
	getCostoFifoVentaValorado,
	valorarCostoFifoFuentes,
} from '@/lib/services/fifo-allocation';

const FECHA_FACTURA = new Date('2026-02-10T12:00:00.000Z');
const TENANT = 'tenant-1';

/**
 * @description Construye la evidencia FX persistida de una porción en la misma
 * moneda funcional (CUP -> CUP), con su traza cruda.
 * @param {number} amount - Importe original de la porción.
 * @param {string} source - Origen de la evidencia.
 * @returns {string} Evidencia serializada.
 */
function evidenciaCUP(amount: number, source: string): string {
	return JSON.stringify({
		...buildAppliedFxEvidence({
			originalAmount: amount,
			originalCurrency: 'CUP',
			functionalCurrency: 'CUP',
			exchangeRate: 1,
			convertedAmount: amount,
			rateEffectiveAt: null,
			fxCatalogRateId: null,
			source,
		}),
		rawConvertedAmount: amount,
		rawExchangeRate: null,
	});
}

/**
 * @description Construye una asignación con capa de factura y recepción.
 * @param {object} params - Estado y baja de la factura de origen.
 * @returns {object} Asignación con su capa de procedencia.
 */
function asignacionConCapa(params: { estado: string; deletedAt: Date | null }) {
	const capa = {
		id: 'capa-1',
		tenantId: TENANT,
		compraDocumentoItemId: 'linea-compra-1',
		recepcionItemId: 'recepcion-1',
		cantidad: 1,
		costoUnitarioSnapshot: 50,
		fifoMonedaOrigen: 'CUP',
		fifoFechaFuente: FECHA_FACTURA,
		fifoMonedaFuncional: 'CUP',
		fifoCostoFuncional: 50,
		fifoTasaCambio: null,
		fifoFechaTasa: null,
		fifoEvidenciaFx: evidenciaCUP(50, 'purchase-receipt-invoice-allocation'),
		compraDocumentoItem: {
			compraDocumentoItemId: 'linea-compra-1',
			tenantId: TENANT,
			productoId: 'producto-1',
			compraDocumento: {
				tenantId: TENANT,
				ordenCompraId: 'orden-1',
				estado: params.estado,
				deletedAt: params.deletedAt,
				moneda: 'CUP',
				fechaCompra: FECHA_FACTURA,
			},
		},
	};
	return {
		tenantId: TENANT,
		recepcionItemId: 'recepcion-1',
		purchaseReceiptInvoiceAllocationId: 'capa-1',
		cantidad: 1,
		costoUnitarioSnapshot: 50,
		fifoMonedaOrigen: 'CUP',
		fifoFechaFuente: FECHA_FACTURA,
		fifoMonedaFuncional: 'CUP',
		fifoCostoFuncional: 50,
		fifoTasaCambio: null,
		fifoFechaTasa: null,
		fifoEvidenciaFx: evidenciaCUP(50, 'fifo-allocation'),
		compraDocumentoItem: null,
		purchaseReceiptInvoiceAllocation: capa,
		recepcionItem: {
			id: 'recepcion-1',
			tenantId: TENANT,
			productoId: 'producto-1',
			ordenItem: { tenantId: TENANT, ordenId: 'orden-1', productoId: 'producto-1' },
		},
	};
}

/**
 * @description Construye un cliente transaccional mínimo con una asignación.
 * @param {object} asignacion - Asignación devuelta por la consulta.
 * @returns {object} Cliente transaccional simulado.
 */
function txCon(asignacion: object) {
	return {
		tenantAccountingPolicy: {
			findUnique: vi.fn().mockResolvedValue({ functionalCurrencyCode: 'CUP' }),
		},
		purchaseAllocation: {
			findMany: vi.fn().mockResolvedValue([asignacion]),
		},
	};
}

describe('getCostoFifoVentaValorado', () => {
	it('acredita el costo de una venta cuya factura de origen fue anulada despues', async () => {
		const tx = txCon(asignacionConCapa({ estado: 'ANULADA', deletedAt: null }));

		const valoracion = await getCostoFifoVentaValorado(tx as never, TENANT, 'venta-1');

		// Anular la factura libera unidades pero no borra el hecho de que se
		// vendieron contra esa linea: el costo ya devengado sigue acreditable.
		expect(valoracion).toMatchObject({
			montoFuncional: 50,
			monedaFuncional: 'CUP',
			cantidad: 1,
		});
		expect(valoracion?.fuentesSinTasa).toEqual([]);
	});

	it('invalida el costo cuando la factura de origen fue eliminada', async () => {
		const tx = txCon(asignacionConCapa({
			estado: 'PAGADA',
			deletedAt: new Date('2026-03-01T00:00:00.000Z'),
		}));

		const valoracion = await getCostoFifoVentaValorado(tx as never, TENANT, 'venta-1');

		expect(valoracion?.montoFuncional).toBeNull();
		expect(valoracion?.fuentesSinTasa).toContain('PROCEDENCIA_FIFO_NO_VERIFICABLE');
	});

	it('devuelve null cuando la venta no tiene asignaciones FIFO', async () => {
		const tx = {
			tenantAccountingPolicy: {
				findUnique: vi.fn().mockResolvedValue({ functionalCurrencyCode: 'CUP' }),
			},
			purchaseAllocation: { findMany: vi.fn().mockResolvedValue([]) },
		};

		expect(await getCostoFifoVentaValorado(tx as never, TENANT, 'venta-1')).toBeNull();
	});
});

describe('valorarCostoFifoFuentes', () => {
	it('deja sin completar el importe cuando una sola fuente no es verificable', async () => {
		const tx = {
			tenantAccountingPolicy: {
				findUnique: vi.fn().mockResolvedValue({ functionalCurrencyCode: 'CUP' }),
			},
		};

		const valoracion = await valorarCostoFifoFuentes(tx as never, TENANT, [
			{
				moneda: 'CUP',
				fecha: FECHA_FACTURA,
				costo: 100,
				cantidad: 1,
				montoFuncional: 100,
			},
			{
				moneda: 'CUP',
				fecha: FECHA_FACTURA,
				costo: 50,
				cantidad: 1,
				verificable: false,
			},
		]);

		// Fail-closed del conjunto: una porcion estimada no puede llegar al
		// libro, y tampoco puede arrastrar a las verificadas.
		expect(valoracion.montoFuncional).toBeNull();
		expect(valoracion.fuentesSinTasa).toContain('PROCEDENCIA_FIFO_NO_VERIFICABLE');
	});
});
