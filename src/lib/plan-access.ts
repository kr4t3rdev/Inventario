/**
 * @description Helpers de acceso/gating basados en el plan real del tenant.
 */

interface PlanAwareUser {
  planName?: string | null;
  planFeatures?: Record<string, boolean> | null;
}

const BASIC_ACCOUNTING_HIDDEN_ITEMS = new Set([
  'Transferencias Bancarias',
  'Ajustes Bancarios',
  'Exchange',
  'Inyección Capital',
  'Analisis Estado Cuenta',
  'Facturas Vencidas',
  'Reconciliación Servicios',
]);

const ACCOUNTING_ITEM_FEATURE_MAP: Record<string, string> = {
  Dashboard: 'contabilidad',
  'Cuentas Bancarias': 'contabilidad',
  'Cuentas por Cobrar': 'contabilidad',
  'Cuentas por Pagar': 'contabilidad',
  'Deudas en Efectivo': 'contabilidad',
  'Transferencias Bancarias': 'transferencias-bancarias',
  'Ajustes Bancarios': 'ajustes-bancarios',
  Reconciliación: 'contabilidad',
  'Reconciliación Ventas': 'contabilidad',
  'Reconciliación Gastos': 'contabilidad',
  'Reconciliación Servicios': 'servicios',
  Exchange: 'multi-moneda',
  'Inyección Capital': 'inyeccion-capital',
  'Analisis Estado Cuenta': 'analisis-estado-cuenta',
  'Facturas Vencidas': 'facturas-vencidas',
  'Balance y Resultados': 'contabilidad',
  'Reportes Contables': 'contabilidad',
  'Configuracion Contable': 'contabilidad',
  'Períodos Contables': 'contabilidad',
  'Préstamos en Efectivo': 'contabilidad',
  Logs: 'contabilidad',
};

const LEGACY_ACCOUNTING_FEATURES = new Set([
  'transferencias-bancarias',
  'ajustes-bancarios',
]);

export function hasPlanFeature(
  user: PlanAwareUser | null | undefined,
  featureKey: string,
): boolean {
  return user?.planFeatures?.[featureKey] === true;
}

export function isBasicPlanName(planName?: string | null): boolean {
  return planName === 'Básico';
}

export function shouldHideSeparateEmployeeModules(
  user?: PlanAwareUser | null,
): boolean {
  return isBasicPlanName(user?.planName);
}

export function shouldHideBasicAccountingItem(
  user: PlanAwareUser | null | undefined,
  itemTitle: string,
): boolean {
  return isBasicPlanName(user?.planName) && BASIC_ACCOUNTING_HIDDEN_ITEMS.has(itemTitle);
}

export function getAccountingItemFeatureKey(itemTitle: string): string | null {
  return ACCOUNTING_ITEM_FEATURE_MAP[itemTitle] ?? null;
}

export function canAccessAccountingItem(
  user: PlanAwareUser | null | undefined,
  itemTitle: string,
): boolean {
  const featureKey = getAccountingItemFeatureKey(itemTitle);

  if (!featureKey) {
    return !shouldHideBasicAccountingItem(user, itemTitle);
  }

  const explicitAccess = user?.planFeatures?.[featureKey];
  if (explicitAccess === true) return true;
  if (explicitAccess === false) return false;

  if (LEGACY_ACCOUNTING_FEATURES.has(featureKey)) {
    return hasPlanFeature(user, 'contabilidad') && !shouldHideBasicAccountingItem(user, itemTitle);
  }

  return false;
}
