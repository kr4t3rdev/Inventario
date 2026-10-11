/**
 * @description Test de integración (DB real) para renewLicenciaAction — la vía
 * canónica de renovación de licencias del panel admin. Valida contra una base
 * de datos desechable el comportamiento completo del flujo: extensión desde la
 * expiración actual, reactivación de expiradas, cambio de plan (reset de
 * features/overrides), preservación de isDemo en demos, pago presencial con
 * idempotencia, rollback por PAYMENT_AMOUNT_MISMATCH, pérdida del descuento
 * por referido al renovar sin pago y auditoría transaccional.
 *
 * @usage
 *   ALLOW_DISPOSABLE_TEST_DB=1 \
 *   DATABASE_URL=postgresql://postgres:test@127.0.0.1:5433/tcp_test_local \
 *   DATABASE_URL_TEST=postgresql://postgres:test@127.0.0.1:5433/tcp_test_local \
 *   DIRECT_URL=postgresql://postgres:test@127.0.0.1:5433/tcp_test_local \
 *   pnpm test:integration -- src/features/admin/__integration__/renew-licencia.integration.test.ts
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';
import { addDays } from '@/lib/date-utils';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { renewLicenciaAction } from '@/features/admin/actions';

// Mocks de infraestructura (no de prisma): auth del wrapper y revalidatePath.
vi.mock('@/lib/server-actions/get-current-user');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { getCurrentUser } from '@/lib/server-actions/get-current-user';

const MS_DAY = 86_400_000;

/** @description Usuario admin inyectado por el mock de getCurrentUser. */
let currentUser: AuthenticatedUser;

/** @description IDs generados por fixture para la limpieza por test. */
const tracked = {
  tenantIds: [] as string[],
  userIds: [] as string[],
  licenseIds: [] as string[],
  planIds: [] as string[],
};

/**
 * @description Crea los fixtures base: dos planes (básico y profesional),
 * tenant, usuario admin y membresía activa.
 */
async function setupFixture() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const plan = await prisma.plan.create({
    data: {
      planId: `plan-it-basic-${suffix}`,
      nombre: 'Plan IT Básico',
      precio: 40,
      duracionDias: 30,
      maxUsuarios: 3,
      maxAlmacenes: 2,
      maxProductos: 100,
      maxClientes: 200,
      features: { 'contabilidad.moneda': 'ARS' },
    },
  });
  tracked.planIds.push(plan.planId);
  const planPro = await prisma.plan.create({
    data: {
      planId: `plan-it-pro-${suffix}`,
      nombre: 'Plan IT Pro',
      precio: 80,
      duracionDias: 90,
      maxUsuarios: 10,
      maxAlmacenes: 5,
      maxProductos: 500,
      maxClientes: 1000,
    },
  });
  tracked.planIds.push(planPro.planId);
  const tenant = await prisma.tenant.create({ data: { nombre: `Tenant IT ${suffix}` } });
  tracked.tenantIds.push(tenant.tenantId);
  const admin = await prisma.user.create({
    data: {
      name: 'Admin IT',
      email: `admin-it-${suffix}@test.local`,
      password: 'test-password',
      role: 'admin',
      isActive: true,
    },
  });
  tracked.userIds.push(admin.userId);
  await prisma.tenantMembership.create({
    data: { tenantId: tenant.tenantId, userId: admin.userId, tenantRole: 'admin', isActive: true },
  });
  currentUser = {
    userId: admin.userId,
    tenantId: null,
    tenantRole: null,
    role: 'admin',
    email: admin.email,
    name: admin.name,
  } as unknown as AuthenticatedUser;
  return { suffix, plan, planPro, tenant, admin };
}

/**
 * @description Crea una TenantLicense para los fixtures.
 * @param {string} tenantId - Tenant dueño de la licencia.
 * @param {string} planId - Plan asociado.
 * @param {object} opts - Valores opcionales (expiración, activa, isDemo, features).
 */
async function createLicense(
  tenantId: string,
  planId: string,
  opts: {
    expiracion: Date;
    activa?: boolean;
    isDemo?: boolean;
    features?: Prisma.InputJsonValue;
    featureOverrides?: Prisma.InputJsonValue;
  },
) {
  const lic = await prisma.tenantLicense.create({
    data: {
      tenantId,
      planId,
      expiracion: opts.expiracion,
      activa: opts.activa ?? true,
      isDemo: opts.isDemo ?? false,
      ...(opts.features ? { features: opts.features } : {}),
      ...(opts.featureOverrides ? { featureOverrides: opts.featureOverrides } : {}),
    },
  });
  tracked.licenseIds.push(lic.tenantLicenseId);
  return lic;
}

/**
 * @description Elimina todos los fixtures creados por el test (orden seguro
 * según FKs: pagos → auditoría → referidos → membresías → licencias →
 * usuarios → tenants → planes).
 */
async function cleanupFixture() {
  try {
    // El ledger referencia al pago (paymentSourceId, Restrict): borrarlo antes
    await prisma.salesAgentCommissionLedger.deleteMany({ where: { sourceTenantLicenseId: { in: tracked.licenseIds } } });
    await prisma.tenantLicensePayment.deleteMany({ where: { tenantId: { in: tracked.tenantIds } } });
    await prisma.auditLog.deleteMany({
      where: { entidad: 'TENANT_LICENSE', entidadId: { in: tracked.licenseIds } },
    });
    await prisma.licenseRenewalOperation.deleteMany({ where: { tenantId: { in: tracked.tenantIds } } });
    await prisma.affiliateReferral.deleteMany({ where: { referredTenantId: { in: tracked.tenantIds } } });
    await prisma.salesAgentReferral.deleteMany({ where: { referredTenantId: { in: tracked.tenantIds } } });
    await prisma.salesAgentBalance.deleteMany({
      where: { user: { email: { endsWith: '@test.local' } } },
    });
    await prisma.notification.deleteMany({ where: { userId: { in: tracked.userIds } } });
    await prisma.tenantMembership.deleteMany({ where: { tenantId: { in: tracked.tenantIds } } });
    await prisma.tenantLicense.deleteMany({ where: { tenantId: { in: tracked.tenantIds } } });
    await prisma.user.deleteMany({ where: { userId: { in: tracked.userIds } } });
    await prisma.tenant.deleteMany({ where: { tenantId: { in: tracked.tenantIds } } });
    await prisma.plan.deleteMany({ where: { planId: { in: tracked.planIds } } });
  } catch (error) {
    // Propagar: una limpieza fallida debe ser visible en la corrida, no silenciosa
    throw new Error(`[integration cleanup] fallo al limpiar fixtures: ${String(error)}`);
  } finally {
    tracked.tenantIds = [];
    tracked.userIds = [];
    tracked.licenseIds = [];
    tracked.planIds = [];
  }
}

describe('renewLicenciaAction — integración con DB real', { timeout: 30_000 }, () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockImplementation(async () => currentUser);
  });

  // Limpieza incondicional: corre aunque una aserción falle a mitad de test
  afterEach(async () => {
    await cleanupFixture();
  });

  it('renueva licencia activa: extiende desde la expiración actual, sincroniza usuarios y audita', async () => {
    const { plan, tenant, admin } = await setupFixture();
    const expiracion = new Date(Date.now() + 40 * MS_DAY);
    const lic = await createLicense(tenant.tenantId, plan.planId, { expiracion });

    const result = await renewLicenciaAction({
      tenantLicenseId: lic.tenantLicenseId,
      planId: plan.planId,
      registerPayment: false,
    });

    expect(result.success).toBe(true);
    if (!result.success) expect.unreachable('Se esperaba que la accion tuviera exito');

    const expectedExpiracion = addDays(expiracion, 30);
    expect(result.data?.newExpiracion).toBe(expectedExpiracion.toISOString());

    const dbLic = await prisma.tenantLicense.findUnique({ where: { tenantLicenseId: lic.tenantLicenseId } });
    expect(dbLic?.expiracion.toISOString()).toBe(expectedExpiracion.toISOString());
    expect(dbLic?.activa).toBe(true);
    expect(dbLic?.planId).toBe(plan.planId);
    expect(dbLic?.listPriceUsd?.toNumber()).toBe(40);
    expect(dbLic?.finalPriceUsd?.toNumber()).toBe(40);
    expect(dbLic?.maxUsuarios).toBe(3);
    expect(dbLic?.maxAlmacenes).toBe(2);
    expect(dbLic?.maxProductos).toBe(100);
    expect(dbLic?.maxClientes).toBe(200);

    // Sincronización de expiresAt de los usuarios del tenant
    const dbUser = await prisma.user.findUnique({ where: { userId: admin.userId } });
    expect(dbUser?.expiresAt?.toISOString()).toBe(expectedExpiracion.toISOString());
    expect(dbUser?.isActive).toBe(true);

    // Auditoría transaccional con diff completo
    const audit = await prisma.auditLog.findFirst({
      where: { entidad: 'TENANT_LICENSE', entidadId: lic.tenantLicenseId, accion: 'UPDATE' },
    });
    expect(audit).not.toBeNull();
    const detalles = audit?.detalles as Record<string, unknown>;
    expect(detalles.previousExpiracion).toBe(expiracion.toISOString());
    expect(detalles.newExpiracion).toBe(expectedExpiracion.toISOString());
    expect(detalles.previousPlanId).toBe(plan.planId);
    expect(detalles.newPlanId).toBe(plan.planId);
    expect(detalles.registerPayment).toBe(false);

    // Sin pago registrado
    const payments = await prisma.tenantLicensePayment.findMany({
      where: { tenantLicenseId: lic.tenantLicenseId },
    });
    expect(payments).toHaveLength(0);

  });

  it('renueva licencia expirada: base = now y reactiva', async () => {
    const { plan, tenant } = await setupFixture();
    const lic = await createLicense(tenant.tenantId, plan.planId, {
      expiracion: new Date(Date.now() - 10 * MS_DAY),
      activa: false,
    });

    const t0 = Date.now();
    const result = await renewLicenciaAction({
      tenantLicenseId: lic.tenantLicenseId,
      planId: plan.planId,
      registerPayment: false,
    });
    const t1 = Date.now();

    expect(result.success).toBe(true);
    if (!result.success) expect.unreachable('Se esperaba que la accion tuviera exito');

    const newExpiracionMs = Date.parse(result.data?.newExpiracion as unknown as string);
    // base = now (tomado dentro de la acción) + 30 días, con tolerancia de 5s
    expect(newExpiracionMs).toBeGreaterThanOrEqual(t0 + 30 * MS_DAY - 5000);
    expect(newExpiracionMs).toBeLessThanOrEqual(t1 + 30 * MS_DAY + 5000);

    const dbLic = await prisma.tenantLicense.findUnique({ where: { tenantLicenseId: lic.tenantLicenseId } });
    expect(dbLic?.activa).toBe(true);
    expect(dbLic?.expiracion.toISOString()).toBe(result.data?.newExpiracion);

  });

  it('renovación con cambio de plan resetea features a null, featureOverrides a vacío y sincroniza max*', async () => {
    const { plan, planPro, tenant } = await setupFixture();
    const lic = await createLicense(tenant.tenantId, plan.planId, {
      expiracion: new Date(Date.now() + 20 * MS_DAY),
      features: { custom: 'x' },
      featureOverrides: { 'contabilidad.moneda': 'USD' },
    });

    const result = await renewLicenciaAction({
      tenantLicenseId: lic.tenantLicenseId,
      planId: planPro.planId,
      registerPayment: false,
    });

    expect(result.success).toBe(true);
    if (!result.success) expect.unreachable('Se esperaba que la accion tuviera exito');
    expect(result.data?.newPlanId).toBe(planPro.planId);

    const dbLic = await prisma.tenantLicense.findUnique({ where: { tenantLicenseId: lic.tenantLicenseId } });
    expect(dbLic?.planId).toBe(planPro.planId);
    // max* sincronizados con el nuevo plan
    expect(dbLic?.maxUsuarios).toBe(10);
    expect(dbLic?.maxAlmacenes).toBe(5);
    expect(dbLic?.maxProductos).toBe(500);
    expect(dbLic?.maxClientes).toBe(1000);
    // Precio del nuevo plan (sin referido)
    expect(dbLic?.listPriceUsd?.toNumber()).toBe(80);
    expect(dbLic?.finalPriceUsd?.toNumber()).toBe(80);
    // Hallazgo del audit: features a null y overrides contables descartados
    expect(dbLic?.features).toBeNull();
    expect(dbLic?.featureOverrides).toEqual({});

  });

  it('mismo plan preserva features y featureOverrides en DB', async () => {
    const { plan, tenant } = await setupFixture();
    const lic = await createLicense(tenant.tenantId, plan.planId, {
      expiracion: new Date(Date.now() + 20 * MS_DAY),
      features: { custom: 'x' },
      featureOverrides: { 'contabilidad.moneda': 'USD' },
    });

    const result = await renewLicenciaAction({
      tenantLicenseId: lic.tenantLicenseId,
      planId: plan.planId,
      registerPayment: false,
    });

    expect(result.success).toBe(true);
    if (!result.success) expect.unreachable('Se esperaba que la accion tuviera exito');

    const dbLic = await prisma.tenantLicense.findUnique({ where: { tenantLicenseId: lic.tenantLicenseId } });
    expect(dbLic?.features).toEqual({ custom: 'x' });
    expect(dbLic?.featureOverrides).toEqual({ 'contabilidad.moneda': 'USD' });

  });

  it('demo renovada se reactiva conservando isDemo (interacción con cleanup de cron)', async () => {
    const { plan, tenant } = await setupFixture();
    const lic = await createLicense(tenant.tenantId, plan.planId, {
      expiracion: new Date(Date.now() - 2 * MS_DAY),
      activa: false,
      isDemo: true,
    });

    const result = await renewLicenciaAction({
      tenantLicenseId: lic.tenantLicenseId,
      planId: plan.planId,
      registerPayment: false,
    });

    expect(result.success).toBe(true);
    if (!result.success) expect.unreachable('Se esperaba que la accion tuviera exito');

    const dbLic = await prisma.tenantLicense.findUnique({ where: { tenantLicenseId: lic.tenantLicenseId } });
    expect(dbLic?.activa).toBe(true);
    // Hallazgo del audit: la renovación no limpia isDemo
    expect(dbLic?.isDemo).toBe(true);

  });

  it('pago presencial: crea TenantLicensePayment con idempotencia; retry con misma clave no duplica el pago', async () => {
    const { plan, tenant, admin } = await setupFixture();
    const lic = await createLicense(tenant.tenantId, plan.planId, {
      expiracion: new Date(Date.now() + 20 * MS_DAY),
    });
    const idempotencyKey = `renewal:${lic.tenantLicenseId}:it-1`;

    const r1 = await renewLicenciaAction({
      tenantLicenseId: lic.tenantLicenseId,
      planId: plan.planId,
      registerPayment: true,
      amountPaidUsd: 40,
      idempotencyKey,
    });

    expect(r1.success).toBe(true);
    if (!r1.success) expect.unreachable('Se esperaba que la accion tuviera exito');
    expect(r1.data?.duplicate).toBe(false);
    const firstExpiracion = r1.data?.newExpiracion as unknown as string;

    const payments = await prisma.tenantLicensePayment.findMany({
      where: { tenantLicenseId: lic.tenantLicenseId },
    });
    expect(payments).toHaveLength(1);
    expect(payments[0].paymentKind).toBe('renewal');
    expect(payments[0].status).toBe('confirmed');
    expect(payments[0].expectedAmountUsd.toNumber()).toBe(40);
    expect(payments[0].amountPaidUsd.toNumber()).toBe(40);
    expect(payments[0].idempotencyKey).toBe(idempotencyKey);
    expect(payments[0].confirmedByAdminId).toBe(admin.userId);
    expect(payments[0].paymentCycleEndsAt.toISOString()).toBe(firstExpiracion);

    // Retry con la misma idempotencyKey: NI el pago NI la vigencia se duplican.
    // El recibo de la operación devuelve el outcome original.
    const r2 = await renewLicenciaAction({
      tenantLicenseId: lic.tenantLicenseId,
      planId: plan.planId,
      registerPayment: true,
      amountPaidUsd: 40,
      idempotencyKey,
    });

    expect(r2.success).toBe(true);
    if (!r2.success) expect.unreachable('Se esperaba que la accion tuviera exito');
    expect(r2.data?.duplicate).toBe(true);
    // El outcome del replay es exactamente el original: sin segunda extensión
    expect(r2.data?.newExpiracion).toBe(firstExpiracion);
    const paymentsAfter = await prisma.tenantLicensePayment.findMany({
      where: { tenantLicenseId: lic.tenantLicenseId },
    });
    expect(paymentsAfter).toHaveLength(1);
    // La expiración persistida no cambió con el retry
    const dbLicAfter = await prisma.tenantLicense.findUnique({ where: { tenantLicenseId: lic.tenantLicenseId } });
    expect(dbLicAfter?.expiracion.toISOString()).toBe(firstExpiracion);
    // Un solo registro de auditoría: el replay no audita de nuevo
    const audits = await prisma.auditLog.count({
      where: { entidad: 'TENANT_LICENSE', entidadId: lic.tenantLicenseId, accion: 'UPDATE' },
    });
    expect(audits).toBe(1);
    // El recibo inmutable de la operación existe
    const receipt = await prisma.licenseRenewalOperation.findFirst({
      where: { tenantLicenseId: lic.tenantLicenseId },
    });
    expect(receipt?.responseSnapshot).toEqual(expect.objectContaining({
      registeredPaymentId: paymentsAfter[0].tenantLicensePaymentId,
    }));

  });

  it('monto pagado distinto al exigible: PAYMENT_AMOUNT_MISMATCH y rollback completo de la transacción', async () => {
    const { plan, tenant } = await setupFixture();
    const lic = await createLicense(tenant.tenantId, plan.planId, {
      expiracion: new Date(Date.now() + 20 * MS_DAY),
    });

    const result = await renewLicenciaAction({
      tenantLicenseId: lic.tenantLicenseId,
      planId: plan.planId,
      registerPayment: true,
      amountPaidUsd: 50,
      idempotencyKey: `renewal:${lic.tenantLicenseId}:mismatch`,
    });

    expect(result.success).toBe(false);
    if (result.success) expect.unreachable('Se esperaba que la accion fallara');
    expect(result.error?.code).toBe('PAYMENT_AMOUNT_MISMATCH');

    // Rollback: la licencia conserva su expiración original y no hay pago ni auditoría
    const dbLic = await prisma.tenantLicense.findUnique({ where: { tenantLicenseId: lic.tenantLicenseId } });
    expect(dbLic?.expiracion.toISOString()).toBe(lic.expiracion.toISOString());
    const payments = await prisma.tenantLicensePayment.findMany({
      where: { tenantLicenseId: lic.tenantLicenseId },
    });
    expect(payments).toHaveLength(0);
    const audit = await prisma.auditLog.findFirst({
      where: { entidad: 'TENANT_LICENSE', entidadId: lic.tenantLicenseId, accion: 'UPDATE' },
    });
    expect(audit).toBeNull();

  });

  it('REGRESIÓN: renovar sin pago a tenant referido por afiliado conserva el descuento', async () => {
    const { suffix, plan } = await setupFixture();
    // Tenant referido con su propio usuario/membresía/licencia
    const referrerTenant = await prisma.tenant.create({ data: { nombre: `Referrer IT ${suffix}` } });
    const referredTenant = await prisma.tenant.create({ data: { nombre: `Referred IT ${suffix}` } });
    const referredUser = await prisma.user.create({
      data: {
        name: 'Referred IT',
        email: `referred-it-${suffix}@test.local`,
        password: 'test-password',
        role: 'regularUser',
        isActive: true,
      },
    });
    await prisma.tenantMembership.create({
      data: { tenantId: referredTenant.tenantId, userId: referredUser.userId, isActive: true },
    });
    await prisma.affiliateReferral.create({
      data: { referrerTenantId: referrerTenant.tenantId, referredTenantId: referredTenant.tenantId, status: 'confirmed' },
    });
    tracked.tenantIds.push(referrerTenant.tenantId, referredTenant.tenantId);
    tracked.userIds.push(referredUser.userId);

    const lic = await createLicense(referredTenant.tenantId, plan.planId, {
      expiracion: new Date(Date.now() + 20 * MS_DAY),
    });

    const result = await renewLicenciaAction({
      tenantLicenseId: lic.tenantLicenseId,
      planId: plan.planId,
      registerPayment: false,
    });

    expect(result.success).toBe(true);
    if (!result.success) expect.unreachable('Se esperaba que la accion tuviera exito');

    const dbLic = await prisma.tenantLicense.findUnique({ where: { tenantLicenseId: lic.tenantLicenseId } });
    // La detección de referidos ya no depende de registrar pago
    expect(dbLic?.listPriceUsd?.toNumber()).toBe(40);
    expect(dbLic?.finalPriceUsd?.toNumber()).toBe(35);

  });

  it('REGRESIÓN: concurrencia — dos renovaciones simultáneas con la misma clave extienden una sola vez', async () => {
    const { plan, tenant } = await setupFixture();
    const lic = await createLicense(tenant.tenantId, plan.planId, {
      expiracion: new Date(Date.now() + 20 * MS_DAY),
    });
    const key = `renewal:${lic.tenantLicenseId}:it-race`;
    const input = {
      tenantLicenseId: lic.tenantLicenseId,
      planId: plan.planId,
      registerPayment: true,
      amountPaidUsd: 40,
      idempotencyKey: key,
    };

    // Ambas corren en paralelo: el lock de fila serializa y el recibo
    // resuelve la carrera — solo una extiende, la otra hace replay.
    const [r1, r2] = await Promise.all([
      renewLicenciaAction(input),
      renewLicenciaAction(input),
    ]);

    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    if (!r1.success || !r2.success) expect.unreachable('Se esperaba que ambas acciones tuvieran exito');
    const duplicates = [r1.data?.duplicate, r2.data?.duplicate].sort();
    // Exactamente una operación nueva y un replay
    expect(duplicates).toEqual([true, false].sort());
    // Ambas respuestas reportan el mismo outcome
    expect(r1.data?.newExpiracion).toBe(r2.data?.newExpiracion);

    const dbLic = await prisma.tenantLicense.findUnique({ where: { tenantLicenseId: lic.tenantLicenseId } });
    const expectedExpiracion = new Date(lic.expiracion.getTime() + 30 * MS_DAY);
    expect(dbLic?.expiracion.toISOString()).toBe(expectedExpiracion.toISOString());
    // Un solo pago y un solo recibo
    const payments = await prisma.tenantLicensePayment.count({
      where: { tenantLicenseId: lic.tenantLicenseId },
    });
    expect(payments).toBe(1);
    const receipts = await prisma.licenseRenewalOperation.count({
      where: { tenantLicenseId: lic.tenantLicenseId },
    });
    expect(receipts).toBe(1);

  });

  it('REGRESIÓN: renovación con clave sin pago — el replay no extiende la vigencia', async () => {
    const { plan, tenant } = await setupFixture();
    const lic = await createLicense(tenant.tenantId, plan.planId, {
      expiracion: new Date(Date.now() + 20 * MS_DAY),
    });
    const key = `renewal:${lic.tenantLicenseId}:it-nopay`;
    const input = {
      tenantLicenseId: lic.tenantLicenseId,
      planId: plan.planId,
      registerPayment: false,
      idempotencyKey: key,
    };

    const r1 = await renewLicenciaAction(input);
    expect(r1.success).toBe(true);
    if (!r1.success) expect.unreachable('Se esperaba que la accion tuviera exito');
    expect(r1.data?.duplicate).toBe(false);
    const firstExpiracion = r1.data?.newExpiracion as unknown as string;

    const r2 = await renewLicenciaAction(input);
    expect(r2.success).toBe(true);
    if (!r2.success) expect.unreachable('Se esperaba que la accion tuviera exito');
    expect(r2.data?.duplicate).toBe(true);
    expect(r2.data?.newExpiracion).toBe(firstExpiracion);

    const dbLic = await prisma.tenantLicense.findUnique({ where: { tenantLicenseId: lic.tenantLicenseId } });
    expect(dbLic?.expiracion.toISOString()).toBe(firstExpiracion);
    // Sin pago: no debe existir ningún TenantLicensePayment
    const payments = await prisma.tenantLicensePayment.count({
      where: { tenantLicenseId: lic.tenantLicenseId },
    });
    expect(payments).toBe(0);
    const audits = await prisma.auditLog.count({
      where: { entidad: 'TENANT_LICENSE', entidadId: lic.tenantLicenseId, accion: 'UPDATE' },
    });
    expect(audits).toBe(1);
    const receipts = await prisma.licenseRenewalOperation.count({
      where: { tenantLicenseId: lic.tenantLicenseId },
    });
    expect(receipts).toBe(1);

  });

  it('REGRESIÓN: clave reutilizada sobre otra licencia del mismo tenant → IDEMPOTENCY_CONFLICT', async () => {
    const { plan, tenant } = await setupFixture();
    const lic1 = await createLicense(tenant.tenantId, plan.planId, {
      expiracion: new Date(Date.now() + 20 * MS_DAY),
    });
    const lic2 = await createLicense(tenant.tenantId, plan.planId, {
      expiracion: new Date(Date.now() + 25 * MS_DAY),
    });
    const key = `renewal:${tenant.tenantId}:compartida`;
    const expiracion2Original = lic2.expiracion.toISOString();

    const r1 = await renewLicenciaAction({
      tenantLicenseId: lic1.tenantLicenseId,
      planId: plan.planId,
      registerPayment: false,
      idempotencyKey: key,
    });
    expect(r1.success).toBe(true);
    if (!r1.success) expect.unreachable('Se esperaba que la accion tuviera exito');

    // La misma clave sobre OTRA licencia: conflicto, sin tocar lic2
    const r2 = await renewLicenciaAction({
      tenantLicenseId: lic2.tenantLicenseId,
      planId: plan.planId,
      registerPayment: false,
      idempotencyKey: key,
    });
    expect(r2.success).toBe(false);
    if (r2.success) expect.unreachable('Se esperaba que la accion fallara');
    expect(r2.error?.code).toBe('IDEMPOTENCY_CONFLICT');

    const dbLic2 = await prisma.tenantLicense.findUnique({ where: { tenantLicenseId: lic2.tenantLicenseId } });
    expect(dbLic2?.expiracion.toISOString()).toBe(expiracion2Original);
    const receipts2 = await prisma.licenseRenewalOperation.count({
      where: { tenantLicenseId: lic2.tenantLicenseId },
    });
    expect(receipts2).toBe(0);

  });

  it('REGRESIÓN: renovación con pago a tenant del gestor — comisión dentro de la tx y replay sin duplicar', async () => {
    const { suffix, plan, tenant } = await setupFixture();
    const agentUser = await prisma.user.create({
      data: {
        name: 'Gestor IT',
        email: `gestor-it-${suffix}@test.local`,
        password: 'test-password',
        role: 'salesAgent',
        isActive: true,
      },
    });
    tracked.userIds.push(agentUser.userId);
    await prisma.salesAgentProfile.create({
      data: { userId: agentUser.userId, status: 'active' },
    });
    await prisma.salesAgentReferral.create({
      data: { salesAgentUserId: agentUser.userId, referredTenantId: tenant.tenantId },
    });

    const lic = await createLicense(tenant.tenantId, plan.planId, {
      expiracion: new Date(Date.now() + 20 * MS_DAY),
    });
    const key = `renewal:${lic.tenantLicenseId}:agent-1`;
    const input = {
      tenantLicenseId: lic.tenantLicenseId,
      planId: plan.planId,
      registerPayment: true,
      amountPaidUsd: 35,
      idempotencyKey: key,
    };

    const r1 = await renewLicenciaAction(input);
    expect(r1.success).toBe(true);
    if (!r1.success) expect.unreachable('Se esperaba que la accion tuviera exito');
    expect(r1.data?.commissionCredited).toBe(true);
    expect(r1.data?.duplicate).toBe(false);
    const firstExpiracion = r1.data?.newExpiracion as unknown as string;

    // Pago con descuento referido (40 - 5) y comisión acreditada, todo en la misma tx
    const payments = await prisma.tenantLicensePayment.findMany({
      where: { tenantLicenseId: lic.tenantLicenseId },
    });
    expect(payments).toHaveLength(1);
    expect(payments[0].paymentKind).toBe('renewal');
    expect(payments[0].expectedAmountUsd.toNumber()).toBe(35);
    const ledger = await prisma.salesAgentCommissionLedger.findFirst({
      where: { sourceTenantLicenseId: lic.tenantLicenseId },
    });
    expect(ledger).not.toBeNull();
    expect(ledger?.idempotencyKey).toBe(key);
    const balance = await prisma.salesAgentBalance.findUnique({
      where: { userId: agentUser.userId },
    });
    expect(balance?.availableUsd.toNumber()).toBe(ledger?.commissionAmountUsd.toNumber());
    const dbLic = await prisma.tenantLicense.findUnique({ where: { tenantLicenseId: lic.tenantLicenseId } });
    expect(dbLic?.finalPriceUsd?.toNumber()).toBe(35);

    // Replay con la misma clave: ni vigencia, ni pago, ni comisión se duplican
    const r2 = await renewLicenciaAction(input);
    expect(r2.success).toBe(true);
    if (!r2.success) expect.unreachable('Se esperaba que la accion tuviera exito');
    expect(r2.data?.duplicate).toBe(true);
    expect(r2.data?.newExpiracion).toBe(firstExpiracion);

    const paymentsAfter = await prisma.tenantLicensePayment.count({
      where: { tenantLicenseId: lic.tenantLicenseId },
    });
    expect(paymentsAfter).toBe(1);
    const ledgersAfter = await prisma.salesAgentCommissionLedger.count({
      where: { sourceTenantLicenseId: lic.tenantLicenseId },
    });
    expect(ledgersAfter).toBe(1);
    const balanceAfter = await prisma.salesAgentBalance.findUnique({
      where: { userId: agentUser.userId },
    });
    expect(balanceAfter?.availableUsd.toNumber()).toBe(ledger?.commissionAmountUsd.toNumber());

  });

  it('REGRESIÓN: gestor inactivo — la renovación con pago se revierte por completo', async () => {
    const { suffix, plan, tenant } = await setupFixture();
    const agentUser = await prisma.user.create({
      data: {
        name: 'Gestor Inactivo IT',
        email: `gestor-off-it-${suffix}@test.local`,
        password: 'test-password',
        role: 'salesAgent',
        isActive: false,
      },
    });
    tracked.userIds.push(agentUser.userId);
    await prisma.salesAgentProfile.create({
      data: { userId: agentUser.userId, status: 'active' },
    });
    await prisma.salesAgentReferral.create({
      data: { salesAgentUserId: agentUser.userId, referredTenantId: tenant.tenantId },
    });

    const lic = await createLicense(tenant.tenantId, plan.planId, {
      expiracion: new Date(Date.now() + 20 * MS_DAY),
    });

    const result = await renewLicenciaAction({
      tenantLicenseId: lic.tenantLicenseId,
      planId: plan.planId,
      registerPayment: true,
      amountPaidUsd: 35,
      idempotencyKey: `renewal:${lic.tenantLicenseId}:agent-off`,
    });

    expect(result.success).toBe(false);
    if (result.success) expect.unreachable('Se esperaba que la accion fallara');
    expect(result.error?.code).toBe('SALES_AGENT_NOT_ACTIVE');

    // Rollback atómico: licencia, pago, recibo y auditoría sin cambios
    const dbLic = await prisma.tenantLicense.findUnique({ where: { tenantLicenseId: lic.tenantLicenseId } });
    expect(dbLic?.expiracion.toISOString()).toBe(lic.expiracion.toISOString());
    const payments = await prisma.tenantLicensePayment.count({
      where: { tenantLicenseId: lic.tenantLicenseId },
    });
    expect(payments).toBe(0);
    const receipts = await prisma.licenseRenewalOperation.count({
      where: { tenantLicenseId: lic.tenantLicenseId },
    });
    expect(receipts).toBe(0);
    const audit = await prisma.auditLog.findFirst({
      where: { entidad: 'TENANT_LICENSE', entidadId: lic.tenantLicenseId, accion: 'UPDATE' },
    });
    expect(audit).toBeNull();

  });
});
