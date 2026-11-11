import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectActionFailure, expectActionSuccess } from "@/test/action-response";

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/services/stock-ubicacion-service', () => ({
	upsertStockUbicacion: vi.fn(),
}));
vi.mock('@/lib/utils/produccion', () => ({
	validarDisponibilidadMateriales: vi.fn(() => []),
	calcularCantidadRequeridaMaterial: vi.fn((ingrediente, cantidad) =>
		Math.ceil(ingrediente.cantidad * cantidad),
	),
}));
vi.mock('@/lib/utils/unit-converter', () => ({
  convertToBase: vi.fn((cantidad) => cantidad),
  convertBetweenUnits: vi.fn((cantidad, from, to) =>
    from === 'g' && to === 'kg' ? cantidad / 1000 : cantidad,
  ),
  MASS_UNITS: ['g', 'kg', 'lb', 'oz'],
  VOLUME_UNITS: ['ml', 'L', 'fl oz', 'tsp', 'tbsp', 'cup'],
}));
vi.mock('@/features/contabilidad-formal/services/inventory-adjustment-posting-service', () => ({
	emitirProduccionInventario: vi.fn(),
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
		receta: {
			findMany: vi.fn().mockResolvedValue([]),
		},
		producto: {
			findUnique: vi.fn(),
			update: vi.fn(),
		},
		stockUbicacion: {
			findUnique: vi.fn(),
		},
		stockMoveLine: {
			upsert: vi.fn(),
			findMany: vi.fn().mockResolvedValue([]),
			count: vi.fn(),
			aggregate: vi.fn(),
		},
	},
}));

vi.mock('@/lib/prisma', () => ({
	prisma: {
		receta: { findMany: vi.fn() },
		stockUbicacion: { findMany: vi.fn() },
		ordenProduccion: {
			findFirst: vi.fn(),
			findUnique: vi.fn(),
			update: vi.fn(),
		},
		ordenProduccionHistorial: { create: vi.fn() },
		stockMoveLine: { findMany: vi.fn().mockResolvedValue([]) },
		$transaction: vi.fn((cb: any) => cb(mockTx)),
	},
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';
import { calcularCantidadRequeridaMaterial } from '@/lib/utils/produccion';
import { emitirProduccionInventario } from '@/features/contabilidad-formal/services/inventory-adjustment-posting-service';
import {
	aprobarOrdenProduccionAction,
	completarOrdenProduccionAction,
	planificarNecesidadesAction,
} from '@/features/produccion/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const mockUser: AuthenticatedUser = {
	userId: 'user-1',
	name: 'Test',
	email: 'test@test.com',
	role: 'admin',
	isActive: true,
	tenantId: 'tenant-test',
	tenantRole: 'manager',
};

describe('Producción Server Actions', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
	});

	it('(RETIRE LEGACY) aprobar orden con ingredientes en almacén no escribe Producto.stock', async () => {
		mockTx.ordenProduccion.findUnique.mockResolvedValue({
			ordenProduccionId: 'op-1',
			recetaId: 'recipe-1',
			estado: 'PENDIENTE',
			cantidad: 2,
			Receta: {
				rendimiento: 1,
				RecetaIngrediente: [
					{ productoId: 'mat-1', cantidad: 2, unidadSimbolo: 'u', desperdicio: 0 },
				],
			},
		});
		mockTx.receta.findMany.mockResolvedValueOnce([{
			recetaId: 'recipe-1', productoId: null, rendimiento: 1,
			RecetaIngrediente: [
				{ productoId: 'mat-1', recetaIngredienteId: null, cantidad: 2, desperdicio: 0, unidadSimbolo: 'unidad', Producto: { id: 'mat-1', nombre: 'Material 1', unidad: { simbolo: 'unidad', dimension: 'COUNT' }, unidadesConversion: [] } },
			],
		}]);
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
		expect(emitirProduccionInventario).toHaveBeenCalledWith(
			mockTx,
			expect.objectContaining({ tenantId: 'tenant-test', userId: 'user-1' }),
			expect.objectContaining({ ordenProduccionId: 'op-1', costoMaterialesCUP: 400 }),
		);
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
			role: 'regularUser',
			tenantRole: 'manager',
			planFeatures: { produccion: false },
		};
		vi.mocked(getCurrentUser).mockResolvedValue(restrictedUser);
		const result = await aprobarOrdenProduccionAction('op-1');
		expect(result.success).toBe(false);
		expect(expectActionFailure(result).error!.code).toBe('FEATURE_NOT_AVAILABLE');
	});

	it('planifica con stock neto y exige el flag MRP avanzado', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue({
			...mockUser,
			planFeatures: { 'mrp-avanzado': true },
		});
		vi.mocked(prisma.receta.findMany).mockResolvedValue([{
			recetaId: 'P', productoId: 'p', rendimiento: 1,
			RecetaIngrediente: [{
				productoId: 'I', recetaIngredienteId: null, cantidad: 3, desperdicio: 0,
			}],
		}] as never);
		vi.mocked(prisma.stockUbicacion.findMany).mockResolvedValue([{
			productoId: 'I', cantidadDisponible: 2,
		}] as never);

		const result = await planificarNecesidadesAction({ recetaId: 'P', cantidad: 2 });

		expect(expectActionSuccess(result).data).toEqual({
			materiales: [{
				productoId: 'I', cantidadRequerida: 6, cantidadDisponible: 2, cantidadComprar: 4,
			}],
			ordenesProduccion: [{ recetaId: 'P', productoId: 'p', cantidad: 2 }],
		});
		expect(prisma.receta.findMany).toHaveBeenCalledWith(expect.objectContaining({
			where: { tenantId: mockUser.tenantId },
		}));
	});

	it('rechaza planificar MRP si el plan no incluye el flag avanzado', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue({
			...mockUser,
			role: 'regularUser',
			planFeatures: { produccion: true },
		});
		const result = await planificarNecesidadesAction({ recetaId: 'P', cantidad: 1 });

		expect(expectActionFailure(result).error!.code).toBe('FEATURE_NOT_AVAILABLE');
		expect(prisma.receta.findMany).not.toHaveBeenCalled();
	});

	it('devuelve el error de dominio cuando la receta MRP no existe', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue({
			...mockUser,
			planFeatures: { 'mrp-avanzado': true },
		});
		vi.mocked(prisma.receta.findMany).mockResolvedValue([] as never);

		const result = await planificarNecesidadesAction({ recetaId: 'missing', cantidad: 1 });

		expect(expectActionFailure(result).error).toMatchObject({
			code: 'BOM_RECIPE_NOT_FOUND',
			message: 'La receta missing no existe en el tenant',
		});
	});
});

describe('Producción: kardex y cancelación', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
		mockTx.stockMoveLine.findMany.mockResolvedValue([]);
	});

	it('aprobar orden registra consumo de ingredientes en kardex', async () => {
		mockTx.ordenProduccion.findUnique.mockResolvedValue({
			ordenProduccionId: 'op-1',
			recetaId: 'recipe-1',
			estado: 'PENDIENTE',
			cantidad: 2,
			Receta: {
				rendimiento: 1,
				RecetaIngrediente: [
					{ productoId: 'mat-1', cantidad: 2, unidadSimbolo: 'u', desperdicio: 0 },
				],
			},
		});
		mockTx.receta.findMany.mockResolvedValueOnce([{
			recetaId: 'recipe-1', productoId: null, rendimiento: 1,
			RecetaIngrediente: [
				{ productoId: 'mat-1', recetaIngredienteId: null, cantidad: 2, desperdicio: 0, unidadSimbolo: 'unidad', Producto: { id: 'mat-1', nombre: 'Material 1', unidad: { simbolo: 'unidad', dimension: 'COUNT' }, unidadesConversion: [] } },
			],
		}]);
		mockTx.producto.findUnique.mockResolvedValue({
			id: 'mat-1', nombre: 'Material 1', precioCosto: 100, stock: 999, almacenId: 'alm-1',
		});
		mockTx.stockUbicacion.findUnique.mockResolvedValue({ cantidadDisponible: 10 });
		mockTx.ordenProduccion.update.mockResolvedValue({ ordenProduccionId: 'op-1' });

		const result = await aprobarOrdenProduccionAction('op-1');

		expect(result.success).toBe(true);
		expect(mockTx.stockMoveLine.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { eventoKey: expect.objectContaining({ secuencia: 'ING-0' }) },
				create: expect.objectContaining({
					cantidad: -4,
					costoUnitario: 100,
					tipoOrigen: 'PRODUCCION',
				}),
			}),
		);
	});

	it('aprueba una orden descontando materiales hoja de la BOM multinivel', async () => {
		mockTx.ordenProduccion.findUnique.mockResolvedValue({
			ordenProduccionId: 'op-bom',
			recetaId: 'P',
			estado: 'PENDIENTE',
			cantidad: 10,
			Receta: {
				rendimiento: 1,
				RecetaIngrediente: [
					{ productoId: 'product-S', recetaIngredienteId: 'S', cantidad: 2, desperdicio: 0 },
				],
			},
		});
		mockTx.receta.findMany.mockResolvedValueOnce([
			{
				recetaId: 'P', productoId: 'product-P', rendimiento: 1,
				RecetaIngrediente: [
					{ productoId: 'product-S', recetaIngredienteId: 'S', cantidad: 2, desperdicio: 0, unidadSimbolo: 'unidad', Producto: { id: 'product-S', nombre: 'Subproducto', unidad: { simbolo: 'unidad', dimension: 'COUNT' }, unidadesConversion: [] } },
				],
			},
			{
				recetaId: 'S', productoId: 'product-S', rendimiento: 1,
				RecetaIngrediente: [
					{ productoId: 'I', recetaIngredienteId: null, cantidad: 3, desperdicio: 0, unidadSimbolo: 'unidad', Producto: { id: 'I', nombre: 'Ingrediente I', unidad: { simbolo: 'unidad', dimension: 'COUNT' }, unidadesConversion: [] } },
				],
			},
		]);
		mockTx.producto.findUnique.mockResolvedValue({
			id: 'I', nombre: 'Ingrediente I', precioCosto: 5, stock: 100, almacenId: 'alm-1',
		});
		mockTx.stockUbicacion.findUnique.mockResolvedValue({ cantidadDisponible: 100 });
		mockTx.ordenProduccion.update.mockResolvedValue({ ordenProduccionId: 'op-bom' });

		const result = await aprobarOrdenProduccionAction('op-bom');

		expect(result.success).toBe(true);
			expect(upsertStockUbicacion).toHaveBeenCalledWith(
			mockTx,
			expect.objectContaining({ productoId: 'I', delta: -60 }),
		);
	});

	it('aprueba recetas legacy convirtiendo cantidades al stock antes de descontar', async () => {
		mockTx.ordenProduccion.findUnique.mockResolvedValue({
			ordenProduccionId: 'op-units', recetaId: 'recipe-units', estado: 'PENDIENTE', cantidad: 1,
			Receta: { rendimiento: 1, RecetaIngrediente: [] },
		});
		mockTx.receta.findMany.mockResolvedValueOnce([{
			recetaId: 'recipe-units', productoId: null, rendimiento: 1,
			RecetaIngrediente: [{
				productoId: 'flour', recetaIngredienteId: null, cantidad: 500,
				unidadSimbolo: 'g', desperdicio: 0,
				Producto: {
					id: 'flour', nombre: 'Harina',
					unidad: { simbolo: 'kg', dimension: 'MASS' },
					unidadesConversion: [],
				},
			}],
		}]);
		mockTx.producto.findUnique.mockResolvedValue({
			id: 'flour', nombre: 'Harina', precioCosto: 10, stock: 10, almacenId: 'alm-1',
		});
		mockTx.stockUbicacion.findUnique.mockResolvedValue({ cantidadDisponible: 10 });
		mockTx.ordenProduccion.update.mockResolvedValue({ ordenProduccionId: 'op-units' });

		const result = await aprobarOrdenProduccionAction('op-units');

		expect(result.success).toBe(true);
		expect(calcularCantidadRequeridaMaterial).toHaveBeenCalledWith(
			expect.objectContaining({ productoId: 'flour', cantidad: 0.5 }),
			1,
		);
	});

	it('aplica el factor específico de la presentación antes de consumir stock', async () => {
		mockTx.ordenProduccion.findUnique.mockResolvedValue({
			ordenProduccionId: 'op-factor', recetaId: 'recipe-factor', estado: 'PENDIENTE', cantidad: 1,
			Receta: { rendimiento: 1, RecetaIngrediente: [] },
		});
		mockTx.receta.findMany.mockResolvedValueOnce([{
			recetaId: 'recipe-factor', productoId: null, rendimiento: 1,
			RecetaIngrediente: [{
				productoId: 'rice', recetaIngredienteId: null, cantidad: 2,
				unidadSimbolo: 'caja', desperdicio: 0,
				Producto: {
					id: 'rice', nombre: 'Arroz',
					unidad: { simbolo: 'unidad', dimension: 'COUNT' },
					unidadesConversion: [{
						factorAStock: { toString: () => '12' },
						unidad: { simbolo: 'caja', dimension: 'COUNT' },
					}],
				},
			}],
		}]);
		mockTx.producto.findUnique.mockResolvedValue({
			id: 'rice', nombre: 'Arroz', precioCosto: 5, stock: 50, almacenId: 'alm-1',
		});
		mockTx.stockUbicacion.findUnique.mockResolvedValue({ cantidadDisponible: 50 });
		mockTx.ordenProduccion.update.mockResolvedValue({ ordenProduccionId: 'op-factor' });

		const result = await aprobarOrdenProduccionAction('op-factor');

		expect(result.success).toBe(true);
		expect(calcularCantidadRequeridaMaterial).toHaveBeenCalledWith(
			expect.objectContaining({ productoId: 'rice', cantidad: 24 }),
			1,
		);
	});

	it('rechaza unidades incompatibles sin modificar el stock', async () => {
		mockTx.ordenProduccion.findUnique.mockResolvedValue({
			ordenProduccionId: 'op-invalid-unit', recetaId: 'recipe-invalid-unit', estado: 'PENDIENTE', cantidad: 1,
			Receta: { rendimiento: 1, RecetaIngrediente: [] },
		});
		mockTx.receta.findMany.mockResolvedValueOnce([{
			recetaId: 'recipe-invalid-unit', productoId: null, rendimiento: 1,
			RecetaIngrediente: [{
				productoId: 'flour', recetaIngredienteId: null, cantidad: 2,
				unidadSimbolo: 'L', desperdicio: 0,
				Producto: {
					id: 'flour', nombre: 'Harina',
					unidad: { simbolo: 'kg', dimension: 'MASS' },
					unidadesConversion: [],
				},
			}],
		}]);

		const result = await aprobarOrdenProduccionAction('op-invalid-unit');

		expect(result.success).toBe(false);
		expect(expectActionFailure(result).error?.code).toBe('UNIT_CONVERSION_INVALID');
		expect(upsertStockUbicacion).not.toHaveBeenCalled();
	});

	it('completar orden registra ingreso del producto terminado con costo de materiales', async () => {
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
		mockTx.producto.findUnique.mockResolvedValueOnce({
			id: 'prod-final',
			almacenId: 'alm-1',
			stock: 0,
		});
		mockTx.stockMoveLine.findMany.mockResolvedValue([
			{
				productoId: 'mat-1',
				cantidad: -4,
				costoUnitario: 100,
				secuencia: 'ING-0',
				createdAt: new Date('2026-11-03T09:00:00.000Z'),
				id: 'move-ing-1',
			},
		] as any);
		mockTx.ordenProduccion.update.mockResolvedValue({ ordenProduccionId: 'op-1' });

		const result = await completarOrdenProduccionAction('op-1');

		expect(result.success).toBe(true);
		expect(emitirProduccionInventario).toHaveBeenCalledWith(
			mockTx,
			expect.objectContaining({ tenantId: 'tenant-test', userId: 'user-1' }),
			expect.objectContaining({ ordenProduccionId: 'op-1', costoMaterialesCUP: 400 }),
		);
		// Material: 2 uds * 2 = 4 a 100 cada una → costo 400 → producto 6 uds → 400/6 = 67
		expect(mockTx.stockMoveLine.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { eventoKey: expect.objectContaining({ secuencia: 'PRODUCTO-0' }) },
				create: expect.objectContaining({
					cantidad: 6,
					costoUnitario: 67,
					tipoOrigen: 'PRODUCCION',
				}),
			}),
		);
	});

	it('cancelar una orden en proceso repone stock y compensa el kardex', async () => {
		const { cancelarOrdenProduccionAction } = await import('@/features/produccion/actions');
		mockTx.stockMoveLine.findMany.mockResolvedValue([
			{
				id: 'm-ing',
				productoId: 'mat-1',
				tipoUbicacion: 'almacen',
				ubicacionId: 'alm-1',
				cantidad: -4,
				costoUnitario: 100,
				secuencia: 'ING-0',
				createdAt: new Date(),
			},
		]);
		// ordenProduccion.findFirst no está en mockTx; cancelar usa prisma directo.
		const ordenModule = await import('@/features/produccion/actions');
		void ordenModule;

		vi.mocked(prisma.ordenProduccion.findFirst as any).mockResolvedValue({
			ordenProduccionId: 'op-1',
			estado: 'EN_PROCESO',
			tenantId: 'tenant-test',
		});

		const result = await cancelarOrdenProduccionAction('op-1');

		expect(result.success).toBe(true);
		expect(upsertStockUbicacion).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ productoId: 'mat-1', delta: 4 }),
		);
		expect(mockTx.stockMoveLine.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { eventoKey: expect.objectContaining({ secuencia: 'REV-ING-0' }) },
			}),
		);
	});
});
