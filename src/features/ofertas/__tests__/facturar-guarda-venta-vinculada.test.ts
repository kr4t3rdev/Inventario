/**
 * @description Tests de la guarda de venta vinculada en facturarOfertaWorkflow:
 * no se puede facturar una oferta que ya tiene una venta NO anulada, y la
 * violación unique de ofertaId (P2002) se traduce en error de negocio en vez
 * de 500 (limbo de ofertas).
 *
 * @module features/ofertas/__tests__/facturar-guarda-venta-vinculada.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockTx = {
	serieFacturacion: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
	venta: { findFirst: vi.fn(), create: vi.fn() },
	factura: { create: vi.fn() },
	producto: { findUnique: vi.fn() },
	stockUbicacion: { findUnique: vi.fn() },
};

vi.mock('@/lib/services/stock-ubicacion-service', () => ({
	upsertStockUbicacion: vi.fn(),
}));
vi.mock('@/lib/services/fifo-allocation', () => ({
	allocateFifoForSale: vi.fn(),
}));
vi.mock('@/features/ventas/services/facturacion-workflow', async (importOriginal) => ({
	...(await importOriginal<typeof import('@/features/ventas/services/facturacion-workflow')>()),
	applyFacturacionCobroWorkflow: vi.fn(),
}));

import { facturarOfertaWorkflow } from '@/features/ofertas/services/facturar-oferta-workflow';
import { applyFacturacionCobroWorkflow } from '@/features/ventas/services/facturacion-workflow';

const params = {
	tenantId: 'tenant-1',
	ofertaId: 'of-1',
	clienteId: 'cli-1',
	puntoDeVentaId: 'pv-1',
	items: [
		{ productoId: 'p-1', cantidad: 2, precioUnitario: 500, total: 1000 },
	],
	servicios: [],
	subtotal: 1000,
	impuestos: 0,
	total: 1000,
	observaciones: null,
	cargoTransporte: 0,
	serieId: null,
	tipoVencimiento: null,
	fechaVencimiento: null,
	cuentaBancariaId: null,
	usuarioId: 'user-1',
} as Parameters<typeof facturarOfertaWorkflow>[1];

describe('facturarOfertaWorkflow – guarda de venta vinculada', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockTx.serieFacturacion.findFirst.mockResolvedValue({
			serieId: 'serie-1',
			prefijo: 'FV',
			consecutivo: 1,
			esPorDefecto: true,
		} as never);
		mockTx.serieFacturacion.update.mockResolvedValue({ consecutivo: 2 } as never);
		mockTx.venta.create.mockResolvedValue({ ventaId: 'ven-1' } as never);
		mockTx.venta.findFirst.mockResolvedValue(null);
		mockTx.producto.findUnique.mockResolvedValue({
			id: 'p-1',
			nombre: 'Producto',
			tenantId: 'tenant-1',
		} as never);
		mockTx.stockUbicacion.findUnique.mockResolvedValue({ cantidadDisponible: 10 } as never);
		mockTx.factura.create.mockResolvedValue({ idFactura: 'fac-1' } as never);
		vi.mocked(applyFacturacionCobroWorkflow).mockResolvedValue({
			tipoVencimiento: 'contra_pago',
			reconciliacionId: null,
		} as never);
	});

	it('bloquea la facturación si la oferta tiene una venta activa vinculada', async () => {
		mockTx.venta.findFirst.mockResolvedValue({ ventaId: 'ven-9', estado: 'ENTREGADA' } as never);

		await expect(facturarOfertaWorkflow(mockTx as never, params)).rejects.toMatchObject({
			code: 'VALIDATION_ERROR',
			message: expect.stringContaining('venta'),
		});
		expect(mockTx.serieFacturacion.update).not.toHaveBeenCalled();
		expect(mockTx.venta.create).not.toHaveBeenCalled();
		expect(mockTx.factura.create).not.toHaveBeenCalled();
	});

	it('permite facturar cuando la venta previa fue anulada (oferta liberada)', async () => {
		mockTx.venta.findFirst.mockResolvedValue(null);

		const result = await facturarOfertaWorkflow(mockTx as never, params);

		expect(result.ventaId).toBe('ven-1');
		expect(mockTx.venta.create).toHaveBeenCalled();
	});

	it('traduce P2002 del create en error de negocio (red de seguridad)', async () => {
		const p2002 = Object.assign(
			new Error('Unique constraint failed on the fields: (`ofertaId`)'),
			{ code: 'P2002' },
		);
		mockTx.venta.create.mockRejectedValue(p2002);

		await expect(facturarOfertaWorkflow(mockTx as never, params)).rejects.toMatchObject({
			code: 'VALIDATION_ERROR',
			message: expect.stringContaining('venta vinculada'),
		});
	});
});
