/**
 * @description Helpers de acceso/gating basados en el plan real del tenant.
 */

interface PlanAwareUser {
  planName?: string | null;
  planFeatures?: Record<string, boolean> | null;
}

export function isBasicPlanName(planName?: string | null): boolean {
  return planName === 'Básico';
}

export function shouldHideSeparateEmployeeModules(
  user?: PlanAwareUser | null,
): boolean {
  return isBasicPlanName(user?.planName);
}
