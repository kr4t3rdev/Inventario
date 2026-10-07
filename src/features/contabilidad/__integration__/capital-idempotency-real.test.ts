/**
 * @description Idempotencia en inyección de capital: reintento con la misma
 * clave y mismo payload devuelve el registro existente sin duplicar saldo;
 * con payload distinto rechaza con IDEMPOTENCY_CONFLICT.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { assertDisposableDatabase } from '../../../../scripts/ci/disposable-database.mjs';
import { prisma } from '@/lib/prisma';
import { seedPlanContable } from '@/features/contabilidad-formal/services/seed-plan-contable';
import { PeriodoGuard } from '@/lib/services/periodo-contable-guard';
import { AccountingOperationsMutationService } from '@/features/contabilidad/services/accounting-operations-mutation-service';

assertDisposableDatabase(process.env);

vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));

const prefix = `cta-capital-idem-${crypto.randomUUID()}`;
let tenantId = '';
let cuentaId = '';

const manager = () => ({
  userId: 'actor-capital-idem', tenantId, tenantRole: 'manager',
  planFeatures: { 'inyeccion-capital': true, contabilidad: true },
}) as never;

describe('inyección de capital idempotente — PostgreSQL aislado', { timeout: 90_000 }, () => {
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
      features: { 'contabilidad-formal': true, 'inyeccion-capital': true, contabilidad: true },
    } });
    await prisma.tenantLicense.create({ data: {
      tenantId, planId: plan.planId, expiracion: new Date('2099-01-01'),
    } });
    await prisma.tenantAccountingPolicy.create({
      data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: 'actor-capital-idem' },
    });
    cuentaId = (await prisma.cuentaBancaria.create({ data: {
      tenantId, nombreBanco: `${prefix}-cta`, numeroCuenta: `${prefix}-cta`,
      tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldo: 5000,
    } })).cuentaId;
    await prisma.$transaction((tx) => seedPlanContable(tx, tenantId));
    const now = new Date();
    await prisma.periodoContable.create({ data: {
      tenantId, tipo: 'MENSUAL', estado: 'ABIERTO',
      fechaInicio: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      fechaFin: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59)),
    } });
    await PeriodoGuard.assertWritable(now, tenantId, 'asiento', {
      actorId: 'actor-capital-idem', actorTipo: 'USUARIO',
      origen: { tipo: 'inyeccion_capital', id: prefix },
    });
  });

  afterAll(async () => {
    delete process.env.CONTABILIDAD_FORMAL_MODE;
  });

  it('reintento con misma clave y payload devuelve el existente sin duplicar saldo', async () => {
    const idempotencyKey = `idem-${crypto.randomUUID()}`;
    const input = {
      montoRecibido: 100, moneda: 'CUP', tipo: 'CAPITAL_SOCIAL' as const,
      cuentaId, socio: `${prefix}-socio`, idempotencyKey,
    };

    const primero = await AccountingOperationsMutationService.createCapitalInjection({
      input, user: manager(),
    });
    expect(primero.idempotencyKey).toBe(idempotencyKey);

    const saldoTrasPrimero = Number((await prisma.cuentaBancaria.findUnique({
      where: { cuentaId }, select: { saldo: true },
    } ))!.saldo);
    expect(saldoTrasPrimero).toBe(5100);

    // Reintento idéntico: no duplica
    const segundo = await AccountingOperationsMutationService.createCapitalInjection({
      input, user: manager(),
    });
    expect(segundo.id).toBe(primero.id);

    const count = await prisma.inyeccionCapital.count({ where: { tenantId, idempotencyKey } });
    expect(count).toBe(1);

    const saldoFinal = Number((await prisma.cuentaBancaria.findUnique({
      where: { cuentaId }, select: { saldo: true },
    } ))!.saldo);
    expect(saldoFinal).toBe(5100);
  });

  it('misma clave con monto distinto rechaza con IDEMPOTENCY_CONFLICT', async () => {
    const idempotencyKey = `idem-conflict-${crypto.randomUUID()}`;
    await AccountingOperationsMutationService.createCapitalInjection({
      input: {
        montoRecibido: 100, moneda: 'CUP', tipo: 'CAPITAL_SOCIAL' as const,
        cuentaId, socio: `${prefix}-socio`, idempotencyKey,
      },
      user: manager(),
    });

    let thrown: any = null;
    try {
      await AccountingOperationsMutationService.createCapitalInjection({
        input: {
          montoRecibido: 200, moneda: 'CUP', tipo: 'CAPITAL_SOCIAL' as const,
          cuentaId, socio: `${prefix}-socio`, idempotencyKey,
        },
        user: manager(),
      });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeTruthy();
    expect(`${thrown?.code ?? ''} ${thrown?.message ?? ''}`).toContain('IDEMPOTENCY_CONFLICT');
  });

  it('misma clave con tasaInteres distinta (0->10) rechaza con IDEMPOTENCY_CONFLICT (A2)', async () => {
    const idempotencyKey = `idem-tasa-${crypto.randomUUID()}`;
    await AccountingOperationsMutationService.createCapitalInjection({
      input: {
        montoRecibido: 1000, moneda: 'CUP', tipo: 'DEUDA_EXTERNA' as const,
        cuentaId, entidadPrestamista: `${prefix}-banco`, tasaInteres: 0,
        plazoMeses: 12, idempotencyKey,
      },
      user: manager(),
    });

    let thrown = null;
    try {
      await AccountingOperationsMutationService.createCapitalInjection({
        input: {
          montoRecibido: 1000, moneda: 'CUP', tipo: 'DEUDA_EXTERNA' as const,
          cuentaId, entidadPrestamista: `${prefix}-banco`, tasaInteres: 10,
          plazoMeses: 12, idempotencyKey,
        },
        user: manager(),
      });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeTruthy();
    const thrownAny = thrown;
    expect(`${thrownAny?.code ?? ''} ${thrownAny?.message ?? ''}`).toContain('IDEMPOTENCY_CONFLICT');

    const count = await prisma.inyeccionCapital.count({ where: { tenantId, idempotencyKey } });
    expect(count).toBe(1);
  });

  it('dos requests simultáneos con la misma clave devuelven la misma inyección', async () => {
    const idempotencyKey = `idem-race-${crypto.randomUUID()}`;
    const input = {
      montoRecibido: 125, moneda: 'CUP', tipo: 'CAPITAL_SOCIAL' as const,
      cuentaId, socio: `${prefix}-race-socio`, idempotencyKey,
    };
    const saldoAntes = Number((await prisma.cuentaBancaria.findUnique({
      where: { cuentaId }, select: { saldo: true },
    }))!.saldo);

    const resultados = await Promise.all([
      AccountingOperationsMutationService.createCapitalInjection({ input, user: manager() }),
      AccountingOperationsMutationService.createCapitalInjection({ input, user: manager() }),
    ]);

    expect(resultados[0].id).toBe(resultados[1].id);
    expect(await prisma.inyeccionCapital.count({ where: { tenantId, idempotencyKey } })).toBe(1);
    const saldoDespues = Number((await prisma.cuentaBancaria.findUnique({
      where: { cuentaId }, select: { saldo: true },
    }))!.saldo);
    expect(saldoDespues).toBe(saldoAntes + 125);
  });
});
