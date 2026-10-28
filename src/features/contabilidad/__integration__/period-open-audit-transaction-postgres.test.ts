import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { expectActionFailure } from '@/test/action-response';
import {
  assertDisposableDatabase,
  assertDisposableDatabaseIdentity,
} from '../../../../scripts/ci/disposable-database.mjs';
import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { TipoPeriodo } from '@/lib/services/periodo-contable-types';

assertDisposableDatabase(process.env);

vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

let prisma!: typeof import('@/lib/prisma').prisma;
let abrirPeriodoAction!: typeof import('@/features/contabilidad/actions-periodos').abrirPeriodoAction;
let aperturaPeriodoService!: typeof import('@/lib/services/apertura-periodo-service').AperturaPeriodoService;
let tenantId = '';
let planId = '';
let tenantLicenseId = '';
let userId = '';
let triggerInstalled = false;
let accountingEnabled = true;
const unique = crypto.randomUUID().replaceAll('-', '');
const tenantName = `period-open-audit-${unique}`;
const email = `${tenantName}@test.local`;
const triggerName = `period_audit_fail_${unique.slice(0, 12)}`;
const functionName = `period_audit_fail_fn_${unique.slice(0, 12)}`;

function currentUser(): AuthenticatedUser {
  return {
    userId,
    name: 'Period audit integration actor',
    email,
    role: 'admin',
    isActive: true,
    tenantId,
    tenantRole: 'manager',
    planFeatures: { contabilidad: accountingEnabled },
  };
}

describe('period open strict audit — PostgreSQL', { timeout: 90_000 }, () => {
  beforeAll(async () => {
    const [prismaModule, actionModule] = await Promise.all([
      import('@/lib/prisma'),
      import('@/features/contabilidad/actions-periodos'),
    ]);
    ({ AperturaPeriodoService: aperturaPeriodoService } = await import(
      '@/lib/services/apertura-periodo-service'
    ));
    prisma = prismaModule.prisma;
    abrirPeriodoAction = actionModule.abrirPeriodoAction;

    const identity = await prisma.$queryRaw<Array<{
      databaseName: string; roleName: string; serverPort: number;
    }>>`
      SELECT current_database() AS "databaseName", current_user AS "roleName",
        inet_server_port() AS "serverPort"
    `;
    assertDisposableDatabaseIdentity(identity[0], process.env);

    const plan = await prisma.plan.create({
      data: { nombre: tenantName, duracionDias: 365, features: { contabilidad: true } },
    });
    planId = plan.planId;
    const tenant = await prisma.tenant.create({ data: { nombre: tenantName, slug: tenantName } });
    tenantId = tenant.tenantId;
    const license = await prisma.tenantLicense.create({
      data: { tenantId, planId, expiracion: new Date('2099-01-01') },
    });
    tenantLicenseId = license.tenantLicenseId;
    const user = await prisma.user.create({
      data: { name: 'Period audit integration actor', email, password: 'integration-only-placeholder' },
    });
    userId = user.userId;
    vi.mocked(getCurrentUser).mockImplementation(async () => currentUser());
  });

  afterAll(async () => {
    if (!prisma) return;
    if (triggerInstalled) {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${triggerName}" ON "AuditLog"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${functionName}"()`);
    }
    if (userId) await prisma.auditLog.deleteMany({ where: { usuarioId: userId } });
    if (tenantId) {
      await prisma.aperturaPeriodo.deleteMany({ where: { tenantId } });
      await prisma.periodoContable.deleteMany({ where: { tenantId } });
    }
    if (tenantLicenseId) await prisma.tenantLicense.deleteMany({ where: { tenantLicenseId } });
    if (tenantId) await prisma.tenant.deleteMany({ where: { tenantId } });
    if (planId) await prisma.plan.deleteMany({ where: { planId } });
    if (userId) await prisma.user.deleteMany({ where: { userId } });
    await prisma.$disconnect();
  });

  it('blocks unverifiable openings atomically, retains strict audit guarantees, and enforces feature access', async () => {
    const beforePeriods = await prisma.periodoContable.count({ where: { tenantId } });
    const beforeOpenings = await prisma.aperturaPeriodo.count({ where: { tenantId } });
    const beforeAudits = await prisma.auditLog.count({ where: { usuarioId: userId } });

    const blocked = await abrirPeriodoAction({
      tipo: TipoPeriodo.MENSUAL,
      fechaInicio: '2098-01-01T00:00:00.000Z',
      fechaFin: '2098-01-31T23:59:59.000Z',
    });
    expect(blocked.success).toBe(false);
    expect(expectActionFailure(blocked).error?.code).toBe('APERTURA_SALDOS_NO_VERIFICABLES');
    expect(await prisma.periodoContable.count({ where: { tenantId } })).toBe(beforePeriods);
    expect(await prisma.aperturaPeriodo.count({ where: { tenantId } })).toBe(beforeOpenings);
    expect(await prisma.auditLog.count({ where: { usuarioId: userId } })).toBe(beforeAudits);

    // Simulate verified evidence only in this integration test while still writing
    // the opening row through the real transaction-scoped PostgreSQL client.
    vi.spyOn(aperturaPeriodoService, 'createAperturaPeriodo').mockImplementation(
      async (periodoId, openingTenantId, _actor, tx) => {
        if (!tx) throw new Error('Expected transaction-scoped client');
        return tx.aperturaPeriodo.create({
          data: {
            periodoId,
            tenantId: openingTenantId,
            saldoCajaInicial: 125,
            detalleJson: { evidencia: 'verified-test-fixture', moneda: 'CUP' },
          },
        });
      },
    );
    const successful = await abrirPeriodoAction({
      tipo: TipoPeriodo.MENSUAL,
      fechaInicio: '2098-02-01T00:00:00.000Z',
      fechaFin: '2098-02-28T23:59:59.000Z',
    });
    expect(successful.success, JSON.stringify(successful)).toBe(true);
    const successfulPeriodId = (successful as {
      data: { periodo: { periodoId: string } };
    }).data.periodo.periodoId;
    const audit = await prisma.auditLog.findFirst({
      where: { entidad: 'CIERRE_CONTABLE', entidadId: successfulPeriodId, usuarioId: userId },
    });
    expect(audit).not.toBeNull();
    const successfulOpening = await prisma.aperturaPeriodo.findUnique({
      where: { periodoId: successfulPeriodId },
    });
    expect(successfulOpening?.saldoCajaInicial.toString()).toBe('125');

    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION "${functionName}"() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW."entidad" = 'CIERRE_CONTABLE' AND NEW."accion" = 'CREATE'
           AND NEW."usuarioId" = '${userId.replaceAll("'", "''")}' THEN
          RAISE EXCEPTION 'forced period audit rejection' USING ERRCODE = '22012';
        END IF;
        RETURN NEW;
      END $$
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "${triggerName}" BEFORE INSERT ON "AuditLog"
      FOR EACH ROW EXECUTE FUNCTION "${functionName}"()
    `);
    triggerInstalled = true;

    const beforeFailedOpenings = await prisma.aperturaPeriodo.count({ where: { tenantId } });
    const beforeFailedPeriods = await prisma.periodoContable.count({ where: { tenantId } });
    const beforeFailedAudits = await prisma.auditLog.count({ where: { usuarioId: userId } });
    const auditRejectedOpening = await abrirPeriodoAction({
      tipo: TipoPeriodo.MENSUAL,
      fechaInicio: '2098-03-01T00:00:00.000Z',
      fechaFin: '2098-03-31T23:59:59.000Z',
    });
    expect(auditRejectedOpening.success).toBe(false);
    expect(await prisma.aperturaPeriodo.count({ where: { tenantId } })).toBe(beforeFailedOpenings);
    expect(await prisma.periodoContable.count({ where: { tenantId } })).toBe(beforeFailedPeriods);
    expect(await prisma.auditLog.count({ where: { usuarioId: userId } })).toBe(beforeFailedAudits);

    const beforeDeniedPeriods = await prisma.periodoContable.count({ where: { tenantId } });
    const beforeDeniedOpenings = await prisma.aperturaPeriodo.count({ where: { tenantId } });
    accountingEnabled = false;
    const denied = await abrirPeriodoAction({
      tipo: TipoPeriodo.MENSUAL,
      fechaInicio: '2098-04-01T00:00:00.000Z',
      fechaFin: '2098-04-30T23:59:59.000Z',
    });
    expect(denied.success).toBe(false);
    expect(await prisma.periodoContable.count({ where: { tenantId } })).toBe(beforeDeniedPeriods);
    expect(await prisma.aperturaPeriodo.count({ where: { tenantId } })).toBe(beforeDeniedOpenings);
    vi.restoreAllMocks();
  });
});
