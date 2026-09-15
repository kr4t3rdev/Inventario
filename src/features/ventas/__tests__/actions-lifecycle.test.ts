/**
 * @description Tests de las server actions del ciclo de pedidos (PVE-T3):
 * auth via withAction y gate del feature de plan ventas-pedidos.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { venta: { findUnique: vi.fn() } } }));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import {
	entregarVentaAction,
	facturarVentaAction,
} from '@/features/ventas/actions';

const userSinFlag = {
	userId: 'u-1',
	role: 'user',
	tenantId: 'tenant-1',
	tenantRole: 'manager',
	isActive: true,
	planFeatures: { 'ventas-pos': true },
};

describe('actions del ciclo de pedidos (PVE-T3)', () => {
	beforeEach(() => vi.clearAllMocks());

	it('sin sesión devuelve AUTH_REQUIRED', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(null);
		const r = await entregarVentaAction('venta-1');
		expect(r.success).toBe(false);
		expect(r.error?.code).toBe('AUTH_REQUIRED');
	});

	it('entregarVentaAction exige la feature ventas-pedidos', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(userSinFlag as never);
		const r = await entregarVentaAction('venta-1');
		expect(r.success).toBe(false);
		expect(r.error?.code).toBe('FEATURE_NOT_AVAILABLE');
	});

	it('facturarVentaAction también exige la feature ventas-pedidos', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(userSinFlag as never);
		const r = await facturarVentaAction({
			ventaId: 'venta-1',
			input: { metodoPago: 'EFECTIVO' },
		});
		expect(r.success).toBe(false);
		expect(r.error?.code).toBe('FEATURE_NOT_AVAILABLE');
	});
});
