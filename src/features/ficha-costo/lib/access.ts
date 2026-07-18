interface FichaCostoAccessUser {
  role?: string | null
  tenantId?: string | null
  planFeatures?: Record<string, boolean> | null
}

/**
 * @description Determina si un usuario puede acceder al módulo Ficha de Costo.
 * @param {FichaCostoAccessUser | null | undefined} user - Usuario y snapshot de features del plan.
 * @returns {boolean} `true` exclusivamente para un tenant con el feature base habilitado.
 */
export function canAccessFichaCosto(user: FichaCostoAccessUser | null | undefined): boolean {
  if (!user?.tenantId) return false
  return user.planFeatures?.['ficha-costo'] === true
}

/**
 * @description Determina si un usuario puede acceder a operaciones masivas de Ficha de Costo.
 * @param {FichaCostoAccessUser | null | undefined} user - Usuario y snapshot de features del plan.
 * @returns {boolean} `true` exclusivamente para un tenant con feature base y subfeature bulk.
 */
export function canAccessFichaCostoBulk(
  user: FichaCostoAccessUser | null | undefined,
): boolean {
  if (!user?.tenantId) return false
  return user.planFeatures?.['ficha-costo'] === true
    && user.planFeatures?.['ficha-costo-bulk'] === true
}
