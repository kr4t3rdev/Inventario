import { prisma } from '@/lib/prisma';

/**
 * @description Revalida la capacidad tenant-scoped para gestionar la política contable.
 * @param {string} userId - Actor autenticado.
 * @param {string} tenantId - Tenant derivado del contexto autenticado.
 * @returns {Promise<boolean>} Verdadero solo para manager y membresía/usuario activos.
 */
export async function canManageAccountingPolicy(
  userId: string,
  tenantId: string,
): Promise<boolean> {
  const membership = await prisma.tenantMembership.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
    select: {
      tenantRole: true,
      isActive: true,
      user: { select: { isActive: true } },
    },
  });

  return membership?.isActive === true
    && membership.user.isActive === true
    && membership.tenantRole === 'manager';
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
