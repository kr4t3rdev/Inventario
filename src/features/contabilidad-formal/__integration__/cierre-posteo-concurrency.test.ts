import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { seedPlanContable, seedPlantillasGlobales } from '@/features/contabilidad-formal/services/seed-plan-contable';
import { acquireAccountingTenantLock } from '@/features/contabilidad/services/accounting-tenant-lock-service';
import { assertDisposableDatabase, assertDisposableDatabaseIdentity } from '../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);
let prisma: typeof import('@/lib/prisma').prisma;
let emitir: typeof import('@/features/contabilidad-formal/services/capital-adjustment-posting-service').emitirInyeccionCapital;
let cerrarPeriodo: typeof import('@/lib/services/periodo-contable-service').PeriodoContableService.cerrarPeriodo;
let guard: typeof import('@/lib/services/periodo-contable-guard').PeriodoGuard;
let tenantId = '';
let userId = '';
const unique = randomUUID();

/** Resuelve una señal una sola vez para coordinar transacciones sin demoras arbitrarias. */
function signal() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('cierre concurrente con posteo contable', { timeout: 120_000 }, () => {
  beforeAll(async () => {
    vi.stubEnv('PERIODO_GUARD_ENABLED', 'true');
    vi.stubEnv('PERIODO_CONTABLE_MODE', 'enforce');
    vi.stubEnv('CONTABILIDAD_FORMAL_MODE', 'enforce');
    prisma = (await import('@/lib/prisma')).prisma;
    emitir = (await import('@/features/contabilidad-formal/services/capital-adjustment-posting-service')).emitirInyeccionCapital;
    cerrarPeriodo = (await import('@/lib/services/periodo-contable-service')).PeriodoContableService.cerrarPeriodo;
    guard = (await import('@/lib/services/periodo-contable-guard')).PeriodoGuard;
    const identity = await prisma.$queryRaw<Array<{ databaseName: string; roleName: string; serverPort: number }>>`
      SELECT current_database() AS "databaseName", current_user AS "roleName", inet_server_port() AS "serverPort"
    `;
    assertDisposableDatabaseIdentity(identity[0], process.env);
    tenantId = (await prisma.tenant.create({ data: { nombre: `cierre-posteo-${unique}` } })).tenantId;
    userId = (await prisma.user.create({ data: { name: 'QA', email: `${unique}@test.local`, password: 'integration-only-placeholder' } })).userId;
    await prisma.moneda.upsert({ where: { codigo: 'CUP' }, create: { codigo: 'CUP', nombre: 'Peso cubano', simbolo: 'CUP' }, update: {} });
    await prisma.tenantAccountingPolicy.create({ data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: userId } });
    await prisma.$transaction((tx) => seedPlanContable(tx, tenantId));
    await seedPlantillasGlobales(prisma);
    await prisma.tenantLicense.create({ data: { tenantId, activa: true, expiracion: new Date(Date.now() + 86_400_000), features: { 'contabilidad-formal': true } } });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await prisma.asientoLinea.deleteMany({ where: { tenantId } });
    await prisma.asiento.deleteMany({ where: { tenantId } });
    await prisma.auditoriaPeriodo.deleteMany({ where: { tenantId } });
    await prisma.periodoCache.deleteMany({ where: { tenantId } });
    await prisma.periodoContable.deleteMany({ where: { tenantId } });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    if (prisma && tenantId) {
      await prisma.asientoLinea.deleteMany({ where: { tenantId } });
      await prisma.asiento.deleteMany({ where: { tenantId } });
      await prisma.auditoriaPeriodo.deleteMany({ where: { tenantId } });
      await prisma.periodoCache.deleteMany({ where: { tenantId } });
      await prisma.periodoContable.deleteMany({ where: { tenantId } });
      await prisma.cuentaRolTenant.deleteMany({ where: { tenantId } });
      await prisma.cuentaContable.updateMany({ where: { tenantId }, data: { padreId: null } });
      await prisma.cuentaContable.deleteMany({ where: { tenantId } });
      await prisma.diario.deleteMany({ where: { tenantId } });
      await prisma.tenantLicense.deleteMany({ where: { tenantId } });
      await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId } });
      await prisma.tenant.deleteMany({ where: { tenantId } });
      await prisma.user.deleteMany({ where: { userId } });
    }
    await prisma?.$disconnect();
    vi.unstubAllEnvs();
  });

  it.each(['ReadCommitted', 'RepeatableRead'] as const)(
    'no escribe tras cierre concurrente con aislamiento %s', async (isolationLevel) => {
    const fecha = new Date();
    const periodo = await prisma.periodoContable.create({ data: {
      tenantId, tipo: 'MENSUAL', estado: 'ABIERTO',
      fechaInicio: new Date(fecha.getTime() - 86_400_000), fechaFin: new Date(fecha.getTime() + 86_400_000),
    } });
    const checked = signal();
    const release = signal();
    const original = guard.assertWritable.bind(guard);
    const spy = vi.spyOn(guard, 'assertWritable').mockImplementation(async (...args) => {
      const result = await original(...args);
      checked.resolve();
      await release.promise;
      return result;
    });
    const originId = randomUUID();
    const posting = prisma.$transaction(async (tx) => {
      // En RepeatableRead fija el snapshot antes de que el cierre compita.
      await tx.periodoContable.count({ where: { tenantId } });
      return emitir(tx, { tenantId, userId }, {
        inyeccionId: originId, fecha, monto: 100, moneda: 'CUP', tipo: 'CAPITAL_SOCIAL',
      });
    }, { timeout: 15_000, isolationLevel });
    let cierreGano = false;
    try {
      await checked.promise;
      cierreGano = await prisma.$transaction(async (tx) => {
        const [{ acquired }] = await tx.$queryRaw<Array<{ acquired: boolean }>>`
          SELECT pg_try_advisory_xact_lock(hashtextextended(${tenantId}, 0)) AS acquired
        `;
        if (!acquired) return false;
        await tx.periodoContable.update({ where: { periodoId: periodo.periodoId }, data: { estado: 'CERRADO' } });
        return true;
      }, { timeout: 10_000 });
    } finally {
      release.resolve();
    }
    const outcome = await posting.then((value) => ({ value }), (error: unknown) => ({ error }));
    spy.mockRestore();
    if (cierreGano) {
      expect(await prisma.asiento.count({ where: { tenantId, origenId: originId } })).toBe(0);
      expect(outcome).toHaveProperty('error');
    } else {
      // Si el posteo ya posee la barrera, puede finalizar antes del cierre.
      expect(outcome).toHaveProperty('value');
      expect(await prisma.asiento.count({ where: { tenantId, origenId: originId } })).toBe(1);
      expect((await prisma.periodoContable.findUniqueOrThrow({ where: { periodoId: periodo.periodoId } })).estado).toBe('ABIERTO');
    }
  });

  it('rechaza un posteo con snapshot anterior cuando el cierre ganó primero', async () => {
    const fecha = new Date();
    const periodo = await prisma.periodoContable.create({ data: {
      tenantId, tipo: 'MENSUAL', estado: 'ABIERTO',
      fechaInicio: new Date(fecha.getTime() - 86_400_000), fechaFin: new Date(fecha.getTime() + 86_400_000),
    } });
    await prisma.$executeRaw`
      INSERT INTO "periodo_contable_versiones" ("tenantId", "version")
      VALUES (${tenantId}, 0)
      ON CONFLICT ("tenantId") DO NOTHING
    `;
    const snapshotEstablished = signal();
    const resumePosting = signal();
    const originId = randomUUID();
    const posting = prisma.$transaction(async (tx) => {
      await tx.periodoContable.count({ where: { tenantId } });
      snapshotEstablished.resolve();
      await resumePosting.promise;
      return emitir(tx, { tenantId, userId }, {
        inyeccionId: originId, fecha, monto: 100, moneda: 'CUP', tipo: 'CAPITAL_SOCIAL',
      });
    }, { timeout: 15_000, isolationLevel: 'RepeatableRead' });

    await snapshotEstablished.promise;
    await prisma.$transaction(async (tx) => {
      const [{ acquired }] = await tx.$queryRaw<Array<{ acquired: boolean }>>`
        SELECT pg_try_advisory_xact_lock(hashtextextended(${tenantId}, 0)) AS acquired
      `;
      expect(acquired).toBe(true);
      await tx.$executeRaw`
        UPDATE "periodo_contable_versiones"
        SET "version" = "version" + 1, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "tenantId" = ${tenantId}
      `;
      await tx.periodoContable.update({ where: { periodoId: periodo.periodoId }, data: { estado: 'CERRADO' } });
    }, { timeout: 10_000 });
    resumePosting.resolve();

    const outcome = await posting.then((value) => ({ value }), (error: unknown) => ({ error }));
    expect(outcome).toHaveProperty('error');
    expect(await prisma.asiento.count({ where: { tenantId, origenId: originId } })).toBe(0);
  });

  it('aborta el cierre serializable si un posteo confirma mientras espera el lock', async () => {
    const fecha = new Date();
    const periodo = await prisma.periodoContable.create({ data: {
      tenantId, tipo: 'MENSUAL', estado: 'ABIERTO',
      fechaInicio: new Date(fecha.getTime() - 86_400_000), fechaFin: new Date(fecha.getTime() + 86_400_000),
    } });
    await prisma.$executeRaw`
      INSERT INTO "periodo_contable_versiones" ("tenantId", "version")
      VALUES (${tenantId}, 0)
      ON CONFLICT ("tenantId") DO NOTHING
    `;
    const checked = signal();
    const release = signal();
    const closeSnapshotEstablished = signal();
    const original = guard.assertWritable.bind(guard);
    const spy = vi.spyOn(guard, 'assertWritable').mockImplementation(async (...args) => {
      const result = await original(...args);
      checked.resolve();
      await release.promise;
      return result;
    });
    const originId = randomUUID();
    const posting = prisma.$transaction((tx) => emitir(tx, { tenantId, userId }, {
      inyeccionId: originId, fecha, monto: 100, moneda: 'CUP', tipo: 'CAPITAL_SOCIAL',
    }), { timeout: 15_000, isolationLevel: 'ReadCommitted' });

    await checked.promise;
    const closing = prisma.$transaction(async (tx) => {
      await tx.periodoContable.count({ where: { tenantId } });
      closeSnapshotEstablished.resolve();
      await acquireAccountingTenantLock(tx, tenantId);
      return cerrarPeriodo(periodo.periodoId, userId, undefined, false, tx);
    }, { timeout: 15_000, isolationLevel: 'Serializable' });
    await closeSnapshotEstablished.promise;
    release.resolve();

    const postOutcome = await posting.then((value) => ({ value }), (error: unknown) => ({ error }));
    const closeOutcome = await closing.then((value) => ({ value }), (error: unknown) => ({ error }));
    spy.mockRestore();
    expect(postOutcome).toHaveProperty('value');
    expect(closeOutcome).toHaveProperty('error');
    expect(await prisma.asiento.count({ where: { tenantId, origenId: originId } })).toBe(1);
    expect((await prisma.periodoContable.findUniqueOrThrow({ where: { periodoId: periodo.periodoId } })).estado).toBe('ABIERTO');
  });
});
