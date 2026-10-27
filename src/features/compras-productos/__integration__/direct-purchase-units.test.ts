/**
 * @description Verifica compra directa, conversión y rollback contra PostgreSQL local real.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import {
  assertDisposableDatabase,
  assertDisposableDatabaseIdentity,
} from '../../../../scripts/ci/disposable-database.mjs';

const auth = vi.hoisted(() => ({ user: null as AuthenticatedUser | null }));
vi.mock('@/lib/server-actions/get-current-user', () => ({
  getCurrentUser: async () => auth.user,
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { createCompraProductoAction } = await import('@/features/compras-productos/actions');
const {
  createProductUnitConversionAction,
  updateProductUnitConversionAction,
  deleteProductUnitConversionAction,
} = await import('@/features/productos/actions');

const prefix = `f1-direct-${randomUUID().replaceAll('-', '')}`;
let tenantId = '';
let vendorId = '';
let categoryId = '';
let warehouseId = '';
let baseUnitId = '';
let sourceUnitId = '';
let foreignUnitId = '';
let userId = '';
let actionUser: AuthenticatedUser;
const productIds = new Set<string>();
const unitIds = new Set<string>();
const failpointNames = new Set<string>();
const tenantIds = new Set<string>();

interface ProductFixture {
  id: string;
  precioCosto: number;
}

interface PurchaseInput {
  productId: string;
  invoice: string;
  quantity: number;
  unitPrice: number;
  sourceUnitId?: string;
}

/**
 * @description Crea un producto independiente para un escenario de compra.
 * @param {string} name - Sufijo único del producto.
 * @param {number} [cost=200] - Costo inicial para comprobar actualizaciones/rollback.
 * @returns {Promise<ProductFixture>} Producto persistido.
 */
async function createProduct(name: string, cost = 200): Promise<ProductFixture> {
  const product = await prisma.producto.create({
    data: {
      tenantId,
      nombre: `${prefix}-${name}`,
      precioCosto: cost,
      precioVenta: 300,
      stock: 0,
      categoriaId: categoryId,
      unidadId: baseUnitId,
      almacenId: warehouseId,
    },
    select: { id: true, precioCosto: true },
  });
  productIds.add(product.id);
  return product;
}

/**
 * @description Ejecuta la acción real con valores de pago completo.
 * @param {PurchaseInput} input - Producto y línea a registrar.
 * @returns {ReturnType<typeof createCompraProductoAction>} Respuesta serializada del wrapper.
 */
async function submitPurchase(input: PurchaseInput) {
  return createCompraProductoAction({
    proveedorId: vendorId,
    numeroFactura: input.invoice,
    formaPago: 'PAGO_COMPLETO',
    estado: 'PAGADA',
    items: [{
      productoId: input.productId,
      unidadId: input.sourceUnitId,
      cantidad: input.quantity,
      precioCosto: input.unitPrice,
    }],
  });
}

/**
 * @description Captura efectos de una compra para comparar ausencia de writes o rollback.
 * @param {string} productId - Producto del escenario.
 * @param {string} invoice - Número de factura único.
 * @returns {Promise<string>} Snapshot ordenado de filas relacionadas.
 */
async function captureEffects(productId: string, invoice: string): Promise<string> {
  const [documents, lines, stock, kardex, costHistory, expenses, product] = await Promise.all([
    prisma.compraDocumento.findMany({ where: { tenantId, numeroFactura: invoice } }),
    prisma.compraDocumentoItem.findMany({ where: { tenantId, productoId: productId } }),
    prisma.stockUbicacion.findMany({ where: { tenantId, productoId: productId } }),
    prisma.stockMoveLine.findMany({ where: { tenantId, productoId: productId } }),
    prisma.productoCostHistory.findMany({ where: { productoId: productId } }),
    prisma.gastoCompra.findMany({ where: { tenantId, productoId: productId } }),
    prisma.producto.findUnique({ where: { id: productId }, select: { precioCosto: true } }),
  ]);
  return JSON.stringify({ documents, lines, stock, kardex, costHistory, expenses, product });
}

/**
 * @description Crea y elimina un failpoint DB que falla al insertar el gasto posterior al Kardex.
 * @param {boolean} install - true instala; false elimina el objeto temporal.
 * @param {string} name - Identificador aleatorio válido como nombre SQL.
 * @returns {Promise<void>} Operación DDL local sobre la DB descartable.
 */
async function toggleExpenseFailpoint(install: boolean, name: string): Promise<void> {
  failpointNames.add(name);
  if (install) {
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION "${name}"() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW."total" = 1236 THEN
          RAISE EXCEPTION 'F1_EXPECTED_EXPENSE_FAILPOINT' USING ERRCODE = 'P0001';
        END IF;
        RETURN NEW;
      END;
      $$
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "${name}" BEFORE INSERT ON "GastoCompra"
      FOR EACH ROW EXECUTE FUNCTION "${name}"()
    `);
    return;
  }

  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${name}" ON "GastoCompra"`);
  await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${name}"()`);
}

describe('F-1 direct purchase unit conversion — disposable PostgreSQL', () => {
  beforeAll(async () => {
    assertDisposableDatabase(process.env);
    const identity = await prisma.$queryRaw<Array<{
      databaseName: string;
      roleName: string;
      serverPort: number;
    }>>`
      SELECT current_database() AS "databaseName",
        current_user AS "roleName",
        inet_server_port() AS "serverPort"
    `;
    assertDisposableDatabaseIdentity(identity[0], process.env);

    const tenant = await prisma.tenant.create({ data: { nombre: prefix, slug: prefix } });
    tenantId = tenant.tenantId;
    tenantIds.add(tenantId);
    const user = await prisma.user.create({ data: {
      name: prefix,
      email: `${prefix}@test.local`,
      password: 'disposable-fixture',
    } });
    userId = user.userId;
    const vendor = await prisma.vendor.create({ data: { tenantId, nombre: `${prefix}-vendor` } });
    vendorId = vendor.vendorId;
    const category = await prisma.categoria.create({ data: { tenantId, nombre: `${prefix}-category` } });
    categoryId = category.catId;
    const warehouse = await prisma.almacen.create({ data: { tenantId, nombre: `${prefix}-warehouse` } });
    warehouseId = warehouse.almacenId;
    const baseUnit = await prisma.unidad.create({ data: {
      tenantId,
      nombre: `${prefix}-each`,
      simbolo: `${prefix}-ea`,
      dimension: 'COUNT',
    } });
    baseUnitId = baseUnit.unidadId;
    unitIds.add(baseUnitId);
    const sourceUnit = await prisma.unidad.create({ data: {
      tenantId,
      nombre: `${prefix}-box`,
      simbolo: `${prefix}-bx`,
      dimension: 'COUNT',
    } });
    sourceUnitId = sourceUnit.unidadId;
    unitIds.add(sourceUnitId);
    const foreignTenant = await prisma.tenant.create({
      data: { nombre: `${prefix}-foreign`, slug: `${prefix}-foreign` },
    });
    tenantIds.add(foreignTenant.tenantId);
    const foreignUnit = await prisma.unidad.create({ data: {
      tenantId: foreignTenant.tenantId,
      nombre: `${prefix}-foreign-box`,
      simbolo: `${prefix}-fb`,
      dimension: 'COUNT',
    } });
    foreignUnitId = foreignUnit.unidadId;
    unitIds.add(foreignUnitId);

    actionUser = {
      userId,
      name: user.name,
      email: user.email,
      role: 'regularUser',
      isActive: true,
      tenantId,
      tenantRole: 'manager',
      planFeatures: { unidades: true },
    };
    auth.user = actionUser;
  });

  afterAll(async () => {
    auth.user = null;
    const cleanupErrors: Error[] = [];
    const attemptCleanup = async (label: string, operation: () => Promise<unknown>) => {
      try {
        await operation();
        return true;
      } catch (error) {
        cleanupErrors.push(new Error(`Cleanup failed (${label})`, { cause: error }));
        return false;
      }
    };

    try {
      for (const name of failpointNames) {
        await attemptCleanup(`expense failpoint ${name}`, () => toggleExpenseFailpoint(false, name));
      }
      if (tenantId) {
        await attemptCleanup('purchase document items', () =>
          prisma.compraDocumentoItem.deleteMany({ where: { tenantId } }));
        const triggerDropped = await attemptCleanup('drop temporary Kardex cleanup guard', () =>
          prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "stock_move_line_no_delete" ON "StockMoveLine"'));
        if (triggerDropped) {
          await attemptCleanup('scoped Kardex rows', () => prisma.stockMoveLine.deleteMany({ where: { tenantId } }));
          await attemptCleanup('restore Kardex cleanup guard', () => prisma.$executeRawUnsafe(`
            CREATE TRIGGER "stock_move_line_no_delete"
            BEFORE DELETE ON "StockMoveLine"
            FOR EACH ROW EXECUTE FUNCTION stock_move_line_inmutable()
          `));
        }
        await attemptCleanup('stock locations', () => prisma.stockUbicacion.deleteMany({ where: { tenantId } }));
        await attemptCleanup('product cost history', () => prisma.productoCostHistory.deleteMany({
          where: { productoId: { in: [...productIds] } },
        }));
        await attemptCleanup('unit conversions', () => prisma.unidadConversion.deleteMany({ where: { tenantId } }));
        await attemptCleanup('purchase documents', () => prisma.compraDocumento.deleteMany({ where: { tenantId } }));
        await attemptCleanup('purchase expenses', () => prisma.gastoCompra.deleteMany({ where: { tenantId } }));
        await attemptCleanup('products', () => prisma.producto.deleteMany({ where: { id: { in: [...productIds] } } }));
        await attemptCleanup('warehouses', () => prisma.almacen.deleteMany({ where: { tenantId } }));
        await attemptCleanup('categories', () => prisma.categoria.deleteMany({ where: { tenantId } }));
        await attemptCleanup('vendors', () => prisma.vendor.deleteMany({ where: { tenantId } }));
        await attemptCleanup('units', () => prisma.unidad.deleteMany({ where: { unidadId: { in: [...unitIds] } } }));
        await attemptCleanup('tenants', () => prisma.tenant.deleteMany({ where: { tenantId: { in: [...tenantIds] } } }));
      }
      if (userId) {
        await attemptCleanup('fixture user', () => prisma.user.deleteMany({ where: { userId } }));
      }
    } finally {
      await attemptCleanup('Prisma disconnect', () => prisma.$disconnect());
    }

    if (cleanupErrors.length > 0) {
      throw new AggregateError(cleanupErrors, 'Direct-purchase integration cleanup was incomplete');
    }
  });

  it('creates a product conversion through the server action and applies its exact factor to a direct purchase', async () => {
    const product = await createProduct('configured-action');
    const factor = '12.12500000';
    const configuration = await createProductUnitConversionAction({
      productoId: product.id,
      unidadId: sourceUnitId,
      factorAStock: factor,
    });

    expect(configuration.success).toBe(true);
    const conversion = await prisma.unidadConversion.findFirst({
      where: { tenantId, productoId: product.id, baseUnidadId: baseUnitId, unidadId: sourceUnitId },
    });
    expect(conversion?.factorAStock.toFixed(8)).toBe(factor);

    const invoice = `${prefix}-configured-action`;
    const result = await submitPurchase({
      productId: product.id,
      invoice,
      quantity: 8,
      unitPrice: 9700,
      sourceUnitId,
    });

    expect(result.success).toBe(true);
    const document = await prisma.compraDocumento.findFirst({
      where: { tenantId, numeroFactura: invoice },
      include: { items: true },
    });
    expect(document?.items[0]).toMatchObject({
      cantidad: 97,
      precioUnitario: 800,
      totalLinea: 77600,
      unidadOrigenId: sourceUnitId,
      cantidadOrigen: 8,
      precioUnitarioOrigen: 9700,
      unidadBaseIdSnapshot: baseUnitId,
    });
    expect(document?.items[0].factorAStockAplicado?.toFixed(8)).toBe(factor);
    expect(await prisma.stockUbicacion.findFirst({ where: { tenantId, productoId: product.id } }))
      .toMatchObject({ cantidad: 97, cantidadDisponible: 97 });
  });

  it('updates and deletes only its conversion while preserving historical purchase snapshots', async () => {
    const product = await createProduct('edit-delete-action');
    const created = await createProductUnitConversionAction({
      productoId: product.id,
      unidadId: sourceUnitId,
      factorAStock: '12.12500000',
    });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const updated = await updateProductUnitConversionAction({
      id: created.data.id,
      productoId: product.id,
      unidadId: sourceUnitId,
      factorAStock: '10.25000000',
    });
    expect(updated.success).toBe(true);
    const stored = await prisma.unidadConversion.findFirst({
      where: { id: created.data.id, tenantId, productoId: product.id },
    });
    expect(stored?.factorAStock.toFixed(8)).toBe('10.25000000');

    const historicalInvoice = `${prefix}-edit-delete-history`;
    const purchase = await submitPurchase({
      productId: product.id,
      invoice: historicalInvoice,
      quantity: 4,
      unitPrice: 2050,
      sourceUnitId,
    });
    expect(purchase.success).toBe(true);
    const historicalLine = await prisma.compraDocumentoItem.findFirst({
      where: { tenantId, productoId: product.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(historicalLine).toMatchObject({
      cantidad: 41,
      precioUnitario: 200,
      totalLinea: 8200,
      cantidadOrigen: 4,
      precioUnitarioOrigen: 2050,
      unidadOrigenId: sourceUnitId,
      unidadBaseIdSnapshot: baseUnitId,
    });
    expect(historicalLine?.factorAStockAplicado?.toFixed(8)).toBe('10.25000000');

    const deleted = await deleteProductUnitConversionAction({ id: created.data.id, productoId: product.id });
    expect(deleted.success).toBe(true);
    expect(await prisma.unidadConversion.findFirst({
      where: { id: created.data.id, tenantId, productoId: product.id },
    })).toBeNull();
    const preservedLine = await prisma.compraDocumentoItem.findFirst({
      where: { tenantId, productoId: product.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(preservedLine).toMatchObject({
      compraDocumentoItemId: historicalLine?.compraDocumentoItemId,
      cantidad: 41,
      unidadOrigenId: sourceUnitId,
      cantidadOrigen: 4,
      unidadBaseIdSnapshot: baseUnitId,
    });
    expect(preservedLine?.factorAStockAplicado?.toFixed(8)).toBe('10.25000000');

    const rejectedInvoice = `${prefix}-edit-delete-rejected`;
    const before = await captureEffects(product.id, rejectedInvoice);
    const rejected = await submitPurchase({
      productId: product.id,
      invoice: rejectedInvoice,
      quantity: 1,
      unitPrice: 2050,
      sourceUnitId,
    });
    expect(rejected.success).toBe(false);
    expect(await captureEffects(product.id, rejectedInvoice)).toBe(before);
    expect(await prisma.compraDocumentoItem.findUnique({
      where: { compraDocumentoItemId: historicalLine!.compraDocumentoItemId },
    })).toMatchObject({ cantidad: 41, factorAStockAplicado: expect.anything() });
  });

  it('persists normalized stock economics and all source snapshots for two boxes at 12 each', async () => {
    const product = await createProduct('converted');
    await prisma.unidadConversion.create({ data: {
      tenantId,
      productoId: product.id,
      baseUnidadId: baseUnitId,
      unidadId: sourceUnitId,
      factorAStock: '12',
    } });
    const invoice = `${prefix}-converted`;

    const result = await submitPurchase({
      productId: product.id,
      invoice,
      quantity: 2,
      unitPrice: 6000,
      sourceUnitId,
    });

    expect(result.success).toBe(true);
    const document = await prisma.compraDocumento.findFirst({
      where: { tenantId, numeroFactura: invoice },
      include: { items: true },
    });
    expect(document).not.toBeNull();
    expect(document?.total).toBe(12000);
    expect(document?.items).toHaveLength(1);
    const line = document!.items[0];
    expect({ cantidad: line.cantidad, unitPrice: line.precioUnitario, total: line.totalLinea })
      .toEqual({ cantidad: 24, unitPrice: 500, total: 12000 });
    expect({
      sourceUnit: line.unidadOrigenId,
      sourceName: line.unidadOrigenNombre,
      sourceSymbol: line.unidadOrigenSimbolo,
      sourceQuantity: line.cantidadOrigen,
      sourcePrice: line.precioUnitarioOrigen,
      factor: line.factorAStockAplicado?.toString(),
      baseUnit: line.unidadBaseIdSnapshot,
      baseName: line.unidadBaseNombreSnapshot,
      baseSymbol: line.unidadBaseSimboloSnapshot,
    }).toEqual({
      sourceUnit: sourceUnitId,
      sourceName: `${prefix}-box`,
      sourceSymbol: `${prefix}-bx`,
      sourceQuantity: 2,
      sourcePrice: 6000,
      factor: '12',
      baseUnit: baseUnitId,
      baseName: `${prefix}-each`,
      baseSymbol: `${prefix}-ea`,
    });

    const stock = await prisma.stockUbicacion.findFirst({ where: { tenantId, productoId: product.id } });
    expect(stock?.cantidad).toBe(24);
    expect(stock?.cantidadDisponible).toBe(24);
    const movement = await prisma.stockMoveLine.findFirst({
      where: { tenantId, productoId: product.id, tipoOrigen: 'COMPRA', origenId: document!.compraDocumentoId },
    });
    expect({ quantity: movement?.cantidad, unitCost: movement?.costoUnitario, total: movement?.costoTotal })
      .toEqual({ quantity: 24, unitCost: 500, total: 12000 });
    expect((await prisma.producto.findUnique({ where: { id: product.id } }))?.precioCosto).toBe(500);
    expect(await prisma.productoCostHistory.count({ where: { productoId: product.id, newPrecioCosto: 500 } }))
      .toBe(1);
    const expense = await prisma.gastoCompra.findUnique({
      where: { gastoCompraId: document!.gastoCompraId! },
    });
    expect({ quantity: expense?.cantidad, unitPrice: expense?.precioUnitario, total: expense?.total })
      .toEqual({ quantity: 24, unitPrice: 500, total: 12000 });
  });

  it('keeps the legacy no-unit purchase path in stock units without trace snapshots', async () => {
    const product = await createProduct('legacy');
    const invoice = `${prefix}-legacy`;

    const result = await submitPurchase({ productId: product.id, invoice, quantity: 3, unitPrice: 400 });

    expect(result.success).toBe(true);
    const document = await prisma.compraDocumento.findFirst({
      where: { tenantId, numeroFactura: invoice },
      include: { items: true },
    });
    expect(document?.total).toBe(1200);
    expect(document?.items[0]).toMatchObject({ cantidad: 3, precioUnitario: 400, totalLinea: 1200 });
    expect(document?.items[0].unidadOrigenId).toBeNull();
    expect(document?.items[0].factorAStockAplicado).toBeNull();
    expect((await prisma.stockUbicacion.findFirst({ where: { tenantId, productoId: product.id } }))?.cantidad)
      .toBe(3);
    const expense = await prisma.gastoCompra.findUnique({ where: { gastoCompraId: document!.gastoCompraId! } });
    expect({ quantity: expense?.cantidad, unitPrice: expense?.precioUnitario, total: expense?.total })
      .toEqual({ quantity: 3, unitPrice: 400, total: 1200 });
  });

  it('rejects another tenant unit and leaves no purchase side effects', async () => {
    const product = await createProduct('foreign-unit');
    const invoice = `${prefix}-foreign-unit`;
    const before = await captureEffects(product.id, invoice);

    const result = await submitPurchase({
      productId: product.id,
      invoice,
      quantity: 1,
      unitPrice: 1200,
      sourceUnitId: foreignUnitId,
    });

    expect(result.success).toBe(false);
    expect(await captureEffects(product.id, invoice)).toBe(before);
  });

  it('rejects a same-tenant unit without a product conversion and leaves no writes', async () => {
    const product = await createProduct('missing-conversion');
    const unit = await prisma.unidad.create({ data: {
      tenantId,
      nombre: `${prefix}-missing`,
      simbolo: `${prefix}-mi`,
      dimension: 'COUNT',
    } });
    unitIds.add(unit.unidadId);
    const invoice = `${prefix}-missing-conversion`;
    const before = await captureEffects(product.id, invoice);

    const result = await submitPurchase({
      productId: product.id,
      invoice,
      quantity: 1,
      unitPrice: 1200,
      sourceUnitId: unit.unidadId,
    });

    expect(result.success).toBe(false);
    expect(await captureEffects(product.id, invoice)).toBe(before);
  });

  it('rejects fractional converted unit cost and leaves no writes', async () => {
    const product = await createProduct('fractional-cost');
    const unit = await prisma.unidad.create({ data: {
      tenantId,
      nombre: `${prefix}-fractional`,
      simbolo: `${prefix}-fr`,
      dimension: 'COUNT',
    } });
    unitIds.add(unit.unidadId);
    await prisma.unidadConversion.create({ data: {
      tenantId,
      productoId: product.id,
      baseUnidadId: baseUnitId,
      unidadId: unit.unidadId,
      factorAStock: '1.5',
    } });
    const invoice = `${prefix}-fractional-cost`;
    const before = await captureEffects(product.id, invoice);

    const result = await submitPurchase({
      productId: product.id,
      invoice,
      quantity: 2,
      unitPrice: 1,
      sourceUnitId: unit.unidadId,
    });

    expect(result.success).toBe(false);
    expect(await captureEffects(product.id, invoice)).toBe(before);
  });

  it('rolls back document, cost, stock, Kardex and expense when late expense insert fails', async () => {
    const product = await createProduct('rollback');
    await prisma.unidadConversion.create({ data: {
      tenantId,
      productoId: product.id,
      baseUnidadId: baseUnitId,
      unidadId: sourceUnitId,
      factorAStock: '12',
    } });
    const invoice = `${prefix}-rollback`;
    const before = await captureEffects(product.id, invoice);
    const failpoint = `f1fail${randomUUID().replaceAll('-', '')}`;
    await toggleExpenseFailpoint(true, failpoint);

    try {
      const result = await submitPurchase({
        productId: product.id,
        invoice,
        quantity: 1,
        unitPrice: 1236,
        sourceUnitId,
      });

      expect(result.success).toBe(false);
      expect(await captureEffects(product.id, invoice)).toBe(before);
    } finally {
      await toggleExpenseFailpoint(false, failpoint);
    }
  });
});
