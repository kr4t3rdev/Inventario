import { prisma } from '@/lib/prisma';
import { getDefaultPermissionsForRole } from '@/lib/auth/permission-registry';

/**
 * @description Revalida la capacidad tenant-scoped para gestionar la política contable.
 * Respeta roles personalizados: si la membresía tiene customRole, usa sus permisos;
 * si no, los defaults del rol fijo. Guarda `config.contabilidad.politica`.
 * @param {string} userId - Actor autenticado.
 * @param {string} tenantId - Tenant derivado del contexto autenticado.
 * @returns {Promise<boolean>} Verdadero solo si la membresía activa tiene el permiso.
 */
export async function canManageAccountingPolicy(
  userId: string,
  tenantId: string,
): Promise<boolean> {
  const membership = await prisma.tenantMembership.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
    select: {
      tenantRole: true,
      customRoleId: true,
      isActive: true,
      user: { select: { isActive: true } },
    },
  });

  if (membership?.isActive !== true || !membership.user.isActive) return false;

  // Rol fijo por defecto: solo manager raw tiene el permiso por regla legacy.
  if (!membership.customRoleId) {
    return membership.tenantRole === 'manager';
  }

  // rol personalizado: exige la clave explícita (fail-closed si el rol no carga)
  const customRole = await prisma.tenantRole.findFirst({
    where: { roleId: membership.customRoleId, tenantId, isActive: true },
  });
  if (!customRole) return false;
  const keys = Array.isArray(customRole.permissions) ? (customRole.permissions as string[]) : [];
  return keys.includes('config.contabilidad.politica');
}

/**
 * @description Revalida la capacidad de plataforma para tooling cross-tenant.
 * @param {string} userId - Operador autenticado.
 * @returns {Promise<boolean>} Verdadero solo para admin global activo.
 */
export async function canRunAccountingPolicyRollout(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { userId },
    select: { role: true, isActive: true },
  });
  return user?.role === 'admin' && user.isActive === true;
}
