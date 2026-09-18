import { describe, expect, it, vi } from 'vitest';
import { seedContabilidad } from '../contabilidad-seed';

describe('seedContabilidad', () => {
  it('uses idempotent writes for tenant-scoped accounting fixtures', async () => {
    const client = {
      moneda: { upsert: vi.fn().mockResolvedValue(undefined) },
      tasaCambio: { upsert: vi.fn().mockResolvedValue(undefined) },
      tipoPago: { upsert: vi.fn().mockResolvedValue(undefined) },
      cuentaBancaria: { upsert: vi.fn().mockResolvedValue(undefined) },
    };

    await seedContabilidad(client as any);

    expect(client.tasaCambio.upsert).toHaveBeenCalledTimes(2);
    expect(client.cuentaBancaria.upsert).toHaveBeenCalledTimes(3);
    expect(client.cuentaBancaria.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_numeroCuenta: {
            tenantId: 'demo-tenant',
            numeroCuenta: '9200-0000-0001',
          },
        },
        create: expect.objectContaining({ tenantId: 'demo-tenant' }),
      }),
    );
  });
});
