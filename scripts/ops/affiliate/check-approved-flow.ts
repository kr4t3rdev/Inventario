import { PrismaClient } from '../../../src/generated/prisma';

const prisma = new PrismaClient();
const email = process.argv[2] || process.env.EMAIL;

if (!email) {
  console.error('Usage: pnpm exec tsx scripts/ops/affiliate/check-approved-flow.ts <email>');
  process.exit(1);
}

async function main() {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      userId: true,
      email: true,
      isActive: true,
      onboardingType: true,
      onboardingStatus: true,
      pendingReferralCode: true,
      emailVerifiedAt: true,
      expiresAt: true,
    },
  });

  if (!user) {
    console.log(JSON.stringify({ user: null }, null, 2));
    return;
  }

  const memberships = await prisma.tenantMembership.findMany({
    where: { userId: user.userId },
    select: { membershipId: true, tenantId: true, tenantRole: true, isActive: true },
  });

  const tenantIds = memberships.map((membership) => membership.tenantId);
  const tenants = tenantIds.length
    ? await prisma.tenant.findMany({
        where: { tenantId: { in: tenantIds } },
        select: { tenantId: true, nombre: true, slug: true },
      })
    : [];

  const affiliateReferral = tenantIds.length
    ? await prisma.affiliateReferral.findFirst({
        where: { referredTenantId: { in: tenantIds } },
        select: {
          referralId: true,
          referrerTenantId: true,
          referredTenantId: true,
          referredPlanId: true,
          status: true,
          confirmedAt: true,
        },
      })
    : null;

  const referrerProfile = affiliateReferral
    ? await prisma.affiliateProfile.findFirst({
        where: { tenantId: affiliateReferral.referrerTenantId },
        select: { referralCode: true, tenantId: true },
      })
    : null;

  console.log(JSON.stringify({ user, memberships, tenants, affiliateReferral, referrerProfile }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
