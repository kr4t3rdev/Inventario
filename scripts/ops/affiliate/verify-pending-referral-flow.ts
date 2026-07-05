import bcrypt from 'bcryptjs';
import { PrismaClient } from '../../../src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  const suffix = `pending-ref-${Date.now()}`;
  const password = 'Temp123456!';
  const passwordHash = await bcrypt.hash(password, 12);

  const referrerPlan = await prisma.plan.findFirstOrThrow({ where: { nombre: 'Profesional' } });
  const referredPlan = await prisma.plan.findFirstOrThrow({ where: { nombre: 'Básico' } });

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
    data: { tenantId: referrerTenant.tenantId, userId: referrerUser.userId, tenantRole: 'manager', isActive: true },
  });

  await prisma.tenantLicense.create({
    data: {
      tenantId: referrerTenant.tenantId,
      planId: referrerPlan.planId,
      activa: true,
      inicio: new Date(),
      expiracion: new Date(Date.now() + 30 * 86400000),
      maxUsuarios: referrerPlan.maxUsuarios,
      maxAlmacenes: referrerPlan.maxAlmacenes,
      maxProductos: referrerPlan.maxProductos,
      maxClientes: referrerPlan.maxClientes,
      featureOverrides: {},
      listPriceUsd: referrerPlan.precio,
      finalPriceUsd: referrerPlan.precio,
    },
  });

  const profile = await prisma.affiliateProfile.create({
    data: {
      tenantId: referrerTenant.tenantId,
      referralCode: `REF-${suffix.slice(-6).toUpperCase()}`,
      isEligible: true,
      status: 'active',
    },
  });

  const pendingUser = await prisma.user.create({
    data: {
      name: `Pending ${suffix}`,
      email: `pending-${suffix}@test.local`,
      password: passwordHash,
      role: 'user',
      isActive: false,
      onboardingType: 'company',
      onboardingStatus: 'awaiting_global_approval',
      emailVerifiedAt: new Date(),
      pendingReferralCode: profile.referralCode,
    },
  });

  const referredTenant = await prisma.tenant.create({
    data: { nombre: `Referred ${suffix}`, slug: `referred-${suffix}` },
  });

  await prisma.tenantMembership.create({
    data: { tenantId: referredTenant.tenantId, userId: pendingUser.userId, tenantRole: 'manager', isActive: true },
  }).catch(() => undefined);

  const referredLicense = await prisma.tenantLicense.create({
    data: {
      tenantId: referredTenant.tenantId,
      planId: referredPlan.planId,
      activa: true,
      inicio: new Date(),
      expiracion: new Date(Date.now() + 30 * 86400000),
      maxUsuarios: referredPlan.maxUsuarios,
      maxAlmacenes: referredPlan.maxAlmacenes,
      maxProductos: referredPlan.maxProductos,
      maxClientes: referredPlan.maxClientes,
      featureOverrides: {},
      listPriceUsd: referredPlan.precio,
      finalPriceUsd: referredPlan.precio,
    },
  });

  await prisma.user.update({
    where: { userId: pendingUser.userId },
    data: {
      isActive: true,
      onboardingStatus: null,
      pendingReferralCode: null,
      expiresAt: referredLicense.expiracion,
    },
  });

  const referral = await prisma.affiliateReferral.create({
    data: {
      referrerTenantId: referrerTenant.tenantId,
      referredTenantId: referredTenant.tenantId,
      referredPlanId: referredPlan.planId,
      status: 'registered',
    },
  });

  const createdUser = await prisma.user.findUnique({
    where: { userId: pendingUser.userId },
    select: { pendingReferralCode: true, onboardingStatus: true, isActive: true },
  });

  console.log(JSON.stringify({
    referralCode: profile.referralCode,
    createdTenantId: referredTenant.tenantId,
    createdUser,
    referral: {
      referrerTenantId: referral.referrerTenantId,
      referredTenantId: referral.referredTenantId,
      referredPlanId: referral.referredPlanId,
      status: referral.status,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
