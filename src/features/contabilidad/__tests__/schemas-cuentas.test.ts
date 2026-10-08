import { describe, expect, it } from 'vitest';

import { createCuentaPorCobrarSchema } from '@/features/contabilidad/schemas-cuentas';
import {
	assertCuentaPorCobrarClienteDeVenta,
	buildCreateCuentaPorCobrarInputFromVenta,
	getCuentaPorCobrarCurrency,
	groupAmountsByCurrency,
} from '@/features/contabilidad/lib/cuentas-por-cobrar-flow';
import type { VentaPendiente } from '@/app/models/contabilidad';

describe('createCuentaPorCobrarSchema', () => {
	it('requires an explicit currency instead of silently assigning CUP', () => {
		const result = createCuentaPorCobrarSchema.safeParse({
			ventaId: 'sale-1',
			clienteId: 'client-1',
			monto: 25,
		});

		expect(result.success).toBe(false);
	});

	it('normalizes an explicit ISO-like currency code', () => {
		const result = createCuentaPorCobrarSchema.safeParse({
			ventaId: 'sale-1',
			clienteId: 'client-1',
			monto: 25,
			moneda: ' usd ',
		});

		expect(result).toMatchObject({
			success: true,
			data: { moneda: 'USD' },
		});
	});
});

describe('buildCreateCuentaPorCobrarInputFromVenta', () => {
	const sale = (currency?: string): VentaPendiente => ({
		ventaId: 'sale-1',
		cliente: { clienteId: 'client-1' },
		saldoPendiente: 25,
		total: 25,
		ordenId: 'invoice-1',
		moneda: currency,
	} as unknown as VentaPendiente);

	it('does not invent CUP when the sale currency is missing', () => {
		expect(() => buildCreateCuentaPorCobrarInputFromVenta(sale())).toThrow(
			/moneda.*verificable/i,
		);
	});

	it('preserves explicit currencies outside the legacy CUP/USD pair', () => {
		expect(buildCreateCuentaPorCobrarInputFromVenta(sale('cad'))).toMatchObject({
			moneda: 'CAD',
		});
	});
});

describe('CxC tenant and currency safety helpers', () => {
	it('rejects associating a sale to a different customer', () => {
		expect(() => assertCuentaPorCobrarClienteDeVenta('client-sale', 'client-input')).toThrow(
			'La cuenta por cobrar debe usar el cliente asociado a la venta',
		);
	});

	it('rejects associating a sale without a customer to an arbitrary customer', () => {
		expect(() => assertCuentaPorCobrarClienteDeVenta(null, 'client-input')).toThrow(
			'La venta debe tener un cliente asociado para crear la cuenta por cobrar',
		);
	});

	it('preserves an explicitly stored CxC currency for pending-sale rows', () => {
		expect(getCuentaPorCobrarCurrency(' usd ')).toBe('USD');
		expect(getCuentaPorCobrarCurrency(null)).toBeUndefined();
	});

	it('does not group amounts with missing currency into CUP', () => {
		expect(groupAmountsByCurrency([
			{ amount: 10, currency: 'CUP' },
			{ amount: 20, currency: 'USD' },
			{ amount: 30, currency: null },
		])).toEqual({
			totalsByCurrency: { CUP: 10, USD: 20 },
			unknownCurrencyCount: 1,
		});
	});
});
