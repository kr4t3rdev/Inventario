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

  // Precedencia: overrides explícitos > plan actual > snapshot legacy.
  // El plan es la fuente de verdad: sus valores siempre aplican (incluidas
  // las keys que el plan ganó o perdió después de crearse la licencia). El
  // snapshot legacy solo rellena keys que el plan ya no define, para no
  // perder features retiradas del plan que la licencia sí tenía. Antes, un
  // snapshot legacy sin overrides reemplazaba por completo al plan: las keys
  // nuevas del plan (p. ej. paridad Odoo: ordenes-compra, recepciones,
  // reabastecimiento) nunca llegaban al tenant y quedaban ausentes del mapa
  // efectivo, con lo que el sidebar las mostraba y las actions las negaban.
  return {
    ...(legacyLicenseFeatures ?? {}),
    ...planFeatures,
    ...(featureOverrides ?? {}),
  };
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
