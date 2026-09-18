import { FEATURE_REGISTRY } from '@/features/planes/feature-registry';

export const ACCOUNTING_OVERRIDE_FEATURE_KEYS = [
  'transferencias-bancarias',
  'ajustes-bancarios',
  'multi-moneda',
  'reportes-financieros',
  'cuentas-cobrar',
  'cuentas-pagar',
  'prestamos-cash',
  'deudas-cash',
  'anticipos',
  'analisis-estado-cuenta',
  'facturas-vencidas',
  'inyeccion-capital',
] as const;

export type AccountingOverrideFeatureKey =
  (typeof ACCOUNTING_OVERRIDE_FEATURE_KEYS)[number];

export interface AccountingOverrideFeatureDef {
  key: AccountingOverrideFeatureKey;
  label: string;
  description: string;
}

export interface AccountingFeatureToggleState {
  key: AccountingOverrideFeatureKey;
  enabled: boolean;
  inherited: boolean;
}

export const ACCOUNTING_OVERRIDE_FEATURES: AccountingOverrideFeatureDef[] =
  ACCOUNTING_OVERRIDE_FEATURE_KEYS.map((key) => {
    const feature = FEATURE_REGISTRY.find((entry) => entry.key === key);

    return {
      key,
      label: feature?.label ?? key,
      description: feature?.description ?? key,
    };
  });

/**
 * @description Mezcla solo overrides contables preservando cualquier override
 * no contable ya existente.
 * @param {Record<string, boolean> | null | undefined} currentOverrides - Overrides actuales.
 * @param {Partial<Record<AccountingOverrideFeatureKey, boolean>>} requestedOverrides - Overrides contables pedidos.
 * @returns {Record<string, boolean>} Mapa combinado listo para persistir.
 */
export function mergeAccountingFeatureOverrides(
  currentOverrides: Record<string, boolean> | null | undefined,
  requestedOverrides: Partial<Record<AccountingOverrideFeatureKey, boolean>>,
): Record<string, boolean> {
  const nextOverrides: Record<string, boolean> = {
    ...(currentOverrides ?? {}),
  };

  for (const key of ACCOUNTING_OVERRIDE_FEATURE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(requestedOverrides, key)) {
      const value = requestedOverrides[key];

      if (typeof value === 'boolean') {
        nextOverrides[key] = value;
      }
    }
  }

  return nextOverrides;
}

/**
 * @description Calcula el estado efectivo de toggles contables para editar
 * overrides sobre una licencia.
 * @param {Record<string, boolean> | null | undefined} planFeatures - Features base del plan.
 * @param {Record<string, boolean> | null | undefined} licenseOverrides - Overrides actuales.
 * @returns {AccountingFeatureToggleState[]} Estado visible para la UI.
 */
export function buildAccountingFeatureToggleStates(
  planFeatures: Record<string, boolean> | null | undefined,
  licenseOverrides: Record<string, boolean> | null | undefined,
): AccountingFeatureToggleState[] {
  return ACCOUNTING_OVERRIDE_FEATURE_KEYS.map((key) => {
    const inheritedValue = planFeatures?.[key] === true;
    const hasExplicitOverride = Object.prototype.hasOwnProperty.call(
      licenseOverrides ?? {},
      key,
    );
    const overrideValue = hasExplicitOverride ? licenseOverrides?.[key] === true : inheritedValue;

    return {
      key,
      enabled: overrideValue,
      inherited: !hasExplicitOverride,
    };
  });
}
