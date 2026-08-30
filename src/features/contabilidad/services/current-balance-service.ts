import {
  ACTIVE_PAYABLE_STATES,
  ACTIVE_RECEIVABLE_STATES,
  calculateCurrentBalance,
  type BalanceUnresolvedPart,
  type ExternalDebtState,
  type PayableState,
  type ReceivableState,
} from '@/features/contabilidad/domain/balance-calculator';
import { getRequiredTenantAccountingPolicy } from './tenant-accounting-policy-service';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma';
import { getAccountingYear } from '@/lib/services/fecha-operacion-registry';
import { hashFinancialSnapshot } from '@/features/contabilidad/services/historical-financial-report-service';
import { FX_EVIDENCE_SOURCE_TYPES } from './fx-evidence-service';

interface CurrentBalanceParams {
  tenantId: string;
  asOf: Date;
  currentResult: number | null;
  currentResultYear: number;
  client?: Prisma.TransactionClient;
}

/**
 * @description Indica si un código corresponde a la moneda funcional del balance.
 * @param {string | null | undefined} currency - Código monetario persistido.
 * @param {string} functionalCurrency - Código funcional configurado.
 * @returns {boolean} Verdadero cuando ambos códigos coinciden.
 */
function isFunctionalCurrency(
  currency: string | null | undefined,
  functionalCurrency: string,
): boolean {
  return (currency?.trim().toUpperCase() || functionalCurrency) === functionalCurrency;
}

interface BalanceFxEvidenceRow {
  sourceType: string;
  sourceId: string;
  originalAmount: number | string;
  originalCurrency: string;
  functionalAmount: number | string;
  functionalCurrency: string;
  exchangeRate: number | string;
  rateEffectiveAt: Date;
  cutoffAt?: Date;
}

function amountsMatch(left: number, right: number): boolean {
  return Number.isFinite(left) && Number.isFinite(right)
    && Math.abs(left - right) <= Math.max(0.01, Math.abs(right) * 0.000001);
}

function resolveFxEvidence(
  rows: BalanceFxEvidenceRow[],
  sourceType: string,
  sourceId: string,
  amount: number,
  currency: string,
  functionalCurrency: string,
  asOf: Date,
): { amount: number } | { issue: 'MISSING_CONVERSION' | 'INCONSISTENT_CONVERSION_EVIDENCE' } {
  const normalizedCurrency = currency.trim().toUpperCase();
  const evidence = rows.find((row) => row.sourceType === sourceType && row.sourceId === sourceId);
  if (!evidence) return { issue: 'MISSING_CONVERSION' };
  const rate = Number(evidence.exchangeRate);
  const originalAmount = Number(evidence.originalAmount);
  const functionalAmount = Number(evidence.functionalAmount);
  const valid = evidence.originalCurrency.trim().toUpperCase() === normalizedCurrency
    && evidence.functionalCurrency.trim().toUpperCase() === functionalCurrency
    && (evidence.cutoffAt ?? evidence.rateEffectiveAt).getTime() <= asOf.getTime()
    && amountsMatch(originalAmount, amount)
    && Number.isFinite(rate)
    && rate > 0
    && amountsMatch(functionalAmount, originalAmount * rate);
  return valid && functionalAmount >= 0
    ? { amount: functionalAmount }
    : { issue: 'INCONSISTENT_CONVERSION_EVIDENCE' };
}

/**
 * @description Construye el balance actual desde partidas tenant-scoped y costos FIFO remanentes.
 * @param {CurrentBalanceParams} params - Tenant, corte y resultado del período abierto.
 * @returns {Promise<ReturnType<typeof calculateCurrentBalance>>} Balance con cobertura y ecuación.
 */
export async function getCurrentBalance(params: CurrentBalanceParams) {
  const db = params.client ?? prisma;
  const policy = await getRequiredTenantAccountingPolicy(params.tenantId, params.client);
  const functionalCurrency = policy.functionalCurrencyCode.trim().toUpperCase();

  const [
    bankAccounts,
    stockLocations,
    purchaseLayers,
    receivables,
    payables,
    injections,
    fxEvidence,
     closures,
     approvedAccountingPeriods,
  ] = await Promise.all([
    db.cuentaBancaria.findMany({
      where: { tenantId: params.tenantId, isActive: true, saldo: { not: 0 } },
      select: { cuentaId: true, saldo: true, moneda: true },
    }),
    db.stockUbicacion.findMany({
      where: { tenantId: params.tenantId, cantidad: { gt: 0 } },
      select: {
        productoId: true,
        cantidad: true,
        producto: { select: { precioCosto: true } },
      },
    }),
    db.compraDocumentoItem.findMany({
      where: {
        tenantId: params.tenantId,
        compraDocumento: { deletedAt: null },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        compraDocumentoItemId: true,
        productoId: true,
        cantidad: true,
        precioUnitario: true,
        allocations: { select: { cantidad: true } },
      },
    }),
    db.cuentaPorCobrar.findMany({
      where: {
        tenantId: params.tenantId,
        estado: { in: [...ACTIVE_RECEIVABLE_STATES] },
      },
      select: {
        id: true,
        montoDeuda: true,
        montoPagado: true,
        estado: true,
        prestamoCash: { select: { moneda: true } },
      },
    }),
    db.cuentaPorPagar.findMany({
      where: {
        tenantId: params.tenantId,
        deletedAt: null,
        estado: { in: [...ACTIVE_PAYABLE_STATES] },
      },
      select: {
        cuentaPorPagarId: true,
        saldoPendiente: true,
        moneda: true,
        estado: true,
        deletedAt: true,
      },
    }),
    db.inyeccionCapital.findMany({
      where: {
        cuentaBancaria: { tenantId: params.tenantId },
        fechaRegistro: { lte: params.asOf },
      },
      select: {
        id: true,
        tipo: true,
        montoRecibido: true,
        moneda: true,
        fechaRegistro: true,
        estado: true,
        saldoPendiente: true,
      },
    }),
    db.fxEvidence.findMany({
      where: {
        tenantId: params.tenantId,
        cutoffAt: { lte: params.asOf },
      },
      orderBy: [
        { sourceType: 'asc' },
        { sourceId: 'asc' },
        { rateEffectiveAt: 'desc' },
        { capturedAt: 'desc' },
      ],
      select: {
        sourceType: true,
        sourceId: true,
        originalAmount: true,
        originalCurrency: true,
        functionalAmount: true,
        functionalCurrency: true,
        exchangeRate: true,
        rateEffectiveAt: true,
        cutoffAt: true,
      },
    }),
    db.cierreContable.findMany({
      where: {
        tenantId: params.tenantId,
        tipo: { equals: 'anual', mode: 'insensitive' },
        estado: { equals: 'aprobado', mode: 'insensitive' },
        aprobadoPor: { not: null },
        fechaFin: { lte: params.asOf },
      },
      select: {
        cierreId: true,
        tipo: true,
        estado: true,
        aprobadoPor: true,
        fechaFin: true,
        ganancias: true,
        perdidas: true,
      },
    }),
    db.periodoContable.findMany({
      where: {
        tenantId: params.tenantId,
        tipo: 'ANUAL',
        estado: 'APROBADO',
        aprobadoPor: { not: null },
        fechaFin: { lte: params.asOf },
      },
      orderBy: { fechaFin: 'desc' },
      select: {
        periodoId: true,
        fechaFin: true,
        resumenJson: true,
        hashIntegridad: true,
        snapshotPeriodos: {
          orderBy: { version: 'desc' },
          take: 1,
          select: {
            version: true,
            resumenJson: true,
            hashIntegridad: true,
          },
        },
      },
    }),
  ]);

  const unresolvedParts: BalanceUnresolvedPart[] = [];
  const bankBalances = bankAccounts.flatMap((account) => {
    const amount = Number(account.saldo);
    if (!isFunctionalCurrency(account.moneda, functionalCurrency)) {
      const converted = resolveFxEvidence(
        fxEvidence,
        FX_EVIDENCE_SOURCE_TYPES.BANK_ACCOUNT,
        account.cuentaId,
        amount,
        account.moneda,
        functionalCurrency,
        params.asOf,
      );
      if ('amount' in converted) {
        return [{ id: account.cuentaId, amount: converted.amount }];
      }
      unresolvedParts.push({
        source: 'bank',
        itemId: account.cuentaId,
        issue: converted.issue,
        affectedAmount: Math.abs(amount),
      });
      return [];
    }
    if (!Number.isFinite(amount) || amount < 0) {
      unresolvedParts.push({
        source: 'bank',
        itemId: account.cuentaId,
        issue: 'INVALID_BALANCE',
        affectedAmount: Number.isFinite(amount) ? Math.abs(amount) : 0,
      });
      return [];
    }
    return [{ id: account.cuentaId, amount }];
  });

  const stockByProduct = new Map<string, { quantity: number; fallbackUnitCost: number }>();
  for (const location of stockLocations) {
    const current = stockByProduct.get(location.productoId);
    stockByProduct.set(location.productoId, {
      quantity: (current?.quantity ?? 0) + Number(location.cantidad),
      fallbackUnitCost: Number(location.producto.precioCosto ?? current?.fallbackUnitCost ?? 0),
    });
  }
  const layersByProduct = new Map<string, Array<{ quantity: number; unitCost: number }>>();
  for (const layer of purchaseLayers) {
    const allocated = layer.allocations.reduce(
      (total, allocation) => total + Number(allocation.cantidad),
      0,
    );
    const remaining = Math.max(0, Number(layer.cantidad) - allocated);
    if (remaining <= 0) continue;
    const layers = layersByProduct.get(layer.productoId) ?? [];
    layers.push({ quantity: remaining, unitCost: Number(layer.precioUnitario) });
    layersByProduct.set(layer.productoId, layers);
  }
  const inventory = Array.from(stockByProduct.entries()).map(([id, stock]) => ({
    id,
    quantity: stock.quantity,
    historicalLayers: layersByProduct.get(id) ?? [],
    fallbackUnitCost: stock.fallbackUnitCost,
  }));

  const payableRows = payables.flatMap((payable) => {
    const amount = Number(payable.saldoPendiente);
    if (!isFunctionalCurrency(payable.moneda, functionalCurrency)) {
      unresolvedParts.push({
        source: 'payable',
        itemId: payable.cuentaPorPagarId,
        issue: 'MISSING_CONVERSION',
        affectedAmount: Math.abs(amount),
      });
      return [];
    }
    return [{
      id: payable.cuentaPorPagarId,
      pendingBalance: amount,
      state: payable.estado as PayableState,
      deleted: payable.deletedAt != null,
    }];
  });

  const capitalContributions: Array<{
    id: string;
    amount: number;
    registeredAt: Date;
  }> = [];
  const externalDebts: Array<{
    id: string;
    pendingBalance: number;
    state: ExternalDebtState;
  }> = [];
  for (const injection of injections) {
    const source = injection.tipo === 'CAPITAL_SOCIAL' ? 'capital' : 'externalDebt';
    const rawAmount = injection.tipo === 'CAPITAL_SOCIAL'
      ? Number(injection.montoRecibido)
      : Number(injection.saldoPendiente);
    if (!isFunctionalCurrency(injection.moneda, functionalCurrency)) {
      const converted = resolveFxEvidence(
        fxEvidence,
        FX_EVIDENCE_SOURCE_TYPES.CAPITAL_INJECTION,
        injection.id,
        rawAmount,
        injection.moneda,
        functionalCurrency,
        params.asOf,
      );
      if ('amount' in converted) {
        if (injection.tipo === 'CAPITAL_SOCIAL') {
          capitalContributions.push({
            id: injection.id,
            amount: converted.amount,
            registeredAt: injection.fechaRegistro,
          });
          continue;
        }
        if (injection.saldoPendiente == null) {
          unresolvedParts.push({
            source: 'externalDebt',
            itemId: injection.id,
            issue: 'MISSING_PENDING_BALANCE',
            affectedAmount: Number(injection.montoRecibido),
          });
          continue;
        }
        externalDebts.push({
          id: injection.id,
          pendingBalance: converted.amount,
          state: injection.estado as ExternalDebtState,
        });
        continue;
      }
      unresolvedParts.push({
        source,
        itemId: injection.id,
        issue: converted.issue === 'MISSING_CONVERSION'
          ? 'MISSING_HISTORICAL_CONVERSION'
          : 'INCONSISTENT_CONVERSION_EVIDENCE',
        affectedAmount: Number.isFinite(rawAmount) ? Math.abs(rawAmount) : 0,
      });
      continue;
    }
    if (injection.tipo === 'CAPITAL_SOCIAL') {
      capitalContributions.push({
        id: injection.id,
        amount: Number(injection.montoRecibido),
        registeredAt: injection.fechaRegistro,
      });
      continue;
    }
    if (injection.saldoPendiente == null) {
      unresolvedParts.push({
        source: 'externalDebt',
        itemId: injection.id,
        issue: 'MISSING_PENDING_BALANCE',
        affectedAmount: Number(injection.montoRecibido),
      });
      continue;
    }
    externalDebts.push({
      id: injection.id,
      pendingBalance: Number(injection.saldoPendiente),
      state: injection.estado as ExternalDebtState,
    });
  }

  if (params.currentResult == null || !Number.isFinite(params.currentResult)) {
    unresolvedParts.push({
      source: 'currentResult',
      itemId: 'current-period',
      issue: 'CURRENT_RESULT_UNAVAILABLE',
      affectedAmount: 0,
    });
  }

  const snapshotClosures = approvedAccountingPeriods.flatMap((period) => {
    const snapshot = period.snapshotPeriodos[0];
    const payload = snapshot?.resumenJson;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
    const payloadRecord = payload as Record<string, unknown>;
    if (
      payloadRecord.version !== 2 ||
      !snapshot.hashIntegridad ||
      hashFinancialSnapshot(payload) !== snapshot.hashIntegridad ||
      !period.hashIntegridad ||
      hashFinancialSnapshot(payload) !== period.hashIntegridad
    ) return [];
    const annualResult = (payloadRecord as { result?: { annual?: { reconciledResult?: unknown } } })
      .result?.annual?.reconciledResult;
    const result = Number(annualResult);
    if (!Number.isFinite(result)) return [];
    return [{
      id: period.periodoId,
      type: 'anual',
      state: 'aprobado',
      approvedBy: 'periodo-contable',
      endedAt: period.fechaFin,
      gains: Math.max(0, result),
      losses: Math.max(0, -result),
    }];
  });
  const accountingPeriodYears = new Set(
    approvedAccountingPeriods.map((period) => getAccountingYear(period.fechaFin)),
  );
  const legacyClosures = closures.filter(
    (closure) => !accountingPeriodYears.has(getAccountingYear(closure.fechaFin)),
  );
  const approvedClosures = [...legacyClosures.map((closure) => ({
    id: closure.cierreId,
    type: closure.tipo,
    state: closure.estado,
    approvedBy: closure.aprobadoPor,
    endedAt: closure.fechaFin,
    gains: Number(closure.ganancias),
    losses: Number(closure.perdidas),
  })), ...snapshotClosures];
  const resultYearIsClosed = approvedClosures.some((closure) => {
    return getAccountingYear(closure.endedAt) === params.currentResultYear;
  });
  const effectiveCurrentResult = resultYearIsClosed ? 0 : params.currentResult;

  const receivableRows = receivables.flatMap((receivable) => {
    const balance = Number(receivable.montoDeuda) - Number(receivable.montoPagado);
    if (
      receivable.prestamoCash &&
      !isFunctionalCurrency(receivable.prestamoCash.moneda, functionalCurrency)
    ) {
      unresolvedParts.push({
        source: 'receivable',
        itemId: receivable.id,
        issue: 'MISSING_CONVERSION',
        affectedAmount: Math.max(0, balance),
      });
      return [];
    }
    return [{
      id: receivable.id,
      debt: Number(receivable.montoDeuda),
      paid: Number(receivable.montoPagado),
      state: receivable.estado as ReceivableState,
    }];
  });

  return calculateCurrentBalance({
    asOf: params.asOf,
    functionalCurrency,
    bankBalances,
    inventory,
    receivables: receivableRows,
    payables: payableRows,
    externalDebts,
    capitalContributions,
     approvedClosures,
    currentResult: effectiveCurrentResult ?? 0,
    unresolvedParts,
  });
}
