import { describe, expect, it, beforeEach, vi } from 'vitest';
import { expectActionFailure, expectActionSuccess } from "@/test/action-response";

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { mockTx } = vi.hoisted(() => ({
	mockTx: {
		conteoInventario: {
			create: vi.fn(),
			update: vi.fn(),
			findFirst: vi.fn(),
		},
		conteoLinea: {
			createMany: vi.fn(),
			updateMany: vi.fn(),
			findMany: vi.fn(),
			update: vi.fn(),
		},
		stockUbicacion: { findMany: vi.fn() },
		stockUbicacionDetalle: { findMany: vi.fn() },
		ajusteInventario: { create: vi.fn() },
		producto: {
			findMany: vi.fn(),
			findUnique: vi.fn().mockResolvedValue({ precioCosto: 100 }),
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
		conteoInventario: { findFirst: vi.fn(), update: vi.fn() },
		conteoLinea: { findMany: vi.fn() },
		producto: { findMany: vi.fn() },
		ubicacion: { findFirst: vi.fn() },
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
	cancelarConteoAction,
	conciliarConteoAction,
	getConteoLineasAction,
	iniciarConteoAction,
	registrarConteoAction,
} from '@/features/inventario/actions-conteos';

const manager = {
	userId: 'manager-1',
	tenantId: 'tenant-1',
	role: 'user',
	tenantRole: 'manager',
	planFeatures: { 'conteo-fisico': true },
} as any;

const conteoBase = {
	id: 'conteo-1',
	tenantId: 'tenant-1',
	tipoUbicacion: 'almacen',
	ubicacionId: 'alm-1',
	estado: 'BORRADOR',
};

describe('iniciarConteoAction', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getCurrentUser).mockResolvedValue(manager);
	});

	it('crea el conteo con el stock teórico de la ubicación', async () => {
		mockTx.stockUbicacion.findMany.mockResolvedValue([
			{ productoId: 'prod-1', cantidad: 10 },
			{ productoId: 'prod-2', cantidad: 3 },
		]);
		mockTx.producto.findMany.mockResolvedValue([
			{ id: 'prod-1' },
			{ id: 'prod-2' },
			{ id: 'prod-3' },
		]);
		mockTx.conteoInventario.create.mockResolvedValue(conteoBase as any);

		const result = await iniciarConteoAction({
			tipoUbicacion: 'almacen',
			ubicacionId: 'alm-1',
		});

		expect(result.success).toBe(true);
		expect(mockTx.conteoLinea.createMany).toHaveBeenCalledWith({
			data: expect.arrayContaining([
				expect.objectContaining({ productoId: 'prod-1', teorico: 10 }),
				expect.objectContaining({ productoId: 'prod-2', teorico: 3 }),
				expect.objectContaining({ productoId: 'prod-3', teorico: 0 }),
			]),
		});
	});

	it('inicia un conteo para una hoja con los saldos detallados de esa hoja', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue({
			...manager,
			planFeatures: { 'conteo-fisico': true, 'ubicaciones-avanzadas': true },
		} as any);
		vi.mocked(prisma.ubicacion.findFirst).mockResolvedValue({ id: 'hoja-a1' } as any);
		mockTx.stockUbicacionDetalle.findMany.mockResolvedValue([
			{ productoId: 'prod-1', cantidad: 6 },
		]);
		mockTx.producto.findMany.mockResolvedValue([{ id: 'prod-1' }, { id: 'prod-2' }]);
		mockTx.conteoInventario.create.mockResolvedValue({ ...conteoBase, ubicacionHijaId: 'hoja-a1' } as any);

		const result = await iniciarConteoAction({
			tipoUbicacion: 'almacen',
			ubicacionId: 'alm-1',
			ubicacionHijaId: 'hoja-a1',
		});

		expect(result.success).toBe(true);
		expect(mockTx.stockUbicacionDetalle.findMany).toHaveBeenCalledWith({
			where: { tenantId: 'tenant-1', almacenId: 'alm-1', ubicacionHijaId: 'hoja-a1' },
			select: { productoId: true, cantidad: true },
		});
		expect(mockTx.conteoLinea.createMany).toHaveBeenCalledWith({
			data: [
				{ conteoId: 'conteo-1', tenantId: 'tenant-1', productoId: 'prod-1', teorico: 6 },
				{ conteoId: 'conteo-1', tenantId: 'tenant-1', productoId: 'prod-2', teorico: 0 },
			],
		});
	});
});

describe('registrarConteoAction (doble captura ciega)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('primera captura pasa el conteo a CONTEO_1 con usuario1Id', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(manager);
		vi.mocked(prisma.conteoInventario.findFirst).mockResolvedValue(conteoBase as any);
		mockTx.conteoLinea.findMany.mockResolvedValue([
			{ productoId: 'prod-1', usuario1Id: null },
		]);
		mockTx.conteoInventario.update.mockResolvedValue({ ...conteoBase, estado: 'CONTEO_1' } as any);

		const result = await registrarConteoAction({
			conteoId: 'conteo-1',
			lineas: [{ productoId: 'prod-1', cantidad: 9 }],
		});

		expect(result.success).toBe(true);
		expect(mockTx.conteoLinea.updateMany).toHaveBeenCalledWith({
			where: { conteoId: 'conteo-1', productoId: 'prod-1' },
			data: { conteo1: 9, usuario1Id: 'manager-1' },
		});
		expect(mockTx.conteoInventario.update).toHaveBeenCalledWith({
			where: { id: 'conteo-1' },
			data: { estado: 'CONTEO_1' },
		});
	});

	it('rechaza una pasada incompleta sin cambiar el estado', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(manager);
		vi.mocked(prisma.conteoInventario.findFirst).mockResolvedValue(conteoBase as any);
		mockTx.conteoLinea.findMany.mockResolvedValue([
			{ productoId: 'prod-1', usuario1Id: null },
			{ productoId: 'prod-2', usuario1Id: null },
		]);

		const result = await registrarConteoAction({
			conteoId: 'conteo-1',
			lineas: [{ productoId: 'prod-1', cantidad: 9 }],
		});

		expect(result.success).toBe(false);
		expect(expectActionFailure(result).error?.code).toBe('CAPTURA_INCOMPLETA');
		expect(mockTx.conteoInventario.update).not.toHaveBeenCalled();
	});

	it('rechaza productos que no pertenecen al conteo', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(manager);
		vi.mocked(prisma.conteoInventario.findFirst).mockResolvedValue(conteoBase as any);
		mockTx.conteoLinea.findMany.mockResolvedValue([
			{ productoId: 'prod-1', usuario1Id: null },
		]);

		const result = await registrarConteoAction({
			conteoId: 'conteo-1',
			lineas: [{ productoId: 'prod-inexistente', cantidad: 9 }],
		});

		expect(result.success).toBe(false);
		expect(expectActionFailure(result).error?.code).toBe('PRODUCTO_FUERA_CONTEO');
	});

	it('segunda captura exige un usuario distinto y pasa a CONTEO_2', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue({ ...manager, userId: 'manager-2' } as any);
		vi.mocked(prisma.conteoInventario.findFirst).mockResolvedValue({
			...conteoBase,
			estado: 'CONTEO_1',
		} as any);
		mockTx.conteoLinea.findMany.mockResolvedValue([
			{ productoId: 'prod-1', usuario1Id: 'manager-1' },
		]);
		mockTx.conteoInventario.update.mockResolvedValue({ ...conteoBase, estado: 'CONTEO_2' } as any);

		const result = await registrarConteoAction({
			conteoId: 'conteo-1',
			lineas: [{ productoId: 'prod-1', cantidad: 9 }],
		});

		expect(result.success).toBe(true);
		expect(mockTx.conteoLinea.updateMany).toHaveBeenCalledWith({
			where: { conteoId: 'conteo-1', productoId: 'prod-1' },
			data: { conteo2: 9, usuario2Id: 'manager-2' },
		});
	});

	it('rechaza la segunda captura si es el mismo usuario de la primera', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(manager);
		vi.mocked(prisma.conteoInventario.findFirst).mockResolvedValue({
			...conteoBase,
			estado: 'CONTEO_1',
		} as any);
		mockTx.conteoLinea.findMany.mockResolvedValue([
			{ productoId: 'prod-1', usuario1Id: 'manager-1' },
		]);

		const result = await registrarConteoAction({
			conteoId: 'conteo-1',
			lineas: [{ productoId: 'prod-1', cantidad: 9 }],
		});

		expect(result.success).toBe(false);
		expect(expectActionFailure(result).error?.code).toBe('MISMO_CONTADOR');
	});
});

describe('getConteoLineasAction', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getCurrentUser).mockResolvedValue(manager);
	});

	it('no revela valores de conteo durante una pasada ciega', async () => {
		vi.mocked(prisma.conteoInventario.findFirst).mockResolvedValue({
			id: 'conteo-1',
			estado: 'CONTEO_1',
		} as any);
		vi.mocked(prisma.conteoLinea.findMany).mockResolvedValue([
			{ productoId: 'prod-1', conteo1: 8, conteo2: null },
		] as any);
		vi.mocked(prisma.producto.findMany).mockResolvedValue([
			{ id: 'prod-1', nombre: 'Producto 1', codigoInterno: 'P-1', codigoNegocio: null },
		] as any);

		const result = await getConteoLineasAction({ conteoId: 'conteo-1' });

		expect(result.success).toBe(true);
		expect(expectActionSuccess(result).data.lineas).toEqual([
			{
				productoId: 'prod-1',
				nombre: 'Producto 1',
				codigoInterno: 'P-1',
				codigoNegocio: null,
			},
		]);
	});
});

describe('conciliarConteoAction', () => {
	const conteoEn2 = {
		...conteoBase,
		estado: 'CONTEO_2',
	};

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getCurrentUser).mockResolvedValue(manager);
		vi.mocked(prisma.conteoInventario.findFirst).mockResolvedValue(conteoEn2 as any);
	});

	it('concilia diferencias y genera ajustes con movimiento de kardex', async () => {
		mockTx.conteoLinea.findMany
			.mockResolvedValueOnce([
				{ id: 'l-1', productoId: 'prod-1', teorico: 10, conteo1: 9, conteo2: 8 },
				{ id: 'l-2', productoId: 'prod-2', teorico: 3, conteo1: 3, conteo2: 3 },
			])
			.mockResolvedValueOnce([]);
		mockTx.ajusteInventario.create.mockResolvedValue({ id: 'aj-1' } as any);
		mockTx.conteoInventario.update.mockResolvedValue({ estado: 'AJUSTADO' } as any);

		const result = await conciliarConteoAction({
			conteoId: 'conteo-1',
			finales: [
				{ productoId: 'prod-1', contadoFinal: 8 },
				{ productoId: 'prod-2', contadoFinal: 3 },
			],
		});

		expect(result.success).toBe(true);
		expect(mockTx.ajusteInventario.create).toHaveBeenCalledTimes(1);
		expect(mockTx.ajusteInventario.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				productoId: 'prod-1',
				motivo: 'ERROR_CONTEO',
				cantidadTeorica: 10,
				cantidadContada: 8,
				diferencia: -2,
				origenConteoId: 'conteo-1',
			}),
		});
		expect(upsertStockUbicacion).toHaveBeenCalledWith(
			mockTx,
			expect.objectContaining({ productoId: 'prod-1', delta: -2 }),
		);
		expect(mockTx.stockMoveLine.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { eventoKey: expect.objectContaining({ tipoOrigen: 'CONTEO' }) },
			}),
		);
		expect(mockTx.conteoInventario.update).toHaveBeenCalledWith(
			expect.objectContaining({ data: expect.objectContaining({ estado: 'AJUSTADO' }) }),
		);
	});

	it('sin varianzas pasa a AJUSTADO sin crear ajustes', async () => {
		mockTx.conteoInventario.update.mockResolvedValue({ estado: 'AJUSTADO' } as any);
		mockTx.conteoLinea.findMany.mockResolvedValue([
			{ id: 'l-1', productoId: 'prod-1', teorico: 10, conteo1: 10, conteo2: 10 },
		]);

		const result = await conciliarConteoAction({
			conteoId: 'conteo-1',
			finales: [{ productoId: 'prod-1', contadoFinal: 10 }],
		});

		expect(result.success).toBe(true);
		expect(mockTx.ajusteInventario.create).not.toHaveBeenCalled();
	});

	it('rechaza líneas sin final cuando las dos capturas difieren', async () => {
		mockTx.conteoLinea.findMany.mockResolvedValue([
			{ id: 'l-1', productoId: 'prod-1', teorico: 10, conteo1: 9, conteo2: 8 },
		]);

		const result = await conciliarConteoAction({
			conteoId: 'conteo-1',
			finales: [],
		});

		expect(result.success).toBe(false);
		expect(expectActionFailure(result).error?.code).toBe('VARIANZA_SIN_RESOLVER');
	});
});

describe('cancelarConteoAction', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getCurrentUser).mockResolvedValue(manager);
	});

	it('cancela un conteo sin ajustar', async () => {
		vi.mocked(prisma.conteoInventario.findFirst).mockResolvedValue(conteoBase as any);
		mockTx.conteoInventario.update.mockResolvedValue({ estado: 'CANCELADO' } as any);

		const result = await cancelarConteoAction({ conteoId: 'conteo-1' } as any);

		expect(result.success).toBe(true);
	});

	it('no cancela un conteo ya ajustado', async () => {
		vi.mocked(prisma.conteoInventario.findFirst).mockResolvedValue({
			...conteoBase,
			estado: 'AJUSTADO',
		} as any);

		const result = await cancelarConteoAction({ conteoId: 'conteo-1' } as any);

		expect(result.success).toBe(false);
	});
});
