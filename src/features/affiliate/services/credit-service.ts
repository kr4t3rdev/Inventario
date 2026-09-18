import type { AffiliateCreditSnapshot } from '../types';
import { roundCurrency } from './commission-service';

/**
 * @description Aplica crédito disponible sobre el precio de la próxima licencia.
 * @param {{ listPriceUsd: number; availableCreditUsd: number; }} input - Precio y crédito actual.
 * @returns {{ listPriceUsd: number; availableCreditUsd: number; creditAppliedUsd: number; finalPriceUsd: number; carryOverCreditUsd: number; }} Resultado del cálculo.
 */
export function applyCreditToPrice(input: {
  listPriceUsd: number;
  availableCreditUsd: number;
}): {
  listPriceUsd: number;
  availableCreditUsd: number;
  creditAppliedUsd: number;
  finalPriceUsd: number;
  carryOverCreditUsd: number;
} {
  const listPriceUsd = roundCurrency(Math.max(0, input.listPriceUsd));
  const availableCreditUsd = roundCurrency(Math.max(0, input.availableCreditUsd));
  const creditAppliedUsd = roundCurrency(Math.min(listPriceUsd, availableCreditUsd));
  const finalPriceUsd = roundCurrency(Math.max(0, listPriceUsd - creditAppliedUsd));
  const carryOverCreditUsd = roundCurrency(
    Math.max(0, availableCreditUsd - creditAppliedUsd),
  );

  return {
    listPriceUsd,
    availableCreditUsd,
    creditAppliedUsd,
    finalPriceUsd,
    carryOverCreditUsd,
  };
}

/**
 * @description Construye un snapshot compatible con los campos de TenantLicense.
 * @param {{ listPriceUsd: number; availableCreditUsd: number; }} input - Precio y crédito actual.
 * @returns {AffiliateCreditSnapshot} Snapshot persistible.
 */
export function buildAffiliateCreditSnapshot(input: {
  listPriceUsd: number;
  availableCreditUsd: number;
}): AffiliateCreditSnapshot {
  const result = applyCreditToPrice(input);

  return {
    ...result,
    creditSnapshotUsd: result.availableCreditUsd,
  };
}

/**
 * @description Suma solo las comisiones disponibles para aplicar.
 * @param {Array<{ commissionAmount: number; status: string }>} ledgerRows - Rows del ledger.
 * @returns {number} Crédito acumulado disponible.
 */
export function sumAvailableAffiliateCredit(
  ledgerRows: Array<{ commissionAmount: number; status: string }>,
): number {
  return roundCurrency(
    ledgerRows
      .filter((row) => row.status === 'available')
      .reduce((sum, row) => sum + row.commissionAmount, 0),
  );
}
