/**
 * @description Verifies unit-dimension transitions against disposable PostgreSQL.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { expectActionFailure } from '@/test/action-response';
import { prisma } from '@/lib/prisma';
import { PrismaClient } from '@/generated/prisma';
import {
  assertDisposableDatabase,
  assertDisposableDatabaseIdentity,
} from '../../../../scripts/ci/disposable-database.mjs';

const auth = vi.hoisted(() => ({ user: null as AuthenticatedUser | null }));
vi.mock('@/lib/server-actions/get-current-user', () => ({
  getCurrentUser: async () => auth.user,
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

let outerReadBarrier: { reached: () => void; release: Promise<void> } | null = null;
const actionPrisma = new Proxy(prisma, {
  get(target, property) {
    if (property === 'unidad') {
      return new Proxy(target.unidad, {
        get(delegate, method) {
          if (method === 'findUnique') {
            return async (args: Parameters<typeof target.unidad.findUnique>[0]) => {
              const row = await target.unidad.findUnique(args);
              const barrier = outerReadBarrier;
              if (barrier && args.select?.tenantId && args.select?.dimension) {
                outerReadBarrier = null;
                barrier.reached();
                await barrier.release;
              }
              return row;
            };
          }
          const value = Reflect.get(delegate, method, delegate);
          return typeof value === 'function' ? value.bind(delegate) : value;
        },
      });
    }
    const value = Reflect.get(target, property, target);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});
vi.doMock('@/lib/prisma', () => ({ prisma: actionPrisma }));

assertDisposableDatabase(process.env);

const prefix = `unit-dim-${randomUUID().replaceAll('-', '')}`;
let tenantId = '';
let categoryId = '';
let warehouseId = '';
let userId = '';
let actor: AuthenticatedUser;
let updateUnidadAction!: typeof import('@/features/unidades/actions').updateUnidadAction;
const lockKey = Math.floor(Math.random() * 1_000_000_000) + 1_000_000_000;
const triggerName = `unit_dimension_gate_${randomUUID().replaceAll('-', '')}`;
const functionName = `${triggerName}_fn`;
const observer = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });

/**
 * @description Creates one unit with tenant-local unique names.
 * @param {string} name - Stable suffix for the fixture.
 * @param {'COUNT' | 'MASS' | 'VOLUME' | 'UNKNOWN'} dimension - Persisted dimension.
 * @returns {Promise<string>} The created unit identifier.
 */
async function createUnit(
  name: string,
  dimension: 'COUNT' | 'MASS' | 'VOLUME' | 'UNKNOWN'
): Promise<string> {
  const unit = await prisma.unidad.create({
    data: {
      tenantId,
      nombre: `${prefix}-${name}`,
      simbolo: `${prefix}-${name}`,
      dimension,
    },
    select: { unidadId: true },
  });
  return unit.unidadId;
}

/**
 * @description Creates a product and optionally a conversion from its base unit.
 * @param {string} baseUnidadId - Product's persisted base unit.
 * @param {string} [conversionUnidadId] - Optional alternate unit to link.
 * @returns {Promise<string>} The created product identifier.
 */
async function createProduct(baseUnidadId: string, conversionUnidadId?: string): Promise<string> {
  const product = await prisma.producto.create({
    data: {
      tenantId,
      nombre: `${prefix}-product-${randomUUID()}`,
      precioCosto: 10,
      precioVenta: 20,
      stock: 0,
      categoriaId: categoryId,
      unidadId: baseUnidadId,
      almacenId: warehouseId,
    },
    select: { id: true },
  });
  if (conversionUnidadId) {
    await prisma.unidadConversion.create({
      data: {
        tenantId,
        productoId: product.id,
        baseUnidadId,
        unidadId: conversionUnidadId,
        factorAStock: 2,
      },
    });
  }
  return product.id;
}

/**
 * @description Returns an authenticated tenant actor for the real server action.
 * @returns {AuthenticatedUser} The test user context.
 */
function currentActor(): AuthenticatedUser {
  return {
    userId,
    name: prefix,
    email: `${prefix}@test.local`,
    role: 'regularUser',
    isActive: true,
    tenantId,
    tenantRole: 'manager',
    planFeatures: { unidades: true },
  };
}

describe('unit dimension transitions — disposable PostgreSQL', { timeout: 90_000 }, () => {
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
    const { updateUnidadAction: action } = await import('@/features/unidades/actions');
    updateUnidadAction = action;

    const tenant = await prisma.tenant.create({ data: { nombre: prefix, slug: prefix } });
    tenantId = tenant.tenantId;
    const category = await prisma.categoria.create({ data: { tenantId, nombre: prefix } });
    categoryId = category.catId;
    const warehouse = await prisma.almacen.create({ data: { tenantId, nombre: prefix } });
    warehouseId = warehouse.almacenId;
    const user = await prisma.user.create({
      data: { name: prefix, email: `${prefix}@test.local`, password: 'disposable-fixture' },
    });
    userId = user.userId;
    actor = currentActor();
    auth.user = actor;
  });

  afterAll(async () => {
    auth.user = null;
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${triggerName}" ON "Unidad"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${functionName}"()`);
    if (tenantId) {
      await prisma.unidadConversion.deleteMany({ where: { tenantId } });
      await prisma.producto.deleteMany({ where: { tenantId } });
      await prisma.unidad.deleteMany({ where: { tenantId } });
      await prisma.categoria.deleteMany({ where: { tenantId } });
      await prisma.almacen.deleteMany({ where: { tenantId } });
      await prisma.user.deleteMany({ where: { userId } });
      await prisma.tenant.delete({ where: { tenantId } });
    }
    await observer.$disconnect();
    await prisma.$disconnect();
  });

  it('classifies an in-use UNKNOWN unit when all conversions match the target dimension', async () => {
    const base = await createUnit('mass-base', 'MASS');
    const target = await createUnit('mass-alternate', 'UNKNOWN');
    await createProduct(base, target);

    const result = await updateUnidadAction({ unidadId: target, dimension: 'MASS' });

    expect(result.success).toBe(true);
    await expect(prisma.unidad.findUniqueOrThrow({ where: { unidadId: target } }))
      .resolves.toMatchObject({ dimension: 'MASS' });
  });

  it('rejects an incompatible conversion without changing the UNKNOWN dimension', async () => {
    const base = await createUnit('count-base', 'COUNT');
    const target = await createUnit('unknown-alternate', 'UNKNOWN');
    await createProduct(base, target);

    const result = await updateUnidadAction({ unidadId: target, dimension: 'MASS' });

    expect(result.success).toBe(false);
    expect(expectActionFailure(result).error?.code).toBe('CONFLICT');
    await expect(prisma.unidad.findUniqueOrThrow({ where: { unidadId: target } }))
      .resolves.toMatchObject({ dimension: 'UNKNOWN' });
  });

  it.each(['VOLUME', 'UNKNOWN'] as const)(
    'blocks a used known unit from changing to %s',
    async (nextDimension) => {
      const unit = await createUnit(`known-${nextDimension}`, 'MASS');
      await createProduct(unit);

      const result = await updateUnidadAction({ unidadId: unit, dimension: nextDimension });

      expect(result.success).toBe(false);
      expect(expectActionFailure(result).error?.code).toBe('CONFLICT');
      await expect(prisma.unidad.findUniqueOrThrow({ where: { unidadId: unit } }))
        .resolves.toMatchObject({ dimension: 'MASS' });
    }
  );

  it('preserves a known dimension when a legacy update omits dimension', async () => {
    const unit = await createUnit('legacy', 'MASS');
    await createProduct(unit);

    const result = await updateUnidadAction({ unidadId: unit, nombre: `${prefix}-legacy-renamed` });

    expect(result.success).toBe(true);
    await expect(prisma.unidad.findUniqueOrThrow({ where: { unidadId: unit } }))
      .resolves.toMatchObject({ dimension: 'MASS', nombre: `${prefix}-legacy-renamed` });
  });

  it('rechecks a stale explicit UNKNOWN request after a concurrent known classification', async () => {
    const unit = await createUnit('stale', 'UNKNOWN');
    await createProduct(unit);
    let releaseRead!: () => void;
    let readReached!: () => void;
    const released = new Promise<void>((resolve) => { releaseRead = resolve; });
    const reached = new Promise<void>((resolve) => { readReached = resolve; });
    outerReadBarrier = { reached: readReached, release: released };
    const pending = updateUnidadAction({ unidadId: unit, dimension: 'UNKNOWN' });
    try {
      await reached;
      await prisma.unidad.update({ where: { unidadId: unit }, data: { dimension: 'COUNT' } });
    } finally {
      releaseRead();
      outerReadBarrier = null;
    }

    const result = await pending;
    expect(result.success).toBe(false);
    expect(expectActionFailure(result).error?.code).toBe('CONFLICT');
    await expect(prisma.unidad.findUniqueOrThrow({ where: { unidadId: unit } }))
      .resolves.toMatchObject({ dimension: 'COUNT' });
  });

  it('serializes simultaneous classifications so only one commits', async () => {
    const unit = await createUnit('race', 'UNKNOWN');
    await createProduct(unit);
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION "${functionName}"() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        PERFORM pg_advisory_xact_lock(${lockKey}::bigint);
        RETURN NEW;
      END;
      $$
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "${triggerName}" BEFORE UPDATE OF "dimension" ON "Unidad"
      FOR EACH ROW EXECUTE FUNCTION "${functionName}"()
    `);

    let releaseHolder!: () => void;
    let holderReady!: () => void;
    let holderError: unknown;
    const held = new Promise<void>((resolve) => { releaseHolder = resolve; });
    const ready = new Promise<void>((resolve) => { holderReady = resolve; });
    const holder = observer.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ locked: boolean }>>`
        SELECT TRUE AS locked
        FROM (SELECT pg_advisory_xact_lock(${lockKey}::bigint)) AS held_lock
      `;
      holderReady();
      await held;
    }, { timeout: 20_000 }).catch((error: unknown) => {
      holderError = error;
      holderReady();
    });
    let results: Awaited<ReturnType<typeof updateUnidadAction>>[] = [];
    let attempts: Promise<Awaited<ReturnType<typeof updateUnidadAction>>>[] = [];
    try {
      await ready;
      if (holderError) throw holderError;
      attempts = [
        updateUnidadAction({ unidadId: unit, dimension: 'MASS' }),
        updateUnidadAction({ unidadId: unit, dimension: 'COUNT' }),
      ];
      await vi.waitFor(async () => {
        const [blocked] = await prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT count(*) FROM pg_stat_activity
          WHERE datname = current_database() AND state = 'active'
            AND wait_event_type = 'Lock' AND pid <> pg_backend_pid()
        `;
        expect(Number(blocked.count)).toBeGreaterThanOrEqual(2);
      }, { timeout: 10_000, interval: 25 });
      releaseHolder();
      results = await Promise.all(attempts);
    } finally {
      releaseHolder();
      await Promise.allSettled(attempts);
      await holder;
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${triggerName}" ON "Unidad"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${functionName}"()`);
    }

    const loser = results.find((result) => !result.success);
    expect(results.filter((result) => result.success)).toHaveLength(1);
    expect(loser).toBeDefined();
    expect(expectActionFailure(loser!).error?.code).toBe('CONFLICT');
    const finalUnit = await prisma.unidad.findUniqueOrThrow({ where: { unidadId: unit } });
    expect(['MASS', 'COUNT']).toContain(finalUnit.dimension);
  });
});
