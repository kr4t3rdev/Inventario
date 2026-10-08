/**
 * @description Test concurrente de producción: verifica que el claim optimista
 * en `completarOrdenProduccionAction` evita duplicados cuando 5 llamadas
 * simultáneas intentan completar la misma orden.
 */
import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

const currentUser = vi.hoisted(() => ({
	value: {
		userId: 'prod-actor', name: 'Actor', email: 'prod@test.invalid',
		role: 'user' as const, isActive: true, tenantId: 'test-tenant',
		tenantRole: 'manager' as const,
		planFeatures: { produccion: true },
		permissions: new Set(['inventario.produccion.gestionar']),
	},
}));

vi.mock('@/lib/server-actions/get-current-user', () => ({
	getCurrentUser: async () => currentUser.value,
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

// Mock del tx que simula la carrera: el primer updateMany gana, los demás pierden
let claimCount = 0;
const mockTx = {
	ordenProduccion: {
		findUnique: vi.fn().mockResolvedValue({
			ordenProduccionId: 'orden-1',
			estado: 'EN_PROCESO',
			cantidad: 5,
			Receta: {
				rendimiento: 1,
				productoId: 'prod-final',
				Producto: { id: 'prod-final', nombre: 'Final' },
				RecetaIngrediente: [],
			},
		}),
		updateMany: vi.fn().mockImplementation(() => {
			claimCount++;
			// Solo el primero gana
			return Promise.resolve({ count: claimCount === 1 ? 1 : 0 });
		}),
		update: vi.fn().mockResolvedValue({ ordenProduccionId: 'orden-1', estado: 'COMPLETADA' }),
	},
	ordenProduccionHistorial: { create: vi.fn().mockResolvedValue({}) },
	producto: {
		findUnique: vi.fn().mockResolvedValue({ id: 'prod-final', almacenId: null, stock: 10 }),
	},
};

vi.mock('@/lib/prisma', () => ({
	prisma: {
		$transaction: vi.fn((cb: any) => cb(mockTx)),
	},
}));

vi.mock('@/lib/services/stock-ubicacion-service', () => ({
	upsertStockUbicacion: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/utils/unit-converter', () => ({
	convertToBase: vi.fn((c: number) => c),
}));

import { completarOrdenProduccionAction } from '@/features/produccion/actions';

describe('completarOrdenProduccionAction — claim concurrente', () => {
	it('solo una de 5 llamadas concurrentes gana el claim', async () => {
		claimCount = 0;
		mockTx.ordenProduccion.updateMany.mockClear();

		const resultados = await Promise.all(
			Array.from({ length: 5 }, () =>
				completarOrdenProduccionAction('orden-1')
			),
		);

		const exitosos = resultados.filter((r) => r.success);
		const fallidos = resultados.filter((r) => !r.success);

		expect(exitosos.length).toBe(1);
		expect(fallidos.length).toBe(4);

		// Los perdedores reciben CONFLICT
		for (const f of fallidos) {
			expect(f.error?.code).toBe('CONFLICT');
		}

		// updateMany se llamó 5 veces (una por cada intento)
		expect(mockTx.ordenProduccion.updateMany).toHaveBeenCalledTimes(5);
	});
});
