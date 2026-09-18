'use server'

/**
 * @description Server Actions del CRUD de roles personalizados por tenant (PG-04).
 * Todas requieren el permiso `config.usuarios.gestionar`. Las claves de permisos
 * se validan contra el permission-registry; la escritura es el firewall.
 */
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requirePermission, requireTenant } from '@/lib/services/tenant-scope';
import { AuditLogService } from '@/lib/services/audit-log-service';
import { getPermissionByKey } from '@/lib/auth/permission-registry';
import {
  computeAdminStatus,
  countEffectiveAdmins,
  rolePermissionsIncludeAdmin,
} from '@/lib/auth/last-admin-guard';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const GESTIONAR_USUARIOS = 'config.usuarios.gestionar';
const CONFIG_PATH = '/busy/configuracion';

const createRoleSchema = z
  .object({
    nombre: z.string().trim().min(1).max(80),
    descripcion: z.string().trim().max(200).optional(),
    permissions: z.array(z.string()).default([]),
  })
  .strict();

const updateRoleSchema = z
  .object({
    roleId: z.string().min(1),
    nombre: z.string().trim().min(1).max(80).optional(),
    descripcion: z.string().trim().max(200).nullable().optional(),
    permissions: z.array(z.string()).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

const assignRoleSchema = z
  .object({
    membershipId: z.string().min(1),
    customRoleId: z.string().min(1).nullable(),
  })
  .strict();

/**
 * @description Valida que todas las claves de permiso existan en el registry.
 * Al escribir un rol, solo claves conocidas pueden persistirse.
 * @param {string[]} keys - Claves a validar.
 * @throws {ActionError} Si alguna clave no existe en el registry.
 */
function assertKnownPermissionKeys(keys: string[]): void {
  const unknown = keys.filter((k) => !getPermissionByKey(k));
  if (unknown.length > 0) {
    throw new ActionError(
      `Permisos desconocidos: ${unknown.join(', ')}`,
      'VALIDATION_ERROR',
    );
  }
}

/**
 * @description Lista los roles personalizados del tenant, ordenados por nombre.
 * @param _input - Sin parámetros (compat con withAction).
 * @param user - Usuario autenticado.
 * @returns Lista de roles del tenant.
 */
export const listTenantRolesAction = withAction(
  async (_input: void, user: AuthenticatedUser) => {
    requirePermission(user, GESTIONAR_USUARIOS, 'gestionar roles de la empresa');
    const tenantId = requireTenant(user);

    const roles = await prisma.tenantRole.findMany({
      where: { tenantId },
      orderBy: { nombre: 'asc' },
    });

    return { roles };
  },
);

/**
 * @description Lista las membresías activas del tenant con su rol (fijo/custom)
 * para poder asignar o cambiar el rol personalizado desde la gestión de usuarios.
 * @param _input - Sin parámetros.
 * @param user - Usuario autenticado.
 * @returns Membresías activas con nombre/email del usuario.
 */
export const listTenantMembersAction = withAction(
  async (_input: void, user: AuthenticatedUser) => {
    requirePermission(user, GESTIONAR_USUARIOS, 'gestionar usuarios de la empresa');
    const tenantId = requireTenant(user);

    const memberships = await prisma.tenantMembership.findMany({
      where: { tenantId, isActive: true },
      select: {
        membershipId: true,
        tenantId: true,
        userId: true,
        tenantRole: true,
        customRoleId: true,
        isActive: true,
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return { memberships };
  },
);

/**
 * @description Crea un rol personalizado del tenant.
 * @param input - Datos del rol (Zod strict).
 * @param user - Usuario autenticado.
 * @returns El rol creado.
 */
export const createTenantRoleAction = withAction(
  async (input: z.infer<typeof createRoleSchema>, user: AuthenticatedUser) => {
    const data = createRoleSchema.parse(input);
    requirePermission(user, GESTIONAR_USUARIOS, 'gestionar roles de la empresa');
    const tenantId = requireTenant(user);

    assertKnownPermissionKeys(data.permissions);

    const existente = await prisma.tenantRole.findFirst({
      where: { tenantId, nombre: data.nombre },
    });
    if (existente) {
      throw new ActionError(
        `Ya existe un rol con el nombre ${data.nombre} en este tenant`,
        'DUPLICATE',
      );
    }

    const role = await prisma.$transaction(async (tx) => {
      const created = await tx.tenantRole.create({
        data: {
          tenantId,
          nombre: data.nombre,
          descripcion: data.descripcion ?? null,
          permissions: data.permissions,
        },
      });

      // Mutación + auditoría en la MISMA transacción (hallazgo #8): si el log
      // falla, el rol no queda persistido sin evidencia.
      await AuditLogService.logStrict(
        {
          accion: 'CREATE',
          entidad: 'TENANT_ROLE',
          entidadId: created.roleId,
          usuarioId: user.userId,
          detalles: { tenantId, nombre: created.nombre, permissions: created.permissions },
        },
        tx,
      );

      return created;
    });

    revalidatePath(CONFIG_PATH);
    return { role };
  },
);

/**
 * @description Actualiza un rol personalizado existente del tenant.
 * @param input - Datos parciales a actualizar (Zod strict).
 * @param user - Usuario autenticado.
 * @returns El rol actualizado.
 */
export const updateTenantRoleAction = withAction(
  async (input: z.infer<typeof updateRoleSchema>, user: AuthenticatedUser) => {
    const data = updateRoleSchema.parse(input);
    requirePermission(user, GESTIONAR_USUARIOS, 'gestionar roles de la empresa');
    const tenantId = requireTenant(user);

    const role = await prisma.tenantRole.findFirst({
      where: { roleId: data.roleId, tenantId },
    });
    if (!role) {
      throw new ActionError('Rol no encontrado', 'NOT_FOUND');
    }

    if (data.permissions !== undefined) {
      assertKnownPermissionKeys(data.permissions);
    }

    const updateData: Record<string, unknown> = {};
    if (data.nombre !== undefined) updateData.nombre = data.nombre;
    if (data.descripcion !== undefined) updateData.descripcion = data.descripcion;
    if (data.permissions !== undefined) updateData.permissions = data.permissions;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    // Guarda de último admin (hallazgo #3): la edición no puede dejar al tenant
    // sin un administrador efectivo. Solo evalúa cuando la edición reduciría la
    // capacidad administrativa (quitar gestionar o desactivar el rol).
    const nextPermissions = data.permissions ?? (role.permissions as string[]);
    const nextIsActive = data.isActive ?? role.isActive;
    const removesAdmin =
      !nextIsActive || !rolePermissionsIncludeAdmin(nextPermissions);

    if (removesAdmin) {
      const before = await countEffectiveAdmins(tenantId);
      const after = await countEffectiveAdmins(tenantId, {
        roleId: role.roleId,
        permissions: Array.isArray(nextPermissions) ? (nextPermissions as string[]) : [],
        isActive: Boolean(nextIsActive),
      });
      if (before >= 1 && after === 0) {
        throw new ActionError(
          'No se puede modificar el rol: dejaría a la empresa sin un administrador capaz de gestionar usuarios y roles.',
          'LAST_MANAGER',
        );
      }
    }

    const actualizado = await prisma.$transaction(async (tx) => {
      const updated = await tx.tenantRole.update({
        where: { roleId: role.roleId },
        data: updateData,
      });

      // Mutación + auditoría atómicas (hallazgo #8).
      await AuditLogService.logStrict(
        {
          accion: 'UPDATE',
          entidad: 'TENANT_ROLE',
          entidadId: role.roleId,
          usuarioId: user.userId,
          detalles: { tenantId, roleId: role.roleId, cambios: updateData },
        },
        tx,
      );

      return updated;
    });

    revalidatePath(CONFIG_PATH);
    return { role: actualizado };
  },
);

/**
 * @description Elimina un rol personalizado del tenant. Bloqueado si tiene
 * membresías asignadas (mensaje con conteo); la FK además hace RESTRICT.
 * @param roleId - Identificador del rol.
 * @param user - Usuario autenticado.
 */
export const deleteTenantRoleAction = withAction(
  async (roleId: string, user: AuthenticatedUser) => {
    if (!z.string().min(1).safeParse(roleId).success) {
      throw new ActionError('Identificador de rol inválido', 'VALIDATION_ERROR');
    }
    requirePermission(user, GESTIONAR_USUARIOS, 'gestionar roles de la empresa');
    const tenantId = requireTenant(user);

    const role = await prisma.tenantRole.findFirst({ where: { roleId, tenantId } });
    if (!role) {
      throw new ActionError('Rol no encontrado', 'NOT_FOUND');
    }

    const miembrosAsignados = await prisma.tenantMembership.count({
      where: { tenantId, customRoleId: roleId },
    });
    if (miembrosAsignados > 0) {
      throw new ActionError(
        `No se puede eliminar el rol ${role.nombre}: ${miembrosAsignados} miembro(s) lo tienen asignado. Reasigna esos miembros a otro rol antes de eliminarlo.`,
        'ROLE_IN_USE',
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.tenantRole.delete({ where: { roleId: role.roleId } });

      // Mutación + auditoría atómicas (hallazgo #8).
      await AuditLogService.logStrict(
        {
          accion: 'DELETE',
          entidad: 'TENANT_ROLE',
          entidadId: role.roleId,
          usuarioId: user.userId,
          detalles: { tenantId, nombre: role.nombre },
        },
        tx,
      );
    });

    revalidatePath(CONFIG_PATH);
    return { deleted: true };
  },
);

/**
 * @description Asigna (o quita con null) un rol personalizado a una membresía
 * del mismo tenant. Guarda: el último manager activo no puede recibir un rol
 * custom (quedaría el tenant sin gestor pleno).
 * @param input - membershipId y customRoleId (null para quitar).
 * @param user - Usuario autenticado.
 */
export const assignCustomRoleAction = withAction(
  async (input: z.infer<typeof assignRoleSchema>, user: AuthenticatedUser) => {
    const data = assignRoleSchema.parse(input);
    requirePermission(user, GESTIONAR_USUARIOS, 'gestionar usuarios de la empresa');
    const tenantId = requireTenant(user);

    const membership = await prisma.tenantMembership.findFirst({
      where: { membershipId: data.membershipId, tenantId },
    });
    if (!membership) {
      throw new ActionError('Membresía no encontrada', 'NOT_FOUND');
    }

    if (data.customRoleId !== null) {
      // Solo roles ACTIVOS: asignar un rol inactivo sería una falsa promesa
      // (la resolución haría fallback a los defaults del rol fijo, mostrando
      // una restricción que en realidad no aplica).
      const role = await prisma.tenantRole.findFirst({
        where: { roleId: data.customRoleId, tenantId, isActive: true },
      });
      if (!role) {
        throw new ActionError('Rol no encontrado', 'NOT_FOUND');
      }

      // Guarda de último admin: asignar un rol sin capacidad administrativa al
      // último administrador efectivo dejaría al tenant sin gestor.
      const wasAdmin = await computeAdminStatus({
        tenantId,
        fixedRole: membership.tenantRole,
        isActive: membership.isActive,
        customRoleId: membership.customRoleId,
      });
      // El rol recuperado ya está garantizado activo (isActive: true en el query).
      const willBeAdmin = rolePermissionsIncludeAdmin(role.permissions);

      if (wasAdmin && !willBeAdmin && (await countEffectiveAdmins(tenantId)) <= 1) {
        throw new ActionError(
          'No se puede asignar un rol sin permisos de administración al último administrador activo de la empresa.',
          'LAST_MANAGER',
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.tenantMembership.update({
        where: { membershipId: membership.membershipId },
        data: { customRoleId: data.customRoleId },
      });

      // Mutación + auditoría atómicas (hallazgo #8).
      await AuditLogService.logStrict(
        {
          accion: 'UPDATE',
          entidad: 'TENANT_ROLE',
          entidadId: data.customRoleId ?? membership.membershipId,
          usuarioId: user.userId,
          detalles: {
            tenantId,
            membershipId: membership.membershipId,
            customRoleId: data.customRoleId,
            miembroConRolFijo: membership.tenantRole,
          },
        },
        tx,
      );
    });

    revalidatePath(CONFIG_PATH);
    return { assigned: data.customRoleId !== null };
  },
);
