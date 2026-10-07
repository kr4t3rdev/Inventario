import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
	accountFindFirst: vi.fn(),
	clientFindFirst: vi.fn(),
	loanFindFirst: vi.fn(),
	tipoPagoFindFirst: vi.fn(),
	txLoanFindFirst: vi.fn(),
	txCxcFindFirst: vi.fn(),
	txAccountFindFirst: vi.fn(),
	txReconciliationCreate: vi.fn(),
	txPolicyFindUnique: vi.fn(),
	txTipoPagoFindFirst: vi.fn(),
	transaction: vi.fn(),
	postEvento: vi.fn(),
	lock: vi.fn(),
	feature: vi.fn(),
	permission: vi.fn(),
	auditLogStrict: vi.fn().mockResolvedValue({ auditId: 'audit-1' }),
	txLoanUpdateMany: vi.fn(),
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
vi.mock('@/lib/services/audit-log-service', () => ({
	AuditLogService: { log: vi.fn(), logStrict: mock.auditLogStrict },
}));

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
		mock.txAccountFindFirst.mockResolvedValue({
			cuentaId: 'bank-a', tipoCuenta: 'CORRIENTE', moneda: 'CUP',
		});
		mock.txTipoPagoFindFirst.mockResolvedValue({ tipoId: 'payment-a' });
		mock.txLoanUpdateMany.mockResolvedValue({ count: 1 });
		mock.txReconciliationCreate.mockImplementation(async ({ data }) => ({
			reconciliacionId: 'rec-loan', ...data,
		}));
		mock.txPolicyFindUnique.mockResolvedValue({ functionalCurrencyCode: 'CUP' });
		mock.tipoPagoFindFirst.mockResolvedValue({ tipoId: 'payment-a' });
		mock.transaction.mockImplementation(async (callback: (tx: any) => Promise<unknown>) =>
			callback({
				$executeRaw: vi.fn(),
				$queryRaw: vi.fn().mockResolvedValue([]),
				tenantAccountingPolicy: {
					findUnique: mock.txPolicyFindUnique,
				},
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
					create: mock.txReconciliationCreate,
				},
				prestamoCash: {
					create: vi.fn().mockResolvedValue({ id: 'loan-new', cliente: {}, cuentaPorCobrar: {} }),
					findFirst: mock.txLoanFindFirst,
					updateMany: mock.txLoanUpdateMany,
					update: vi.fn().mockResolvedValue({}),
				},
			})
		);
	});

	it('scopea y audita la edición del préstamo en una transacción', async () => {
		const { AccountingCashOperationsMutationService: service } = await import(
			'../accounting-cash-operations-mutation-service'
		);

		await service.updateCashLoan({
			input: { id: 'loan-a', observaciones: 'Nota actualizada' },
			user: { userId: 'user-a', tenantId: 'tenant-a' } as never,
		});

		expect(mock.txLoanFindFirst).toHaveBeenCalledWith(expect.objectContaining({
			where: { id: 'loan-a', tenantId: 'tenant-a', deletedAt: null },
		}));
		expect(mock.txLoanUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
			where: { id: 'loan-a', tenantId: 'tenant-a', deletedAt: null },
		}));
		expect(mock.auditLogStrict).toHaveBeenCalledWith(expect.objectContaining({
			accion: 'UPDATE', entidad: 'PRESTAMO_CASH', entidadId: 'loan-a',
		}), expect.anything());
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

		const evento = mock.postEvento.mock.calls[0]?.[2];
		expect(evento.tipo).toBe('PRESTAMO_OTORGADO');
		expect(evento.montoFuncional.toString()).toBe('2400');
		expect(evento.tasaCambio.toString()).toBe('24');
		expect(evento.fxEvidenceFingerprint).toEqual(expect.any(String));
		expect(evento.fecha).toBeInstanceOf(Date);
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
		expect(mock.txAccountFindFirst).not.toHaveBeenCalled();
		expect(mock.txLoanUpdateMany).not.toHaveBeenCalled();
		expect(mock.postEvento).not.toHaveBeenCalled();
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
		const evento = mock.postEvento.mock.calls[0]?.[2];
		expect(evento.tipo).toBe('COBRO_PRESTAMO');
		expect(evento.montoFuncional.toString()).toBe('250');
		expect(evento.tasaCambio.toString()).toBe('25');
		expect(evento.fxEvidenceFingerprint).toEqual(expect.any(String));
	});

	it('registra el pago en MLC funcional y guarda la moneda nativa de la cuenta', async () => {
		const { AccountingCashOperationsMutationService: service } = await import(
			'../accounting-cash-operations-mutation-service'
		);
		mock.txPolicyFindUnique.mockResolvedValue({
			tenantId: 'tenant-a', functionalCurrencyCode: 'MLC',
		});
		mock.txAccountFindFirst.mockResolvedValue({
			cuentaId: 'bank-a', tipoCuenta: 'CORRIENTE', moneda: 'MLC',
		});

		await service.registerCashLoanPayment({
			input: {
				id: 'loan-a', monto: 10, cuentaId: 'bank-a', tipoPagoId: 'payment-a',
				moneda: 'USD', tasaCambio: 2.5,
			},
			user: { userId: 'user-a', tenantId: 'tenant-a' } as never,
		});

		const payment = mock.txReconciliationCreate.mock.calls[0]?.[0].data;
		expect(payment.functionalCurrency).toBe('MLC');
		expect(payment.montoConvertido.toString()).toBe('25');
		expect(payment.montoCuenta.toString()).toBe('25');
		expect(payment.monedaCuenta).toBe('MLC');
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
				moneda: 'USD', tasaCambio: 25,
			},
			user: { userId: 'user-a', tenantId: 'tenant-a' } as never,
		})).rejects.toMatchObject({ code: 'CREDITO_CONFLICTO' });

		expect(mock.txCxcFindFirst).toHaveBeenCalledWith(expect.objectContaining({
			where: { id: 'ar-a', tenantId: 'tenant-a' },
		}));
		expect(mock.postEvento).not.toHaveBeenCalled();
	});
});
