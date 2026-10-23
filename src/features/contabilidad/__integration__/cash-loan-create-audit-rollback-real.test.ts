/**
 * @description R6 real PostgreSQL proof for cash-loan creation rollback at AuditLog INSERT.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertDisposableDatabase } from '../../../../scripts/ci/disposable-database.mjs';
import { seedPlanContable } from '@/features/contabilidad-formal/services/seed-plan-contable';
import { AccountingCashOperationsMutationService } from '@/features/contabilidad/services/accounting-cash-operations-mutation-service';
import { PeriodoGuard } from '@/lib/services/periodo-contable-guard';
import { prisma } from '@/lib/prisma';

assertDisposableDatabase(process.env);

const prefix = `cash-loan-audit-rollback-${crypto.randomUUID()}`;
const keyPrefix = `loan-audit-${crypto.randomUUID()}`;
const actorId = `cash-loan-audit-actor-${crypto.randomUUID()}`;
const previousFormalMode = process.env.CONTABILIDAD_FORMAL_MODE;
let tenantId = '';
let clienteId = '';
let cuentaId = '';
let triggerName = '';
let triggerFunctionName = '';

const serviceUser = () => ({
  userId: actorId,
  tenantId,
  tenantRole: 'manager',
  role: 'admin',
  planFeatures: { 'prestamos-cash': true, 'contabilidad-formal': true },
  permissions: new Set(['financiero.contabilidad.acceder']),
}) as never;

/** @description Converts persisted values into a stable JSON-comparable snapshot. */
function normalizePersistedValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizePersistedValue);
  if (value && typeof value === 'object') {
    const decimal = value as { toFixed?: () => string };
    if (typeof decimal.toFixed === 'function') return decimal.toFixed();
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, fieldValue]) => fieldValue !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, fieldValue]) => [key, normalizePersistedValue(fieldValue)]),
    );
  }
  return value;
}

/** @description Captures every persistent row relevant to cash-loan creation. */
async function captureCashLoanState() {
  const [bank, loans, receivables, reconciliations, entries, auditLogs] = await Promise.all([
    prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } }),
    prisma.prestamoCash.findMany({ where: { tenantId }, orderBy: { id: 'asc' } }),
    prisma.cuentaPorCobrar.findMany({ where: { tenantId }, orderBy: { id: 'asc' } }),
    prisma.reconciliacionVenta.findMany({
      where: { tenantId },
      orderBy: { reconciliacionId: 'asc' },
    }),
    prisma.asiento.findMany({
      where: { tenantId },
      orderBy: { asientoId: 'asc' },
      include: { lineas: { orderBy: { orden: 'asc' } } },
    }),
    prisma.auditLog.findMany({ where: { usuarioId: actorId }, orderBy: { id: 'asc' } }),
  ]);
  return normalizePersistedValue({ bank, loans, receivables, reconciliations, entries, auditLogs });
}

const installAuditFailureTrigger = async (): Promise<void> => {
  const uniqueSuffix = crypto.randomUUID().replaceAll('-', '');
  triggerName = `cash_loan_audit_fail_${uniqueSuffix}`;
  triggerFunctionName = `${triggerName}_fn`;
  await prisma.$executeRawUnsafe(`
    CREATE FUNCTION "${triggerFunctionName}"() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW."usuarioId" = '${actorId}' AND NEW."entidad" = 'PRESTAMO_CASH' THEN
        RAISE EXCEPTION 'forced cash-loan AuditLog insert failure' USING ERRCODE = '22012';
      END IF;
      RETURN NEW;
    END $$`);
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER "${triggerName}" BEFORE INSERT ON "AuditLog"
    FOR EACH ROW EXECUTE FUNCTION "${triggerFunctionName}"()`);
};

const removeAuditFailureTrigger = async (): Promise<void> => {
  if (!triggerName || !triggerFunctionName) return;
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${triggerName}" ON "AuditLog"`);
  await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${triggerFunctionName}"()`);
  triggerName = '';
  triggerFunctionName = '';
};

describe('R6 — cash-loan creation rolls back when physical AuditLog INSERT fails', {
  timeout: 120_000,
}, () => {
  beforeAll(async () => {
    const target = new URL(process.env.DATABASE_URL ?? '');
    const identity = await prisma.$queryRaw<Array<{ db: string; port: number }>>`
      SELECT current_database() AS db, inet_server_port() AS port
    `;
    expect(identity[0]).toMatchObject({
      db: target.pathname.slice(1),
      port: Number(target.port),
    });

    // The writer's mode is process-wide, but this suite is guarded to the disposable DB
    // and uses an isolated tenant. Restore the caller's setting during cleanup.
    process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
    const tenant = await prisma.tenant.create({ data: { nombre: prefix, slug: prefix } });
    tenantId = tenant.tenantId;
    clienteId = (await prisma.cliente.create({
      data: { tenantId, nombre: `${prefix}-cliente` },
    })).clienteId;
    cuentaId = (await prisma.cuentaBancaria.create({
      data: {
        tenantId,
        nombreBanco: `${prefix}-banco`,
        numeroCuenta: `${prefix}-cuenta`,
        tipoCuenta: 'CORRIENTE',
        moneda: 'CUP',
        saldo: 5000,
      },
    })).cuentaId;
    await prisma.tipoPago.create({ data: { tenantId, nombre: 'Transferencia' } });
    const plan = await prisma.plan.create({
      data: {
        nombre: prefix,
        duracionDias: 365,
        features: { 'contabilidad-formal': true, 'prestamos-cash': true },
      },
    });
    await prisma.tenantLicense.create({
      data: { tenantId, planId: plan.planId, expiracion: new Date('2099-01-01') },
    });
    await prisma.tenantAccountingPolicy.create({
      data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: actorId },
    });
    await prisma.$transaction((tx) => seedPlanContable(tx, tenantId));
    const now = new Date();
    await prisma.periodoContable.create({
      data: {
        tenantId,
        tipo: 'MENSUAL',
        estado: 'ABIERTO',
        fechaInicio: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
        fechaFin: new Date(Date.UTC(
          now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59,
        )),
      },
    });
    await PeriodoGuard.assertWritable(new Date(), tenantId, 'asiento', {
      actorId,
      actorTipo: 'USUARIO',
      origen: { tipo: 'prestamo_cash', id: prefix },
    });
  });

  afterAll(async () => {
    await removeAuditFailureTrigger();
    if (previousFormalMode === undefined) delete process.env.CONTABILIDAD_FORMAL_MODE;
    else process.env.CONTABILIDAD_FORMAL_MODE = previousFormalMode;
    if (!tenantId) return;
    await prisma.auditLog.deleteMany({ where: { usuarioId: actorId } });
    await prisma.asientoLinea.deleteMany({ where: { asiento: { tenantId } } });
    await prisma.asiento.deleteMany({ where: { tenantId } });
    await prisma.reconciliacionVenta.deleteMany({ where: { tenantId } });
    await prisma.prestamoCash.deleteMany({ where: { tenantId } });
    await prisma.cuentaPorCobrar.deleteMany({ where: { tenantId } });
    await prisma.cliente.deleteMany({ where: { tenantId } });
    await prisma.cuentaBancaria.deleteMany({ where: { tenantId } });
    await prisma.tipoPago.deleteMany({ where: { tenantId } });
    await prisma.cuentaRolTenant.deleteMany({ where: { tenantId } });
    await prisma.cuentaContable.deleteMany({ where: { tenantId } });
    await prisma.diario.deleteMany({ where: { tenantId } });
    await prisma.periodoCache.deleteMany({ where: { tenantId } });
    await prisma.periodoContable.deleteMany({ where: { tenantId } });
    await prisma.tenantLicense.deleteMany({ where: { tenantId } });
    await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { tenantId } });
    await prisma.plan.deleteMany({ where: { nombre: prefix } });
  });

  it('persists all cash-loan effects and its durable audit event on success', async () => {
    const saldoAntes = (await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo;
    const loan = await AccountingCashOperationsMutationService.createCashLoan({
      input: {
        clienteId,
        montoCapital: 125,
        moneda: 'CUP',
        cuentaBancariaId: cuentaId,
        idempotencyKey: `${keyPrefix}-happy-path`,
      },
      user: serviceUser(),
    });

    const cuenta = await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } });
    const cxc = await prisma.cuentaPorCobrar.findUniqueOrThrow({
      where: { id: loan.cuentaPorCobrarId },
    });
    const reconciliacion = await prisma.reconciliacionVenta.findFirstOrThrow({
      where: { tenantId, tipoReconciliacion: 'PRESTAMO_CASH_DESEMBOLSO', reconciliadoPor: actorId },
    });
    const asientos = await prisma.asiento.findMany({
      where: { tenantId, origenTipo: 'prestamo_cash', origenId: loan.id },
      include: { lineas: true },
    });
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { usuarioId: actorId, entidad: 'PRESTAMO_CASH', entidadId: loan.id, accion: 'CREATE' },
    });

    expect(loan.tenantId).toBe(tenantId);
    expect(Number(cuenta.saldo)).toBe(Number(saldoAntes) - 125);
    expect(cxc.tipoCuenta).toBe('PRESTAMO_CASH');
    expect(Number(cxc.montoDeuda)).toBe(125);
    expect(reconciliacion.prestamoCashId).toBe(loan.id);
    expect(reconciliacion.monto.toString()).toBe('125');
    expect(asientos).toHaveLength(1);
    expect(asientos[0].lineas.length).toBeGreaterThanOrEqual(2);
    expect(audit.detalles).toMatchObject({ clienteId, montoCapital: 125, moneda: 'CUP' });
  });

  it('rolls back bank, loan, CxC, reconciliation, formal asiento, and audit after AuditLog trigger failure', async () => {
    await AccountingCashOperationsMutationService.createCashLoan({
      input: {
        clienteId,
        montoCapital: 80,
        moneda: 'CUP',
        cuentaBancariaId: cuentaId,
        idempotencyKey: `${keyPrefix}-preexisting`,
      },
      user: serviceUser(),
    });

    const baseline = {
      state: await captureCashLoanState(),
      saldo: (await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo,
      loans: await prisma.prestamoCash.count({ where: { tenantId } }),
      receivables: await prisma.cuentaPorCobrar.count({ where: { tenantId } }),
      reconciliations: await prisma.reconciliacionVenta.count({ where: { tenantId } }),
      entries: await prisma.asiento.count({ where: { tenantId } }),
      audit: await prisma.auditLog.count({ where: { usuarioId: actorId } }),
    };

    await installAuditFailureTrigger();
    try {
      await expect(AccountingCashOperationsMutationService.createCashLoan({
        input: {
          clienteId,
          montoCapital: 275,
          moneda: 'CUP',
          cuentaBancariaId: cuentaId,
          idempotencyKey: `${keyPrefix}-failure`,
        },
        user: serviceUser(),
      })).rejects.toThrow('forced cash-loan AuditLog insert failure');

      expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } })).saldo)
        .toEqual(baseline.saldo);
      await expect(prisma.prestamoCash.count({ where: { tenantId } })).resolves.toBe(baseline.loans);
      await expect(prisma.cuentaPorCobrar.count({ where: { tenantId } }))
        .resolves.toBe(baseline.receivables);
      await expect(prisma.reconciliacionVenta.count({ where: { tenantId } }))
        .resolves.toBe(baseline.reconciliations);
      await expect(prisma.asiento.count({ where: { tenantId } })).resolves.toBe(baseline.entries);
      await expect(prisma.auditLog.count({ where: { usuarioId: actorId } }))
        .resolves.toBe(baseline.audit);
      expect(await captureCashLoanState()).toEqual(baseline.state);
    } finally {
      await removeAuditFailureTrigger();
    }
  });
});
