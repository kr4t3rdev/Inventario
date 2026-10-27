/**
 * @description Verifies product-reference ordering against disposable PostgreSQL.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@/generated/prisma';
import { PrismaClient } from '@/generated/prisma';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { expectActionFailure } from '@/test/action-response';
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

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

interface ProductReferenceBarrier {
  reached: () => void;
  release: Promise<void>;
}

let productReferenceBarrier: ProductReferenceBarrier | null = null;

/**
 * @description Detects product-usage SQL regardless of ORM or raw-query implementation.
 * @param {unknown} query - Prisma query-template, SQL object, or raw string.
 * @returns {boolean} True when the SQL references Producto.
 */
function isProductReferenceQuery(query: unknown): boolean {
  if (typeof query === 'string') return query.toLowerCase().includes('producto');
  if (Array.isArray(query)) return query.join(' ').toLowerCase().includes('producto');
  if (!query || typeof query !== 'object') return false;
  const value = query as Record<string, unknown>;
  const text = [value.sql, value.text, ...(Array.isArray(value.strings) ? value.strings : [])]
    .filter((part): part is string => typeof part === 'string')
    .join(' ');
  return text.toLowerCase().includes('producto');
}

/**
 * @description Pauses after a completed real SQL product-reference query when a barrier is armed.
 * @param {unknown} result - Result returned by the real Prisma call.
 * @param {unknown} query - SQL/template passed to Prisma.
 * @returns {Promise<unknown>} Unmodified real database result.
 */
async function pauseAfterProductReference(result: unknown, query: unknown): Promise<unknown> {
  const barrier = productReferenceBarrier;
  if (barrier && isProductReferenceQuery(query)) {
    productReferenceBarrier = null;
    barrier.reached();
    await barrier.release;
  }
  return result;
}

/**
 * @description Creates a promise gate for deterministic transaction coordination.
 * @returns {Deferred<T>} Promise and resolver pair.
 */
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((complete, fail) => { resolve = complete; reject = fail; });
  return { promise, resolve, reject };
}

/**
 * @description Wraps a real transaction client and gates only after its product-reference read.
 * @param {Prisma.TransactionClient} tx - Actual Prisma transaction client.
 * @returns {Prisma.TransactionClient} Forwarding proxy over the same transaction.
 */
function withReferenceReadBarrier(tx: Prisma.TransactionClient): Prisma.TransactionClient {
  return new Proxy(tx, {
    get(client, property) {
      if (property === 'producto') {
        return new Proxy(client.producto, {
          get(delegate, method) {
            if (method === 'findMany') {
              return async (args: Parameters<typeof client.producto.findMany>[0]) => {
                const products = await client.producto.findMany(args);
                return pauseAfterProductReference(products, 'SELECT "Producto" findMany');
              };
            }
            const value = Reflect.get(delegate, method, delegate);
            return typeof value === 'function' ? value.bind(delegate) : value;
          },
        });
      }
      if (property === '$queryRaw' || property === '$queryRawUnsafe') {
        const query = Reflect.get(client, property, client);
        return async (...args: unknown[]) => {
          const result = await Reflect.apply(query, client, args);
          return pauseAfterProductReference(result, args[0]);
        };
      }
      const value = Reflect.get(client, property, client);
      return typeof value === 'function' ? value.bind(client) : value;
    },
  });
}

const actionPrisma = new Proxy(prisma, {
  get(target, property) {
    if (property === '$transaction') {
      return (callback: unknown, options?: unknown) => {
        if (typeof callback !== 'function') {
          return Reflect.apply(target.$transaction, target, [callback, options]);
        }
        const forwarded = (tx: Prisma.TransactionClient) =>
          (callback as (client: Prisma.TransactionClient) => unknown)(
            withReferenceReadBarrier(tx)
          );
        return Reflect.apply(target.$transaction, target, [forwarded, options]);
      };
    }
    const value = Reflect.get(target, property, target);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});

vi.doMock('@/lib/prisma', () => ({ prisma: actionPrisma }));
assertDisposableDatabase(process.env);

const prefix = `unit-ref-${randomUUID().replaceAll('-', '')}`;
let tenantId = '';
let categoryId = '';
let warehouseId = '';
let foreignTenantId = '';
let foreignCategoryId = '';
let foreignWarehouseId = '';
let actor: AuthenticatedUser;
let updateUnidadAction!: typeof import('@/features/unidades/actions').updateUnidadAction;
const observer = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });

/**
 * @description Creates a tenant-owned unit with an explicit dimension.
 * @param {string} suffix - Unique fixture suffix.
 * @param {'COUNT' | 'MASS'} dimension - Unit dimension.
 * @returns {Promise<string>} Persisted unit ID.
 */
async function createUnit(suffix: string, dimension: 'COUNT' | 'MASS'): Promise<string> {
  const unit = await prisma.unidad.create({
    data: {
      tenantId,
      nombre: `${prefix}-${suffix}`,
      simbolo: `${prefix}-${suffix}`,
      dimension,
    },
    select: { unidadId: true },
  });
  return unit.unidadId;
}

/**
 * @description Builds a direct product write that exercises the real Producto→Unidad FK.
 * @param {string} unidadId - Unit referenced by the product.
 * @returns {Prisma.ProductoUncheckedCreateInput} Database fixture data.
 */
function productInput(
  unidadId: string,
  owner?: { tenantId: string; categoryId: string; warehouseId: string }
): Prisma.ProductoUncheckedCreateInput {
  return {
    tenantId: owner?.tenantId ?? tenantId,
    nombre: `${prefix}-product-${randomUUID()}`,
    precioCosto: 10,
    precioVenta: 20,
    stock: 0,
    categoriaId: owner?.categoryId ?? categoryId,
    unidadId,
    almacenId: owner?.warehouseId ?? warehouseId,
  };
}

/**
 * @description Waits for an actual PostgreSQL lock waiter or the operation's early settlement.
 * @param {() => boolean} isSettled - Whether the observed action/write already settled.
 * @param {'Unidad' | 'Producto'} table - Table expected in the blocked SQL statement.
 * @returns {Promise<'blocked' | 'settled'>} What PostgreSQL or the operation actually showed.
 */
async function observeLockOrSettlement(
  isSettled: () => boolean,
  table: 'Unidad' | 'Producto'
): Promise<'blocked' | 'settled'> {
  return vi.waitFor(async () => {
    if (isSettled()) return 'settled';
    const [waiters] = await observer.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*) FROM pg_stat_activity
      WHERE datname = current_database() AND state = 'active'
        AND wait_event_type = 'Lock' AND pid <> pg_backend_pid()
        AND query ILIKE ${`%${table}%`}
    `;
    if (Number(waiters.count) > 0) return 'blocked';
    throw new Error(`Awaiting actual PostgreSQL lock wait on ${table} or operation settlement`);
  }, { timeout: 10_000, interval: 10 });
}

describe('product references and unit dimension transitions — PostgreSQL', { timeout: 90_000 }, () => {
  beforeAll(async () => {
    const identity = await prisma.$queryRaw<Array<{
      databaseName: string;
      roleName: string;
      serverPort: number;
    }>>`
      SELECT current_database() AS "databaseName", current_user AS "roleName",
        inet_server_port() AS "serverPort"
    `;
    assertDisposableDatabaseIdentity(identity[0], process.env);
    const foreignKeys = await prisma.$queryRaw<Array<{
      deferrable: boolean;
      initiallyDeferred: boolean;
    }>>`
      SELECT condeferrable AS "deferrable", condeferred AS "initiallyDeferred"
      FROM pg_constraint
      WHERE contype = 'f' AND conrelid = '"Producto"'::regclass
        AND confrelid = '"Unidad"'::regclass
    `;
    expect(foreignKeys.length).toBeGreaterThan(0);
    expect(foreignKeys.every((key) => !key.deferrable && !key.initiallyDeferred)).toBe(true);

    const { updateUnidadAction: action } = await import('@/features/unidades/actions');
    updateUnidadAction = action;
    const tenant = await prisma.tenant.create({ data: { nombre: prefix, slug: prefix } });
    tenantId = tenant.tenantId;
    const category = await prisma.categoria.create({ data: { tenantId, nombre: prefix } });
    categoryId = category.catId;
    const warehouse = await prisma.almacen.create({ data: { tenantId, nombre: prefix } });
    warehouseId = warehouse.almacenId;
    const foreignTenant = await prisma.tenant.create({
      data: { nombre: `${prefix}-foreign`, slug: `${prefix}-foreign` },
    });
    foreignTenantId = foreignTenant.tenantId;
    const foreignCategory = await prisma.categoria.create({
      data: { tenantId: foreignTenantId, nombre: `${prefix}-foreign` },
    });
    foreignCategoryId = foreignCategory.catId;
    const foreignWarehouse = await prisma.almacen.create({
      data: { tenantId: foreignTenantId, nombre: `${prefix}-foreign` },
    });
    foreignWarehouseId = foreignWarehouse.almacenId;
    actor = {
      userId: `integration-${prefix}`,
      name: prefix,
      email: `${prefix}@test.local`,
      role: 'regularUser',
      isActive: true,
      tenantId,
      tenantRole: 'manager',
      planFeatures: { unidades: true },
    };
    auth.user = actor;
  });

  afterAll(async () => {
    auth.user = null;
    productReferenceBarrier = null;
    if (foreignTenantId) {
      await prisma.producto.deleteMany({ where: { tenantId: foreignTenantId } });
      await prisma.categoria.deleteMany({ where: { tenantId: foreignTenantId } });
      await prisma.almacen.deleteMany({ where: { tenantId: foreignTenantId } });
      await prisma.tenant.delete({ where: { tenantId: foreignTenantId } });
    }
    if (tenantId) {
      await prisma.unidadConversion.deleteMany({ where: { tenantId } });
      await prisma.producto.deleteMany({ where: { tenantId } });
      await prisma.unidad.deleteMany({ where: { tenantId } });
      await prisma.categoria.deleteMany({ where: { tenantId } });
      await prisma.almacen.deleteMany({ where: { tenantId } });
    }
    if (tenantId) await prisma.tenant.delete({ where: { tenantId } });
    await observer.$disconnect();
    await prisma.$disconnect();
  });

  it('blocks classification when a foreign tenant product references the globally owned unit ID', async () => {
    const unitId = await createUnit('foreign-reference', 'COUNT');
    const product = await prisma.producto.create({
      data: productInput(unitId, {
        tenantId: foreignTenantId,
        categoryId: foreignCategoryId,
        warehouseId: foreignWarehouseId,
      }),
      select: { id: true, tenantId: true, unidadId: true },
    });
    expect(product).toMatchObject({ tenantId: foreignTenantId, unidadId: unitId });

    const result = await updateUnidadAction({ unidadId: unitId, dimension: 'MASS' });

    expect(result.success).toBe(false);
    expect(expectActionFailure(result).error?.code).toBe('CONFLICT');
    await expect(prisma.unidad.findUniqueOrThrow({ where: { unidadId: unitId } }))
      .resolves.toMatchObject({ dimension: 'COUNT' });
  });

  it('waits for a committed READ COMMITTED product reference, then rejects reclassification', async () => {
    const unitId = await createUnit('product-first', 'COUNT');
    const inserted = deferred<string>();
    const releaseWriter = deferred<void>();
    const writer = prisma.$transaction(async (tx) => {
      const product = await tx.producto.create({
        data: productInput(unitId),
        select: { id: true },
      });
      inserted.resolve(product.id);
      await releaseWriter.promise;
      return product.id;
    }, { isolationLevel: 'ReadCommitted' }).catch((error: unknown) => {
      inserted.reject(error);
      throw error;
    });
    const actionState = { settled: false };
    let actionPromise: ReturnType<typeof updateUnidadAction> | undefined;
    let lockObservation: 'blocked' | 'settled' | undefined;
    try {
      await inserted.promise;
      actionPromise = updateUnidadAction({ unidadId: unitId, dimension: 'MASS' }).then(
        (result) => { actionState.settled = true; return result; },
        (error: unknown) => { actionState.settled = true; throw error; }
      );
      lockObservation = await observeLockOrSettlement(() => actionState.settled, 'Unidad');
      expect(lockObservation).toBe('blocked');
    } finally {
      releaseWriter.resolve();
      await Promise.allSettled([writer, ...(actionPromise ? [actionPromise] : [])]);
    }

    expect(actionPromise).toBeDefined();
    const result = await actionPromise!;
    expect(result.success).toBe(false);
    expect(expectActionFailure(result).error?.code).toBe('CONFLICT');
    await expect(prisma.unidad.findUniqueOrThrow({ where: { unidadId: unitId } }))
      .resolves.toMatchObject({ dimension: 'COUNT' });
  });

  it('holds the unit row lock while classifying before a READ COMMITTED product association', async () => {
    const unitId = await createUnit('dimension-first', 'COUNT');
    const reached = deferred<void>();
    const releaseAction = deferred<void>();
    productReferenceBarrier = { reached: () => reached.resolve(), release: releaseAction.promise };
    const actionState = { settled: false };
    const actionPromise = updateUnidadAction({ unidadId: unitId, dimension: 'MASS' }).then(
      (result) => {
        actionState.settled = true;
        if (!productReferenceBarrier) reached.reject(new Error('Action completed before the reference read'));
        return result;
      },
      (error: unknown) => {
        actionState.settled = true;
        reached.reject(error);
        throw error;
      }
    );
    let writeState: 'blocked' | 'settled' | undefined;
    let productPromise: Promise<{ id: string }> | undefined;
    const productState = { settled: false };
    let productError: unknown;
    try {
      await reached.promise;
      productPromise = prisma.producto.create({
        data: productInput(unitId),
        select: { id: true },
      }).then(
        (product) => { productState.settled = true; return product; },
        (error: unknown) => { productState.settled = true; productError = error; throw error; }
      );
      writeState = await observeLockOrSettlement(() => productState.settled, 'Producto');
      expect(writeState, productError instanceof Error ? productError.message : undefined)
        .toBe('blocked');
    } finally {
      releaseAction.resolve();
      await Promise.allSettled([actionPromise, ...(productPromise ? [productPromise] : [])]);
    }

    expect(actionState.settled).toBe(true);
    expect((await actionPromise).success).toBe(true);
    expect(await productPromise).toBeDefined();
    await expect(prisma.unidad.findUniqueOrThrow({ where: { unidadId: unitId } }))
      .resolves.toMatchObject({ dimension: 'MASS' });
  });
});
