import { AFFILIATE_TIER_DEFINITIONS } from '../constants';
import type { AffiliateTierDefinition, AffiliateTierId, AffiliateTierProgress } from '../types';

export { AFFILIATE_TIER_DEFINITIONS };

/**
 * @description Retorna el tier vigente según ventas confirmadas.
 * @param {number} confirmedSalesCount - Cantidad de ventas válidas acumuladas.
 * @returns {AffiliateTierDefinition} Tier aplicable.
 */
export function getAffiliateTierDefinition(
  confirmedSalesCount: number,
): AffiliateTierDefinition {
  if (confirmedSalesCount <= 0) {
    return AFFILIATE_TIER_DEFINITIONS[0];
  }

  return (
    AFFILIATE_TIER_DEFINITIONS.find((tier) => {
      const withinLowerBound = confirmedSalesCount >= tier.minSalesInclusive;
      const withinUpperBound =
        tier.maxSalesInclusive === null || confirmedSalesCount <= tier.maxSalesInclusive;

      return withinLowerBound && withinUpperBound;
    }) ?? AFFILIATE_TIER_DEFINITIONS[AFFILIATE_TIER_DEFINITIONS.length - 1]
  );
}

/**
 * @description Retorna la tasa de comisión actual según ventas acumuladas.
 * @param {number} confirmedSalesCount - Cantidad de ventas válidas acumuladas.
 * @returns {number} Porcentaje decimal de comisión.
 */
export function getAffiliateCommissionRate(confirmedSalesCount: number): number {
  return getAffiliateTierDefinition(confirmedSalesCount).commissionRate;
}

/**
 * @description Devuelve los hitos ya ganados con perks acumulativos.
 * @param {number} confirmedSalesCount - Cantidad de ventas válidas acumuladas.
 * @returns {AffiliateTierId[]} Lista de milestones alcanzados.
 */
export function getGrantedMilestones(confirmedSalesCount: number): AffiliateTierId[] {
  return AFFILIATE_TIER_DEFINITIONS.filter(
    (tier) => confirmedSalesCount >= tier.minSalesInclusive,
  ).map((tier) => tier.id);
}

/**
 * @description Calcula la suma total de cupos acumulados por tiers alcanzados.
 * @param {number} confirmedSalesCount - Cantidad de ventas válidas acumuladas.
 * @returns {number} Total de perks acumulativos.
 */
export function getTotalGrantedPerkSlots(confirmedSalesCount: number): number {
  return AFFILIATE_TIER_DEFINITIONS.filter(
    (tier) => confirmedSalesCount >= tier.minSalesInclusive,
  ).reduce((total, tier) => total + tier.perkSlotsGranted, 0);
}

/**
 * @description Retorna el siguiente tier pendiente y cuántas ventas faltan.
 * @param {number} confirmedSalesCount - Cantidad de ventas válidas acumuladas.
 * @returns {AffiliateTierProgress['nextTier']} Siguiente objetivo o null.
 */
export function getNextAffiliateTier(
  confirmedSalesCount: number,
): AffiliateTierProgress['nextTier'] {
  const nextTier = AFFILIATE_TIER_DEFINITIONS.find(
    (tier) => confirmedSalesCount < tier.minSalesInclusive,
  );

  if (!nextTier) {
    return null;
  }

  return {
    tier: nextTier,
    remainingSales: nextTier.minSalesInclusive - confirmedSalesCount,
  };
}

/**
 * @description Calcula el estado completo del programa para un tenant.
 * @param {number} confirmedSalesCount - Cantidad de ventas válidas acumuladas.
 * @returns {AffiliateTierProgress} Snapshot completo del progreso.
 */
export function calculateAffiliateTierProgress(
  confirmedSalesCount: number,
): AffiliateTierProgress {
  const normalizedCount = Math.max(0, Math.floor(confirmedSalesCount));
  const currentTier = getAffiliateTierDefinition(normalizedCount);

  return {
    confirmedSalesCount: normalizedCount,
    currentTier,
    currentRate: currentTier.commissionRate,
    totalPerkSlots: getTotalGrantedPerkSlots(normalizedCount),
    grantedMilestones: getGrantedMilestones(normalizedCount),
    nextTier: getNextAffiliateTier(normalizedCount),
  };
}
