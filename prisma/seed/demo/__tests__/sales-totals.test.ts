import { beforeEach, describe, expect, it, vi } from 'vitest';

import { seedProfessionalExtras } from '../professional-seed';
import { seedEnterpriseExtras } from '../enterprise-seed';
import { seedBaseDemoData } from '../base-seed';

function createSeedClient() {
  return {
    moneda: { upsert: vi.fn() },
    tipoPago: { upsert: vi.fn() },
    cuentaBancaria: { upsert: vi.fn() },
    categoria: { upsert: vi.fn() },
    unidad: { upsert: vi.fn() },
    vendor: { upsert: vi.fn() },
    cliente: {
      upsert: vi.fn(),
      findFirst: vi.fn().mockResolvedValue({ clienteId: 'demo_base_cli_001' }),
    },
    almacen: { upsert: vi.fn() },
    listaPrecio: { upsert: vi.fn() },
    puntoDeVenta: {
      upsert: vi.fn(),
      findFirst: vi.fn().mockResolvedValue({ pvId: 'demo_base_pv' }),
    },
    producto: {
      upsert: vi.fn(),
      findFirst: vi.fn().mockResolvedValue({ id: 'base-product' }),
    },
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

  it('base seed creates tenant-scoped payment types with tenant-specific ids', async () => {
    const client = createSeedClient();

    await seedBaseDemoData({ tenantId: 'tenant-demo' }, client as never);

    expect(client.tipoPago.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tipoId: expect.stringContaining('tenant-demo'),
        }),
        create: expect.objectContaining({ tenantId: 'tenant-demo' }),
      }),
    );
  });

  it('base seed derives every tenant-owned identifier and reference from tenantId', async () => {
    const first = createSeedClient();
    const second = createSeedClient();

    await seedBaseDemoData({ tenantId: 'tenant-a' }, first as never);
    await seedBaseDemoData({ tenantId: 'tenant-b' }, second as never);

    const firstCalls = [
      ...first.cuentaBancaria.upsert.mock.calls,
      ...first.categoria.upsert.mock.calls,
      ...first.unidad.upsert.mock.calls,
      ...first.vendor.upsert.mock.calls,
      ...first.cliente.upsert.mock.calls,
      ...first.almacen.upsert.mock.calls,
      ...first.listaPrecio.upsert.mock.calls,
      ...first.puntoDeVenta.upsert.mock.calls,
      ...first.producto.upsert.mock.calls,
      ...first.precioProducto.upsert.mock.calls,
    ];
    const secondCalls = [
      ...second.cuentaBancaria.upsert.mock.calls,
      ...second.categoria.upsert.mock.calls,
      ...second.unidad.upsert.mock.calls,
      ...second.vendor.upsert.mock.calls,
      ...second.cliente.upsert.mock.calls,
      ...second.almacen.upsert.mock.calls,
      ...second.listaPrecio.upsert.mock.calls,
      ...second.puntoDeVenta.upsert.mock.calls,
      ...second.producto.upsert.mock.calls,
      ...second.precioProducto.upsert.mock.calls,
    ];

    expect(firstCalls).not.toEqual(secondCalls);
    expect(JSON.stringify(firstCalls)).toContain('tenant-a');
    expect(JSON.stringify(secondCalls)).toContain('tenant-b');
    expect(JSON.stringify(firstCalls)).not.toContain('tenant-b');
    expect(JSON.stringify(secondCalls)).not.toContain('tenant-a');
  });
});
