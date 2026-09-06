import { describe, expect, it, vi } from 'vitest';

import {
  getKardex,
  getMovimientosDeOrigen,
  registrarMovimiento,
  revertirMovimientosDeOrigen,
} from '@/features/inventario/movimientos';

function createStore() {
  return {
    stockMoveLine: {
      upsert: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
  };
}

describe('registrarMovimiento', () => {
  it('registra una salida con cantidad negativa y upsert idempotente por evento', async () => {
    const store = createStore();
    store.stockMoveLine.upsert.mockResolvedValue({
      id: 'move-1',
      cantidad: -3,
    });

    await registrarMovimiento(store, {
      tenantId: 'tenant-1',
      productoId: 'producto-1',
      tipoOrigen: 'VENTA',
      origenId: 'venta-1',
      tipoUbicacion: 'punto_venta',
      ubicacionId: 'pv-1',
      cantidad: -3,
      costoUnitario: 100,
      secuencia: 'ITEM-0',
    });

    expect(store.stockMoveLine.upsert).toHaveBeenCalledWith({
      where: {
        eventoKey: {
          tenantId: 'tenant-1',
          tipoOrigen: 'VENTA',
          origenId: 'venta-1',
          productoId: 'producto-1',
          tipoUbicacion: 'punto_venta',
          ubicacionId: 'pv-1',
          secuencia: 'ITEM-0',
        },
      },
      create: expect.objectContaining({
        tenantId: 'tenant-1',
        productoTenantId: 'tenant-1',
        productoId: 'producto-1',
        cantidad: -3,
        costoUnitario: 100,
        costoTotal: -300,
        secuencia: 'ITEM-0',
      }),
      update: {},
    });
    expect(store.stockMoveLine.create).toBeUndefined();
  });

  it('rechaza un movimiento con cantidad cero', async () => {
    const store = createStore();

    await expect(
      registrarMovimiento(store, {
        tenantId: 'tenant-1',
        productoId: 'producto-1',
        tipoOrigen: 'AJUSTE',
        origenId: 'ajuste-1',
        tipoUbicacion: 'almacen',
        ubicacionId: 'almacen-1',
        cantidad: 0,
        costoUnitario: 100,
      }),
    ).rejects.toThrow('La cantidad del movimiento debe ser distinta de cero');

    expect(store.stockMoveLine.upsert).not.toHaveBeenCalled();
  });

  it('rechaza costo unitario negativo', async () => {
    const store = createStore();

    await expect(
      registrarMovimiento(store, {
        tenantId: 'tenant-1',
        productoId: 'producto-1',
        tipoOrigen: 'AJUSTE',
        origenId: 'ajuste-1',
        tipoUbicacion: 'almacen',
        ubicacionId: 'almacen-1',
        cantidad: 2,
        costoUnitario: -100,
      }),
    ).rejects.toThrow('El costo unitario del movimiento no es válido');
  });
});

describe('getKardex', () => {
  it('requiere productoId para calcular saldos correctos', async () => {
    const store = createStore();

    await expect(getKardex(store, { tenantId: 'tenant-1' })).rejects.toThrow(
      'El kardex requiere un producto específico',
    );
  });

  it('calcula saldo de apertura anterior al período y saldo acumulado', async () => {
    const store = createStore();
    store.stockMoveLine.aggregate.mockResolvedValue({ _sum: { cantidad: 40 } });
    store.stockMoveLine.findMany.mockResolvedValue([
      { id: 'move-2', cantidad: 10, createdAt: new Date('2026-02-01') },
      { id: 'move-3', cantidad: -3, createdAt: new Date('2026-02-02') },
    ]);
    store.stockMoveLine.count.mockResolvedValue(2);

    const result = await getKardex(store, {
      tenantId: 'tenant-1',
      productoId: 'producto-1',
      ubicacionId: 'almacen-1',
      tipoUbicacion: 'almacen',
      fechaDesde: new Date('2026-02-01'),
    });

    expect(store.stockMoveLine.aggregate).toHaveBeenCalledWith({
      where: expect.objectContaining({
        tenantId: 'tenant-1',
        productoId: 'producto-1',
        createdAt: { lt: new Date('2026-02-01') },
      }),
      _sum: { cantidad: true },
    });
    expect(result.saldoInicial).toBe(40);
    expect(result.items.map((item) => item.saldo)).toEqual([50, 47]);
  });

  it('saldo inicial es cero cuando no hay fechaDesde', async () => {
    const store = createStore();
    store.stockMoveLine.findMany.mockResolvedValue([
      { id: 'move-1', cantidad: 10, createdAt: new Date('2026-01-01') },
    ]);
    store.stockMoveLine.count.mockResolvedValue(1);

    const result = await getKardex(store, {
      tenantId: 'tenant-1',
      productoId: 'producto-1',
    });

    expect(store.stockMoveLine.aggregate).not.toHaveBeenCalled();
    expect(result.saldoInicial).toBe(0);
    expect(result.items[0].saldo).toBe(10);
  });

  it('pagina con limit y page y retorna el total', async () => {
    const store = createStore();
    store.stockMoveLine.findMany.mockResolvedValue([]);
    store.stockMoveLine.count.mockResolvedValue(250);

    const result = await getKardex(store, {
      tenantId: 'tenant-1',
      productoId: 'producto-1',
      page: 3,
      limit: 50,
    });

    expect(store.stockMoveLine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 100, take: 50 }),
    );
    expect(result.total).toBe(250);
  });
});

describe('getMovimientosDeOrigen y revertirMovimientosDeOrigen', () => {
  it('lee las líneas existentes de un documento origen', async () => {
    const store = createStore();
    store.stockMoveLine.findMany.mockResolvedValue([
      {
        id: 'move-1',
        tipoOrigen: 'TRANSFERENCIA',
        productoId: 'prod-1',
        ubicacionId: 'alm-1',
        tipoUbicacion: 'almacen',
        cantidad: -5,
        costoUnitario: 100,
        secuencia: 'SALIDA-0',
      },
    ]);

    const movimientos = await getMovimientosDeOrigen(store, {
      tenantId: 'tenant-1',
      tipoOrigen: 'TRANSFERENCIA',
      origenId: 'tr-1',
    });

    expect(store.stockMoveLine.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', tipoOrigen: 'TRANSFERENCIA', origenId: 'tr-1' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    expect(movimientos).toHaveLength(1);
  });

  it('revierte cada línea del origen con signo opuesto y secuencia REV', async () => {
    const store = createStore();
    store.stockMoveLine.findMany.mockResolvedValue([
      {
        id: 'm-1',
        tenantId: 'tenant-1',
        productoId: 'prod-1',
        tipoUbicacion: 'almacen',
        ubicacionId: 'alm-1',
        cantidad: -5,
        costoUnitario: 100,
        secuencia: 'SALIDA-0',
      },
      {
        id: 'm-2',
        tenantId: 'tenant-1',
        productoId: 'prod-1',
        tipoUbicacion: 'almacen',
        ubicacionId: 'alm-2',
        cantidad: 5,
        costoUnitario: 100,
        secuencia: 'ENTRADA-0',
      },
    ]);

    const revertidas = await revertirMovimientosDeOrigen(store, {
      tenantId: 'tenant-1',
      tipoOrigen: 'TRANSFERENCIA',
      origenId: 'tr-1',
      creadoPorId: 'user-1',
    });

    expect(revertidas).toHaveLength(2);
    expect(store.stockMoveLine.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          cantidad: 5,
          secuencia: 'REV-SALIDA-0',
          costoUnitario: 100,
        }),
      }),
    );
    expect(store.stockMoveLine.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          cantidad: -5,
          secuencia: 'REV-ENTRADA-0',
        }),
      }),
    );
  });

  it('no duplica compensaciones si se revierte dos veces el mismo origen', async () => {
    const store = createStore();
    store.stockMoveLine.findMany.mockResolvedValue([
      {
        id: 'm-1',
        tenantId: 'tenant-1',
        productoId: 'prod-1',
        tipoUbicacion: 'almacen',
        ubicacionId: 'alm-1',
        cantidad: -5,
        costoUnitario: 100,
        secuencia: 'SALIDA-0',
      },
    ]);

    await revertirMovimientosDeOrigen(store, {
      tenantId: 'tenant-1',
      tipoOrigen: 'TRANSFERENCIA',
      origenId: 'tr-1',
    });
    await revertirMovimientosDeOrigen(store, {
      tenantId: 'tenant-1',
      tipoOrigen: 'TRANSFERENCIA',
      origenId: 'tr-1',
    });

    // Segunda reversión no agrega nuevas líneas: solo una upsert por ítem.
    const keys = store.stockMoveLine.upsert.mock.calls.map(
      (call) => call[0].where.eventoKey.secuencia,
    );
    expect(keys).toEqual(['REV-SALIDA-0', 'REV-SALIDA-0']);
  });
});
