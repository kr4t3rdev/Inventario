/**
 * @description Tests unitarios para filtros y métricas de licencias paginadas.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('@/lib/prisma', () => {
  const prismaMock = {
    tenantLicense: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  };

  return {
    prisma: prismaMock,
    default: prismaMock,
  };
});

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import {
  getLicenciasPaginatedAction,
  getLicenciasStatsAction,
} from '@/features/admin/actions-licencias';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const adminUser: AuthenticatedUser = {
  userId: 'user-admin',
  name: 'Admin',
  email: 'admin@test.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-admin',
  tenantRole: 'admin',
};

describe('Admin license filters actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
  });

  it('filtra licencias de prueba admin en la tabla paginada', async () => {
    vi.mocked(prisma.tenantLicense.findMany).mockResolvedValue([]);
    vi.mocked(prisma.tenantLicense.count).mockResolvedValue(0 as any);

    const r = await getLicenciasPaginatedAction({
      page: 1,
      limit: 25,
      typeFilter: 'admin_test',
    });

    expect(r.success).toBe(true);
    expect(prisma.tenantLicense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isAdminTest: true,
        }),
      }),
    );
    expect(prisma.tenantLicense.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        isAdminTest: true,
      }),
    });
  });

  it('devuelve el conteo de licencias de prueba admin en métricas', async () => {
    vi.mocked(prisma.tenantLicense.count)
      .mockResolvedValueOnce(12 as any)
      .mockResolvedValueOnce(8 as any)
      .mockResolvedValueOnce(2 as any)
      .mockResolvedValueOnce(3 as any)
      .mockResolvedValueOnce(1 as any)
      .mockResolvedValueOnce(4 as any);

    const r = await getLicenciasStatsAction({
      typeFilter: 'all',
    });

    expect(r.success).toBe(true);
    expect(r.data).toEqual({
      total: 12,
      activas: 8,
      expiradas: 2,
      demos: 3,
      porVencer: 1,
      adminTest: 4,
    });
    expect(prisma.tenantLicense.count).toHaveBeenLastCalledWith({
      where: {
        AND: [
          {},
          { isAdminTest: true },
        ],
      },
    });
  });
});
