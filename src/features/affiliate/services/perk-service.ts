import { FEATURE_REGISTRY } from '@/features/planes/feature-registry';
import { ActionError } from '@/lib/server-actions';

import { REFERRAL_FEATURE_NAMESPACE } from '../constants';
import { REFERRAL_PERK_CATALOG } from '../referral-perk-catalog';
import type { ReferralPerkCatalogItem } from '../types';

export const REFERRAL_ALLOWED_FEATURE_KEYS = REFERRAL_PERK_CATALOG.filter(
  (item) => item.isActive,
).map((item) => item.key);

/**
 * @description Indica si una key pertenece al catálogo comercial base.
 * @param {string} featureKey - Key a verificar.
 * @returns {boolean} True si pertenece al plan comercial.
 */
export function isCommercialFeatureKey(featureKey: string): boolean {
  return FEATURE_REGISTRY.some((feature) => feature.key === featureKey);
}

/**
 * @description Devuelve el catálogo activo de perks exclusivos.
 * @returns {ReferralPerkCatalogItem[]} Perks activos.
 */
export function getReferralPerkCatalog(): ReferralPerkCatalogItem[] {
  return REFERRAL_PERK_CATALOG.filter((item) => item.isActive);
}

/**
 * @description Valida que una key sea exclusiva del programa de referidos.
 * @param {string} featureKey - Key candidata.
 * @returns {string} La misma key validada.
 */
export function assertReferralFeatureKey(featureKey: string): string {
  if (isCommercialFeatureKey(featureKey)) {
    throw new ActionError(
      'No se puede reutilizar una feature comercial dentro del programa de referidos',
      'INVALID_REFERRAL_FEATURE',
    );
  }

  if (!featureKey.startsWith(REFERRAL_FEATURE_NAMESPACE)) {
    throw new ActionError(
      'La feature debe usar el namespace referral- para el programa de referidos',
      'INVALID_REFERRAL_FEATURE',
    );
  }

  if (!REFERRAL_ALLOWED_FEATURE_KEYS.includes(featureKey)) {
    throw new ActionError(
      'La feature indicada no existe en el catálogo del programa de referidos',
      'UNKNOWN_REFERRAL_FEATURE',
    );
  }

  return featureKey;
}
