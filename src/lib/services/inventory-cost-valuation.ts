import { Prisma } from '@/generated/prisma';
import {
  buildAppliedFxEvidenceExact,
  type AppliedFxEvidence,
} from '@/features/contabilidad/domain/fx-evidence';
import type { Prisma as PrismaTypes } from '@/generated/prisma';
import { exchangeRateProvider } from '@/features/contabilidad/services/exchange-rate-provider';

interface ResolveInventoryCostValuationInput {
  amount: Prisma.Decimal | number | string;
  sourceCurrency: string;
  functionalCurrency: string;
  sourceToCupRate?: Prisma.Decimal | number | string | null;
  functionalToCupRate?: Prisma.Decimal | number | string | null;
  sourceRateId?: string | null;
  functionalRateId?: string | null;
  effectiveAt: Date | null;
  fxCatalogRateId?: string | null;
}

interface InventoryCostValuation {
  amount: Prisma.Decimal;
  exchangeRate: Prisma.Decimal;
  evidence: AppliedFxEvidence;
}

/**
 * @description Valora costo de inventario en la moneda funcional del tenant.
 * @param {ResolveInventoryCostValuationInput} input - Importe y tasas históricas hacia CUP.
 * @returns {InventoryCostValuation} Importe funcional exacto, tasa directa y evidencia.
 */
export function resolveInventoryCostValuation(
  input: ResolveInventoryCostValuationInput,
): InventoryCostValuation {
  const sourceCurrency = input.sourceCurrency.trim().toUpperCase();
  const functionalCurrency = input.functionalCurrency.trim().toUpperCase();
  const originalAmount = new Prisma.Decimal(input.amount);

  if (sourceCurrency === functionalCurrency) {
    const sameCurrency = buildAppliedFxEvidenceExact({
      originalAmount,
      originalCurrency: sourceCurrency,
      functionalCurrency,
      source: 'inventory-cost-valuation',
    });
    return {
      amount: sameCurrency.montoConvertido,
      exchangeRate: sameCurrency.tasaCambio,
      evidence: sameCurrency.evidence,
    };
  }

  if (!input.effectiveAt || Number.isNaN(input.effectiveAt.getTime())) {
    throw new Error('COST_FX_RATE_MISSING: La fecha efectiva de conversión es obligatoria');
  }

  const sourceToCup = sourceCurrency === 'CUP'
    ? new Prisma.Decimal(1)
    : input.sourceToCupRate == null
      ? null
      : new Prisma.Decimal(input.sourceToCupRate);
  const functionalToCup = functionalCurrency === 'CUP'
    ? new Prisma.Decimal(1)
    : input.functionalToCupRate == null
      ? null
      : new Prisma.Decimal(input.functionalToCupRate);

  if (!sourceToCup?.isFinite() || !sourceToCup.gt(0)
    || !functionalToCup?.isFinite() || !functionalToCup.gt(0)) {
    throw new Error('COST_FX_RATE_MISSING: Falta tasa histórica hacia CUP');
  }

  const exchangeRate = sourceToCup.div(functionalToCup);
  const amount = originalAmount.mul(exchangeRate).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
  const fxCatalogRateId = input.fxCatalogRateId
    ?? ([input.sourceRateId, input.functionalRateId].filter(Boolean).join(':') || null);
  const valued = buildAppliedFxEvidenceExact({
    originalAmount,
    originalCurrency: sourceCurrency,
    functionalCurrency,
    exchangeRate,
    convertedAmount: amount,
    rateEffectiveAt: input.effectiveAt,
    source: 'inventory-cost-valuation',
    fxCatalogRateId,
    rounding: 'HALF_UP_4DP',
  });

  return {
    amount: valued.montoConvertido,
    exchangeRate: valued.tasaCambio,
    evidence: valued.evidence,
  };
}

interface ResolveTenantInventoryCostValuationInput {
  amount: Prisma.Decimal | number | string;
  sourceCurrency: string;
  functionalCurrency: string;
  exchangeRateToCup?: number | null;
  effectiveAt: Date | null;
}

/**
 * @description Resuelve tasas históricas a CUP y valora costo en moneda funcional tenant-scoped.
 * @param {PrismaTypes.TransactionClient} tx - Transacción que contiene la política de tasas.
 * @param {ResolveTenantInventoryCostValuationInput} input - Importe y moneda del documento de compra.
 * @returns {Promise<InventoryCostValuation>} Importe funcional y evidencia FX.
 */
export async function resolveTenantInventoryCostValuation(
  tx: PrismaTypes.TransactionClient,
  input: ResolveTenantInventoryCostValuationInput,
): Promise<InventoryCostValuation> {
  const sourceCurrency = input.sourceCurrency.trim().toUpperCase();
  const functionalCurrency = input.functionalCurrency.trim().toUpperCase();
  if (sourceCurrency === functionalCurrency) {
    return resolveInventoryCostValuation({
      ...input,
      sourceCurrency,
      functionalCurrency,
      effectiveAt: null,
    });
  }
  if (!input.effectiveAt || Number.isNaN(input.effectiveAt.getTime())) {
    throw new Error('COST_FX_RATE_MISSING: La fecha efectiva de conversión es obligatoria');
  }

  const sourceRate = sourceCurrency === 'CUP'
    ? null
    : input.exchangeRateToCup != null
      ? { tasa: new Prisma.Decimal(input.exchangeRateToCup), tasaId: null as string | null }
      : await exchangeRateProvider.getRateAsOfExact({
          sourceCurrency,
          targetCurrency: 'CUP',
          boundaryAt: input.effectiveAt,
          client: tx,
        });
  const functionalRate = functionalCurrency === 'CUP'
    ? null
    : await exchangeRateProvider.getRateAsOfExact({
        sourceCurrency: functionalCurrency,
        targetCurrency: 'CUP',
        boundaryAt: input.effectiveAt,
        client: tx,
      });

  return resolveInventoryCostValuation({
    ...input,
    sourceCurrency,
    functionalCurrency,
    sourceToCupRate: sourceRate?.tasa ?? null,
    functionalToCupRate: functionalRate?.tasa ?? null,
    sourceRateId: sourceRate?.tasaId,
    functionalRateId: functionalRate?.tasaId,
  });
}
