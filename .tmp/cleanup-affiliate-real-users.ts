import { PrismaClient } from '../src/generated/prisma';
const prisma = new PrismaClient();
const suffix = 'real-1783109828850';
async function main() {
  const adminEmail = `admin-${suffix}@test.local`;
  const referrerEmail = `referrer-${suffix}@test.local`;
  const users = await prisma.user.findMany({
    where: { email: { in: [adminEmail, referrerEmail] } },
    select: { userId: true, email: true },
  });
  const userIds = users.map((u) => u.userId);
  const memberships = await prisma.tenantMembership.findMany({
    where: { userId: { in: userIds } },
    select: { tenantId: true },
  });
  const tenantIds = [...new Set(memberships.map((m) => m.tenantId))];

  await prisma.affiliateCommissionLedger.deleteMany({ where: { referrerTenantId: { in: tenantIds } } });
  await prisma.affiliatePerkGrant.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.affiliateCreditBalance.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.affiliateReferral.deleteMany({ where: { OR: [{ referrerTenantId: { in: tenantIds } }, { referredTenantId: { in: tenantIds } }] } });
  await prisma.affiliateProfile.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.referralPerkRequest.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.tenantLicense.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.tenantMembership.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.tenant.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.userSession.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.userActivityLog.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { userId: { in: userIds } } });
  console.log(JSON.stringify({ cleanedUsers: users.length, cleanedTenants: tenantIds.length }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });
