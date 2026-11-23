import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockProductFindMany, mockCursorFindUnique, mockChangeFindMany, mockStockTotals } = vi.hoisted(() => ({
  mockProductFindMany: vi.fn(),
  mockCursorFindUnique: vi.fn(),
  mockChangeFindMany: vi.fn(),
  mockStockTotals: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    producto: { findMany: mockProductFindMany },
    mobileProductSyncCursor: { findUnique: mockCursorFindUnique },
    mobileProductSyncChange: { findMany: mockChangeFindMany },
  },
}));

vi.mock('@/lib/services/stock-ubicacion-queries', () => ({
  getStockTotalProductosBatch: mockStockTotals,
}));

vi.mock('@/lib/secrets', () => ({
  getJwtSecret: () => 'test-mobile-sync-cursor-secret',
}));

import {
  decodeChangesCursor,
  decodeSnapshotPageToken,
  encodeChangesCursor,
} from '../product-sync-cursor';
import {
  getProductSnapshotPage,
  pullProductChanges,
} from '../product-sync-service';

const productRow = {
  id: 'product-a',
  nombre: 'Arroz',
  descripcion: null,
  precioVenta: 250,
  stockMinimo: 2,
  codigoInterno: null,
  codigoNegocio: 'AR-1',
  sku: null,
  atributoJson: null,
  esVariante: false,
  plantillaId: null,
  proveedorCodigo: null,
  idSeccionCodigo: null,
  especificoCodigo: null,
  surtidoCodigo: null,
  dcCodigo: null,
  categoriaId: 'category-a',
  subcategoriaId: null,
  unidadId: null,
  vendorId: null,
  almacenId: 'warehouse-a',
  puntoDeVentaId: null,
  fotos: [],
  esCompuesto: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  categoria: null,
  subcategoria: null,
  unidad: null,
  vendor: null,
};

describe('mobile product sync service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCursorFindUnique.mockResolvedValue({ lastSequence: 0n });
    mockProductFindMany.mockResolvedValue([]);
    mockChangeFindMany.mockResolvedValue([]);
    mockStockTotals.mockResolvedValue(new Map());
  });

  it('returns a tenant-scoped snapshot page without product cost', async () => {
    mockCursorFindUnique.mockResolvedValue({ lastSequence: 12n });
    mockProductFindMany.mockResolvedValue([
      productRow,
      { ...productRow, id: 'product-b', nombre: 'Frijol' },
    ]);
    mockStockTotals.mockResolvedValue(new Map([['product-a', 8]]));

    const result = await getProductSnapshotPage({
      tenantId: 'tenant-a',
      limit: 1,
    });

    expect(mockProductFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-a' },
      orderBy: { id: 'asc' },
      take: 2,
    }));
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ id: 'product-a', stock: 8 });
    expect(result.items[0]).not.toHaveProperty('precioCosto');
    expect(result.items[0]).not.toHaveProperty('tenantId');
    expect(decodeSnapshotPageToken(result.nextPageToken!, 'tenant-a')).toEqual({
      tenantId: 'tenant-a',
      lastId: 'product-a',
      watermark: '12',
    });
    expect(decodeChangesCursor(result.changesCursor, 'tenant-a')).toMatchObject({
      tenantId: 'tenant-a',
      after: '12',
      upperBound: null,
    });
  });

  it('continues a snapshot using its fixed watermark and keyset', async () => {
    const pageToken = await import('../product-sync-cursor').then(({ encodeSnapshotPageToken }) =>
      encodeSnapshotPageToken({ tenantId: 'tenant-a', lastId: 'product-a', watermark: '12' }));
    mockProductFindMany.mockResolvedValue([]);

    const result = await getProductSnapshotPage({
      tenantId: 'tenant-a',
      limit: 25,
      pageToken,
    });

    expect(mockCursorFindUnique).not.toHaveBeenCalled();
    expect(mockProductFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-a', id: { gt: 'product-a' } },
    }));
    expect(result.changesCursor).toBeTruthy();
    expect(result.nextPageToken).toBeNull();
  });

  it('pins incremental pages to one upper sequence and tenant', async () => {
    const cursor = encodeChangesCursor({
      tenantId: 'tenant-a',
      after: '10',
      upperBound: null,
    });
    mockCursorFindUnique.mockResolvedValue({ lastSequence: 14n });
    mockChangeFindMany.mockResolvedValue([
      { tenantId: 'tenant-a', sequence: 11n, productId: 'product-a', operation: 'UPSERT' },
      { tenantId: 'tenant-a', sequence: 12n, productId: 'product-a', operation: 'UPSERT' },
    ]);
    mockProductFindMany.mockResolvedValue([productRow]);
    mockStockTotals.mockResolvedValue(new Map([['product-a', 6]]));

    const result = await pullProductChanges({
      tenantId: 'tenant-a',
      cursor,
      limit: 1,
    });

    expect(mockChangeFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        tenantId: 'tenant-a',
        sequence: { gt: 10n, lte: 14n },
      },
      orderBy: { sequence: 'asc' },
      take: 2,
    }));
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]).toMatchObject({
      sequence: '11',
      operation: 'UPSERT',
      product: { id: 'product-a', stock: 6 },
    });
    expect(result.changes[0]?.product).not.toHaveProperty('precioCosto');
    expect(decodeChangesCursor(result.cursor, 'tenant-a')).toEqual({
      tenantId: 'tenant-a',
      after: '11',
      upperBound: '14',
    });
  });

  it('turns stale upserts into delete tombstones if the product was removed', async () => {
    const cursor = encodeChangesCursor({
      tenantId: 'tenant-a',
      after: '0',
      upperBound: null,
    });
    mockCursorFindUnique.mockResolvedValue({ lastSequence: 1n });
    mockChangeFindMany.mockResolvedValue([
      { tenantId: 'tenant-a', sequence: 1n, productId: 'deleted-product', operation: 'UPSERT' },
    ]);
    mockProductFindMany.mockResolvedValue([]);

    const result = await pullProductChanges({
      tenantId: 'tenant-a',
      cursor,
      limit: 10,
    });

    expect(result.changes).toEqual([
      { sequence: '1', productId: 'deleted-product', operation: 'DELETE' },
    ]);
    expect(decodeChangesCursor(result.cursor, 'tenant-a')).toEqual({
      tenantId: 'tenant-a',
      after: '1',
      upperBound: null,
    });
  });
});
