/**
 * @description Deduplicación de pago parcial de préstamo cash: repetir el mismo
 * pago parcial (100 sobre deuda de 500) con la misma idempotencyKey no genera
 * un segundo cobro; con payload distinto rechaza con IDEMPOTENCY_CONFLICT.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { assertDisposableDatabase } from '../../../../scripts/ci/disposable-database.mjs';
import { prisma } from '@/lib/prisma';
import { seedPlanContable } from '@/features/contabilidad-formal/services/seed-plan-contable';
import { AccountingCashOperationsMutationService } from '@/features/contabilidad/services/accounting-cash-operations-mutation-service';

assertDisposableDatabase(process.env);

vi.mock('@/lib/services/audit-log-service', () => ({
  AuditLogService: { log: async () => undefined, logStrict: async () => undefined },
}));
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));

const prefix = `cta-pago-parcial-idem-${crypto.randomUUID()}`;
let tenantId = '';
let userId = '';
let clienteId = '';
let cuentaOrigenId = '';
let cuentaPagoId = '';
let tipoPagoId = '';

const user = () => ({
  userId, tenantId, tenantRole: 'manager',
  planFeatures: { 'prestamos-cash': true },
}) as never;

describe('pago parcial préstamo cash — deduplicación idempotente', { timeout: 90_000 }, () => {
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
    const tenant = await prisma.tenant.create({
      data: { nombre: `${prefix}-t`, slug: `${prefix}-t` },
    });
    tenantId = tenant.tenantId;
    const u = await prisma.user.create({
      data: { name: `${prefix}-user`, email: `${prefix}@test.cu`, password: 'x' },
    });
    userId = u.userId;
    await prisma.tenantMembership.create({
      data: { tenantId, userId, tenantRole: 'manager' },
    });
    const plan = await prisma.plan.create({ data: {
      nombre: prefix, duracionDias: 365,
      features: { 'prestamos-cash': true },
    } });
    await prisma.tenantLicense.create({ data: {
      tenantId, planId: plan.planId, expiracion: new Date('2099-01-01'),
    } });
    await prisma.tenantAccountingPolicy.create({
      data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: userId },
    });
    clienteId = (await prisma.cliente.create({
      data: { tenantId, nombre: `${prefix}-cli` },
    })).clienteId;
    cuentaOrigenId = (await prisma.cuentaBancaria.create({ data: {
      tenantId, nombreBanco: prefix, numeroCuenta: `${prefix}-origen`,
      tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldo: 5000,
    } })).cuentaId;
    cuentaPagoId = (await prisma.cuentaBancaria.create({ data: {
      tenantId, nombreBanco: prefix, numeroCuenta: `${prefix}-pago`,
      tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldo: 5000,
    } })).cuentaId;
    tipoPagoId = (await prisma.tipoPago.create({ data: {
      tenantId, nombre: 'Transferencia', isActive: true,
    } })).tipoId;
    await prisma.$transaction((tx) => seedPlanContable(tx, tenantId));
    const hoy = new Date();
    await prisma.periodoContable.create({
      data: {
        tenantId, tipo: 'MENSUAL', estado: 'ABIERTO',
        fechaInicio: new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1)),
        fechaFin: new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, 0, 23, 59, 59)),
      },
    });
  });

  afterAll(async () => {
    delete process.env.CONTABILIDAD_FORMAL_MODE;
  });

  it('pago parcial repetido con misma clave no duplica el cobro', async () => {
    const loan = await AccountingCashOperationsMutationService.createCashLoan({
      input: { clienteId, montoCapital: 500, moneda: 'CUP', cuentaBancariaId: cuentaOrigenId },
      user: user(),
    });
    const idempotencyKey = `idem-pago-parcial-${crypto.randomUUID()}`;

    const primero = await AccountingCashOperationsMutationService.registerCashLoanPayment({
      input: {
        id: loan.id, monto: 100, cuentaId: cuentaPagoId, tipoPagoId, idempotencyKey,
      },
      user: user(),
    });
    expect(primero.reconciliacionId).toBeTruthy();

    // Reintento idéntico: devuelve el existente, no crea otro cobro
    const segundo = await AccountingCashOperationsMutationService.registerCashLoanPayment({
      input: {
        id: loan.id, monto: 100, cuentaId: cuentaPagoId, tipoPagoId, idempotencyKey,
      },
      user: user(),
    });
    expect(segundo.reconciliacionId).toBe(primero.reconciliacionId);

    const count = await prisma.reconciliacionVenta.count({
      where: {
        tenantId, tipoReconciliacion: 'PRESTAMO_CASH',
        prestamoCashId: loan.id, idempotencyKey,
      },
    });
    expect(count).toBe(1);
  });

  it('misma clave con monto distinto rechaza con IDEMPOTENCY_CONFLICT', async () => {
    const loan = await AccountingCashOperationsMutationService.createCashLoan({
      input: { clienteId, montoCapital: 500, moneda: 'CUP', cuentaBancariaId: cuentaOrigenId },
      user: user(),
    });
    const idempotencyKey = `idem-pago-conflict-${crypto.randomUUID()}`;

    await AccountingCashOperationsMutationService.registerCashLoanPayment({
      input: {
        id: loan.id, monto: 100, cuentaId: cuentaPagoId, tipoPagoId, idempotencyKey,
      },
      user: user(),
    });

    let thrown: any = null;
    try {
      await AccountingCashOperationsMutationService.registerCashLoanPayment({
        input: {
          id: loan.id, monto: 200, cuentaId: cuentaPagoId, tipoPagoId, idempotencyKey,
        },
        user: user(),
      });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeTruthy();
    expect(`${thrown?.code ?? ''} ${thrown?.message ?? ''}`).toContain('IDEMPOTENCY_CONFLICT');
  });
});
