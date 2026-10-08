import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/services/tenant-scope', () => ({
	requireFeature: vi.fn(),
	requireTenant: (user: { tenantId: string }) => user.tenantId,
}));
vi.mock('@/lib/services/audit-log-service', () => ({
	AuditLogService: {
		log: vi.fn().mockResolvedValue(null),
		logStrict: vi.fn().mockResolvedValue({ auditId: 'audit-1' }),
	},
}));
const mockTx = vi.hoisted(() => ({
	$queryRaw: vi.fn().mockResolvedValue([]),
	cliente: { findFirst: vi.fn().mockResolvedValue({ clienteId: 'client-1', limiteCredito: null }) },
	cuentaPorCobrar: {
		findMany: vi.fn().mockResolvedValue([]),
		create: vi.fn(),
	},
}));
vi.mock('@/lib/prisma', () => ({
	prisma: {
		venta: { findFirst: vi.fn() },
		cliente: { findFirst: vi.fn() },
		cuentaPorCobrar: { findFirst: vi.fn(), create: vi.fn() },
		$transaction: vi.fn((callback: (tx: typeof mockTx) => unknown) => callback(mockTx)),
	},
}));

import { createCuentaPorCobrarAction } from '@/features/contabilidad/actions-cuentas';
import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const user: AuthenticatedUser = {
	userId: 'user-1',
	name: 'Test User',
	email: 'test@example.test',
	role: 'admin',
	isActive: true,
	tenantId: 'tenant-1',
	tenantRole: 'manager',
};

const account = {
	id: 'receivable-1',
	idCC: 1,
	facturaId: 'invoice-1',
	numeroFactura: 'INV-1',
	clienteId: 'client-1',
	montoDeuda: 125,
	montoPagado: 0,
	idTransferencia: null,
	estado: 'PENDIENTE',
	fechaVencimiento: null,
	monedaOriginal: 'USD',
	montoOriginal: 125,
	cliente: { clienteId: 'client-1', nombre: 'Cliente' },
	factura: null,
	prestamoCash: null,
	createdAt: new Date('2026-09-27T12:00:00.000Z'),
	updatedAt: new Date('2026-09-27T12:00:00.000Z'),
};

describe('createCuentaPorCobrarAction client and currency safeguards', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getCurrentUser).mockResolvedValue(user);
		vi.mocked(prisma.venta.findFirst).mockResolvedValue({
			ventaId: 'sale-1',
			clienteId: 'client-1',
			factura: { idFactura: 'invoice-1' },
		} as never);
		vi.mocked(prisma.cliente.findFirst).mockResolvedValue({ clienteId: 'client-1' } as never);
		mockTx.cliente.findFirst.mockResolvedValue({ clienteId: 'client-1', limiteCredito: null });
		mockTx.cuentaPorCobrar.findMany.mockResolvedValue([]);
		vi.mocked(prisma.cuentaPorCobrar.findFirst).mockResolvedValue(null);
		mockTx.cuentaPorCobrar.create.mockResolvedValue(account as never);
	});

	it('rejects an input customer different from the tenant-scoped sale customer', async () => {
		const result = await createCuentaPorCobrarAction({
			ventaId: 'sale-1', clienteId: 'client-2', monto: 125, moneda: 'USD',
		});

		expect(result).toMatchObject({ success: false, error: { code: 'VALIDATION_ERROR' } });
		expect(prisma.cliente.findFirst).not.toHaveBeenCalled();
		expect(mockTx.cuentaPorCobrar.create).not.toHaveBeenCalled();
	});

	it('rejects a sale without an associated customer', async () => {
		vi.mocked(prisma.venta.findFirst).mockResolvedValue({
			ventaId: 'sale-1',
			clienteId: null,
			factura: { idFactura: 'invoice-1' },
		} as never);

		const result = await createCuentaPorCobrarAction({
			ventaId: 'sale-1', clienteId: 'client-1', monto: 125, moneda: 'USD',
		});

		expect(result).toMatchObject({ success: false, error: { code: 'VALIDATION_ERROR' } });
		expect(prisma.cliente.findFirst).not.toHaveBeenCalled();
		expect(mockTx.cuentaPorCobrar.create).not.toHaveBeenCalled();
	});

	it('rejects a customer outside the active tenant', async () => {
		vi.mocked(prisma.cliente.findFirst).mockResolvedValue(null);

		const result = await createCuentaPorCobrarAction({
			ventaId: 'sale-1', clienteId: 'client-1', monto: 125, moneda: 'USD',
		});

		expect(result).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
		expect(mockTx.cuentaPorCobrar.create).not.toHaveBeenCalled();
	});

	it('persists the explicit original currency and amount', async () => {
		await createCuentaPorCobrarAction({
			ventaId: 'sale-1', clienteId: 'client-1', monto: 125, moneda: 'usd',
		});

		expect(prisma.cliente.findFirst).toHaveBeenCalledWith({
			where: { clienteId: 'client-1', tenantId: 'tenant-1' },
			select: { clienteId: true },
		});
		expect(mockTx.cuentaPorCobrar.create).toHaveBeenCalledWith(expect.objectContaining({
			data: expect.objectContaining({ monedaOriginal: 'USD', montoOriginal: 125 }),
		}));
	});
});
