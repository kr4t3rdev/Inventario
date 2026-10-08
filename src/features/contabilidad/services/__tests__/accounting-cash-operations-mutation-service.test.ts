import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@/generated/prisma';

const mock = vi.hoisted(() => ({
	accountFindFirst: vi.fn(),
	clienteFindFirst: vi.fn(),
	vendorFindFirst: vi.fn(),
	debtFindFirst: vi.fn(),
	transaction: vi.fn(),
	tx: {} as Record<string, any>,
	postEvento: vi.fn(),
	lock: vi.fn(),
	auditLog: vi.fn(),
	auditLogStrict: vi.fn().mockResolvedValue({ id: 'audit-1' }),
	debtCreate: vi.fn(),
	reconciliationFindUnique: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
	prisma: {
		cuentaBancaria: { findFirst: mock.accountFindFirst },
		cliente: { findFirst: mock.clienteFindFirst },
		vendor: { findFirst: mock.vendorFindFirst },
		deudaCash: { findFirst: mock.debtFindFirst },
		reconciliacionVenta: { findUnique: mock.reconciliationFindUnique },
		tipoPago: { findFirst: vi.fn().mockResolvedValue({ tipoId: 'cash-a' }) },
		$transaction: mock.transaction,
	},
}));

vi.mock('@/features/contabilidad-formal/services/posting-engine', () => ({
	postEvento: mock.postEvento,
}));

vi.mock('../accounting-tenant-lock-service', () => ({
	acquireAccountingTenantLock: mock.lock,
}));

vi.mock('@/lib/services/audit-log-service', () => ({
	AuditLogService: { log: mock.auditLog, logStrict: mock.auditLogStrict },
}));

vi.mock('@/lib/services/tenant-scope', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@/lib/services/tenant-scope')>();
	return {
		...actual,
		requireTenant: vi.fn(actual.requireTenant),
		requireFeature: vi.fn(actual.requireFeature),
		requirePermission: vi.fn(actual.requirePermission),
	};
});

const userConAcceso = {
	userId: 'user-a',
	tenantId: 'tenant-a',
	tenantRole: 'manager',
	planFeatures: { 'deudas-cash': true, 'prestamos-cash': true },
} as never;

describe('AccountingCashOperationsMutationService — deuda cash', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mock.accountFindFirst.mockResolvedValue({
			cuentaId: 'bank-a',
			tenantId: 'tenant-a',
			moneda: 'CUP',
			saldo: 100_000,
			isActive: true,
			tipoCuenta: 'BANCO',
		});
		mock.vendorFindFirst.mockResolvedValue({ vendorId: 'vendor-a', nombre: 'Proveedor A' });
		mock.clienteFindFirst.mockResolvedValue({ clienteId: 'client-a', limiteCredito: null });
		mock.debtFindFirst.mockResolvedValue({
			id: 'debt-a',
			tenantId: 'tenant-a',
			estado: 'ACTIVO',
			moneda: 'USD',
			cuentaPorPagarId: 'ap-a',
			cuentaPorPagar: {
				montoDeuda: 1_000, montoPagado: 0, moneda: 'USD', estado: 'PENDIENTE',
			},
		});
		mock.debtCreate.mockResolvedValue({ id: 'debt-a' });
		mock.reconciliationFindUnique.mockResolvedValue(null);
		mock.tx = {
				$executeRaw: vi.fn(),
				$queryRaw: vi.fn(),
				cliente: { findFirst: mock.clienteFindFirst },
				tenantAccountingPolicy: {
					findUnique: vi.fn().mockResolvedValue({ functionalCurrencyCode: 'CUP' }),
				},
				tipoPago: { findFirst: vi.fn().mockResolvedValue({ tipoId: 'cash-a' }) },
			cuentaBancaria: {
				findFirst: vi.fn().mockResolvedValue({ cuentaId: 'bank-a', tipoCuenta: 'BANCO', moneda: 'CUP' }),
				update: vi.fn().mockResolvedValue({}),
					updateMany: vi.fn().mockResolvedValue({ count: 1 }),
				},
				deudaCash: {
					findFirst: mock.debtFindFirst, create: mock.debtCreate,
					update: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }),
				},
				prestamoCash: {
					findFirst: vi.fn().mockResolvedValue({
						id: 'loan-a', tenantId: 'tenant-a', clienteId: null, estado: 'ACTIVO',
						moneda: 'CUP', cuentaPorCobrarId: 'cxc-loan',
					}),
					create: vi.fn().mockResolvedValue({
						id: 'loan-a', cliente: { clienteId: 'client-a', nombre: 'Cliente A' },
						cuentaPorCobrar: { id: 'cxc-loan' },
					}),
					updateMany: vi.fn().mockResolvedValue({ count: 1 }),
				},
				cuentaPorCobrar: {
					findMany: vi.fn().mockResolvedValue([]),
					create: vi.fn().mockResolvedValue({ id: 'cxc-loan' }),
					findFirst: vi.fn().mockResolvedValue({
						id: 'cxc-loan', montoDeuda: 1000, montoPagado: 0,
						montoPagadoFuncional: 0, estado: 'PENDIENTE', monedaOriginal: 'CUP',
					}),
					updateMany: vi.fn().mockResolvedValue({ count: 1 }),
				},
				cuentaPorPagar: {
					create: vi.fn().mockResolvedValue({ cuentaPorPagarId: 'ap-a' }),
					update: vi.fn().mockResolvedValue({}),
					updateMany: vi.fn().mockResolvedValue({ count: 1 }),
				},
				reconciliacionVenta: {
					findUnique: mock.reconciliationFindUnique,
					update: vi.fn().mockResolvedValue({}),
					create: vi.fn().mockImplementation(async ({ data }) => ({
						reconciliacionId: 'rec-a',
						monto: data.monto,
						moneda: data.moneda,
						montoConvertido: data.montoConvertido,
						tasaCambio: data.tasaCambio,
						fxEvidenceFingerprint: data.fxEvidenceFingerprint,
						fxEvidenceJson: { functionalCurrency: 'CUP' },
					})),
				},
			};
		mock.transaction.mockImplementation(async (callback: (tx: any) => Promise<unknown>) =>
			callback(mock.tx),
		);
	});

	it('scopea proveedor y cuenta bancaria al tenant al crear deuda', async () => {
		const { AccountingCashOperationsMutationService: service } = await import(
			'../accounting-cash-operations-mutation-service'
		);

		await service.createCashDebt({
			input: { proveedorId: 'vendor-a', montoCapital: 500, cuentaBancariaId: 'bank-a' },
			user: userConAcceso,
		});

		expect(mock.vendorFindFirst).toHaveBeenCalledWith(expect.objectContaining({
			where: { vendorId: 'vendor-a', tenantId: 'tenant-a' },
		}));
    expect(mock.accountFindFirst).toHaveBeenCalledWith(expect.objectContaining({
			where: { cuentaId: 'bank-a', tenantId: 'tenant-a', isActive: true },
		}));
		expect(mock.auditLogStrict).toHaveBeenCalledWith(expect.objectContaining({
			accion: 'CREATE', entidad: 'DEUDA_CASH', usuarioId: 'user-a',
		}), mock.tx);
	});

	it('persiste la clave de idempotencia de un alta de deuda y devuelve conflicto si cambia el payload', async () => {
		const { AccountingCashOperationsMutationService: service } = await import(
			'../accounting-cash-operations-mutation-service'
		);
		await service.createCashDebt({
			input: {
				proveedorId: 'vendor-a', montoCapital: 500, cuentaBancariaId: 'bank-a',
				idempotencyKey: 'debt-create-key', observaciones: 'Alta',
			},
			user: userConAcceso,
		});
		const data = mock.tx.reconciliacionVenta.create.mock.calls.at(-1)![0].data;
		expect(data.idempotencyKey).toBe('debt-create-key');
		expect(data.idempotencyPayloadHash).toEqual(expect.any(String));
		expect(mock.tx.reconciliacionVenta.update).toHaveBeenCalledWith(expect.objectContaining({
		data: { deudaCashId: 'debt-a' },
	}));

		mock.reconciliationFindUnique.mockResolvedValueOnce({
			idempotencyPayloadHash: data.idempotencyPayloadHash,
			deudaCashId: 'debt-a',
		});
		mock.tx.deudaCash.findFirst.mockResolvedValueOnce({ id: 'debt-a' });
		await service.createCashDebt({
			input: {
				proveedorId: 'vendor-a', montoCapital: 500, cuentaBancariaId: 'bank-a',
				idempotencyKey: 'debt-create-key', observaciones: 'Alta',
			},
			user: userConAcceso,
		});
		expect(mock.tx.cuentaPorPagar.create).toHaveBeenCalledTimes(1);

		mock.reconciliationFindUnique.mockResolvedValueOnce({
			idempotencyPayloadHash: data.idempotencyPayloadHash,
			deudaCashId: 'debt-a',
		});
		await expect(service.createCashDebt({
			input: {
				proveedorId: 'vendor-a', montoCapital: 501, cuentaBancariaId: 'bank-a',
				idempotencyKey: 'debt-create-key', observaciones: 'Alta',
			},
			user: userConAcceso,
		})).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
	});

	it('persiste la clave de idempotencia al crear un préstamo cash', async () => {
		const { AccountingCashOperationsMutationService: service } = await import(
			'../accounting-cash-operations-mutation-service'
		);
		await service.createCashLoan({
			input: {
				clienteId: 'client-a', montoCapital: 500, cuentaBancariaId: 'bank-a',
				idempotencyKey: 'loan-create-key', observaciones: 'Alta',
			},
			user: userConAcceso,
		});
		const data = mock.tx.reconciliacionVenta.create.mock.calls.at(-1)![0].data;
		expect(data.idempotencyKey).toBe('loan-create-key');
		expect(data.idempotencyPayloadHash).toEqual(expect.any(String));
		expect(mock.tx.reconciliacionVenta.update).toHaveBeenCalledWith(expect.objectContaining({
		data: { prestamoCashId: 'loan-a' },
	}));
	});

	it('revierte la transacción si la auditoría durable de la deuda falla', async () => {
		const { AccountingCashOperationsMutationService: service } = await import(
			'../accounting-cash-operations-mutation-service'
		);
		mock.auditLogStrict.mockRejectedValueOnce(new Error('audit write failed'));

		await expect(service.createCashDebt({
			input: { proveedorId: 'vendor-a', montoCapital: 500, cuentaBancariaId: 'bank-a' },
			user: userConAcceso,
		})).rejects.toThrow('audit write failed');

		expect(mock.auditLogStrict).toHaveBeenCalledWith(expect.objectContaining({
			entidad: 'DEUDA_CASH', usuarioId: 'user-a',
		}), mock.tx);
	});

	it('scopea y audita la edición de deuda dentro de la transacción', async () => {
		const { AccountingCashOperationsMutationService: service } = await import(
			'../accounting-cash-operations-mutation-service'
		);

		await service.updateCashDebt({
			input: { id: 'debt-a', observaciones: 'Nota actualizada' },
			user: userConAcceso,
		});

		expect(mock.debtFindFirst).toHaveBeenCalledWith(expect.objectContaining({
			where: { id: 'debt-a', tenantId: 'tenant-a', deletedAt: null },
		}));
		expect(mock.auditLogStrict).toHaveBeenCalledWith(expect.objectContaining({
			accion: 'UPDATE', entidad: 'DEUDA_CASH', entidadId: 'debt-a',
		}), mock.tx);
	});

  it('persiste y hereda la misma evidencia FX al crear deuda extranjera', async () => {
		const { AccountingCashOperationsMutationService: service } = await import(
			'../accounting-cash-operations-mutation-service'
		);
		await service.createCashDebt({
			input: {
				proveedorId: 'vendor-a',
				montoCapital: 100,
				moneda: 'USD',
				tasaCambio: 24,
				cuentaBancariaId: 'bank-a',
			},
			user: userConAcceso,
		});

		const evento = mock.postEvento.mock.calls[0]?.[2];
		expect(evento.tipo).toBe('DEUDA_RECIBIDA');
		expect(evento.montoFuncional.toString()).toBe('2400');
		expect(evento.tasaCambio.toString()).toBe('24');
		expect(evento.fxEvidenceFingerprint).toEqual(expect.any(String));
		const incremento = mock.tx.cuentaBancaria.updateMany.mock.calls[0]?.[0].data.saldo.increment;
		expect(incremento.toString()).toBe('2400');
	});

	it('valora el desembolso en MLC según política y mueve una cuenta MLC por el funcional', async () => {
		const { AccountingCashOperationsMutationService: service } = await import(
			'../accounting-cash-operations-mutation-service'
		);
		mock.accountFindFirst.mockResolvedValue({
			cuentaId: 'bank-a', tenantId: 'tenant-a', moneda: 'MLC', saldo: 100_000,
			isActive: true, tipoCuenta: 'BANCO',
		});
		mock.tx.tenantAccountingPolicy.findUnique.mockResolvedValue({
			tenantId: 'tenant-a', functionalCurrencyCode: 'MLC',
		});

		await service.createCashDebt({
			input: {
				proveedorId: 'vendor-a', montoCapital: 100, moneda: 'USD', tasaCambio: 2.5,
				cuentaBancariaId: 'bank-a',
			},
			user: userConAcceso,
		});

		const reconciliation = mock.tx.reconciliacionVenta.create.mock.calls[0]?.[0].data;
		expect(reconciliation.montoConvertido.toString()).toBe('250');
		expect(reconciliation.functionalCurrency).toBe('MLC');
		expect(reconciliation.montoCuenta.toString()).toBe('250');
		expect(reconciliation.monedaCuenta).toBe('MLC');
		const incremento = mock.tx.cuentaBancaria.updateMany.mock.calls[0]?.[0].data.saldo.increment;
		expect(incremento.toString()).toBe('250');
	});

	it('rechaza deuda extranjera sin tasa efectiva antes de abrir la transacción', async () => {
		const { AccountingCashOperationsMutationService: service } = await import(
			'../accounting-cash-operations-mutation-service'
		);

		await expect(service.createCashDebt({
			input: {
				proveedorId: 'vendor-a',
				montoCapital: 100,
				moneda: 'USD',
				cuentaBancariaId: 'bank-a',
			},
			user: userConAcceso,
		})).rejects.toMatchObject({ code: 'FX_INSUFICIENTE' });
		expect(mock.tx.cuentaBancaria.updateMany).not.toHaveBeenCalled();
		expect(mock.tx.deudaCash.create).not.toHaveBeenCalled();
		expect(mock.postEvento).not.toHaveBeenCalled();
	});

	it('scopea pago, cuenta y tipo de pago por tenant y hereda valoración FX de fila', async () => {
		const { AccountingCashOperationsMutationService: service } = await import(
			'../accounting-cash-operations-mutation-service'
		);

		await service.registerCashDebtPayment({
			input: {
				id: 'debt-a', monto: 10, cuentaId: 'bank-a', tipoPagoId: 'cash-a',
				moneda: 'USD', tasaCambio: 24,
			},
			user: userConAcceso,
		});

		expect(mock.debtFindFirst).toHaveBeenCalledWith(expect.objectContaining({
			where: { id: 'debt-a', tenantId: 'tenant-a', deletedAt: null },
		}));
		expect(mock.lock.mock.invocationCallOrder[0])
			.toBeLessThan(mock.debtFindFirst.mock.invocationCallOrder[0]);
    expect(mock.tx.cuentaBancaria.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { cuentaId: 'bank-a', tenantId: 'tenant-a', isActive: true },
    }));
		const evento = mock.postEvento.mock.calls[0]?.[2];
		expect(evento.tipo).toBe('PAGO_DEUDA');
		expect(evento.montoFuncional.toString()).toBe('240');
		expect(evento.tasaCambio.toString()).toBe('24');
		expect(evento.fxEvidenceFingerprint).toEqual(expect.any(String));
		const decremento = mock.tx.cuentaBancaria.updateMany.mock.calls[0]?.[0].data.saldo.decrement;
		expect(decremento.toString()).toBe('240');
	});

	it('relee saldo bajo lock y rechaza un pago que excede el saldo vigente', async () => {
		const { AccountingCashOperationsMutationService: service } = await import(
			'../accounting-cash-operations-mutation-service'
		);
		mock.debtFindFirst.mockResolvedValueOnce({
			id: 'debt-a', tenantId: 'tenant-a', estado: 'ACTIVO', moneda: 'CUP',
			cuentaPorPagarId: 'ap-a',
			cuentaPorPagar: {
				montoDeuda: 1_000, montoPagado: 900, moneda: 'CUP', estado: 'PARCIAL',
			},
		});

		await expect(service.registerCashDebtPayment({
			input: { id: 'debt-a', monto: 200, cuentaId: 'bank-a', tipoPagoId: 'cash-a' },
			user: userConAcceso,
		})).rejects.toMatchObject({ code: 'CREDITO_CONFLICTO' });

		const tx = mock.transaction.mock.calls[0][0];
		void tx;
		expect(mock.debtFindFirst.mock.invocationCallOrder[0])
			.toBeGreaterThan(mock.lock.mock.invocationCallOrder[0]);
		expect(mock.postEvento).not.toHaveBeenCalled();
	});

	it('deniega crear deuda si el rol no tiene permiso contable', async () => {
		const { AccountingCashOperationsMutationService: service } = await import(
			'../accounting-cash-operations-mutation-service'
		);

		await expect(service.createCashDebt({
			input: { proveedorId: 'vendor-a', montoCapital: 500, cuentaBancariaId: 'bank-a' },
			user: {
				userId: 'user-limited', tenantId: 'tenant-a', tenantRole: 'dependiente',
				planFeatures: { 'deudas-cash': true },
			} as never,
		})).rejects.toMatchObject({ code: 'FORBIDDEN' });
		expect(mock.debtCreate).not.toHaveBeenCalled();
		expect(mock.postEvento).not.toHaveBeenCalled();
	});

	it('deniega crear deuda si el plan no habilita deudas cash', async () => {
		const { AccountingCashOperationsMutationService: service } = await import(
			'../accounting-cash-operations-mutation-service'
		);

		await expect(service.createCashDebt({
			input: { proveedorId: 'vendor-a', montoCapital: 500, cuentaBancariaId: 'bank-a' },
			user: {
				userId: 'user-a', tenantId: 'tenant-a', tenantRole: 'manager', planFeatures: {},
			} as never,
		})).rejects.toMatchObject({ code: 'FEATURE_NOT_AVAILABLE' });
		expect(mock.debtCreate).not.toHaveBeenCalled();
	});

	it('deniega el pago si el rol no tiene permiso contable', async () => {
		const { AccountingCashOperationsMutationService: service } = await import(
			'../accounting-cash-operations-mutation-service'
		);

		await expect(service.registerCashDebtPayment({
			input: { id: 'debt-a', monto: 10, cuentaId: 'bank-a', tipoPagoId: 'cash-a' },
			user: {
				userId: 'user-limited', tenantId: 'tenant-a', tenantRole: 'dependiente',
				planFeatures: { 'deudas-cash': true },
			} as never,
		})).rejects.toMatchObject({ code: 'FORBIDDEN' });
		expect(mock.postEvento).not.toHaveBeenCalled();
	});

	it('rechaza la misma clave de pago parcial cuando cambia FX u observaciones', async () => {
		const { AccountingCashOperationsMutationService: service } = await import(
			'../accounting-cash-operations-mutation-service'
		);
		mock.tx.prestamoCash.findFirst.mockResolvedValue({
			id: 'loan-a', tenantId: 'tenant-a', clienteId: null, estado: 'ACTIVO',
			moneda: 'USD', cuentaPorCobrarId: 'cxc-loan',
		});
		mock.tx.cuentaPorCobrar.findFirst.mockResolvedValue({
			id: 'cxc-loan', montoDeuda: 1_000, montoPagado: 0,
			montoPagadoFuncional: 0, estado: 'PENDIENTE', monedaOriginal: 'USD',
		});
		let existing: Record<string, unknown> | null = null;
		mock.reconciliationFindUnique
			.mockResolvedValueOnce(null)
			.mockImplementation(async () => existing);

		await service.registerCashLoanPayment({
			input: {
				id: 'loan-a', monto: 100, cuentaId: 'bank-a', tipoPagoId: 'cash-a', moneda: 'USD',
				tasaCambio: 24, observaciones: 'Pago FX', idempotencyKey: 'loan-payment-key',
			},
			user: userConAcceso,
		});
		const createData = mock.tx.reconciliacionVenta.create.mock.calls[0][0].data as Record<string, unknown>;
		existing = {
			reconciliacionId: 'rec-a',
			idempotencyPayloadHash: createData.idempotencyPayloadHash,
			monto: createData.monto,
			moneda: createData.moneda,
			tasaCambio: createData.tasaCambio,
			observaciones: createData.observaciones,
		};

		await expect(service.registerCashLoanPayment({
			input: {
				id: 'loan-a', monto: 100, cuentaId: 'bank-a', tipoPagoId: 'cash-a', moneda: 'USD',
				tasaCambio: 25, observaciones: 'Pago FX', idempotencyKey: 'loan-payment-key',
			},
			user: userConAcceso,
		})).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });

		await expect(service.registerCashLoanPayment({
			input: {
				id: 'loan-a', monto: 100, cuentaId: 'bank-a', tipoPagoId: 'cash-a', moneda: 'USD',
				tasaCambio: 24, observaciones: 'Pago diferente', idempotencyKey: 'loan-payment-key',
			},
			user: userConAcceso,
		})).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
	});

	it('reproduce el pago de deuda con la misma clave y rechaza payload divergente', async () => {
		const { AccountingCashOperationsMutationService: service } = await import(
			'../accounting-cash-operations-mutation-service'
		);
		await service.registerCashDebtPayment({
			input: {
				id: 'debt-a', monto: 10, cuentaId: 'bank-a', tipoPagoId: 'cash-a',
				moneda: 'USD', tasaCambio: 24, observaciones: 'Cuota 1',
				idempotencyKey: 'debt-payment-key',
			},
			user: userConAcceso,
		});
		const data = mock.tx.reconciliacionVenta.create.mock.calls.at(-1)![0].data;
		mock.reconciliationFindUnique.mockResolvedValueOnce({
			reconciliacionId: 'rec-a', idempotencyPayloadHash: data.idempotencyPayloadHash,
		});
		await service.registerCashDebtPayment({
			input: {
				id: 'debt-a', monto: 10, cuentaId: 'bank-a', tipoPagoId: 'cash-a',
				moneda: 'USD', tasaCambio: 24, observaciones: 'Cuota 1',
				idempotencyKey: 'debt-payment-key',
			},
			user: userConAcceso,
		});
		expect(mock.tx.reconciliacionVenta.create).toHaveBeenCalledTimes(1);

		mock.reconciliationFindUnique.mockResolvedValueOnce({
			idempotencyPayloadHash: data.idempotencyPayloadHash,
		});
		await expect(service.registerCashDebtPayment({
			input: {
				id: 'debt-a', monto: 10, cuentaId: 'bank-a', tipoPagoId: 'cash-a',
				moneda: 'USD', tasaCambio: 24, observaciones: 'Cuota distinta',
				idempotencyKey: 'debt-payment-key',
			},
			user: userConAcceso,
		})).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
	});

	it('conserva cuatro decimales en acumulados funcionales de pago parcial', async () => {
		const { AccountingCashOperationsMutationService: service } = await import(
			'../accounting-cash-operations-mutation-service'
		);
		mock.tx.prestamoCash.findFirst.mockResolvedValueOnce({
			id: 'loan-a', tenantId: 'tenant-a', clienteId: null, estado: 'ACTIVO',
			moneda: 'CUP', cuentaPorCobrarId: 'cxc-loan',
		});
		mock.tx.cuentaPorCobrar.findFirst.mockResolvedValueOnce({
			id: 'cxc-loan', montoDeuda: new Prisma.Decimal('1.0000'),
			montoPagado: new Prisma.Decimal('0.0000'),
			montoPagadoFuncional: new Prisma.Decimal('0.0000'),
			estado: 'PENDIENTE', monedaOriginal: 'CUP',
		});

		await service.registerCashLoanPayment({
			input: { id: 'loan-a', monto: 0.0123, cuentaId: 'bank-a', tipoPagoId: 'cash-a' },
			user: userConAcceso,
		});

		const update = mock.tx.cuentaPorCobrar.updateMany.mock.calls.at(-1)?.[0];
		expect(update.data.montoPagado.toString()).toBe('0.0123');
		expect(update.data.montoPagadoFuncional.toString()).toBe('0.0123');
		expect(update.data.estado).toBe('PARCIAL');
	});
});
