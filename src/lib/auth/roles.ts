export const APP_USER_ROLES = ['admin', 'dependiente', 'regularUser'] as const;

export type AppUserRole = (typeof APP_USER_ROLES)[number];

const LEGACY_ROLE_MAP: Record<string, AppUserRole> = {
  ADMIN: 'admin',
  SUPERADMIN: 'admin',
  user: 'regularUser',
};

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
 * @description Verifica si un rol corresponde a administrador.
 * @param {unknown} role - Rol a evaluar.
 * @returns {boolean} true si el rol tiene privilegios de administrador.
 */
export function isAdminRole(role: unknown): boolean {
  return normalizeUserRole(role) === 'admin';
}
