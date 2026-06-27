import { beforeEach, describe, expect, it, vi } from 'vitest';

import { seedProfessionalExtras } from '../professional-seed';
import { seedEnterpriseExtras } from '../enterprise-seed';

function createSeedClient() {
  return {
    moneda: { upsert: vi.fn() },
    cuentaBancaria: { upsert: vi.fn() },
    categoria: { upsert: vi.fn() },
    unidad: { upsert: vi.fn() },
    vendor: { upsert: vi.fn() },
    cliente: { upsert: vi.fn() },
    almacen: { upsert: vi.fn() },
    listaPrecio: { upsert: vi.fn() },
    puntoDeVenta: { upsert: vi.fn() },
    producto: { upsert: vi.fn() },
    precioProducto: { upsert: vi.fn() },
    venta: {
      create: vi
        .fn()
        .mockResolvedValueOnce({ ventaId: 'venta-pro-1' })
        .mockResolvedValue({ ventaId: 'venta-generic' }),
      update: vi.fn(),
    },
    ventaItem: { createMany: vi.fn() },
    ventaServicios: { create: vi.fn() },
    gastoCompra: { create: vi.fn() },
    stockUbicacion: { create: vi.fn() },
    transferencia: { create: vi.fn() },
  };
}

describe('demo sales totals seed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('professional seed actualiza total y subtotal de ventas demo', async () => {
    const client = createSeedClient();

    await seedProfessionalExtras({ tenantId: 'tenant-pro' }, client as never);

    expect(client.venta.update).toHaveBeenCalledWith({
      where: { ventaId: 'venta-pro-1' },
      data: {
        subtotal: 740,
        total: 740,
      },
    });
  });

  it('enterprise seed actualiza total y subtotal de ventas demo', async () => {
    const client = createSeedClient();
    client.venta.create = vi
      .fn()
      .mockResolvedValueOnce({ ventaId: 'venta-emp-1' })
      .mockResolvedValue({ ventaId: 'venta-generic' });

    await seedEnterpriseExtras({ tenantId: 'tenant-emp' }, client as never);

    expect(client.venta.update).toHaveBeenCalledWith({
      where: { ventaId: 'venta-emp-1' },
      data: {
        subtotal: 1200,
        total: 1200,
      },
    });
  });
});
