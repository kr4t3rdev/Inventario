import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { seedPlanContable, seedPlantillasGlobales } from '@/features/contabilidad-formal/services/seed-plan-contable';
import { assertDisposableDatabase, assertDisposableDatabaseIdentity } from '../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);
let prisma: typeof import('@/lib/prisma').prisma;
let emitir: typeof import('@/features/contabilidad-formal/services/capital-adjustment-posting-service').emitirInyeccionCapital;
let tenantId = '';
let userId = '';
const unique = randomUUID();

describe('posteo con período creado en la misma transacción', { timeout: 120_000 }, () => {
  beforeAll(async () => {
    vi.stubEnv('PERIODO_GUARD_ENABLED', 'true');
    vi.stubEnv('PERIODO_CONTABLE_MODE', 'enforce');
    vi.stubEnv('CONTABILIDAD_FORMAL_MODE', 'enforce');
    prisma = (await import('@/lib/prisma')).prisma;
    emitir = (await import('@/features/contabilidad-formal/services/capital-adjustment-posting-service')).emitirInyeccionCapital;
    const identity = await prisma.$queryRaw<Array<{ databaseName: string; roleName: string; serverPort: number }>>`
      SELECT current_database() AS "databaseName", current_user AS "roleName", inet_server_port() AS "serverPort"
    `;
    assertDisposableDatabaseIdentity(identity[0], process.env);
    tenantId = (await prisma.tenant.create({ data: { nombre: `periodo-tx-${unique}` } })).tenantId;
    userId = (await prisma.user.create({ data: { name: 'QA', email: `${unique}@test.local`, password: 'integration-only-placeholder' } })).userId;
    await prisma.moneda.upsert({ where: { codigo: 'CUP' }, create: { codigo: 'CUP', nombre: 'Peso cubano', simbolo: 'CUP' }, update: {} });
    await prisma.tenantAccountingPolicy.create({ data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: userId } });
    await prisma.$transaction((tx) => seedPlanContable(tx, tenantId));
    await seedPlantillasGlobales(prisma);
    await prisma.tenantLicense.create({ data: { tenantId, activa: true, expiracion: new Date(Date.now() + 86_400_000), features: { 'contabilidad-formal': true } } });
  });

  afterAll(async () => {
    if (prisma && tenantId) {
      await prisma.auditoriaPeriodo.deleteMany({ where: { tenantId } });
      await prisma.periodoCache.deleteMany({ where: { tenantId } });
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

  it('rechaza sin bloquearse al auditar un período cerrado sin confirmar', async () => {
    const fecha = new Date();
    let periodoId = '';
    await expect(prisma.$transaction(async (tx) => {
      const periodo = await tx.periodoContable.create({ data: {
        tenantId, tipo: 'MENSUAL', estado: 'CERRADO',
        fechaInicio: new Date(fecha.getTime() - 86_400_000), fechaFin: new Date(fecha.getTime() + 86_400_000),
      } });
      periodoId = periodo.periodoId;
      const intento = emitir(tx, { tenantId, userId }, {
        inyeccionId: randomUUID(), fecha, monto: 100, moneda: 'CUP', tipo: 'CAPITAL_SOCIAL',
      }).then(() => 'permitido', (error: { code?: string }) => error.code ?? 'error');
      const resultado = await Promise.race([
        intento,
        new Promise<string>((resolve) => setTimeout(() => resolve('bloqueado'), 1500)),
      ]);
      expect(resultado).toBe('PERIODO_CERRADO');
      throw new Error('rollback-controlado');
    }, { timeout: 5000 })).rejects.toThrow('rollback-controlado');
    const audit = await prisma.auditoriaPeriodo.findFirstOrThrow({ where: { tenantId, evento: 'INTENTO_BYPASS' } });
    expect(audit.periodoId).toBeNull();
    expect(audit.motivo).toContain('cerrado');
    expect(audit.payload).toMatchObject({ periodoId });
  });

  it('conserva la referencia visible y la auditoría si el cambio a cerrado se revierte', async () => {
    const fecha = new Date();
    const periodo = await prisma.periodoContable.create({ data: {
      tenantId, tipo: 'MENSUAL', estado: 'ABIERTO',
      fechaInicio: new Date(fecha.getTime() - 86_400_000), fechaFin: new Date(fecha.getTime() + 86_400_000),
    } });
    await expect(prisma.$transaction(async (tx) => {
      await tx.periodoContable.update({ where: { periodoId: periodo.periodoId }, data: { estado: 'CERRADO' } });
      await expect(emitir(tx, { tenantId, userId }, {
        inyeccionId: randomUUID(), fecha, monto: 100, moneda: 'CUP', tipo: 'CAPITAL_SOCIAL',
      })).rejects.toMatchObject({ code: 'PERIODO_CERRADO' });
      throw new Error('rollback-controlado');
    }, { timeout: 5000 })).rejects.toThrow('rollback-controlado');
    const audit = await prisma.auditoriaPeriodo.findFirstOrThrow({
      where: { tenantId, periodoId: periodo.periodoId, evento: 'INTENTO_BYPASS' },
    });
    expect(audit.motivo).toContain('cerrado');
    await prisma.auditoriaPeriodo.deleteMany({ where: { tenantId } });
    await prisma.periodoContable.delete({ where: { periodoId: periodo.periodoId } });
  });

  it('ve el período sin confirmar y revierte período y asiento al fallar', async () => {
    const fecha = new Date();
    const originId = randomUUID();
    await expect(prisma.$transaction(async (tx) => {
      const periodo = await tx.periodoContable.create({ data: {
        tenantId, tipo: 'MENSUAL', estado: 'ABIERTO',
        fechaInicio: new Date(fecha.getTime() - 86_400_000), fechaFin: new Date(fecha.getTime() + 86_400_000),
      } });
      const resultado = await emitir(tx, { tenantId, userId }, {
        inyeccionId: originId, fecha, monto: 100, moneda: 'CUP', tipo: 'CAPITAL_SOCIAL',
      });
      expect(resultado.estado).toBe('CONTABILIZADO');
      expect(await tx.asiento.count({ where: { tenantId, periodoId: periodo.periodoId, origenId: originId } })).toBe(1);
      throw new Error('rollback-controlado');
    })).rejects.toThrow('rollback-controlado');
    expect(await prisma.periodoContable.count({ where: { tenantId } })).toBe(0);
    expect(await prisma.asiento.count({ where: { tenantId, origenId: originId } })).toBe(0);
  });
});
