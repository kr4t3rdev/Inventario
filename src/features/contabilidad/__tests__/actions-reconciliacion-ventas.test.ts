import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCurrentUserMock = vi.hoisted(() => vi.fn());
const getReconciliationStatsMock = vi.hoisted(() => vi.fn());
const txMock = vi.hoisted(() => ({
	$queryRaw: vi.fn(),
	$executeRaw: vi.fn(),
	venta: { findUnique: vi.fn(), findMany: vi.fn() },
	cuentaPorCobrar: { findFirst: vi.fn(), updateMany: vi.fn() },
	cuentaBancaria: { update: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn() },
	tipoPago: { findFirst: vi.fn() },
	reconciliacionVenta: { create: vi.fn(), findMany: vi.fn() },
	compraServicio: { findUnique: vi.fn() },
}));
const prismaMock = vi.hoisted(() => ({
	$queryRaw: vi.fn(),
	$transaction: vi.fn((callback: (tx: typeof txMock) => unknown) => callback(txMock)),
	venta: { findMany: vi.fn() },
	ventaServicios: { count: vi.fn(), findMany: vi.fn() },
	gastosDE: { count: vi.fn(), findMany: vi.fn() },
	gastoCompra: { findMany: vi.fn() },
	 pagosalario: { count: vi.fn(), findMany: vi.fn() },
	reconciliacionGasto: { findMany: vi.fn(), count: vi.fn() },
	compraServicio: { count: vi.fn(), findMany: vi.fn() },
	tenantAccountingPolicy: { findUnique: vi.fn() },
	reconciliacionVenta: { count: vi.fn(), aggregate: vi.fn(), findMany: vi.fn() },
	reconciliacionServicio: { count: vi.fn() },
}));
const workflowMock = vi.hoisted(() => ({ applyPagoGastoWorkflow: vi.fn() }));
const exchangeRateMock = vi.hoisted(() => ({ getRateAsOf: vi.fn() }));

vi.mock('@/lib/server-actions/get-current-user', () => ({
	getCurrentUser: getCurrentUserMock,
}));
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock, default: prismaMock }));
vi.mock('@/features/contabilidad/services/reconciliation-stats-service', () => ({
	getReconciliationStats: getReconciliationStatsMock,
}));
vi.mock('@/lib/services/with-period-validation', () => ({
	withPeriodValidation: (_extractor: unknown, handler: unknown) => handler,
}));
vi.mock('@/lib/services/pago-gastos-workflow', () => ({
	applyPagoGastoWorkflow: workflowMock.applyPagoGastoWorkflow,
	isGastoWorkflowError: vi.fn(() => false),
}));
vi.mock('@/features/contabilidad/services/exchange-rate-provider', () => ({
	exchangeRateProvider: exchangeRateMock,
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
	getGastosPendientesAction,
	getVentasPendientesAction,
	reconciliarGastoAction,
	reconciliarVentaAction,
} from '@/features/contabilidad/actions-reconciliacion';
import { validateSaleReconciliationInput } from '@/features/contabilidad/services/accounting-reconciliation-service';
import { buildAppliedFxEvidence } from '@/features/contabilidad/domain/fx-evidence';

const sameCurrencyReconciliation = (amount: number) => ({
	monto: amount,
	montoConvertido: amount,
	moneda: 'CUP',
	tasaCambio: 1,
	...buildAppliedFxEvidence({
		originalAmount: amount,
		originalCurrency: 'CUP',
		functionalCurrency: 'CUP',
		source: 'test',
	}),
});

const foreignCurrencyReconciliation = (amount: number, rate: number, effectiveAt: Date) => ({
	monto: amount,
	montoConvertido: amount * rate,
	moneda: 'USD',
	tasaCambio: rate,
	...buildAppliedFxEvidence({
		originalAmount: amount,
		originalCurrency: 'USD',
		functionalCurrency: 'CUP',
		exchangeRate: rate,
		convertedAmount: amount * rate,
		rateEffectiveAt: effectiveAt,
		source: 'test',
	}),
});

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
		prismaMock.ventaServicios.count.mockResolvedValue(0);
		prismaMock.gastosDE.count.mockResolvedValue(0);
		prismaMock.pagosalario.count.mockResolvedValue(0);
		prismaMock.reconciliacionGasto.findMany.mockResolvedValue([]);
		prismaMock.reconciliacionGasto.count.mockResolvedValue(0);
		prismaMock.compraServicio.count.mockResolvedValue(0);
		prismaMock.tenantAccountingPolicy.findUnique.mockResolvedValue({
			functionalCurrencyCode: 'CUP',
		});
		exchangeRateMock.getRateAsOf.mockResolvedValue(null);
		prismaMock.reconciliacionVenta.count.mockResolvedValue(0);
		prismaMock.reconciliacionVenta.aggregate.mockResolvedValue({ _sum: { monto: null } });
		prismaMock.reconciliacionVenta.findMany.mockResolvedValue([]);
		prismaMock.reconciliacionServicio.count.mockResolvedValue(0);
		prismaMock.$transaction.mockImplementation(
			async (callback: (tx: typeof txMock) => unknown) => callback(txMock),
		);
	});

	it('excluye ventas eliminadas de la consulta SQL de pendientes', async () => {
		txMock.$queryRaw
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ total: BigInt(0) }]);

		const result = await getVentasPendientesAction();

		expect(result.success).toBe(true);
		for (const [query] of txMock.$queryRaw.mock.calls.slice(0, 3)) {
			expect(query.sql).toContain('v."deletedAt" IS NULL');
		}
	});

	it('aísla pagos por tenant y exige evidencia FX canónica antes de sumar', async () => {
		txMock.$queryRaw
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ total: BigInt(1), saldoPendiente: 100 }]);

		await getVentasPendientesAction();

		for (const [query] of txMock.$queryRaw.mock.calls.slice(1, 3)) {
			expect(query.sql).toContain('rv."tenantId" = v."tenantId"');
			expect(query.sql).toContain('rv."fxEvidenceVersion" = 1');
			expect(query.sql).toContain('rv."fxEvidenceFingerprint" ~');
			expect(query.sql).toContain('rv."fxProvenanceSource"');
			expect(query.sql).toContain('rv."rateEffectiveAt" IS NOT NULL');
			expect(query.sql).not.toContain('THEN rv."monto" * rv."tasaCambio"');
		}
		const evidenceQuery = txMock.$queryRaw.mock.calls[0]?.[0];
		expect(evidenceQuery.sql).toContain('rv."fxEvidenceFingerprint"');
		expect(evidenceQuery.sql).not.toContain('HAVING');
	});

	it('falla cerrado si una venta tiene un pago sin evidencia FX canónica', async () => {
		txMock.$queryRaw
			.mockResolvedValueOnce([{
				monto: 4, montoConvertido: null, moneda: 'USD', functionalCurrency: 'CUP',
				tasaCambio: 25, rateEffectiveAt: new Date('2026-01-01'),
				fxProvenanceKind: null, fxProvenanceSource: null, fxCatalogRateId: null,
				fxEvidenceFingerprint: null, fxEvidenceVersion: null,
			}]);

		const result = await getVentasPendientesAction();

		expect(result.success).toBe(false);
		if (result.success) return;
		expect(result.error?.message).toContain('sin evidencia FX verificable');
	});

	it('detecta pago FX inválido aunque otro pago ya cubra el saldo completo', async () => {
		txMock.$queryRaw
			.mockResolvedValueOnce([{
				monto: 4, montoConvertido: null, moneda: 'USD', functionalCurrency: 'CUP',
				tasaCambio: 25, rateEffectiveAt: new Date('2026-01-01'),
				fxProvenanceKind: null, fxProvenanceSource: null, fxCatalogRateId: null,
				fxEvidenceFingerprint: null, fxEvidenceVersion: null,
			}]);

		const result = await getVentasPendientesAction();

		expect(result.success).toBe(false);
		expect(txMock.$queryRaw).toHaveBeenCalledTimes(1);
		const evidenceQuery = txMock.$queryRaw.mock.calls[0]?.[0];
		expect(evidenceQuery.sql).not.toContain('HAVING');
	});

	it('valida evidencia FX en páginas bajo el mismo snapshot que los saldos', async () => {
		const validRows = Array.from({ length: 500 }, (_, index) => ({
			reconciliacionId: `rv-${String(index).padStart(4, '0')}`,
			...sameCurrencyReconciliation(1),
		}));
		txMock.$queryRaw
			.mockResolvedValueOnce(validRows)
			.mockResolvedValueOnce([{
				reconciliacionId: 'rv-invalid',
				monto: 4, montoConvertido: null, moneda: 'USD', functionalCurrency: 'CUP',
				tasaCambio: 25, rateEffectiveAt: new Date('2026-01-01'),
				fxProvenanceKind: null, fxProvenanceSource: null, fxCatalogRateId: null,
				fxEvidenceFingerprint: null, fxEvidenceVersion: null,
			}]);

		const result = await getVentasPendientesAction();

		expect(result.success).toBe(false);
		expect(txMock.$queryRaw).toHaveBeenCalledTimes(2);
		const firstPageQuery = txMock.$queryRaw.mock.calls[0]?.[0];
		const secondPageQuery = txMock.$queryRaw.mock.calls[1]?.[0];
		expect(firstPageQuery.sql).toContain('ORDER BY rv."reconciliacionId"');
		expect(firstPageQuery.sql).toContain('rv."tenantId" = v."tenantId"');
		expect(firstPageQuery.sql).toContain('LIMIT ?');
		expect(firstPageQuery.values).toContain(500);
		expect(secondPageQuery.sql).toContain('rv."reconciliacionId" >');
		expect(secondPageQuery.values).toContain('rv-0499');
		expect(prismaMock.$transaction.mock.calls[0]?.[1]).toMatchObject({
			isolationLevel: 'RepeatableRead',
			timeout: 30_000,
		});
	});

	it('excluye cuentas por pagar activas del mismo tenant en gastos y compras', async () => {
		prismaMock.gastosDE.findMany.mockResolvedValue([]);
		prismaMock.gastoCompra.findMany.mockResolvedValue([]);
		prismaMock.pagosalario.findMany.mockResolvedValue([]);
		prismaMock.compraServicio.findMany.mockResolvedValue([]);
		prismaMock.ventaServicios.findMany.mockResolvedValue([]);

		const result = await getGastosPendientesAction({ soloNoReconciliados: true });
		expect(result.success).toBe(true);
		for (const delegate of [prismaMock.gastosDE, prismaMock.gastoCompra]) {
			expect(delegate.findMany.mock.calls[0][0].where.NOT).toEqual({
				cuentaPorPagar: {
					is: { tenantId: 'tenant-1', deletedAt: null, estado: { in: ['PENDIENTE', 'PARCIAL'] } },
				},
			});
		}
	});

	it('mantiene gastos con anticipos parciales mostrando solo el saldo abierto', async () => {
		const now = new Date('2026-01-15T12:00:00.000Z');
		prismaMock.gastosDE.findMany.mockResolvedValue([{
			gastosDEId: 'expense-partial', monto: 100, descripcion: 'Servicio', periodo: '2026-01',
			createdAt: now, updatedAt: now,
			reconciliaciones: [sameCurrencyReconciliation(40)],
		}]);
		prismaMock.gastoCompra.findMany.mockResolvedValue([]);
		prismaMock.pagosalario.findMany.mockResolvedValue([]);
		prismaMock.compraServicio.findMany.mockResolvedValue([]);
		prismaMock.ventaServicios.findMany.mockResolvedValue([]);
		prismaMock.reconciliacionGasto.findMany.mockResolvedValue([]);

		const result = await getGastosPendientesAction({ soloNoReconciliados: true });

		expect(result.success).toBe(true);
		expect(result.data?.gastos).toContainEqual(
			expect.objectContaining({ referenciaId: 'expense-partial', monto: 60 }),
		);
		expect(prismaMock.gastosDE.findMany.mock.calls[0]?.[0]?.where.reconciliaciones)
			.toBeUndefined();
	});

	it('calcula el saldo parcial de servicios aunque no se solicite filtrar pendientes', async () => {
		const now = new Date('2026-01-15T12:00:00.000Z');
		prismaMock.gastosDE.findMany.mockResolvedValue([]);
		prismaMock.gastoCompra.findMany.mockResolvedValue([]);
		prismaMock.pagosalario.findMany.mockResolvedValue([]);
		prismaMock.compraServicio.findMany.mockResolvedValue([{
			compraServicioId: 'service-partial', total: 100, fechaServicio: now,
			updatedAt: now, servicio: { nombre: 'Servicio' }, proveedor: { nombre: 'Proveedor' },
		}]);
		prismaMock.ventaServicios.findMany.mockResolvedValue([]);
		prismaMock.reconciliacionGasto.findMany
			.mockResolvedValueOnce([{ referenciaId: 'service-partial', ...sameCurrencyReconciliation(40) }])
			.mockResolvedValueOnce([]);

		const result = await getGastosPendientesAction({ soloNoReconciliados: false });

		expect(result.success).toBe(true);
		expect(result.data?.gastos).toContainEqual(
			expect.objectContaining({ referenciaId: 'service-partial', monto: 60 }),
		);
		expect(prismaMock.reconciliacionGasto.findMany).toHaveBeenCalledTimes(2);
		for (const call of prismaMock.reconciliacionGasto.findMany.mock.calls) {
			expect(call[0]?.where).toMatchObject({
				tenantId: 'tenant-1',
				estado: { in: ['PAGADA', 'PAGADO', 'POSTED', 'PARCIAL'] },
			});
		}
		expect(prismaMock.gastosDE.findMany.mock.calls[0]?.[0]?.include.reconciliaciones.where)
			.toEqual({
				tenantId: 'tenant-1',
				estado: { in: ['PAGADA', 'PAGADO', 'POSTED', 'PARCIAL'] },
			});
	});

	it('convierte el total de servicios extranjeros a moneda funcional antes de restar pagos', async () => {
		const now = new Date('2026-01-15T12:00:00.000Z');
		prismaMock.gastosDE.findMany.mockResolvedValue([]);
		prismaMock.gastoCompra.findMany.mockResolvedValue([]);
		prismaMock.pagosalario.findMany.mockResolvedValue([]);
		prismaMock.compraServicio.findMany.mockResolvedValue([{
			compraServicioId: 'foreign-service', total: 100, moneda: 'USD', fechaServicio: now,
			createdAt: now, updatedAt: now,
			servicio: { nombre: 'Servicio' }, proveedor: null,
		}]);
		prismaMock.ventaServicios.findMany.mockResolvedValue([{
			ventaServicioId: 'foreign-sale-service', costo: 10, cantidad: 2, moneda: 'USD',
			createdAt: now, updatedAt: now,
			servicio: { nombre: 'Servicio vendido' }, cliente: null,
		}]);
		prismaMock.reconciliacionGasto.findMany
			.mockResolvedValueOnce([{
				referenciaId: 'foreign-service',
				...foreignCurrencyReconciliation(40, 25, now),
			}])
			.mockResolvedValueOnce([{
				referenciaId: 'foreign-sale-service',
				...foreignCurrencyReconciliation(4, 25, now),
			}]);
		exchangeRateMock.getRateAsOf.mockResolvedValue({
			tasaId: 'usd-cup', tasa: 25, fechaVigencia: now,
		});

		const result = await getGastosPendientesAction({ soloNoReconciliados: false });

		expect(result.success).toBe(true);
		expect(result.data?.gastos).toContainEqual(
			expect.objectContaining({ referenciaId: 'foreign-service', monto: 1500 }),
		);
		expect(result.data?.gastos).toContainEqual(
			expect.objectContaining({ referenciaId: 'foreign-sale-service', monto: 400 }),
		);
		expect(exchangeRateMock.getRateAsOf).toHaveBeenCalledWith(
			expect.objectContaining({ sourceCurrency: 'USD', targetCurrency: 'CUP' }),
		);
		expect(exchangeRateMock.getRateAsOf).toHaveBeenCalledTimes(1);
	});

	it('no verifica gastos FX legacy con tasa aislada y sin evidencia canónica', async () => {
		const now = new Date('2026-01-15T12:00:00.000Z');
		prismaMock.gastosDE.findMany.mockResolvedValue([{
			gastosDEId: 'expense-fx', monto: 100, descripcion: 'Gasto en CUP', periodo: '2026-01',
			createdAt: now, updatedAt: now,
			reconciliaciones: [{ monto: 4, montoConvertido: null, moneda: 'USD', tasaCambio: 25 }],
		}]);
		prismaMock.gastoCompra.findMany.mockResolvedValue([]);
		prismaMock.pagosalario.findMany.mockResolvedValue([]);
		prismaMock.compraServicio.findMany.mockResolvedValue([]);
		prismaMock.ventaServicios.findMany.mockResolvedValue([]);
		prismaMock.reconciliacionGasto.findMany.mockResolvedValue([]);

		const result = await getGastosPendientesAction({ soloNoReconciliados: true });

		expect(result.success).toBe(false);
		if (result.success) return;
		expect(result.error?.code).toBe('FX_EVIDENCE_MISSING');
		expect(
			prismaMock.gastosDE.findMany.mock.calls[0]?.[0]?.include.reconciliaciones.select,
		).toMatchObject({ functionalCurrency: true, moneda: true, tasaCambio: true });
	});

	it('falla cerrado para gastos FX sin moneda funcional ni tasa de conversión', async () => {
		const now = new Date('2026-01-15T12:00:00.000Z');
		prismaMock.gastosDE.findMany.mockResolvedValue([{
			gastosDEId: 'expense-unknown-fx', monto: 100, descripcion: 'Gasto', periodo: '2026-01',
			createdAt: now, updatedAt: now,
			reconciliaciones: [{ monto: 4, montoConvertido: null, moneda: 'USD', tasaCambio: null }],
		}]);
		prismaMock.gastoCompra.findMany.mockResolvedValue([]);
		prismaMock.pagosalario.findMany.mockResolvedValue([]);
		prismaMock.compraServicio.findMany.mockResolvedValue([]);
		prismaMock.ventaServicios.findMany.mockResolvedValue([]);
		prismaMock.reconciliacionGasto.findMany.mockResolvedValue([]);

		const result = await getGastosPendientesAction({ soloNoReconciliados: true });

		expect(result.success).toBe(false);
		if (result.success) return;
		expect(result.error?.code).toBe('FX_EVIDENCE_MISSING');
	});

	it('aplica rangos de fecha sobre la fecha del movimiento de cada gasto', async () => {
		prismaMock.gastosDE.findMany.mockResolvedValue([]);
		prismaMock.gastoCompra.findMany.mockResolvedValue([]);
		prismaMock.pagosalario.findMany.mockResolvedValue([]);
		prismaMock.compraServicio.findMany.mockResolvedValue([]);
		prismaMock.ventaServicios.findMany.mockResolvedValue([]);

		await getGastosPendientesAction({ fechaDesde: '2026-01-01', fechaHasta: '2026-01-31' });

		expect(prismaMock.gastosDE.findMany.mock.calls[0]?.[0]?.where.createdAt).toBeDefined();
		expect(prismaMock.gastoCompra.findMany.mock.calls[0]?.[0]?.where.fechaCompra).toBeDefined();
		expect(prismaMock.pagosalario.findMany.mock.calls[0]?.[0]?.where.createdAt).toBeDefined();
		expect(prismaMock.compraServicio.findMany.mock.calls[0]?.[0]?.where.fechaServicio).toBeDefined();
		expect(prismaMock.ventaServicios.findMany.mock.calls[0]?.[0]?.where.createdAt).toBeDefined();
		for (const delegate of [
			prismaMock.gastosDE,
			prismaMock.gastoCompra,
			prismaMock.pagosalario,
			prismaMock.compraServicio,
			prismaMock.ventaServicios,
		]) {
			const args = delegate.findMany.mock.calls[0]?.[0]?.where;
			const dateFilter = args?.createdAt ?? args?.fechaCompra ?? args?.fechaServicio;
			expect(dateFilter?.gte).toEqual(new Date('2026-01-01'));
			expect(dateFilter?.lte).toBeInstanceOf(Date);
		}
	});

	it('devuelve el total y saldo completo aun cuando la página está vacía', async () => {
		txMock.$queryRaw
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ total: BigInt(250), saldoPendiente: 1234.5 }]);

		const result = await getVentasPendientesAction({ page: 3, limit: 100 });

		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data.pagination.total).toBe(250);
		expect(result.data.saldoPendienteTotal).toBe(1234.5);
	});

	it('aplica los mismos filtros de fecha y punto de venta al listado y al total', async () => {
		txMock.$queryRaw
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ total: BigInt(0), saldoPendiente: 0 }]);

		await getVentasPendientesAction({
			fechaInicio: '2026-01-01',
			fechaFin: '2026-01-31',
			puntoDeVentaId: 'pv-1',
		});

		for (const [query] of txMock.$queryRaw.mock.calls.slice(1, 3)) {
			expect(query.sql).toContain('v."createdAt" >=');
			expect(query.sql).toContain('v."createdAt" <=');
			expect(query.sql).toContain('v."puntoDeVentaId" =');
			expect(query.values).toEqual(expect.arrayContaining([
				'tenant-1', 'pv-1', new Date('2026-01-01T00:00:00.000Z'),
				new Date('2026-01-31T23:59:59.999Z'),
			]));
		}
	});

	it('excluye de pendientes las ventas administradas por CxC activa', async () => {
		txMock.$queryRaw
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ total: BigInt(0) }]);

		await getVentasPendientesAction();

		for (const [query] of txMock.$queryRaw.mock.calls.slice(0, 3)) {
			expect(query.sql).toContain('NOT EXISTS');
			expect(query.sql).toContain('"CuentaPorCobrar"');
			expect(query.sql).toContain('::"EstadoCuentaPorCobrar"');
			expect(query.values).toEqual(expect.arrayContaining(['PENDIENTE', 'PARCIAL']));
		}
	});

	it('excluye ventas anuladas del KPI de pendientes', async () => {
		const snapshot = {
			modules: {
				ventas: { pending: 0, completedToday: 0, totalToday: 0 },
				servicios: { pending: 0, completedToday: 0, totalToday: 0 },
				gastos: { pending: 0, completedToday: 0, totalToday: 0 },
			},
			stats: {
				totalPending: 0,
				completedToday: 0,
				reconciledAmount: 0,
				efficiency: 0,
			},
			recentActivity: [],
		};
		getReconciliationStatsMock.mockResolvedValue(snapshot);

		const result = await getReconciliacionStatsAction();

		expect(result).toEqual({ success: true, data: snapshot });
		expect(getReconciliationStatsMock).toHaveBeenCalledWith({ tenantId: 'tenant-1' });
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
