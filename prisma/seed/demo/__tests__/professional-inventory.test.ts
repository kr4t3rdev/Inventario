import { describe, expect, it, vi } from 'vitest';

import { seedProfessionalExtras } from '../professional-seed';

function createSeedClient() {
  return {
    moneda: { upsert: vi.fn() },
    cuentaBancaria: { upsert: vi.fn() },
    categoria: { upsert: vi.fn(), findFirst: vi.fn() },
    unidad: { upsert: vi.fn(), findFirst: vi.fn() },
    unidadConversion: { upsert: vi.fn() },
    vendor: { upsert: vi.fn(), findFirst: vi.fn() },
    cliente: {
      upsert: vi.fn(),
      findFirst: vi.fn().mockResolvedValue({ clienteId: 'demo_base_cli_001' }),
    },
    almacen: { upsert: vi.fn(), findFirst: vi.fn() },
    listaPrecio: { upsert: vi.fn(), findFirst: vi.fn() },
    puntoDeVenta: {
      upsert: vi.fn(),
      findFirst: vi.fn().mockResolvedValue({ pvId: 'demo_base_pv' }),
    },
    producto: { upsert: vi.fn(), findFirst: vi.fn().mockResolvedValue({ id: 'demo-product' }) },
    precioProducto: { upsert: vi.fn(), findFirst: vi.fn() },
    venta: { create: vi.fn().mockResolvedValue({ ventaId: 'venta-demo' }), update: vi.fn() },
    ventaItem: { createMany: vi.fn() },
    lote: { upsert: vi.fn() },
    ubicacion: { upsert: vi.fn() },
    stockUbicacion: { upsert: vi.fn() },
    stockUbicacionDetalle: { upsert: vi.fn() },
  };
}

describe('seed Profesional de lotes y ubicaciones', () => {
  it('crea lotes con vencimiento y stock reconciliado por hojas tenant-scoped', async () => {
    const client = createSeedClient();

    await seedProfessionalExtras({ tenantId: 'tenant-pro' }, client as never);

    expect(client.ubicacion.upsert).toHaveBeenCalledTimes(6);
    expect(client.lote.upsert).toHaveBeenCalledTimes(4);
    expect(client.stockUbicacion.upsert).toHaveBeenCalledTimes(2);
    expect(client.stockUbicacionDetalle.upsert).toHaveBeenCalledTimes(4);

    for (const call of client.ubicacion.upsert.mock.calls) {
      expect(call[0].where).toEqual({
        tenantId_almacenId_id: expect.objectContaining({ tenantId: 'tenant-pro' }),
      });
      expect(call[0].create.tenantId).toBe('tenant-pro');
    }
    const ubicacionesHoja = client.ubicacion.upsert.mock.calls
      .map(([args]) => args.create)
      .filter((ubicacion) => ubicacion.tipo === 'HOJA');
    expect(ubicacionesHoja).toHaveLength(4);
    expect(ubicacionesHoja.every((ubicacion) => ubicacion.parentId)).toBe(true);

    for (const call of client.lote.upsert.mock.calls) {
      const { create, where } = call[0];
      expect(where.tenantId_productoId_codigo.tenantId).toBe('tenant-pro');
      expect(create.tenantId).toBe('tenant-pro');
      expect(create.cantidadInicial).toBeGreaterThan(0);
      expect(create.cantidadDisponible).toBe(create.cantidadInicial);
      expect(create.fechaVencimiento).toBeInstanceOf(Date);
      expect(create.fechaVencimiento.getTime()).toBeGreaterThan(Date.now());
    }
    const ventanaAlertaMs = 30 * 24 * 60 * 60 * 1000;
    expect(
      client.lote.upsert.mock.calls.some(([args]) =>
        args.create.fechaVencimiento.getTime() <= Date.now() + ventanaAlertaMs,
      ),
    ).toBe(true);

    const stockByWarehouse = new Map(
      client.stockUbicacion.upsert.mock.calls.map(([args]) => [
        args.where.productoId_tipoUbicacion_ubicacionId.productoId,
        args.create.cantidad,
      ]),
    );
    const detailTotals = new Map<string, number>();
    for (const [args] of client.stockUbicacionDetalle.upsert.mock.calls) {
      const productoId = args.create.productoId;
      detailTotals.set(productoId, (detailTotals.get(productoId) ?? 0) + args.create.cantidad);
    }
    expect(detailTotals).toEqual(stockByWarehouse);
  });

  it('usa identificadores deterministas e independientes por tenant', async () => {
    const first = createSeedClient();
    const second = createSeedClient();

    await seedProfessionalExtras({ tenantId: 'tenant-a' }, first as never);
    await seedProfessionalExtras({ tenantId: 'tenant-b' }, second as never);

    const idsFor = (client: ReturnType<typeof createSeedClient>) => [
      ...client.ubicacion.upsert.mock.calls.map(([args]) => args.create.id),
      ...client.stockUbicacionDetalle.upsert.mock.calls.map(([args]) => args.create.ubicacionHijaId),
    ];
    expect(idsFor(first)).not.toEqual(idsFor(second));
    expect(JSON.stringify(idsFor(first))).toContain('tenant-a');
    expect(JSON.stringify(idsFor(second))).toContain('tenant-b');
  });
});
