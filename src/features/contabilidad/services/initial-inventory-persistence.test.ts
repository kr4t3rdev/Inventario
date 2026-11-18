import { describe, expect, it, vi } from 'vitest';

import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';
import { persistInitialInventory } from './initial-inventory-persistence';

vi.mock('@/lib/services/stock-ubicacion-service', () => ({
  upsertStockUbicacion: vi.fn(),
}));

const tx = {
  inicializacionContable: { findFirst: vi.fn() },
  producto: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  almacen: { findFirst: vi.fn() },
  ubicacion: { findFirst: vi.fn() },
  lote: { create: vi.fn() },
  inventarioInicialFuente: { create: vi.fn() },
} as never;

const input = {
  tenantId: 'tenant-a',
  inicializacionId: 'init-a',
  fechaCorte: '2026-11-10',
  monedaFuncional: 'CUP',
  inventario: [{
    referenciaFila: 'fila-1',
    productoId: 'producto-a',
    almacenId: 'almacen-a',
    ubicacionId: 'ubicacion-a',
    loteCodigo: 'LOTE-1',
    cantidad: '4',
    costoUnitario: '25.50',
    moneda: 'CUP',
  }],
};

describe('persistencia de inventario inicial', () => {
  it('crea lote, fuente y stock sin crear compra ni recepción', async () => {
    const mockedTx = tx as {
      inicializacionContable: { findFirst: ReturnType<typeof vi.fn> };
      producto: { findFirst: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
      almacen: { findFirst: ReturnType<typeof vi.fn> };
      ubicacion: { findFirst: ReturnType<typeof vi.fn> };
      lote: { create: ReturnType<typeof vi.fn> };
      inventarioInicialFuente: { create: ReturnType<typeof vi.fn> };
    };
    mockedTx.inicializacionContable.findFirst.mockResolvedValue({ inicializacionId: 'init-a' });
    mockedTx.producto.findFirst.mockResolvedValue({ id: 'producto-a', almacenId: 'almacen-a' });
    mockedTx.almacen.findFirst.mockResolvedValue({ almacenId: 'almacen-a' });
    mockedTx.ubicacion.findFirst.mockResolvedValue({ id: 'ubicacion-a' });
    mockedTx.lote.create.mockResolvedValue({ id: 'lote-a' });
    mockedTx.inventarioInicialFuente.create.mockResolvedValue({ id: 'fuente-a' });
    mockedTx.producto.update.mockResolvedValue({ id: 'producto-a' });

    await expect(persistInitialInventory(tx, input)).resolves.toMatchObject({ count: 1 });

    expect(mockedTx.lote.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenantId: 'tenant-a',
        productoId: 'producto-a',
        compraItemId: null,
        recepcionItemId: null,
        cantidadInicial: 4,
        cantidadDisponible: 4,
      }),
    }));
    expect(upsertStockUbicacion).toHaveBeenCalledWith(tx, expect.objectContaining({
      tenantId: 'tenant-a',
      productoId: 'producto-a',
      tipoUbicacion: 'almacen',
      ubicacionId: 'almacen-a',
      ubicacionHijaId: 'ubicacion-a',
      delta: 4,
    }));
    expect(mockedTx.inventarioInicialFuente.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenantId: 'tenant-a',
        inicializacionId: 'init-a',
        loteId: 'lote-a',
        costoUnitario: '25.5',
        montoFuncional: '102',
      }),
    }));
  });

  it('falla cerrado si la existencia pertenece a otro almacén o tenant', async () => {
    const mockedTx = tx as {
      inicializacionContable: { findFirst: ReturnType<typeof vi.fn> };
      producto: { findFirst: ReturnType<typeof vi.fn> };
      almacen: { findFirst: ReturnType<typeof vi.fn> };
    };
    mockedTx.inicializacionContable.findFirst.mockResolvedValue({ inicializacionId: 'init-a' });
    mockedTx.producto.findFirst.mockResolvedValue(null);
    mockedTx.almacen.findFirst.mockResolvedValue(null);

    await expect(persistInitialInventory(tx, input)).rejects.toMatchObject({
      code: 'INITIALIZATION_PRODUCT_INVALID',
    });
    expect(upsertStockUbicacion).not.toHaveBeenCalled();
  });
});
