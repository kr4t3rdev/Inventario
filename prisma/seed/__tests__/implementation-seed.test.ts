import { describe, expect, it, vi } from 'vitest';
import { seedImplementationData } from '../implementation-seed';

function createMockClient() {
  return {
    moneda: { upsert: vi.fn().mockResolvedValue(undefined) },
    tipoPago: { upsert: vi.fn().mockResolvedValue(undefined) },
    cuentaBancaria: { upsert: vi.fn().mockResolvedValue(undefined) },
    categoria: { upsert: vi.fn().mockResolvedValue(undefined) },
    unidad: { upsert: vi.fn().mockResolvedValue(undefined) },
    vendor: { upsert: vi.fn().mockResolvedValue(undefined) },
    cliente: { upsert: vi.fn().mockResolvedValue(undefined) },
    almacen: { upsert: vi.fn().mockResolvedValue(undefined) },
    listaPrecio: { upsert: vi.fn().mockResolvedValue(undefined) },
    puntoDeVenta: { upsert: vi.fn().mockResolvedValue(undefined) },
    producto: { upsert: vi.fn().mockResolvedValue(undefined) },
    precioProducto: { upsert: vi.fn().mockResolvedValue(undefined) },
  };
}

describe('seedImplementationData', () => {
  it('writes tenant-scoped demo data using the provided tenantId', async () => {
    const client = createMockClient();

    await seedImplementationData({ tenantId: 'tenant-demo-42' }, client as any);

    expect(client.cuentaBancaria.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ tenantId: 'tenant-demo-42' }),
      }),
    );

    expect(client.categoria.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ tenantId: 'tenant-demo-42' }),
      }),
    );

    expect(client.producto.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ tenantId: 'tenant-demo-42' }),
      }),
    );
  });

  it('keeps currencies shared while scoping payment types to the tenant', async () => {
    const client = createMockClient();

    await seedImplementationData({ tenantId: 'tenant-demo-99' }, client as any);

    expect(client.moneda.upsert).toHaveBeenCalled();
    expect(client.tipoPago.upsert).toHaveBeenCalled();

    expect(client.moneda.upsert).toHaveBeenCalledWith(
      expect.not.objectContaining({
        create: expect.objectContaining({ tenantId: expect.anything() }),
      }),
    );

    expect(client.tipoPago.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tipoId: expect.stringContaining('tenant-demo-99'),
        }),
        create: expect.objectContaining({ tenantId: 'tenant-demo-99' }),
      }),
    );
  });
});
