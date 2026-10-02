import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
	accountFindFirst: vi.fn(),
	clientFindFirst: vi.fn(),
	loanFindFirst: vi.fn(),
	tipoPagoFindFirst: vi.fn(),
	txLoanFindFirst: vi.fn(),
	txCxcFindFirst: vi.fn(),
	txAccountFindFirst: vi.fn(),
	txTipoPagoFindFirst: vi.fn(),
	transaction: vi.fn(),
	postEvento: vi.fn(),
	lock: vi.fn(),
	feature: vi.fn(),
	permission: vi.fn(),	
}));

vi.mock('@/lib/prisma', () => ({
	prisma: {
		cuentaBancaria: { findFirst: mock.accountFindFirst },
		cliente: { findFirst: mock.clientFindFirst },
		prestamoCash: { findFirst: mock.loanFindFirst },
		tipoPago: { findFirst: mock.tipoPagoFindFirst },
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
vi.mock('@/lib/services/audit-log-service', () => ({ AuditLogService: { log: vi.fn() } }));

describe('AccountingCashOperationsMutationService — préstamo cash', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mock.accountFindFirst.mockResolvedValue({
			cuentaId: 'bank-a', tenantId: 'tenant-a', saldo: 100_000,
			isActive: true, tipoCuenta: 'CORRIENTE', moneda: 'CUP',
		});
		mock.clientFindFirst.mockResolvedValue({ clienteId: 'client-a', nombre: 'Cliente A' });
		mock.loanFindFirst.mockResolvedValue({
			id: 'loan-a', tenantId: 'tenant-a', estado: 'ACTIVO', moneda: 'USD',
			cuentaPorCobrarId: 'ar-a', cuentaPorCobrar: { montoDeuda: 1000, montoPagado: 0 },
		});
		mock.txLoanFindFirst.mockResolvedValue({
			id: 'loan-a', tenantId: 'tenant-a', estado: 'ACTIVO', moneda: 'USD',
			clienteId: 'client-a',
			cuentaPorCobrarId: 'ar-a', cuentaPorCobrar: { montoDeuda: 1000, montoPagado: 0 },
		});
		mock.txCxcFindFirst.mockResolvedValue({
			id: 'ar-a', montoDeuda: 1000, montoPagado: 0, estado: 'PENDIENTE',
		});
		mock.txAccountFindFirst.mockResolvedValue({ cuentaId: 'bank-a', tipoCuenta: 'CORRIENTE' });
		mock.txTipoPagoFindFirst.mockResolvedValue({ tipoId: 'payment-a' });
		mock.tipoPagoFindFirst.mockResolvedValue({ tipoId: 'payment-a' });
		mock.transaction.mockImplementation(async (callback: (tx: any) => Promise<unknown>) =>
			callback({
				$executeRaw: vi.fn(),
				$queryRaw: vi.fn().mockResolvedValue([]),
				cliente: { findFirst: vi.fn().mockResolvedValue({ clienteId: 'client-a', limiteCredito: null }) },
				tipoPago: { findFirst: mock.txTipoPagoFindFirst },
				cuentaBancaria: {
					findFirst: mock.txAccountFindFirst,
					update: vi.fn().mockResolvedValue({}),
					updateMany: vi.fn().mockResolvedValue({ count: 1 }),
				},
				cuentaPorCobrar: {
					create: vi.fn().mockResolvedValue({ id: 'ar-new' }),
					findFirst: mock.txCxcFindFirst,
					update: vi.fn().mockResolvedValue({}),
					updateMany: vi.fn().mockResolvedValue({ count: 1 }),
				},
				reconciliacionVenta: {
					create: vi.fn().mockImplementation(async ({ data }) => ({
						reconciliacionId: 'rec-loan',
						monto: data.monto,
						moneda: data.moneda,
						montoConvertido: data.montoConvertido,
						tasaCambio: data.tasaCambio,
						fxEvidenceFingerprint: data.fxEvidenceFingerprint,
						functionalCurrency: data.functionalCurrency,
					})),
				},
				prestamoCash: {
					create: vi.fn().mockResolvedValue({ id: 'loan-new', cliente: {}, cuentaPorCobrar: {} }),
					findFirst: mock.txLoanFindFirst,
					updateMany: vi.fn().mockResolvedValue({ count: 1 }),
					update: vi.fn().mockResolvedValue({}),
				},
			})
		);
	});

	it('valida cliente y cuenta por tenant al crear el préstamo', async () => {
		const { AccountingCashOperationsMutationService: service } = await import(
			'../accounting-cash-operations-mutation-service'
		);

		await service.createCashLoan({
			input: {
				clienteId: 'client-a', montoCapital: 500,
				cuentaBancariaId: 'bank-a',
			},
			user: { userId: 'user-a', tenantId: 'tenant-a' } as never,
		});

		expect(mock.clientFindFirst).toHaveBeenCalledWith(expect.objectContaining({
			where: { clienteId: 'client-a', tenantId: 'tenant-a' },
		}));
		expect(mock.accountFindFirst).toHaveBeenCalledWith(expect.objectContaining({
			where: { cuentaId: 'bank-a', tenantId: 'tenant-a', isActive: true },
		}));
		expect(mock.feature).toHaveBeenCalledWith(expect.anything(), 'prestamos-cash', expect.any(String));
		expect(mock.permission).toHaveBeenCalledWith(
			expect.anything(), 'financiero.contabilidad.acceder', expect.any(String),
		);
	});

	it('persiste FX y la hereda desde la reconciliación al asiento de desembolso', async () => {
		const { AccountingCashOperationsMutationService: service } = await import(
			'../accounting-cash-operations-mutation-service'
		);

		await service.createCashLoan({
			input: {
				clienteId: 'client-a', montoCapital: 100, moneda: 'USD',
				tasaCambioAlCrear: 24, cuentaBancariaId: 'bank-a',
			},
			user: { userId: 'user-a', tenantId: 'tenant-a' } as never,
		});

		expect(mock.postEvento).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ tenantId: 'tenant-a', userId: 'user-a' }),
			expect.objectContaining({
				tipo: 'PRESTAMO_OTORGADO', montoFuncional: 2400, tasaCambio: 24,
				fxEvidenceFingerprint: expect.any(String), fecha: expect.any(Date),
			}),
		);
	});

	it('rechaza desembolso extranjero sin evidencia antes de abrir transacción', async () => {
		const { AccountingCashOperationsMutationService: service } = await import(
			'../accounting-cash-operations-mutation-service'
		);

		await expect(service.createCashLoan({
			input: {
				clienteId: 'client-a', montoCapital: 100, moneda: 'USD', cuentaBancariaId: 'bank-a',
			},
			user: { userId: 'user-a', tenantId: 'tenant-a' } as never,
		})).rejects.toMatchObject({ code: 'FX_INSUFICIENTE' });
		expect(mock.transaction).not.toHaveBeenCalled();
	});

	it('scopea pago, cuenta y tipo de pago al tenant y usa valoración persistible', async () => {
		const { AccountingCashOperationsMutationService: service } = await import(
			'../accounting-cash-operations-mutation-service'
		);

		await service.registerCashLoanPayment({
			input: {
				id: 'loan-a', monto: 10, cuentaId: 'bank-a', tipoPagoId: 'payment-a',
				moneda: 'USD', tasaCambio: 25,
			},
			user: { userId: 'user-a', tenantId: 'tenant-a' } as never,
		});

		expect(mock.txLoanFindFirst).toHaveBeenCalledWith(expect.objectContaining({
			where: { id: 'loan-a', tenantId: 'tenant-a', deletedAt: null },
		}));
		expect(mock.txAccountFindFirst).toHaveBeenCalledWith(expect.objectContaining({
			where: { cuentaId: 'bank-a', tenantId: 'tenant-a', isActive: true },
		}));
		expect(mock.txTipoPagoFindFirst).toHaveBeenCalledWith(expect.objectContaining({
			where: { tipoId: 'payment-a', tenantId: 'tenant-a', isActive: true },
		}));
		expect(mock.postEvento).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ tenantId: 'tenant-a', userId: 'user-a' }),
			expect.objectContaining({
				tipo: 'COBRO_PRESTAMO', montoFuncional: 250, tasaCambio: 25,
				fxEvidenceFingerprint: expect.any(String),
			}),
		);
	});

	it('revalida el saldo del préstamo bajo lock y no contabiliza un pago obsoleto', async () => {
		const { AccountingCashOperationsMutationService: service } = await import(
			'../accounting-cash-operations-mutation-service'
		);
		mock.txCxcFindFirst.mockResolvedValue({
			id: 'ar-a', montoDeuda: 1000, montoPagado: 800, estado: 'PARCIAL',
		});

		await expect(service.registerCashLoanPayment({
			input: {
				id: 'loan-a', monto: 500, cuentaId: 'bank-a', tipoPagoId: 'payment-a',
			},
			user: { userId: 'user-a', tenantId: 'tenant-a' } as never,
		})).rejects.toMatchObject({ code: 'CREDITO_CONFLICTO' });

		expect(mock.txCxcFindFirst).toHaveBeenCalledWith(expect.objectContaining({
			where: { id: 'ar-a', tenantId: 'tenant-a' },
		}));
		expect(mock.postEvento).not.toHaveBeenCalled();
	});
});
