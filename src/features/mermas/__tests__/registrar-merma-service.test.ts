/**
 * @description Tests del servicio compartido de alta de merma. Garantiza que
 * escritorio y móvil produzcan el mismo estado derivado: merma con
 * creadoPorId, decremento de stock, kardex idempotente (SALIDA-0) y espejo
 * AjusteInventario APLICADO.
 *
 * @module features/mermas/__tests__/registrar-merma-service.test
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/services/stock-ubicacion-service', () => ({
	upsertStockUbicacion: vi.fn(),
}));
vi.mock('@/features/inventario/movimientos', async () => ({
	...(await vi.importActual('@/features/inventario/movimientos')),
	registrarMovimiento: vi.fn(),
}));

import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';
import { registrarMovimiento, mapearMotivoLegacy } from '@/features/inventario/movimientos';
import { registrarMermaEnTransaccion } from '../services/registrar-merma-service';

/* eslint-disable @typescript-eslint/no-explicit-any */
const mockTx: any = {
	merma: { create: vi.fn() },
	ajusteInventario: { create: vi.fn() },
};

const baseParams = {
	tenantId: 'tenant-1',
	productoId: 'p1',
	cantidad: 3,
	motivo: 'Producto dañado',
	almacenId: 'a1',
	creadoPorId: 'user-1',
	costoUnitario: 500,
	stockDisponibleAntes: 10,
};

describe('registrarMermaEnTransaccion', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockTx.merma.create.mockResolvedValue({ mermaId: 'm-1' });
	});

	it('crea la merma con creadoPorId y costoTotal calculado', async () => {
		await registrarMermaEnTransaccion(mockTx, baseParams);

		expect(mockTx.merma.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					productoId: 'p1',
					cantidad: 3,
					motivo: 'Producto dañado',
					costoTotal: 1500,
					tenantId: 'tenant-1',
					almacenId: 'a1',
					creadoPorId: 'user-1',
				}),
			}),
		);
	});

	it('decrementa el stock de la ubicación en la misma transacción', async () => {
		await registrarMermaEnTransaccion(mockTx, baseParams);

		expect(upsertStockUbicacion).toHaveBeenCalledWith(
			mockTx,
			expect.objectContaining({
				tenantId: 'tenant-1',
				productoId: 'p1',
				tipoUbicacion: 'almacen',
				ubicacionId: 'a1',
				modo: 'increment',
				delta: -3,
			}),
		);
	});

	it('registra el kardex StockMoveLine SALIDA-0 idempotente', async () => {
		await registrarMermaEnTransaccion(mockTx, baseParams);

		expect(registrarMovimiento).toHaveBeenCalledWith(
			mockTx,
			expect.objectContaining({
				tenantId: 'tenant-1',
				productoId: 'p1',
				tipoOrigen: 'MERMA',
				origenId: 'm-1',
				tipoUbicacion: 'almacen',
				ubicacionId: 'a1',
				cantidad: -3,
				costoUnitario: 500,
				secuencia: 'SALIDA-0',
				creadoPorId: 'user-1',
			}),
		);
	});

	it('crea el espejo AjusteInventario APLICADO con origenMermaId y motivo mapeado', async () => {
		await registrarMermaEnTransaccion(mockTx, baseParams);

		expect(mockTx.ajusteInventario.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					tenantId: 'tenant-1',
					productoId: 'p1',
					motivo: mapearMotivoLegacy('Producto dañado'),
					cantidadTeorica: 10,
					cantidadContada: 7,
					diferencia: -3,
					costoUnitario: 500,
					costoTotal: -1500,
					estado: 'APLICADO',
					origenMermaId: 'm-1',
					creadoPorId: 'user-1',
				}),
			}),
		);
	});

	it('propaga include/select al create de merma', async () => {
		await registrarMermaEnTransaccion(mockTx, baseParams, { include: { producto: true } });

		expect(mockTx.merma.create).toHaveBeenCalledWith(
			expect.objectContaining({ include: { producto: true } }),
		);

		await registrarMermaEnTransaccion(mockTx, baseParams, {
			select: { mermaId: true },
		});
		expect(mockTx.merma.create).toHaveBeenLastCalledWith(
			expect.objectContaining({ select: { mermaId: true } }),
		);
	});
});
