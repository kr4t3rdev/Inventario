import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { seedPlanContable, seedPlantillasGlobales } from
  '@/features/contabilidad-formal/services/seed-plan-contable';
import { postEvento } from '@/features/contabilidad-formal/services/posting-engine';

const origen = `shadow-real-${crypto.randomUUID()}`;
const fecha = new Date('2026-09-21T15:00:00Z');
let tenantId = '';
let previousMode: string | undefined;

/** @description Confirma aislamiento del intento SQL y evidencia ligada al commit. */
describe('postEvento shadow con tenant real', { timeout: 60_000 }, () => {
  beforeAll(async () => {
    previousMode = process.env.CONTABILIDAD_FORMAL_MODE;
    process.env.CONTABILIDAD_FORMAL_MODE = 'shadow';
    const tenant = await prisma.tenant.create({
      data: { nombre: 'Shadow SQL integrado', slug: origen },
    });
    tenantId = tenant.tenantId;
    // Política contable requerida por el guard fail-closed del motor.
    await prisma.tenantAccountingPolicy.create({
      data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: 'actor-shadow' },
    });
    await prisma.$transaction(async (tx) => {
      await seedPlantillasGlobales(tx);
      await seedPlanContable(tx, tenantId);
    });
    await prisma.tenantLicense.create({ data: {
      tenantId, expiracion: new Date('2099-01-01'),
      features: { 'contabilidad-formal': true },
    } });
    await prisma.periodoContable.create({ data: {
      tenantId, tipo: 'MENSUAL', estado: 'ABIERTO',
      fechaInicio: new Date('2026-01-01'), fechaFin: new Date('2026-12-31T23:59:59Z'),
    } });
  });

  afterAll(async () => {
    if (previousMode === undefined) {
      delete process.env.CONTABILIDAD_FORMAL_MODE;
    } else {
      process.env.CONTABILIDAD_FORMAL_MODE = previousMode;
    }
    if (!tenantId) return;
    await prisma.shadowPosteoOutbox.deleteMany({ where: { tenantId } });
    await prisma.asiento.deleteMany({ where: { tenantId } });
    await prisma.cuentaRolTenant.deleteMany({ where: { tenantId } });
    await prisma.cuentaContable.deleteMany({ where: { tenantId } });
    await prisma.diario.deleteMany({ where: { tenantId } });
    await prisma.periodoCache.deleteMany({ where: { tenantId } });
    await prisma.periodoContable.deleteMany({ where: { tenantId } });
    await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { tenantId } });
  });

  /** @description Ejecuta un error PostgreSQL dentro del insert real del posteo. */
  async function writer(id: string, rollback: boolean, failOutbox = false) {
    return prisma.$transaction(async (tx) => {
      if (!failOutbox) {
        await tx.$executeRawUnsafe('CREATE TEMP TABLE IF NOT EXISTS shadow_sql_fail_counter (value integer NOT NULL)');
        await tx.$executeRawUnsafe('TRUNCATE pg_temp.shadow_sql_fail_counter');
        await tx.$executeRawUnsafe('INSERT INTO pg_temp.shadow_sql_fail_counter VALUES (0)');
        await tx.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION pg_temp.shadow_sql_fail() RETURNS trigger
          LANGUAGE plpgsql AS $$ DECLARE n integer; BEGIN
            UPDATE pg_temp.shadow_sql_fail_counter SET value = value + 1 RETURNING value INTO n;
            IF n = 2 THEN RAISE EXCEPTION 'injected line failure after partial insert'; END IF;
            RETURN NEW;
          END $$`);
        await tx.$executeRawUnsafe(`CREATE TRIGGER shadow_sql_fail AFTER INSERT ON "asiento_lineas"
          FOR EACH ROW EXECUTE FUNCTION pg_temp.shadow_sql_fail()`);
      }
      if (failOutbox) {
        await tx.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION pg_temp.shadow_outbox_fail() RETURNS trigger
          LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'outbox write failure'; END $$`);
        await tx.$executeRawUnsafe(`CREATE TRIGGER shadow_outbox_fail BEFORE INSERT ON shadow_posteo_outbox
          FOR EACH ROW EXECUTE FUNCTION pg_temp.shadow_outbox_fail()`);
      }
      const resultado = await postEvento(tx, { tenantId, userId: 'actor-shadow' }, {
        tipo: 'VENTA_CONTADO', fecha, descripcion: 'Venta shadow SQL',
        origen: { tipo: 'venta', id }, monto: 100, montoFuncional: 100,
        moneda: 'CUP', monedaFuncional: 'CUP',
      });
      if (!failOutbox) {
        expect(resultado.estado).toBe('ERROR_SHADOW');
        expect(resultado.motivo).toMatch(/partial insert/i);
      }
      expect(await tx.asiento.count({ where: { tenantId, origenId: id } })).toBe(0);
      if (!failOutbox) await tx.$executeRawUnsafe('DROP TRIGGER shadow_sql_fail ON "asiento_lineas"');
      if (failOutbox) {
        await tx.$executeRawUnsafe('DROP TRIGGER shadow_outbox_fail ON shadow_posteo_outbox');
      }
      if (rollback) throw new Error('rollback exterior');
      return tx.$queryRaw<Array<{ alive: number }>>`SELECT 1 AS alive`;
    });
  }

  it('confirma writer sin asiento parcial y entrega ERROR_SHADOW postcommit', async () => {
    const id = `${origen}-commit`;
    expect((await writer(id, false))[0].alive).toBe(1);
    expect(await prisma.asiento.count({ where: { tenantId, origenId: id } })).toBe(0);
    expect(await prisma.shadowPosteoOutbox.findFirst({ where: { tenantId, origenId: id } }))
      .toMatchObject({ estado: 'ERROR_SHADOW', entregadoAt: null });
  });

  it('rollback exterior no deja outbox', async () => {
    const id = `${origen}-rollback`;
    await expect(writer(id, true)).rejects.toThrow('rollback exterior');
    expect(await prisma.shadowPosteoOutbox.count({ where: { tenantId, origenId: id } })).toBe(0);
    expect(await prisma.asiento.count({ where: { tenantId, origenId: id } })).toBe(0);
  });

  it('falla la transacción si el outbox no puede persistir evidencia', async () => {
    const id = `${origen}-outbox-failure`;
    await expect(writer(id, false, true)).rejects.toMatchObject({
      code: 'OUTBOX_SHADOW_FALLIDA',
    });
    expect(await prisma.shadowPosteoOutbox.count({ where: { tenantId, origenId: id } })).toBe(0);
    expect(await prisma.asiento.count({ where: { tenantId, origenId: id } })).toBe(0);
  });
});
