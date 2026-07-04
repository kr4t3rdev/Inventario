import { describe, expect, it, vi } from 'vitest';

import { buildTenantLicenseSeedData } from '../tenant-licenses-seed';

describe('buildTenantLicenseSeedData', () => {
  it('crea licencias nuevas sin snapshot legacy de features', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-03T12:00:00.000Z'));

    const data = buildTenantLicenseSeedData('tenant-1', {
      planId: 'plan-basic',
      maxUsuarios: 3,
      maxAlmacenes: 2,
      maxProductos: 500,
      maxClientes: 0,
    });

    expect(data).toMatchObject({
      tenantId: 'tenant-1',
      planId: 'plan-basic',
      activa: true,
      maxUsuarios: 3,
      maxAlmacenes: 2,
      maxProductos: 500,
      maxClientes: 0,
      features: null,
      featureOverrides: {},
    });

    expect(data.inicio).toEqual(new Date('2026-07-03T12:00:00.000Z'));
    expect(data.expiracion).toEqual(new Date('2027-07-03T12:00:00.000Z'));

    vi.useRealTimers();
  });
});
