import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../prisma/seed/demo/base-seed', () => ({
  seedBaseDemoData: vi.fn(),
}));

vi.mock('../../../../prisma/seed/demo/professional-seed', () => ({
  seedProfessionalExtras: vi.fn(),
}));

vi.mock('../../../../prisma/seed/demo/enterprise-seed', () => ({
  seedEnterpriseExtras: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<void>) => {
      const tx = {} as unknown;
      return callback(tx);
    }),
  },
}));

import { prisma } from '@/lib/prisma';
import { seedBaseDemoData } from '../../../../prisma/seed/demo/base-seed';
import { seedProfessionalExtras } from '../../../../prisma/seed/demo/professional-seed';
import { seedEnterpriseExtras } from '../../../../prisma/seed/demo/enterprise-seed';
import { resolveSeedProfile, seedDemoTenantData } from '../demo-seed';

describe('demo-seed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps plan names to seed profiles', () => {
    expect(resolveSeedProfile('Básico')).toBe('basic');
    expect(resolveSeedProfile('Profesional')).toBe('professional');
    expect(resolveSeedProfile('Empresarial')).toBe('enterprise');
    expect(resolveSeedProfile('enterprise')).toBe('enterprise');
  });

  it('Básico: solo ejecuta el seed base', async () => {
    const result = await seedDemoTenantData({
      tenantId: 'tenant-demo-77',
      planName: 'Básico',
    });

    expect(seedBaseDemoData).toHaveBeenCalledWith(
      { tenantId: 'tenant-demo-77' },
      expect.any(Object),
    );
    expect(seedProfessionalExtras).not.toHaveBeenCalled();
    expect(seedEnterpriseExtras).not.toHaveBeenCalled();

    expect(result).toEqual({
      tenantId: 'tenant-demo-77',
      planName: 'Básico',
      profile: 'basic',
    });
  });

  it('Profesional: ejecuta base + extras profesional', async () => {
    await seedDemoTenantData({
      tenantId: 'tenant-demo-88',
      planName: 'Profesional',
    });

    expect(seedBaseDemoData).toHaveBeenCalledWith(
      { tenantId: 'tenant-demo-88' },
      expect.any(Object),
    );
    expect(seedProfessionalExtras).toHaveBeenCalledWith(
      { tenantId: 'tenant-demo-88' },
      expect.any(Object),
    );
    expect(seedEnterpriseExtras).not.toHaveBeenCalled();
  });

  it('Empresarial: ejecuta base + profesional + empresarial', async () => {
    await seedDemoTenantData({
      tenantId: 'tenant-demo-99',
      planName: 'Empresarial',
    });

    expect(seedBaseDemoData).toHaveBeenCalled();
    expect(seedProfessionalExtras).toHaveBeenCalledWith(
      { tenantId: 'tenant-demo-99' },
      expect.any(Object),
    );
    expect(seedEnterpriseExtras).toHaveBeenCalledWith(
      { tenantId: 'tenant-demo-99' },
      expect.any(Object),
    );
  });

  it('usa transacción de Prisma para todos los seeds', async () => {
    await seedDemoTenantData({ tenantId: 't-1', planName: 'Empresarial' });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    // Cada seed recibe el tx client como segundo argumento
    const txClient = vi.mocked(prisma.$transaction).mock.calls[0]?.[0];
    expect(txClient).toBeInstanceOf(Function);
  });
});
