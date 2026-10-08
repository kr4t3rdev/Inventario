/**
 * @description Verifies PeriodoGuard audit durability/fail-closed behavior inside a simulated writer transaction.
 * This is guard-level integration coverage, not an end-to-end sale or postEvento test.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '@/lib/prisma';
import { PeriodoGuard } from '@/lib/services/periodo-contable-guard';

describe('writer contable con auditoría durable y fail-closed', { timeout: 60_000 }, () => {
  const suffix = crypto.randomUUID().replaceAll('-', '');
  const slug = `r23-audit-${suffix}`;
  const fecha = new Date('2026-03-15T12:00:00Z');
  const triggerName = `r23_audit_fail_${suffix}`;
  let tenantId = '';
  let periodoId = '';
  let previousMode: string | undefined;
  let previousEnabled: string | undefined;

  beforeAll(async () => {
    previousMode = process.env.PERIODO_CONTABLE_MODE;
    previousEnabled = process.env.PERIODO_GUARD_ENABLED;
    process.env.PERIODO_CONTABLE_MODE = 'enforce';
    process.env.PERIODO_GUARD_ENABLED = 'true';

    const tenant = await prisma.tenant.create({
      data: { nombre: 'R2.3 audit durable writer', slug },
    });
    tenantId = tenant.tenantId;
    const periodo = await prisma.periodoContable.create({
      data: {
        tenantId,
        tipo: 'MENSUAL',
        estado: 'APROBADO',
        fechaInicio: new Date('2026-03-01T00:00:00Z'),
        fechaFin: new Date('2026-03-31T23:59:59Z'),
      },
    });
    periodoId = periodo.periodoId;

    // Resolve before opening writer transactions: the guard's cache is written
    // through the root client and must not contend with the business transaction.
    await PeriodoGuard.assertWritable(fecha, tenantId, 'venta', {
      actorId: 'r23-audit-test',
      actorTipo: 'USUARIO',
      origen: { tipo: 'venta', id: `${slug}-cache-prime` },
    });
    await prisma.auditoriaPeriodo.deleteMany({ where: { tenantId } });
  });

  afterAll(async () => {
    try {
      if (tenantId) {
        await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${triggerName} ON "auditoria_periodos"`);
        await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${triggerName}()`);
        await prisma.auditoriaPeriodo.deleteMany({ where: { tenantId } });
        await prisma.periodoCache.deleteMany({ where: { tenantId } });
        await prisma.periodoContable.deleteMany({ where: { tenantId } });
        await prisma.tenant.delete({ where: { tenantId } });
      }
    } finally {
      if (previousMode === undefined) delete process.env.PERIODO_CONTABLE_MODE;
      else process.env.PERIODO_CONTABLE_MODE = previousMode;
      if (previousEnabled === undefined) delete process.env.PERIODO_GUARD_ENABLED;
      else process.env.PERIODO_GUARD_ENABLED = previousEnabled;
    }
  });

  it('conserva INTENTO_BYPASS fuera de la transacción del writer que revierte', async () => {
    const origenId = `${slug}-rollback`;
    await expect(prisma.$transaction(async (tx) => {
      await tx.tenant.update({ where: { tenantId }, data: { nombre: 'writer transaction pending' } });
      const result = await PeriodoGuard.assertWritable(fecha, tenantId, 'venta', {
        actorId: 'actor-durable',
        actorTipo: 'USUARIO',
        origen: { tipo: 'venta', id: origenId },
      });
      expect(result).toMatchObject({ permitido: false, codigo: 'PERIODO_APROBADO' });
      throw new Error('rollback business writer');
    })).rejects.toThrow('rollback business writer');

    expect((await prisma.tenant.findUniqueOrThrow({ where: { tenantId } })).nombre)
      .toBe('R2.3 audit durable writer');
    const audit = await prisma.auditoriaPeriodo.findMany({
      where: { tenantId, periodoId, evento: 'INTENTO_BYPASS', actor: 'actor-durable' },
    });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      tenantId,
      periodoId,
      actor: 'actor-durable',
      payload: expect.objectContaining({
        tipoOperacion: 'venta',
        origen: { tipo: 'venta', id: origenId },
      }),
    });
  });

  it('no confirma el writer si PostgreSQL rechaza el INSERT de auditoría', async () => {
    await prisma.$executeRawUnsafe(`CREATE FUNCTION ${triggerName}()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW."tenantId" = '${tenantId}' THEN
          RAISE EXCEPTION 'R2 injected audit write failure';
        END IF;
        RETURN NEW;
      END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER ${triggerName}
      BEFORE INSERT ON "auditoria_periodos" FOR EACH ROW
      EXECUTE FUNCTION ${triggerName}()`);

    // Calibrate the failure injection directly; the later guard rejection alone
    // would not prove that this trigger, rather than another condition, failed.
    await expect(prisma.auditoriaPeriodo.create({
      data: {
        periodoId,
        tenantId,
        evento: 'INTENTO_BYPASS',
        actor: 'trigger-calibration',
      },
    })).rejects.toThrow('R2 injected audit write failure');

    const writerName = 'R2.3 audit durable writer';
    await expect(prisma.$transaction(async (tx) => {
      await tx.tenant.update({ where: { tenantId }, data: { nombre: 'writer must rollback' } });
      await PeriodoGuard.assertWritable(fecha, tenantId, 'venta', {
        actorId: 'actor-fail-closed',
        actorTipo: 'USUARIO',
        origen: { tipo: 'venta', id: `${slug}-audit-failure` },
      });
    })).rejects.toMatchObject({ code: 'AUDITORIA_FALLIDA' });

    expect((await prisma.tenant.findUniqueOrThrow({ where: { tenantId } })).nombre).toBe(writerName);
    expect(await prisma.auditoriaPeriodo.count({
      where: { tenantId, periodoId, evento: 'INTENTO_BYPASS', actor: 'actor-fail-closed' },
    })).toBe(0);
  });
});
