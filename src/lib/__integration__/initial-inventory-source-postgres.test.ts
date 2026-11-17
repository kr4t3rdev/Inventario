import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertDisposableDatabase, assertDisposableDatabaseIdentity } from '../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);

const unique = crypto.randomUUID().replaceAll('-', '');
const tenantId = `fifo-init-${unique}`;
const otherTenantId = `fifo-other-${unique}`;
const initialId = `init-${unique}`;
const lotId = `lot-${unique}`;
const sourceId = `source-${unique}`;
const productId = `product-${unique}`;
const itemId = `item-${unique}`;
let prisma: typeof import('@/lib/prisma').prisma;

describe('fuente FIFO inicial — PostgreSQL aislado', () => {
  beforeAll(async () => {
    prisma = (await import('@/lib/prisma')).prisma;
    const [identity] = await prisma.$queryRaw<Array<{
      databaseName: string; roleName: string; serverPort: number;
    }>>`SELECT current_database() AS "databaseName", current_user AS "roleName",
      inet_server_port() AS "serverPort"`;
    assertDisposableDatabaseIdentity(identity, process.env);
    await prisma.tenant.createMany({ data: [
      { tenantId, nombre: tenantId }, { tenantId: otherTenantId, nombre: otherTenantId },
    ] });
    await prisma.categoria.create({ data: { catId: `cat-${unique}`, tenantId, nombre: 'Categoría' } });
    await prisma.almacen.create({ data: { almacenId: `store-${unique}`, tenantId, nombre: 'Almacén' } });
    await prisma.producto.create({ data: {
      id: productId, tenantId, nombre: 'Producto', precioCosto: 10, precioVenta: 20, stock: 5,
      categoriaId: `cat-${unique}`, almacenId: `store-${unique}`,
    } });
    await prisma.lote.create({ data: {
      id: lotId, tenantId, productoId: productId, codigo: 'inicial', cantidadInicial: 5,
      cantidadDisponible: 5,
    } });
    await prisma.inicializacionContable.create({ data: {
      inicializacionId: initialId, tenantId, idempotencyKey: 'key', payloadHash: 'a'.repeat(64),
    } });
    await prisma.puntoDeVenta.create({ data: { pvId: `pv-${unique}`, tenantId, nombre: 'PV' } });
    await prisma.venta.create({ data: {
      ventaId: `venta-${unique}`, tenantId, cantidad: 1, puntoDeVentaId: `pv-${unique}`,
    } });
    await prisma.ventaItem.create({ data: {
      id: itemId, ventaId: `venta-${unique}`, productoId: productId,
      cantidad: 1, precioUnitario: 20, total: 20,
    } });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.purchaseAllocation.deleteMany({ where: { tenantId } });
    const [table] = await prisma.$queryRaw<Array<{ name: string | null }>>`
      SELECT to_regclass('inventario_inicial_fuentes')::text AS name`;
    if (table.name) {
      await prisma.$executeRaw`DELETE FROM "inventario_inicial_fuentes" WHERE "tenantId" = ${tenantId}`;
    }
    await prisma.ventaItem.deleteMany({ where: { id: itemId } });
    await prisma.venta.deleteMany({ where: { tenantId } });
    await prisma.puntoDeVenta.deleteMany({ where: { tenantId } });
    await prisma.lote.deleteMany({ where: { tenantId } });
    await prisma.producto.deleteMany({ where: { tenantId } });
    await prisma.categoria.deleteMany({ where: { tenantId } });
    await prisma.almacen.deleteMany({ where: { tenantId } });
    await prisma.inicializacionContable.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
    await prisma.$disconnect();
  });

  it('guarda una fuente inicial y permite asignarla a una venta sin compra ni recepción', async () => {
    await prisma.$executeRaw`INSERT INTO "inventario_inicial_fuentes"
      ("id", "tenantId", "inicializacionId", "loteId", "productoId", "cantidad",
       "costoUnitario", "moneda", "fechaCorte", "montoFuncional", "monedaFuncional",
       "evidencia", "evidenciaHash")
      VALUES (${sourceId}, ${tenantId}, ${initialId}, ${lotId}, ${productId}, 5,
       10, 'CUP', '2026-01-01', 50, 'CUP', '{}'::jsonb, ${'a'.repeat(64)})`;
    await prisma.$executeRaw`INSERT INTO "purchase_allocations"
      ("id", "tenantId", "ventaItemId", "loteId", "inventarioInicialFuenteId",
       "cantidad", "updatedAt")
      VALUES (${`allocation-${unique}`}, ${tenantId}, ${itemId}, ${lotId}, ${sourceId}, 1, NOW())`;
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count FROM "purchase_allocations"
      WHERE "tenantId" = ${tenantId} AND "inventarioInicialFuenteId" = ${sourceId}
        AND "compraDocumentoItemId" IS NULL AND "recepcionItemId" IS NULL`;
    expect(rows[0].count).toBe(1n);
  });

  it('rechaza fuentes de otro tenant y asignaciones con identidad de lote incorrecta', async () => {
    const secondLotId = `lot-second-${unique}`;
    const secondSourceId = `source-second-${unique}`;
    await prisma.lote.create({ data: {
      id: secondLotId, tenantId, productoId: productId, codigo: 'segundo',
      cantidadInicial: 5, cantidadDisponible: 5,
    } });
    await prisma.$executeRaw`INSERT INTO "inventario_inicial_fuentes"
      ("id", "tenantId", "inicializacionId", "loteId", "productoId", "cantidad",
       "costoUnitario", "moneda", "fechaCorte", "montoFuncional", "monedaFuncional",
       "evidencia", "evidenciaHash")
      VALUES (${secondSourceId}, ${tenantId}, ${initialId}, ${secondLotId}, ${productId}, 5,
       10, 'CUP', '2026-01-01', 50, 'CUP', '{}'::jsonb, ${'a'.repeat(64)})`;
    await expect(prisma.$executeRaw`INSERT INTO "inventario_inicial_fuentes"
      ("id", "tenantId", "inicializacionId", "loteId", "productoId", "cantidad",
       "costoUnitario", "moneda", "fechaCorte", "montoFuncional", "monedaFuncional",
       "evidencia", "evidenciaHash")
      VALUES (${`foreign-${unique}`}, ${otherTenantId}, ${initialId}, ${lotId}, ${productId}, 5,
       10, 'CUP', '2026-01-01', 50, 'CUP', '{}'::jsonb, ${'a'.repeat(64)})`).rejects.toThrow();
    await expect(prisma.$executeRaw`INSERT INTO "purchase_allocations"
      ("id", "tenantId", "ventaItemId", "loteId", "inventarioInicialFuenteId", "cantidad", "updatedAt")
      VALUES (${`bad-${unique}`}, ${tenantId}, ${itemId}, ${lotId}, ${secondSourceId}, 1, NOW())`)
      .rejects.toThrow();
  });

  it('rechaza costos y cantidades inválidas antes de crear la fuente', async () => {
    await expect(prisma.$executeRaw`INSERT INTO "inventario_inicial_fuentes"
      ("id", "tenantId", "inicializacionId", "loteId", "productoId", "cantidad",
       "costoUnitario", "moneda", "fechaCorte", "montoFuncional", "monedaFuncional",
       "evidencia", "evidenciaHash")
      VALUES (${`zero-${unique}`}, ${tenantId}, ${initialId}, ${lotId}, ${productId}, 0,
       10, 'CUP', '2026-01-01', 50, 'CUP', '{}'::jsonb, ${'a'.repeat(64)})`).rejects.toThrow();
  });
});
