/**
 * @description Tests de la lista de firmantes disponibles para un contrato.
 *
 * La firma de un contrato exige que el firmante sea miembro del tenant
 * (`usuarioEsMiembroDelTenant` en el handler). La UI necesita el padrón de
 * miembros activos para ofrecerlo en el diálogo de firma, por lo que la
 * lista debe estar acotada al tenant activo y a los permisos de contratos.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { expectActionFailure, expectActionSuccess } from '@/test/action-response';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    tenantMembership: { findMany: vi.fn() },
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { getFirmantesAction } from '@/features/contratos/actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const manager: AuthenticatedUser = {
  userId: 'user-1', name: 'Manager', email: 'manager@test.com',
  role: 'regularUser', isActive: true, tenantId: 'tenant-A', tenantRole: 'manager',
  planFeatures: { contratos: true },
  permissions: new Set(['ventas.contratos.gestionar']),
};

const sinPermiso: AuthenticatedUser = {
  ...manager,
  userId: 'user-2',
  permissions: new Set(['ventas.venta.registrar']),
};

describe('getFirmantesAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(manager);
    vi.mocked(prisma.tenantMembership.findMany).mockResolvedValue([
      { userId: 'user-1', user: { name: 'Ana Pérez' } },
      { userId: 'user-2', user: { name: 'Luis Gómez' } },
    ] as never);
  });

  it('lista los miembros activos del tenant con su nombre', async () => {
    const result = await getFirmantesAction();

    expect(result.success).toBe(true);
    expect(expectActionSuccess(result).data!.firmantes).toEqual([
      { userId: 'user-1', name: 'Ana Pérez' },
      { userId: 'user-2', name: 'Luis Gómez' },
    ]);
  });

  it('acota la consulta al tenant activo y a las membresías activas', async () => {
    await getFirmantesAction();

    expect(prisma.tenantMembership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-A', isActive: true }),
      }),
    );
  });

  it('exige el permiso de gestión de contratos', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(sinPermiso);

    const result = await getFirmantesAction();

    expect(result.success).toBe(false);
    expect(expectActionFailure(result).error!.code).toBe('FORBIDDEN');
    expect(prisma.tenantMembership.findMany).not.toHaveBeenCalled();
  });

  it('exige membresía de tenant', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ ...manager, tenantId: undefined });

    const result = await getFirmantesAction();

    expect(result.success).toBe(false);
    expect(expectActionFailure(result).error!.code).toBe('TENANT_REQUIRED');
    expect(prisma.tenantMembership.findMany).not.toHaveBeenCalled();
  });
});
