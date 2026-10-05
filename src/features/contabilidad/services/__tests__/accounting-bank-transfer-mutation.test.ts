import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
	accountFindFirst: vi.fn(),
	transferFindFirst: vi.fn(),
	transferCreate: vi.fn(),
	transaction: vi.fn(),
	postEvento: vi.fn(),
	lock: vi.fn(),
	feature: vi.fn(),
	permission: vi.fn(),
	auditLogStrict: vi.fn().mockResolvedValue({ auditId: 'audit-1' }),
}));

vi.mock('@/lib/prisma', () => ({
	prisma: {
		cuentaBancaria: { findFirst: mock.accountFindFirst },
		transferenciaBancaria: { findFirst: mock.transferFindFirst },
		$transaction: mock.transaction,
	},
}));
vi.mock('@/features/contabilidad-formal/services/posting-engine', () => ({
	postEvento: mock.postEvento,
}));
vi.mock('../accounting-tenant-lock-service', () => ({ acquireAccountingTenantLock: mock.lock }));
vi.mock('@/lib/services/tenant-scope', () => ({
	requireTenant: vi.fn(() => 'tenant-a'),
	requireFeature: mock.feature,
	requirePermission: mock.permission,
}));
vi.mock('@/lib/services/audit-log-service', () => ({
	AuditLogService: { log: vi.fn(), logStrict: mock.auditLogStrict },
}));

describe('AccountingOperationsMutationService.createBankTransfer', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mock.accountFindFirst.mockImplementation(async ({ where }) => ({
			cuentaId: where.cuentaId,
			tenantId: 'tenant-a',
			moneda: 'CUP',
			saldo: 1000,
			isActive: true,
		}));
		mock.transferFindFirst.mockResolvedValue(null);
		mock.transaction.mockImplementation(async (callback: (tx: any) => Promise<unknown>) =>
			callback({
				$executeRaw: vi.fn(),
				cuentaBancaria: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
				tenantAccountingPolicy: {
					findUnique: vi.fn().mockResolvedValue({ functionalCurrencyCode: 'CUP' }),
				},
				transferenciaBancaria: {
					create: mock.transferCreate.mockImplementation(async ({ data }) => ({
						...data,
						transferenciaId: 'transfer-a',
						numeroComprobante: data.numeroComprobante ?? 'TRF-000001',
						cuentaOrigen: { nombreBanco: 'A' },
						cuentaDestino: { nombreBanco: 'B' },
					})),
				},
			})
		);
	});

	it('valida ambas cuentas activas bajo el tenant y muta con where tenant-scoped', async () => {
		const { AccountingOperationsMutationService: service } = await import(
			'../accounting-operations-mutation-service'
		);

		await service.createBankTransfer({
			input: {
				cuentaOrigenId: 'bank-from', cuentaDestinoId: 'bank-to', montoOrigen: 100,
				motivo: 'Rebalanceo',
			},
			user: { userId: 'actor-a', tenantId: 'tenant-a', tenantRole: 'manager',
				planFeatures: { 'transferencias-bancarias': true } } as never,
		});

		expect(mock.accountFindFirst).toHaveBeenCalledTimes(2);
		expect(mock.accountFindFirst).toHaveBeenCalledWith(expect.objectContaining({
			where: { cuentaId: 'bank-from', tenantId: 'tenant-a', isActive: true },
		}));
		expect(mock.accountFindFirst).toHaveBeenCalledWith(expect.objectContaining({
			where: { cuentaId: 'bank-to', tenantId: 'tenant-a', isActive: true },
		}));
		expect(mock.feature).toHaveBeenCalledWith(expect.anything(), 'transferencias-bancarias', expect.any(String));
		expect(mock.permission).toHaveBeenCalledWith(
			expect.anything(), 'financiero.contabilidad.acceder', expect.any(String),
		);
		expect(mock.auditLogStrict).toHaveBeenCalledWith(expect.objectContaining({
			accion: 'CREATE', entidad: 'TRANSFERENCIA', entidadId: 'transfer-a',
		}), expect.anything());
	});

	it('deniega usuario sin permiso antes de consultar cuentas', async () => {
		mock.permission.mockImplementationOnce(() => { throw new Error('FORBIDDEN'); });
		const { AccountingOperationsMutationService: service } = await import(
			'../accounting-operations-mutation-service'
		);

		await expect(service.createBankTransfer({
			input: {
				cuentaOrigenId: 'bank-from', cuentaDestinoId: 'bank-to', montoOrigen: 100,
				motivo: 'Rebalanceo',
			},
			user: { userId: 'actor-a', tenantId: 'tenant-a' } as never,
		})).rejects.toThrow('FORBIDDEN');
		expect(mock.accountFindFirst).not.toHaveBeenCalled();
		expect(mock.transaction).not.toHaveBeenCalled();
	});

	it('convierte USD→CUP con FX persistida y hereda fingerprint al asiento', async () => {
		mock.accountFindFirst.mockImplementation(async ({ where }) => ({
			cuentaId: where.cuentaId,
			tenantId: 'tenant-a',
			moneda: where.cuentaId === 'bank-from' ? 'USD' : 'CUP',
			saldo: 1000,
			isActive: true,
		}));
		const { AccountingOperationsMutationService: service } = await import(
			'../accounting-operations-mutation-service'
		);

		await service.createBankTransfer({
			input: {
				cuentaOrigenId: 'bank-from', cuentaDestinoId: 'bank-to', montoOrigen: 10,
				montoDestino: 240, tasaCambio: 24, motivo: 'Conversión USD a CUP',
			},
			user: { userId: 'actor-a', tenantId: 'tenant-a', tenantRole: 'manager',
				planFeatures: { 'transferencias-bancarias': true } } as never,
		});

		expect(mock.postEvento).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ tenantId: 'tenant-a', userId: 'actor-a' }),
			expect.objectContaining({
				fxEvidenceFingerprint: expect.any(String),
			}),
	);
		const evento = mock.postEvento.mock.calls[0][2];
		// FX-2: la valoración del evento viaja como Decimal exacto.
		expect(evento.montoFuncional.toString()).toBe('240');
		expect(evento.tasaCambio.toString()).toBe('24');
	});

	it('rechaza una transferencia extranjera sin tasa sin mutar tesorería ni transferencia', async () => {
		mock.accountFindFirst.mockImplementation(async ({ where }) => ({
			cuentaId: where.cuentaId,
			tenantId: 'tenant-a',
			moneda: where.cuentaId === 'bank-from' ? 'USD' : 'CUP',
			saldo: 1000,
			isActive: true,
		}));
		const { AccountingOperationsMutationService: service } = await import(
			'../accounting-operations-mutation-service'
		);

		await expect(service.createBankTransfer({
			input: {
				cuentaOrigenId: 'bank-from', cuentaDestinoId: 'bank-to', montoOrigen: 10,
				motivo: 'Sin tasa',
			},
			user: { userId: 'actor-a', tenantId: 'tenant-a', tenantRole: 'manager',
				planFeatures: { 'transferencias-bancarias': true } } as never,
		})).rejects.toMatchObject({ code: 'FX_INSUFICIENTE' });
		// FX-1: la valoración se mueve dentro del tx tras el lock; el rechazo
		// sigue ocurriendo antes de cualquier mutación persistida.
		expect(mock.transferCreate).not.toHaveBeenCalled();
		expect(mock.postEvento).not.toHaveBeenCalled();
	});
});
