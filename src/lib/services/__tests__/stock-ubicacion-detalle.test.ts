import { describe, beforeEach, expect, it, vi } from 'vitest';
import { upsertStockUbicacion } from '../stock-ubicacion-service';

const txMock: any = {
	producto: {
		findUniqueOrThrow: vi.fn().mockResolvedValue({ tenantId: 'tenant-1' }),
	},
	ubicacion: {
		findFirst: vi.fn(),
	},
	stockUbicacion: {
		upsert: vi.fn(),
		findUnique: vi.fn(),
		updateMany: vi.fn(),
	},
	stockUbicacionDetalle: {
		upsert: vi.fn(),
		findUnique: vi.fn(),
		findMany: vi.fn(),
		updateMany: vi.fn(),
	},
};

describe('upsertStockUbicacion con detalle jerárquico', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Mock que devuelve una hoja General por defecto
		txMock.ubicacion.findFirst.mockImplementation(async (args: { where: { id?: string } }) => ({
			id: args.where.id ?? 'legacy-general-alm-1',
		}));
	});

	it('actualiza el saldo agregado y asigna las entradas a la hoja General', async () => {
		await upsertStockUbicacion(txMock, {
			tenantId: 'tenant-1',
			productoId: 'producto-1',
			tipoUbicacion: 'almacen',
			ubicacionId: 'alm-1',
			modo: 'increment',
			delta: 8,
		});

		expect(txMock.stockUbicacion.upsert).toHaveBeenCalled();
		expect(txMock.ubicacion.findFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					tenantId: 'tenant-1',
					almacenId: 'alm-1',
					nombre: 'General',
					tipo: 'HOJA',
					children: { none: {} },
				}),
			}),
		);
		expect(txMock.stockUbicacionDetalle.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					tenantId_productoId_ubicacionHijaId: {
						productoId: 'producto-1',
						tenantId: 'tenant-1',
						ubicacionHijaId: 'legacy-general-alm-1',
					},
				},
				create: expect.objectContaining({
					tenantId: 'tenant-1',
					productoId: 'producto-1',
					almacenId: 'alm-1',
					ubicacionHijaId: 'legacy-general-alm-1',
					cantidad: 8,
					cantidadDisponible: 8,
				}),
			}),
		);
	});

	it('aplica una mutación a la hoja hija solicitada y no a General', async () => {
		await upsertStockUbicacion(txMock, {
			tenantId: 'tenant-1',
			productoId: 'producto-1',
			tipoUbicacion: 'almacen',
			ubicacionId: 'alm-1',
			ubicacionHijaId: 'hoja-2',
			modo: 'increment',
			delta: 4,
		});

		expect(txMock.ubicacion.findFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ id: 'hoja-2', tenantId: 'tenant-1', almacenId: 'alm-1' }),
			}),
		);
		expect(txMock.stockUbicacionDetalle.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					tenantId_productoId_ubicacionHijaId: {
						productoId: 'producto-1',
						tenantId: 'tenant-1',
						ubicacionHijaId: 'hoja-2',
					},
				},
			}),
		);
	});

	it('rechaza una ubicación hija que no pertenece al almacén de la operación', async () => {
		txMock.ubicacion.findFirst.mockResolvedValueOnce(null);

		await expect(
			upsertStockUbicacion(txMock, {
				tenantId: 'tenant-1',
				productoId: 'producto-1',
				tipoUbicacion: 'almacen',
				ubicacionId: 'alm-1',
				ubicacionHijaId: 'hoja-otro-almacen',
				modo: 'increment',
				delta: 1,
			}),
		).rejects.toMatchObject({ code: 'UBICACION_HIJA_INVALIDA' });

		expect(txMock.stockUbicacion.upsert).not.toHaveBeenCalled();
	});

	it('distribuye una salida legacy entre hojas en orden estable', async () => {
		txMock.stockUbicacion.updateMany.mockResolvedValue({ count: 1 });
		txMock.stockUbicacionDetalle.findMany.mockResolvedValue([
			{ ubicacionHijaId: 'hoja-a', cantidad: 2, cantidadDisponible: 2 },
			{ ubicacionHijaId: 'hoja-b', cantidad: 5, cantidadDisponible: 5 },
		]);
		txMock.stockUbicacionDetalle.findUnique
			.mockResolvedValueOnce({ cantidad: 2, cantidadReservada: 0, cantidadDisponible: 2 })
			.mockResolvedValueOnce({ cantidad: 5, cantidadReservada: 0, cantidadDisponible: 5 });
		txMock.stockUbicacionDetalle.updateMany.mockResolvedValue({ count: 1 });

		await upsertStockUbicacion(txMock, {
			tenantId: 'tenant-1',
			productoId: 'producto-1',
			tipoUbicacion: 'almacen',
			ubicacionId: 'alm-1',
			modo: 'increment',
			delta: -3,
		});

		expect(txMock.stockUbicacionDetalle.updateMany).toHaveBeenNthCalledWith(1,
			expect.objectContaining({
				where: expect.objectContaining({ ubicacionHijaId: 'hoja-a', cantidad: 2 }),
				data: expect.objectContaining({ cantidad: { increment: -2 } }),
			}),
		);
		expect(txMock.stockUbicacionDetalle.updateMany).toHaveBeenNthCalledWith(2,
			expect.objectContaining({
				where: expect.objectContaining({ ubicacionHijaId: 'hoja-b', cantidad: 5 }),
				data: expect.objectContaining({ cantidad: { increment: -1 } }),
			}),
		);
	});
});
