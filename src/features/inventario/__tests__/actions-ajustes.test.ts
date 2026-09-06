import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { mockTx } = vi.hoisted(() => ({
	mockTx: {
		ajusteInventario: {
			create: vi.fn(),
			update: vi.fn(),
			findFirst: vi.fn(),
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
		producto: { findFirst: vi.fn() },
		stockUbicacion: { findUnique: vi.fn() },
		conteoInventario: { findFirst: vi.fn() },
		ajusteInventario: { findFirst: vi.fn() },
		$transaction: vi.fn((cb: any) => cb(mockTx)),
	},
}));
vi.mock('@/lib/services/stock-ubicacion-service', () => ({
	upsertStockUbicacion: vi.fn(),
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';
import {
	anularAjusteAction,
	createAjusteAction,
} from '@/features/inventario/actions-ajustes';

const mockUser = {
	userId: 'user-1',
	tenantId: 'tenant-1',
	role: 'user',
	planFeatures: { 'ajustes-inventario': true },
} as any;

const baseInput = {
	productoId: 'prod-1',
	tipoUbicacion: 'almacen',
	ubicacionId: 'alm-1',
	motivo: 'DANO',
	cantidadContada: 7,
} as const;

describe('createAjusteAction', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
		vi.mocked(prisma.producto.findFirst).mockResolvedValue({
			id: 'prod-1',
			precioCosto: 120,
			tenantId: 'tenant-1',
		} as any);
		vi.mocked(prisma.stockUbicacion.findUnique).mockResolvedValue({
			cantidad: 10,
		} as any);
		vi.mocked(prisma.conteoInventario.findFirst).mockResolvedValue(null);
		mockTx.ajusteInventario.create.mockResolvedValue({ id: 'aj-1' } as any);
	});

	it('crea el ajuste, mueve stock y kardex con la diferencia', async () => {
		const result = await createAjusteAction(baseInput as any);

		expect(result.success).toBe(true);
		expect(mockTx.ajusteInventario.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				tenantId: 'tenant-1',
				productoId: 'prod-1',
				motivo: 'DANO',
				cantidadTeorica: 10,
				cantidadContada: 7,
				diferencia: -3,
				costoUnitario: 120,
				costoTotal: -360,
				estado: 'APLICADO',
			}),
		});
		expect(upsertStockUbicacion).toHaveBeenCalledWith(
			mockTx,
			expect.objectContaining({ modo: 'increment', delta: -3 }),
		);
		expect(mockTx.stockMoveLine.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					eventoKey: expect.objectContaining({ tipoOrigen: 'AJUSTE', origenId: 'aj-1' }),
				},
				create: expect.objectContaining({ cantidad: -3, costoUnitario: 120 }),
			}),
		);
	});

	it('rechaza un motivo fuera del catálogo', async () => {
		const result = await createAjusteAction({ ...baseInput, motivo: 'Cualquiera' } as any);
		expect(result.success).toBe(false);
		expect(mockTx.ajusteInventario.create).not.toHaveBeenCalled();
	});

	it('rechaza ajuste sin diferencia', async () => {
		const result = await createAjusteAction({ ...baseInput, cantidadContada: 10 } as any);
		expect(result.success).toBe(false);
		expect(result.error?.code).toBe('SIN_DIFERENCIA');
	});

	it('bloquea el ajuste manual si hay un conteo activo en la ubicación', async () => {
		vi.mocked(prisma.conteoInventario.findFirst).mockResolvedValue({ id: 'c-1' } as any);

		const result = await createAjusteAction(baseInput as any);

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe('CONTEO_ACTIVO');
	});

	it('rechaza sin feature del plan', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue({
			...mockUser,
			planFeatures: { 'ajustes-inventario': false },
		});

		const result = await createAjusteAction(baseInput as any);

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe('FEATURE_NOT_AVAILABLE');
	});
});

describe('anularAjusteAction', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
	});

	it('reversa stock y kardex con el costo de la línea original', async () => {
		vi.mocked(prisma.ajusteInventario.findFirst).mockResolvedValue({
			id: 'aj-1',
			tenantId: 'tenant-1',
			estado: 'APLICADO',
			productoId: 'prod-1',
			tipoUbicacion: 'almacen',
			ubicacionId: 'alm-1',
			diferencia: -3,
		} as any);
		mockTx.stockMoveLine.findMany.mockResolvedValue([
			{
				id: 'm-1',
				productoId: 'prod-1',
				tipoUbicacion: 'almacen',
				ubicacionId: 'alm-1',
				cantidad: -3,
				costoUnitario: 120,
				secuencia: 'AJUSTE-0',
				createdAt: new Date(),
			},
		] as any);

		const result = await anularAjusteAction('aj-1');

		expect(result.success).toBe(true);
		expect(upsertStockUbicacion).toHaveBeenCalledWith(
			mockTx,
			expect.objectContaining({ modo: 'increment', delta: 3 }),
		);
		expect(mockTx.stockMoveLine.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				create: expect.objectContaining({
					cantidad: 3,
					costoUnitario: 120,
					secuencia: 'REV-AJUSTE-0',
				}),
			}),
		);
	});

	it('no anula un ajuste ya anulado', async () => {
		vi.mocked(prisma.ajusteInventario.findFirst).mockResolvedValue({
			id: 'aj-1',
			tenantId: 'tenant-1',
			estado: 'ANULADO',
		} as any);

		const result = await anularAjusteAction('aj-1');

		expect(result.success).toBe(false);
	});
});
