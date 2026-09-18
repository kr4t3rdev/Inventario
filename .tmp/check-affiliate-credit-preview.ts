import { PrismaClient } from '../src/generated/prisma';
const prisma = new PrismaClient();
const referrerCode = 'REF-728860';

async function main() {
  const profile = await prisma.affiliateProfile.findUnique({
    where: { referralCode: referrerCode },
    select: { tenantId: true, referralCode: true },
  });
  if (!profile) {
    console.log(JSON.stringify({ profile: null }, null, 2));
    return;
  }

  const activeLicense = await prisma.tenantLicense.findFirst({
    where: { tenantId: profile.tenantId, activa: true },
    orderBy: { inicio: 'desc' },
    select: {
      tenantLicenseId: true,
      tenantId: true,
      listPriceUsd: true,
      creditAppliedUsd: true,
      finalPriceUsd: true,
      creditSnapshotUsd: true,
    },
  });

  const balance = await prisma.affiliateCreditBalance.findUnique({
    where: { tenantId: profile.tenantId },
    select: {
      availableCredit: true,
      appliedCredit: true,
      carryOverCredit: true,
      updatedAt: true,
    },
  });

  console.log(JSON.stringify({ profile, activeLicense, balance }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
