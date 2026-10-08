import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { PrismaClient } from '@/generated/prisma';
import { getStockTotalProductosBatch } from '@/lib/services/stock-ubicacion-queries';

const prisma = new PrismaClient();

/**
 * @description Comprueba en una transacción reversible la semántica actual del stock batch.
 * @returns {Promise<void>} Evidencia de que el tenant del stock no se filtra actualmente.
 */
async function characterizeStockTenantScope(): Promise<void> {
  const rollback = new Error('rollback-stock-tenant-baseline');
  await expect(prisma.$transaction(async (tx) => {
    const suffix = randomUUID();
    const tenantA = await tx.tenant.create({
      data: { nombre: `PRE-GO A ${suffix}`, slug: `pre-go-a-${suffix}` },
    });
    const tenantB = await tx.tenant.create({
      data: { nombre: `PRE-GO B ${suffix}`, slug: `pre-go-b-${suffix}` },
    });
    const categoria = await tx.categoria.create({
      data: { nombre: `PRE-GO ${suffix}`, tenantId: tenantA.tenantId },
    });
    const almacen = await tx.almacen.create({
      data: { nombre: `PRE-GO ${suffix}`, tenantId: tenantA.tenantId },
    });
    const producto = await tx.producto.create({
      data: {
        nombre: `PRE-GO ${suffix}`,
        tenantId: tenantA.tenantId,
        categoriaId: categoria.catId,
        almacenId: almacen.almacenId,
        precioCosto: 100,
        precioVenta: 150,
        stock: 0,
      },
    });
    await tx.stockUbicacion.createMany({
      data: [
        {
          tenantId: tenantA.tenantId,
          productoId: producto.id,
          tipoUbicacion: 'ALMACEN',
          ubicacionId: almacen.almacenId,
          cantidad: 4,
        },
        {
          tenantId: tenantB.tenantId,
          productoId: producto.id,
          tipoUbicacion: 'ALMACEN',
          ubicacionId: `otro-${suffix}`,
          cantidad: 9,
        },
      ],
    });

    const totales = await getStockTotalProductosBatch(tx, { productoIds: [producto.id] });
    // Caracterización /0: el batch suma la fila inconsistente de B. No es un RED.
    expect(totales.get(producto.id)).toBe(13);
    throw rollback;
  })).rejects.toBe(rollback);
}

describe('PRE-GO/0 stock batch entre tenants', () => {
  it('caracteriza el resultado ante stock B enlazado a producto A', async () => {
    await characterizeStockTenantScope();
  }, 30_000);
});
