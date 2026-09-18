import { prisma } from '@/lib/prisma';
import { normalizeTenantRole } from '@/lib/auth/roles';

/**
 * Guarda de resiliencia administrativa (PG-04 / hallazgo #3).
 *
 * Invariante: un tenant nunca puede quedarse sin al menos un administrador
 * efectivo, definido como un miembro activo cuyo permiso efectivo incluye
 * `config.usuarios.gestionar`. Replica exactamente la resolución de permisos
 * de `resolveTenantContext`: rol custom activo → sus permisos; rol custom
 * inválido/inactivo o ausente → defaults del rol fijo (`manager` = todo).
 */

/** Clave de permiso que habilita gestionar usuarios y roles. */
export const ADMIN_PERMISSION_KEY = 'config.usuarios.gestionar';

/**
 * @description Indica si un valor Json de permisos incluye la clave de administración.
 * @param {unknown} permissions - Valor del campo `permissions` de un TenantRole.
 * @returns {boolean} true si incluye `config.usuarios.gestionar`.
 */
export function rolePermissionsIncludeAdmin(permissions: unknown): boolean {
	return Array.isArray(permissions) && (permissions as string[]).includes(ADMIN_PERMISSION_KEY);
}

/**
 * @description Determina si un rol fijo normaliza a `manager` (con defaults de admin).
 * @param {string} fixedRole - Rol fijo de la membresía.
 * @returns {boolean} true si el rol fijo es administrativo.
 */
export function fixedRoleIsManager(fixedRole: string): boolean {
	return normalizeTenantRole(fixedRole) === 'manager';
}

/**
 * @description Resuelve si una membresía (o estado simulado) es admin efectivo.
 * Con rol custom activo usa sus permisos exactos; con rol custom inactivo/ausente
 * o membresía inactiva, aplica el fallback del rol fijo (fail-safe de auth-middleware).
 * @param {{ tenantId: string; fixedRole: string; isActive: boolean; customRoleId: string | null }} params - Estado a evaluar.
 * @returns {Promise<boolean>} true si es administrador efectivo.
 */
export async function computeAdminStatus(params: {
	tenantId: string;
	fixedRole: string;
	isActive: boolean;
	customRoleId: string | null;
}): Promise<boolean> {
	if (!params.isActive) return false;

	if (!params.customRoleId) {
		return fixedRoleIsManager(params.fixedRole);
	}

	const role = await prisma.tenantRole.findFirst({
		where: { roleId: params.customRoleId, tenantId: params.tenantId, isActive: true },
		select: { permissions: true },
	});

	if (!role) {
		return fixedRoleIsManager(params.fixedRole);
	}

	return rolePermissionsIncludeAdmin(role.permissions);
}

/**
 * @description Override de rol usado para simular el efecto de una edición pendiente.
 */
export interface RoleOverride {
	roleId: string;
	permissions: string[];
	isActive: boolean;
}

/**
 * @description Cuenta los administradores efectivos activos del tenant.
 * Admite un `override` de rol para simular el resultado de una edición aún no
 * aplicada (p.ej. al quitar `config.usuarios.gestionar` o desactivar un rol).
 * @param {string} tenantId - Tenant a evaluar.
 * @param {RoleOverride} [override] - Rol bajo edición, para simular su estado final.
 * @returns {Promise<number>} Cantidad de administradores efectivos.
 */
export async function countEffectiveAdmins(
	tenantId: string,
	override?: RoleOverride,
): Promise<number> {
	const memberships = await prisma.tenantMembership.findMany({
		where: { tenantId, isActive: true },
		select: { tenantRole: true, customRoleId: true },
	});

	const roleIds = Array.from(
		new Set(memberships.map((m) => m.customRoleId).filter((id): id is string => Boolean(id))),
	);

	const roles = roleIds.length
		? await prisma.tenantRole.findMany({
				where: { roleId: { in: roleIds }, tenantId },
				select: { roleId: true, permissions: true, isActive: true },
			})
		: [];
	const rolesById = new Map(roles.map((r) => [r.roleId, r]));

	let count = 0;
	for (const m of memberships) {
		if (m.customRoleId && override && m.customRoleId === override.roleId) {
			if (override.isActive) {
				if (override.permissions.includes(ADMIN_PERMISSION_KEY)) count++;
			} else if (fixedRoleIsManager(m.tenantRole)) {
				count++;
			}
			continue;
		}

		if (!m.customRoleId) {
			if (fixedRoleIsManager(m.tenantRole)) count++;
			continue;
		}

		const role = rolesById.get(m.customRoleId);
		if (!role || !role.isActive) {
			if (fixedRoleIsManager(m.tenantRole)) count++;
		} else if (rolePermissionsIncludeAdmin(role.permissions)) {
			count++;
		}
	}

	return count;
}