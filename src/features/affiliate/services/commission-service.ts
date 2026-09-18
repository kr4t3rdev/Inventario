import { AFFILIATE_DEFAULT_CURRENCY } from '../constants';
import { getAffiliateCommissionRate } from './tier-service';

/**
 * @description Calcula la comisión de una venta válida según el tramo alcanzado.
 * @param {{ confirmedSalesCountAfterConfirmation: number; basePlanPriceUsd: number; }} input - Datos para el cálculo.
 * @returns {{ commissionRate: number; commissionAmount: number; currency: string }} Comisión calculada.
 */
export function calculateAffiliateCommission(input: {
  confirmedSalesCountAfterConfirmation: number;
  basePlanPriceUsd: number;
}): {
  commissionRate: number;
  commissionAmount: number;
  currency: string;
} {
  const commissionRate = getAffiliateCommissionRate(
    input.confirmedSalesCountAfterConfirmation,
  );
  const commissionAmount = roundCurrency(input.basePlanPriceUsd * commissionRate);

  return {
    commissionRate,
    commissionAmount,
    currency: AFFILIATE_DEFAULT_CURRENCY,
  };
}

/**
 * @description Redondea montos monetarios a dos decimales.
 * @param {number} value - Valor bruto.
 * @returns {number} Valor redondeado.
 */
export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}
