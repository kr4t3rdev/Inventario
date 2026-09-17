/**
 * @description Tests del ensamblaje del ticket con vuelto (VC-T4).
 */
import { describe, it, expect, vi } from 'vitest';

// La página usa next/navigation; para el test puro basta mockearlos.
vi.mock('next/navigation', () => ({
	useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
	useSearchParams: () => new URLSearchParams(),
}));

import {
	buildInvoiceDataFromFactura,
} from '@/app/busy/invoice/print/page';

const baseFactura = {
	idFactura: 'f-1',
	numeroFactura: 'FV-000001',
	fechaEmision: '2026-09-16T10:00:00Z',
	subtotal: 1000,
	descuento: 0,
	total: 1000,
	cargoTransporte: 0,
	observaciones: '',
	cliente: null,
	venta: {
		ventaId: 'v-1',
		total: 1000,
		observaciones: '',
		items: [],
	},
};

describe('ticket con vuelto (VC-T4)', () => {
	it('la venta con cobro en efectivo traslada recibido/cambio al ticket', () => {
		const data = buildInvoiceDataFromFactura({
			...baseFactura,
			venta: {
				...baseFactura.venta,
				montoRecibidoEfectivo: 1500,
				cambioDevuelto: 500,
			},
		});
		expect(data.montoRecibidoEfectivo).toBe(1500);
		expect(data.cambioDevuelto).toBe(500);
	});

	it('la venta sin recibido queda con ambos campos en null', () => {
		const data = buildInvoiceDataFromFactura(baseFactura);
		expect(data.montoRecibidoEfectivo).toBeNull();
		expect(data.cambioDevuelto).toBeNull();
	});
});
