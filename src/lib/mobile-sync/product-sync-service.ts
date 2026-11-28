import { prisma } from '@/lib/prisma';
import { getStockTotalProductosBatch } from '@/lib/services/stock-ubicacion-queries';

import {
  decodeChangesCursor,
  decodeSnapshotPageToken,
  encodeChangesCursor,
  encodeSnapshotPageToken,
  type ChangesCursorState,
  type SnapshotPageState,
} from './product-sync-cursor';

const MAX_PAGE_SIZE = 500;

const MOBILE_SYNC_PRODUCT_SELECT = {
  id: true,
  nombre: true,
  descripcion: true,
  precioVenta: true,
  stockMinimo: true,
  codigoInterno: true,
  codigoNegocio: true,
  sku: true,
  atributoJson: true,
  esVariante: true,
  plantillaId: true,
  proveedorCodigo: true,
  idSeccionCodigo: true,
  especificoCodigo: true,
  surtidoCodigo: true,
  dcCodigo: true,
  categoriaId: true,
  subcategoriaId: true,
  unidadId: true,
  vendorId: true,
  almacenId: true,
  puntoDeVentaId: true,
  fotos: true,
  esCompuesto: true,
  createdAt: true,
  updatedAt: true,
  categoria: { select: { catId: true, nombre: true } },
  subcategoria: { select: { catId: true, nombre: true, parentId: true } },
  unidad: { select: { unidadId: true, nombre: true, simbolo: true } },
  vendor: { select: { vendorId: true, nombre: true } },
} as const;

interface SnapshotPageArgs {
  tenantId: string;
  limit: number;
  pageToken?: string | null;
}

interface PullChangesArgs {
  tenantId: string;
  cursor: string;
  limit: number;
}

interface SyncProductRow {
  id: string;
  [key: string]: unknown;
}

function assertPageSize(limit: number): void {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new RangeError(`El límite debe estar entre 1 y ${MAX_PAGE_SIZE}.`);
  }
}

function getWatermark(state: SnapshotPageState | ChangesCursorState): string {
  return 'watermark' in state ? state.watermark : state.after;
}

async function getTenantWatermark(tenantId: string): Promise<bigint> {
  const cursor = await prisma.mobileProductSyncCursor.findUnique({
    where: { tenantId },
    select: { lastSequence: true },
  });
  return cursor?.lastSequence ?? BigInt(0);
}

async function withDerivedStock<T extends SyncProductRow>(
  products: T[],
): Promise<Array<T & { stock: number }>> {
  const stockTotals = await getStockTotalProductosBatch(prisma, {
    productoIds: products.map(({ id }) => id),
  });

  return products.map((product) => ({
    ...product,
    stock: stockTotals.get(product.id) ?? 0,
  }));
}

function makeChangesCursor(tenantId: string, watermark: string): string {
  return encodeChangesCursor({
    tenantId,
    after: watermark,
    upperBound: null,
  });
}

/**
 * @description Returns a keyset-paginated product snapshot and the change watermark
 *   captured before reading each page. Mutations after that watermark are replayed
 *   through the incremental feed, making concurrent writes safe to apply repeatedly.
 */
export async function getProductSnapshotPage({
  tenantId,
  limit,
  pageToken,
}: SnapshotPageArgs) {
  assertPageSize(limit);

  const state = pageToken
    ? decodeSnapshotPageToken(pageToken, tenantId)
    : {
        tenantId,
        lastId: null,
        watermark: (await getTenantWatermark(tenantId)).toString(),
      };
  const products = await prisma.producto.findMany({
    where: {
      tenantId,
      ...(state.lastId ? { id: { gt: state.lastId } } : {}),
    },
    select: MOBILE_SYNC_PRODUCT_SELECT,
    orderBy: { id: 'asc' },
    take: limit + 1,
  });

  const hasMore = products.length > limit;
  const page = products.slice(0, limit);
  const items = await withDerivedStock(page);
  const lastId = page.at(-1)?.id ?? state.lastId;

  return {
    items,
    nextPageToken: hasMore && lastId
      ? encodeSnapshotPageToken({
          tenantId,
          lastId,
          watermark: state.watermark,
        })
      : null,
    changesCursor: makeChangesCursor(tenantId, getWatermark(state)),
  };
}

/**
 * @description Pulls an ordered, tenant-local page of journal events. The first
 *   page pins an upper sequence so concurrent writes are left for the next pull.
 */
export async function pullProductChanges({
  tenantId,
  cursor,
  limit,
}: PullChangesArgs) {
  assertPageSize(limit);
  const state = decodeChangesCursor(cursor, tenantId);
  let upperBound = state.upperBound;

  if (upperBound === null || BigInt(state.after) >= BigInt(upperBound)) {
    upperBound = (await getTenantWatermark(tenantId)).toString();
  }

  const rows = await prisma.mobileProductSyncChange.findMany({
    where: {
      tenantId,
      sequence: {
        gt: BigInt(state.after),
        lte: BigInt(upperBound),
      },
    },
    select: {
      sequence: true,
      productId: true,
      operation: true,
    },
    orderBy: { sequence: 'asc' },
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const productIds = [...new Set(
    page
      .filter((row) => row.operation === 'UPSERT')
      .map((row) => row.productId),
  )];
  const products = productIds.length > 0
    ? await prisma.producto.findMany({
        where: { tenantId, id: { in: productIds } },
        select: MOBILE_SYNC_PRODUCT_SELECT,
      })
    : [];
  const productsWithStock = await withDerivedStock(products);
  const productsById = new Map(productsWithStock.map((product) => [product.id, product]));

  const changes = page.map((row) => {
    const product = row.operation === 'UPSERT' ? productsById.get(row.productId) : undefined;
    if (!product) {
      return {
        sequence: row.sequence.toString(),
        productId: row.productId,
        operation: 'DELETE' as const,
      };
    }

    return {
      sequence: row.sequence.toString(),
      productId: row.productId,
      operation: 'UPSERT' as const,
      product,
    };
  });

  const lastSequence = page.at(-1)?.sequence.toString();
  const after = hasMore ? lastSequence ?? state.after : upperBound;

  return {
    changes,
    cursor: encodeChangesCursor({
      tenantId,
      after,
      upperBound: hasMore ? upperBound : null,
    }),
  };
}
