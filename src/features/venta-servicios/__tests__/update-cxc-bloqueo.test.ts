/**
 * @description Barrera fail-closed de `updateVentaServicioAction`: cambiar la cantidad
 * (que recalcula el total) o el cliente de una venta de servicio con CxC vinculada
 * dejaría la deuda desalineada del cupo común; mientras esa mutación no migre a
 * ajustar la CxC en la misma transacción, se rechaza en servidor antes de escribir.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@/lib/prisma', () => ({
	prisma: {
		ventaServicios: {
			findFirst: vi.fn(),
			update: vi.fn(),
		},
		cuentaPorCobrar: {
			findFirst: vi.fn(),
		},
	},
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { updateVentaServicioAction } from '@/features/venta-servicios/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const manager: AuthenticatedUser = {
	userId: 'user-vs-1',
	name: 'Manager Servicios',
	email: 'servicios@test.local',
	role: 'admin',
	isActive: true,
	tenantId: 'tenant-test',
	tenantRole: 'manager',
} as unknown as AuthenticatedUser;

/** @description Venta de servicio existente: 1 × 5000 = 5000, cliente c-1. */
function ventaExistente(): Record<string, unknown> {
	return {
		ventaServicioId: 'vs-1',
		tenantId: 'tenant-test',
		cantidad: 1,
		total: 5000,
		precioUnitario: 5000,
		clienteId: 'c-1',
	};
}

describe('updateVentaServicioAction — barrera de CxC vinculada', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getCurrentUser).mockResolvedValue(manager);
		vi.mocked(prisma.ventaServicios.findFirst).mockResolvedValue(ventaExistente() as never);
		vi.mocked(prisma.ventaServicios.update).mockImplementation((async ({ data }: any) => ({
			...ventaExistente(),
			...(data as Record<string, unknown>),
		}) as never) as any);
		vi.mocked(prisma.cuentaPorCobrar.findFirst).mockResolvedValue(null);
	});

	it('rechaza cambiar la cantidad (nuevo total) con CxC vinculada existente', async () => {
		vi.mocked(prisma.cuentaPorCobrar.findFirst).mockResolvedValue({ id: 'cxc-1' } as never);

		const result = await updateVentaServicioAction({ ventaServicioId: 'vs-1', cantidad: 3 });

		expect(result).toMatchObject({ success: false, error: { code: 'CXC_VINCULADA' } });
		expect(prisma.ventaServicios.update).not.toHaveBeenCalled();
		expect(prisma.cuentaPorCobrar.findFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ ventaServicioId: 'vs-1', tenantId: 'tenant-test' }),
			}),
		);
	});

	it('rechaza reasignar el cliente con CxC vinculada existente', async () => {
		vi.mocked(prisma.cuentaPorCobrar.findFirst).mockResolvedValue({ id: 'cxc-1' } as never);

		const result = await updateVentaServicioAction({ ventaServicioId: 'vs-1', clienteId: 'c-2' });

		expect(result).toMatchObject({ success: false, error: { code: 'CXC_VINCULADA' } });
		expect(prisma.ventaServicios.update).not.toHaveBeenCalled();
	});

	it('permite editar observaciones aunque exista CxC vinculada', async () => {
		vi.mocked(prisma.cuentaPorCobrar.findFirst).mockResolvedValue({ id: 'cxc-1' } as never);

		const result = await updateVentaServicioAction({
			ventaServicioId: 'vs-1',
			observaciones: 'Nota aclaratoria',
		});

		expect(result).toMatchObject({ success: true });
		expect(prisma.ventaServicios.update).toHaveBeenCalled();
	});

	it('permite cambiar la cantidad cuando no hay CxC vinculada', async () => {
		const result = await updateVentaServicioAction({ ventaServicioId: 'vs-1', cantidad: 3 });

		expect(result).toMatchObject({ success: true });
		expect(prisma.ventaServicios.update).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ cantidad: 3, total: 15000 }),
			}),
		);
	});

	it('permite reasignar el mismo cliente (sin cambio efectivo) aunque exista CxC', async () => {
		vi.mocked(prisma.cuentaPorCobrar.findFirst).mockResolvedValue({ id: 'cxc-1' } as never);

		const result = await updateVentaServicioAction({ ventaServicioId: 'vs-1', clienteId: 'c-1' });

		expect(result).toMatchObject({ success: true });
		expect(prisma.ventaServicios.update).toHaveBeenCalled();
	});
});
