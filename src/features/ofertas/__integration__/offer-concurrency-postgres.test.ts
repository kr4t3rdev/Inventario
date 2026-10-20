import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { assertDisposableDatabase, assertDisposableDatabaseIdentity } from '../../../../scripts/ci/disposable-database.mjs';
import { getCurrentUser } from '@/lib/server-actions/get-current-user';

assertDisposableDatabase(process.env);
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/server-actions/get-current-user');
// Only the unrelated shift bootstrap is stubbed: offer locks, reads and writes are real.
vi.mock('@/features/turnos-pos', () => ({ getOrCreateTurnoActivo: vi.fn(async () => ({
  success: true, data: { turnoId: 'unused-expired-offer' },
})) }));

let db!: typeof import('@/lib/prisma').prisma;
let observer!: InstanceType<typeof import('@/generated/prisma').PrismaClient>;
let tenantId = '';
let clientId = '';
let productId = '';
let pvId = '';
const prefix = `offer-race-${crypto.randomUUID()}`;

/**
 * @description Holds the actual offer lock until explicit release.
 * @param {string} id - Offer identifier.
 * @returns {Promise<object>} Holder PID and release handles.
 */
async function hold(id: string) {
  let release!: () => void;
  let ready!: (pid: number) => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const acquired = new Promise<number>((resolve) => { ready = resolve; });
  const { lockOferta } = await import('../lib/oferta-lock');
  const finished = db.$transaction(async (tx) => {
    await lockOferta(tx, tenantId, id);
    const [row] = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
    ready(row.pid);
    await gate;
  }, { timeout: 15_000 });
  return { pid: await acquired, release, finished };
}

/**
 * @description Observes exact held advisory-lock keys on an independent connection.
 * @param {number} pid - Holder backend PID.
 * @param {number} count - Required blocked writers.
 * @returns {Promise<void>} Resolves when the barrier is reached.
 */
async function waiting(pid: number, count: number) {
  await vi.waitFor(async () => {
    const [row] = await observer.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*) FROM pg_locks w JOIN pg_locks h ON w.locktype = h.locktype
        AND w.database = h.database AND w.classid = h.classid
        AND w.objid = h.objid AND w.objsubid = h.objsubid
      WHERE w.locktype = 'advisory' AND NOT w.granted AND h.granted AND h.pid = ${pid}
    `;
    expect(Number(row.count)).toBe(count);
  }, { timeout: 3000, interval: 20 });
}

/**
 * @description Creates an isolated offer with a real product snapshot.
 * @param {Date | null} expires - Optional expiration time.
 * @returns {Promise<object>} Persisted offer.
 */
async function offer(expires: Date | null = null) {
  return db.oferta.create({ data: {
    tenantId, clienteId: clientId, numeroOferta: crypto.randomUUID(),
    subtotal: 100, total: 100, fechaVencimiento: expires,
    items: { create: { productoId: productId, cantidad: 1, precioUnitario: 100, total: 100 } },
  } });
}

describe('offers concurrency — PostgreSQL', () => {
  beforeAll(async () => {
    db = (await import('@/lib/prisma')).prisma;
    const { PrismaClient } = await import('@/generated/prisma');
    observer = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
    const [identity] = await db.$queryRaw<Array<{ databaseName: string; roleName: string; serverPort: number }>>`
      SELECT current_database() AS "databaseName", current_user AS "roleName", inet_server_port() AS "serverPort"
    `;
    assertDisposableDatabaseIdentity(identity, process.env);
    tenantId = (await db.tenant.create({ data: { nombre: prefix, slug: prefix } })).tenantId;
    clientId = (await db.cliente.create({ data: { tenantId, nombre: prefix } })).clienteId;
    const category = await db.categoria.create({ data: { tenantId, nombre: prefix } });
    const warehouse = await db.almacen.create({ data: { tenantId, nombre: prefix } });
    productId = (await db.producto.create({ data: {
      tenantId, nombre: prefix, categoriaId: category.catId, almacenId: warehouse.almacenId,
      precioVenta: 100, precioCosto: 0, stock: 0,
    } })).id;
    pvId = (await db.puntoDeVenta.create({ data: { tenantId, nombre: prefix } })).pvId;
    vi.mocked(getCurrentUser).mockResolvedValue({
      userId: 'unused-offer-actor', name: 'Test actor', email: 'test@example.invalid',
      tenantId, role: 'admin', tenantRole: 'manager', isActive: true,
      planFeatures: { ofertas: true, 'ventas-pedidos': true },
    });
  });
  afterAll(async () => {
    // No accounting evidence is created by these rejection tests.
    if (tenantId) {
      await db.oferta.deleteMany({ where: { tenantId } });
      await db.producto.deleteMany({ where: { tenantId } });
      await db.categoria.deleteMany({ where: { tenantId } });
      await db.puntoDeVenta.deleteMany({ where: { tenantId } });
      await db.almacen.deleteMany({ where: { tenantId } });
      await db.cliente.deleteMany({ where: { tenantId } });
      await db.listaPrecio.deleteMany({ where: { tenantId } });
      await db.tenant.delete({ where: { tenantId } });
    }
    await observer?.$disconnect();
    await db?.$disconnect();
  });

  it('edits through real price resolution with client > default > base precedence', async () => {
    const saved = await offer();
    const { updateOfertaAction } = await import('../actions');
    const edit = () => updateOfertaAction({ ofertaId: saved.id,
      items: [{ productoId: productId, cantidad: 2 }],
    });
    expect(await edit()).toMatchObject({ success: true });
    expect(Number((await db.ofertaItem.findFirstOrThrow({ where: { ofertaId: saved.id } })).precioUnitario))
      .toBe(100);
    const defaultList = await db.listaPrecio.create({ data: {
      tenantId, nombre: prefix, esDefault: true,
      precios: { create: { productoId: productId, precio: 90 } },
    } });
    expect(await edit()).toMatchObject({ success: true });
    expect(Number((await db.ofertaItem.findFirstOrThrow({ where: { ofertaId: saved.id } })).precioUnitario))
      .toBe(90);
    const clientList = await db.listaPrecio.create({ data: {
      tenantId, nombre: prefix,
      precios: { create: { productoId: productId, precio: 80 } },
    } });
    try {
      await db.cliente.update({ where: { clienteId: clientId }, data: { listaPrecioId: clientList.id } });
      expect(await edit()).toMatchObject({ success: true });
      expect(Number((await db.ofertaItem.findFirstOrThrow({ where: { ofertaId: saved.id } })).precioUnitario))
        .toBe(80);
    } finally {
      await db.cliente.update({ where: { clienteId: clientId }, data: { listaPrecioId: null } });
      await db.listaPrecio.deleteMany({ where: { id: { in: [clientList.id, defaultList.id] } } });
    }
  });

  it('rejection queues behind editing and cannot be revived by the edit', async () => {
    const saved = await offer();
    const { updateOfertaAction } = await import('../actions');
    const held = await hold(saved.id);
    const edit = updateOfertaAction({ ofertaId: saved.id, estado: 'PENDIENTE',
      items: [{ productoId: productId, cantidad: 2 }],
    });
    let rejection!: ReturnType<typeof updateOfertaAction>;
    try {
      await waiting(held.pid, 1);
      rejection = updateOfertaAction({ ofertaId: saved.id, estado: 'RECHAZADA' });
      await waiting(held.pid, 2);
    } finally {
      held.release();
      await held.finished;
    }
    expect((await edit).success).toBe(true);
    expect((await rejection).success).toBe(true);
    const fresh = await db.oferta.findUniqueOrThrow({ where: { id: saved.id }, include: { items: true } });
    expect(fresh.estado).toBe('RECHAZADA');
    expect(fresh.items[0].cantidad).toBe(2);
  });

  it.each(['invoice', 'order'] as const)('%s rejects expiration after actual lock contention without documents', async (kind) => {
    const expires = new Date(Date.now() + 1500);
    const saved = await offer(expires);
    const { facturarOfertaAction, convertirOfertaAPedidoAction } = await import('../actions');
    const held = await hold(saved.id);
    const action = kind === 'invoice' ? facturarOfertaAction : convertirOfertaAPedidoAction;
    const pending = action({ ofertaId: saved.id, puntoDeVentaId: pvId });
    try {
      await waiting(held.pid, 1);
      await vi.waitFor(() => expect(Date.now()).toBeGreaterThan(expires.getTime()),
        { timeout: 3000, interval: 20 });
    } finally {
      held.release();
      await held.finished;
    }
    expect(await pending).toMatchObject({ success: false, error: { code: 'VALIDATION_ERROR',
      message: expect.stringContaining('vencida'),
    } });
    expect(await db.venta.count({ where: { tenantId, ofertaId: saved.id } })).toBe(0);
    expect(await db.factura.count({ where: { tenantId } })).toBe(0);
  });
});
