import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '@/lib/prisma';
import { PeriodoGuard } from '@/lib/services/periodo-contable-guard';

// Scope: direct PeriodoGuard durability only; this is not an exhaustive
// integration audit of every R0.5 writer/caller.
describe('auditoría durable de período cerrado', () => {
  const tenantIds: string[] = [];
  let previousMode: string | undefined;
  let previousEnabled: string | undefined;

  beforeAll(() => {
    previousMode = process.env.PERIODO_CONTABLE_MODE;
    previousEnabled = process.env.PERIODO_GUARD_ENABLED;
    process.env.PERIODO_CONTABLE_MODE = 'enforce';
    process.env.PERIODO_GUARD_ENABLED = 'true';
  });

  afterAll(async () => {
    if (previousMode === undefined) delete process.env.PERIODO_CONTABLE_MODE;
    else process.env.PERIODO_CONTABLE_MODE = previousMode;
    if (previousEnabled === undefined) delete process.env.PERIODO_GUARD_ENABLED;
    else process.env.PERIODO_GUARD_ENABLED = previousEnabled;
    for (const tenantId of tenantIds) {
      await prisma.auditoriaPeriodo.deleteMany({ where: { tenantId } });
      await prisma.periodoCache.deleteMany({ where: { tenantId } });
      await prisma.periodoContable.deleteMany({ where: { tenantId } });
      await prisma.tenant.delete({ where: { tenantId } });
    }
  });

  it.each([
    ['humano', 'USUARIO', 'usuario-auditor'],
    ['servicio', 'SERVICIO', 'servicio-auditor'],
  ] as const)(
    'conserva actor, origen, tenant, período y causa del actor %s aunque revierta el writer',
    async (_actorLabel, actorTipo, actorId) => {
    const tenant = await prisma.tenant.create({
      data: { nombre: 'Auditoría durable', slug: `cta-audit-${crypto.randomUUID()}` },
    });
    tenantIds.push(tenant.tenantId);
    const periodo = await prisma.periodoContable.create({
      data: {
        tenantId: tenant.tenantId,
        tipo: 'MENSUAL',
        estado: 'APROBADO',
        fechaInicio: new Date('2026-01-01T00:00:00Z'),
        fechaFin: new Date('2026-01-31T23:59:59Z'),
      },
    });
    const fecha = new Date('2026-01-15T12:00:00Z');
    const origen = { tipo: 'venta', id: `rechazo-${actorTipo.toLowerCase()}` };

    await expect(prisma.$transaction(async (tx) => {
      const [{ pid }] = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
      const rechazo = await PeriodoGuard.assertWritable(fecha, tenant.tenantId, 'asiento', {
        actorId, actorTipo, origen,
      });
      expect(rechazo).toMatchObject({ permitido: false, codigo: 'PERIODO_APROBADO' });
      const [{ pid: despues }] = await tx.$queryRaw<Array<{ pid: number }>>`
        SELECT pg_backend_pid() AS pid
      `;
      expect(despues).toBe(pid);
      throw new Error('rollback del writer');
    })).rejects.toThrow('rollback del writer');

    const auditorias = await prisma.auditoriaPeriodo.findMany({
      where: { tenantId: tenant.tenantId, evento: 'INTENTO_BYPASS' },
    });
    expect(auditorias).toHaveLength(1);
    expect(auditorias[0]).toMatchObject({
      periodoId: periodo.periodoId,
      tenantId: tenant.tenantId,
      actor: actorId,
      motivo: expect.stringContaining('aprobado'),
      payload: expect.objectContaining({ actorTipo, origen }),
    });
    },
  );
});
