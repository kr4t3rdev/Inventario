import { normalizeAccountingAmount } from '@/features/contabilidad/domain/accounting-amount';
import {
  calculateReconciledResult,
  getYearRangeInTimeZone,
  type ExpenseResultMovement,
  type FinancialResultMovement,
  type OpeningRecognition,
  type ReconciledPeriodResult,
  type ReconciledResultMovement,
} from '@/features/contabilidad/domain/reconciled-result-calculator';
import {
  classifyLegacyReconciliation,
  type ReconciliationKind,
} from '@/features/contabilidad/domain/reconciliation-policy';
import { getRequiredTenantAccountingPolicy } from './tenant-accounting-policy-service';
import {
  calcularDetalleCostoVenta,
  type VentaParaCosto,
} from '@/features/contabilidad/utils/venta-costo';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma';
import { ACCOUNTING_TIME_ZONE } from '@/lib/services/fecha-operacion-registry';
import { isStrictFxReader } from '@/features/contabilidad/config/fx-strict-readers';

const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

interface PersistedAccountingAmount {
  reconciliacionId: string;
  monto: unknown;
  moneda: string;
  montoConvertido: unknown;
  tasaCambio: unknown;
  fechaReconciliacion: Date;
  rateEffectiveAt?: Date | null;
}

interface ReadIncident {
  code: string;
  movementId: string;
  affectedAmount: number;
}

const FINANCIAL_KINDS = new Set<ReconciliationKind>([
  'CASH_LOAN_DISBURSEMENT',
  'CASH_LOAN_PAYMENT',
  'CASH_DEBT_DISBURSEMENT',
  'CASH_DEBT_PAYMENT',
  'EXTERNAL_DEBT_RECEIPT',
]);

const EXPENSE_KINDS = new Set<ReconciliationKind>([
  'SALARY_EXPENSE',
  'GENERAL_EXPENSE',
  'RECEIVED_SERVICE_EXPENSE',
  'SOLD_SERVICE_COST',
  'INVENTORY_PURCHASE',
]);

/**
 * @description Verifica que un tipo canónico pertenece a los flujos financieros soportados.
 * @param {ReconciliationKind} kind - Tipo canónico que se validará.
 * @returns {boolean} Indica si el tipo puede construir un movimiento financiero.
 */
function isFinancialKind(kind: ReconciliationKind): kind is FinancialResultMovement['kind'] {
  return FINANCIAL_KINDS.has(kind);
}

/**
 * @description Verifica que un tipo canónico pertenece a los gastos soportados.
 * @param {ReconciliationKind} kind - Tipo canónico que se validará.
 * @returns {boolean} Indica si el tipo puede construir un movimiento de gasto.
 */
function isExpenseKind(kind: ReconciliationKind): kind is ExpenseResultMovement['kind'] {
  return EXPENSE_KINDS.has(kind);
}

/**
 * @description Normaliza el dinero persistido de una reconciliación a moneda funcional.
 * @param {PersistedAccountingAmount} record - Campos monetarios de la reconciliación.
 * @param {string} functionalCurrency - Moneda funcional del reporte.
 * @returns {{amount: number} | {issue: ReadIncident}} Importe usable o incidencia explícita.
 */
function normalizePersistedAmount(
  record: PersistedAccountingAmount,
  functionalCurrency: string,
): { amount: number; provenanceLegacy?: boolean } | { issue: ReadIncident } {
  const originalAmount = Number(record.monto);
  const hasPersistedEvidence = record.rateEffectiveAt != null;
  const effectiveAt = hasPersistedEvidence ? record.rateEffectiveAt : record.fechaReconciliacion;
  const result = normalizeAccountingAmount({
    amount: originalAmount,
    currency: record.moneda,
    functionalCurrency,
    convertedAmount: record.montoConvertido == null ? null : Number(record.montoConvertido),
    exchangeRate: record.tasaCambio == null ? null : Number(record.tasaCambio),
    operationAt: record.fechaReconciliacion,
    rateEffectiveAt: effectiveAt,
  });

  if (result.status === 'unresolved') {
    return {
      issue: {
        code: result.issue,
        movementId: record.reconciliacionId,
        affectedAmount: Number.isFinite(originalAmount) ? originalAmount : 0,
      },
    };
  }

  const isForeignConversion =
    result.source !== 'same_currency' &&
    record.moneda.trim().toUpperCase() !== functionalCurrency.toUpperCase();
  if (isForeignConversion && !hasPersistedEvidence) {
    // Lectura estricta: la evidencia ausente excluye la fila de los totales.
    if (isStrictFxReader('result')) {
      return {
        issue: {
          code: 'FX_PROVENANCE_LEGACY',
          movementId: record.reconciliacionId,
          affectedAmount: result.amount,
        },
      };
    }
    return { amount: result.amount, provenanceLegacy: true };
  }
  return { amount: result.amount };
}

/**
 * @description Obtiene el factor multiplicador hacia la moneda funcional a partir de la
 * conversión persistida de una reconciliación. Devuelve 1 para la moneda funcional.
 * @param {PersistedAccountingAmount} record - Reconciliación con importe y conversión persistidos.
 * @param {string} functionalCurrency - Moneda funcional del reporte.
 * @returns {number} Factor demostrable montoConvertido/monto; NaN si no puede demostrarse.
 */
function getPersistedConversionFactor(
  record: PersistedAccountingAmount,
  functionalCurrency: string,
): number {
  const currency = record.moneda?.trim().toUpperCase();
  if (!currency || currency === functionalCurrency.toUpperCase()) return 1;
  const original = Number(record.monto);
  const converted = record.montoConvertido == null ? NaN : Number(record.montoConvertido);
  if (!Number.isFinite(original) || original <= 0 || !Number.isFinite(converted)) return NaN;
  return converted / original;
}

/**
 * @description Obtiene el total confiable de una venta sin inventar precios actuales.
 * @param {{total: unknown, items: Array<{total: unknown}>}} venta - Documento vendido.
 * @returns {number} Total persistido en items o cabecera legacy.
 */
function getSaleRevenue(venta: {
  total: unknown;
  descuento: unknown;
  items: Array<{ total: unknown }>;
}): number {
  if (venta.total != null && Number.isFinite(Number(venta.total))) {
    return Math.max(0, Number(venta.total));
  }
  const subtotal = venta.items.reduce((total, item) => total + Number(item.total), 0);
  return Math.max(0, subtotal - Number(venta.descuento ?? 0));
}

/**
 * @description Añade aliases temporales de la pantalla actual sin alterar las fórmulas.
 * @param {T} period - Período reconciliado mensual o anual.
 * @returns {T & object} Contrato reconciliado con campos de presentación legacy.
 */
export function presentReconciledPeriod<T extends ReconciledPeriodResult>(period: T): T & {
  monthName?: string;
  ingresosVentas: number;
  ingresosServicios: number;
  totalIngresos: number;
  ventasCosto: number;
  gastosCompras: number;
  gastosSalarios: number;
  gastosGenerales: number;
  gastosMermas: number;
  totalGastos: number;
  utilidadNeta: number;
} {
  const month = 'month' in period && typeof period.month === 'number' ? period.month : null;
  return {
    ...period,
    ...(month ? { monthName: MONTH_NAMES[month - 1] } : {}),
    ingresosVentas: period.income.sales,
    ingresosServicios: period.income.services,
    totalIngresos: period.income.total,
    ventasCosto: period.costOfSales.total,
    gastosCompras: period.inventoryPurchases,
    gastosSalarios: period.operatingExpenses.salaries,
    gastosGenerales: period.operatingExpenses.general +
      period.operatingExpenses.purchasedServices,
    gastosMermas: period.nonCashAdjustments.shrinkages,
    totalGastos: period.costOfSales.total + period.operatingExpenses.total,
    utilidadNeta: period.reconciledResult,
  };
}

/**
 * @description Lee y calcula el resultado reconciliado anual con consultas acotadas.
 * @param {{tenantId: string, year: number}} params - Empresa y año civil solicitados.
 * @returns {Promise<ReturnType<typeof calculateReconciledResult>>} Resultado mensual y anual.
 */
export async function getReconciledResultForYear(params: {
  tenantId: string;
  year: number;
  startAt?: Date;
  cutoffAt?: Date;
  client?: Prisma.TransactionClient;
}) {
  const db = params.client ?? prisma;
  const tenantPolicy = await getRequiredTenantAccountingPolicy(params.tenantId, params.client);
  const principalCurrency = { codigo: tenantPolicy.functionalCurrencyCode };

  const yearRange = getYearRangeInTimeZone(params.year, ACCOUNTING_TIME_ZONE);
  const rangeStart = params.startAt && params.startAt > yearRange.gte
    ? params.startAt
    : yearRange.gte;
  const range = params.cutoffAt && params.cutoffAt < yearRange.lt
    ? { gte: rangeStart, lt: params.cutoffAt }
    : { gte: rangeStart, lt: yearRange.lt };
  const [sales, services, expenses, shrinkages] = await Promise.all([
    db.reconciliacionVenta.findMany({
      where: { tenantId: params.tenantId, fechaReconciliacion: range },
      select: {
        reconciliacionId: true,
        monto: true,
        moneda: true,
        montoConvertido: true,
        tasaCambio: true,
        rateEffectiveAt: true,
        fechaReconciliacion: true,
        tipoReconciliacion: true,
        venta: {
          select: {
            ventaId: true,
            total: true,
            descuento: true,
            cantidad: true,
            deletedAt: true,
            producto: { select: { precioCosto: true } },
            items: {
              select: {
                id: true,
                cantidad: true,
                total: true,
                producto: { select: { precioCosto: true } },
                allocations: {
                  orderBy: { createdAt: 'asc' },
                  select: {
                    id: true,
                    cantidad: true,
                    compraDocumentoItem: {
                      select: { precioUnitario: true, compraDocumentoId: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
    db.reconciliacionServicio.findMany({
      where: { tenantId: params.tenantId, fechaReconciliacion: range },
      select: {
        reconciliacionId: true,
        monto: true,
        moneda: true,
        montoConvertido: true,
        tasaCambio: true,
        rateEffectiveAt: true,
        fechaReconciliacion: true,
        ventasServicio: {
          select: { ventaServicioId: true, total: true, costo: true, cantidad: true },
        },
      },
    }),
    db.reconciliacionGasto.findMany({
      where: { tenantId: params.tenantId, fechaReconciliacion: range },
      select: {
        reconciliacionId: true,
        tipoGasto: true,
        referenciaId: true,
        monto: true,
        moneda: true,
        montoConvertido: true,
        tasaCambio: true,
        rateEffectiveAt: true,
        fechaReconciliacion: true,
        estado: true,
        gastoCompra: { select: { total: true } },
        gastoDE: { select: { monto: true } },
        pagoSalario: {
          select: { salario: true, bonificaciones: true, horasExtras: true },
        },
      },
    }),
    db.merma.findMany({
      where: { tenantId: params.tenantId, createdAt: range },
      select: { mermaId: true, costoTotal: true, createdAt: true },
    }),
  ]);

  const purchasedServiceIds = expenses
    .filter((expense) => expense.tipoGasto === 'servicio')
    .map((expense) => expense.referenciaId);
  const soldServiceIds = expenses
    .filter((expense) => expense.tipoGasto === 'venta_servicio')
    .map((expense) => expense.referenciaId);
  const saleDocumentIds = sales.flatMap((sale) => sale.venta ? [sale.venta.ventaId] : []);
  const serviceDocumentIds = services.map((service) => service.ventasServicio.ventaServicioId);
  const expenseDocumentIds = expenses.map((expense) => expense.referenciaId);
  const accruedReceivables = await db.cuentaPorCobrar.findMany({
    where: {
      tenantId: params.tenantId,
      estado: { not: 'ANULADA' },
      factura: {
        is: {
          venta: {
            is: {
              deletedAt: null,
              OR: [
                { createdAt: range },
                ...(saleDocumentIds.length > 0
                  ? [{ ventaId: { in: saleDocumentIds } }]
                  : []),
              ],
            },
          },
        },
      },
    },
    select: {
      id: true,
      factura: {
        select: {
          idFactura: true,
          tasaCambio: true,
          venta: {
            select: {
              ventaId: true, total: true, descuento: true, cantidad: true,
              createdAt: true, deletedAt: true,
              producto: { select: { precioCosto: true } },
              items: {
                select: {
                  id: true, cantidad: true, total: true,
                  producto: { select: { precioCosto: true } },
                  allocations: {
                    orderBy: { createdAt: 'asc' },
                    select: {
                      id: true, cantidad: true,
                      compraDocumentoItem: {
                        select: { precioUnitario: true, compraDocumentoId: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  const [
    purchasedServices,
    soldServices,
    previousSales,
    previousServices,
    previousExpenses,
  ] = await Promise.all([
    purchasedServiceIds.length > 0
      ? db.compraServicio.findMany({
          where: { tenantId: params.tenantId, compraServicioId: { in: purchasedServiceIds } },
          select: { compraServicioId: true, total: true, moneda: true },
        })
      : Promise.resolve([]),
    soldServiceIds.length > 0
      ? db.ventaServicios.findMany({
          where: { tenantId: params.tenantId, ventaServicioId: { in: soldServiceIds } },
          select: { ventaServicioId: true, costo: true, cantidad: true },
        })
      : Promise.resolve([]),
    saleDocumentIds.length > 0
      ? db.reconciliacionVenta.findMany({
          where: {
            tenantId: params.tenantId,
            ventaId: { in: saleDocumentIds },
            fechaReconciliacion: { lt: range.gte },
          },
          select: {
            reconciliacionId: true,
            ventaId: true,
            tipoReconciliacion: true,
            monto: true,
            moneda: true,
            montoConvertido: true,
            tasaCambio: true,
            rateEffectiveAt: true,
            fechaReconciliacion: true,
          },
        })
      : Promise.resolve([]),
    serviceDocumentIds.length > 0
      ? db.reconciliacionServicio.findMany({
          where: {
            tenantId: params.tenantId,
            ventaServicioId: { in: serviceDocumentIds },
            fechaReconciliacion: { lt: range.gte },
          },
          select: {
            reconciliacionId: true,
            ventaServicioId: true,
            monto: true,
            moneda: true,
            montoConvertido: true,
            tasaCambio: true,
            rateEffectiveAt: true,
            fechaReconciliacion: true,
          },
        })
      : Promise.resolve([]),
    expenseDocumentIds.length > 0
      ? db.reconciliacionGasto.findMany({
          where: {
            tenantId: params.tenantId,
            referenciaId: { in: expenseDocumentIds },
            fechaReconciliacion: { lt: range.gte },
          },
          select: {
            reconciliacionId: true,
            referenciaId: true,
            tipoGasto: true,
            estado: true,
            monto: true,
            moneda: true,
            montoConvertido: true,
            tasaCambio: true,
            rateEffectiveAt: true,
            fechaReconciliacion: true,
          },
        })
      : Promise.resolve([]),
  ]);
  const purchasedServiceDocuments = new Map(
    purchasedServices.map((service) => [service.compraServicioId, {
      total: Number(service.total),
      currency: service.moneda?.trim().toUpperCase() || principalCurrency.codigo,
    }]),
  );
  const soldServiceTotals = new Map(
    soldServices.map((service) => [
      service.ventaServicioId,
      Number(service.costo) * Number(service.cantidad),
    ]),
  );
  const movements: ReconciledResultMovement[] = [];
  const openingRecognitions: OpeningRecognition[] = [];
  const readIncidents: ReadIncident[] = [];
  const accruedSaleIds = new Set<string>();

  for (const receivable of accruedReceivables) {
    const sale = receivable.factura?.venta;
    if (!sale || sale.deletedAt) continue;
    const conversionFactor = Number(receivable.factura?.tasaCambio ?? 1);
    if (!Number.isFinite(conversionFactor) || conversionFactor <= 0) {
      readIncidents.push({
        code: 'MISSING_CONVERSION',
        movementId: receivable.id,
        affectedAmount: getSaleRevenue(sale),
      });
      continue;
    }
    const cost = calcularDetalleCostoVenta(sale as VentaParaCosto);
    accruedSaleIds.add(sale.ventaId);
    movements.push({
      source: 'sale',
      id: `ACCRUAL:${receivable.id}`,
      kind: 'SALE',
      status: 'POSTED',
      occurredAt: sale.createdAt,
      amount: getSaleRevenue(sale) * conversionFactor,
      cashAmount: 0,
      document: {
        id: sale.ventaId,
        revenue: getSaleRevenue(sale) * conversionFactor,
        historicalCost: cost.historical * conversionFactor,
        estimatedCost: cost.estimated * conversionFactor,
      },
      ...(cost.purchaseTrace.length > 0 && { purchaseTrace: cost.purchaseTrace }),
    });
  }

  for (const sale of previousSales) {
    const amount = normalizePersistedAmount(sale, principalCurrency.codigo);
    if ('issue' in amount) {
      readIncidents.push(amount.issue);
      continue;
    }
    if ('provenanceLegacy' in amount) {
      readIncidents.push({
        code: 'FX_PROVENANCE_LEGACY',
        movementId: sale.reconciliacionId,
        affectedAmount: amount.amount,
      });
    }
    const classification = classifyLegacyReconciliation({
      source: 'sale',
      kind: sale.tipoReconciliacion,
    });
    if (
      classification.status === 'classified' &&
      classification.kind === 'SALE' &&
      classification.affectsCashFlow &&
      sale.ventaId
    ) {
      openingRecognitions.push({
        source: 'sale',
        documentId: sale.ventaId,
        amount: amount.amount,
      });
    }
  }
  for (const service of previousServices) {
    const amount = normalizePersistedAmount(service, principalCurrency.codigo);
    if ('issue' in amount) {
      readIncidents.push(amount.issue);
      continue;
    }
    if ('provenanceLegacy' in amount) {
      readIncidents.push({
        code: 'FX_PROVENANCE_LEGACY',
        movementId: service.reconciliacionId,
        affectedAmount: amount.amount,
      });
    }
    openingRecognitions.push({
      source: 'service',
      documentId: service.ventaServicioId,
      amount: amount.amount,
    });
  }
  for (const expense of previousExpenses) {
    const amount = normalizePersistedAmount(expense, principalCurrency.codigo);
    if ('issue' in amount) {
      readIncidents.push(amount.issue);
      continue;
    }
    if ('provenanceLegacy' in amount) {
      readIncidents.push({
        code: 'FX_PROVENANCE_LEGACY',
        movementId: expense.reconciliacionId,
        affectedAmount: amount.amount,
      });
    }
    const classification = classifyLegacyReconciliation({
      source: 'expense',
      kind: expense.tipoGasto,
      status: expense.estado,
    });
    if (
      classification.status === 'classified' &&
      classification.affectsCashFlow &&
      isExpenseKind(classification.kind)
    ) {
      openingRecognitions.push({
        source: 'expense',
        kind: classification.kind,
        documentId: expense.referenciaId,
        amount: amount.amount,
      });
    }
  }

  for (const sale of sales) {
    const amount = normalizePersistedAmount(sale, principalCurrency.codigo);
    if ('issue' in amount) {
      readIncidents.push(amount.issue);
      continue;
    }
    if ('provenanceLegacy' in amount) {
      readIncidents.push({
        code: 'FX_PROVENANCE_LEGACY',
        movementId: sale.reconciliacionId,
        affectedAmount: amount.amount,
      });
    }
    const classification = classifyLegacyReconciliation({
      source: 'sale',
      kind: sale.tipoReconciliacion,
    });
    if (classification.status === 'unclassified') {
      readIncidents.push({
        code: classification.issue,
        movementId: sale.reconciliacionId,
        affectedAmount: amount.amount,
      });
      continue;
    }
    if (classification.kind !== 'SALE') {
      if (!isFinancialKind(classification.kind)) {
        readIncidents.push({
          code: 'UNEXPECTED_SALE_KIND',
          movementId: sale.reconciliacionId,
          affectedAmount: amount.amount,
        });
        continue;
      }
      movements.push({
        source: 'financial',
        id: sale.reconciliacionId,
        kind: classification.kind,
        status: classification.reconciliationStatus,
        occurredAt: sale.fechaReconciliacion,
        amount: amount.amount,
      });
      continue;
    }
    if (!sale.venta) {
      readIncidents.push({
        code: 'MISSING_DOCUMENT',
        movementId: sale.reconciliacionId,
        affectedAmount: amount.amount,
      });
      continue;
    }
    if (sale.venta.deletedAt) {
      readIncidents.push({
        code: 'DELETED_DOCUMENT',
        movementId: sale.reconciliacionId,
        affectedAmount: amount.amount,
      });
      continue;
    }
    const cost = calcularDetalleCostoVenta(sale.venta as VentaParaCosto);
    const conversionFactor = getPersistedConversionFactor(sale, principalCurrency.codigo);
    if (!Number.isFinite(conversionFactor)) {
      readIncidents.push({
        code: 'MISSING_CONVERSION',
        movementId: sale.reconciliacionId,
        affectedAmount: amount.amount,
      });
      continue;
    }
    if (cost.overAllocatedCost > 0) {
      readIncidents.push({
        code: 'FIFO_OVER_ALLOCATION',
        movementId: sale.reconciliacionId,
        affectedAmount: cost.overAllocatedCost * conversionFactor,
      });
    }
    movements.push({
      source: 'sale',
      id: sale.reconciliacionId,
      kind: 'SALE',
      status: classification.reconciliationStatus,
      occurredAt: sale.fechaReconciliacion,
      amount: amount.amount,
      ...(accruedSaleIds.has(sale.venta.ventaId) && { recognitionAmount: 0 }),
      document: {
        id: sale.venta.ventaId,
        revenue: getSaleRevenue(sale.venta) * conversionFactor,
        historicalCost: cost.historical * conversionFactor,
        estimatedCost: cost.estimated * conversionFactor,
      },
      ...(cost.purchaseTrace.length > 0 && { purchaseTrace: cost.purchaseTrace }),
    });
  }

  for (const service of services) {
    const amount = normalizePersistedAmount(service, principalCurrency.codigo);
    if ('issue' in amount) {
      readIncidents.push(amount.issue);
      continue;
    }
    if ('provenanceLegacy' in amount) {
      readIncidents.push({
        code: 'FX_PROVENANCE_LEGACY',
        movementId: service.reconciliacionId,
        affectedAmount: amount.amount,
      });
    }
    const conversionFactor = getPersistedConversionFactor(service, principalCurrency.codigo);
    if (!Number.isFinite(conversionFactor)) {
      readIncidents.push({
        code: 'MISSING_CONVERSION',
        movementId: service.reconciliacionId,
        affectedAmount: amount.amount,
      });
      continue;
    }
    movements.push({
      source: 'service',
      id: service.reconciliacionId,
      kind: 'SERVICE_SALE',
      status: 'POSTED',
      occurredAt: service.fechaReconciliacion,
      amount: amount.amount,
      document: {
        id: service.ventasServicio.ventaServicioId,
        revenue: Number(service.ventasServicio.total) * conversionFactor,
        historicalCost: Number(service.ventasServicio.costo) *
          Number(service.ventasServicio.cantidad) * conversionFactor,
        estimatedCost: 0,
      },
    });
  }

  for (const expense of expenses) {
    const amount = normalizePersistedAmount(expense, principalCurrency.codigo);
    if ('issue' in amount) {
      readIncidents.push(amount.issue);
      continue;
    }
    if ('provenanceLegacy' in amount) {
      readIncidents.push({
        code: 'FX_PROVENANCE_LEGACY',
        movementId: expense.reconciliacionId,
        affectedAmount: amount.amount,
      });
    }
    const classification = classifyLegacyReconciliation({
      source: 'expense',
      kind: expense.tipoGasto,
      status: expense.estado,
    });
    if (classification.status === 'unclassified') {
      readIncidents.push({
        code: classification.issue,
        movementId: expense.reconciliacionId,
        affectedAmount: amount.amount,
      });
      continue;
    }
    if (!isExpenseKind(classification.kind)) {
      readIncidents.push({
        code: 'UNEXPECTED_EXPENSE_KIND',
        movementId: expense.reconciliacionId,
        affectedAmount: amount.amount,
      });
      continue;
    }
    const salaryTotal = expense.pagoSalario
      ? Number(expense.pagoSalario.salario) + Number(expense.pagoSalario.bonificaciones ?? 0) +
        Number(expense.pagoSalario.horasExtras ?? 0)
      : null;
    const purchasedServiceDocument = purchasedServiceDocuments.get(expense.referenciaId);
    const documentTotal = expense.gastoCompra?.total ?? expense.gastoDE?.monto ?? salaryTotal ??
      purchasedServiceDocument?.total ??
      soldServiceTotals.get(expense.referenciaId) ?? null;
    const hasDocumentTotal = expense.gastoCompra != null ||
      expense.gastoDE != null ||
      salaryTotal != null ||
      purchasedServiceDocument != null ||
      soldServiceTotals.has(expense.referenciaId);
    if (!hasDocumentTotal) {
      readIncidents.push({
        code: 'MISSING_DOCUMENT_TOTAL',
        movementId: expense.reconciliacionId,
        affectedAmount: amount.amount,
      });
    }
    const conversionFactor = getPersistedConversionFactor(expense, principalCurrency.codigo);
    if (!Number.isFinite(conversionFactor)) {
      readIncidents.push({
        code: 'MISSING_CONVERSION',
        movementId: expense.reconciliacionId,
        affectedAmount: amount.amount,
      });
      continue;
    }
    movements.push({
      source: 'expense',
      id: expense.reconciliacionId,
      kind: classification.kind,
      status: classification.reconciliationStatus,
      occurredAt: expense.fechaReconciliacion,
      amount: amount.amount,
      documentId: expense.referenciaId,
      documentAmount: hasDocumentTotal
        ? Number(documentTotal) * conversionFactor
        : amount.amount,
    });
  }

  const result = calculateReconciledResult({
    year: params.year,
    timeZone: ACCOUNTING_TIME_ZONE,
    functionalCurrency: principalCurrency.codigo,
    movements,
    openingRecognitions,
    shrinkages: shrinkages.map((shrinkage) => ({
      id: shrinkage.mermaId,
      occurredAt: shrinkage.createdAt,
      amount: Number(shrinkage.costoTotal ?? 0),
    })),
  });

  return { ...result, incidents: [...result.incidents, ...readIncidents] };
}
