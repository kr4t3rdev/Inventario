import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertDisposableDatabase } from '../../../../scripts/ci/disposable-database.mjs';
import { prisma } from '@/lib/prisma';
import { seedPlanContable } from '@/features/contabilidad-formal/services/seed-plan-contable';
import { PeriodoGuard } from '@/lib/services/periodo-contable-guard';
import { AccountingOperationsMutationService } from '@/features/contabilidad/services/accounting-operations-mutation-service';

assertDisposableDatabase(process.env);

const prefix = `cta-ajuste-idem-${crypto.randomUUID()}`;
let tenantId = '';
let cuentaId = '';

const manager = () => ({
  userId: 'actor-ajuste-idem', tenantId, tenantRole: 'manager',
  planFeatures: { 'ajustes-bancarios': true, contabilidad: true },
}) as never;

/** @description Reintento de ajuste bancario con la misma idempotencyKey no duplica. */
describe('ajuste bancario idempotente — PostgreSQL aislado', { timeout: 90_000 }, () => {
  beforeAll(async () => {
    const identity = await prisma.$queryRaw<Array<{ db: string; port: number }>>`
      SELECT current_database() AS db, inet_server_port() AS port
    `;
    const target = new URL(process.env.DATABASE_URL ?? '');
    expect(identity[0]).toMatchObject({
      db: target.pathname.slice(1),
      port: Number(target.port),
    });
    process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
    const tenant = await prisma.tenant.create({ data: { nombre: prefix, slug: prefix } });
    tenantId = tenant.tenantId;
    const plan = await prisma.plan.create({ data: {
      nombre: prefix, duracionDias: 365,
      features: { 'contabilidad-formal': true, 'ajustes-bancarios': true, contabilidad: true },
    } });
    await prisma.tenantLicense.create({ data: {
      tenantId, planId: plan.planId, expiracion: new Date('2099-01-01'),
    } });
    await prisma.tenantAccountingPolicy.create({
      data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: 'actor-ajuste-idem' },
    });
    cuentaId = (await prisma.cuentaBancaria.create({ data: {
      tenantId, nombreBanco: `${prefix}-cta`, numeroCuenta: `${prefix}-cta`,
      tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldo: 1000,
    } })).cuentaId;
    await prisma.$transaction((tx) => seedPlanContable(tx, tenantId));
    const now = new Date();
    await prisma.periodoContable.create({ data: {
      tenantId, tipo: 'MENSUAL', estado: 'ABIERTO',
      fechaInicio: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      fechaFin: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59)),
    } });
    await PeriodoGuard.assertWritable(now, tenantId, 'asiento', {
      actorId: 'actor-ajuste-idem', actorTipo: 'USUARIO',
      origen: { tipo: 'ajuste_bancario', id: prefix },
    });
  });

  afterAll(async () => {
    delete process.env.CONTABILIDAD_FORMAL_MODE;
  });

  it('reintento con la misma clave devuelve el ajuste existente sin duplicar saldo', async () => {
    const idempotencyKey = `idem-${crypto.randomUUID()}`;
    const input = {
      cuentaId, tipo: 'ingreso' as const, monto: 100, moneda: 'CUP',
      descripcion: `${prefix}-desc`, motivo: `${prefix}-motivo`,
      idempotencyKey,
    };

    const primero = await AccountingOperationsMutationService.createBankAdjustment({
      input, user: manager(),
    });
    expect(primero.ajuste.idempotencyKey).toBe(idempotencyKey);

    const saldoTrasPrimero = (await prisma.cuentaBancaria.findUnique({
      where: { cuentaId }, select: { saldo: true },
    } ))!.saldo;

    const segundo = await AccountingOperationsMutationService.createBankAdjustment({
      input, user: manager(),
    });

    expect(segundo.ajuste.ajusteId).toBe(primero.ajuste.ajusteId);
    expect(segundo.message).toContain('idempotente');

    const ajustes = await prisma.ajusteBancario.count({
      where: { tenantId, idempotencyKey },
    });
    expect(ajustes).toBe(1);

    const saldoFinal = (await prisma.cuentaBancaria.findUnique({
      where: { cuentaId }, select: { saldo: true },
    } ))!.saldo;
    expect(Number(saldoFinal)).toBe(Number(saldoTrasPrimero));
  });

  it('misma clave con payload distinto rechaza con IDEMPOTENCY_CONFLICT', async () => {
    const idempotencyKey = `idem-conflict-${crypto.randomUUID()}`;
    await AccountingOperationsMutationService.createBankAdjustment({
      input: {
        cuentaId, tipo: 'ingreso' as const, monto: 100, moneda: 'CUP',
        descripcion: `${prefix}-desc`, motivo: `${prefix}-motivo`,
        idempotencyKey,
      },
      user: manager(),
    });

    // Mismo key, monto distinto → conflicto
    let thrown: any = null;
    try {
      await AccountingOperationsMutationService.createBankAdjustment({
        input: {
          cuentaId, tipo: 'ingreso' as const, monto: 200, moneda: 'CUP',
          descripcion: `${prefix}-desc`, motivo: `${prefix}-motivo`,
          idempotencyKey,
        },
        user: manager(),
      });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeTruthy();
    expect(`${thrown?.code ?? ''} ${thrown?.message ?? ''}`).toContain('IDEMPOTENCY_CONFLICT');

    // Solo un ajuste con esa clave
    const count = await prisma.ajusteBancario.count({
      where: { tenantId, idempotencyKey },
    });
    expect(count).toBe(1);
  });

  it('misma clave con fechaOperacion distinta rechaza con IDEMPOTENCY_CONFLICT (A2)', async () => {
    const idempotencyKey = `idem-fecha-${crypto.randomUUID()}`;
    await AccountingOperationsMutationService.createBankAdjustment({
      input: {
        cuentaId, tipo: 'ingreso' as const, monto: 100, moneda: 'CUP',
        descripcion: `${prefix}-desc`, motivo: `${prefix}-motivo`,
        fechaOperacion: new Date('2026-10-01T12:00:00Z'),
        idempotencyKey,
      },
      user: manager(),
    });

    let thrown = null;
    try {
      await AccountingOperationsMutationService.createBankAdjustment({
        input: {
          cuentaId, tipo: 'ingreso' as const, monto: 100, moneda: 'CUP',
          descripcion: `${prefix}-desc`, motivo: `${prefix}-motivo`,
          fechaOperacion: new Date('2026-09-01T12:00:00Z'),
          idempotencyKey,
        },
        user: manager(),
      });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeTruthy();
    const thrownAny = thrown;
    expect(`${thrownAny?.code ?? ''} ${thrownAny?.message ?? ''}`).toContain('IDEMPOTENCY_CONFLICT');

    const count = await prisma.ajusteBancario.count({
      where: { tenantId, idempotencyKey },
    });
    expect(count).toBe(1);
  });

  it('dos requests simultáneos con la misma clave devuelven el mismo ajuste', async () => {
    const idempotencyKey = `idem-race-${crypto.randomUUID()}`;
    const input = {
      cuentaId, tipo: 'ingreso' as const, monto: 75, moneda: 'CUP',
      descripcion: `${prefix}-race`, motivo: `${prefix}-race-motivo`, idempotencyKey,
    };
    const saldoAntes = Number((await prisma.cuentaBancaria.findUnique({
      where: { cuentaId }, select: { saldo: true },
    }))!.saldo);

    const resultados = await Promise.all([
      AccountingOperationsMutationService.createBankAdjustment({ input, user: manager() }),
      AccountingOperationsMutationService.createBankAdjustment({ input, user: manager() }),
    ]);

    expect(resultados[0].ajuste.ajusteId).toBe(resultados[1].ajuste.ajusteId);
    expect(await prisma.ajusteBancario.count({ where: { tenantId, idempotencyKey } })).toBe(1);
    const saldoDespues = Number((await prisma.cuentaBancaria.findUnique({
      where: { cuentaId }, select: { saldo: true },
    }))!.saldo);
    expect(saldoDespues).toBe(saldoAntes + 75);
  });

  it('sin clave cada llamada crea un ajuste nuevo', async () => {
    const input = {
      cuentaId, tipo: 'ingreso' as const, monto: 50, moneda: 'CUP',
      descripcion: `${prefix}-desc2`, motivo: `${prefix}-motivo2`,
    };
    const a = await AccountingOperationsMutationService.createBankAdjustment({
      input, user: manager(),
    });
    const b = await AccountingOperationsMutationService.createBankAdjustment({
      input, user: manager(),
    });
    expect(b.ajuste.ajusteId).not.toBe(a.ajuste.ajusteId);
  });
});
