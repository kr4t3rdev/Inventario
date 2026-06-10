import { prisma } from '@/lib/prisma';
import { ActionError } from '@/lib/server-actions/types';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

/**
 * @description Valida que el usuario tenga rol de manager (o superior) en el tenant.
 * Lanza ActionError si no tiene permisos de escritura/administración.
 *
 * @example
 * requireManagerRole(user, 'crear productos')
 *
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @param {string} [action='realizar esta acción'] - Descripción de la acción para el mensaje de error.
 * @throws {ActionError} Si el rol no es manager.
 */
export function requireManagerRole(user: AuthenticatedUser, action: string = 'realizar esta acción'): void {
  if (user.tenantRole !== 'manager') {
    throw new ActionError(
      `No tienes permisos para ${action}. Solo el administrador de la empresa puede realizar esta operación.`,
      'FORBIDDEN',
    )
  }
}

/**
 * @description Valida que el plan del tenant incluya el feature requerido.
 * Los usuarios admin globales bypass this check.
 *
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @param {string} featureKey - Clave del feature en el registro del plan.
 * @param {string} [action='acceder a esta funcionalidad'] - Descripción de la acción para el mensaje de error.
 * @throws {ActionError} Si el plan no incluye el feature.
 */
export function requireFeature(
  user: AuthenticatedUser,
  featureKey: string,
  action: string = 'acceder a esta funcionalidad',
): void {
  if (user.role === 'admin') return;
  requireTenant(user);
  if (user.planFeatures?.[featureKey] !== true) {
    throw new ActionError(
      `Tu plan actual no incluye la funcionalidad de ${action}. Actualiza tu plan para continuar.`,
      'FEATURE_NOT_AVAILABLE',
    );
  }
}

/**
 * @description Extiende un where de Prisma con filtro por tenantId.
 * Úsalo en cada query de negocio para garantizar aislamiento entre tenants.
 *
 * @example
 * const productos = await prisma.producto.findMany({
 *   where: scopedWhere(tenantId, { categoriaId: 'xxx' })
 * })
 *
 * @param {string} tenantId - ID del tenant activo.
 * @param {T} [where] - Where clause adicional.
 * @returns {T & { tenantId: string }} Where con tenantId agregado.
 */
export function scopedWhere<T extends object>(tenantId: string, where?: T): T & { tenantId: string } {
  return { ...(where ?? ({} as T)), tenantId } as T & { tenantId: string }
}

/**
 * @description Lanza error si el tenant del recurso no coincide con el tenant del actor.
 * Úsalo en operaciones de escritura sobre recursos que ya existen.
 *
 * @example
 * const producto = await prisma.producto.findUnique({ where: { id } })
 * assertTenantAccess(producto?.tenantId, user.tenantId, 'Producto')
 *
 * @param {string | null | undefined} resourceTenantId - Tenant al que pertenece el recurso.
 * @param {string | undefined} actorTenantId - Tenant del usuario autenticado.
 * @param {string} resourceName - Nombre del recurso para el mensaje de error.
 * @throws {Error} Si los tenants no coinciden.
 */
export function assertTenantAccess(
  resourceTenantId: string | null | undefined,
  actorTenantId: string | undefined,
  resourceName: string,
): void {
  if (!actorTenantId) {
    throw new Error('Contexto de tenant no disponible')
  }
  if (!resourceTenantId) {
    throw new Error(`${resourceName} no tiene tenant asignado`)
  }
  if (resourceTenantId !== actorTenantId) {
    throw new Error(`Acceso denegado: ${resourceName} no pertenece al tenant actual`)
  }
}

/**
 * @description Obtiene el tenantId del usuario autenticado o lanza error si no tiene contexto tenant.
 * Úsalo al inicio de handlers que REQUIERAN contexto de tenant.
 *
 * @example
 * const tenantId = requireTenant(user)
 * const productos = await prisma.producto.findMany({ where: { tenantId } })
 *
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {string} tenantId del usuario.
 * @throws {Error} Si el usuario no tiene tenant activo.
 */
export function requireTenant(user: AuthenticatedUser): string {
  if (!user.tenantId) {
    throw new Error(
      'Se requiere una membresía de empresa activa para acceder a este recurso',
    )
  }
  return user.tenantId
}

/**
 * @description Valida que el tenant tenga cupo disponible para crear un recurso.
 * Busca la licencia activa del tenant y cuenta los recursos existentes.
 *
 * @example
 * await validateTenantLimit(tenantId, 'maxUsuarios', prisma.tenantMembership.count({ where: { tenantId } }))
 * // Lanza error si ya se alcanzó el límite
 *
 * @param {string} tenantId - ID del tenant.
 * @param {'maxUsuarios' | 'maxAlmacenes' | 'maxProductos'} limitField - Campo de límite a validar.
 * @param {number} currentCount - Cantidad actual de recursos.
 * @returns {Promise<void>}
 * @throws {Error} Si se excede el límite del plan.
 */
export async function validateTenantLimit(
  tenantId: string,
  limitField: 'maxUsuarios' | 'maxAlmacenes' | 'maxProductos',
  currentCount: number,
): Promise<void> {
  const license = await prisma.tenantLicense.findFirst({
    where: { tenantId, activa: true },
    orderBy: { inicio: 'desc' },
  })

  if (!license) {
    throw new Error('El tenant no tiene una licencia activa')
  }

  const limit = license[limitField]
  if (currentCount >= limit) {
    const labels: Record<string, string> = {
      maxUsuarios: 'usuarios',
      maxAlmacenes: 'almacenes',
      maxProductos: 'productos',
    }
    throw new Error(
      `Límite del plan alcanzado: máximo ${limit} ${labels[limitField]}. Contacte al administrador del sistema.`,
    )
  }
}
