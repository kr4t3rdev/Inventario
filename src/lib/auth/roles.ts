// ── Roles de plataforma (identidad global del usuario) ──
export const APP_USER_ROLES = ["admin", "regularUser"] as const;
export type AppUserRole = (typeof APP_USER_ROLES)[number];

// ── Roles de tenant (autorización operativa dentro de una empresa) ──
export const TENANT_ROLES = ["manager", "economico", "dependiente"] as const;
export type TenantRole = (typeof TENANT_ROLES)[number];

const LEGACY_ROLE_MAP: Record<string, AppUserRole> = {
	ADMIN: "admin",
	SUPERADMIN: "admin",
	dependiente: "regularUser",
	// `user` sigue entrando como alias legado del rol regular de plataforma.
	user: "regularUser",
};

/**
 * @description Mapea un rol de plataforma global al tenantRole por defecto.
 * `admin` se conserva como `admin`; cualquier rol no administrativo cae en `dependiente`.
 * @param {AppUserRole} platformRole - Rol de plataforma.
 * @returns {TenantRole} Rol de tenant por defecto.
 */
export function platformRoleToTenantRole(
	platformRole: AppUserRole,
): TenantRole {
	if (platformRole === "admin") return "manager";
	return "dependiente";
}

/**
 * @description Normaliza roles de tenant legados al esquema vigente.
 * `director` sigue aceptándose como alias de compatibilidad pero se persiste/UI usa `manager`.
 * @param {unknown} role - Rol de tenant recibido desde token, BD o input.
 * @returns {TenantRole | null} Rol de tenant normalizado o null si no es válido.
 */
export function normalizeTenantRole(role: unknown): TenantRole | null {
	if (typeof role !== "string" || role.trim().length === 0) {
		return null;
	}

	const trimmedRole = role.trim();

	// Mapear roles legados
	if (trimmedRole === "director") return "manager";
	if (trimmedRole === "admin") return "manager";

	if (TENANT_ROLES.includes(trimmedRole as TenantRole)) {
		return trimmedRole as TenantRole;
	}

	return null;
}

/**
 * @description Normaliza roles legados al conjunto oficial de roles de la aplicacion.
 * @param {unknown} role - Rol recibido desde token, BD o input.
 * @returns {AppUserRole | null} Rol normalizado o null si no es valido.
 */
export function normalizeUserRole(role: unknown): AppUserRole | null {
	if (typeof role !== "string" || role.trim().length === 0) {
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
	return normalizeUserRole(role) === "admin";
}

/**
 * @description Verifica si un rol de tenant tiene permisos de administración empresarial.
 * `director` y `admin` son roles administrativos dentro del tenant.
 * @param {unknown} role - Rol de tenant a evaluar.
 * @returns {boolean} true si el rol tiene alcance administrativo.
 */
export function isTenantAdminRole(role: unknown): boolean {
	const normalizedRole = normalizeTenantRole(role);
	return normalizedRole === "manager";
}

/**
 * @description Verifica si un rol de tenant tiene permisos financieros/económicos.
 * `director`, `admin` y `economico` acceden a módulos financieros.
 * @param {unknown} role - Rol de tenant a evaluar.
 * @returns {boolean} true si puede acceder a módulos económico-financieros.
 */
export function isTenantEconomicoRole(role: unknown): boolean {
	const normalizedRole = normalizeTenantRole(role);
	return normalizedRole === "economico" || normalizedRole === "manager";
}

/**
 * @description Convierte un rol de tenant (o plataforma) a una etiqueta legible para UI.
 * Acepta también 'admin' (rol de plataforma) y 'regularUser' porque la UI
 * usa `tenantRole ?? role` como rol efectivo y necesita etiquetar ambos.
 * @param {string | null | undefined} role - Rol de tenant o plataforma.
 * @returns {string} Etiqueta en español para mostrar en interfaz.
 */
export function getTenantRoleLabel(role: string | null | undefined): string {
	switch (role) {
		case "manager":
			return "Manager / Director";
		case "admin":
			return "Administrador";
		case "economico":
			return "Económico";
		case "dependiente":
			return "Dependiente";
		case "regularUser":
			return "Usuario regular";
		default:
			return "Sin rol de tenant";
	}
}
