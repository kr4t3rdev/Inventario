import { PrismaClient } from '../src/generated/prisma';
const prisma = new PrismaClient();
const email = 'hostflow-1783164728860@example.com';

async function main() {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      userId: true,
      email: true,
      onboardingStatus: true,
      pendingReferralCode: true,
      emailVerifiedAt: true,
      isActive: true,
      createdAt: true,
    },
  });
  console.log(JSON.stringify(user, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
