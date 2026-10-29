import { Prisma } from '@/generated/prisma';
import prisma from '@/lib/prisma';

import { buildPendingSalesCountQuery } from './reconciliation-stats-query';

export interface ReconciliationModuleStats {
  pending: number;
  completedToday: number;
  totalToday: number;
}

export interface ReconciliationActivity {
  id: string;
  type: 'venta' | 'servicio' | 'gasto';
  reference: string;
  description: string;
  accountName: string;
  amount: number;
  date: string;
}

export interface ReconciliationStatsSnapshot {
  modules: {
    ventas: ReconciliationModuleStats;
    servicios: ReconciliationModuleStats;
    gastos: ReconciliationModuleStats;
  };
  stats: {
    totalPending: number;
    completedToday: number;
    reconciledAmount: number;
    efficiency: number;
  };
  recentActivity: ReconciliationActivity[];
}

type CountArgs = { where: Record<string, unknown> };
type CountDelegate = { count(args: CountArgs): Promise<number> };
type DateRange = { gte: Date; lt: Date };
type NumericValue = number | bigint | string | null;

interface AggregateDelegate {
  aggregate(args: {
    where: Record<string, unknown>;
    _sum: { montoConvertido: true };
  }): Promise<{ _sum: { montoConvertido: NumericValue } }>;
}

interface RecentFindManyArgs {
  where: Record<string, unknown>;
  take: 5;
  orderBy: { fechaReconciliacion: 'desc' };
  include: Record<string, unknown>;
}

interface ReconciliationBaseActivityRow {
  reconciliacionId: string;
  monto: NumericValue;
  montoConvertido: NumericValue;
  fechaReconciliacion: Date;
  createdAt: Date;
  observaciones: string | null;
  cuentaBancaria: { nombreBanco: string } | null;
}

interface ReconciliationVentaActivityRow extends ReconciliationBaseActivityRow {
  ventaId: string | null;
  venta: { ventaId: string } | null;
}

interface ReconciliationServicioActivityRow extends ReconciliationBaseActivityRow {
  ventaServicioId: string;
  ventasServicio: { ventaServicioId: string } | null;
}

interface ReconciliationGastoActivityRow extends ReconciliationBaseActivityRow {
  descripcion: string;
  estado: string | null;
}

interface ReconciledExpenseReference {
  referenciaId: string | null;
  tipoGasto: string;
}

interface ExpenseReferenceFindManyArgs {
  where: Record<string, unknown>;
  select: { referenciaId: true; tipoGasto: true };
  distinct: string[];
}

interface LegacyExpenseAmountFindManyArgs {
  where: Record<string, unknown>;
  select: { monto: true; tasaCambio: true };
}

interface LegacyExpenseAmountRow {
  monto: NumericValue;
  tasaCambio: NumericValue;
}

interface ReconciliationGastoDelegate extends CountDelegate, AggregateDelegate {
  findMany(args: ExpenseReferenceFindManyArgs): Promise<ReconciledExpenseReference[]>;
  findMany(args: LegacyExpenseAmountFindManyArgs): Promise<LegacyExpenseAmountRow[]>;
  findMany(args: RecentFindManyArgs): Promise<ReconciliationGastoActivityRow[]>;
}

interface ReconciliationVentaDelegate extends CountDelegate, AggregateDelegate {
  findMany(args: RecentFindManyArgs): Promise<ReconciliationVentaActivityRow[]>;
}

interface ReconciliationServicioDelegate extends CountDelegate, AggregateDelegate {
  findMany(args: RecentFindManyArgs): Promise<ReconciliationServicioActivityRow[]>;
}

export interface ReconciliationStatsDb {
  $queryRaw<T>(query: Prisma.Sql): Promise<T>;
  ventaServicios: CountDelegate;
  gastosDE: CountDelegate;
  gastoCompra: CountDelegate;
  pagosalario: CountDelegate;
  compraServicio: CountDelegate;
  reconciliacionVenta: ReconciliationVentaDelegate;
  reconciliacionServicio: ReconciliationServicioDelegate;
  reconciliacionGasto: ReconciliationGastoDelegate;
}

export interface GetReconciliationStatsInput {
  tenantId: string;
  now?: Date;
  db?: ReconciliationStatsDb;
}

const ACTIVE_CXP_STATES = ['PENDIENTE', 'PARCIAL'] as const;
const EXPENSE_RECONCILIATION_TYPES = ['servicio', 'venta_servicio'] as const;
const SETTLED_EXPENSE_RECONCILIATION_STATES = ['PAGADA', 'PAGADO', 'POSTED'] as const;
const APPLIED_EXPENSE_RECONCILIATION_STATES = [
  ...SETTLED_EXPENSE_RECONCILIATION_STATES,
  'PARCIAL',
] as const;

/**
 * @description Builds the active, tenant-owned CxP relation exclusion for purchases.
 * @param {string} tenantId - Tenant that must own the payable account.
 * @returns {object} Prisma-compatible relation predicate.
 */
function buildActiveCxPExclusion(tenantId: string): Record<string, unknown> {
  return {
    is: {
      tenantId,
      deletedAt: null,
      estado: { in: [...ACTIVE_CXP_STATES] },
    },
  };
}

/**
 * @description Builds the pending predicate shared by purchase-expense sources.
 * @param {string} tenantId - Tenant whose expense records are counted.
 * @returns {Record<string, unknown>} Tenant-safe pending expense predicate.
 */
function buildPurchaseExpenseWhere(tenantId: string): Record<string, unknown> {
  return {
    tenantId,
    reconciliaciones: {
      none: {
        tenantId,
        estado: { in: [...SETTLED_EXPENSE_RECONCILIATION_STATES] },
      },
    },
    NOT: { cuentaPorPagar: buildActiveCxPExclusion(tenantId) },
  };
}

/**
 * @description Builds the pending predicate for non-deleted purchase expenses.
 * @param {string} tenantId - Tenant whose purchase expenses are counted.
 * @returns {Record<string, unknown>} Tenant-scoped pending purchase predicate.
 */
function buildGastoCompraWhere(tenantId: string): Record<string, unknown> {
  return {
    ...buildPurchaseExpenseWhere(tenantId),
    deletedAt: null,
  };
}

/**
 * @description Removes null and blank reconciliation references without mutating input rows.
 * @param {Array<{ referenciaId: string | null; tipoGasto: string }>} rows -
 *   Batched reconciliation references.
 * @param {string} tipoGasto - Expense source type to retain.
 * @returns {string[]} Unique source identifiers already reconciled for that type.
 */
function getReconciledReferences(
  rows: Array<{ referenciaId: string | null; tipoGasto: string }>,
  tipoGasto: string,
): string[] {
  return Array.from(
    new Set(
      rows
        .filter((row) => row.tipoGasto === tipoGasto)
        .map((row) => row.referenciaId?.trim() ?? '')
        .filter((reference): reference is string => reference.length > 0),
    ),
  );
}

/**
 * @description Adds a not-in source filter only when reconciled identifiers exist.
 * @param {string} tenantId - Tenant whose source records are counted.
 * @param {string} field - Source identifier field.
 * @param {string[]} references - Reconciled source identifiers.
 * @returns {Record<string, unknown>} Tenant-scoped count predicate.
 */
function buildSourceCountWhere(
  tenantId: string,
  field: string,
  references: string[],
): Record<string, unknown> {
  return {
    tenantId,
    ...(references.length > 0 ? { [field]: { notIn: [...references] } } : {}),
  };
}

/**
 * @description Converts a database count value into a safe non-negative integer.
 * @param {number | bigint | string | null | undefined} value - Raw count value.
 * @returns {number} Finite non-negative count.
 */
function normalizeCount(value: number | bigint | string | null | undefined): number {
  const count = Number(value ?? 0);
  return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
}

/**
 * @description Builds the local half-open day range without mutating the injected date.
 * @param {Date} now - Current instant used as the local-day reference.
 * @returns {DateRange} Inclusive start and exclusive next-day boundary.
 */
function buildTodayRange(now: Date): DateRange {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  return { gte: todayStart, lt: tomorrowStart };
}

/**
 * @description Converts nullable database amounts into finite numbers.
 * @param {NumericValue | undefined} value - Database amount or aggregate value.
 * @returns {number} Finite numeric amount, defaulting null and invalid values to zero.
 */
function normalizeAmount(value: NumericValue | undefined): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

/**
 * @description Creates the shared date-filtered reconciliation query predicate.
 * @param {string} tenantId - Tenant whose reconciliation rows are eligible.
 * @param {DateRange} todayRange - Existing server-local day range.
 * @returns {Record<string, unknown>} Tenant and business-date filter.
 */
function buildReconciliationWhere(
  tenantId: string,
  todayRange: DateRange,
): Record<string, unknown> {
  return { tenantId, fechaReconciliacion: todayRange };
}

/**
 * @description Builds the bounded recent-row query shared by all reconciliation types.
 * @param {string} tenantId - Tenant whose activity is requested.
 * @param {Record<string, unknown>} include - Relations needed by the activity mapper.
 * @param {Record<string, unknown>} additionalWhere - Additional activity eligibility filters.
 * @returns {RecentFindManyArgs} Tenant-safe date-ordered activity query.
 */
function buildRecentActivityArgs(
  tenantId: string,
  include: Record<string, unknown>,
  additionalWhere: Record<string, unknown> = {},
): RecentFindManyArgs {
  return {
    where: { tenantId, ...additionalWhere },
    take: 5,
    orderBy: { fechaReconciliacion: 'desc' },
    include,
  };
}

/**
 * @description Builds the date-filtered predicate for genuine sale reconciliations only.
 * @param {string} tenantId - Tenant whose sale reconciliations are eligible.
 * @param {DateRange} todayRange - Existing server-local day range.
 * @returns {Record<string, unknown>} Tenant, business-date, and sale-link filter.
 */
function buildReconciliationVentaWhere(
  tenantId: string,
  todayRange: DateRange,
): Record<string, unknown> {
  return {
    ...buildReconciliationWhere(tenantId, todayRange),
    ventaId: { not: null },
  };
}

/**
 * @description Builds the date-filtered predicate for applied expense reconciliations.
 * @param {string} tenantId - Tenant whose expense reconciliations are eligible.
 * @param {DateRange} todayRange - Existing server-local day range.
 * @returns {Record<string, unknown>} Tenant, business-date, and applied-state filter.
 */
function buildSettledExpenseReconciliationWhere(
  tenantId: string,
  todayRange: DateRange,
): Record<string, unknown> {
  return {
    ...buildReconciliationWhere(tenantId, todayRange),
    estado: { in: [...SETTLED_EXPENSE_RECONCILIATION_STATES] },
  };
}

/**
 * @description Identifies expense reconciliation rows that represent a posted payment.
 * @param {string | null} estado - Persisted reconciliation status.
 * @returns {boolean} Whether the status is a supported posted legacy value.
 */
function isAppliedExpenseReconciliationState(estado: string | null): boolean {
  return (
    estado !== null &&
    (APPLIED_EXPENSE_RECONCILIATION_STATES as readonly string[]).includes(estado)
  );
}

/**
 * @description Maps a sale reconciliation row to the transport-agnostic activity shape.
 * @param {ReconciliationVentaActivityRow} row - Sale reconciliation row.
 * @returns {ReconciliationActivity} Normalized sale activity.
 */
function mapVentaActivity(row: ReconciliationVentaActivityRow): ReconciliationActivity {
  return {
    id: row.reconciliacionId,
    type: 'venta',
    reference: `Venta #${row.venta?.ventaId?.slice(0, 8)}...`,
    description: 'Venta reconciliada',
    accountName: row.cuentaBancaria?.nombreBanco ?? 'Sin cuenta',
    amount: normalizeAmount(row.montoConvertido ?? row.monto),
    date: row.fechaReconciliacion.toISOString(),
  };
}

/**
 * @description Maps a service reconciliation row to the transport-agnostic activity shape.
 * @param {ReconciliationServicioActivityRow} row - Service reconciliation row.
 * @returns {ReconciliationActivity} Normalized service activity.
 */
function mapServicioActivity(row: ReconciliationServicioActivityRow): ReconciliationActivity {
  return {
    id: row.reconciliacionId,
    type: 'servicio',
    reference: `Servicio #${row.ventasServicio?.ventaServicioId?.slice(0, 8)}...`,
    description: 'Servicio reconciliado',
    accountName: row.cuentaBancaria?.nombreBanco ?? 'Sin cuenta',
    amount: normalizeAmount(row.montoConvertido ?? row.monto),
    date: row.fechaReconciliacion.toISOString(),
  };
}

/**
 * @description Maps an expense reconciliation row to the transport-agnostic activity shape.
 * @param {ReconciliationGastoActivityRow} row - Expense reconciliation row.
 * @returns {ReconciliationActivity} Normalized expense activity.
 */
function mapGastoActivity(row: ReconciliationGastoActivityRow): ReconciliationActivity {
  return {
    id: row.reconciliacionId,
    type: 'gasto',
    reference: 'Gasto',
    description: 'Gasto reconciliado',
    accountName: row.cuentaBancaria?.nombreBanco ?? 'Multi-cuenta',
    amount: normalizeAmount(row.montoConvertido ?? row.monto),
    date: row.fechaReconciliacion.toISOString(),
  };
}

/**
 * @description Merges bounded activity batches by business date and caps the result.
 * @param {ReconciliationActivity[]} activities - Activity rows from all modules.
 * @returns {ReconciliationActivity[]} Five most recent activities.
 */
function mergeRecentActivity(activities: ReconciliationActivity[]): ReconciliationActivity[] {
  return [...activities]
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
    .slice(0, 5);
}

/**
 * @description Validates the required service tenant boundary.
 * @param {string} tenantId - Tenant identifier supplied by an authenticated adapter.
 * @returns {void}
 * @throws {Error} When the identifier is empty.
 */
function assertTenantId(tenantId: string): void {
  if (tenantId.trim().length === 0) {
    throw new Error('tenantId is required');
  }
}

/**
 * @description Calculates the canonical snapshot from pending source counts.
 * @param {object} counts - Pending counts by reconciliation source.
 * @returns {ReconciliationStatsSnapshot} Transport-agnostic canonical snapshot.
 */
function buildSnapshot(counts: {
  ventas: number;
  servicios: number;
  gastosDE: number;
  gastoCompra: number;
  salarios: number;
  compraServicio: number;
  ventaServiciosCost: number;
  ventasCompletedToday: number;
  serviciosCompletedToday: number;
  gastosCompletedToday: number;
  reconciledAmount: number;
  recentActivity: ReconciliationActivity[];
}): ReconciliationStatsSnapshot {
  const gastosPending =
    counts.gastosDE +
    counts.gastoCompra +
    counts.salarios +
    counts.compraServicio +
    counts.ventaServiciosCost;
  const totalPending = counts.ventas + counts.servicios + gastosPending;
  const completedToday =
    counts.ventasCompletedToday + counts.serviciosCompletedToday + counts.gastosCompletedToday;
  const denominator = completedToday + totalPending;

  return {
    modules: {
      ventas: {
        pending: counts.ventas,
        completedToday: counts.ventasCompletedToday,
        totalToday: counts.ventas + counts.ventasCompletedToday,
      },
      servicios: {
        pending: counts.servicios,
        completedToday: counts.serviciosCompletedToday,
        totalToday: counts.servicios + counts.serviciosCompletedToday,
      },
      gastos: {
        pending: gastosPending,
        completedToday: counts.gastosCompletedToday,
        totalToday: gastosPending + counts.gastosCompletedToday,
      },
    },
    stats: {
      totalPending,
      completedToday,
      reconciledAmount: counts.reconciledAmount,
      efficiency: denominator > 0 ? Math.round((completedToday / denominator) * 100) : 0,
    },
    recentActivity: counts.recentActivity,
  };
}

/**
 * @description Retrieves tenant-safe pending reconciliation statistics.
 * @param {GetReconciliationStatsInput} input - Tenant and optional deterministic dependencies.
 * @returns {Promise<ReconciliationStatsSnapshot>} Canonical statistics snapshot.
 */
export async function getReconciliationStats({
  tenantId,
  now = new Date(),
  db,
}: GetReconciliationStatsInput): Promise<ReconciliationStatsSnapshot> {
  assertTenantId(tenantId);
  const todayRange = buildTodayRange(now);
  const salesTodayWhere = buildReconciliationVentaWhere(tenantId, todayRange);
  const settledExpensesTodayWhere = buildSettledExpenseReconciliationWhere(
    tenantId,
    todayRange,
  );
  const appliedExpensesTodayWhere = {
    ...buildReconciliationWhere(tenantId, todayRange),
    estado: { in: [...APPLIED_EXPENSE_RECONCILIATION_STATES] },
  };
  const database = db ?? (prisma as unknown as ReconciliationStatsDb);
  const reconciledExpenseReferences = (await database.reconciliacionGasto.findMany({
    where: {
      tenantId,
      tipoGasto: { in: [...EXPENSE_RECONCILIATION_TYPES] },
      estado: { in: [...SETTLED_EXPENSE_RECONCILIATION_STATES] },
    },
    select: { referenciaId: true, tipoGasto: true },
    distinct: ['referenciaId', 'tipoGasto'],
  })) as ReconciledExpenseReference[];
  const compraServicioReferences = getReconciledReferences(
    reconciledExpenseReferences,
    'servicio',
  );
  const ventaServiciosCostReferences = getReconciledReferences(
    reconciledExpenseReferences,
    'venta_servicio',
  );

  const [
    ventas,
    servicios,
    gastosDE,
    gastoCompra,
    salarios,
    compraServicio,
    ventaServiciosCost,
    ventasCompletedToday,
    serviciosCompletedToday,
    gastosCompletedToday,
    ventasAggregate,
    serviciosAggregate,
    gastosAggregate,
    lastGastosLegacyAmounts,
    lastVentas,
    lastServicios,
    lastGastos,
  ] = await Promise.all([
    database.$queryRaw<Array<{ count: number | bigint | string }>>(
      buildPendingSalesCountQuery(tenantId),
    ).then((rows) => normalizeCount(rows[0]?.count)),
    database.ventaServicios.count({
      where: { tenantId, NOT: { reconciliado: true } },
    }),
    database.gastosDE.count({ where: buildPurchaseExpenseWhere(tenantId) }),
    database.gastoCompra.count({ where: buildGastoCompraWhere(tenantId) }),
    database.pagosalario.count({
      where: {
        tenantId,
        ReconciliacionGasto: {
          none: {
            tenantId,
            estado: { in: [...SETTLED_EXPENSE_RECONCILIATION_STATES] },
          },
        },
      },
    }),
    database.compraServicio.count({
      where: buildSourceCountWhere(tenantId, 'compraServicioId', compraServicioReferences),
    }),
    database.ventaServicios.count({
      where: {
        ...buildSourceCountWhere(
          tenantId,
          'ventaServicioId',
          ventaServiciosCostReferences,
        ),
        costo: { gt: 0 },
      },
    }),
    database.reconciliacionVenta.count({
      where: salesTodayWhere,
    }),
    database.reconciliacionServicio.count({
      where: buildReconciliationWhere(tenantId, todayRange),
    }),
    database.reconciliacionGasto.count({
      where: settledExpensesTodayWhere,
    }),
    database.reconciliacionVenta.aggregate({
      where: salesTodayWhere,
      _sum: { montoConvertido: true },
    }),
    database.reconciliacionServicio.aggregate({
      where: buildReconciliationWhere(tenantId, todayRange),
      _sum: { montoConvertido: true },
    }),
    database.reconciliacionGasto.aggregate({
      where: appliedExpensesTodayWhere,
      _sum: { montoConvertido: true },
    }),
    database.reconciliacionGasto.findMany({
      where: {
        ...appliedExpensesTodayWhere,
        montoConvertido: null,
      },
      select: { monto: true, tasaCambio: true },
    }),
    database.reconciliacionVenta.findMany(
      buildRecentActivityArgs(tenantId, {
        venta: { select: { ventaId: true } },
        cuentaBancaria: { select: { nombreBanco: true } },
      }, { ventaId: { not: null } }),
    ),
    database.reconciliacionServicio.findMany(
      buildRecentActivityArgs(tenantId, {
        ventasServicio: { select: { ventaServicioId: true } },
        cuentaBancaria: { select: { nombreBanco: true } },
      }),
    ),
    database.reconciliacionGasto.findMany(
      buildRecentActivityArgs(tenantId, {
        cuentaBancaria: { select: { nombreBanco: true } },
      }, { estado: { in: [...APPLIED_EXPENSE_RECONCILIATION_STATES] } }),
    ),
  ]);

  const recentActivity = mergeRecentActivity([
    ...lastVentas
      .filter((row) => row.ventaId !== null && row.ventaId !== undefined)
      .map(mapVentaActivity),
    ...lastServicios.map(mapServicioActivity),
    ...(lastGastos as ReconciliationGastoActivityRow[])
      .filter((row) => isAppliedExpenseReconciliationState(row.estado))
      .map(mapGastoActivity),
  ]);

  return buildSnapshot({
    ventas: normalizeCount(ventas),
    servicios: normalizeCount(servicios),
    gastosDE: normalizeCount(gastosDE),
    gastoCompra: normalizeCount(gastoCompra),
    salarios: normalizeCount(salarios),
    compraServicio: normalizeCount(compraServicio),
    ventaServiciosCost: normalizeCount(ventaServiciosCost),
    ventasCompletedToday: normalizeCount(ventasCompletedToday),
    serviciosCompletedToday: normalizeCount(serviciosCompletedToday),
    gastosCompletedToday: normalizeCount(gastosCompletedToday),
    reconciledAmount:
      normalizeAmount(ventasAggregate._sum.montoConvertido) +
      normalizeAmount(serviciosAggregate._sum.montoConvertido) +
      normalizeAmount(gastosAggregate._sum.montoConvertido) +
      lastGastosLegacyAmounts.reduce((total, row) => {
        const amount = normalizeAmount(row.monto);
        const rate = normalizeAmount(row.tasaCambio);
        return total + (rate > 0 ? amount * rate : amount);
      }, 0),
    recentActivity,
  });
}
