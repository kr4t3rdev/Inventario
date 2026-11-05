/**
 * @description Pruebas de la Server Action de trazabilidad de lote.
 * Cubre el aislamiento por tenant, el gating por plan y el lote inexistente.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectActionFailure, expectActionSuccess } from '@/test/action-response';

vi.mock('@/lib/server-actions/get-current-user', () => ({
	getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
	prisma: {
		lote: {
			findFirst: vi.fn(),
		},
	},
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { getTrazabilidadLoteAction } from '@/features/inventario/actions-trazabilidad';

function usuarioConPlan(planFeatures: Record<string, boolean>, tenantId: string | null = 'tenant-1') {
	return {
		userId: 'user-1',
		name: 'Usuario',
		email: 'usuario@test.com',
		role: 'regularUser',
		isActive: true,
		tenantRole: 'manager',
		planFeatures,
		...(tenantId ? { tenantId } : {}),
	} as never;
}

const loteRegistro = {
	id: 'lote-1',
	codigo: 'L-2026-001',
	productoId: 'prod-1',
	fechaVencimiento: new Date('2026-12-01'),
	cantidadInicial: 10,
	cantidadDisponible: 4,
	producto: { nombre: 'Arroz' },
	compraItem: {
		cantidad: 10,
		compraDocumento: {
			compraDocumentoId: 'compra-1',
			numeroFactura: 'F-001',
			fechaCompra: new Date('2026-10-01'),
			estado: 'CONFIRMADA',
			proveedor: { nombre: 'Proveedor 1' },
		},
	},
	recepcionItem: null,
	allocations: [],
};

describe('getTrazabilidadLoteAction', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getCurrentUser).mockResolvedValue(usuarioConPlan({ 'lotes-series': true }));
	});

	it('devuelve la trazabilidad del lote consultando por tenant', async () => {
		vi.mocked(prisma.lote.findFirst).mockResolvedValue(loteRegistro as never);

		const response = await getTrazabilidadLoteAction('lote-1');

		const data = expectActionSuccess(response).data!;
		expect(data.lote).toMatchObject({ id: 'lote-1', productoNombre: 'Arroz' });
		expect(data.origen).toMatchObject({ tipo: 'COMPRA', numero: 'F-001' });
		expect(prisma.lote.findFirst).toHaveBeenCalledWith(
			expect.objectContaining({ where: { id: 'lote-1', tenantId: 'tenant-1' } }),
		);
	});

	it('devuelve NOT_FOUND cuando el lote no existe en el tenant', async () => {
		vi.mocked(prisma.lote.findFirst).mockResolvedValue(null as never);

		const response = await getTrazabilidadLoteAction('lote-9');

		expect(expectActionFailure(response).error?.code).toBe('NOT_FOUND');
	});

	it('bloquea la consulta cuando el plan no incluye lotes y series', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(usuarioConPlan({ 'lotes-series': false }));

		const response = await getTrazabilidadLoteAction('lote-1');

		expect(expectActionFailure(response).error?.code).toBe('FEATURE_NOT_AVAILABLE');
		expect(prisma.lote.findFirst).not.toHaveBeenCalled();
	});

	it('devuelve error si falta el tenant activo', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(usuarioConPlan({ 'lotes-series': true }, null));

		const response = await getTrazabilidadLoteAction('lote-1');

		expect(expectActionFailure(response).error?.message).toBe('Error interno del servidor');
		expect(prisma.lote.findFirst).not.toHaveBeenCalled();
	});
});
