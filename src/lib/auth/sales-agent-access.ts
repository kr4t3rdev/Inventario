interface RouteIdentity {
  role: string;
  isActive: boolean;
  tenantId?: string;
  onboardingStatus?: string | null;
}

export type RouteAccessResult =
  | { allowed: true }
  | { allowed: false; redirectTo: '/login' | '/onboarding' | '/sales-agent/referidos' };

/**
 * @description Resuelve el acceso de identidades globales y tenantless a namespaces protegidos.
 * @param {RouteIdentity | null} user - Identidad autenticada o null.
 * @param {string} pathname - Ruta protegida solicitada.
 * @returns {RouteAccessResult} Decisión deny-by-default y redirect seguro.
 */
export function resolveSalesAgentAccess(
  user: RouteIdentity | null,
  pathname: string,
): RouteAccessResult {
  if (!user) return { allowed: false, redirectTo: '/login' };

  if (user.onboardingStatus === 'awaiting_sales_agent_approval' || !user.isActive) {
    return { allowed: false, redirectTo: '/onboarding' };
  }

  if (user.role === 'salesAgent') {
    return pathname.startsWith('/sales-agent/')
      ? { allowed: true }
      : { allowed: false, redirectTo: '/sales-agent/referidos' };
  }

  if (pathname.startsWith('/sales-agent/')) {
    return { allowed: false, redirectTo: '/login' };
  }

  if (user.role !== 'admin' && !user.tenantId) {
    return { allowed: false, redirectTo: '/login' };
  }

  return { allowed: true };
}
