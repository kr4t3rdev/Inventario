/**
 * @description Pruebas de la Server Action de listado de lotes del inventario.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectActionFailure, expectActionSuccess } from '@/test/action-response';

vi.mock('@/lib/server-actions/get-current-user', () => ({
	getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
	prisma: {
		lote: {
			findMany: vi.fn(),
			count: vi.fn(),
		},
	},
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { getLotesInventarioAction } from '@/features/inventario/actions-lotes';

function usuarioConPlan(planFeatures: Record<string, boolean>) {
	return {
		userId: 'user-1',
		name: 'Usuario',
		email: 'usuario@test.com',
		role: 'regularUser',
		isActive: true,
		tenantId: 'tenant-1',
		tenantRole: 'manager',
		planFeatures,
	} as never;
}

const loteListado = {
	id: 'lote-1',
	codigo: 'L-2026-001',
	productoId: 'prod-1',
	fechaVencimiento: new Date('2026-12-01'),
	cantidadInicial: 10,
	cantidadDisponible: 4,
	producto: { nombre: 'Arroz' },
};

describe('getLotesInventarioAction', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getCurrentUser).mockResolvedValue(usuarioConPlan({ 'lotes-series': true }));
		vi.mocked(prisma.lote.findMany).mockResolvedValue([loteListado] as never);
		vi.mocked(prisma.lote.count).mockResolvedValue(21 as never);
	});

	it('devuelve los lotes paginados del tenant', async () => {
		const response = await getLotesInventarioAction({ page: 2, limit: 10 });

		const data = expectActionSuccess(response).data!;
		expect(data.lotes).toHaveLength(1);
		expect(data.pagination).toEqual({ page: 2, limit: 10, total: 21, totalPages: 3 });
		expect(prisma.lote.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { tenantId: 'tenant-1' },
				orderBy: [{ fechaVencimiento: 'asc' }, { codigo: 'asc' }, { id: 'asc' }],
				skip: 10,
				take: 10,
			}),
		);
	});

	it('filtra por codigo de lote y producto', async () => {
		await getLotesInventarioAction({ search: 'L-2026', productoId: 'prod-1' });

		expect(prisma.lote.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					tenantId: 'tenant-1',
					productoId: 'prod-1',
					codigo: { contains: 'L-2026', mode: 'insensitive' },
				},
			}),
		);
	});

	it('bloquea el listado cuando el plan no incluye lotes y series', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(usuarioConPlan({ 'lotes-series': false }));

		const response = await getLotesInventarioAction();

		expect(expectActionFailure(response).error?.code).toBe('FEATURE_NOT_AVAILABLE');
		expect(prisma.lote.findMany).not.toHaveBeenCalled();
	});
});
