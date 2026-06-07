import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	getStockTotalProducto,
	getStockTotalProductosBatch,
} from '../stock-ubicacion-queries';

const txMock = {
	stockUbicacion: {
		findMany: vi.fn(),
	},
};

describe('stock-ubicacion-queries total derivado', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('getStockTotalProducto suma cantidades de todas las ubicaciones del producto', async () => {
		txMock.stockUbicacion.findMany.mockResolvedValue([
			{ productoId: 'prod-1', cantidad: 4 },
			{ productoId: 'prod-1', cantidad: 6 },
			{ productoId: 'prod-1', cantidad: 3 },
		]);

		const total = await getStockTotalProducto(txMock as any, {
			productoId: 'prod-1',
		});

		expect(total).toBe(13);
		expect(txMock.stockUbicacion.findMany).toHaveBeenCalledWith({
			where: { productoId: 'prod-1' },
			select: { productoId: true, cantidad: true },
		});
	});

	it('getStockTotalProductosBatch agrupa por producto', async () => {
		txMock.stockUbicacion.findMany.mockResolvedValue([
			{ productoId: 'prod-1', cantidad: 4 },
			{ productoId: 'prod-1', cantidad: 6 },
			{ productoId: 'prod-2', cantidad: 3 },
		]);

		const totals = await getStockTotalProductosBatch(txMock as any, {
			productoIds: ['prod-1', 'prod-2', 'prod-3'],
		});

		expect(totals.get('prod-1')).toBe(10);
		expect(totals.get('prod-2')).toBe(3);
		expect(totals.get('prod-3')).toBe(0);
	});
});
