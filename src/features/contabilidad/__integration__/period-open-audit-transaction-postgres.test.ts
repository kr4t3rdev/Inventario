import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { expectActionFailure, expectActionSuccess } from '@/test/action-response';
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
let tenantId = '';
let planId = '';
let tenantLicenseId = '';
let userId = '';
let successPeriodId = '';
let triggerInstalled = false;
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
    planFeatures: { contabilidad: true },
  };
}

describe('period open strict audit — PostgreSQL', { timeout: 90_000 }, () => {
  beforeAll(async () => {
    const [prismaModule, actionModule] = await Promise.all([
      import('@/lib/prisma'),
      import('@/features/contabilidad/actions-periodos'),
    ]);
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
    if (successPeriodId) {
      await prisma.aperturaPeriodo.deleteMany({ where: { periodoId: successPeriodId } });
      await prisma.periodoContable.deleteMany({ where: { periodoId: successPeriodId } });
    }
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

  it('commits the period and actor-linked audit on success, and rolls back period/opening on audit failure', async () => {
    const positive = await abrirPeriodoAction({
      tipo: TipoPeriodo.MENSUAL,
      fechaInicio: '2098-01-01T00:00:00.000Z',
      fechaFin: '2098-01-31T23:59:59.000Z',
    });
    expect(positive.success, JSON.stringify(positive)).toBe(true);
    successPeriodId = (expectActionSuccess(positive).data as { periodo: { periodoId: string } }).periodo.periodoId;
    const audit = await prisma.auditLog.findFirst({
      where: { entidad: 'CIERRE_CONTABLE', entidadId: successPeriodId, usuarioId: userId },
    });
    expect(audit).not.toBeNull();

    const beforePeriods = await prisma.periodoContable.count({ where: { tenantId } });
    const beforeOpenings = await prisma.aperturaPeriodo.count({ where: { tenantId } });
    const beforeAudits = await prisma.auditLog.count({
      where: { entidad: 'CIERRE_CONTABLE', usuarioId: userId },
    });
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

    const rejected = await abrirPeriodoAction({
      tipo: TipoPeriodo.MENSUAL,
      fechaInicio: '2098-02-01T00:00:00.000Z',
      fechaFin: '2098-02-28T23:59:59.000Z',
    });
    expect(rejected.success).toBe(false);
    expect(await prisma.periodoContable.count({ where: { tenantId } })).toBe(beforePeriods);
    expect(await prisma.aperturaPeriodo.count({ where: { tenantId } })).toBe(beforeOpenings);
    expect(await prisma.auditLog.count({
      where: { entidad: 'CIERRE_CONTABLE', usuarioId: userId },
    })).toBe(beforeAudits);
  });
});
