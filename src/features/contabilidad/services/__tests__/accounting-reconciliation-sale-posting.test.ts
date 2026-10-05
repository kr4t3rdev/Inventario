import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
	transaction: vi.fn(),
	postEvento: vi.fn(),
	lock: vi.fn(),
	requireTenant: vi.fn(() => 'tenant-a'),
	requireFeature: vi.fn(),
	requirePermission: vi.fn(),
	findSale: vi.fn(),
  findBank: vi.fn(),
	findPaymentType: vi.fn(),
	findReceivable: vi.fn(),
	updateBank: vi.fn(),
	createReconciliation: vi.fn(),
	findReconciliations: vi.fn(),
	updateReceivable: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: mock.transaction } }));
vi.mock('@/features/contabilidad-formal/services/posting-engine', () => ({
	postEvento: mock.postEvento,
}));
vi.mock('../accounting-tenant-lock-service', () => ({
	acquireAccountingTenantLock: mock.lock,
}));
vi.mock('@/lib/services/tenant-scope', () => ({
	requireTenant: mock.requireTenant,
	requireFeature: mock.requireFeature,
	requirePermission: mock.requirePermission,
}));

describe('AccountingReconciliationService.reconcileSale — posteo formal', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mock.findSale.mockResolvedValue({ tenantId: 'tenant-a', deletedAt: null, factura: null });
		mock.findBank.mockResolvedValue({
			cuentaId: 'bank-a', isActive: true, tipoCuenta: 'CORRIENTE', moneda: 'CUP',
		});
		mock.findPaymentType.mockResolvedValue({ tipoId: 'payment-a', isActive: true });
		mock.findReceivable.mockResolvedValue(null);
		mock.updateBank.mockResolvedValue({ count: 1 });
		mock.createReconciliation.mockImplementation(async ({ data }) => ({
			reconciliacionId: 'rec-sale',
			...data,
		}));
		mock.findReconciliations.mockResolvedValue([]);
		mock.updateReceivable.mockResolvedValue({ count: 1 });
		mock.transaction.mockImplementation(async (callback: (tx: any) => Promise<unknown>) =>
			callback({
				$executeRaw: vi.fn(),
				$queryRaw: vi.fn(),
				auditLog: { create: vi.fn().mockResolvedValue({ auditId: 'audit-1' }) },
				tenantAccountingPolicy: {
					findUnique: vi.fn().mockResolvedValue({
						tenantId: 'tenant-a',
						functionalCurrencyCode: 'CUP',
					}),
				},
				venta: { findUnique: mock.findSale },
					cuentaBancaria: { findFirst: mock.findBank, updateMany: mock.updateBank },
				tipoPago: { findFirst: mock.findPaymentType },
				cuentaPorCobrar: { findFirst: mock.findReceivable, updateMany: mock.updateReceivable },
				reconciliacionVenta: {
					create: mock.createReconciliation,
					findMany: mock.findReconciliations,
				},
			})
		);
	});

	it('postea una venta al contado desde la reconciliación persistida y transmite FX', async () => {
		const { AccountingReconciliationService: service } = await import(
			'../accounting-reconciliation-service'
		);
		const fechaReconciliacion = '2026-09-25T12:00:00.000Z';

		await service.reconcileSale({
			input: {
				ventaId: 'sale-a', cuentaId: 'bank-a', tipoPagoId: 'payment-a',
				monto: 10, moneda: 'USD', tasaCambio: 24, fechaReconciliacion,
			},
			user: { userId: 'user-a', tenantId: 'tenant-a', tenantRole: 'manager',
				planFeatures: { contabilidad: true } } as never,
		});

		expect(mock.postEvento).toHaveBeenCalledTimes(1);
		expect(mock.postEvento).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ tenantId: 'tenant-a', userId: 'user-a' }),
			expect.objectContaining({
				tipo: 'VENTA_CONTADO',
				origen: { tipo: 'reconciliacion_venta', id: 'rec-sale' },
				fxEvidenceFingerprint: expect.any(String),
			}),
		);
		const evento = mock.postEvento.mock.calls[0][2];
		// FX-2: la valoración viaja como Decimal exacto.
		expect(evento.montoFuncional.toString()).toBe('240');
		expect(evento.tasaCambio.toString()).toBe('24');
		expect(mock.requireFeature).toHaveBeenCalledWith(expect.anything(), 'contabilidad', expect.any(String));
		expect(mock.requirePermission).toHaveBeenCalledWith(
			expect.anything(), 'financiero.contabilidad.acceder', expect.any(String),
		);
	});

	it('usa COBRO_CXC si la venta tiene saldo por cobrar', async () => {
		mock.findReceivable.mockResolvedValue({
			idCC: 'ar-a',
			montoDeuda: 20,
			montoPagado: 0,
			montoOriginal: 20,
			montoDeudaFuncional: 20,
			montoPagadoFuncional: 0,
			monedaOriginal: 'CUP',
			monedaFuncional: 'CUP',
			fxEvidenceFingerprint: 'original-cup-fingerprint',
			fxEvidenceVersion: 2,
			tasaCambio: 1,
			estado: 'PENDIENTE',
		});
		const { AccountingReconciliationService: service } = await import(
			'../accounting-reconciliation-service'
		);

		await service.reconcileSale({
			input: {
				ventaId: 'sale-a', cuentaId: 'bank-a', tipoPagoId: 'payment-a', monto: 20,
			},
			user: { userId: 'user-a', tenantId: 'tenant-a', tenantRole: 'manager',
				planFeatures: { contabilidad: true } } as never,
		});

		expect(mock.postEvento).toHaveBeenCalledTimes(1);
		expect(mock.postEvento.mock.calls[0][2].tipo).toBe('COBRO_CXC');
	});

	it('falla cerrada ante moneda extranjera sin tasa efectiva', async () => {
		const { AccountingReconciliationService: service } = await import(
			'../accounting-reconciliation-service'
		);

		await expect(service.reconcileSale({
			input: {
				ventaId: 'sale-a', cuentaId: 'bank-a', tipoPagoId: 'payment-a',
				monto: 10, moneda: 'USD', tasaCambio: 24,
			},
			user: { userId: 'user-a', tenantId: 'tenant-a', tenantRole: 'manager',
				planFeatures: { contabilidad: true } } as never,
		})).rejects.toMatchObject({ code: 'FX_INSUFICIENTE' });
		expect(mock.updateBank).not.toHaveBeenCalled();
		expect(mock.createReconciliation).not.toHaveBeenCalled();
	});
});
