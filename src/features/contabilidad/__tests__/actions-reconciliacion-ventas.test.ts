import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCurrentUserMock = vi.hoisted(() => vi.fn());
const txMock = vi.hoisted(() => ({
	$queryRaw: vi.fn(),
	venta: { findUnique: vi.fn() },
	cuentaPorCobrar: { findFirst: vi.fn(), updateMany: vi.fn() },
	cuentaBancaria: { update: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn() },
	tipoPago: { findFirst: vi.fn() },
	reconciliacionVenta: { create: vi.fn(), findMany: vi.fn() },
	compraServicio: { findUnique: vi.fn() },
}));
const prismaMock = vi.hoisted(() => ({
	$queryRaw: vi.fn(),
	$transaction: vi.fn((callback: (tx: typeof txMock) => unknown) => callback(txMock)),
	venta: { findMany: vi.fn(), count: vi.fn() },
	ventaServicios: { count: vi.fn() },
	gastosDE: { count: vi.fn() },
	 pagosalario: { count: vi.fn() },
	reconciliacionGasto: { findMany: vi.fn(), count: vi.fn() },
	compraServicio: { count: vi.fn() },
	reconciliacionVenta: { count: vi.fn(), aggregate: vi.fn(), findMany: vi.fn() },
	reconciliacionServicio: { count: vi.fn() },
}));
const workflowMock = vi.hoisted(() => ({ applyPagoGastoWorkflow: vi.fn() }));

vi.mock('@/lib/server-actions/get-current-user', () => ({
	getCurrentUser: getCurrentUserMock,
}));
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock, default: prismaMock }));
vi.mock('@/lib/services/with-period-validation', () => ({
	withPeriodValidation: (_extractor: unknown, handler: unknown) => handler,
}));
vi.mock('@/lib/services/pago-gastos-workflow', () => ({
	applyPagoGastoWorkflow: workflowMock.applyPagoGastoWorkflow,
	isGastoWorkflowError: vi.fn(() => false),
}));
vi.mock('@/lib/services/tenant-scope', () => ({
	requireFeature: vi.fn(),
	requireTenant: (user: { tenantId: string }) => user.tenantId,
}));
vi.mock('@/lib/services/audit-log-service', () => ({
	AuditLogService: { log: vi.fn() },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import {
	getReconciliacionStatsAction,
	getVentasPendientesAction,
	reconciliarGastoAction,
	reconciliarVentaAction,
} from '@/features/contabilidad/actions-reconciliacion';
import { validateSaleReconciliationInput } from '@/features/contabilidad/services/accounting-reconciliation-service';

const user = {
	userId: 'user-1',
	name: 'Test',
	email: 'test@example.com',
	role: 'admin' as const,
	isActive: true,
	tenantId: 'tenant-1',
	tenantRole: 'admin' as const,
};

describe('Reconciliación — ventas anuladas y carreras de servicios', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		getCurrentUserMock.mockResolvedValue(user);
		prismaMock.venta.count.mockResolvedValue(0);
		prismaMock.ventaServicios.count.mockResolvedValue(0);
		prismaMock.gastosDE.count.mockResolvedValue(0);
		prismaMock.pagosalario.count.mockResolvedValue(0);
		prismaMock.reconciliacionGasto.findMany.mockResolvedValue([]);
		prismaMock.reconciliacionGasto.count.mockResolvedValue(0);
		prismaMock.compraServicio.count.mockResolvedValue(0);
		prismaMock.reconciliacionVenta.count.mockResolvedValue(0);
		prismaMock.reconciliacionVenta.aggregate.mockResolvedValue({ _sum: { monto: null } });
		prismaMock.reconciliacionVenta.findMany.mockResolvedValue([]);
		prismaMock.reconciliacionServicio.count.mockResolvedValue(0);
		prismaMock.$transaction.mockImplementation(
			async (callback: (tx: typeof txMock) => unknown) => callback(txMock),
		);
	});

	it('excluye ventas eliminadas de la consulta SQL de pendientes', async () => {
		prismaMock.$queryRaw
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ total: BigInt(0) }]);

		const result = await getVentasPendientesAction();

		expect(result.success).toBe(true);
		const pendingQuery = prismaMock.$queryRaw.mock.calls[0]?.[0];
		const totalQuery = prismaMock.$queryRaw.mock.calls[1]?.[0];
		expect(pendingQuery.sql).toContain('v."deletedAt" IS NULL');
		expect(totalQuery.sql).toContain('v."deletedAt" IS NULL');
	});

	it('excluye de pendientes las ventas administradas por CxC activa', async () => {
		prismaMock.$queryRaw
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ total: BigInt(0) }]);

		await getVentasPendientesAction();

		for (const [query] of prismaMock.$queryRaw.mock.calls.slice(0, 2)) {
			expect(query.sql).toContain('NOT EXISTS');
			expect(query.sql).toContain('"CuentaPorCobrar"');
			expect(query.values).toEqual(expect.arrayContaining(['PENDIENTE', 'PARCIAL']));
		}
	});

	it('excluye ventas anuladas del KPI de pendientes', async () => {
		const result = await getReconciliacionStatsAction();

		expect(result.success).toBe(true);
		expect(prismaMock.venta.count).toHaveBeenCalledWith({
			where: { tenantId: 'tenant-1', deletedAt: null, reconciliaciones: { none: {} } },
		});
	});

	it('rechaza reconciliar una venta cuya CxC está ANULADA antes de tocar el banco', async () => {
		txMock.venta.findUnique.mockResolvedValue({
			tenantId: 'tenant-1',
			deletedAt: null,
			factura: { idFactura: 'factura-1' },
		});
		txMock.cuentaPorCobrar.findFirst.mockResolvedValue({
			idCC: 1,
			montoDeuda: 100,
			montoPagado: 0,
			estado: 'ANULADA',
		});
		txMock.cuentaBancaria.findFirst.mockResolvedValue({ cuentaId: 'cuenta-1', isActive: true });
		txMock.tipoPago.findFirst.mockResolvedValue({ tipoId: 'tipo-1', isActive: true });

		const result = await reconciliarVentaAction({
			ventaId: 'venta-1',
			cuentaId: 'cuenta-1',
			tipoPagoId: 'tipo-1',
			monto: 100,
		});

		expect(result.success).toBe(false);
		if (!result.success) expect(result.error?.code).toBe('VALIDATION_ERROR');
		expect(txMock.cuentaBancaria.update).not.toHaveBeenCalled();
		expect(txMock.reconciliacionVenta.create).not.toHaveBeenCalled();
	});

	it('rechaza una cuenta bancaria de otro tenant antes de crear la reconciliación', async () => {
		txMock.venta.findUnique.mockResolvedValue({
			tenantId: 'tenant-1',
			deletedAt: null,
			factura: null,
		});
		txMock.cuentaPorCobrar.findFirst.mockResolvedValue(null);
		txMock.cuentaBancaria.findFirst.mockResolvedValue(null);

		const result = await reconciliarVentaAction({
			ventaId: 'venta-1',
			cuentaId: 'cuenta-de-otro-tenant',
			tipoPagoId: 'tipo-1',
			monto: 100,
		});

		expect(result.success).toBe(false);
		if (!result.success) expect(result.error?.code).toBe('NOT_FOUND');
		expect(txMock.cuentaBancaria.updateMany).not.toHaveBeenCalled();
		expect(txMock.reconciliacionVenta.create).not.toHaveBeenCalled();
	});

	it('rechaza montos no positivos antes de cualquier efecto financiero', () => {
		expect(() =>
			validateSaleReconciliationInput({
				ventaId: 'venta-1',
				cuentaId: 'cuenta-1',
				tipoPagoId: 'tipo-1',
				monto: -100,
			}),
		).toThrowError('Datos de reconciliación inválidos');
	});

	it('bloquea el pago de un CompraServicio marcado como ELIMINANDO bajo lock', async () => {
		txMock.compraServicio.findUnique.mockResolvedValue({
			compraServicioId: 'servicio-1',
			tenantId: 'tenant-1',
			estado: 'ELIMINANDO',
		});

		const result = await reconciliarGastoAction({
			compraServicioId: 'servicio-1',
			cuentaId: 'cuenta-1',
			tipoPagoId: 'tipo-1',
			monto: 100,
		});

		expect(result.success).toBe(false);
		if (!result.success) expect(result.error?.code).toBe('ALREADY_DELETED');
		expect(txMock.$queryRaw).toHaveBeenCalledTimes(1);
		const lockQuery = txMock.$queryRaw.mock.calls[0]?.[0];
		expect(Array.from(lockQuery.raw ?? lockQuery).join('')).toContain('FOR UPDATE');
		expect(workflowMock.applyPagoGastoWorkflow).not.toHaveBeenCalled();
	});
});
