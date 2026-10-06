/**
 * @description R6-ROLLBACK — cerrar período revierte si falla el AuditLog.
 *
 * `cerrarPeriodoAction` escribe `AuditLog` con `logStrict(tx)` dentro de la misma
 * transacción que cambia el estado del período. Esta prueba demuestra en
 * PostgreSQL aislado que cuando el `INSERT` en `AuditLog` falla (trigger
 * `BEFORE INSERT`), el cierre se revierte por completo y el período queda
 * en su estado original.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { assertDisposableDatabase } from '../../../../scripts/ci/disposable-database.mjs';
import { prisma } from '@/lib/prisma';

assertDisposableDatabase(process.env);

vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));
vi.mock('@/lib/server-actions', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/server-actions')>();
  return { ...original, withAction: (handler: (...args: any[]) => unknown) => handler };
});

const prefix = `cta-periodo-rollback-${crypto.randomUUID()}`;
const userId = 'actor-periodo-rollback';
let tenantId = '';
let periodoId = '';
let trigger = '';

const manager = () => ({
  userId,
  role: 'admin',
  tenantId,
  tenantRole: 'manager',
  planFeatures: { contabilidad: true },
  permissions: new Set(['financiero.periodos.cerrar']),
}) as never;

describe('cerrar período — rollback por fallo de AuditLog', { timeout: 90_000 }, () => {
  beforeAll(async () => {
    const identity = await prisma.$queryRaw<Array<{ db: string; port: number }>>`
      SELECT current_database() AS db, inet_server_port() AS port
    `;
    const target = new URL(process.env.DATABASE_URL ?? '');
    expect(identity[0]).toMatchObject({
      db: target.pathname.slice(1),
      port: Number(target.port),
    });

    const { cerrarPeriodoAction } = await import('@/features/contabilidad/actions-periodos');
    (global as any).__cerrarPeriodoAction = cerrarPeriodoAction;

    const tenant = await prisma.tenant.create({ data: { nombre: prefix, slug: prefix } });
    tenantId = tenant.tenantId;
    const now = new Date();
    periodoId = (await prisma.periodoContable.create({ data: {
      tenantId,
      tipo: 'MENSUAL',
      estado: 'ABIERTO',
      fechaInicio: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      fechaFin: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59)),
    } })).periodoId;
  });

  afterAll(async () => {
    if (trigger) {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "AuditLog"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${trigger}_fn"()`);
    }
  });

  it('revierte el cierre cuando el INSERT en AuditLog falla', async () => {
    const cerrarPeriodoAction = (global as any).__cerrarPeriodoAction;

    // Happy path: el cierre persiste con su auditoría
    await cerrarPeriodoAction({ periodoId }, manager());
    let periodo = await prisma.periodoContable.findUnique({ where: { periodoId } });
    expect(periodo!.estado).not.toBe('ABIERTO');

    // Reabrimos para probar el rollback (si la action lo permite) o creamos otro período
    const now = new Date();
    const periodo2Id = (await prisma.periodoContable.create({ data: {
      tenantId,
      tipo: 'MENSUAL',
      estado: 'ABIERTO',
      fechaInicio: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)),
      fechaFin: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59)),
    } })).periodoId;

    // Trigger que bloquea el INSERT en AuditLog
    trigger = `cta_audit_fail_${crypto.randomUUID().replaceAll('-', '')}`;
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION "${trigger}_fn"() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'forced audit failure' USING ERRCODE = '22012';
        RETURN NEW;
      END $$`);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "${trigger}" BEFORE INSERT ON "AuditLog"
      FOR EACH ROW EXECUTE FUNCTION "${trigger}_fn"()`);

    try {
      await expect(cerrarPeriodoAction({ periodoId: periodo2Id }, manager())).rejects.toThrow();
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "AuditLog"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${trigger}_fn"()`);
      trigger = '';
    }

    // El período sigue ABIERTO: la mutación se revirtió
    periodo = await prisma.periodoContable.findUnique({ where: { periodoId: periodo2Id } });
    expect(periodo!.estado).toBe('ABIERTO');
  });
});
