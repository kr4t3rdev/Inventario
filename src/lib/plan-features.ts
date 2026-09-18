/**
 * @description Helpers para resolver features efectivos de un tenant a partir
 * del plan base y posibles overrides por licencia.
 */

export interface ResolveEffectivePlanFeaturesInput {
  planFeatures?: Record<string, boolean> | null;
  featureOverrides?: Record<string, boolean> | null;
  legacyLicenseFeatures?: Record<string, boolean> | null;
}

/**
 * @description Resuelve los features efectivos usando overrides explícitos y
 * compatibilidad con snapshots legacy.
 * @param {ResolveEffectivePlanFeaturesInput} input - Feature sets disponibles.
 * @returns {Record<string, boolean>} Mapa final de features efectivos.
 */
export function resolveEffectivePlanFeatures(
  input: ResolveEffectivePlanFeaturesInput,
): Record<string, boolean> {
  const planFeatures = input.planFeatures ?? {};
  const featureOverrides = input.featureOverrides ?? null;
  const legacyLicenseFeatures = input.legacyLicenseFeatures ?? null;

  if (featureOverrides && Object.keys(featureOverrides).length > 0) {
    return { ...planFeatures, ...featureOverrides };
  }

  if (legacyLicenseFeatures && Object.keys(legacyLicenseFeatures).length > 0) {
    return { ...legacyLicenseFeatures };
  }

  return { ...planFeatures };
}

/**
 * @description Calcula los overrides mínimos comparando snapshot legacy contra
 * features base del plan.
 * @param {{ planFeatures?: Record<string, boolean> | null; legacyLicenseFeatures?: Record<string, boolean> | null; }} input - Features base y snapshot legado.
 * @returns {Record<string, boolean>} Solo las diferencias respecto al plan.
 */
export function diffPlanFeaturesToOverrides(input: {
  planFeatures?: Record<string, boolean> | null;
  legacyLicenseFeatures?: Record<string, boolean> | null;
}): Record<string, boolean> {
  const planFeatures = input.planFeatures ?? {};
  const legacyLicenseFeatures = input.legacyLicenseFeatures ?? {};

  return Object.fromEntries(
    Object.entries(legacyLicenseFeatures).filter(
      ([key, value]) => planFeatures[key] !== value,
    ),
  );
}
