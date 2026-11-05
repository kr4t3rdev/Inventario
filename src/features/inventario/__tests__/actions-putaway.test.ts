import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectActionFailure, expectActionSuccess } from '@/test/action-response';
vi.mock('@/lib/server-actions/get-current-user', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
	prisma: { producto: { findFirst: vi.fn() }, reglaPutaway: { findMany: vi.fn() } },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { getUbicacionSugeridaPutawayAction } from '@/features/inventario/actions-putaway';

const user = {
	userId: 'u1',
	name: 'Usuario',
	email: 'u@test.com',
	role: 'regularUser',
	isActive: true,
	tenantId: 't1',
	tenantRole: 'manager',
	planFeatures: { 'ubicaciones-avanzadas': true },
} as never;

describe('getUbicacionSugeridaPutawayAction', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getCurrentUser).mockResolvedValue(user);
		vi.mocked(prisma.producto.findFirst).mockResolvedValue({ categoriaId: 'c1' } as never);
		vi.mocked(prisma.reglaPutaway.findMany).mockResolvedValue([] as never);
	});
	it('consulta en el tenant activo y devuelve null si no hay regla', async () => {
		const result = await getUbicacionSugeridaPutawayAction({ productoId: 'p1' });
		expect(expectActionSuccess(result).data).toBeNull();
		expect(prisma.producto.findFirst).toHaveBeenCalledWith(expect.objectContaining({
			where: { id: 'p1', tenantId: 't1' },
		}));
		expect(prisma.reglaPutaway.findMany).toHaveBeenCalledWith(expect.objectContaining({
			where: {
				tenantId: 't1',
				OR: [{ productoId: 'p1' }, { categoriaId: 'c1' }],
			},
		}));
	});
	it('devuelve la ubicación de la regla del producto antes que categoría', async () => {
		vi.mocked(prisma.reglaPutaway.findMany).mockResolvedValue([
			{
				id: 'producto', tenantId: 't1', productoId: 'p1', categoriaId: null,
				ubicacionId: 'loc-p', ubicacion: { nombre: 'A-01', almacenId: 'a1' },
			},
			{
				id: 'categoria', tenantId: 't1', productoId: null, categoriaId: 'c1',
				ubicacionId: 'loc-c', ubicacion: { nombre: 'B-01', almacenId: 'a1' },
			},
		] as never);
		const result = await getUbicacionSugeridaPutawayAction({ productoId: 'p1' });
		expect(expectActionSuccess(result).data).toEqual({
			ubicacionId: 'loc-p', nombre: 'A-01', almacenId: 'a1', alcance: 'PRODUCTO',
		});
	});
	it('rechaza producto ajeno antes de buscar reglas', async () => {
		vi.mocked(prisma.producto.findFirst).mockResolvedValue(null as never);
		const result = await getUbicacionSugeridaPutawayAction({ productoId: 'p2' });
		expect(expectActionFailure(result).error?.code).toBe('NOT_FOUND');
		expect(prisma.reglaPutaway.findMany).not.toHaveBeenCalled();
	});
});
