// ── Roles de plataforma (identidad global del usuario; contrato legado incluido) ──
export const APP_USER_ROLES = ['admin', 'dependiente', 'regularUser'] as const;
export type AppUserRole = (typeof APP_USER_ROLES)[number];

// ── Roles de tenant (autorización operativa dentro de una empresa) ──
export const TENANT_ROLES = ['director', 'admin', 'economico', 'dependiente'] as const;
export type TenantRole = (typeof TENANT_ROLES)[number];

const LEGACY_ROLE_MAP: Record<string, AppUserRole> = {
  ADMIN: 'admin',
  SUPERADMIN: 'admin',
  // `user` sigue entrando como alias legado del rol regular de plataforma.
  user: 'regularUser',
};

/**
 * @description Mapea un rol de plataforma global al tenantRole por defecto.
 * `admin` se conserva como `admin`; cualquier rol no administrativo cae en `dependiente`.
 * @param {AppUserRole} platformRole - Rol de plataforma.
 * @returns {TenantRole} Rol de tenant por defecto.
 */
export function platformRoleToTenantRole(platformRole: AppUserRole): TenantRole {
  if (platformRole === 'admin') return 'admin';
  return 'dependiente';
}

/**
 * @description Normaliza roles legados al conjunto oficial de roles de la aplicacion.
 * @param {unknown} role - Rol recibido desde token, BD o input.
 * @returns {AppUserRole | null} Rol normalizado o null si no es valido.
 */
export function normalizeUserRole(role: unknown): AppUserRole | null {
  if (typeof role !== 'string' || role.trim().length === 0) {
    return null;
  }

  const trimmedRole = role.trim();
  const mappedRole = LEGACY_ROLE_MAP[trimmedRole] ?? trimmedRole;

  if (APP_USER_ROLES.includes(mappedRole as AppUserRole)) {
    return mappedRole as AppUserRole;
  }

  return null;
}

/**
 * @description Verifica si un rol de plataforma corresponde a administrador.
 * @param {unknown} role - Rol a evaluar.
 * @returns {boolean} true si el rol tiene privilegios de administrador.
 */
export function isAdminRole(role: unknown): boolean {
  return normalizeUserRole(role) === 'admin';
}

/**
 * @description Verifica si un rol de tenant tiene permisos de administración empresarial.
 * `director` y `admin` son roles administrativos dentro del tenant.
 * @param {unknown} role - Rol de tenant a evaluar.
 * @returns {boolean} true si el rol tiene alcance administrativo.
 */
export function isTenantAdminRole(role: unknown): boolean {
  if (typeof role !== 'string') return false;
  return role === 'director' || role === 'admin';
}

/**
 * @description Verifica si un rol de tenant tiene permisos financieros/económicos.
 * `director`, `admin` y `economico` acceden a módulos financieros.
 * @param {unknown} role - Rol de tenant a evaluar.
 * @returns {boolean} true si puede acceder a módulos económico-financieros.
 */
export function isTenantEconomicoRole(role: unknown): boolean {
  if (typeof role !== 'string') return false;
  return role === 'economico' || role === 'admin' || role === 'director';
}

/**
 * @description Convierte un rol de tenant a una etiqueta legible para UI.
 * @param {TenantRole | null | undefined} role - Rol de tenant.
 * @returns {string} Etiqueta en español para mostrar en interfaz.
 */
export function getTenantRoleLabel(role: TenantRole | null | undefined): string {
  switch (role) {
    case 'director':
      return 'Director';
    case 'admin':
      return 'Administrador';
    case 'economico':
      return 'Económico';
    case 'dependiente':
      return 'Dependiente';
    default:
      return 'Sin rol de tenant';
  }
}
