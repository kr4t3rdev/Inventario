import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server-actions/get-current-user', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    tenant: {
      findMany: vi.fn(),
    },
    merma: {
      aggregate: vi.fn(),
    },
    venta: {
      aggregate: vi.fn(),
    },
    compraProducto: {
      aggregate: vi.fn(),
    },
    gastosDE: {
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

import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { prisma } from '@/lib/prisma';
import {
  getGlobalBillingHealthAction,
  getGlobalExpenseHealthAction,
  getGlobalMastersHealthAction,
  getGlobalOffersServicesHealthAction,
  getGlobalPurchaseHealthAction,
  getGlobalSalesHealthAction,
  getGlobalWastageHealthAction,
  getTenantFeatureDataAction,
} from './operaciones';

const managerUser: AuthenticatedUser = {
  userId: 'user-manager',
  name: 'Manager',
  email: 'manager@test.com',
  role: 'user',
  isActive: true,
  tenantId: 'tenant-A',
  tenantRole: 'manager',
};

const protectedActions = [
  {
    name: 'getGlobalMastersHealthAction',
    action: () => getGlobalMastersHealthAction(undefined as never),
  },
  {
    name: 'getGlobalSalesHealthAction',
    action: () => getGlobalSalesHealthAction(undefined as never),
  },
  {
    name: 'getGlobalPurchaseHealthAction',
    action: () => getGlobalPurchaseHealthAction(undefined as never),
  },
  {
    name: 'getGlobalWastageHealthAction',
    action: () => getGlobalWastageHealthAction(undefined as never),
  },
  {
    name: 'getGlobalBillingHealthAction',
    action: () => getGlobalBillingHealthAction(undefined as never),
  },
  {
    name: 'getGlobalOffersServicesHealthAction',
    action: () => getGlobalOffersServicesHealthAction(undefined as never),
  },
  {
    name: 'getGlobalExpenseHealthAction',
    action: () => getGlobalExpenseHealthAction(undefined as never),
  },
  {
    name: 'getTenantFeatureDataAction',
    action: () =>
      getTenantFeatureDataAction({
        tenantId: 'tenant-A',
        feature: 'categorias',
      }),
  },
] as const;

describe('operaciones server actions authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(managerUser);
  });

  it.each(protectedActions)('non-admin cannot access $name', async ({ action, name }) => {
    const result = await action();

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error(`Expected authorization failure for ${name}`);
    }
    expect(result.error.code).toBe('FORBIDDEN');
  });

  it('does not query tenants when getGlobalMastersHealthAction is forbidden', async () => {
    const result = await getGlobalMastersHealthAction(undefined as never);

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected authorization failure');
    }
    expect(result.error.code).toBe('FORBIDDEN');
    expect(prisma.tenant.findMany).not.toHaveBeenCalled();
  });
});

const adminUser: AuthenticatedUser = {
  userId: 'user-admin',
  name: 'Admin',
  email: 'admin@test.com',
  role: 'admin',
  isActive: true,
  tenantId: 'tenant-A',
  tenantRole: 'admin',
};

describe('operaciones metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
  });

  it('calculates wastage total value from tenant wastage rows', async () => {
    vi.mocked(prisma.tenant.findMany).mockResolvedValue([
      {
        tenantId: 't1',
        nombre: 'Tenant 1',
        slug: 'tenant-1',
        _count: { mermas: 2 },
        licencias: [{ plan: { nombre: 'Pro' } }],
      },
    ] as never);
    vi.mocked(prisma.merma.aggregate).mockResolvedValue({
      _sum: { costoTotal: 1250 },
    } as never);

    const result = await getGlobalWastageHealthAction(undefined as never);

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error('Expected wastage metrics success');
    }
    expect(result.data?.wastageHealth[0].metrics.mermasTotalValue).toBe(1250);
  });

  it('calculates expense total amount instead of returning zero placeholder', async () => {
    vi.mocked(prisma.tenant.findMany).mockResolvedValue([
      {
        tenantId: 't1',
        nombre: 'Tenant 1',
        slug: 'tenant-1',
        _count: { gastosDE: 3 },
        licencias: [{ plan: { nombre: 'Pro' } }],
      },
    ] as never);
    vi.mocked(prisma.gastosDE.aggregate).mockResolvedValue({
      _sum: { monto: 780 },
    } as never);

    const result = await getGlobalExpenseHealthAction(undefined as never);

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error('Expected expense metrics success');
    }
    expect(result.data?.expenseHealth[0].metrics.gastosTotal).toBe(780);
  });
});
