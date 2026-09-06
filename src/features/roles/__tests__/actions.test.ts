/**
 * @description Tests RED del CRUD de roles personalizados (PG-04).
 * @param {void} No aplica.
 * @returns {void} Aserciones vitest sobre las acciones del feature roles.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/services/audit-log-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/services/audit-log-service')>();
  return { ...actual, AuditLogService: { ...actual.AuditLogService, log: vi.fn() } };
});
vi.mock('@/lib/prisma', () => ({
  prisma: {
    tenantRole: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    tenantMembership: {
      findFirst: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { AuditLogService } from '@/lib/services/audit-log-service';
import { getDefaultPermissionsForRole } from '@/lib/auth/permission-registry';
import {
  createTenantRoleAction,
  updateTenantRoleAction,
  deleteTenantRoleAction,
  assignCustomRoleAction,
} from '@/features/roles/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const managerUser = {
  userId: 'u-manager',
  name: 'Manager',
  email: 'm@test.com',
  role: 'regularUser',
  isActive: true,
  tenantId: 'tenant-1',
  tenantRole: 'manager',
  permissions: getDefaultPermissionsForRole('manager'),
} as unknown as AuthenticatedUser;

const dependienteUser = {
  userId: 'u-dep',
  name: 'Dependiente',
  email: 'd@test.com',
  role: 'regularUser',
  isActive: true,
  tenantId: 'tenant-1',
  tenantRole: 'dependiente',
  permissions: getDefaultPermissionsForRole('dependiente'),
} as unknown as AuthenticatedUser;

const baseRole = {
  roleId: 'role-1',
  tenantId: 'tenant-1',
  nombre: 'Cajero',
  descripcion: null,
  permissions: ['ventas.venta.registrar'],
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('createTenantRoleAction (PG-04 RED)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(managerUser);
    vi.mocked(prisma.tenantRole.findFirst).mockResolvedValue(null);
  });

  it('crea un rol válido y registra auditoría', async () => {
    vi.mocked(prisma.tenantRole.create).mockResolvedValue(baseRole as never);

    const result = await createTenantRoleAction({
      nombre: 'Cajero',
      permissions: ['ventas.venta.registrar'],
    });

    expect(result.success).toBe(true);
    expect(prisma.tenantRole.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: 'tenant-1', nombre: 'Cajero' }),
      }),
    );
    expect(vi.mocked(AuditLogService.log)).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'CREATE', entidadId: 'role-1', usuarioId: 'u-manager' }),
    );
  });

  it('rechaza claves de permisos desconocidas con detalle', async () => {
    const result = await createTenantRoleAction({
      nombre: 'X',
      permissions: ['inventario.productos.crear', 'clave.falsa.inventada'],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error?.message).toContain('clave.falsa.inventada');
    }
    expect(prisma.tenantRole.create).not.toHaveBeenCalled();
  });

  it('rechaza payload con campos extra (zod strict)', async () => {
    const result = await createTenantRoleAction({
      nombre: 'X',
      permissions: [],
      roleId: 'inyectado',
    } as never);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error?.code).toBe('VALIDATION_ERROR');
  });

  it('rechaza nombre vacío', async () => {
    const result = await createTenantRoleAction({ nombre: '  ', permissions: [] });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error?.code).toBe('VALIDATION_ERROR');
  });

  it('rechaza usuarios sin permiso config.usuarios.gestionar', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(dependienteUser);
    const result = await createTenantRoleAction({
      nombre: 'X',
      permissions: ['ventas.venta.registrar'],
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error?.code).toBe('FORBIDDEN');
    expect(prisma.tenantRole.create).not.toHaveBeenCalled();
  });

  it('rechaza nombre duplicado en el tenant con error tipado', async () => {
    vi.mocked(prisma.tenantRole.findFirst).mockResolvedValue(baseRole as never);
    const result = await createTenantRoleAction({
      nombre: 'Cajero',
      permissions: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error?.code).toBe('DUPLICATE');
      expect(result.error?.message).toContain('Cajero');
    }
  });
});

describe('updateTenantRoleAction (PG-04 RED)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(managerUser);
    vi.mocked(prisma.tenantRole.findFirst).mockResolvedValue(baseRole as never);
    vi.mocked(prisma.tenantRole.update).mockResolvedValue(baseRole as never);
  });

  it('actualiza nombre y permisos, valida contra registry y audita', async () => {
    const result = await updateTenantRoleAction({
      roleId: 'role-1',
      nombre: 'Cajero senior',
      permissions: ['ventas.venta.registrar', 'ventas.facturas.consultar'],
    });

    expect(result.success).toBe(true);
    expect(prisma.tenantRole.update).toHaveBeenCalled();
    expect(vi.mocked(AuditLogService.log)).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'UPDATE', entidadId: 'role-1' }),
    );
  });

  it('rechaza claves desconocidas y no persiste', async () => {
    const result = await updateTenantRoleAction({
      roleId: 'role-1',
      permissions: ['nada.real.aqui'],
    });
    expect(result.success).toBe(false);
    expect(prisma.tenantRole.update).not.toHaveBeenCalled();
  });

  it('devuelve NOT_FOUND si el rol no existe en el tenant del usuario', async () => {
    vi.mocked(prisma.tenantRole.findFirst).mockResolvedValue(null);
    const result = await updateTenantRoleAction({ roleId: 'role-ajena', nombre: 'X' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error?.code).toBe('NOT_FOUND');
  });
});

describe('deleteTenantRoleAction (PG-04 RED)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(managerUser);
    vi.mocked(prisma.tenantRole.findFirst).mockResolvedValue(baseRole as never);
  });

  it('borra un rol sin miembros y audita', async () => {
    vi.mocked(prisma.tenantMembership.count).mockResolvedValue(0 as never);
    vi.mocked(prisma.tenantRole.delete).mockResolvedValue(baseRole as never);

    const result = await deleteTenantRoleAction('role-1');

    expect(result.success).toBe(true);
    expect(prisma.tenantRole.delete).toHaveBeenCalledWith({ where: { roleId: 'role-1' } });
    expect(vi.mocked(AuditLogService.log)).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'DELETE', entidadId: 'role-1' }),
    );
  });

  it('bloquea el borrado con miembros asignados e informa el conteo', async () => {
    vi.mocked(prisma.tenantMembership.count).mockResolvedValue(3 as never);

    const result = await deleteTenantRoleAction('role-1');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error?.code).toBe('ROLE_IN_USE');
      expect(result.error?.message).toContain('3');
    }
    expect(prisma.tenantRole.delete).not.toHaveBeenCalled();
  });

  it('devuelve NOT_FOUND para rol ajeno al tenant', async () => {
    vi.mocked(prisma.tenantRole.findFirst).mockResolvedValue(null);
    const result = await deleteTenantRoleAction('role-ajena');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error?.code).toBe('NOT_FOUND');
  });
});

describe('assignCustomRoleAction (PG-04 RED)', () => {
  const membership = {
    membershipId: 'mem-1',
    tenantId: 'tenant-1',
    userId: 'u-otro',
    tenantRole: 'dependiente',
    isActive: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(managerUser);
    vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValue(membership as never);
    vi.mocked(prisma.tenantRole.findFirst).mockResolvedValue(baseRole as never);
    vi.mocked(prisma.tenantMembership.update).mockResolvedValue(membership as never);
    // Por defecto hay otro manager además del objetivo
    vi.mocked(prisma.tenantMembership.count).mockResolvedValue(2 as never);
  });

  it('asigna un rol custom a una membresía del mismo tenant y audita', async () => {
    const result = await assignCustomRoleAction({ membershipId: 'mem-1', customRoleId: 'role-1' });

    expect(result.success).toBe(true);
    expect(prisma.tenantMembership.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { membershipId: 'mem-1' },
        data: { customRoleId: 'role-1' },
      }),
    );
    expect(vi.mocked(AuditLogService.log)).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'UPDATE', usuarioId: 'u-manager' }),
    );
  });

  it('permite quitar la asignación (customRoleId: null)', async () => {
    const result = await assignCustomRoleAction({ membershipId: 'mem-1', customRoleId: null });
    expect(result.success).toBe(true);
    expect(prisma.tenantMembership.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { customRoleId: null } }),
    );
  });

  it('rechaza membresía de otro tenant con NOT_FOUND', async () => {
    vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValue(null);
    const result = await assignCustomRoleAction({ membershipId: 'mem-ajena', customRoleId: 'role-1' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error?.code).toBe('NOT_FOUND');
  });

  it('rechaza rol custom de otro tenant con NOT_FOUND', async () => {
    vi.mocked(prisma.tenantRole.findFirst).mockResolvedValue(null);
    const result = await assignCustomRoleAction({ membershipId: 'mem-1', customRoleId: 'role-ajeno' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error?.code).toBe('NOT_FOUND');
    expect(prisma.tenantMembership.update).not.toHaveBeenCalled();
  });

  it('bloqueo del último manager: no asignar custom role si es el único manager activo', async () => {
    vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValue({
      ...membership,
      tenantRole: 'manager',
    } as never);
    // Solo ese manager activo en el tenant
    vi.mocked(prisma.tenantMembership.count).mockResolvedValue(1 as never);

    const result = await assignCustomRoleAction({ membershipId: 'mem-1', customRoleId: 'role-1' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error?.code).toBe('LAST_MANAGER');
    }
    expect(prisma.tenantMembership.update).not.toHaveBeenCalled();
  });

  it('permite la asignación a un manager cuando hay otro manager activo', async () => {
    vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValue({
      ...membership,
      tenantRole: 'manager',
    } as never);
    vi.mocked(prisma.tenantMembership.count).mockResolvedValue(2 as never);

    const result = await assignCustomRoleAction({ membershipId: 'mem-1', customRoleId: 'role-1' });
    expect(result.success).toBe(true);
  });
});
