import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../prisma/seed/implementation-seed', () => ({
  seedImplementationData: vi.fn(),
}));

import { seedImplementationData } from '../../../../prisma/seed/implementation-seed';
import { resolveSeedProfile, seedDemoTenantData } from '../demo-seed';

describe('demo-seed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps plan names to seed profiles', () => {
    expect(resolveSeedProfile('Básico')).toBe('basic');
    expect(resolveSeedProfile('Profesional')).toBe('professional');
    expect(resolveSeedProfile('Empresarial')).toBe('enterprise');
  });

  it('passes the target tenantId into the implementation seed', async () => {
    const result = await seedDemoTenantData({
      tenantId: 'tenant-demo-77',
      planName: 'Profesional',
    });

    expect(seedImplementationData).toHaveBeenCalledWith({
      tenantId: 'tenant-demo-77',
    });

    expect(result).toEqual({
      tenantId: 'tenant-demo-77',
      planName: 'Profesional',
      profile: 'professional',
    });
  });
});
