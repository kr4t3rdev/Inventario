import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/services/stock-ubicacion-service', () => ({
	upsertStockUbicacion: vi.fn(),
}));
vi.mock('@/lib/utils/produccion', () => ({
	validarDisponibilidadMateriales: vi.fn(() => []),
	calcularCantidadRequeridaMaterial: vi.fn(() => 4),
}));
vi.mock('@/lib/utils/unit-converter', () => ({
	convertToBase: vi.fn((cantidad) => cantidad),
}));

const { mockTx } = vi.hoisted(() => ({
	mockTx: {
		ordenProduccion: {
			findUnique: vi.fn(),
			update: vi.fn(),
		},
		ordenProduccionHistorial: {
			create: vi.fn(),
		},
		producto: {
			findUnique: vi.fn(),
			update: vi.fn(),
		},
		stockUbicacion: {
			findUnique: vi.fn(),
		},
	},
}));

vi.mock('@/lib/prisma', () => ({
	prisma: {
		$transaction: vi.fn((cb: any) => cb(mockTx)),
	},
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';
import {
	aprobarOrdenProduccionAction,
	completarOrdenProduccionAction,
} from '@/features/produccion/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const mockUser: AuthenticatedUser = {
	userId: 'user-1',
	name: 'Test',
	email: 'test@test.com',
	role: 'admin',
	isActive: true,
	tenantId: 'tenant-test',
	tenantRole: 'admin',
};

describe('Producción Server Actions', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
	});

	it('(RETIRE LEGACY) aprobar orden con ingredientes en almacén no escribe Producto.stock', async () => {
		mockTx.ordenProduccion.findUnique.mockResolvedValue({
			ordenProduccionId: 'op-1',
			estado: 'PENDIENTE',
			cantidad: 2,
			Receta: {
				RecetaIngrediente: [
					{ productoId: 'mat-1', cantidad: 2, unidadSimbolo: 'u', desperdicio: 0 },
				],
			},
		});
		mockTx.producto.findUnique.mockResolvedValue({
			id: 'mat-1',
			nombre: 'Material 1',
			precioCosto: 100,
			stock: 999,
			almacenId: 'alm-1',
		});
		mockTx.stockUbicacion.findUnique.mockResolvedValue({
			cantidadDisponible: 10,
		});
		mockTx.ordenProduccion.update.mockResolvedValue({
			ordenProduccionId: 'op-1',
			estado: 'EN_PROCESO',
		});

		const result = await aprobarOrdenProduccionAction('op-1');

		expect(result.success).toBe(true);
		expect(mockTx.producto.update).not.toHaveBeenCalled();
		expect(upsertStockUbicacion).toHaveBeenCalledWith(
			mockTx,
			expect.objectContaining({
				productoId: 'mat-1',
				tipoUbicacion: 'almacen',
				ubicacionId: 'alm-1',
				delta: -4,
			}),
		);
	});

	it('(RETIRE LEGACY) completar orden con producto final en almacén no escribe Producto.stock', async () => {
		mockTx.ordenProduccion.findUnique.mockResolvedValue({
			ordenProduccionId: 'op-1',
			estado: 'EN_PROCESO',
			cantidad: 2,
			Receta: {
				productoId: 'prod-final',
				rendimiento: 3,
				Producto: { id: 'prod-final', nombre: 'Final' },
				RecetaIngrediente: [
					{ productoId: 'mat-1', cantidad: 2, unidadSimbolo: 'u', desperdicio: 0 },
				],
			},
		});
		mockTx.producto.findUnique
			.mockResolvedValueOnce({
				id: 'prod-final',
				almacenId: 'alm-1',
				stock: 0,
			})
			.mockResolvedValueOnce({
				id: 'mat-1',
				precioCosto: 100,
			});
		mockTx.ordenProduccion.update.mockResolvedValue({
			ordenProduccionId: 'op-1',
			estado: 'COMPLETADA',
		});

		const result = await completarOrdenProduccionAction('op-1');

		expect(result.success).toBe(true);
		expect(mockTx.producto.update).not.toHaveBeenCalled();
		expect(upsertStockUbicacion).toHaveBeenCalledWith(
			mockTx,
			expect.objectContaining({
				productoId: 'prod-final',
				tipoUbicacion: 'almacen',
				ubicacionId: 'alm-1',
				delta: 6,
			}),
		);
	});

	it('retorna FEATURE_NOT_AVAILABLE cuando el plan no incluye produccion', async () => {
		const restrictedUser: AuthenticatedUser = {
			...mockUser,
			role: 'user',
			tenantRole: 'manager',
			planFeatures: { produccion: false },
		};
		vi.mocked(getCurrentUser).mockResolvedValue(restrictedUser);
		const result = await aprobarOrdenProduccionAction('op-1');
		expect(result.success).toBe(false);
		expect(result.error!.code).toBe('FEATURE_NOT_AVAILABLE');
	});
});
