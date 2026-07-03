/**
 * @description Helpers de acceso/gating basados en el plan real del tenant.
 */

interface PlanAwareUser {
  planName?: string | null;
  planFeatures?: Record<string, boolean> | null;
}

const BASIC_ACCOUNTING_HIDDEN_ITEMS = new Set([
  'Transferencias Bancarias',
  'Exchange',
  'Inyección Capital',
  'Analisis Estado Cuenta',
  'Facturas Vencidas',
  'Reconciliación Servicios',
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
