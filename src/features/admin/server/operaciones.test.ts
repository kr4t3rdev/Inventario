import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    tenant: {
      findMany: vi.fn(),
    },
    venta: {
      aggregate: vi.fn(),
    },
    compraProducto: {
      aggregate: vi.fn(),
    },
    producto: {
      findMany: vi.fn(),
    },
    categoria: {
      findMany: vi.fn(),
    },
    unidad: {
      findMany: vi.fn(),
    },
    vendor: {
      findMany: vi.fn(),
    },
    puntoDeVenta: {
      findMany: vi.fn(),
    },
    listaPrecio: {
      findMany: vi.fn(),
    },
  },
}));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import { getGlobalMastersHealthAction } from './operaciones';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const managerUser: AuthenticatedUser = {
  userId: 'user-manager',
  name: 'Manager',
  email: 'manager@test.com',
  role: 'user',
  isActive: true,
  tenantId: 'tenant-A',
  tenantRole: 'manager',
};

describe('operaciones server actions authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('non-admin cannot access getGlobalMastersHealthAction', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(managerUser);

    const result = await getGlobalMastersHealthAction(undefined as never);

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected authorization failure');
    }
    expect(result.error.code).toBe('FORBIDDEN');
    expect(prisma.tenant.findMany).not.toHaveBeenCalled();
  });
});
