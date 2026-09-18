import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Prisma as PrismaNamespace } from '@/generated/prisma';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/server-actions/get-current-user', () => ({ getCurrentUser: vi.fn() }));

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import {
  applyAffiliateCreditsToLicensePreviewAction,
  assignReferralPerkAction,
  confirmReferredTenantPaymentAction,
  generateReferralCodeAction,
  getAffiliateAdminSummaryAction,
  getAffiliateDashboardAction,
  registerReferralFromCodeAction,
} from '@/features/affiliate/actions';

const shouldRunRailwayIntegration =
  process.env.RUN_AFFILIATE_RAILWAY_TEST === '1' && Boolean(process.env.DATABASE_URL);
const describeRailwayIntegration = shouldRunRailwayIntegration ? describe : describe.skip;
const suffix = `it-${Date.now()}`;
let adminUser: AuthenticatedUser;
let referrerUser: AuthenticatedUser;
let referredUser: AuthenticatedUser;
let referrerTenantId = '';
let referredTenantId = '';
let referredLicenseId = '';
let referrerLicenseId = '';

async function createUser(input: { email: string; name: string; role: string }) {
  return prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      password: 'test-password',
      role: input.role,
      isActive: true,
    },
  });
}

describeRailwayIntegration('affiliate actions integration', () => {
  beforeAll(async () => {
    const plan = await prisma.plan.findFirstOrThrow({ where: { nombre: 'Profesional' } });
    const [adminDb, referrerDb, referredDb] = await Promise.all([
      createUser({ email: `admin-${suffix}@test.local`, name: 'Admin IT', role: 'admin' }),
      createUser({ email: `referrer-${suffix}@test.local`, name: 'Referrer IT', role: 'user' }),
      createUser({ email: `referred-${suffix}@test.local`, name: 'Referred IT', role: 'user' }),
    ]);

    const [referrerTenant, referredTenant] = await Promise.all([
      prisma.tenant.create({ data: { nombre: `Referrer Tenant ${suffix}`, slug: `referrer-${suffix}` } }),
      prisma.tenant.create({ data: { nombre: `Referred Tenant ${suffix}`, slug: `referred-${suffix}` } }),
    ]);

    referrerTenantId = referrerTenant.tenantId;
    referredTenantId = referredTenant.tenantId;

    await Promise.all([
      prisma.tenantMembership.create({
        data: {
          tenantId: referrerTenantId,
          userId: referrerDb.userId,
          tenantRole: 'manager',
          isActive: true,
        },
      }),
      prisma.tenantMembership.create({
        data: {
          tenantId: referredTenantId,
          userId: referredDb.userId,
          tenantRole: 'manager',
          isActive: true,
        },
      }),
    ]);

    const featureOverrides = {} as PrismaNamespace.InputJsonValue;
    const [referrerLicense, referredLicense] = await Promise.all([
      prisma.tenantLicense.create({
        data: {
          tenantId: referrerTenantId,
          planId: plan.planId,
          activa: true,
          inicio: new Date(),
          expiracion: new Date(Date.now() + 30 * 86400000),
          maxUsuarios: plan.maxUsuarios,
          maxAlmacenes: plan.maxAlmacenes,
          maxProductos: plan.maxProductos,
          maxClientes: plan.maxClientes,
          featureOverrides,
          listPriceUsd: plan.precio,
          finalPriceUsd: plan.precio,
        },
      }),
      prisma.tenantLicense.create({
        data: {
          tenantId: referredTenantId,
          planId: plan.planId,
          activa: true,
          inicio: new Date(),
          expiracion: new Date(Date.now() + 30 * 86400000),
          maxUsuarios: plan.maxUsuarios,
          maxAlmacenes: plan.maxAlmacenes,
          maxProductos: plan.maxProductos,
          maxClientes: plan.maxClientes,
          featureOverrides,
          listPriceUsd: plan.precio,
          finalPriceUsd: plan.precio,
        },
      }),
    ]);

    referrerLicenseId = referrerLicense.tenantLicenseId;
    referredLicenseId = referredLicense.tenantLicenseId;

    adminUser = { userId: adminDb.userId, name: adminDb.name, email: adminDb.email, role: 'admin', isActive: true };
    referrerUser = {
      userId: referrerDb.userId,
      name: referrerDb.name,
      email: referrerDb.email,
      role: 'user',
      isActive: true,
      tenantId: referrerTenantId,
      tenantRole: 'manager',
      planFeatures: {},
      planName: 'Profesional',
    };
    referredUser = {
      userId: referredDb.userId,
      name: referredDb.name,
      email: referredDb.email,
      role: 'user',
      isActive: true,
      tenantId: referredTenantId,
      tenantRole: 'manager',
      planFeatures: {},
      planName: 'Profesional',
    };
  }, 120000);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await prisma.affiliateCommissionLedger.deleteMany({ where: { OR: [{ referrerTenantId }, { referral: { referredTenantId } }] } });
    await prisma.affiliatePerkGrant.deleteMany({ where: { tenantId: referrerTenantId } });
    await prisma.affiliateCreditBalance.deleteMany({ where: { tenantId: referrerTenantId } });
    await prisma.affiliateReferral.deleteMany({ where: { OR: [{ referrerTenantId }, { referredTenantId }] } });
    await prisma.affiliateProfile.deleteMany({ where: { tenantId: { in: [referrerTenantId, referredTenantId] } } });
    await prisma.referralPerkRequest.deleteMany({ where: { tenantId: { in: [referrerTenantId, referredTenantId] } } });
    await prisma.tenantLicense.deleteMany({ where: { tenantId: { in: [referrerTenantId, referredTenantId] } } });
    await prisma.tenantMembership.deleteMany({ where: { tenantId: { in: [referrerTenantId, referredTenantId] } } });
    await prisma.tenant.deleteMany({ where: { tenantId: { in: [referrerTenantId, referredTenantId] } } });
    await prisma.user.deleteMany({ where: { email: { in: [`admin-${suffix}@test.local`, `referrer-${suffix}@test.local`, `referred-${suffix}@test.local`] } } });
  }, 120000);

  it('executes the referral flow against the real database', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(referrerUser);
    const codeResult = await generateReferralCodeAction(undefined);
    expect(codeResult.success).toBe(true);
    const referralCode = codeResult.success && codeResult.data ? codeResult.data.referralCode : '';
    expect(referralCode).toMatch(/^REF-/);

    vi.mocked(getCurrentUser).mockResolvedValue(referredUser);
    const registerResult = await registerReferralFromCodeAction({ referralCode });
    expect(registerResult.success).toBe(true);
    const referralId = registerResult.success && registerResult.data ? registerResult.data.referralId : '';

    vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
    const confirmResult = await confirmReferredTenantPaymentAction({
      referralId,
      sourceTenantLicenseId: referredLicenseId,
    });
    expect(confirmResult.success).toBe(true);

    const previewResult = await applyAffiliateCreditsToLicensePreviewAction({ tenantLicenseId: referrerLicenseId });
    expect(previewResult.success).toBe(true);
    if (previewResult.success && previewResult.data) {
      expect(previewResult.data.creditAppliedUsd).toBeGreaterThan(0);
      expect(previewResult.data.finalPriceUsd).toBeLessThanOrEqual(previewResult.data.listPriceUsd);
    }

    const grants = await prisma.affiliatePerkGrant.findMany({
      where: { tenantId: referrerTenantId, status: 'pending_manual_assignment' },
      orderBy: { slotIndex: 'asc' },
    });
    expect(grants.length).toBe(1);

    const assignResult = await assignReferralPerkAction({
      perkGrantId: grants[0].perkGrantId,
      tenantLicenseId: referrerLicenseId,
      featureKey: 'referral-priority-support',
    });
    expect(assignResult.success).toBe(true);

    vi.mocked(getCurrentUser).mockResolvedValue(referrerUser);
    const dashboardResult = await getAffiliateDashboardAction(undefined);
    expect(dashboardResult.success).toBe(true);
    if (dashboardResult.success && dashboardResult.data) {
      expect(dashboardResult.data.confirmedSalesCount).toBe(1);
      expect(dashboardResult.data.assignedPerksCount).toBe(1);
      expect(dashboardResult.data.creditAvailableUsd).toBeGreaterThan(0);
    }

    vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
    const adminSummary = await getAffiliateAdminSummaryAction(undefined);
    expect(adminSummary.success).toBe(true);
    if (adminSummary.success && adminSummary.data) {
      const row = adminSummary.data.find((item) => item.tenantId === referrerTenantId);
      expect(row).toBeTruthy();
      expect(row?.confirmedSalesCount).toBe(1);
      expect(row?.assignedPerksCount).toBe(1);
    }
  }, 180000);
});
