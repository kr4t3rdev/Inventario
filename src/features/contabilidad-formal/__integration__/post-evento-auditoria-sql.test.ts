import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { postEvento } from '@/features/contabilidad-formal/services/posting-engine';
import { seedPlanContable } from '@/features/contabilidad-formal/services/seed-plan-contable';
import { PeriodoGuard } from '@/lib/services/periodo-contable-guard';

const fecha = new Date('2026-02-15T12:00:00Z');
const origen = `audit-sql-${crypto.randomUUID()}`;
let tenantId = '';
let periodoId = '';
const nombreOriginal = 'Auditoría SQL aislada';
let diarioId = '';
let diarioNombre = '';

/** @description Comprueba fallo cerrado con error SQL real en auditoría independiente. */
describe('postEvento ante fallo SQL de auditoría', { timeout: 60_000 }, () => {
  beforeAll(async () => {
    const tenant = await prisma.tenant.create({
      data: { nombre: nombreOriginal, slug: origen },
    });
    tenantId = tenant.tenantId;
    // Política contable requerida por el guard fail-closed del motor.
    await prisma.tenantAccountingPolicy.create({
      data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: 'actor-real' },
    });
    await prisma.$transaction((tx) => seedPlanContable(tx, tenantId));
    const diario = await prisma.diario.findFirstOrThrow({ where: { tenantId } });
    diarioId = diario.diarioId;
    diarioNombre = diario.nombre;
    await prisma.tenantLicense.create({ data: {
      tenantId, expiracion: new Date('2099-01-01'),
      features: { 'contabilidad-formal': true },
    } });
    const periodo = await prisma.periodoContable.create({ data: {
      tenantId, tipo: 'MENSUAL', estado: 'APROBADO',
      fechaInicio: new Date('2026-02-01T00:00:00Z'),
      fechaFin: new Date('2026-02-28T23:59:59Z'),
    } });
    periodoId = periodo.periodoId;
    // Primar la caché fuera del writer: la conexión raíz no debe esperar un lock
    // retenido por la transacción de negocio durante la resolución del período.
    await PeriodoGuard.assertWritable(fecha, tenantId, 'asiento', {
      actorId: 'actor-real', actorTipo: 'USUARIO', origen: { tipo: 'venta', id: `${origen}-prime` },
    });
    await prisma.auditoriaPeriodo.deleteMany({ where: { tenantId } });
    await prisma.$executeRawUnsafe(`CREATE FUNCTION audit_sql_fail_${origen.replaceAll('-', '_')}()
      RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM 1 / 0; RETURN NEW; END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER audit_sql_fail BEFORE INSERT ON "auditoria_periodos"
      FOR EACH ROW WHEN (NEW."tenantId" = '${tenantId}')
      EXECUTE FUNCTION audit_sql_fail_${origen.replaceAll('-', '_')}()`);
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS audit_sql_fail ON "auditoria_periodos"');
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS audit_sql_fail_${origen.replaceAll('-', '_')}()`);
    delete process.env.CONTABILIDAD_FORMAL_MODE;
    if (!tenantId) return;
    await prisma.shadowPosteoOutbox.deleteMany({ where: { tenantId } });
    await prisma.asiento.deleteMany({ where: { tenantId } });
    await prisma.auditoriaPeriodo.deleteMany({ where: { tenantId } });
    await prisma.cuentaRolTenant.deleteMany({ where: { tenantId } });
    await prisma.cuentaContable.deleteMany({ where: { tenantId } });
    await prisma.diario.deleteMany({ where: { tenantId } });
    await prisma.periodoCache.deleteMany({ where: { tenantId } });
    await prisma.periodoContable.deleteMany({ where: { tenantId } });
    await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { tenantId } });
  });

  for (const modo of ['shadow', 'enforce'] as const) {
    it(`rechaza writer sin auditoría y sin falsos registros en ${modo}`, async () => {
      process.env.CONTABILIDAD_FORMAL_MODE = modo;
      const id = `${origen}-${modo}`;
      await expect(prisma.$transaction(async (tx) => {
        const [{ pid }] = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
        await tx.diario.update({ where: { diarioId }, data: { nombre: `writer-${modo}` } });
        await postEvento(tx, { tenantId, userId: 'actor-real' }, {
          tipo: 'VENTA_CONTADO', fecha, descripcion: 'Venta bloqueada',
          origen: { tipo: 'venta', id }, monto: 100, montoFuncional: 100,
          moneda: 'CUP', monedaFuncional: 'CUP',
        });
        const [{ pid: despues }] = await tx.$queryRaw<Array<{ pid: number }>>`
          SELECT pg_backend_pid() AS pid`;
        expect(despues).toBe(pid);
      })).rejects.toMatchObject({ code: 'AUDITORIA_FALLIDA' });
      expect((await prisma.diario.findUniqueOrThrow({ where: { diarioId } })).nombre)
        .toBe(diarioNombre);
      expect(await prisma.auditoriaPeriodo.count({ where: { tenantId, periodoId } })).toBe(0);
      expect(await prisma.asiento.count({ where: { tenantId, origenId: id } })).toBe(0);
      expect(await prisma.shadowPosteoOutbox.count({ where: { tenantId, origenId: id } })).toBe(0);
    });
  }
});
