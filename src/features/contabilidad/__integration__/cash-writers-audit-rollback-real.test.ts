/**
 * @description Physical PostgreSQL AuditLog failure proofs for remaining cash writers and legacy routes.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { assertDisposableDatabase } from '../../../../scripts/ci/disposable-database.mjs';
import { POST as postLoanPayment } from '@/app/api/contabilidad/prestamos-cash/[id]/pagar/route';
import { POST as postDebtCreate } from '@/app/api/contabilidad/deudas-cash/route';
import { POST as postDebtPayment } from '@/app/api/contabilidad/deudas-cash/[id]/pagar/route';
import { seedPlanContable, seedPlantillasGlobales } from '@/features/contabilidad-formal/services/seed-plan-contable';
import { AccountingCashOperationsMutationService as CashWriters } from '@/features/contabilidad/services/accounting-cash-operations-mutation-service';
import { prisma } from '@/lib/prisma';

function mockUser(): AuthenticatedUser {
  return {
    userId: actorId,
    name: prefix,
    email: `${prefix}@test.local`,
    tenantId,
    tenantRole: 'manager',
    role: 'admin',
    isActive: true,
    planFeatures: { 'prestamos-cash': true, 'deudas-cash': true, 'contabilidad-formal': true },
    permissions: new Set(['financiero.contabilidad.acceder']),
  };
}

vi.mock('@/lib/auth-middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-middleware')>();
  return {
    ...actual,
    withAuthPost: (handler: (
      request: NextRequest,
      context: unknown,
      user: AuthenticatedUser,
    ) => Promise<Response>) => (request: NextRequest, context: unknown) =>
      handler(request, context, mockUser()),
  };
});

assertDisposableDatabase(process.env);

const prefix = `cash-audit-rollback-${crypto.randomUUID()}`;
const actorId = `cash-audit-actor-${crypto.randomUUID()}`;
const originalFormalMode = process.env.CONTABILIDAD_FORMAL_MODE;
let tenantId = '';
let clienteId = '';
let proveedorId = '';
let sourceAccountId = '';
let paymentAccountId = '';
let paymentTypeId = '';
let loanId = '';
let debtId = '';
let triggerName = '';
let triggerFunctionName = '';

/** @description Makes database values stable for exact before/after comparisons. */
function normalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    const decimal = value as { toFixed?: () => string };
    if (typeof decimal.toFixed === 'function') return decimal.toFixed();
    return Object.fromEntries(Object.entries(value)
      .filter(([, field]) => field !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, field]) => [key, normalize(field)]));
  }
  return value;
}

/** @description Captures financial and accounting rows changed by each cash operation. */
async function captureTenantState() {
  const [banks, loans, debts, receivables, payables, reconciliations, entries, audits, periods, caches] =
    await Promise.all([
      prisma.cuentaBancaria.findMany({ where: { tenantId }, orderBy: { cuentaId: 'asc' } }),
      prisma.prestamoCash.findMany({ where: { tenantId }, orderBy: { id: 'asc' } }),
      prisma.deudaCash.findMany({ where: { tenantId }, orderBy: { id: 'asc' } }),
      prisma.cuentaPorCobrar.findMany({ where: { tenantId }, orderBy: { id: 'asc' } }),
      prisma.cuentaPorPagar.findMany({ where: { tenantId }, orderBy: { cuentaPorPagarId: 'asc' } }),
      prisma.reconciliacionVenta.findMany({ where: { tenantId }, orderBy: { reconciliacionId: 'asc' } }),
      prisma.asiento.findMany({
        where: { tenantId }, orderBy: { asientoId: 'asc' },
        include: { lineas: { orderBy: { orden: 'asc' } } },
      }),
      prisma.auditLog.findMany({ where: { usuarioId: actorId }, orderBy: { id: 'asc' } }),
      prisma.periodoContable.findMany({ where: { tenantId }, orderBy: { fechaInicio: 'asc' } }),
      prisma.periodoCache.findMany({ where: { tenantId }, orderBy: { cacheKey: 'asc' } }),
    ]);
  return normalize({ banks, loans, debts, receivables, payables, reconciliations, entries, audits, periods, caches });
}

/** @description Installs an actor/entity-scoped physical AuditLog insert failure. */
async function installAuditFailure(entity: string): Promise<void> {
  const unique = crypto.randomUUID().replaceAll('-', '');
  triggerName = `cash_audit_fail_${unique}`;
  triggerFunctionName = `${triggerName}_fn`;
  await prisma.$executeRawUnsafe(`
    CREATE FUNCTION "${triggerFunctionName}"() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW."usuarioId" = '${actorId}' AND NEW."entidad" = '${entity}' THEN
        RAISE EXCEPTION 'forced cash AuditLog failure ${entity}' USING ERRCODE = '22012';
      END IF;
      RETURN NEW;
    END $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER "${triggerName}" BEFORE INSERT ON "AuditLog"
    FOR EACH ROW EXECUTE FUNCTION "${triggerFunctionName}"()`);
}

/** @description Removes the one-off trigger and function even after assertion failures. */
async function removeAuditFailure(): Promise<void> {
  if (!triggerName || !triggerFunctionName) return;
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${triggerName}" ON "AuditLog"`);
  await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${triggerFunctionName}"()`);
  triggerName = '';
  triggerFunctionName = '';
}

/** @description Builds an authenticated legacy-route request body. */
function routeRequest(url: string, body: Record<string, unknown>): NextRequest {
  return new NextRequest(url, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
}

/** @description Verifies a successful execution reached and durably wrote the expected AuditLog. */
async function expectDurableAudit(entity: string, entityId: string, action = 'CREATE'): Promise<void> {
  await expect(prisma.auditLog.findFirst({
    where: { usuarioId: actorId, entidad: entity, entidadId: entityId, accion: action },
  })).resolves.toMatchObject({ usuarioId: actorId, entidad: entity, entidadId: entityId, accion: action });
}

/** @description Confirms a successful accounting posting exists for the operation source. */
async function expectPosting(originType: string, originId: string): Promise<void> {
  const entries = await prisma.asiento.findMany({
    where: { tenantId, origenTipo: originType, origenId: originId },
    include: { lineas: true },
  });
  expect(entries).toHaveLength(1);
  expect(entries[0].lineas.length).toBeGreaterThanOrEqual(2);
}

describe('cash writer and legacy route AuditLog INSERT rollback proofs', { timeout: 120_000 }, () => {
  beforeAll(async () => {
    const target = new URL(process.env.DATABASE_URL ?? '');
    const identity = await prisma.$queryRaw<Array<{ db: string; port: number }>>`
      SELECT current_database() AS db, inet_server_port() AS port`;
    expect(identity[0]).toMatchObject({ db: target.pathname.slice(1), port: Number(target.port) });
    process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
    const tenant = await prisma.tenant.create({ data: { nombre: prefix, slug: prefix } });
    tenantId = tenant.tenantId;
    clienteId = (await prisma.cliente.create({ data: { tenantId, nombre: `${prefix}-client` } })).clienteId;
    proveedorId = (await prisma.vendor.create({ data: { tenantId, nombre: prefix } })).vendorId;
    sourceAccountId = (await prisma.cuentaBancaria.create({ data: {
      tenantId, nombreBanco: prefix, numeroCuenta: `${prefix}-source`, tipoCuenta: 'CORRIENTE',
      moneda: 'CUP', saldo: 5000,
    } })).cuentaId;
    paymentAccountId = (await prisma.cuentaBancaria.create({ data: {
      tenantId, nombreBanco: prefix, numeroCuenta: `${prefix}-payment`, tipoCuenta: 'CORRIENTE',
      moneda: 'CUP', saldo: 5000,
    } })).cuentaId;
    paymentTypeId = (await prisma.tipoPago.create({ data: { tenantId, nombre: 'Transferencia' } })).tipoId;
    const plan = await prisma.plan.create({ data: {
      nombre: prefix, duracionDias: 365,
      features: { 'contabilidad-formal': true, 'prestamos-cash': true, 'deudas-cash': true },
    } });
    await prisma.tenantLicense.create({ data: {
      tenantId, planId: plan.planId, activa: true, expiracion: new Date('2099-01-01'),
    } });
    await prisma.tenantAccountingPolicy.create({
      data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: actorId },
    });
    await prisma.$transaction(async (tx) => {
      await seedPlanContable(tx, tenantId);
      await seedPlantillasGlobales(tx);
    });
    const now = new Date();
    await prisma.periodoContable.create({ data: {
      tenantId, tipo: 'MENSUAL', estado: 'ABIERTO',
      fechaInicio: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      fechaFin: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59)),
    } });
    const loan = await CashWriters.createCashLoan({ input: {
      clienteId, montoCapital: 200, moneda: 'CUP', cuentaBancariaId: sourceAccountId,
      idempotencyKey: 'audit-prerequisite-loan',
    }, user: mockUser() });
    loanId = loan.id;
    await expectDurableAudit('PRESTAMO_CASH', loan.id);
    await expectPosting('prestamo_cash', loan.id);
  });

  afterAll(async () => {
    try {
      await removeAuditFailure();
    } finally {
      if (originalFormalMode === undefined) delete process.env.CONTABILIDAD_FORMAL_MODE;
      else process.env.CONTABILIDAD_FORMAL_MODE = originalFormalMode;
    }
    if (!tenantId) return;
    await prisma.auditLog.deleteMany({ where: { usuarioId: actorId } });
    await prisma.shadowPosteoOutbox.deleteMany({ where: { tenantId } });
    await prisma.asientoLinea.deleteMany({ where: { asiento: { tenantId } } });
    await prisma.asiento.deleteMany({ where: { tenantId } });
    await prisma.reconciliacionVenta.deleteMany({ where: { tenantId } });
    await prisma.prestamoCash.deleteMany({ where: { tenantId } });
    await prisma.deudaCash.deleteMany({ where: { tenantId } });
    await prisma.cuentaPorCobrar.deleteMany({ where: { tenantId } });
    await prisma.cuentaPorPagar.deleteMany({ where: { tenantId } });
    await prisma.cuentaRolTenant.deleteMany({ where: { tenantId } });
    await prisma.cuentaContable.deleteMany({ where: { tenantId } });
    await prisma.diario.deleteMany({ where: { tenantId } });
    await prisma.periodoCache.deleteMany({ where: { tenantId } });
    await prisma.periodoContable.deleteMany({ where: { tenantId } });
    await prisma.tipoPago.deleteMany({ where: { tenantId } });
    await prisma.cuentaBancaria.deleteMany({ where: { tenantId } });
    await prisma.cliente.deleteMany({ where: { tenantId } });
    await prisma.vendor.deleteMany({ where: { tenantId } });
    await prisma.tenantLicense.deleteMany({ where: { tenantId } });
    await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { tenantId } });
    await prisma.plan.deleteMany({ where: { nombre: prefix } });
  });

  it('rolls back canonical registerCashLoanPayment when physical AuditLog insert fails', async () => {
    const input = { id: loanId, monto: 20, cuentaId: paymentAccountId, tipoPagoId: paymentTypeId, moneda: 'CUP' };
    const happy = await CashWriters.registerCashLoanPayment({ input, user: mockUser() });
    await expectDurableAudit('PAGO_PRESTAMO', happy.reconciliacionId);
    await expectPosting('reconciliacion_venta', happy.reconciliacionId);
    const baseline = await captureTenantState();
    await installAuditFailure('PAGO_PRESTAMO');
    try {
      await expect(CashWriters.registerCashLoanPayment({
        input: { ...input, monto: 21 }, user: mockUser(),
      })).rejects.toThrow('forced cash AuditLog failure PAGO_PRESTAMO');
      expect(await captureTenantState()).toEqual(baseline);
    } finally { await removeAuditFailure(); }
  });

  it('rolls back canonical createCashDebt when physical AuditLog insert fails', async () => {
    const input = { proveedorId, montoCapital: 70, moneda: 'CUP', cuentaBancariaId: sourceAccountId };
    const happy = await CashWriters.createCashDebt({ input: {
      ...input, idempotencyKey: 'audit-debt-prior',
    }, user: mockUser() });
    debtId = happy.id;
    await expectDurableAudit('DEUDA_CASH', happy.id);
    await expectPosting('deuda_cash', happy.id);
    const baseline = await captureTenantState();
    await installAuditFailure('DEUDA_CASH');
    try {
      await expect(CashWriters.createCashDebt({ input: {
        ...input, montoCapital: 71, idempotencyKey: 'audit-debt-failure',
      }, user: mockUser() })).rejects.toThrow('forced cash AuditLog failure DEUDA_CASH');
      expect(await captureTenantState()).toEqual(baseline);
    } finally { await removeAuditFailure(); }
  });

  it('rolls back canonical registerCashDebtPayment when physical AuditLog insert fails', async () => {
    const input = { id: debtId, monto: 10, cuentaId: sourceAccountId, tipoPagoId: paymentTypeId, moneda: 'CUP' };
    const happy = await CashWriters.registerCashDebtPayment({ input, user: mockUser() });
    await expectDurableAudit('PAGO_DEUDA', happy.reconciliacionId);
    await expectPosting('reconciliacion_venta', happy.reconciliacionId);
    const baseline = await captureTenantState();
    await installAuditFailure('PAGO_DEUDA');
    try {
      await expect(CashWriters.registerCashDebtPayment({
        input: { ...input, monto: 11 }, user: mockUser(),
      })).rejects.toThrow('forced cash AuditLog failure PAGO_DEUDA');
      expect(await captureTenantState()).toEqual(baseline);
    } finally { await removeAuditFailure(); }
  });

  it('rolls back legacy POST loan payment and returns the route internal-error contract', async () => {
    const input = { monto: 15, cuentaId: paymentAccountId, tipoPagoId: paymentTypeId, moneda: 'CUP' };
    const happy = await postLoanPayment(routeRequest(
      `http://localhost/api/contabilidad/prestamos-cash/${loanId}/pagar`, input,
    ), { params: Promise.resolve({ id: loanId }) });
    expect(happy.status).toBe(201);
    const happyBody = await happy.json();
    const reconciliationId = happyBody.reconciliacion?.reconciliacionId;
    expect(reconciliationId).toBeTruthy();
    await expectDurableAudit('PAGO_PRESTAMO', reconciliationId);
    await expectPosting('reconciliacion_venta', reconciliationId);
    const baseline = await captureTenantState();
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await installAuditFailure('PAGO_PRESTAMO');
    try {
      const failed = await postLoanPayment(routeRequest(
        `http://localhost/api/contabilidad/prestamos-cash/${loanId}/pagar`, { ...input, monto: 16 },
      ), { params: Promise.resolve({ id: loanId }) });
      expect(failed.status).toBe(500);
      expect(await failed.json()).toEqual({ error: 'Error registrando pago de préstamo' });
      expect(log.mock.calls.flat().join(' ')).toContain('forced cash AuditLog failure PAGO_PRESTAMO');
      expect(await captureTenantState()).toEqual(baseline);
    } finally { await removeAuditFailure(); log.mockRestore(); }
  });

  it('rolls back legacy POST debt creation and returns the route internal-error contract', async () => {
    const input = { proveedorId, montoCapital: 80, moneda: 'CUP', cuentaBancariaId: sourceAccountId };
    const happy = await postDebtCreate(routeRequest('http://localhost/api/contabilidad/deudas-cash', input), {});
    expect(happy.status).toBe(201);
    const happyBody = await happy.json();
    const createdDebtId = happyBody.deuda?.id;
    expect(createdDebtId).toBeTruthy();
    await expectDurableAudit('DEUDA_CASH', createdDebtId);
    await expectPosting('deuda_cash', createdDebtId);
    const baseline = await captureTenantState();
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await installAuditFailure('DEUDA_CASH');
    try {
      const failed = await postDebtCreate(routeRequest(
        'http://localhost/api/contabilidad/deudas-cash', { ...input, montoCapital: 81 },
      ), {});
      expect(failed.status).toBe(500);
      expect(await failed.json()).toEqual({ error: 'Error creando deuda cash' });
      expect(log.mock.calls.flat().join(' ')).toContain('forced cash AuditLog failure DEUDA_CASH');
      expect(await captureTenantState()).toEqual(baseline);
    } finally { await removeAuditFailure(); log.mockRestore(); }
  });

  it('rolls back legacy POST debt payment and returns the route internal-error contract', async () => {
    const input = { monto: 12, cuentaId: sourceAccountId, tipoPagoId: paymentTypeId, moneda: 'CUP' };
    const happy = await postDebtPayment(routeRequest(
      `http://localhost/api/contabilidad/deudas-cash/${debtId}/pagar`, input,
    ), { params: Promise.resolve({ id: debtId }) });
    expect(happy.status).toBe(201);
    const happyBody = await happy.json();
    const reconciliationId = happyBody.reconciliacion?.reconciliacionId;
    expect(reconciliationId).toBeTruthy();
    await expectDurableAudit('PAGO_DEUDA', reconciliationId);
    await expectPosting('reconciliacion_venta', reconciliationId);
    const baseline = await captureTenantState();
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await installAuditFailure('PAGO_DEUDA');
    try {
      const failed = await postDebtPayment(routeRequest(
        `http://localhost/api/contabilidad/deudas-cash/${debtId}/pagar`, { ...input, monto: 13 },
      ), { params: Promise.resolve({ id: debtId }) });
      expect(failed.status).toBe(500);
      expect(await failed.json()).toEqual({ error: 'Error registrando pago de deuda' });
      expect(log.mock.calls.flat().join(' ')).toContain('forced cash AuditLog failure PAGO_DEUDA');
      expect(await captureTenantState()).toEqual(baseline);
    } finally { await removeAuditFailure(); log.mockRestore(); }
  });
});
