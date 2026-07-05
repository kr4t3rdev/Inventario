import { PrismaClient } from '../../../src/generated/prisma';

const prisma = new PrismaClient();
const email = process.argv[2] || process.env.EMAIL;

if (!email) {
  console.error('Usage: pnpm exec tsx scripts/ops/affiliate/check-user.ts <email>');
  process.exit(1);
}

async function main() {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      userId: true,
      email: true,
      onboardingStatus: true,
      onboardingType: true,
      pendingReferralCode: true,
      emailVerifiedAt: true,
      isActive: true,
      createdAt: true,
      expiresAt: true,
    },
  });

  console.log(JSON.stringify(user, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
