import { PrismaClient } from '../src/generated/prisma';
const prisma = new PrismaClient();
const referredTenantName = 'Affiliate HostFlow Co';

async function main() {
  const referredTenant = await prisma.tenant.findFirst({
    where: { nombre: referredTenantName },
    select: { tenantId: true, nombre: true },
  });
  if (!referredTenant) {
    console.log(JSON.stringify({ referredTenant: null }, null, 2));
    return;
  }

  const referral = await prisma.affiliateReferral.findFirst({
    where: { referredTenantId: referredTenant.tenantId },
    select: {
      referralId: true,
      referrerTenantId: true,
      referredTenantId: true,
      status: true,
      firstConfirmedLicenseId: true,
      confirmedAt: true,
    },
  });

  const ledger = referral ? await prisma.affiliateCommissionLedger.findMany({
    where: { referralId: referral.referralId },
    select: {
      ledgerId: true,
      referrerTenantId: true,
      referralId: true,
      sourceTenantLicenseId: true,
      basePlanPrice: true,
      commissionRate: true,
      commissionAmount: true,
      currency: true,
      status: true,
    },
  }) : [];

  const balance = referral ? await prisma.affiliateCreditBalance.findUnique({
    where: { tenantId: referral.referrerTenantId },
    select: {
      tenantId: true,
      availableCredit: true,
      appliedCredit: true,
      carryOverCredit: true,
      updatedAt: true,
    },
  }) : null;

  console.log(JSON.stringify({ referredTenant, referral, ledger, balance }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
