import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertDisposableDatabase, assertDisposableDatabaseIdentity } from '../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);
let prisma: typeof import('@/lib/prisma').prisma;
let run: typeof import('@/features/contabilidad/services/initialization-idempotency').runIdempotentInitialization;
let tenantId = '';
let repeatableTenantId = '';
let rollbackTenantId = '';
let isolationTenantA = '';
let isolationTenantB = '';
let conflictTenant = '';
let secondKeyTenant = '';
const input = { tenantId: '', idempotencyKey: 'concurrency-test', payloadHash: 'a'.repeat(64) };

describe('idempotencia de inicialización en PostgreSQL', { timeout: 120_000 }, () => {
  beforeAll(async () => {
    prisma = (await import('@/lib/prisma')).prisma;
    run = (await import('@/features/contabilidad/services/initialization-idempotency')).runIdempotentInitialization;
    const identity = await prisma.$queryRaw<Array<{ databaseName: string; roleName: string; serverPort: number }>>`
      SELECT current_database() AS "databaseName", current_user AS "roleName", inet_server_port() AS "serverPort"
    `;
    assertDisposableDatabaseIdentity(identity[0], process.env);
    tenantId = (await prisma.tenant.create({ data: { nombre: 'QA idempotencia', slug: randomUUID() } })).tenantId;
    repeatableTenantId = (await prisma.tenant.create({ data: { nombre: 'QA repeatable', slug: randomUUID() } })).tenantId;
    rollbackTenantId = (await prisma.tenant.create({ data: { nombre: 'QA rollback', slug: randomUUID() } })).tenantId;
    isolationTenantA = (await prisma.tenant.create({ data: { nombre: 'QA aislamiento A', slug: randomUUID() } })).tenantId;
    isolationTenantB = (await prisma.tenant.create({ data: { nombre: 'QA aislamiento B', slug: randomUUID() } })).tenantId;
    conflictTenant = (await prisma.tenant.create({ data: { nombre: 'QA conflicto', slug: randomUUID() } })).tenantId;
    secondKeyTenant = (await prisma.tenant.create({ data: { nombre: 'QA segunda clave', slug: randomUUID() } })).tenantId;
    input.tenantId = tenantId;
  });
  afterAll(async () => {
    if (!prisma) return;
    const tenantIds = [tenantId, repeatableTenantId, rollbackTenantId, isolationTenantA, isolationTenantB, conflictTenant, secondKeyTenant].filter(Boolean);
    await prisma.inicializacionContable.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.tenant.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.$disconnect();
  });

  it('serializa dos solicitudes concurrentes y devuelve el mismo resultado sin duplicar', async () => {
    let calls = 0;
    const execute = async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 150));
      return { cuentaId: 'id-unico' };
    };
    const results = await Promise.all([run(input, execute), run(input, execute)]);
    expect(calls).toBe(1);
    expect(results.map((r) => r.replayed).sort()).toEqual([false, true]);
    expect(results.map((r) => r.resultado)).toEqual([{ cuentaId: 'id-unico' }, { cuentaId: 'id-unico' }]);
    expect(await prisma.inicializacionContable.count({ where: { tenantId } })).toBe(1);
    await expect(run({ ...input, payloadHash: 'b'.repeat(64) }, execute)).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    await expect(run({ ...input, idempotencyKey: 'other-key' }, execute)).rejects.toMatchObject({ code: 'INITIALIZATION_ALREADY_COMPLETED' });
  });

  it('demuestra el conflicto de snapshot si se usara RepeatableRead', async () => {
    const { acquireAccountingTenantLock } = await import('@/features/contabilidad/services/accounting-tenant-lock-service');
    const runRepeatable = () => prisma.$transaction(async (tx) => {
      await acquireAccountingTenantLock(tx, repeatableTenantId);
      const existing = await tx.inicializacionContable.findFirst({ where: { tenantId: repeatableTenantId, idempotencyKey: 'repeatable-test' } });
      if (existing) return 'replayed';
      await new Promise((resolve) => setTimeout(resolve, 150));
      await tx.inicializacionContable.create({ data: { tenantId: repeatableTenantId, idempotencyKey: 'repeatable-test', payloadHash: 'c'.repeat(64) } });
      return 'created';
    }, { isolationLevel: 'RepeatableRead' });
    const results = await Promise.allSettled([runRepeatable(), runRepeatable()]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await prisma.inicializacionContable.count({ where: { tenantId: repeatableTenantId, idempotencyKey: 'repeatable-test' } })).toBe(1);
  });

  it('revierte la evidencia si falla la operación y permite un reintento', async () => {
    const request = { ...input, tenantId: rollbackTenantId, idempotencyKey: 'rollback-test' };
    await expect(run(request, async (tx) => {
      await tx.tenant.update({ where: { tenantId }, data: { nombre: 'No debe persistir' } });
      throw new Error('fallo de prueba');
    })).rejects.toThrow('fallo de prueba');
    expect((await prisma.tenant.findUniqueOrThrow({ where: { tenantId: rollbackTenantId } })).nombre).toBe('QA rollback');
    expect(await prisma.inicializacionContable.count({ where: { tenantId: rollbackTenantId, idempotencyKey: request.idempotencyKey } })).toBe(0);
    expect(await run(request, async () => ({ cuentaId: 'recuperado' }))).toEqual({ replayed: false, resultado: { cuentaId: 'recuperado' } });
  });

  it('aísla tenants: la misma clave en otro tenant ejecuta independiente sin fugar el resultado', async () => {
    const key = 'shared-key';
    const hash = 'd'.repeat(64);
    const first = await run({ tenantId: isolationTenantA, idempotencyKey: key, payloadHash: hash },
      async () => ({ cuentaId: 'tenant-a' }));
    const second = await run({ tenantId: isolationTenantB, idempotencyKey: key, payloadHash: hash },
      async () => ({ cuentaId: 'tenant-b' }));
    expect(first).toEqual({ replayed: false, resultado: { cuentaId: 'tenant-a' } });
    expect(second).toEqual({ replayed: false, resultado: { cuentaId: 'tenant-b' } });
    expect(await run({ tenantId: isolationTenantA, idempotencyKey: key, payloadHash: hash },
      async () => ({ cuentaId: 'otro' }))).toEqual({ replayed: true, resultado: { cuentaId: 'tenant-a' } });
    expect(await prisma.inicializacionContable.count({ where: { idempotencyKey: key } })).toBe(2);
  });

  it('serializa dos concurrentes con misma clave y distinto hash: una ejecuta y la otra ve conflicto', async () => {
    let calls = 0;
    const execute = async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 150));
      return { cuentaId: 'solo-una' };
    };
    const results = await Promise.allSettled([
      run({ tenantId: conflictTenant, idempotencyKey: 'conflict-key', payloadHash: 'e'.repeat(64) }, execute),
      run({ tenantId: conflictTenant, idempotencyKey: 'conflict-key', payloadHash: 'f'.repeat(64) }, execute),
    ]);
    expect(calls).toBe(1);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    expect(await prisma.inicializacionContable.count({ where: { tenantId: conflictTenant } })).toBe(1);
  });

  it('serializa dos concurrentes con claves distintas: una ejecuta y la otra ve inicialización completada', async () => {
    let calls = 0;
    const execute = async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 150));
      return { cuentaId: 'solo-una' };
    };
    const results = await Promise.allSettled([
      run({ tenantId: secondKeyTenant, idempotencyKey: 'key-1', payloadHash: 'e'.repeat(64) }, execute),
      run({ tenantId: secondKeyTenant, idempotencyKey: 'key-2', payloadHash: 'e'.repeat(64) }, execute),
    ]);
    expect(calls).toBe(1);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ code: 'INITIALIZATION_ALREADY_COMPLETED' });
    expect(await prisma.inicializacionContable.count({ where: { tenantId: secondKeyTenant } })).toBe(1);
  });
});
