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

    const role = await prisma.tenantRole.create({
      data: {
        tenantId,
        nombre: data.nombre,
        descripcion: data.descripcion ?? null,
        permissions: data.permissions,
      },
    });

    await AuditLogService.log({
      accion: 'CREATE',
      entidad: 'TENANT_ROLE',
      entidadId: role.roleId,
      usuarioId: user.userId,
      detalles: { tenantId, nombre: role.nombre, permissions: role.permissions },
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

    const actualizado = await prisma.tenantRole.update({
      where: { roleId: role.roleId },
      data: updateData,
    });

    await AuditLogService.log({
      accion: 'UPDATE',
      entidad: 'TENANT_ROLE',
      entidadId: role.roleId,
      usuarioId: user.userId,
      detalles: { tenantId, roleId: role.roleId, cambios: updateData },
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

    await prisma.tenantRole.delete({ where: { roleId: role.roleId } });

    await AuditLogService.log({
      accion: 'DELETE',
      entidad: 'TENANT_ROLE',
      entidadId: role.roleId,
      usuarioId: user.userId,
      detalles: { tenantId, nombre: role.nombre },
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
      const role = await prisma.tenantRole.findFirst({
        where: { roleId: data.customRoleId, tenantId },
      });
      if (!role) {
        throw new ActionError('Rol no encontrado', 'NOT_FOUND');
      }

      if (membership.tenantRole === 'manager') {
        const managersActivos = await prisma.tenantMembership.count({
          where: { tenantId, tenantRole: 'manager', isActive: true },
        });
        if (managersActivos <= 1) {
          throw new ActionError(
            'No se puede asignar un rol personalizado al último manager activo del tenant. Asigna otro manager antes de continuar.',
            'LAST_MANAGER',
          );
        }
      }
    }

    await prisma.tenantMembership.update({
      where: { membershipId: membership.membershipId },
      data: { customRoleId: data.customRoleId },
    });

    await AuditLogService.log({
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
    });

    revalidatePath(CONFIG_PATH);
    return { assigned: data.customRoleId !== null };
  },
);
