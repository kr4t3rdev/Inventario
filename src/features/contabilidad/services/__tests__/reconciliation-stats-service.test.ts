import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ReconciliationStatsDb } from '../reconciliation-stats-service';
import { getReconciliationStats } from '../reconciliation-stats-service';

vi.mock('@/lib/prisma', () => ({ prisma: {} }));

interface MockDbResult {
  db: ReconciliationStatsDb;
  calls: {
    ventas: ReturnType<typeof vi.fn>;
    ventaServicios: ReturnType<typeof vi.fn>;
    gastosDE: ReturnType<typeof vi.fn>;
    gastoCompra: ReturnType<typeof vi.fn>;
    pagosalario: ReturnType<typeof vi.fn>;
    compraServicio: ReturnType<typeof vi.fn>;
    reconciliacionGasto: ReturnType<typeof vi.fn>;
    reconciliacionGastoLegacyAmounts: ReturnType<typeof vi.fn>;
    reconciliacionGastoCount: ReturnType<typeof vi.fn>;
    reconciliacionGastoAggregate: ReturnType<typeof vi.fn>;
    reconciliacionGastoRecent: ReturnType<typeof vi.fn>;
    reconciliacionVentaCount: ReturnType<typeof vi.fn>;
    reconciliacionVentaAggregate: ReturnType<typeof vi.fn>;
    reconciliacionVentaRecent: ReturnType<typeof vi.fn>;
    reconciliacionServicioCount: ReturnType<typeof vi.fn>;
    reconciliacionServicioAggregate: ReturnType<typeof vi.fn>;
    reconciliacionServicioRecent: ReturnType<typeof vi.fn>;
    queryRaw: ReturnType<typeof vi.fn>;
  };
}

/**
 * @description Builds an isolated database double for the pending-statistics boundary.
 * @param {number | bigint} salesPending - Count returned by the sales query seam.
 * @returns {MockDbResult} Database double and delegate spies.
 */
function makeDb(salesPending: number | bigint = 0): MockDbResult {
  const calls = {
    ventas: vi.fn(),
    ventaServicios: vi.fn(),
    gastosDE: vi.fn(),
    gastoCompra: vi.fn(),
    pagosalario: vi.fn(),
    compraServicio: vi.fn(),
    reconciliacionGasto: vi.fn(),
    reconciliacionGastoLegacyAmounts: vi.fn(),
    reconciliacionGastoCount: vi.fn(),
    reconciliacionGastoAggregate: vi.fn(),
    reconciliacionGastoRecent: vi.fn(),
    reconciliacionVentaCount: vi.fn(),
    reconciliacionVentaAggregate: vi.fn(),
    reconciliacionVentaRecent: vi.fn(),
    reconciliacionServicioCount: vi.fn(),
    reconciliacionServicioAggregate: vi.fn(),
    reconciliacionServicioRecent: vi.fn(),
    queryRaw: vi.fn(),
  };

  calls.queryRaw.mockResolvedValue([{ count: salesPending }]);
  calls.ventaServicios.mockResolvedValue(0);
  calls.gastosDE.mockResolvedValue(0);
  calls.gastoCompra.mockResolvedValue(0);
  calls.pagosalario.mockResolvedValue(0);
  calls.compraServicio.mockResolvedValue(0);
  calls.reconciliacionGasto.mockResolvedValue([]);
  calls.reconciliacionGastoLegacyAmounts.mockResolvedValue([]);
  calls.reconciliacionGastoCount.mockResolvedValue(0);
  calls.reconciliacionGastoAggregate.mockResolvedValue({
    _sum: { montoConvertido: null },
  });
  calls.reconciliacionGastoRecent.mockResolvedValue([]);
  calls.reconciliacionVentaCount.mockResolvedValue(0);
  calls.reconciliacionVentaAggregate.mockResolvedValue({
    _sum: { montoConvertido: null },
  });
  calls.reconciliacionVentaRecent.mockResolvedValue([]);
  calls.reconciliacionServicioCount.mockResolvedValue(0);
  calls.reconciliacionServicioAggregate.mockResolvedValue({
    _sum: { montoConvertido: null },
  });
  calls.reconciliacionServicioRecent.mockResolvedValue([]);

  return {
    db: {
      $queryRaw: calls.queryRaw,
      ventaServicios: { count: calls.ventaServicios },
      gastosDE: { count: calls.gastosDE },
      gastoCompra: { count: calls.gastoCompra },
      pagosalario: { count: calls.pagosalario },
      compraServicio: { count: calls.compraServicio },
      reconciliacionGasto: {
        count: calls.reconciliacionGastoCount,
        aggregate: calls.reconciliacionGastoAggregate,
        findMany: (args) => {
          if ('select' in args && 'monto' in args.select) {
            return calls.reconciliacionGastoLegacyAmounts(args);
          }
          return 'select' in args
            ? calls.reconciliacionGasto(args)
            : calls.reconciliacionGastoRecent(args);
        },
      },
      reconciliacionVenta: {
        count: calls.reconciliacionVentaCount,
        aggregate: calls.reconciliacionVentaAggregate,
        findMany: calls.reconciliacionVentaRecent,
      },
      reconciliacionServicio: {
        count: calls.reconciliacionServicioCount,
        aggregate: calls.reconciliacionServicioAggregate,
        findMany: calls.reconciliacionServicioRecent,
      },
    },
    calls,
  };
}

describe('getReconciliationStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns zero-safe canonical fields for an empty tenant', async () => {
    const { db, calls } = makeDb();

    const snapshot = await getReconciliationStats({ tenantId: 'tenant-a', db });

    expect(snapshot).toEqual({
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
    });
    expect(Number.isFinite(snapshot.stats.efficiency)).toBe(true);
    expect(calls.queryRaw).toHaveBeenCalledTimes(1);
  });

  it('rejects an empty tenant before any database delegate is called', async () => {
    const { db, calls } = makeDb();

    await expect(getReconciliationStats({ tenantId: '  ', db })).rejects.toThrow(/tenant/i);

    expect(calls.queryRaw).not.toHaveBeenCalled();
    expect(calls.ventaServicios).not.toHaveBeenCalled();
    expect(calls.gastosDE).not.toHaveBeenCalled();
    expect(calls.gastoCompra).not.toHaveBeenCalled();
    expect(calls.pagosalario).not.toHaveBeenCalled();
    expect(calls.compraServicio).not.toHaveBeenCalled();
    expect(calls.reconciliacionGasto).not.toHaveBeenCalled();
  });

  it('uses tenant-scoped pending source counts and canonical totals', async () => {
    const { db, calls } = makeDb(2);
    calls.ventaServicios.mockImplementation(({ where }) =>
      Promise.resolve('costo' in where ? 6 : 3),
    );
    calls.gastosDE.mockResolvedValue(1);
    calls.gastoCompra.mockResolvedValue(4);
    calls.pagosalario.mockResolvedValue(2);
    calls.compraServicio.mockResolvedValue(5);
    calls.reconciliacionGasto.mockResolvedValue([
      { referenciaId: 'purchase-service-1', tipoGasto: 'servicio' },
      { referenciaId: 'service-sale-1', tipoGasto: 'venta_servicio' },
      { referenciaId: null, tipoGasto: 'servicio' },
    ]);

    const snapshot = await getReconciliationStats({ tenantId: 'tenant-a', db });

    expect(snapshot.modules).toEqual({
      ventas: { pending: 2, completedToday: 0, totalToday: 2 },
      servicios: { pending: 3, completedToday: 0, totalToday: 3 },
      gastos: { pending: 18, completedToday: 0, totalToday: 18 },
    });
    expect(snapshot.stats).toEqual({
      totalPending: 23,
      completedToday: 0,
      reconciledAmount: 0,
      efficiency: 0,
    });
  });

  it('keeps salary, purchase-service, and service-cost sources tenant-scoped', async () => {
    const { db, calls } = makeDb();
    calls.reconciliacionGasto.mockResolvedValue([]);

    await getReconciliationStats({ tenantId: 'tenant-a', db });

    expect(calls.pagosalario).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-a',
        ReconciliacionGasto: {
          none: {
            tenantId: 'tenant-a',
            estado: { in: ['PAGADA', 'PAGADO', 'POSTED'] },
          },
        },
      },
    });
    expect(calls.compraServicio).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a' },
    });
    expect(calls.ventaServicios).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a', costo: { gt: 0 } },
    });
    expect(calls.reconciliacionGasto).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-a',
        tipoGasto: { in: ['servicio', 'venta_servicio'] },
        estado: { in: ['PAGADA', 'PAGADO', 'POSTED'] },
      },
      select: { referenciaId: true, tipoGasto: true },
      distinct: ['referenciaId', 'tipoGasto'],
    });
  });

  it('scopes every negative reconciliation relation by the requested child tenant', async () => {
    const { db, calls } = makeDb();

    await getReconciliationStats({ tenantId: 'tenant-a', db });

    expect(calls.gastosDE.mock.calls[0][0].where).toMatchObject({
      reconciliaciones: {
        none: { tenantId: 'tenant-a', estado: { in: ['PAGADA', 'PAGADO', 'POSTED'] } },
      },
    });
    expect(calls.gastoCompra.mock.calls[0][0].where).toMatchObject({
      reconciliaciones: {
        none: { tenantId: 'tenant-a', estado: { in: ['PAGADA', 'PAGADO', 'POSTED'] } },
      },
    });
    expect(calls.pagosalario.mock.calls[0][0].where).toMatchObject({
      ReconciliacionGasto: {
        none: { tenantId: 'tenant-a', estado: { in: ['PAGADA', 'PAGADO', 'POSTED'] } },
      },
    });
  });

  it('uses active same-tenant non-deleted CxP predicates for both purchase sources', async () => {
    const { db, calls } = makeDb();

    await getReconciliationStats({ tenantId: 'tenant-a', db });

    const gastosDEWhere = calls.gastosDE.mock.calls[0][0].where;
    const gastoCompraWhere = calls.gastoCompra.mock.calls[0][0].where;
    const expectedNotActiveCxP = {
      is: {
        tenantId: 'tenant-a',
        deletedAt: null,
        estado: { in: ['PENDIENTE', 'PARCIAL'] },
      },
    };

    expect(gastosDEWhere).toMatchObject({
      tenantId: 'tenant-a',
      reconciliaciones: {
        none: { tenantId: 'tenant-a', estado: { in: ['PAGADA', 'PAGADO', 'POSTED'] } },
      },
      NOT: {
        cuentaPorPagar: {
          is: {
            tenantId: 'tenant-a',
            estado: { in: ['PENDIENTE', 'PARCIAL'] },
          },
        },
      },
    });
    expect(gastosDEWhere).not.toHaveProperty('deletedAt');
    expect(gastoCompraWhere).toMatchObject({
      tenantId: 'tenant-a',
      reconciliaciones: {
        none: { tenantId: 'tenant-a', estado: { in: ['PAGADA', 'PAGADO', 'POSTED'] } },
      },
      NOT: { cuentaPorPagar: expectedNotActiveCxP },
    });
    expect(gastoCompraWhere).toHaveProperty('deletedAt', null);
  });

  it('passes the persisted converted amount as the first pending-sales value', async () => {
    const { db, calls } = makeDb();

    await getReconciliationStats({ tenantId: 'tenant-a', db });

    const salesQuery = calls.queryRaw.mock.calls[0][0] as {
      strings: readonly string[];
    };
    expect(salesQuery.strings.join('')).toContain(
      'COALESCE(rv."montoConvertido", CASE',
    );
  });

  it('does not issue per-record queries for reconciled expense references', async () => {
    const { db, calls } = makeDb();
    calls.reconciliacionGasto.mockResolvedValue([
      { referenciaId: 'purchase-service-1', tipoGasto: 'servicio' },
      { referenciaId: 'purchase-service-2', tipoGasto: 'servicio' },
      { referenciaId: 'service-sale-1', tipoGasto: 'venta_servicio' },
    ]);

    await getReconciliationStats({ tenantId: 'tenant-a', db });

    expect(calls.reconciliacionGasto).toHaveBeenCalledTimes(1);
    expect(calls.reconciliacionGasto.mock.calls[0][0].where).toMatchObject({
      tenantId: 'tenant-a',
      estado: { in: ['PAGADA', 'PAGADO', 'POSTED'] },
    });
    expect(calls.compraServicio).toHaveBeenCalledTimes(1);
    expect(calls.ventaServicios).toHaveBeenCalledTimes(2);
  });

  it('keeps VentaServicios pending status driven by the source lifecycle flag', async () => {
    const { db, calls } = makeDb();

    await getReconciliationStats({ tenantId: 'tenant-a', db });

    expect(calls.ventaServicios).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a', NOT: { reconciliado: true } },
    });
    expect(calls.ventaServicios.mock.calls[0][0].where).not.toHaveProperty(
      'reconciliaciones',
    );
  });

  it('uses the local [todayStart, tomorrowStart) range from fechaReconciliacion', async () => {
    const { db, calls } = makeDb(2);
    const now = new Date(2026, 8, 4, 12, 0, 0);
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    calls.ventaServicios.mockImplementation(({ where }) =>
      Promise.resolve('costo' in where ? 2 : 3),
    );
    calls.gastosDE.mockResolvedValue(1);
    calls.gastoCompra.mockResolvedValue(1);
    calls.pagosalario.mockResolvedValue(1);
    calls.reconciliacionVentaCount.mockResolvedValueOnce(2);
    calls.reconciliacionVentaAggregate.mockResolvedValueOnce({
      _sum: { montoConvertido: 100 },
    });
    calls.reconciliacionVentaRecent.mockResolvedValueOnce([]);
    calls.reconciliacionServicioCount.mockResolvedValueOnce(3);
    calls.reconciliacionServicioAggregate.mockResolvedValueOnce({
      _sum: { montoConvertido: 50 },
    });
    calls.reconciliacionServicioRecent.mockResolvedValueOnce([]);
    calls.reconciliacionGasto.mockResolvedValueOnce([]);
    calls.reconciliacionGastoCount.mockResolvedValueOnce(1);
    calls.reconciliacionGastoAggregate.mockResolvedValueOnce({
      _sum: { montoConvertido: null },
    });
    calls.reconciliacionGastoRecent.mockResolvedValueOnce([]);

    const snapshot = await getReconciliationStats({ tenantId: 'tenant-a', now, db });

    expect(snapshot.modules).toEqual({
      ventas: { pending: 2, completedToday: 2, totalToday: 4 },
      servicios: { pending: 3, completedToday: 3, totalToday: 6 },
      gastos: { pending: 5, completedToday: 1, totalToday: 6 },
    });
    expect(snapshot.stats).toEqual({
      totalPending: 10,
      completedToday: 6,
      reconciledAmount: 150,
      efficiency: 38,
    });

    const expectedRange = { gte: todayStart, lt: tomorrowStart };
    expect(calls.reconciliacionVentaCount.mock.calls[0][0]).toEqual({
      where: {
        tenantId: 'tenant-a',
        fechaReconciliacion: expectedRange,
        ventaId: { not: null },
      },
    });
    expect(calls.reconciliacionServicioCount.mock.calls[0][0]).toEqual({
      where: { tenantId: 'tenant-a', fechaReconciliacion: expectedRange },
    });
    expect(calls.reconciliacionGastoCount.mock.calls[0][0]).toEqual({
      where: {
        tenantId: 'tenant-a',
        fechaReconciliacion: expectedRange,
        estado: { in: ['PAGADA', 'PAGADO', 'POSTED'] },
      },
    });
    expect(calls.reconciliacionVentaAggregate.mock.calls[0][0]).toEqual({
      where: {
        tenantId: 'tenant-a',
        fechaReconciliacion: expectedRange,
        ventaId: { not: null },
      },
      _sum: { montoConvertido: true },
    });
    expect(calls.reconciliacionServicioAggregate.mock.calls[0][0]).toEqual({
      where: { tenantId: 'tenant-a', fechaReconciliacion: expectedRange },
      _sum: { montoConvertido: true },
    });
    expect(calls.reconciliacionGastoAggregate.mock.calls[0][0]).toEqual({
      where: {
        tenantId: 'tenant-a',
        fechaReconciliacion: expectedRange,
        estado: { in: ['PAGADA', 'PAGADO', 'POSTED', 'PARCIAL'] },
      },
      _sum: { montoConvertido: true },
    });
  });

  it('includes the lower boundary but excludes tomorrow and ignores createdAt', async () => {
    const { db, calls } = makeDb();
    const now = new Date(2026, 8, 4, 12, 0, 0);
    calls.reconciliacionVentaCount.mockResolvedValueOnce(1);
    calls.reconciliacionVentaAggregate.mockResolvedValueOnce({
      _sum: { montoConvertido: null },
    });
    calls.reconciliacionVentaRecent.mockResolvedValueOnce([]);
    calls.reconciliacionServicioCount.mockResolvedValueOnce(1);
    calls.reconciliacionServicioAggregate.mockResolvedValueOnce({
      _sum: { montoConvertido: null },
    });
    calls.reconciliacionServicioRecent.mockResolvedValueOnce([]);
    calls.reconciliacionGasto.mockResolvedValueOnce([]);
    calls.reconciliacionGastoCount.mockResolvedValueOnce(1);
    calls.reconciliacionGastoAggregate.mockResolvedValueOnce({
      _sum: { montoConvertido: null },
    });
    calls.reconciliacionGastoRecent.mockResolvedValueOnce([]);

    await getReconciliationStats({ tenantId: 'tenant-a', now, db });

    const ventaCountWhere = calls.reconciliacionVentaCount.mock.calls;
    const ventaAggregateWhere = calls.reconciliacionVentaAggregate.mock.calls;
    expect(ventaCountWhere[0][0].where.fechaReconciliacion).toEqual({
      gte: new Date(2026, 8, 4, 0, 0, 0),
      lt: new Date(2026, 8, 5, 0, 0, 0),
    });
    expect(ventaAggregateWhere[0][0].where.fechaReconciliacion).toEqual(
      ventaCountWhere[0][0].where.fechaReconciliacion,
    );
    expect(calls.reconciliacionVentaRecent.mock.calls[0][0].orderBy).toEqual({
      fechaReconciliacion: 'desc',
    });
    expect(calls.reconciliacionVentaRecent.mock.calls[0][0].take).toBe(5);
  });

  it('merges all three activity types by business date and serializes fechaReconciliacion', async () => {
    const { db, calls } = makeDb();
    const now = new Date(2026, 8, 4, 12, 0, 0);
    const saleDate = new Date(2026, 8, 4, 1, 0, 0);
    const expenseDate = new Date(2026, 8, 4, 10, 0, 0);
    const serviceDate = new Date(2026, 8, 4, 14, 0, 0);

    calls.reconciliacionVentaCount.mockResolvedValueOnce(0);
    calls.reconciliacionVentaAggregate.mockResolvedValueOnce({
      _sum: { montoConvertido: null },
    });
    calls.reconciliacionVentaRecent.mockResolvedValueOnce([
      {
        reconciliacionId: 'sale-1',
        ventaId: 'sale-reference-1234',
        monto: 11,
        fechaReconciliacion: saleDate,
        createdAt: new Date(2026, 8, 4, 23, 0, 0),
        observaciones: null,
        cuentaBancaria: { nombreBanco: 'Sales bank' },
        venta: { ventaId: 'sale-reference-1234' },
      },
    ]);
    calls.reconciliacionServicioCount.mockResolvedValueOnce(0);
    calls.reconciliacionServicioAggregate.mockResolvedValueOnce({
      _sum: { montoConvertido: null },
    });
    calls.reconciliacionServicioRecent.mockResolvedValueOnce([
      {
        reconciliacionId: 'service-1',
        ventaServicioId: 'service-reference-1234',
        monto: 22,
        fechaReconciliacion: serviceDate,
        createdAt: new Date(2026, 8, 3, 23, 0, 0),
        observaciones: null,
        cuentaBancaria: { nombreBanco: 'Services bank' },
        ventasServicio: { ventaServicioId: 'service-reference-1234' },
      },
    ]);
    calls.reconciliacionGasto.mockResolvedValueOnce([]);
    calls.reconciliacionGastoCount.mockResolvedValueOnce(0);
    calls.reconciliacionGastoAggregate.mockResolvedValueOnce({
      _sum: { montoConvertido: null },
    });
    calls.reconciliacionGastoRecent.mockResolvedValueOnce([
      {
        reconciliacionId: 'expense-1',
        monto: 33,
        fechaReconciliacion: expenseDate,
        createdAt: new Date(2026, 8, 4, 2, 0, 0),
        observaciones: null,
        descripcion: 'Office expense',
        estado: 'PAGADA',
        cuentaBancaria: { nombreBanco: 'Expense bank' },
      },
    ]);

    const snapshot = await getReconciliationStats({ tenantId: 'tenant-a', now, db });

    expect(snapshot.recentActivity).toEqual([
      {
        id: 'service-1',
        type: 'servicio',
        reference: 'Servicio #service-...',
        description: 'Servicio reconciliado',
        accountName: 'Services bank',
        amount: 22,
        date: serviceDate.toISOString(),
      },
      {
        id: 'expense-1',
        type: 'gasto',
        reference: 'Gasto',
        description: 'Gasto reconciliado',
        accountName: 'Expense bank',
        amount: 33,
        date: expenseDate.toISOString(),
      },
      {
        id: 'sale-1',
        type: 'venta',
        reference: 'Venta #sale-ref...',
        description: 'Venta reconciliada',
        accountName: 'Sales bank',
        amount: 11,
        date: saleDate.toISOString(),
      },
    ]);
    expect(calls.reconciliacionVentaRecent.mock.calls[0][0]).toMatchObject({
      where: { tenantId: 'tenant-a' },
      take: 5,
      orderBy: { fechaReconciliacion: 'desc' },
    });
    expect(calls.reconciliacionServicioRecent.mock.calls[0][0]).toMatchObject({
      where: { tenantId: 'tenant-a' },
      take: 5,
      orderBy: { fechaReconciliacion: 'desc' },
    });
    expect(calls.reconciliacionGastoRecent.mock.calls[0][0]).toMatchObject({
      where: { tenantId: 'tenant-a' },
      take: 5,
      orderBy: { fechaReconciliacion: 'desc' },
    });
    expect(snapshot.recentActivity[0].date).not.toBe(
      new Date(2026, 8, 3, 23, 0, 0).toISOString(),
    );
  });

  it('includes only posted expense reconciliations in daily metrics and activity', async () => {
    const { db, calls } = makeDb();
    const today = new Date(2026, 8, 4, 12, 0, 0);
    const expenseRows = [
      {
        reconciliacionId: 'posted-expense',
        estado: 'PAGADA',
        monto: 10,
        montoConvertido: 10,
        fechaReconciliacion: new Date(2026, 8, 4, 10, 0, 0),
        createdAt: new Date(2026, 8, 4, 10, 0, 0),
        observaciones: null,
        descripcion: 'Posted expense',
        cuentaBancaria: { nombreBanco: 'Expense bank' },
      },
      {
        reconciliacionId: 'pending-expense',
        estado: 'PENDIENTE',
        monto: 20,
        montoConvertido: 20,
        fechaReconciliacion: new Date(2026, 8, 4, 11, 0, 0),
        createdAt: new Date(2026, 8, 4, 11, 0, 0),
        observaciones: null,
        descripcion: 'Pending expense',
        cuentaBancaria: { nombreBanco: 'Expense bank' },
      },
      {
        reconciliacionId: 'partial-expense',
        estado: 'PARCIAL',
        monto: 20,
        montoConvertido: 20,
        fechaReconciliacion: new Date(2026, 8, 4, 11, 0, 0),
        createdAt: new Date(2026, 8, 4, 11, 0, 0),
        observaciones: null,
        descripcion: 'Partial expense payment',
        cuentaBancaria: { nombreBanco: 'Expense bank' },
      },
      {
        reconciliacionId: 'voided-expense',
        estado: 'ANULADA',
        monto: 30,
        montoConvertido: 30,
        fechaReconciliacion: new Date(2026, 8, 4, 12, 0, 0),
        createdAt: new Date(2026, 8, 4, 12, 0, 0),
        observaciones: null,
        descripcion: 'Voided expense',
        cuentaBancaria: { nombreBanco: 'Expense bank' },
      },
      {
        reconciliacionId: 'cancelled-expense',
        estado: 'CANCELADA',
        monto: 40,
        montoConvertido: 40,
        fechaReconciliacion: new Date(2026, 8, 4, 13, 0, 0),
        createdAt: new Date(2026, 8, 4, 13, 0, 0),
        observaciones: null,
        descripcion: 'Cancelled expense',
        cuentaBancaria: { nombreBanco: 'Expense bank' },
      },
    ];
    const appliedStates = ['PAGADA', 'PAGADO', 'POSTED', 'PARCIAL'];
    const settledStates = ['PAGADA', 'PAGADO', 'POSTED'];
    const getRowsForWhere = (where: Record<string, unknown>) => {
      const stateFilter = where.estado as { in?: string[] } | undefined;
      return stateFilter
        ? expenseRows.filter((row) => stateFilter.in?.includes(row.estado))
        : expenseRows;
    };

    calls.reconciliacionGastoCount.mockImplementation(({ where }) =>
      Promise.resolve(getRowsForWhere(where).length),
    );
    calls.reconciliacionGastoAggregate.mockImplementation(({ where }) =>
      Promise.resolve({
        _sum: {
          montoConvertido: getRowsForWhere(where).reduce(
            (total, row) => total + row.montoConvertido,
            0,
          ),
        },
      }),
    );
    calls.reconciliacionGastoRecent.mockImplementation(({ where }) =>
      Promise.resolve(getRowsForWhere(where)),
    );

    const snapshot = await getReconciliationStats({ tenantId: 'tenant-a', now: today, db });

    expect(snapshot.modules.gastos.completedToday).toBe(1);
    expect(snapshot.stats.reconciledAmount).toBe(30);
    expect(snapshot.recentActivity).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'posted-expense', type: 'gasto', amount: 10 }),
        expect.objectContaining({ id: 'partial-expense', type: 'gasto', amount: 20 }),
      ]),
    );

    const expectedWhere = {
      tenantId: 'tenant-a',
      fechaReconciliacion: {
        gte: new Date(2026, 8, 4, 0, 0, 0),
        lt: new Date(2026, 8, 5, 0, 0, 0),
      },
      estado: { in: settledStates },
    };
    expect(calls.reconciliacionGastoCount).toHaveBeenCalledWith({ where: expectedWhere });
    expect(calls.reconciliacionGastoAggregate).toHaveBeenCalledWith({
      where: { ...expectedWhere, estado: { in: appliedStates } },
      _sum: { montoConvertido: true },
    });
    expect(calls.reconciliacionGastoRecent).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-a', estado: { in: appliedStates } },
      }),
    );
  });

  it('uses the persisted converted activity amount and falls back when it is null', async () => {
    const { db, calls } = makeDb();
    const activityDate = new Date(2026, 8, 4, 10, 0, 0);

    calls.reconciliacionVentaRecent.mockResolvedValueOnce([
      {
        reconciliacionId: 'foreign-sale',
        ventaId: 'foreign-sale-reference',
        monto: 100,
        montoConvertido: 250,
        fechaReconciliacion: activityDate,
        createdAt: activityDate,
        observaciones: null,
        cuentaBancaria: { nombreBanco: 'Foreign bank' },
        venta: { ventaId: 'foreign-sale-reference' },
      },
      {
        reconciliacionId: 'legacy-sale',
        ventaId: 'legacy-sale-reference',
        monto: 80,
        montoConvertido: null,
        fechaReconciliacion: new Date(2026, 8, 4, 9, 0, 0),
        createdAt: new Date(2026, 8, 4, 9, 0, 0),
        observaciones: null,
        cuentaBancaria: { nombreBanco: 'Legacy bank' },
        venta: { ventaId: 'legacy-sale-reference' },
      },
    ]);

    const snapshot = await getReconciliationStats({ tenantId: 'tenant-a', db });

    expect(snapshot.recentActivity).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'foreign-sale', amount: 250 }),
        expect.objectContaining({ id: 'legacy-sale', amount: 80 }),
      ]),
    );
  });

  it('includes legacy expense FX amounts when montoConvertido is null', async () => {
    const { db, calls } = makeDb();
    calls.reconciliacionGastoAggregate.mockResolvedValueOnce({
      _sum: { montoConvertido: 30 },
    });
    calls.reconciliacionGastoLegacyAmounts.mockResolvedValueOnce([
      { monto: 10, tasaCambio: 24.5 },
      { monto: 5, tasaCambio: null },
    ]);

    const snapshot = await getReconciliationStats({ tenantId: 'tenant-a', db });

    expect(snapshot.stats.reconciledAmount).toBe(280);
    expect(calls.reconciliacionGastoLegacyAmounts).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-a',
        fechaReconciliacion: {
          gte: expect.any(Date),
          lt: expect.any(Date),
        },
        estado: { in: ['PAGADA', 'PAGADO', 'POSTED', 'PARCIAL'] },
        montoConvertido: null,
      },
      select: { monto: true, tasaCambio: true },
    });
  });

  it('counts and classifies only ReconciliacionVenta rows linked to a genuine sale', async () => {
    const { db, calls } = makeDb();
    const today = new Date(2026, 8, 4, 12, 0, 0);
    const saleDate = new Date(2026, 8, 4, 10, 0, 0);

    calls.reconciliacionVentaCount.mockImplementation(({ where }) =>
      Promise.resolve(where.ventaId ? 1 : 2),
    );
    calls.reconciliacionVentaAggregate.mockImplementation(({ where }) =>
      Promise.resolve({ _sum: { montoConvertido: where.ventaId ? 100 : 300 } }),
    );
    calls.reconciliacionVentaRecent.mockResolvedValueOnce([
      {
        reconciliacionId: 'loan-payment',
        ventaId: null,
        monto: 200,
        montoConvertido: 200,
        fechaReconciliacion: new Date(2026, 8, 4, 11, 0, 0),
        createdAt: new Date(2026, 8, 4, 11, 0, 0),
        observaciones: null,
        cuentaBancaria: { nombreBanco: 'Loan bank' },
        venta: null,
      },
      {
        reconciliacionId: 'genuine-sale',
        ventaId: 'sale-reference',
        monto: 100,
        montoConvertido: 100,
        fechaReconciliacion: saleDate,
        createdAt: saleDate,
        observaciones: null,
        cuentaBancaria: { nombreBanco: 'Sales bank' },
        venta: { ventaId: 'sale-reference' },
      },
    ]);

    const snapshot = await getReconciliationStats({ tenantId: 'tenant-a', now: today, db });

    expect(snapshot.stats.completedToday).toBe(1);
    expect(snapshot.stats.reconciledAmount).toBe(100);
    expect(snapshot.recentActivity).toEqual([
      expect.objectContaining({ id: 'genuine-sale', type: 'venta', amount: 100 }),
    ]);
    expect(calls.reconciliacionVentaCount).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-a',
        fechaReconciliacion: {
          gte: new Date(2026, 8, 4, 0, 0, 0),
          lt: new Date(2026, 8, 5, 0, 0, 0),
        },
        ventaId: { not: null },
      },
    });
    expect(calls.reconciliacionVentaAggregate).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-a',
        fechaReconciliacion: {
          gte: new Date(2026, 8, 4, 0, 0, 0),
          lt: new Date(2026, 8, 5, 0, 0, 0),
        },
        ventaId: { not: null },
      },
      _sum: { montoConvertido: true },
    });
    expect(calls.reconciliacionVentaRecent).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-a', ventaId: { not: null } },
      }),
    );
  });
});
