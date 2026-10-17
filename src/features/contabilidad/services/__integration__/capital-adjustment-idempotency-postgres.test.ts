import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertDisposableDatabase } from '../../../../../scripts/ci/disposable-database.mjs';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma';
import { withTestTenant } from '@/lib/db/tenant-context';
import { AccountingOperationsMutationService } from '../accounting-operations-mutation-service';

assertDisposableDatabase(process.env);

const suffix = randomUUID().replaceAll('-', '');
const databaseTarget = new URL(process.env.DATABASE_URL as string);
const tenantAId = `it_capital_a_${suffix}`;
const tenantBId = `it_capital_b_${suffix}`;
const accountAId = `it_capital_bank_a_${suffix}`;
const accountBId = `it_capital_bank_b_${suffix}`;
const actorA = `it_capital_actor_${suffix}`;
const actorFail = `it_capital_fail_${suffix}`;
const auditMarkerTable = `it_capital_audit_marker_${suffix}`;
const auditFailureFunction = `it_capital_audit_fail_${suffix}`;
const auditFailureTrigger = `it_capital_audit_trigger_${suffix}`;

const userFor = (tenantId: string, userId = actorA) => ({
  userId,
  tenantId,
  tenantRole: 'manager',
}) as never;

function createCapital(input: Record<string, unknown>, tenantId = tenantAId, userId = actorA) {
  return withTestTenant(tenantId, () =>
    AccountingOperationsMutationService.createCapitalInjection({ input: input as never, user: userFor(tenantId, userId) }),
  );
}

function createAdjustment(input: Record<string, unknown>, tenantId = tenantAId, userId = actorA) {
  return withTestTenant(tenantId, () =>
    AccountingOperationsMutationService.createBankAdjustment({ input: input as never, user: userFor(tenantId, userId) }),
  );
}

async function accountBalance(cuentaId: string) {
  const account = await prisma.cuentaBancaria.findUniqueOrThrow({
    where: { cuentaId },
    select: { saldo: true },
  });
  return new Prisma.Decimal(account.saldo);
}

describe('capital and bank-adjustment idempotency on isolated PostgreSQL', { timeout: 90_000 }, () => {
  beforeAll(async () => {
    const identity = await prisma.$queryRaw<Array<{
      database: string;
      host: string;
      port: number;
      role: string;
    }>>`
      SELECT current_database() AS database,
        host(inet_server_addr()) AS host,
        inet_server_port() AS port,
        current_user AS role
    `;
    expect(identity).toHaveLength(1);
    expect(identity[0].database).toBe(databaseTarget.pathname.slice(1));
    expect(identity[0].host).toBe(databaseTarget.hostname);
    expect(Number(identity[0].port)).toBe(Number(databaseTarget.port));
    expect(identity[0].role).toBe(databaseTarget.username);

    await prisma.tenant.createMany({
      data: [
        { tenantId: tenantAId, nombre: `capital-a-${suffix}`, slug: `capital-a-${suffix}` },
        { tenantId: tenantBId, nombre: `capital-b-${suffix}`, slug: `capital-b-${suffix}` },
      ],
    });
    await prisma.cuentaBancaria.createMany({
      data: [
        { cuentaId: accountAId, tenantId: tenantAId, nombreBanco: `capital-a-${suffix}`, numeroCuenta: `a-${suffix}`, tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldo: 1000 },
        { cuentaId: accountBId, tenantId: tenantBId, nombreBanco: `capital-b-${suffix}`, numeroCuenta: `b-${suffix}`, tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldo: 1000 },
      ],
    });
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${auditFailureTrigger}" ON "AuditLog"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${auditFailureFunction}"()`);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${auditMarkerTable}"`);
    await prisma.auditLog.deleteMany({ where: { usuarioId: { in: [actorA, actorFail] } } });
    await prisma.ajusteBancario.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.inyeccionCapital.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.cuentaBancaria.deleteMany({ where: { cuentaId: { in: [accountAId, accountBId] } } });
    await prisma.tenant.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.$disconnect();
  });

  it('replays capital once, preserves decimal amount, and rejects changes to debt/date/client fields', async () => {
    const key = `capital-${suffix}`;
    const fechaOperacion = new Date('2026-10-01T12:00:00.000Z');
    const request = {
      montoRecibido: '100.0123',
      moneda: 'CUP',
      tipo: 'DEUDA_EXTERNA',
      cuentaId: accountAId,
      entidadPrestamista: `lender-${suffix}`,
      tasaInteres: '10.125',
      plazoMeses: 12,
      fechaInicioPago: new Date('2026-11-01T00:00:00.000Z'),
      fechaOperacion,
      descripcion: 'debt-identity',
      idempotencyKey: key,
    };
    const [created, concurrentReplay] = await Promise.all([
      createCapital(request),
      createCapital(request),
    ]);
    expect(created.id).toBe(concurrentReplay.id);
    expect(created.montoInteres.toString()).toBe('10.13');
    expect(created.montoTotalDeuda.toString()).toBe('110.14');
    expect(await prisma.inyeccionCapital.count({ where: { tenantId: tenantAId, idempotencyKey: key } })).toBe(1);
    expect((await accountBalance(accountAId)).toString()).toBe('1100.0123');

    await expect(createCapital({ ...request, tasaInteres: '11' })).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
    });
    await expect(createCapital({ ...request, fechaOperacion: new Date('2026-10-02T12:00:00.000Z') })).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
    });
    await expect(createCapital({ ...request, entidadPrestamista: 'another-lender' })).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
    });
    await expect(createCapital({ ...request, cuentaId: accountBId })).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
    });
    expect((await accountBalance(accountAId)).toString()).toBe('1100.0123');
  });

  it('compares complete adjustment identity and scopes the key to its tenant', async () => {
    const key = `adjustment-${suffix}`;
    const request = {
      cuentaId: accountAId,
      tipo: 'ingreso',
      monto: 0.0123,
      moneda: 'CUP',
      descripcion: 'client-bank-description',
      motivo: 'same payload only',
      fechaOperacion: new Date('2026-10-03T12:00:00.000Z'),
      idempotencyKey: key,
    };
    const [created, retry] = await Promise.all([
      createAdjustment(request),
      createAdjustment(request),
    ]);
    expect(created.ajuste.ajusteId).toBe(retry.ajuste.ajusteId);
    expect((await accountBalance(accountAId)).toString()).toBe('1100.0246');
    expect(await prisma.ajusteBancario.count({ where: { tenantId: tenantAId, idempotencyKey: key } })).toBe(1);

    for (const changed of [
      { ...request, tipo: 'egreso' },
      { ...request, fechaOperacion: new Date('2026-10-04T12:00:00.000Z') },
      { ...request, cuentaId: accountBId },
      { ...request, descripcion: 'other-client-bank-description' },
      { ...request, monto: 0.0124 },
    ]) {
      await expect(createAdjustment(changed)).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    }

    const otherTenant = await createAdjustment({ ...request, cuentaId: accountBId }, tenantBId);
    expect(otherTenant.ajuste.tenantId).toBe(tenantBId);
    expect((await accountBalance(accountBId)).toString()).toBe('1000.0123');
  });

  it('rolls back each writer when strict audit fails and proves the audit trigger with a positive control', async () => {
    await prisma.$executeRawUnsafe(`CREATE TABLE "${auditMarkerTable}" ("id" BIGSERIAL PRIMARY KEY, "usuarioId" TEXT)`);
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION "${auditFailureFunction}"() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        INSERT INTO "${auditMarkerTable}" ("usuarioId") VALUES (NEW."usuarioId");
        IF NEW."usuarioId" = '${actorFail}' THEN
          RAISE EXCEPTION 'AUDIT_FAIL_ACCOUNTING_INTEGRATION' USING ERRCODE = '22012';
        END IF;
        RETURN NEW;
      END;
      $$;
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "${auditFailureTrigger}" BEFORE INSERT ON "AuditLog"
      FOR EACH ROW EXECUTE FUNCTION "${auditFailureFunction}"()
    `);

    await expect(createCapital({
      montoRecibido: '1.125', moneda: 'CUP', tipo: 'CAPITAL_SOCIAL', cuentaId: accountAId,
      socio: `control-${suffix}`, idempotencyKey: `control-${suffix}`,
    })).resolves.toMatchObject({ id: expect.any(String) });
    const beforeCapitalBalance = await accountBalance(accountAId);
    await expect(createCapital({
      montoRecibido: '2.125', moneda: 'CUP', tipo: 'CAPITAL_SOCIAL', cuentaId: accountAId,
      socio: `failure-${suffix}`, idempotencyKey: `failure-capital-${suffix}`,
    }, tenantAId, actorFail)).rejects.toThrow('AUDIT_FAIL_ACCOUNTING_INTEGRATION');
    expect((await accountBalance(accountAId)).eq(beforeCapitalBalance)).toBe(true);
    expect(await prisma.inyeccionCapital.count({ where: { tenantId: tenantAId, idempotencyKey: `failure-capital-${suffix}` } })).toBe(0);

    const beforeAdjustmentBalance = await accountBalance(accountAId);
    await expect(createAdjustment({
      cuentaId: accountAId, tipo: 'ingreso', monto: 3.25, moneda: 'CUP',
      descripcion: 'audit-failure', motivo: 'rollback', idempotencyKey: `failure-adjustment-${suffix}`,
    }, tenantAId, actorFail)).rejects.toThrow('AUDIT_FAIL_ACCOUNTING_INTEGRATION');
    expect((await accountBalance(accountAId)).eq(beforeAdjustmentBalance)).toBe(true);
    expect(await prisma.ajusteBancario.count({ where: { tenantId: tenantAId, idempotencyKey: `failure-adjustment-${suffix}` } })).toBe(0);
  });
});
