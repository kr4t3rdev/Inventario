import bcrypt from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma';
import { createTenantForUser } from '../src/lib/services/tenant-factory';

const prisma = new PrismaClient();
const suffix = `pending-ref-${Date.now()}`;

async function main() {
  const passwordHash = await bcrypt.hash('Temp123456!', 12);
  const plan = await prisma.plan.findFirstOrThrow({ where: { nombre: 'Profesional' } });

  const referrerUser = await prisma.user.create({
    data: {
      name: `Referrer ${suffix}`,
      email: `referrer-${suffix}@test.local`,
      password: passwordHash,
      role: 'user',
      isActive: true,
      emailVerifiedAt: new Date(),
    },
  });

  const referrerTenant = await prisma.tenant.create({
    data: { nombre: `Referrer ${suffix}`, slug: `referrer-${suffix}` },
  });

  await prisma.tenantMembership.create({
    data: {
      tenantId: referrerTenant.tenantId,
      userId: referrerUser.userId,
      tenantRole: 'manager',
      isActive: true,
    },
  });

  await prisma.tenantLicense.create({
    data: {
      tenantId: referrerTenant.tenantId,
      planId: plan.planId,
      activa: true,
      inicio: new Date(),
      expiracion: new Date(Date.now() + 30 * 86400000),
      maxUsuarios: plan.maxUsuarios,
      maxAlmacenes: plan.maxAlmacenes,
      maxProductos: plan.maxProductos,
      maxClientes: plan.maxClientes,
      featureOverrides: {},
      listPriceUsd: plan.precio,
      finalPriceUsd: plan.precio,
    },
  });

  const affiliateProfile = await prisma.affiliateProfile.create({
    data: {
      tenantId: referrerTenant.tenantId,
      referralCode: `REF-${suffix.slice(-6).toUpperCase()}`,
      isEligible: true,
      status: 'active',
    },
  });

  const pendingUser = await prisma.user.create({
    data: {
      name: `Company ${suffix}`,
      email: `company-${suffix}@test.local`,
      password: passwordHash,
      role: 'user',
      isActive: false,
      onboardingType: 'company',
      onboardingStatus: 'awaiting_global_approval',
      emailVerifiedAt: new Date(),
      pendingReferralCode: affiliateProfile.referralCode,
    },
  });

  const created = await createTenantForUser({
    userId: pendingUser.userId,
    planId: plan.planId,
    tenantName: `Company ${suffix}`,
  });

  const createdUser = await prisma.user.findUniqueOrThrow({
    where: { userId: pendingUser.userId },
    select: { pendingReferralCode: true, onboardingStatus: true, isActive: true },
  });

  const referral = await prisma.affiliateReferral.findUnique({
    where: { referredTenantId: created.tenantId },
    select: {
      referrerTenantId: true,
      referredTenantId: true,
      referredPlanId: true,
      status: true,
    },
  });

  console.log(JSON.stringify({
    referralCode: affiliateProfile.referralCode,
    createdTenantId: created.tenantId,
    createdUser,
    referral,
  }, null, 2));

  await prisma.affiliateCommissionLedger.deleteMany({ where: { referrerTenantId: referrerTenant.tenantId } });
  await prisma.affiliatePerkGrant.deleteMany({ where: { tenantId: { in: [referrerTenant.tenantId, created.tenantId] } } });
  await prisma.affiliateCreditBalance.deleteMany({ where: { tenantId: { in: [referrerTenant.tenantId, created.tenantId] } } });
  await prisma.affiliateReferral.deleteMany({ where: { OR: [{ referrerTenantId: referrerTenant.tenantId }, { referredTenantId: created.tenantId }] } });
  await prisma.affiliateProfile.deleteMany({ where: { tenantId: { in: [referrerTenant.tenantId, created.tenantId] } } });
  await prisma.tenantLicense.deleteMany({ where: { tenantId: { in: [referrerTenant.tenantId, created.tenantId] } } });
  await prisma.tenantMembership.deleteMany({ where: { tenantId: { in: [referrerTenant.tenantId, created.tenantId] } } });
  await prisma.tenant.deleteMany({ where: { tenantId: { in: [referrerTenant.tenantId, created.tenantId] } } });
  await prisma.userSession.deleteMany({ where: { userId: { in: [referrerUser.userId, pendingUser.userId] } } });
  await prisma.userActivityLog.deleteMany({ where: { userId: { in: [referrerUser.userId, pendingUser.userId] } } });
  await prisma.notification.deleteMany({ where: { userId: { in: [referrerUser.userId, pendingUser.userId] } } });
  await prisma.user.deleteMany({ where: { userId: { in: [referrerUser.userId, pendingUser.userId] } } });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
